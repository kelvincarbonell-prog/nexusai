-- NexusAI - Labor module expansion, autonomous agents (invoice ingestion, expense categorization),
-- inbound email forwarding alias and PWA voice support.
-- Run after 20260515201000_accounting_pgc.sql in the Supabase SQL editor.

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
