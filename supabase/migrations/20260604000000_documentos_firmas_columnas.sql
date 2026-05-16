-- ============================================================================
-- 20260604000000_documentos_firmas_columnas.sql
-- ----------------------------------------------------------------------------
-- Defensive: garantiza columnas que la app usa en documentos, firma_docs,
-- trabajadores, nominas y solicitudes_laborales. Arregla:
--   "column firma_docs.storage_path does not exist"
--   "column documentos.tipo does not exist"
--   y similares. Idempotente.
-- ============================================================================

-- DOCUMENTOS -----------------------------------------------------------------
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

-- FIRMA_DOCS -----------------------------------------------------------------
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

-- Constraint único para ref si no existe ya
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'firma_docs_ref_key' and conrelid = 'public.firma_docs'::regclass
  ) then
    begin
      execute 'alter table public.firma_docs add constraint firma_docs_ref_key unique (ref)';
    exception when others then
      null;
    end;
  end if;
end$$;

create index if not exists idx_firma_docs_empresa on public.firma_docs(empresa_id, created_at desc);

-- TRABAJADORES (algunas columnas que usa la app) -----------------------------
alter table public.trabajadores add column if not exists nss text;
alter table public.trabajadores add column if not exists email text;
alter table public.trabajadores add column if not exists telefono text;
alter table public.trabajadores add column if not exists fecha_alta date;
alter table public.trabajadores add column if not exists fecha_baja date;
alter table public.trabajadores add column if not exists fecha_nacimiento date;
alter table public.trabajadores add column if not exists tipo_contrato text;
alter table public.trabajadores add column if not exists jornada_horas numeric(5, 2);
alter table public.trabajadores add column if not exists salario_bruto_anual numeric(14, 2);
alter table public.trabajadores add column if not exists irpf_pct numeric(5, 2);
alter table public.trabajadores add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
alter table public.trabajadores add column if not exists gestor_id uuid references auth.users(id) on delete set null;

-- NOMINAS (defensive) --------------------------------------------------------
alter table public.nominas add column if not exists trabajador_id uuid references public.trabajadores(id) on delete cascade;
alter table public.nominas add column if not exists periodo text;
alter table public.nominas add column if not exists bruto numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists irpf numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists ss_trabajador numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists ss_empresa numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists total numeric(14, 2) not null default 0;
alter table public.nominas add column if not exists estado text not null default 'borrador';
alter table public.nominas add column if not exists metadata jsonb not null default '{}'::jsonb;

-- SOLICITUDES_LABORALES (defensive) ------------------------------------------
alter table public.solicitudes_laborales add column if not exists tipo text not null default 'general';
alter table public.solicitudes_laborales add column if not exists descripcion text;
alter table public.solicitudes_laborales add column if not exists estado text not null default 'pendiente';
alter table public.solicitudes_laborales add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.solicitudes_laborales add column if not exists metadata jsonb not null default '{}'::jsonb;

-- MENSAJES (defensive) -------------------------------------------------------
alter table public.mensajes add column if not exists remitente_id uuid references auth.users(id) on delete cascade;
alter table public.mensajes add column if not exists contenido text;
alter table public.mensajes add column if not exists leido boolean not null default false;
alter table public.mensajes add column if not exists fecha_lectura timestamptz;

-- Refresca el cache PostgREST.
notify pgrst, 'reload schema';
