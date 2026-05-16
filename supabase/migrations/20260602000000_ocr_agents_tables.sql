-- ============================================================================
-- 20260602000000_ocr_agents_tables.sql
-- ----------------------------------------------------------------------------
-- Tablas para el lector OCR, ejecuciones de agentes IA y emails entrantes.
-- Idempotente. Aplica este patch si recibes:
--   "Could not find the table 'public.facturas_recibidas_extracciones' …"
-- ============================================================================

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

-- updated_at trigger (defensive: create function if missing)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute $fn$
      create or replace function public.set_updated_at() returns trigger as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$ language plpgsql
    $fn$;
  end if;
end$$;

drop trigger if exists set_updated_at_extracciones on public.facturas_recibidas_extracciones;
create trigger set_updated_at_extracciones before update on public.facturas_recibidas_extracciones
  for each row execute function public.set_updated_at();

alter table public.facturas_recibidas_extracciones enable row level security;

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

create table if not exists public.expense_categorization_history (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  proveedor_pattern text,
  cuenta_pgc text,
  categoria text,
  count integer not null default 1,
  last_used timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_history_empresa on public.expense_categorization_history(empresa_id, proveedor_pattern);

alter table public.expense_categorization_history enable row level security;

-- Refresca el cache de PostgREST.
notify pgrst, 'reload schema';
