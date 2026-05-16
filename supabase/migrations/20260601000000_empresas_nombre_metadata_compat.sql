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
