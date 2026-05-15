create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fiscal_year integer not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, fiscal_year)
);

create table if not exists public.pgc_accounts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  code text not null,
  name text not null,
  group_code text not null,
  subgroup_code text,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense', 'memo')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  is_system boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  period_id uuid references public.accounting_periods(id) on delete set null,
  entry_number bigint,
  entry_date date not null,
  description text not null,
  source_type text not null default 'manual',
  source_id text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'void')),
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  account_id uuid not null references public.pgc_accounts(id) on delete restrict,
  line_number integer not null default 1,
  description text,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0),
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  account_id uuid references public.pgc_accounts(id) on delete set null,
  iban text,
  bank_name text,
  alias text not null,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  statement_date date not null,
  amount numeric(14, 2) not null,
  concept text,
  status text not null default 'pending' check (status in ('pending', 'matched', 'ignored')),
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  asset_account_id uuid references public.pgc_accounts(id) on delete set null,
  amortization_account_id uuid references public.pgc_accounts(id) on delete set null,
  expense_account_id uuid references public.pgc_accounts(id) on delete set null,
  name text not null,
  acquisition_date date not null,
  acquisition_cost numeric(14, 2) not null,
  useful_life_months integer not null,
  residual_value numeric(14, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'sold', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vat_ledger (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  invoice_id uuid references public.facturas(id) on delete set null,
  kind text not null check (kind in ('output', 'input')),
  tax_period text not null,
  base numeric(14, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 21,
  vat_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_periods_empresa_year on public.accounting_periods(empresa_id, fiscal_year);
create index if not exists idx_accounting_periods_empresa_dates on public.accounting_periods(empresa_id, starts_on, ends_on);
create index if not exists idx_pgc_accounts_empresa_code on public.pgc_accounts(empresa_id, code);
create unique index if not exists idx_pgc_accounts_global_code_unique
  on public.pgc_accounts(code)
  where empresa_id is null;
create index if not exists idx_journal_entries_empresa_date on public.journal_entries(empresa_id, entry_date desc);
create unique index if not exists idx_journal_entries_empresa_number_unique
  on public.journal_entries(empresa_id, entry_number)
  where entry_number is not null;
create index if not exists idx_journal_lines_empresa_account on public.journal_lines(empresa_id, account_id);
create index if not exists idx_bank_reconciliations_empresa_status on public.bank_reconciliations(empresa_id, status);
create index if not exists idx_fixed_assets_empresa_status on public.fixed_assets(empresa_id, status);
create index if not exists idx_vat_ledger_empresa_period on public.vat_ledger(empresa_id, tax_period);

drop trigger if exists set_updated_at_accounting_periods on public.accounting_periods;
create trigger set_updated_at_accounting_periods before update on public.accounting_periods
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_pgc_accounts on public.pgc_accounts;
create trigger set_updated_at_pgc_accounts before update on public.pgc_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_journal_entries on public.journal_entries;
create trigger set_updated_at_journal_entries before update on public.journal_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_bank_accounts on public.bank_accounts;
create trigger set_updated_at_bank_accounts before update on public.bank_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_fixed_assets on public.fixed_assets;
create trigger set_updated_at_fixed_assets before update on public.fixed_assets
for each row execute function public.set_updated_at();

alter table public.accounting_periods enable row level security;
alter table public.pgc_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.vat_ledger enable row level security;

drop policy if exists "accounting periods by company" on public.accounting_periods;
create policy "accounting periods by company" on public.accounting_periods
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "pgc accounts read" on public.pgc_accounts;
create policy "pgc accounts read" on public.pgc_accounts
for select using (empresa_id is null or public.can_access_empresa(empresa_id));

drop policy if exists "pgc accounts company write" on public.pgc_accounts;
create policy "pgc accounts company write" on public.pgc_accounts
for all using (empresa_id is not null and public.can_access_empresa(empresa_id))
with check (empresa_id is not null and public.can_access_empresa(empresa_id));

drop policy if exists "journal entries by company" on public.journal_entries;
create policy "journal entries by company" on public.journal_entries
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "journal lines by company" on public.journal_lines;
create policy "journal lines by company" on public.journal_lines
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "bank accounts by company" on public.bank_accounts;
create policy "bank accounts by company" on public.bank_accounts
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "bank reconciliations by company" on public.bank_reconciliations;
create policy "bank reconciliations by company" on public.bank_reconciliations
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "fixed assets by company" on public.fixed_assets;
create policy "fixed assets by company" on public.fixed_assets
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

drop policy if exists "vat ledger by company" on public.vat_ledger;
create policy "vat ledger by company" on public.vat_ledger
for all using (public.can_access_empresa(empresa_id))
with check (public.can_access_empresa(empresa_id));

create or replace function public.assert_journal_entry_balanced(target_entry uuid)
returns boolean
language plpgsql
stable
as $$
declare
  total_debit numeric(14, 2);
  total_credit numeric(14, 2);
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into total_debit, total_credit
  from public.journal_lines
  where entry_id = target_entry;

  return total_debit = total_credit and total_debit > 0;
end;
$$;

insert into public.pgc_accounts
  (empresa_id, code, name, group_code, subgroup_code, account_type, normal_balance, is_system)
select null, seed.code, seed.name, seed.group_code, seed.subgroup_code, seed.account_type, seed.normal_balance, true
from (
  values
    ('100', 'Capital social', '1', '10', 'equity', 'credit'),
    ('112', 'Reserva legal', '1', '11', 'equity', 'credit'),
    ('129', 'Resultado del ejercicio', '1', '12', 'equity', 'credit'),
    ('170', 'Deudas a largo plazo con entidades de credito', '1', '17', 'liability', 'credit'),
    ('171', 'Deudas a largo plazo', '1', '17', 'liability', 'credit'),
    ('173', 'Proveedores de inmovilizado a largo plazo', '1', '17', 'liability', 'credit'),
    ('200', 'Investigacion', '2', '20', 'asset', 'debit'),
    ('203', 'Propiedad industrial', '2', '20', 'asset', 'debit'),
    ('206', 'Aplicaciones informaticas', '2', '20', 'asset', 'debit'),
    ('210', 'Terrenos y bienes naturales', '2', '21', 'asset', 'debit'),
    ('211', 'Construcciones', '2', '21', 'asset', 'debit'),
    ('212', 'Instalaciones tecnicas', '2', '21', 'asset', 'debit'),
    ('213', 'Maquinaria', '2', '21', 'asset', 'debit'),
    ('214', 'Utillaje', '2', '21', 'asset', 'debit'),
    ('215', 'Otras instalaciones', '2', '21', 'asset', 'debit'),
    ('216', 'Mobiliario', '2', '21', 'asset', 'debit'),
    ('217', 'Equipos para procesos de informacion', '2', '21', 'asset', 'debit'),
    ('218', 'Elementos de transporte', '2', '21', 'asset', 'debit'),
    ('219', 'Otro inmovilizado material', '2', '21', 'asset', 'debit'),
    ('280', 'Amortizacion acumulada del inmovilizado intangible', '2', '28', 'asset', 'credit'),
    ('281', 'Amortizacion acumulada del inmovilizado material', '2', '28', 'asset', 'credit'),
    ('300', 'Mercaderias', '3', '30', 'asset', 'debit'),
    ('328', 'Material de oficina', '3', '32', 'asset', 'debit'),
    ('4000', 'Proveedores, euros', '4', '40', 'liability', 'credit'),
    ('400', 'Proveedores', '4', '40', 'liability', 'credit'),
    ('401', 'Proveedores, efectos comerciales a pagar', '4', '40', 'liability', 'credit'),
    ('407', 'Anticipos a proveedores', '4', '40', 'asset', 'debit'),
    ('410', 'Acreedores por prestaciones de servicios', '4', '41', 'liability', 'credit'),
    ('4100', 'Acreedores por prestaciones de servicios, euros', '4', '41', 'liability', 'credit'),
    ('430', 'Clientes', '4', '43', 'asset', 'debit'),
    ('4300', 'Clientes, euros', '4', '43', 'asset', 'debit'),
    ('431', 'Clientes, efectos comerciales a cobrar', '4', '43', 'asset', 'debit'),
    ('436', 'Clientes de dudoso cobro', '4', '43', 'asset', 'debit'),
    ('438', 'Anticipos de clientes', '4', '43', 'liability', 'credit'),
    ('440', 'Deudores', '4', '44', 'asset', 'debit'),
    ('465', 'Remuneraciones pendientes de pago', '4', '46', 'liability', 'credit'),
    ('4700', 'Hacienda Publica, deudora por IVA', '4', '47', 'asset', 'debit'),
    ('4709', 'Hacienda Publica, deudora por devolucion de impuestos', '4', '47', 'asset', 'debit'),
    ('471', 'Organismos de la Seguridad Social, deudores', '4', '47', 'asset', 'debit'),
    ('472', 'Hacienda Publica, IVA soportado', '4', '47', 'asset', 'debit'),
    ('4750', 'Hacienda Publica, acreedora por IVA', '4', '47', 'liability', 'credit'),
    ('4751', 'Hacienda Publica, acreedora por retenciones practicadas', '4', '47', 'liability', 'credit'),
    ('4752', 'Hacienda Publica, acreedora por impuesto sobre sociedades', '4', '47', 'liability', 'credit'),
    ('476', 'Organismos de la Seguridad Social, acreedores', '4', '47', 'liability', 'credit'),
    ('477', 'Hacienda Publica, IVA repercutido', '4', '47', 'liability', 'credit'),
    ('480', 'Gastos anticipados', '4', '48', 'asset', 'debit'),
    ('485', 'Ingresos anticipados', '4', '48', 'liability', 'credit'),
    ('520', 'Deudas a corto plazo con entidades de credito', '5', '52', 'liability', 'credit'),
    ('523', 'Proveedores de inmovilizado a corto plazo', '5', '52', 'liability', 'credit'),
    ('555', 'Partidas pendientes de aplicacion', '5', '55', 'memo', 'debit'),
    ('570', 'Caja, euros', '5', '57', 'asset', 'debit'),
    ('572', 'Bancos e instituciones de credito c/c vista, euros', '5', '57', 'asset', 'debit'),
    ('600', 'Compras de mercaderias', '6', '60', 'expense', 'debit'),
    ('602', 'Compras de otros aprovisionamientos', '6', '60', 'expense', 'debit'),
    ('607', 'Trabajos realizados por otras empresas', '6', '60', 'expense', 'debit'),
    ('609', 'Rappels por compras', '6', '60', 'expense', 'debit'),
    ('621', 'Arrendamientos y canones', '6', '62', 'expense', 'debit'),
    ('622', 'Reparaciones y conservacion', '6', '62', 'expense', 'debit'),
    ('623', 'Servicios de profesionales independientes', '6', '62', 'expense', 'debit'),
    ('624', 'Transportes', '6', '62', 'expense', 'debit'),
    ('625', 'Primas de seguros', '6', '62', 'expense', 'debit'),
    ('626', 'Servicios bancarios y similares', '6', '62', 'expense', 'debit'),
    ('627', 'Publicidad, propaganda y relaciones publicas', '6', '62', 'expense', 'debit'),
    ('628', 'Suministros', '6', '62', 'expense', 'debit'),
    ('629', 'Otros servicios', '6', '62', 'expense', 'debit'),
    ('630', 'Impuesto sobre beneficios', '6', '63', 'expense', 'debit'),
    ('631', 'Otros tributos', '6', '63', 'expense', 'debit'),
    ('640', 'Sueldos y salarios', '6', '64', 'expense', 'debit'),
    ('642', 'Seguridad Social a cargo de la empresa', '6', '64', 'expense', 'debit'),
    ('649', 'Otros gastos sociales', '6', '64', 'expense', 'debit'),
    ('662', 'Intereses de deudas', '6', '66', 'expense', 'debit'),
    ('680', 'Amortizacion del inmovilizado intangible', '6', '68', 'expense', 'debit'),
    ('681', 'Amortizacion del inmovilizado material', '6', '68', 'expense', 'debit'),
    ('694', 'Perdidas por deterioro de creditos comerciales', '6', '69', 'expense', 'debit'),
    ('700', 'Ventas de mercaderias', '7', '70', 'income', 'credit'),
    ('705', 'Prestaciones de servicios', '7', '70', 'income', 'credit'),
    ('706', 'Descuentos sobre ventas por pronto pago', '7', '70', 'income', 'debit'),
    ('708', 'Devoluciones de ventas y operaciones similares', '7', '70', 'income', 'debit'),
    ('709', 'Rappels sobre ventas', '7', '70', 'income', 'debit'),
    ('740', 'Subvenciones, donaciones y legados a la explotacion', '7', '74', 'income', 'credit'),
    ('769', 'Otros ingresos financieros', '7', '76', 'income', 'credit')
) as seed(code, name, group_code, subgroup_code, account_type, normal_balance)
where not exists (
  select 1 from public.pgc_accounts existing
  where existing.empresa_id is null
    and existing.code = seed.code
);
