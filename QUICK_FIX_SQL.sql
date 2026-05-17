-- ============================================================================
-- QUICK_FIX_SQL.sql · Modelo 26
-- ----------------------------------------------------------------------------
-- Pega este fichero ENTERO en el SQL Editor de Supabase y dale Run.
-- Es idempotente: puedes ejecutarlo todas las veces que quieras.
--
-- Cubre los errores típicos:
--   "Could not find the 'X' column of 'Y' in the schema cache"
--   "column firma_docs.storage_path does not exist"
--   "column documentos.tipo does not exist"
--   "column mensajes.remitente_id does not exist"
--   "Could not find the table 'public.facturas_recibidas_extracciones'"
--   "Could not find the 'base' column of 'gastos' in the schema cache"
--   "Could not find the 'nombre' column of 'empresas' in the schema cache"
--
-- Tras ejecutarlo NO necesitas reiniciar nada — el último comando refresca
-- el cache de PostgREST automáticamente.
-- ============================================================================

-- =========================================================================
-- 1) HELPERS BÁSICOS (set_updated_at, is_admin, can_access_empresa)
-- =========================================================================
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

-- =========================================================================
-- 2) EMPRESAS (nombre, metadata, account_type, plan, inbox_alias, gestor_id…)
-- =========================================================================
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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empresas' and column_name = 'razon_social'
  ) then
    execute 'update public.empresas set nombre = coalesce(nombre, razon_social) where nombre is null';
  end if;
end$$;

update public.empresas set nombre = coalesce(nombre, 'Sin nombre') where nombre is null;
alter table public.empresas alter column nombre set not null;

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
alter table public.empresas add column if not exists nif text;
alter table public.empresas add column if not exists account_type text not null default 'empresa';
alter table public.empresas add column if not exists plan text not null default 'starter';
alter table public.empresas add column if not exists inbox_alias text;
alter table public.empresas add column if not exists onboarding_source text not null default 'gestoria';
alter table public.empresas add column if not exists cliente_slug text;
alter table public.empresas add column if not exists super_admin_notes text;
alter table public.empresas add column if not exists estado text not null default 'activo';
alter table public.empresas add column if not exists gestor_id uuid references auth.users(id) on delete set null;
alter table public.empresas add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_empresas_nombre on public.empresas(nombre);
create index if not exists idx_empresas_nif on public.empresas(nif);
create index if not exists idx_empresas_gestor_id on public.empresas(gestor_id);
create index if not exists idx_empresas_owner_user_id on public.empresas(owner_user_id);

-- =========================================================================
-- 3) FACTURAS
-- =========================================================================
alter table public.facturas add column if not exists tipo text not null default 'emitida';
alter table public.facturas add column if not exists numero text;
alter table public.facturas add column if not exists contacto_nombre text;
alter table public.facturas add column if not exists fecha_emision date;
alter table public.facturas add column if not exists fecha_vencimiento date;
alter table public.facturas add column if not exists estado text not null default 'borrador';
alter table public.facturas add column if not exists base numeric(14, 2) not null default 0;
alter table public.facturas add column if not exists iva numeric(14, 2) not null default 0;
alter table public.facturas add column if not exists total numeric(14, 2) not null default 0;
alter table public.facturas add column if not exists storage_path text;
alter table public.facturas add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.facturas add column if not exists payment_status text;
alter table public.facturas add column if not exists payment_link_url text;
alter table public.facturas add column if not exists gestor_id uuid references auth.users(id) on delete set null;
alter table public.facturas add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

create index if not exists idx_facturas_empresa_tipo on public.facturas(empresa_id, tipo);
create index if not exists idx_facturas_fecha on public.facturas(fecha_emision desc);

