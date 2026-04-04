create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('settings', 'category', 'bill', 'income', 'brick', 'scenario', 'import')),
  entity_id uuid null,
  action text not null check (action in ('create', 'update', 'delete', 'import', 'seed')),
  summary text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_user_created_at
  on public.audit_events(user_id, created_at desc);

create index if not exists idx_audit_events_entity
  on public.audit_events(user_id, entity_type, entity_id);

alter table public.audit_events enable row level security;

create policy "audit events are private"
on public.audit_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace view public.monthly_finance_overview
with (security_invoker = true)
as
with income_base as (
  select
    user_id,
    date_trunc('month', expected_date)::date as month_ref,
    sum(amount) filter (where status in ('expected', 'confirmed')) as expected_income,
    sum(amount) filter (where status = 'received') as confirmed_income
  from public.income_entries
  group by user_id, date_trunc('month', expected_date)
),
bill_base as (
  select
    user_id,
    date_trunc('month', due_date)::date as month_ref,
    sum(amount) filter (where status in ('pending', 'overdue')) as expected_expenses,
    sum(amount) filter (where status = 'paid') as confirmed_expenses
  from public.accounts_payable
  group by user_id, date_trunc('month', due_date)
),
brick_base as (
  select
    user_id,
    date_trunc('month', coalesce(expected_sale_date, purchase_date))::date as month_ref,
    sum(probable_sale_price) filter (where status in ('planned', 'purchased', 'listed', 'reserved')) as projected_brick_returns,
    sum(actual_sale_price) filter (where status = 'sold') as confirmed_brick_returns,
    sum(purchase_price) filter (where status = 'planned') as planned_brick_investment
  from public.brick_items
  group by user_id, date_trunc('month', coalesce(expected_sale_date, purchase_date))
),
month_index as (
  select user_id, month_ref from income_base
  union
  select user_id, month_ref from bill_base
  union
  select user_id, month_ref from brick_base
)
select
  month_index.user_id,
  month_index.month_ref,
  coalesce(income_base.expected_income, 0)::numeric(12, 2) as expected_income,
  coalesce(income_base.confirmed_income, 0)::numeric(12, 2) as confirmed_income,
  coalesce(bill_base.expected_expenses, 0)::numeric(12, 2) as expected_expenses,
  coalesce(bill_base.confirmed_expenses, 0)::numeric(12, 2) as confirmed_expenses,
  coalesce(brick_base.projected_brick_returns, 0)::numeric(12, 2) as projected_brick_returns,
  coalesce(brick_base.confirmed_brick_returns, 0)::numeric(12, 2) as confirmed_brick_returns,
  coalesce(brick_base.planned_brick_investment, 0)::numeric(12, 2) as planned_brick_investment
from month_index
left join income_base
  on income_base.user_id = month_index.user_id
 and income_base.month_ref = month_index.month_ref
left join bill_base
  on bill_base.user_id = month_index.user_id
 and bill_base.month_ref = month_index.month_ref
left join brick_base
  on brick_base.user_id = month_index.user_id
 and brick_base.month_ref = month_index.month_ref;
