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
