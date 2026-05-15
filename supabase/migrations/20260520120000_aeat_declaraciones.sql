-- M26 — Modelos AEAT (303, 390, 111, 115, 130). MVP focado en presentación batch.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.aeat_declaraciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  modelo text not null check (modelo in ('303','390','111','115','130')),
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

insert into storage.buckets (id, name, public)
values ('aeat-files', 'aeat-files', false)
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