-- =========================================================================
-- 4) GASTOS
-- =========================================================================
alter table public.gastos add column if not exists proveedor text;
alter table public.gastos add column if not exists concepto text;
alter table public.gastos add column if not exists fecha date;
alter table public.gastos add column if not exists estado text not null default 'pendiente';
alter table public.gastos add column if not exists base numeric(14, 2) not null default 0;
alter table public.gastos add column if not exists iva numeric(14, 2) not null default 0;
alter table public.gastos add column if not exists total numeric(14, 2) not null default 0;
alter table public.gastos add column if not exists storage_path text;
alter table public.gastos add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.gastos add column if not exists gestor_id uuid references auth.users(id) on delete set null;
alter table public.gastos add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

create index if not exists idx_gastos_empresa on public.gastos(empresa_id);
create index if not exists idx_gastos_fecha on public.gastos(fecha desc);

-- =========================================================================
-- 5) DOCUMENTOS
-- =========================================================================
alter table public.documentos add column if not exists nombre text;
alter table public.documentos add column if not exists tipo text;
alter table public.documentos add column if not exists storage_path text;
alter table public.documentos add column if not exists estado text not null default 'pendiente';
alter table public.documentos add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.documentos add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.documentos add column if not exists gestor_id uuid references auth.users(id) on delete set null;
update public.documentos set nombre = coalesce(nombre, 'Documento') where nombre is null;
alter table public.documentos alter column nombre set not null;
create index if not exists idx_documentos_empresa on public.documentos(empresa_id, created_at desc);
create index if not exists idx_documentos_tipo on public.documentos(tipo);

-- =========================================================================
-- 6) FIRMA_DOCS
-- =========================================================================
alter table public.firma_docs add column if not exists ref text;
alter table public.firma_docs add column if not exists empresa_id uuid references public.empresas(id) on delete set null;
alter table public.firma_docs add column if not exists empresa text;
alter table public.firma_docs add column if not exists doc_tipo text not null default 'documento';
alter table public.firma_docs add column if not exists gestor_id uuid references auth.users(id) on delete cascade;
alter table public.firma_docs add column if not exists gestor_email text;
alter table public.firma_docs add column if not exists original_hash text;
alter table public.firma_docs add column if not exists signed_hash text;
alter table public.firma_docs add column if not exists cert_info text;
alter table public.firma_docs add column if not exists filename text;
alter table public.firma_docs add column if not exists storage_path text;
alter table public.firma_docs add column if not exists file_size integer not null default 0;
alter table public.firma_docs add column if not exists formato text not null default 'pdf';
alter table public.firma_docs add column if not exists created_at timestamptz not null default now();
update public.firma_docs set ref = coalesce(ref, id::text) where ref is null;
update public.firma_docs set empresa = coalesce(empresa, '') where empresa is null;
update public.firma_docs set filename = coalesce(filename, 'documento.pdf') where filename is null;
update public.firma_docs set storage_path = coalesce(storage_path, '') where storage_path is null;
update public.firma_docs set signed_hash = coalesce(signed_hash, '') where signed_hash is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'firma_docs_ref_key' and conrelid = 'public.firma_docs'::regclass
  ) then
    begin
      execute 'alter table public.firma_docs add constraint firma_docs_ref_key unique (ref)';
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_firma_docs_empresa on public.firma_docs(empresa_id, created_at desc);

-- =========================================================================
-- 7) MENSAJES (chat cliente ↔ asesor)
-- =========================================================================
alter table public.mensajes add column if not exists remitente_id uuid references auth.users(id) on delete cascade;
alter table public.mensajes add column if not exists contenido text;
alter table public.mensajes add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.mensajes add column if not exists leido boolean not null default false;
alter table public.mensajes add column if not exists fecha_lectura timestamptz;
alter table public.mensajes add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='user_id') then
    execute 'update public.mensajes set remitente_id = coalesce(remitente_id, user_id) where remitente_id is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='from_user_id') then
    execute 'update public.mensajes set remitente_id = coalesce(remitente_id, from_user_id) where remitente_id is null';
  end if;
end$$;

create index if not exists idx_mensajes_empresa on public.mensajes(empresa_id, created_at desc);

