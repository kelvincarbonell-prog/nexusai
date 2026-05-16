-- ============================================================================
-- MODELO 26 — SQL MASTER CONSOLIDADO (todas las migraciones en orden)
-- Idempotente: se puede ejecutar sobre una base vacía o con datos existentes.
-- Pégalo entero en el SQL Editor de Supabase y dale a Run.
-- ============================================================================

-- Extensiones necesarias
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ============================================================================
-- PRE-NORMALIZACIÓN: renombra asesor_id -> gestor_id en cualquier tabla legacy
-- que tenga el nombre antiguo. Idempotente: si ya está renombrado, no hace nada.
-- ============================================================================
do $rename_all$
declare
  t text;
  tables text[] := array[
    'empresas', 'facturas', 'gastos', 'trabajadores', 'nominas',
    'documentos', 'firma_docs', 'solicitudes_laborales'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'asesor_id'
      ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'gestor_id'
      ) then
        execute format('alter table public.%I rename column asesor_id to gestor_id', t);
      end if;
      execute format('alter table public.%I add column if not exists gestor_id uuid', t);
    end if;
  end loop;
end;
$rename_all$;


-- ===========================================================================
-- 20260515180000_initial_nexusai.sql
-- ===========================================================================
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  apellidos text,
  rol text not null default 'gestor' check (rol in ('admin', 'gestor', 'asesor', 'portal_cliente')),
  nombre_gestoria text,
  foto_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null references auth.users(id) on delete cascade,
  razon_social text not null,
  nif text,
  sector text,
  email text,
  telefono text,
  direccion text,
  estado text not null default 'activo',
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_accesos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'bloqueado')),
  token_invitacion text unique,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'emitida' check (tipo in ('emitida', 'recibida', 'simplificada')),
  numero text,
  contacto_nombre text,
  fecha_emision date,
  fecha_vencimiento date,
  estado text not null default 'borrador',
  base numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  storage_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  proveedor text,
  concepto text,
  fecha date,
  estado text not null default 'pendiente',
  base numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  storage_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  dni text,
  puesto text,
  activo boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nominas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajador_id uuid references public.trabajadores(id) on delete set null,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  periodo text not null,
  storage_path text,
  total numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text,
  storage_path text,
  estado text not null default 'pendiente',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solicitudes_laborales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null,
  descripcion text,
  estado text not null default 'pendiente',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  remitente_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null,
  leido boolean not null default false,
  fecha_lectura timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.firma_docs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  empresa_id uuid references public.empresas(id) on delete set null,
  empresa text not null,
  doc_tipo text not null,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  gestor_email text,
  original_hash text,
  signed_hash text not null,
  cert_info text,
  filename text not null,
  storage_path text not null,
  file_size integer not null,
  formato text not null,
  timestamp_firma timestamptz not null default now()
);

create index if not exists idx_empresas_gestor_id on public.empresas(gestor_id);
create index if not exists idx_portal_accesos_user_id on public.portal_accesos(user_id);
create index if not exists idx_portal_accesos_empresa_id on public.portal_accesos(empresa_id);
create index if not exists idx_facturas_empresa_id on public.facturas(empresa_id);
create index if not exists idx_facturas_gestor_id on public.facturas(gestor_id);
create index if not exists idx_gastos_empresa_id on public.gastos(empresa_id);
create index if not exists idx_trabajadores_empresa_id on public.trabajadores(empresa_id);
create index if not exists idx_documentos_empresa_id on public.documentos(empresa_id);
create index if not exists idx_mensajes_empresa_id_created_at on public.mensajes(empresa_id, created_at desc);
create index if not exists idx_firma_docs_gestor_id on public.firma_docs(gestor_id);
create index if not exists idx_firma_docs_empresa_id on public.firma_docs(empresa_id);

drop trigger if exists set_updated_at_perfiles on public.perfiles;
create trigger set_updated_at_perfiles before update on public.perfiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_empresas on public.empresas;
create trigger set_updated_at_empresas before update on public.empresas
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_facturas on public.facturas;
create trigger set_updated_at_facturas before update on public.facturas
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_gastos on public.gastos;
create trigger set_updated_at_gastos before update on public.gastos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_trabajadores on public.trabajadores;
create trigger set_updated_at_trabajadores before update on public.trabajadores
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_documentos on public.documentos;
create trigger set_updated_at_documentos before update on public.documentos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_solicitudes_laborales on public.solicitudes_laborales;
create trigger set_updated_at_solicitudes_laborales before update on public.solicitudes_laborales
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function public.can_access_empresa(target_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = target_empresa and e.gestor_id = auth.uid()
  )
  or exists (
    select 1 from public.portal_accesos pa
    where pa.empresa_id = target_empresa
      and pa.user_id = auth.uid()
      and pa.estado = 'activo'
  )
  or public.is_admin();
$$;

alter table public.perfiles enable row level security;
alter table public.empresas enable row level security;
alter table public.portal_accesos enable row level security;
alter table public.facturas enable row level security;
alter table public.gastos enable row level security;
alter table public.trabajadores enable row level security;
alter table public.nominas enable row level security;
alter table public.documentos enable row level security;
alter table public.solicitudes_laborales enable row level security;
alter table public.mensajes enable row level security;
alter table public.firma_docs enable row level security;

drop policy if exists "profiles own read" on public.perfiles;
create policy "profiles own read" on public.perfiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles own insert" on public.perfiles;
create policy "profiles own insert" on public.perfiles
for insert with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles own update" on public.perfiles;
create policy "profiles own update" on public.perfiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "companies visible" on public.empresas;
create policy "companies visible" on public.empresas
for select using (gestor_id = auth.uid() or public.can_access_empresa(id));

