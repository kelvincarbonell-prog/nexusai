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