-- =========================================================================
-- 8) SOLICITUDES LABORALES
-- =========================================================================
alter table public.solicitudes_laborales add column if not exists tipo text not null default 'general';
alter table public.solicitudes_laborales add column if not exists descripcion text;
alter table public.solicitudes_laborales add column if not exists estado text not null default 'pendiente';
alter table public.solicitudes_laborales add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.solicitudes_laborales add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.solicitudes_laborales add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.solicitudes_laborales add column if not exists created_at timestamptz not null default now();
alter table public.solicitudes_laborales add column if not exists updated_at timestamptz not null default now();

-- =========================================================================
-- 9) TRABAJADORES (alta de personal)
-- =========================================================================
alter table public.trabajadores add column if not exists nombre text;
alter table public.trabajadores add column if not exists dni text;
alter table public.trabajadores add column if not exists nss text;
alter table public.trabajadores add column if not exists email text;
alter table public.trabajadores add column if not exists telefono text;
alter table public.trabajadores add column if not exists puesto text;
alter table public.trabajadores add column if not exists fecha_alta date;
alter table public.trabajadores add column if not exists fecha_baja date;
alter table public.trabajadores add column if not exists fecha_nacimiento date;
alter table public.trabajadores add column if not exists tipo_contrato text;
alter table public.trabajadores add column if not exists jornada_horas numeric(5, 2);
alter table public.trabajadores add column if not exists salario_bruto_anual numeric(14, 2);
alter table public.trabajadores add column if not exists irpf_pct numeric(5, 2);
alter table public.trabajadores add column if not exists activo boolean not null default true;
alter table public.trabajadores add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.trabajadores add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.trabajadores add column if not exists gestor_id uuid references auth.users(id) on delete set null;
update public.trabajadores set nombre = coalesce(nombre, 'Sin nombre') where nombre is null;
alter table public.trabajadores alter column nombre set not null;

-- =========================================================================
-- 10) NOMINAS
-- =========================================================================
alter table public.nominas add column if not exists trabajador_id uuid references public.trabajadores(id) on delete cascade;
alter table public.nominas add column if not exists periodo text;
alter table public.nominas add column if not exists bruto numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists irpf numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists ss_trabajador numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists ss_empresa numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists total numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists estado text not null default 'borrador';
alter table public.nominas add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.nominas add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

-- =========================================================================
-- 11) AGENT_RUNS + OCR (facturas_recibidas_extracciones + inbound_emails)
-- =========================================================================
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

create table if not exists public.facturas_recibidas_extracciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  source text not null default 'upload',
  inbound_email_id uuid references public.inbound_emails(id) on delete set null,
  storage_path text,
  filename text,
  hash text,
  raw_text text,
  datos_extraidos jsonb not null default '{}',
  status text not null default 'pending',
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

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  agent_id text not null,
  triggered_by uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  status text not null default 'success',
  duration_ms integer,
  provider text,
  cost_estimate numeric(10, 4),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_empresa on public.agent_runs(empresa_id, created_at desc);

