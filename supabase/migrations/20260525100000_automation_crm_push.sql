-- Modelo 26 — Reglas de automatización, CRM ligero, notificaciones push.
-- Auto-suficiente con preflight defensivo.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- =============================================================================
-- 1. REGLAS DE AUTOMATIZACIÓN (if-this-then-that)
-- =============================================================================
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  nombre text not null,
  trigger_event text not null check (trigger_event in (
    'factura_creada', 'factura_vencida', 'factura_pagada',
    'gasto_creado', 'gasto_alto',
    'fichaje_no_entrada', 'fichaje_no_salida',
    'modelo_proximo_vencimiento', 'modelo_presentado',
    'cliente_creado', 'cliente_inactivo_30d',
    'email_recibido', 'extraccion_baja_confianza'
  )),
  trigger_filters jsonb not null default '{}',
  action_type text not null check (action_type in (
    'email_recordatorio', 'whatsapp', 'asignar_categoria',
    'crear_tarea', 'notificar_gestor', 'webhook'
  )),
  action_config jsonb not null default '{}',
  estado text not null default 'activa' check (estado in ('activa', 'pausada', 'archivada')),
  num_ejecuciones integer not null default 0,
  ultima_ejecucion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rules_empresa_estado
  on public.automation_rules(empresa_id, estado);
create index if not exists idx_rules_trigger
  on public.automation_rules(trigger_event)
  where estado = 'activa';

drop trigger if exists set_updated_at_rules on public.automation_rules;
create trigger set_updated_at_rules before update on public.automation_rules
  for each row execute function public.set_updated_at();

alter table public.automation_rules enable row level security;

drop policy if exists "rules by company" on public.automation_rules;
create policy "rules by company" on public.automation_rules
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "rules write" on public.automation_rules;
create policy "rules write" on public.automation_rules
for all using (gestor_id = auth.uid() or public.is_admin())
with check (public.can_access_empresa(empresa_id));

-- Log de ejecuciones
create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  trigger_payload jsonb,
  action_result jsonb,
  status text not null default 'success' check (status in ('success', 'failed', 'skipped')),
  error text,
  executed_at timestamptz not null default now()
);

create index if not exists idx_rule_executions
  on public.automation_executions(rule_id, executed_at desc);

alter table public.automation_executions enable row level security;

drop policy if exists "rule executions by company" on public.automation_executions;
create policy "rule executions by company" on public.automation_executions
for select using (public.can_access_empresa(empresa_id) or public.is_admin());

-- =============================================================================
-- 2. CRM LIGERO — oportunidades y pipeline
-- =============================================================================
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  empresa text,
  nif text,
  email text,
  telefono text,
  fuente text default 'manual' check (fuente in ('manual', 'web', 'referido', 'campaña', 'inbound', 'cl@ve')),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'cualificado', 'propuesta', 'ganado', 'perdido')),
  valor_estimado numeric(14, 2),
  probabilidad smallint default 50 check (probabilidad between 0 and 100),
  notas text,
  proxima_accion text,
  fecha_proxima_accion date,
  empresa_id uuid references public.empresas(id) on delete set null,    -- si se convierte
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_leads_gestor
  on public.crm_leads(gestor_id, estado);
create index if not exists idx_crm_leads_proxima
  on public.crm_leads(fecha_proxima_accion)
  where estado not in ('ganado', 'perdido');

drop trigger if exists set_updated_at_leads on public.crm_leads;
create trigger set_updated_at_leads before update on public.crm_leads
  for each row execute function public.set_updated_at();

alter table public.crm_leads enable row level security;

drop policy if exists "leads owner" on public.crm_leads;
create policy "leads owner" on public.crm_leads
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

-- Actividades del lead (llamadas, emails, notas)
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('llamada', 'email', 'reunion', 'nota', 'whatsapp')),
  resumen text not null,
  cuando timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_activities_lead
  on public.crm_activities(lead_id, cuando desc);

alter table public.crm_activities enable row level security;

drop policy if exists "activities by lead" on public.crm_activities;
create policy "activities by lead" on public.crm_activities
for all using (
  exists (select 1 from public.crm_leads l where l.id = lead_id and (l.gestor_id = auth.uid() or public.is_admin()))
)
with check (
  exists (select 1 from public.crm_leads l where l.id = lead_id and (l.gestor_id = auth.uid() or public.is_admin()))
);

-- =============================================================================
-- 3. NOTIFICACIONES PUSH (Web Push API + VAPID)
-- =============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subs_user
  on public.push_subscriptions(user_id, active);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subs owner" on public.push_subscriptions;
create policy "push subs owner" on public.push_subscriptions
for all using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Log de envíos
create table if not exists public.push_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  title text not null,
  body text,
  url text,
  payload jsonb,
  sent_at timestamptz not null default now(),
  delivered boolean not null default false,
  error text
);

create index if not exists idx_push_messages_user
  on public.push_messages(user_id, sent_at desc);

alter table public.push_messages enable row level security;

drop policy if exists "push messages owner" on public.push_messages;
create policy "push messages owner" on public.push_messages
for select using (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- 4. TAREAS (para gestoría — recordatorios y pendientes por cliente)
-- =============================================================================
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  asignado_a uuid references auth.users(id) on delete set null,
  titulo text not null,
  descripcion text,
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'completada', 'cancelada')),
  fecha_limite date,
  completada_en timestamptz,
  origen text default 'manual',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tareas_empresa_estado
  on public.tareas(empresa_id, estado);
create index if not exists idx_tareas_asignado
  on public.tareas(asignado_a, estado)
  where estado != 'completada';
create index if not exists idx_tareas_fecha_limite
  on public.tareas(fecha_limite)
  where estado != 'completada';

drop trigger if exists set_updated_at_tareas on public.tareas;
create trigger set_updated_at_tareas before update on public.tareas
  for each row execute function public.set_updated_at();

alter table public.tareas enable row level security;

drop policy if exists "tareas by company" on public.tareas;
create policy "tareas by company" on public.tareas
for select using (
  asignado_a = auth.uid()
  or gestor_id = auth.uid()
  or (empresa_id is not null and public.can_access_empresa(empresa_id))
  or public.is_admin()
);

drop policy if exists "tareas write" on public.tareas;
create policy "tareas write" on public.tareas
for all using (gestor_id = auth.uid() or asignado_a = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or asignado_a = auth.uid() or public.is_admin());