drop policy if exists "companies insert" on public.empresas;
create policy "companies insert" on public.empresas
for insert with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "companies update" on public.empresas;
create policy "companies update" on public.empresas
for update using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "companies delete" on public.empresas;
create policy "companies delete" on public.empresas
for delete using (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "portal access visible" on public.portal_accesos;
create policy "portal access visible" on public.portal_accesos
for select using (user_id = auth.uid() or public.can_access_empresa(empresa_id));

drop policy if exists "portal access insert" on public.portal_accesos;
create policy "portal access insert" on public.portal_accesos
for insert with check (public.can_access_empresa(empresa_id));

drop policy if exists "portal access update" on public.portal_accesos;
create policy "portal access update" on public.portal_accesos
for update using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "invoices by company" on public.facturas;
create policy "invoices by company" on public.facturas
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "invoices insert" on public.facturas;
create policy "invoices insert" on public.facturas
for insert with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "invoices update" on public.facturas;
create policy "invoices update" on public.facturas
for update using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "invoices delete" on public.facturas;
create policy "invoices delete" on public.facturas
for delete using (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "expenses by company" on public.gastos;
create policy "expenses by company" on public.gastos
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "expenses insert" on public.gastos;
create policy "expenses insert" on public.gastos
for insert with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "expenses update" on public.gastos;
create policy "expenses update" on public.gastos
for update using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "expenses delete" on public.gastos;
create policy "expenses delete" on public.gastos
for delete using (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "workers by company" on public.trabajadores;
create policy "workers by company" on public.trabajadores
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "workers write" on public.trabajadores;
create policy "workers write" on public.trabajadores
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "payroll by company" on public.nominas;
create policy "payroll by company" on public.nominas
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "payroll write" on public.nominas;
create policy "payroll write" on public.nominas
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "documents by company" on public.documentos;
create policy "documents by company" on public.documentos
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "documents write" on public.documentos;
create policy "documents write" on public.documentos
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "requests by company" on public.solicitudes_laborales;
create policy "requests by company" on public.solicitudes_laborales
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "requests insert by company user" on public.solicitudes_laborales;
create policy "requests insert by company user" on public.solicitudes_laborales
for insert with check (public.can_access_empresa(empresa_id));

drop policy if exists "requests update by company user" on public.solicitudes_laborales;
create policy "requests update by company user" on public.solicitudes_laborales
for update using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "messages by company" on public.mensajes;
create policy "messages by company" on public.mensajes
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "messages insert by company" on public.mensajes;
create policy "messages insert by company" on public.mensajes
for insert with check (public.can_access_empresa(empresa_id) and remitente_id = auth.uid());

drop policy if exists "messages update by company" on public.mensajes;
create policy "messages update by company" on public.mensajes
for update using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "signatures owner read" on public.firma_docs;
create policy "signatures owner read" on public.firma_docs
for select using (gestor_id = auth.uid() or public.is_admin());

drop policy if exists "signatures owner insert" on public.firma_docs;
create policy "signatures owner insert" on public.firma_docs
for insert with check (gestor_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('ocr-uploads', 'ocr-uploads', false)
on conflict (id) do update set public = false;

drop policy if exists "signed docs owner read" on storage.objects;
create policy "signed docs owner read" on storage.objects
for select using (
  bucket_id = 'signed-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "documents owner read" on storage.objects;
create policy "documents owner read" on storage.objects
for select using (
  bucket_id in ('documents', 'ocr-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "documents owner insert" on storage.objects;
create policy "documents owner insert" on storage.objects
for insert with check (
  bucket_id in ('documents', 'ocr-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "documents owner update" on storage.objects;
create policy "documents owner update" on storage.objects
for update using (
  bucket_id in ('documents', 'ocr-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id in ('documents', 'ocr-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

-- ===========================================================================
-- 20260515180500_core_helpers_compatibility.sql
-- ===========================================================================
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean := false;
begin
  if to_regclass('public.perfiles') is null then
    return false;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfiles'
      and column_name in ('id', 'rol')
    group by table_schema, table_name
    having count(*) = 2
  ) then
    return false;
  end if;

  execute 'select exists (select 1 from public.perfiles where id = auth.uid() and rol = ''admin'')'
    into result;

  return coalesce(result, false);
end;
$$;

-- ===========================================================================
-- 20260515192500_empresas_schema_compatibility.sql
-- ===========================================================================
alter table public.empresas
  add column if not exists gestor_id uuid references auth.users(id) on delete cascade,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists account_type text not null default 'empresa',
  add column if not exists onboarding_source text not null default 'gestoria',
  add column if not exists plan text not null default 'starter',
  add column if not exists super_admin_notes text,
  add column if not exists cliente_slug text;

alter table public.empresas
  alter column gestor_id drop not null;

create index if not exists idx_empresas_gestor_id on public.empresas(gestor_id);
create index if not exists idx_empresas_owner_user_id on public.empresas(owner_user_id);
create index if not exists idx_empresas_onboarding_source on public.empresas(onboarding_source);
create index if not exists idx_empresas_account_type on public.empresas(account_type);

create or replace function public.can_access_empresa(target_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = target_empresa
      and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
  )
  or exists (
    select 1 from public.portal_accesos pa
    where pa.empresa_id = target_empresa
      and pa.user_id = auth.uid()
      and pa.estado = 'activo'
  )
  or public.is_admin();
$$;

-- ===========================================================================
-- 20260515193000_super_admin_agents_self_serve.sql
-- ===========================================================================
alter table public.empresas
  alter column gestor_id drop not null;

alter table public.empresas
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists account_type text not null default 'empresa',
  add column if not exists onboarding_source text not null default 'gestoria',
  add column if not exists plan text not null default 'starter',
  add column if not exists super_admin_notes text;

create index if not exists idx_empresas_owner_user_id on public.empresas(owner_user_id);
create index if not exists idx_empresas_onboarding_source on public.empresas(onboarding_source);
create index if not exists idx_empresas_account_type on public.empresas(account_type);

create table if not exists public.agent_configs (
  id text primary key,
  name text not null,
  category text not null default 'general',
  enabled boolean not null default true,
  priority integer not null default 100,
  mission text not null,
  rules_do text[] not null default '{}',
  rules_dont text[] not null default '{}',
  order_prompt text not null,
  config jsonb not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.super_admin_settings (
  key text primary key,
  value jsonb not null default '{}',
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_configs_priority on public.agent_configs(priority);
create index if not exists idx_platform_audit_events_actor_id on public.platform_audit_events(actor_id);
create index if not exists idx_platform_audit_events_created_at on public.platform_audit_events(created_at desc);

drop trigger if exists set_updated_at_agent_configs on public.agent_configs;
create trigger set_updated_at_agent_configs before update on public.agent_configs
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_super_admin_settings on public.super_admin_settings;
create trigger set_updated_at_super_admin_settings before update on public.super_admin_settings
for each row execute function public.set_updated_at();

create or replace function public.can_access_empresa(target_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = target_empresa
      and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
  )
  or exists (
    select 1 from public.portal_accesos pa
    where pa.empresa_id = target_empresa
      and pa.user_id = auth.uid()
      and pa.estado = 'activo'
  )
  or public.is_admin();
$$;

alter table public.agent_configs enable row level security;
alter table public.super_admin_settings enable row level security;
alter table public.platform_audit_events enable row level security;

drop policy if exists "companies visible" on public.empresas;
create policy "companies visible" on public.empresas
for select using (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.can_access_empresa(id)
);

drop policy if exists "companies insert" on public.empresas;
create policy "companies insert" on public.empresas
for insert with check (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "companies update" on public.empresas;
create policy "companies update" on public.empresas
for update using (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
)
with check (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "companies delete" on public.empresas;
create policy "companies delete" on public.empresas
for delete using (gestor_id = auth.uid() or owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "agent configs admin read" on public.agent_configs;
create policy "agent configs admin read" on public.agent_configs
for select using (public.is_admin());

drop policy if exists "agent configs admin write" on public.agent_configs;
create policy "agent configs admin write" on public.agent_configs
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "super admin settings admin read" on public.super_admin_settings;
create policy "super admin settings admin read" on public.super_admin_settings
for select using (public.is_admin());

drop policy if exists "super admin settings admin write" on public.super_admin_settings;
create policy "super admin settings admin write" on public.super_admin_settings
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "audit admin read" on public.platform_audit_events;
create policy "audit admin read" on public.platform_audit_events
for select using (public.is_admin());

drop policy if exists "audit authenticated insert" on public.platform_audit_events;
create policy "audit authenticated insert" on public.platform_audit_events
for insert with check (actor_id = auth.uid() or public.is_admin());

insert into public.agent_configs
  (id, name, category, enabled, priority, mission, rules_do, rules_dont, order_prompt)
values
  ('architect-supabase-rls', 'Arquitecto Supabase/RLS', 'database', true, 1,
   'Diseñar y revisar Supabase, RLS, Storage y modelo multi-tenant.',
   array['Revisar tablas nuevas', 'Revisar RLS', 'Revisar Storage privado', 'Revisar accesos por empresa'],
   array['No aprobar cambios sin control de ownership', 'No exponer service role en cliente'],
   'Actua como Arquitecto Supabase/RLS de NexusAI. Revisa permisos, tablas, storage y multi-tenancy.'),
  ('security', 'Agente Seguridad', 'security', true, 2,
   'Proteger datos, credenciales, documentos y APIs.',
   array['Buscar claves expuestas', 'Revisar APIs', 'Revisar descargas', 'Revisar XSS y autorizacion'],
   array['No permitir secretos en navegador', 'No aprobar descargas sin ownership'],
   'Actua como Agente Seguridad de NexusAI. Identifica riesgos criticos, altos y medios.'),
  ('fiscal', 'Agente Fiscal', 'fiscal', true, 3,
   'Validar flujos fiscales españoles para gestorías.',
   array['Revisar IVA', 'Revisar IRPF', 'Revisar modelos', 'Revisar VeriFactu', 'Revisar SEPA y plazos'],
   array['No dar por valido un calculo fiscal sin trazabilidad', 'No sustituir revision profesional humana'],
   'Actua como Agente Fiscal de NexusAI. Revisa formulas, plazos, estados y riesgos fiscales.'),
  ('laboral', 'Agente Laboral', 'laboral', true, 4,
   'Validar flujos laborales: trabajadores, nóminas, contratos, bajas y registro horario.',
   array['Revisar datos laborales sensibles', 'Revisar permisos', 'Revisar contratos y nominas', 'Revisar workflows laborales'],
   array['No exponer datos de empleados', 'No aprobar documentos laborales sin campos obligatorios'],
   'Actua como Agente Laboral de NexusAI. Revisa riesgos laborales, permisos y datos requeridos.'),
  ('product-ux', 'Agente Frontend/Product UX', 'product', true, 5,
   'Optimizar la experiencia del sistema operativo 360 para gestorías.',
   array['Revisar navegación', 'Revisar workflows', 'Revisar estados vacios', 'Revisar formularios'],
   array['No usar patrones de landing dentro del dashboard operativo', 'No ocultar acciones criticas'],
   'Actua como Agente Product UX de NexusAI. Mejora flujos, pantallas y eficiencia operativa.'),
  ('qa-e2e', 'Agente QA/E2E', 'qa', true, 6,
   'Verificar flujos completos y regresiones.',
   array['Probar login', 'Probar permisos cruzados', 'Probar documentos', 'Probar flujos criticos'],
   array['No aprobar sin prueba happy path', 'No aprobar sin prueba de denegacion de permisos'],
   'Actua como Agente QA/E2E de NexusAI. Define pruebas, bloqueos y riesgos de regresion.'),
  ('performance', 'Agente Performance', 'performance', true, 7,
   'Mantener NexusAI rapido y escalable en Vercel.',
   array['Revisar bundle', 'Revisar queries', 'Revisar cache', 'Revisar tablas grandes'],
   array['No añadir dependencias pesadas sin motivo', 'No cargar listas grandes sin paginacion'],
   'Actua como Agente Performance de NexusAI. Revisa bundle, queries, cache y Core Web Vitals.'),
  ('seo-marketing', 'Agente SEO/Marketing', 'seo', true, 8,
   'Posicionar NexusAI publicamente sin exponer rutas privadas.',
   array['Revisar metadata', 'Revisar schema', 'Revisar copy publico', 'Revisar indexabilidad'],
   array['No indexar dashboard privado', 'No mostrar datos sensibles en paginas publicas'],
   'Actua como Agente SEO/Marketing de NexusAI. Revisa posicionamiento, metadata y contenidos publicos.'),
  ('devops-vercel', 'Agente DevOps/Vercel', 'devops', true, 9,
   'Asegurar despliegues automaticos y observabilidad en Vercel.',
   array['Revisar variables de entorno', 'Revisar build logs', 'Revisar dominios', 'Revisar rollback'],
   array['No desplegar sin variables necesarias', 'No commitear secretos'],
   'Actua como Agente DevOps/Vercel de NexusAI. Revisa deploy, variables, logs y rollback.')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  enabled = excluded.enabled,
  priority = excluded.priority,
  mission = excluded.mission,
  rules_do = excluded.rules_do,
  rules_dont = excluded.rules_dont,
  order_prompt = excluded.order_prompt,
  updated_at = now();

insert into public.super_admin_settings (key, value, description)
values
  ('onboarding', '{"self_serve_enabled": true, "gestoria_invites_enabled": true}', 'Opciones de registro para gestorías, autónomos y empresas independientes'),
  ('security', '{"require_private_storage": true, "require_rls": true, "ai_keys_server_side_only": true}', 'Reglas globales de seguridad'),
  ('limits', '{"starter_clients": 3, "starter_documents_month": 50, "starter_ai_calls_month": 100}', 'Límites iniciales por plan')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- ===========================================================================
-- 20260515194500_numeric_public_slugs.sql
-- ===========================================================================
create or replace function public.generate_numeric_slug(slug_length integer default 10)
returns text
language plpgsql
volatile
as $$
declare
  result text := '';
  i integer := 0;
begin
  if slug_length < 6 then
    slug_length := 6;
  end if;

  result := (1 + floor(random() * 9))::int::text;
  for i in 2..slug_length loop
    result := result || floor(random() * 10)::int::text;
  end loop;

  return result;
end;
$$;

alter table public.empresas
  add column if not exists cliente_slug text;

alter table public.perfiles
  add column if not exists gestoria_slug text;

create unique index if not exists idx_empresas_cliente_slug_unique
  on public.empresas(cliente_slug)
  where cliente_slug is not null;

create unique index if not exists idx_perfiles_gestoria_slug_unique
  on public.perfiles(gestoria_slug)
  where gestoria_slug is not null;

alter table public.empresas
  drop constraint if exists empresas_cliente_slug_numeric_check;

alter table public.empresas
  add constraint empresas_cliente_slug_numeric_check
  check (cliente_slug is null or cliente_slug ~ '^[0-9]{6,20}$');

alter table public.perfiles
  drop constraint if exists perfiles_gestoria_slug_numeric_check;

alter table public.perfiles
  add constraint perfiles_gestoria_slug_numeric_check
  check (gestoria_slug is null or gestoria_slug ~ '^[0-9]{6,20}$');

create or replace function public.set_empresa_cliente_slug()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.cliente_slug is not null and new.cliente_slug <> '' then
    new.cliente_slug := regexp_replace(new.cliente_slug, '[^0-9]', '', 'g');
    return new;
  end if;

  loop
    candidate := public.generate_numeric_slug(10);
    exit when not exists (
      select 1 from public.empresas e where e.cliente_slug = candidate
    );
  end loop;

  new.cliente_slug := candidate;
  return new;
end;
$$;

create or replace function public.set_perfil_gestoria_slug()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.rol not in ('admin', 'gestor', 'asesor') then
    return new;
  end if;

  if new.gestoria_slug is not null and new.gestoria_slug <> '' then
    new.gestoria_slug := regexp_replace(new.gestoria_slug, '[^0-9]', '', 'g');
    return new;
  end if;

  loop
    candidate := public.generate_numeric_slug(10);
    exit when not exists (
      select 1 from public.perfiles p where p.gestoria_slug = candidate
    );
  end loop;

  new.gestoria_slug := candidate;
  return new;
end;
$$;

drop trigger if exists set_empresa_cliente_slug on public.empresas;
create trigger set_empresa_cliente_slug
before insert or update of cliente_slug on public.empresas
for each row execute function public.set_empresa_cliente_slug();

drop trigger if exists set_perfil_gestoria_slug on public.perfiles;
create trigger set_perfil_gestoria_slug
before insert or update of gestoria_slug, rol on public.perfiles
for each row execute function public.set_perfil_gestoria_slug();

do $$
declare
  row_to_update record;
  candidate text;
begin
  for row_to_update in
    select id from public.empresas where cliente_slug is null
  loop
    loop
      candidate := public.generate_numeric_slug(10);
      exit when not exists (
        select 1 from public.empresas e where e.cliente_slug = candidate
      );
    end loop;

    update public.empresas
    set cliente_slug = candidate
    where id = row_to_update.id;
  end loop;
end;
$$;

do $$
declare
  row_to_update record;
  candidate text;
begin
  for row_to_update in
    select id from public.perfiles
    where rol in ('admin', 'gestor', 'asesor')
      and gestoria_slug is null
  loop
    loop
      candidate := public.generate_numeric_slug(10);
      exit when not exists (
        select 1 from public.perfiles p where p.gestoria_slug = candidate
      );
    end loop;

    update public.perfiles
    set gestoria_slug = candidate
    where id = row_to_update.id;
  end loop;
end;
$$;

-- ===========================================================================
-- 20260515201000_accounting_pgc.sql
-- ===========================================================================
create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fiscal_year integer not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, fiscal_year)
);

create table if not exists public.pgc_accounts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  code text not null,
  name text not null,
  group_code text not null,
  subgroup_code text,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense', 'memo')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  is_system boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  period_id uuid references public.accounting_periods(id) on delete set null,
  entry_number bigint,
  entry_date date not null,
  description text not null,
  source_type text not null default 'manual',
  source_id text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'void')),
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  account_id uuid not null references public.pgc_accounts(id) on delete restrict,
  line_number integer not null default 1,
  description text,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0),
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  account_id uuid references public.pgc_accounts(id) on delete set null,
  iban text,
  bank_name text,
  alias text not null,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  statement_date date not null,
  amount numeric(14, 2) not null,
  concept text,
  status text not null default 'pending' check (status in ('pending', 'matched', 'ignored')),
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  asset_account_id uuid references public.pgc_accounts(id) on delete set null,
  amortization_account_id uuid references public.pgc_accounts(id) on delete set null,
  expense_account_id uuid references public.pgc_accounts(id) on delete set null,
  name text not null,
  acquisition_date date not null,
  acquisition_cost numeric(14, 2) not null,
  useful_life_months integer not null,
  residual_value numeric(14, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'sold', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vat_ledger (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  invoice_id uuid references public.facturas(id) on delete set null,
  kind text not null check (kind in ('output', 'input')),
  tax_period text not null,
  base numeric(14, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 21,
  vat_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_periods_empresa_year on public.accounting_periods(empresa_id, fiscal_year);
create index if not exists idx_accounting_periods_empresa_dates on public.accounting_periods(empresa_id, starts_on, ends_on);
create index if not exists idx_pgc_accounts_empresa_code on public.pgc_accounts(empresa_id, code);
create unique index if not exists idx_pgc_accounts_global_code_unique
  on public.pgc_accounts(code)
  where empresa_id is null;
create index if not exists idx_journal_entries_empresa_date on public.journal_entries(empresa_id, entry_date desc);
create unique index if not exists idx_journal_entries_empresa_number_unique
  on public.journal_entries(empresa_id, entry_number)
  where entry_number is not null;
create index if not exists idx_journal_lines_empresa_account on public.journal_lines(empresa_id, account_id);
create index if not exists idx_bank_reconciliations_empresa_status on public.bank_reconciliations(empresa_id, status);
create index if not exists idx_fixed_assets_empresa_status on public.fixed_assets(empresa_id, status);
create index if not exists idx_vat_ledger_empresa_period on public.vat_ledger(empresa_id, tax_period);

drop trigger if exists set_updated_at_accounting_periods on public.accounting_periods;
create trigger set_updated_at_accounting_periods before update on public.accounting_periods
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_pgc_accounts on public.pgc_accounts;
create trigger set_updated_at_pgc_accounts before update on public.pgc_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_journal_entries on public.journal_entries;
create trigger set_updated_at_journal_entries before update on public.journal_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_bank_accounts on public.bank_accounts;
create trigger set_updated_at_bank_accounts before update on public.bank_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_fixed_assets on public.fixed_assets;
create trigger set_updated_at_fixed_assets before update on public.fixed_assets
for each row execute function public.set_updated_at();

alter table public.accounting_periods enable row level security;
alter table public.pgc_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.vat_ledger enable row level security;

drop policy if exists "accounting periods by company" on public.accounting_periods;
create policy "accounting periods by company" on public.accounting_periods
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "pgc accounts read" on public.pgc_accounts;
create policy "pgc accounts read" on public.pgc_accounts
for select using (empresa_id is null or public.can_access_empresa(empresa_id));

drop policy if exists "pgc accounts company write" on public.pgc_accounts;
create policy "pgc accounts company write" on public.pgc_accounts
for all using (empresa_id is not null and public.can_access_empresa(empresa_id))
with check (empresa_id is not null and public.can_access_empresa(empresa_id));

drop policy if exists "journal entries by company" on public.journal_entries;
create policy "journal entries by company" on public.journal_entries
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "journal lines by company" on public.journal_lines;
create policy "journal lines by company" on public.journal_lines
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "bank accounts by company" on public.bank_accounts;
create policy "bank accounts by company" on public.bank_accounts
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "bank reconciliations by company" on public.bank_reconciliations;
create policy "bank reconciliations by company" on public.bank_reconciliations
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "fixed assets by company" on public.fixed_assets;
create policy "fixed assets by company" on public.fixed_assets
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "vat ledger by company" on public.vat_ledger;
create policy "vat ledger by company" on public.vat_ledger
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

create or replace function public.assert_journal_entry_balanced(target_entry uuid)
returns boolean
language plpgsql
stable
as $$
declare
  total_debit numeric(14, 2);
  total_credit numeric(14, 2);
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into total_debit, total_credit
  from public.journal_lines
  where entry_id = target_entry;

  return total_debit = total_credit and total_debit > 0;
end;
$$;

insert into public.pgc_accounts
  (empresa_id, code, name, group_code, subgroup_code, account_type, normal_balance, is_system)
select null, seed.code, seed.name, seed.group_code, seed.subgroup_code, seed.account_type, seed.normal_balance, true
from (
  values
    ('100', 'Capital social', '1', '10', 'equity', 'credit'),
    ('112', 'Reserva legal', '1', '11', 'equity', 'credit'),
    ('129', 'Resultado del ejercicio', '1', '12', 'equity', 'credit'),
    ('170', 'Deudas a largo plazo con entidades de credito', '1', '17', 'liability', 'credit'),
    ('171', 'Deudas a largo plazo', '1', '17', 'liability', 'credit'),
    ('173', 'Proveedores de inmovilizado a largo plazo', '1', '17', 'liability', 'credit'),
    ('200', 'Investigacion', '2', '20', 'asset', 'debit'),
    ('203', 'Propiedad industrial', '2', '20', 'asset', 'debit'),
    ('206', 'Aplicaciones informaticas', '2', '20', 'asset', 'debit'),
    ('210', 'Terrenos y bienes naturales', '2', '21', 'asset', 'debit'),
    ('211', 'Construcciones', '2', '21', 'asset', 'debit'),
    ('212', 'Instalaciones tecnicas', '2', '21', 'asset', 'debit'),
    ('213', 'Maquinaria', '2', '21', 'asset', 'debit'),
    ('214', 'Utillaje', '2', '21', 'asset', 'debit'),
    ('215', 'Otras instalaciones', '2', '21', 'asset', 'debit'),
    ('216', 'Mobiliario', '2', '21', 'asset', 'debit'),
    ('217', 'Equipos para procesos de informacion', '2', '21', 'asset', 'debit'),
    ('218', 'Elementos de transporte', '2', '21', 'asset', 'debit'),
    ('219', 'Otro inmovilizado material', '2', '21', 'asset', 'debit'),
    ('280', 'Amortizacion acumulada del inmovilizado intangible', '2', '28', 'asset', 'credit'),
    ('281', 'Amortizacion acumulada del inmovilizado material', '2', '28', 'asset', 'credit'),
    ('300', 'Mercaderias', '3', '30', 'asset', 'debit'),
    ('328', 'Material de oficina', '3', '32', 'asset', 'debit'),
    ('4000', 'Proveedores, euros', '4', '40', 'liability', 'credit'),
    ('400', 'Proveedores', '4', '40', 'liability', 'credit'),
    ('401', 'Proveedores, efectos comerciales a pagar', '4', '40', 'liability', 'credit'),
    ('407', 'Anticipos a proveedores', '4', '40', 'asset', 'debit'),
    ('410', 'Acreedores por prestaciones de servicios', '4', '41', 'liability', 'credit'),
    ('4100', 'Acreedores por prestaciones de servicios, euros', '4', '41', 'liability', 'credit'),
    ('430', 'Clientes', '4', '43', 'asset', 'debit'),
    ('4300', 'Clientes, euros', '4', '43', 'asset', 'debit'),
    ('431', 'Clientes, efectos comerciales a cobrar', '4', '43', 'asset', 'debit'),
    ('436', 'Clientes de dudoso cobro', '4', '43', 'asset', 'debit'),
    ('438', 'Anticipos de clientes', '4', '43', 'liability', 'credit'),
    ('440', 'Deudores', '4', '44', 'asset', 'debit'),
    ('465', 'Remuneraciones pendientes de pago', '4', '46', 'liability', 'credit'),
    ('4700', 'Hacienda Publica, deudora por IVA', '4', '47', 'asset', 'debit'),
    ('4709', 'Hacienda Publica, deudora por devolucion de impuestos', '4', '47', 'asset', 'debit'),
    ('471', 'Organismos de la Seguridad Social, deudores', '4', '47', 'asset', 'debit'),
    ('472', 'Hacienda Publica, IVA soportado', '4', '47', 'asset', 'debit'),
    ('4750', 'Hacienda Publica, acreedora por IVA', '4', '47', 'liability', 'credit'),
    ('4751', 'Hacienda Publica, acreedora por retenciones practicadas', '4', '47', 'liability', 'credit'),
    ('4752', 'Hacienda Publica, acreedora por impuesto sobre sociedades', '4', '47', 'liability', 'credit'),
    ('476', 'Organismos de la Seguridad Social, acreedores', '4', '47', 'liability', 'credit'),
    ('477', 'Hacienda Publica, IVA repercutido', '4', '47', 'liability', 'credit'),
    ('480', 'Gastos anticipados', '4', '48', 'asset', 'debit'),
    ('485', 'Ingresos anticipados', '4', '48', 'liability', 'credit'),
    ('520', 'Deudas a corto plazo con entidades de credito', '5', '52', 'liability', 'credit'),
    ('523', 'Proveedores de inmovilizado a corto plazo', '5', '52', 'liability', 'credit'),
    ('555', 'Partidas pendientes de aplicacion', '5', '55', 'memo', 'debit'),
    ('570', 'Caja, euros', '5', '57', 'asset', 'debit'),
    ('572', 'Bancos e instituciones de credito c/c vista, euros', '5', '57', 'asset', 'debit'),
    ('600', 'Compras de mercaderias', '6', '60', 'expense', 'debit'),
    ('602', 'Compras de otros aprovisionamientos', '6', '60', 'expense', 'debit'),
    ('607', 'Trabajos realizados por otras empresas', '6', '60', 'expense', 'debit'),
    ('609', 'Rappels por compras', '6', '60', 'expense', 'debit'),
    ('621', 'Arrendamientos y canones', '6', '62', 'expense', 'debit'),
    ('622', 'Reparaciones y conservacion', '6', '62', 'expense', 'debit'),
    ('623', 'Servicios de profesionales independientes', '6', '62', 'expense', 'debit'),
    ('624', 'Transportes', '6', '62', 'expense', 'debit'),
    ('625', 'Primas de seguros', '6', '62', 'expense', 'debit'),
    ('626', 'Servicios bancarios y similares', '6', '62', 'expense', 'debit'),
    ('627', 'Publicidad, propaganda y relaciones publicas', '6', '62', 'expense', 'debit'),
    ('628', 'Suministros', '6', '62', 'expense', 'debit'),
    ('629', 'Otros servicios', '6', '62', 'expense', 'debit'),
    ('630', 'Impuesto sobre beneficios', '6', '63', 'expense', 'debit'),
    ('631', 'Otros tributos', '6', '63', 'expense', 'debit'),
    ('640', 'Sueldos y salarios', '6', '64', 'expense', 'debit'),
    ('642', 'Seguridad Social a cargo de la empresa', '6', '64', 'expense', 'debit'),
    ('649', 'Otros gastos sociales', '6', '64', 'expense', 'debit'),
    ('662', 'Intereses de deudas', '6', '66', 'expense', 'debit'),
    ('680', 'Amortizacion del inmovilizado intangible', '6', '68', 'expense', 'debit'),
    ('681', 'Amortizacion del inmovilizado material', '6', '68', 'expense', 'debit'),
    ('694', 'Perdidas por deterioro de creditos comerciales', '6', '69', 'expense', 'debit'),
    ('700', 'Ventas de mercaderias', '7', '70', 'income', 'credit'),
    ('705', 'Prestaciones de servicios', '7', '70', 'income', 'credit'),
    ('706', 'Descuentos sobre ventas por pronto pago', '7', '70', 'income', 'debit'),
    ('708', 'Devoluciones de ventas y operaciones similares', '7', '70', 'income', 'debit'),
    ('709', 'Rappels sobre ventas', '7', '70', 'income', 'debit'),
    ('740', 'Subvenciones, donaciones y legados a la explotacion', '7', '74', 'income', 'credit'),
    ('769', 'Otros ingresos financieros', '7', '76', 'income', 'credit')
) as seed(code, name, group_code, subgroup_code, account_type, normal_balance)
where not exists (
  select 1 from public.pgc_accounts existing
  where existing.empresa_id is null
    and existing.code = seed.code
);

-- ===========================================================================
-- 20260515210000_labor_agents_inbox.sql
-- ===========================================================================
-- NexusAI - Labor module expansion, autonomous agents (invoice ingestion, expense categorization),
-- inbound email forwarding alias and PWA voice support.
-- Run after 20260515201000_accounting_pgc.sql in the Supabase SQL editor.

-- =============================================================================
-- 0. PREFLIGHT: helpers defensivos (por si faltan en el proyecto Supabase).
--    Si tu proyecto ya tiene estas funciones con la misma firma,
--    `create or replace` las deja igual.
-- =============================================================================
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Asegura que existe la columna owner_user_id antes de la definición de la función
-- (la usan migraciones previas y la función can_access_empresa de abajo).
alter table public.empresas add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

do $preflight$
declare
  has_portal boolean;
begin
  has_portal := to_regclass('public.portal_accesos') is not null;

  if has_portal then
    execute $func$
      create or replace function public.can_access_empresa(target_empresa uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.empresas e
          where e.id = target_empresa
            and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
        )
        or exists (
          select 1 from public.portal_accesos pa
          where pa.empresa_id = target_empresa
            and pa.user_id = auth.uid()
            and pa.estado = 'activo'
        )
        or public.is_admin();
      $body$;
    $func$;
  else
    execute $func$
      create or replace function public.can_access_empresa(target_empresa uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.empresas e
          where e.id = target_empresa
            and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
        )
        or public.is_admin();
      $body$;
    $func$;
  end if;
end;
$preflight$;

-- =============================================================================
-- 1. EMPRESAS: forwarding email alias
-- =============================================================================
alter table public.empresas add column if not exists inbox_alias text;
create unique index if not exists empresas_inbox_alias_uidx
  on public.empresas(inbox_alias)
  where inbox_alias is not null;

-- Generate a stable, opaque alias for any company that does not have one yet.
-- Format: facturas-<10 random base36 chars>
update public.empresas
set inbox_alias = 'facturas-' || lower(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
where inbox_alias is null;

create or replace function public.empresa_inbox_address(p_alias text)
returns text
language sql
stable
as $$
  select coalesce(p_alias, '') || '@inbox.nexusai.app';
$$;

-- =============================================================================
-- 2. TRABAJADORES: extra labor-grade columns
-- =============================================================================
alter table public.trabajadores add column if not exists nss text;
alter table public.trabajadores add column if not exists fecha_nacimiento date;
alter table public.trabajadores add column if not exists fecha_alta date;
alter table public.trabajadores add column if not exists fecha_baja date;
alter table public.trabajadores add column if not exists email text;
alter table public.trabajadores add column if not exists telefono text;
alter table public.trabajadores add column if not exists iban text;
alter table public.trabajadores add column if not exists tipo_contrato text;
alter table public.trabajadores add column if not exists jornada_horas numeric(5, 2) default 40;
alter table public.trabajadores add column if not exists salario_bruto_anual numeric(14, 2) default 0;
alter table public.trabajadores add column if not exists irpf_pct numeric(5, 2) default 0;
alter table public.trabajadores add column if not exists convenio text;
alter table public.trabajadores add column if not exists categoria text;

create index if not exists idx_trabajadores_activo on public.trabajadores(empresa_id, activo);

-- =============================================================================
-- 3. CONTRATOS LABORALES
-- =============================================================================
create table if not exists public.contratos_laborales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  tipo_contrato text not null,
  fecha_inicio date not null,
  fecha_fin date,
  jornada_horas numeric(5, 2) not null default 40,
  salario_bruto_anual numeric(14, 2) not null default 0,
  convenio text,
  categoria text,
  storage_path text,
  estado text not null default 'activo' check (estado in ('activo', 'finalizado', 'suspendido')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contratos_trabajador on public.contratos_laborales(trabajador_id);
create index if not exists idx_contratos_empresa on public.contratos_laborales(empresa_id);

drop trigger if exists set_updated_at_contratos on public.contratos_laborales;
create trigger set_updated_at_contratos before update on public.contratos_laborales
  for each row execute function public.set_updated_at();

alter table public.contratos_laborales enable row level security;

drop policy if exists "contratos by company" on public.contratos_laborales;
create policy "contratos by company" on public.contratos_laborales
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "contratos write" on public.contratos_laborales;
create policy "contratos write" on public.contratos_laborales
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

-- =============================================================================
-- 4. AUSENCIAS (vacaciones, IT, permisos, maternidad/paternidad, excedencia)
-- =============================================================================
create table if not exists public.ausencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  gestor_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('vacaciones', 'it', 'permiso', 'maternidad', 'paternidad', 'excedencia', 'otro')),
  fecha_inicio date not null,
  fecha_fin date not null,
  dias numeric(5, 1) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  motivo text,
  parte_baja_storage text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ausencias_trabajador on public.ausencias(trabajador_id);
create index if not exists idx_ausencias_empresa on public.ausencias(empresa_id, fecha_inicio);

drop trigger if exists set_updated_at_ausencias on public.ausencias;
create trigger set_updated_at_ausencias before update on public.ausencias
  for each row execute function public.set_updated_at();

alter table public.ausencias enable row level security;

drop policy if exists "ausencias by company" on public.ausencias;
create policy "ausencias by company" on public.ausencias
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "ausencias insert" on public.ausencias;
create policy "ausencias insert" on public.ausencias
for insert with check (public.can_access_empresa(empresa_id));

drop policy if exists "ausencias update" on public.ausencias;
create policy "ausencias update" on public.ausencias
for update using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "ausencias delete" on public.ausencias;
create policy "ausencias delete" on public.ausencias
for delete using (gestor_id = auth.uid() or public.is_admin());

-- =============================================================================
-- 5. REGISTRO HORARIO (check-in / check-out, RD 8/2019)
-- =============================================================================
create table if not exists public.registro_horario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  fecha date not null default current_date,
  hora_entrada timestamptz,
  hora_salida timestamptz,
  descanso_min integer not null default 0,
  horas_total numeric(5, 2),
  observaciones text,
  fuente text not null default 'manual' check (fuente in ('manual', 'voz', 'movil', 'web', 'reloj')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registro_horario_trabajador on public.registro_horario(trabajador_id, fecha);
create index if not exists idx_registro_horario_empresa on public.registro_horario(empresa_id, fecha);

drop trigger if exists set_updated_at_registro_horario on public.registro_horario;
create trigger set_updated_at_registro_horario before update on public.registro_horario
  for each row execute function public.set_updated_at();

alter table public.registro_horario enable row level security;

drop policy if exists "registro horario by company" on public.registro_horario;
create policy "registro horario by company" on public.registro_horario
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "registro horario insert" on public.registro_horario;
create policy "registro horario insert" on public.registro_horario
for insert with check (public.can_access_empresa(empresa_id));

drop policy if exists "registro horario update" on public.registro_horario;
create policy "registro horario update" on public.registro_horario
for update using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

-- Auto-compute horas_total when both timestamps exist.
create or replace function public.compute_registro_horas()
returns trigger
language plpgsql
as $$
begin
  if new.hora_entrada is not null and new.hora_salida is not null then
    new.horas_total := round(
      (extract(epoch from (new.hora_salida - new.hora_entrada)) / 3600.0)::numeric
      - (coalesce(new.descanso_min, 0) / 60.0)::numeric,
      2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists compute_horas_total on public.registro_horario;
create trigger compute_horas_total before insert or update on public.registro_horario
  for each row execute function public.compute_registro_horas();

-- =============================================================================
-- 6. INBOUND EMAILS (alias buzón único por empresa)
-- =============================================================================
create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  inbox_alias text not null,
  message_id text,
  from_addr text,
  to_addr text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb not null default '[]',
  raw_storage_path text,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inbound_emails_alias on public.inbound_emails(inbox_alias);
create index if not exists idx_inbound_emails_empresa on public.inbound_emails(empresa_id, created_at desc);
create unique index if not exists inbound_emails_message_uidx
  on public.inbound_emails(message_id)
  where message_id is not null;

alter table public.inbound_emails enable row level security;

drop policy if exists "inbound emails by company" on public.inbound_emails;
create policy "inbound emails by company" on public.inbound_emails
for select using (public.can_access_empresa(empresa_id));

-- =============================================================================
-- 7. EXTRACCIONES DE FACTURAS (agente IA)
-- =============================================================================
create table if not exists public.facturas_recibidas_extracciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  source text not null default 'upload' check (source in ('upload', 'email', 'manual', 'mobile')),
  inbound_email_id uuid references public.inbound_emails(id) on delete set null,
  storage_path text,
  filename text,
  hash text,
  raw_text text,
  datos_extraidos jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'extracted', 'reviewed', 'rejected', 'failed')),
  confidence numeric(5, 2),
  factura_id uuid references public.facturas(id) on delete set null,
  gasto_id uuid references public.gastos(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_extracciones_empresa on public.facturas_recibidas_extracciones(empresa_id, status);

drop trigger if exists set_updated_at_extracciones on public.facturas_recibidas_extracciones;
create trigger set_updated_at_extracciones before update on public.facturas_recibidas_extracciones
  for each row execute function public.set_updated_at();

alter table public.facturas_recibidas_extracciones enable row level security;

drop policy if exists "extracciones by company" on public.facturas_recibidas_extracciones;
create policy "extracciones by company" on public.facturas_recibidas_extracciones
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "extracciones write" on public.facturas_recibidas_extracciones;
create policy "extracciones write" on public.facturas_recibidas_extracciones
for all using (gestor_id = auth.uid() or public.is_admin())
with check (gestor_id = auth.uid() or public.is_admin());

-- =============================================================================
-- 8. HISTORIAL DE CATEGORIZACIÓN DE GASTOS (aprendizaje del agente)
-- =============================================================================
create table if not exists public.expense_categorization_history (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendor_nif text,
  vendor_name text,
  concepto text,
  pgc_account_code text not null,
  pgc_account_id uuid references public.pgc_accounts(id) on delete set null,
  gasto_id uuid references public.gastos(id) on delete set null,
  confidence numeric(5, 2),
  learned_from text not null default 'manual' check (learned_from in ('manual', 'ai', 'rule')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_history_empresa on public.expense_categorization_history(empresa_id);
create index if not exists idx_expense_history_vendor on public.expense_categorization_history(empresa_id, vendor_nif);
create index if not exists idx_expense_history_account on public.expense_categorization_history(pgc_account_code);

alter table public.expense_categorization_history enable row level security;

drop policy if exists "expense history by company" on public.expense_categorization_history;
create policy "expense history by company" on public.expense_categorization_history
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "expense history write" on public.expense_categorization_history;
create policy "expense history write" on public.expense_categorization_history
for insert with check (public.can_access_empresa(empresa_id));

-- =============================================================================
-- 9. AGENT RUNS (trazabilidad de ejecuciones)
-- =============================================================================
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  agent_id text not null,
  triggered_by uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  duration_ms integer,
  provider text,
  cost_estimate numeric(10, 4),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_empresa on public.agent_runs(empresa_id, created_at desc);
create index if not exists idx_agent_runs_agent on public.agent_runs(agent_id, created_at desc);

alter table public.agent_runs enable row level security;

drop policy if exists "agent runs by company" on public.agent_runs;
create policy "agent runs by company" on public.agent_runs
for select using (
  public.is_admin()
  or (empresa_id is not null and public.can_access_empresa(empresa_id))
);

-- =============================================================================
-- 10. STORAGE BUCKETS
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('inbound-emails', 'inbound-emails', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('invoice-uploads', 'invoice-uploads', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('labor-docs', 'labor-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "labor docs owner read" on storage.objects;
create policy "labor docs owner read" on storage.objects
for select using (
  bucket_id in ('labor-docs', 'invoice-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "labor docs owner insert" on storage.objects;
create policy "labor docs owner insert" on storage.objects
for insert with check (
  bucket_id in ('labor-docs', 'invoice-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "labor docs owner update" on storage.objects;
create policy "labor docs owner update" on storage.objects
for update using (
  bucket_id in ('labor-docs', 'invoice-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id in ('labor-docs', 'invoice-uploads')
  and split_part(name, '/', 1) = auth.uid()::text
);

-- ===========================================================================
-- 20260520140000_aeat_nominas_calendar.sql
-- ===========================================================================
-- Modelo 26 — Modelos AEAT (303/111/115/130) + cálculo de nómina con desglose.
-- Esta migración es AUTO-SUFICIENTE: crea los helpers de RLS si faltan,
-- el bucket de storage y todas las tablas/índices/policies en una sola pasada.

-- =============================================================================
-- 0. PREFLIGHT defensivo (idempotente). Si tu proyecto ya tiene estos helpers,
--    create or replace los deja igual. Soluciona el error
--    "function public.can_access_empresa(uuid) does not exist".
-- =============================================================================
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
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Normaliza el nombre de la columna: en proyectos antiguos puede llamarse
-- asesor_id en lugar de gestor_id. Renombramos para alinear con el código.
do $rename$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'asesor_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'gestor_id'
  ) then
    execute 'alter table public.empresas rename column asesor_id to gestor_id';
  end if;
end;
$rename$;

alter table public.empresas add column if not exists gestor_id uuid references auth.users(id) on delete set null;
alter table public.empresas add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

do $preflight$
declare
  has_portal boolean := to_regclass('public.portal_accesos') is not null;
begin
  if has_portal then
    execute $func$
      create or replace function public.can_access_empresa(target_empresa uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.empresas e
          where e.id = target_empresa
            and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
        )
        or exists (
          select 1 from public.portal_accesos pa
          where pa.empresa_id = target_empresa
            and pa.user_id = auth.uid()
            and pa.estado = 'activo'
        )
        or public.is_admin();
      $body$;
    $func$;
  else
    execute $func$
      create or replace function public.can_access_empresa(target_empresa uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.empresas e
          where e.id = target_empresa
            and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
        )
        or public.is_admin();
      $body$;
    $func$;
  end if;
end;
$preflight$;

-- =============================================================================
-- 1. DECLARACIONES AEAT (incluye 303 + 111 + 115 + 130 + 390 futuro)
-- =============================================================================
create table if not exists public.aeat_declaraciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  modelo text not null check (modelo in ('303','390','111','115','130','200','347','349')),
  ejercicio integer not null check (ejercicio between 2020 and 2099),
  periodo text not null,
  casillas jsonb not null default '{}',
  resumen jsonb not null default '{}',
  status text not null default 'borrador' check (status in ('borrador','revisado','presentado','anulado','error')),
  resultado numeric(14,2),
  fichero_storage_path text,
  pdf_storage_path text,
  ref_aeat text,
  presentado_en timestamptz,
  presentado_por uuid references auth.users(id) on delete set null,
  notas text,
  warnings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, modelo, ejercicio, periodo)
);

create index if not exists idx_aeat_dec_empresa
  on public.aeat_declaraciones(empresa_id, ejercicio, modelo);
create index if not exists idx_aeat_dec_status
  on public.aeat_declaraciones(status);

drop trigger if exists set_updated_at_aeat_declaraciones on public.aeat_declaraciones;
create trigger set_updated_at_aeat_declaraciones before update on public.aeat_declaraciones
  for each row execute function public.set_updated_at();

alter table public.aeat_declaraciones enable row level security;

drop policy if exists "aeat by company" on public.aeat_declaraciones;
create policy "aeat by company" on public.aeat_declaraciones
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "aeat write" on public.aeat_declaraciones;
create policy "aeat write" on public.aeat_declaraciones
for all using (gestor_id = auth.uid() or public.is_admin())
with check (public.can_access_empresa(empresa_id));

-- =============================================================================
-- 2. NÓMINAS: garantizamos columnas mínimas y luego creamos índices de upsert.
--    Auto-defensivo para proyectos con esquemas antiguos.
-- =============================================================================
create table if not exists public.nominas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trabajador_id uuid references public.trabajadores(id) on delete set null,
  gestor_id uuid references auth.users(id) on delete cascade,
  periodo text,
  storage_path text,
  total numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.nominas add column if not exists empresa_id uuid;
alter table public.nominas add column if not exists trabajador_id uuid;
alter table public.nominas add column if not exists gestor_id uuid;
alter table public.nominas add column if not exists periodo text;
alter table public.nominas add column if not exists storage_path text;
alter table public.nominas add column if not exists total numeric(14, 2) default 0;
alter table public.nominas add column if not exists metadata jsonb default '{}';
alter table public.nominas add column if not exists created_at timestamptz default now();

do $idx$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nominas' and column_name = 'periodo'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nominas' and column_name = 'trabajador_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nominas' and column_name = 'empresa_id'
  ) then
    create unique index if not exists nominas_empresa_trabajador_periodo_uidx
      on public.nominas(empresa_id, trabajador_id, periodo)
      where trabajador_id is not null;
    create index if not exists nominas_empresa_periodo_idx
      on public.nominas(empresa_id, periodo);
  end if;
end;
$idx$;

-- =============================================================================
-- 3. STORAGE: bucket privado para ficheros AEAT y recibos de nómina.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('aeat-files', 'aeat-files', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('payroll-receipts', 'payroll-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "aeat files owner read" on storage.objects;
create policy "aeat files owner read" on storage.objects
for select using (
  bucket_id = 'aeat-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "aeat files owner insert" on storage.objects;
create policy "aeat files owner insert" on storage.objects
for insert with check (
  bucket_id = 'aeat-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "payroll receipts owner read" on storage.objects;
create policy "payroll receipts owner read" on storage.objects
for select using (
  bucket_id = 'payroll-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "payroll receipts owner insert" on storage.objects;
create policy "payroll receipts owner insert" on storage.objects
for insert with check (
  bucket_id = 'payroll-receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);
-- ============================================================================
-- 20260601000000_empresas_nombre_metadata_compat.sql
-- ----------------------------------------------------------------------------
-- Schema compatibility for empresas:
--   * The base table in 20260515180000_initial_nexusai.sql declares
--     `razon_social` and `config`, but the application code uses `nombre`
--     and `metadata`. This migration normalizes both so existing databases
--     work regardless of their starting state.
--   * Also performs a PostgREST schema reload so the changes are visible
--     to the JSON API without needing to restart the project.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- 1. Ensure empresas.nombre exists (rename razon_social → nombre if needed).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'razon_social'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'nombre'
  ) then
    execute 'alter table public.empresas rename column razon_social to nombre';
  end if;
end$$;

alter table public.empresas add column if not exists nombre text;

-- Backfill nombre from razon_social if both somehow coexist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'razon_social'
  ) then
    execute 'update public.empresas set nombre = coalesce(nombre, razon_social) where nombre is null';
  end if;
end$$;

-- Make sure nombre is not null with a sane fallback.
update public.empresas set nombre = coalesce(nombre, 'Sin nombre') where nombre is null;
alter table public.empresas alter column nombre set not null;

-- 2. Ensure empresas.metadata exists (rename config → metadata otherwise add it).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'config'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'metadata'
  ) then
    execute 'alter table public.empresas rename column config to metadata';
  end if;
end$$;

alter table public.empresas add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 3. Make sure other columns the app uses always exist (defensive no-ops).
alter table public.empresas add column if not exists nif text;
alter table public.empresas add column if not exists account_type text not null default 'empresa';
alter table public.empresas add column if not exists plan text not null default 'starter';
alter table public.empresas add column if not exists inbox_alias text;
alter table public.empresas add column if not exists gestor_id uuid references auth.users(id) on delete set null;
alter table public.empresas add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_empresas_nombre on public.empresas(nombre);
create index if not exists idx_empresas_nif on public.empresas(nif);

-- 4. Tell PostgREST to refresh its schema cache so the API exposes the columns.
notify pgrst, 'reload schema';