-- =========================================================================
-- 12) STORAGE BUCKETS (ocr-uploads, documents, payroll-receipts, aeat-files)
-- =========================================================================
insert into storage.buckets (id, name, public) values ('ocr-uploads', 'ocr-uploads', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('aeat-files', 'aeat-files', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('payroll-receipts', 'payroll-receipts', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- =========================================================================
-- PERFILES — para que el upsert de /api/perfil funcione siempre
-- =========================================================================
alter table public.perfiles add column if not exists email text not null default '';
alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists apellidos text;
alter table public.perfiles add column if not exists rol text not null default 'gestor';
alter table public.perfiles add column if not exists nombre_gestoria text;
alter table public.perfiles add column if not exists gestoria_slug text;
alter table public.perfiles add column if not exists foto_url text;
alter table public.perfiles add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.perfiles add column if not exists created_at timestamptz not null default now();
alter table public.perfiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at_perfiles on public.perfiles;
create trigger set_updated_at_perfiles before update on public.perfiles
  for each row execute function public.set_updated_at();

-- =========================================================================
-- updated_at + created_at defensivos + triggers (arregla
-- "column documentos.updated_at does not exist")
-- =========================================================================
alter table public.documentos add column if not exists updated_at timestamptz not null default now();
alter table public.documentos add column if not exists created_at timestamptz not null default now();
alter table public.facturas add column if not exists updated_at timestamptz not null default now();
alter table public.facturas add column if not exists created_at timestamptz not null default now();
alter table public.gastos add column if not exists updated_at timestamptz not null default now();
alter table public.gastos add column if not exists created_at timestamptz not null default now();
alter table public.trabajadores add column if not exists updated_at timestamptz not null default now();
alter table public.trabajadores add column if not exists created_at timestamptz not null default now();
alter table public.nominas add column if not exists updated_at timestamptz not null default now();
alter table public.nominas add column if not exists created_at timestamptz not null default now();
alter table public.empresas add column if not exists updated_at timestamptz not null default now();
alter table public.empresas add column if not exists created_at timestamptz not null default now();
alter table public.firma_docs add column if not exists updated_at timestamptz not null default now();
alter table public.solicitudes_laborales add column if not exists updated_at timestamptz not null default now();
alter table public.solicitudes_laborales add column if not exists created_at timestamptz not null default now();

drop trigger if exists set_updated_at_documentos on public.documentos;
create trigger set_updated_at_documentos before update on public.documentos
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
drop trigger if exists set_updated_at_empresas on public.empresas;
create trigger set_updated_at_empresas before update on public.empresas
  for each row execute function public.set_updated_at();

-- =========================================================================
-- SPRINT 5: CONCILIACIÓN BANCARIA + TESORERÍA
-- =========================================================================
create table if not exists public.bank_movements (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  iban text,
  banco text,
  oficina text,
  cuenta text,
  fecha_operacion date not null,
  fecha_valor date,
  importe numeric(14, 2) not null,
  divisa text not null default 'EUR',
  concepto_comun text,
  concepto_propio text,
  referencia1 text,
  referencia2 text,
  saldo_acumulado numeric(14, 2),
  origen text not null default 'n43',
  factura_id uuid references public.facturas(id) on delete set null,
  gasto_id uuid references public.gastos(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_movements_empresa_fecha on public.bank_movements(empresa_id, fecha_operacion desc);
create index if not exists idx_bank_movements_factura on public.bank_movements(factura_id);
create index if not exists idx_bank_movements_gasto on public.bank_movements(gasto_id);

drop trigger if exists set_updated_at_bank_movements on public.bank_movements;
create trigger set_updated_at_bank_movements before update on public.bank_movements
  for each row execute function public.set_updated_at();

alter table public.bank_movements enable row level security;

-- =========================================================================
-- SPRINT 7: BOT FISCAL PROACTIVO — registro de presentaciones AEAT
-- =========================================================================
create table if not exists public.aeat_presentaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  modelo text not null,                   -- "303" | "111" | "115" | "130" | "390" | "200"
  ejercicio integer not null,
  periodo text not null,                  -- "1T" | "2T" | "3T" | "4T" | "ANUAL"
  fecha_presentacion date not null default current_date,
  importe numeric(14, 2),
  csv text,                               -- Código Seguro de Verificación AEAT
  estado text not null default 'presentado',
  presentado_por uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, modelo, ejercicio, periodo)
);
create index if not exists idx_aeat_presentaciones_empresa on public.aeat_presentaciones(empresa_id, ejercicio desc, modelo);

drop trigger if exists set_updated_at_aeat_presentaciones on public.aeat_presentaciones;
create trigger set_updated_at_aeat_presentaciones before update on public.aeat_presentaciones
  for each row execute function public.set_updated_at();

alter table public.aeat_presentaciones enable row level security;

-- Idempotencia: si la empresa cambió de tipo, asegúrate de tener la columna tipo
alter table public.empresas add column if not exists tipo text default 'autonomo';
alter table public.empresas add column if not exists iban text;

-- =========================================================================
-- ÚLTIMO PASO: refresca el cache de PostgREST sin reiniciar
-- =========================================================================
notify pgrst, 'reload schema';
