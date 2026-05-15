-- Modelo 26 — Estimaciones / presupuestos, facturación recurrente y pasarela Stripe.
-- Auto-suficiente: incluye preflight defensivo.

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

-- =============================================================================
-- 1. PRESUPUESTOS / ESTIMACIONES
-- =============================================================================
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  numero text,                                  -- p.ej. PRES-2026-0001
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviado', 'aceptado', 'rechazado', 'expirado', 'facturado')),
  cliente_nombre text not null,
  cliente_nif text,
  cliente_email text,
  cliente_direccion text,
  fecha_emision date not null default current_date,
  fecha_validez date,
  moneda text not null default 'EUR',
  base numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  irpf numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notas text,
  factura_id uuid,
  storage_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presupuestos_lineas (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  line_number integer not null,
  descripcion text not null,
  cantidad numeric(14, 4) not null default 1,
  precio_unitario numeric(14, 4) not null default 0,
  descuento_pct numeric(5, 2) not null default 0,
  iva_pct numeric(5, 2) not null default 21,
  irpf_pct numeric(5, 2) not null default 0,
  base numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_presupuestos_empresa
  on public.presupuestos(empresa_id, fecha_emision desc);
create index if not exists idx_presupuestos_estado
  on public.presupuestos(empresa_id, estado);
create index if not exists idx_presupuestos_lineas_presupuesto
  on public.presupuestos_lineas(presupuesto_id, line_number);

drop trigger if exists set_updated_at_presupuestos on public.presupuestos;
create trigger set_updated_at_presupuestos before update on public.presupuestos
  for each row execute function public.set_updated_at();

alter table public.presupuestos enable row level security;
alter table public.presupuestos_lineas enable row level security;

drop policy if exists "presupuestos by company" on public.presupuestos;
create policy "presupuestos by company" on public.presupuestos
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "presupuestos write" on public.presupuestos;
create policy "presupuestos write" on public.presupuestos
for all using (gestor_id = auth.uid() or public.is_admin())
with check (public.can_access_empresa(empresa_id));

drop policy if exists "presupuestos lineas by parent" on public.presupuestos_lineas;
create policy "presupuestos lineas by parent" on public.presupuestos_lineas
for all using (
  exists (
    select 1 from public.presupuestos p
    where p.id = presupuesto_id and public.can_access_empresa(p.empresa_id)
  )
)
with check (
  exists (
    select 1 from public.presupuestos p
    where p.id = presupuesto_id and public.can_access_empresa(p.empresa_id)
  )
);

-- =============================================================================
-- 2. FACTURACIÓN RECURRENTE (suscripciones)
-- =============================================================================
create table if not exists public.facturas_recurrentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,
  nombre text not null,                          -- p.ej. 'Cuota mensual Innova'
  cliente_nombre text not null,
  cliente_nif text,
  cliente_email text,
  cliente_direccion text,
  frecuencia text not null check (frecuencia in ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_emision smallint not null default 1 check (dia_emision between 1 and 28),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  proxima_emision date not null,
  base numeric(14, 2) not null default 0,
  iva_pct numeric(5, 2) not null default 21,
  irpf_pct numeric(5, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  concepto text,
  estado text not null default 'activa' check (estado in ('activa', 'pausada', 'finalizada')),
  ultima_emision date,
  num_emisiones integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurrentes_empresa
  on public.facturas_recurrentes(empresa_id, estado);
create index if not exists idx_recurrentes_proxima
  on public.facturas_recurrentes(proxima_emision)
  where estado = 'activa';

drop trigger if exists set_updated_at_recurrentes on public.facturas_recurrentes;
create trigger set_updated_at_recurrentes before update on public.facturas_recurrentes
  for each row execute function public.set_updated_at();

alter table public.facturas_recurrentes enable row level security;

drop policy if exists "recurrentes by company" on public.facturas_recurrentes;
create policy "recurrentes by company" on public.facturas_recurrentes
for select using (public.can_access_empresa(empresa_id));

drop policy if exists "recurrentes write" on public.facturas_recurrentes;
create policy "recurrentes write" on public.facturas_recurrentes
for all using (gestor_id = auth.uid() or public.is_admin())
with check (public.can_access_empresa(empresa_id));

-- =============================================================================
-- 3. PASARELA DE COBRO (Stripe / Redsys)
-- =============================================================================
alter table public.facturas add column if not exists payment_link_url text;
alter table public.facturas add column if not exists payment_status text default 'no_link'
  check (payment_status in ('no_link', 'pending', 'paid', 'failed', 'refunded', 'cancelled'));
alter table public.facturas add column if not exists payment_provider text
  check (payment_provider is null or payment_provider in ('stripe', 'redsys', 'bizum', 'sepa'));
alter table public.facturas add column if not exists payment_intent_id text;
alter table public.facturas add column if not exists paid_at timestamptz;
alter table public.facturas add column if not exists paid_amount numeric(14, 2);

create index if not exists idx_facturas_payment_status
  on public.facturas(empresa_id, payment_status)
  where payment_status != 'no_link';

-- Eventos de pago (idempotencia de webhooks)
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  factura_id uuid references public.facturas(id) on delete set null,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists idx_payment_events_factura
  on public.payment_events(factura_id, processed_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "payment events by company" on public.payment_events;
create policy "payment events by company" on public.payment_events
for select using (
  public.is_admin()
  or (empresa_id is not null and public.can_access_empresa(empresa_id))
);

-- =============================================================================
-- 4. STORAGE bucket para PDFs de presupuestos
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('presupuestos', 'presupuestos', false)
on conflict (id) do update set public = false;

drop policy if exists "presupuestos pdf owner read" on storage.objects;
create policy "presupuestos pdf owner read" on storage.objects
for select using (
  bucket_id = 'presupuestos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "presupuestos pdf owner insert" on storage.objects;
create policy "presupuestos pdf owner insert" on storage.objects
for insert with check (
  bucket_id = 'presupuestos'
  and split_part(name, '/', 1) = auth.uid()::text
);
