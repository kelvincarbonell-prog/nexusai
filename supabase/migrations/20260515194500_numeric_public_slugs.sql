create or replace function public.generate_numeric_slug(slug_length integer default 10)
returns text
language plpgsql
volatile
as $$
declare
  result text := '';
  i integer := 0;
begin
  if slug_length < 6 then
    slug_length := 6;
  end if;

  result := (1 + floor(random() * 9))::int::text;
  for i in 2..slug_length loop
    result := result || floor(random() * 10)::int::text;
  end loop;

  return result;
end;
$$;

alter table public.empresas
  add column if not exists cliente_slug text;

alter table public.perfiles
  add column if not exists gestoria_slug text;

create unique index if not exists idx_empresas_cliente_slug_unique
  on public.empresas(cliente_slug)
  where cliente_slug is not null;

create unique index if not exists idx_perfiles_gestoria_slug_unique
  on public.perfiles(gestoria_slug)
  where gestoria_slug is not null;

alter table public.empresas
  drop constraint if exists empresas_cliente_slug_numeric_check;

alter table public.empresas
  add constraint empresas_cliente_slug_numeric_check
  check (cliente_slug is null or cliente_slug ~ '^[0-9]{6,20}$');

alter table public.perfiles
  drop constraint if exists perfiles_gestoria_slug_numeric_check;

alter table public.perfiles
  add constraint perfiles_gestoria_slug_numeric_check
  check (gestoria_slug is null or gestoria_slug ~ '^[0-9]{6,20}$');

create or replace function public.set_empresa_cliente_slug()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.cliente_slug is not null and new.cliente_slug <> '' then
    new.cliente_slug := regexp_replace(new.cliente_slug, '[^0-9]', '', 'g');
    return new;
  end if;

  loop
    candidate := public.generate_numeric_slug(10);
    exit when not exists (
      select 1 from public.empresas e where e.cliente_slug = candidate
    );
  end loop;

  new.cliente_slug := candidate;
  return new;
end;
$$;

create or replace function public.set_perfil_gestoria_slug()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.rol not in ('admin', 'gestor', 'asesor') then
    return new;
  end if;

  if new.gestoria_slug is not null and new.gestoria_slug <> '' then
    new.gestoria_slug := regexp_replace(new.gestoria_slug, '[^0-9]', '', 'g');
    return new;
  end if;

  loop
    candidate := public.generate_numeric_slug(10);
    exit when not exists (
      select 1 from public.perfiles p where p.gestoria_slug = candidate
    );
  end loop;

  new.gestoria_slug := candidate;
  return new;
end;
$$;

drop trigger if exists set_empresa_cliente_slug on public.empresas;
create trigger set_empresa_cliente_slug
before insert or update of cliente_slug on public.empresas
for each row execute function public.set_empresa_cliente_slug();

drop trigger if exists set_perfil_gestoria_slug on public.perfiles;
create trigger set_perfil_gestoria_slug
before insert or update of gestoria_slug, rol on public.perfiles
for each row execute function public.set_perfil_gestoria_slug();

do $$
declare
  row_to_update record;
  candidate text;
begin
  for row_to_update in
    select id from public.empresas where cliente_slug is null
  loop
    loop
      candidate := public.generate_numeric_slug(10);
      exit when not exists (
        select 1 from public.empresas e where e.cliente_slug = candidate
      );
    end loop;

    update public.empresas
    set cliente_slug = candidate
    where id = row_to_update.id;
  end loop;
end;
$$;

do $$
declare
  row_to_update record;
  candidate text;
begin
  for row_to_update in
    select id from public.perfiles
    where rol in ('admin', 'gestor', 'asesor')
      and gestoria_slug is null
  loop
    loop
      candidate := public.generate_numeric_slug(10);
      exit when not exists (
        select 1 from public.perfiles p where p.gestoria_slug = candidate
      );
    end loop;

    update public.perfiles
    set gestoria_slug = candidate
    where id = row_to_update.id;
  end loop;
end;
$$;
