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
