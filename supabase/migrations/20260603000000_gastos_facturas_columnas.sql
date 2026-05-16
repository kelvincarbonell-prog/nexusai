-- ============================================================================
-- 20260603000000_gastos_facturas_columnas.sql
-- ----------------------------------------------------------------------------
-- Defensive: garantiza que gastos y facturas tienen todas las columnas que la
-- app necesita. Arregla:
--   "Could not find the 'base' column of 'gastos' in the schema cache"
-- y similares. Idempotente.
-- ============================================================================

-- GASTOS ---------------------------------------------------------------------
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

-- Si existen columnas alternativas legacy, copia los valores antes (no-op si no hay).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='importe') then
    execute 'update public.gastos set total = coalesce(total, 0) + coalesce(importe, 0) where total = 0 and importe is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='base_imponible') then
    execute 'update public.gastos set base = coalesce(base, 0) + coalesce(base_imponible, 0) where base = 0 and base_imponible is not null';
  end if;
end$$;

-- FACTURAS -------------------------------------------------------------------
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

-- Constraint del tipo factura (defensive)
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public' and constraint_name = 'facturas_tipo_check'
  ) then
    begin
      execute 'alter table public.facturas add constraint facturas_tipo_check check (tipo in (''emitida'', ''recibida'', ''simplificada''))';
    exception when others then
      -- alguna fila tiene un valor incompatible; ignoramos para no romper
      null;
    end;
  end if;
end$$;

-- Indices útiles
create index if not exists idx_facturas_empresa_tipo on public.facturas(empresa_id, tipo);
create index if not exists idx_facturas_fecha on public.facturas(fecha_emision desc);
create index if not exists idx_gastos_empresa on public.gastos(empresa_id);
create index if not exists idx_gastos_fecha on public.gastos(fecha desc);

-- Refresca el cache PostgREST.
notify pgrst, 'reload schema';
