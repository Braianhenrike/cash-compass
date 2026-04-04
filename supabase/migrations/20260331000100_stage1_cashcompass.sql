create extension if not exists "pgcrypto";

create type public.category_type as enum ('bill', 'income', 'brick');
create type public.bill_status as enum ('pending', 'paid', 'overdue', 'cancelled');
create type public.bill_priority as enum ('low', 'medium', 'high', 'critical');
create type public.recurrence_type as enum ('none', 'weekly', 'monthly', 'yearly');
create type public.income_type as enum ('side_hustle', 'salary', 'brick_sale', 'investment_return', 'transfer', 'extra');
create type public.income_status as enum ('expected', 'confirmed', 'received', 'cancelled');
create type public.brick_status as enum ('planned', 'purchased', 'listed', 'reserved', 'sold', 'cancelled', 'loss');
create type public.brick_liquidity as enum ('high', 'medium', 'low');
create type public.brick_risk as enum ('low', 'medium', 'high');
create type public.brick_rating as enum ('bad', 'good', 'excellent');
create type public.brick_cost_type as enum ('shipping', 'maintenance', 'transport', 'commission', 'fees', 'accessories', 'other');
create type public.alert_type as enum (
  'bill_due',
  'bill_overdue',
  'cash_negative',
  'cash_below_reserve',
  'brick_stale',
  'sale_below_min',
  'excess_locked',
  'bills_before_income'
);
create type public.alert_severity as enum ('info', 'warning', 'critical');
create type public.scenario_type as enum ('conservative', 'probable', 'optimistic');

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_cash_balance numeric(12, 2) not null default 0,
  minimum_cash_reserve numeric(12, 2) not null default 500,
  currency text not null default 'BRL',
  default_scenario public.scenario_type not null default 'probable',
  alerts_enabled boolean not null default true,
  stale_brick_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.category_type not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, type, name)
);

