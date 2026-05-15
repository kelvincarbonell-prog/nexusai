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
-- 2. NÓMINAS: índices y unique por (empresa, trabajador, periodo) para upsert.
--    Las columnas de detalle van en metadata jsonb (no se rompe nada existente).
-- =============================================================================
create unique index if not exists nominas_empresa_trabajador_periodo_uidx
  on public.nominas(empresa_id, trabajador_id, periodo)
  where trabajador_id is not null;

create index if not exists nominas_empresa_periodo_idx
  on public.nominas(empresa_id, periodo);

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