create table public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category_id uuid null references public.categories(id) on delete set null,
  amount numeric(12, 2) not null,
  due_date date not null,
  paid_date date null,
  is_recurring boolean not null default false,
  recurrence_type public.recurrence_type not null default 'none',
  priority public.bill_priority not null default 'medium',
  status public.bill_status not null default 'pending',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.income_type not null,
  description text not null,
  amount numeric(12, 2) not null,
  expected_date date not null,
  received_date date null,
  status public.income_status not null default 'expected',
  source text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brick_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid null references public.categories(id) on delete set null,
  purchase_price numeric(12, 2) not null,
  target_sale_price numeric(12, 2) not null default 0,
  minimum_sale_price numeric(12, 2) not null default 0,
  probable_sale_price numeric(12, 2) not null default 0,
  purchase_date date not null,
  expected_sale_date date null,
  actual_sale_date date null,
  actual_sale_price numeric(12, 2) null,
  liquidity public.brick_liquidity not null default 'medium',
  risk_level public.brick_risk not null default 'medium',
  status public.brick_status not null default 'planned',
  purchase_channel text not null default '',
  sales_channel text not null default '',
  notes text not null default '',
  rating public.brick_rating null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brick_costs (
  id uuid primary key default gen_random_uuid(),
  brick_item_id uuid not null references public.brick_items(id) on delete cascade,
  type public.brick_cost_type not null,
  amount numeric(12, 2) not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.scenario_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name public.scenario_type not null,
  sale_price_multiplier numeric(6, 2) not null default 1,
  sale_delay_days integer not null default 0,
  expected_income_multiplier numeric(6, 2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.alert_type not null,
  severity public.alert_severity not null,
  title text not null,
  description text not null,
  reference_type text null,
  reference_id uuid null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_accounts_payable_user_due_date on public.accounts_payable(user_id, due_date);
create index idx_accounts_payable_user_status on public.accounts_payable(user_id, status);
create index idx_income_entries_user_expected_date on public.income_entries(user_id, expected_date);
create index idx_income_entries_user_status on public.income_entries(user_id, status);
create index idx_brick_items_user_purchase_date on public.brick_items(user_id, purchase_date);
create index idx_brick_items_user_status on public.brick_items(user_id, status);
create index idx_brick_items_user_expected_sale_date on public.brick_items(user_id, expected_sale_date);
create index idx_brick_costs_brick_item_id on public.brick_costs(brick_item_id);
create index idx_alerts_user_created_at on public.alerts(user_id, created_at desc);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_default_categories(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, type, name)
  values
    (target_user_id, 'bill', 'Moradia'),
    (target_user_id, 'bill', 'Alimentação'),
    (target_user_id, 'bill', 'Transporte'),
    (target_user_id, 'bill', 'Saúde'),
    (target_user_id, 'bill', 'Lazer'),
    (target_user_id, 'income', 'Freelance'),
    (target_user_id, 'income', 'Emprego'),
    (target_user_id, 'income', 'Retorno'),
    (target_user_id, 'brick', 'Eletrônicos'),
    (target_user_id, 'brick', 'Roupas'),
    (target_user_id, 'brick', 'Colecionáveis')
  on conflict (user_id, type, name) do nothing;
end;
$$;

create or replace function public.ensure_default_scenarios(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scenario_configs (user_id, name, sale_price_multiplier, sale_delay_days, expected_income_multiplier)
  values
    (target_user_id, 'conservative', 0.92, 10, 0.80),
    (target_user_id, 'probable', 1.00, 0, 1.00),
    (target_user_id, 'optimistic', 1.07, -5, 1.10)
  on conflict (user_id, name) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.ensure_default_categories(new.id);
  perform public.ensure_default_scenarios(new.id);

  return new;
end;
$$;

create trigger set_settings_updated_at
before update on public.settings
for each row
execute function public.handle_updated_at();

create trigger set_accounts_payable_updated_at
before update on public.accounts_payable
for each row
execute function public.handle_updated_at();

create trigger set_income_entries_updated_at
before update on public.income_entries
for each row
execute function public.handle_updated_at();

create trigger set_brick_items_updated_at
before update on public.brick_items
for each row
execute function public.handle_updated_at();

create trigger set_scenario_configs_updated_at
before update on public.scenario_configs
for each row
execute function public.handle_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.accounts_payable enable row level security;
alter table public.income_entries enable row level security;
alter table public.brick_items enable row level security;
alter table public.brick_costs enable row level security;
alter table public.scenario_configs enable row level security;
alter table public.alerts enable row level security;

create policy "settings are private"
on public.settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "categories are private"
on public.categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "accounts payable are private"
on public.accounts_payable
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "income entries are private"
on public.income_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "brick items are private"
on public.brick_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "brick costs follow brick ownership"
on public.brick_costs
for all
using (
  exists (
    select 1
    from public.brick_items brick
    where brick.id = brick_costs.brick_item_id
      and brick.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.brick_items brick
    where brick.id = brick_costs.brick_item_id
      and brick.user_id = auth.uid()
  )
);

create policy "scenarios are private"
on public.scenario_configs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "alerts are private"
on public.alerts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.seed_demo_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  housing_id uuid;
  food_id uuid;
  health_id uuid;
  electronics_id uuid;
  clothes_id uuid;
  collectible_id uuid;
  iphone_id uuid;
  nike_id uuid;
  controller_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_default_categories(current_user_id);
  perform public.ensure_default_scenarios(current_user_id);

  select id into housing_id from public.categories where user_id = current_user_id and type = 'bill' and name = 'Moradia' limit 1;
  select id into food_id from public.categories where user_id = current_user_id and type = 'bill' and name = 'Alimentação' limit 1;
  select id into health_id from public.categories where user_id = current_user_id and type = 'bill' and name = 'Saúde' limit 1;
  select id into electronics_id from public.categories where user_id = current_user_id and type = 'brick' and name = 'Eletrônicos' limit 1;
  select id into clothes_id from public.categories where user_id = current_user_id and type = 'brick' and name = 'Roupas' limit 1;
  select id into collectible_id from public.categories where user_id = current_user_id and type = 'brick' and name = 'Colecionáveis' limit 1;

  delete from public.brick_costs
  where brick_item_id in (select id from public.brick_items where user_id = current_user_id);
  delete from public.accounts_payable where user_id = current_user_id;
  delete from public.income_entries where user_id = current_user_id;
  delete from public.brick_items where user_id = current_user_id;
  delete from public.alerts where user_id = current_user_id;

  update public.settings
  set current_cash_balance = 3200
  where user_id = current_user_id;

  insert into public.accounts_payable (user_id, description, category_id, amount, due_date, is_recurring, recurrence_type, priority, status, notes)
  values
    (current_user_id, 'Aluguel', housing_id, 1500, current_date + 5, true, 'monthly', 'critical', 'pending', 'Pago sempre no quinto dia útil.'),
    (current_user_id, 'Energia', housing_id, 280, current_date + 9, true, 'monthly', 'high', 'pending', 'Conta do apartamento.'),
    (current_user_id, 'Mercado', food_id, 600, current_date + 3, false, 'none', 'high', 'pending', 'Reposição de mantimentos.'),
    (current_user_id, 'Farmácia', health_id, 150, current_date - 2, false, 'none', 'medium', 'pending', 'Compra que ficou para acertar.');

  insert into public.income_entries (user_id, type, description, amount, expected_date, received_date, status, source, notes)
  values
    (current_user_id, 'side_hustle', 'Freelance de design', 850, current_date + 2, null, 'confirmed', 'Cliente recorrente', 'Projeto já entregue.'),
    (current_user_id, 'side_hustle', 'Consultoria rápida', 500, current_date + 7, null, 'expected', 'Indicação', 'Pagamento prometido para a próxima semana.'),
    (current_user_id, 'salary', 'Salário principal', 4500, current_date + 20, null, 'expected', 'Emprego CLT', 'Crédito no último dia útil.'),
    (current_user_id, 'extra', 'Venda avulsa recebida', 200, current_date - 1, current_date - 1, 'received', 'PIX', 'Já entrou no caixa.');

  insert into public.brick_items (
    user_id, name, category_id, purchase_price, target_sale_price, minimum_sale_price, probable_sale_price,
    purchase_date, expected_sale_date, actual_sale_date, actual_sale_price, liquidity, risk_level, status,
    purchase_channel, sales_channel, notes, rating
  )
  values
    (current_user_id, 'iPhone 13 Pro', electronics_id, 2200, 3200, 2800, 3000, current_date - 15, current_date + 10, null, null, 'high', 'low', 'listed', 'Marketplace local', 'Mercado Livre', 'Aparelho em excelente estado.', null)
  returning id into iphone_id;

  insert into public.brick_items (
    user_id, name, category_id, purchase_price, target_sale_price, minimum_sale_price, probable_sale_price,
    purchase_date, expected_sale_date, actual_sale_date, actual_sale_price, liquidity, risk_level, status,
    purchase_channel, sales_channel, notes, rating
  )
  values
    (current_user_id, 'Nike Dunk Low', clothes_id, 450, 750, 600, 680, current_date - 30, current_date + 5, null, null, 'medium', 'medium', 'listed', 'Outlet', 'Instagram', 'Tamanho 42, caixa original.', null)
  returning id into nike_id;

  insert into public.brick_items (
    user_id, name, category_id, purchase_price, target_sale_price, minimum_sale_price, probable_sale_price,
    purchase_date, expected_sale_date, actual_sale_date, actual_sale_price, liquidity, risk_level, status,
    purchase_channel, sales_channel, notes, rating
  )
  values
    (current_user_id, 'Controle PS5', electronics_id, 180, 320, 250, 290, current_date - 45, current_date - 5, current_date - 5, 300, 'high', 'low', 'sold', 'OLX', 'OLX', 'Saiu rápido.', 'excellent')
  returning id into controller_id;

  insert into public.brick_items (
    user_id, name, category_id, purchase_price, target_sale_price, minimum_sale_price, probable_sale_price,
    purchase_date, expected_sale_date, actual_sale_date, actual_sale_price, liquidity, risk_level, status,
    purchase_channel, sales_channel, notes, rating
  )
  values
    (current_user_id, 'Lote de camisas vintage', clothes_id, 700, 1200, 950, 1100, current_date + 6, current_date + 18, null, null, 'medium', 'medium', 'planned', 'Fornecedor local', 'Instagram', 'Compra planejada para a próxima semana.', null);

  insert into public.brick_items (
    user_id, name, category_id, purchase_price, target_sale_price, minimum_sale_price, probable_sale_price,
    purchase_date, expected_sale_date, actual_sale_date, actual_sale_price, liquidity, risk_level, status,
    purchase_channel, sales_channel, notes, rating
  )
  values
    (current_user_id, 'Funko raro', collectible_id, 320, 520, 420, 470, current_date - 12, current_date + 14, null, null, 'low', 'medium', 'reserved', 'Colecionador', 'Grupo fechado', 'Cliente pediu 48h para fechar.', 'good');

  insert into public.brick_costs (brick_item_id, type, amount, notes)
  values
    (iphone_id, 'shipping', 50, 'Frete da compra.'),
    (iphone_id, 'accessories', 80, 'Capinha e película.'),
    (nike_id, 'shipping', 30, 'Frete para receber o par.'),
    (controller_id, 'fees', 15, 'Taxa de intermediação.');
end;
$$;
