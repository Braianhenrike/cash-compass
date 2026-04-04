do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'monthly_target_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.monthly_target_type as enum (
      'side_hustle_goal',
      'extra_income_goal',
      'expense_cap',
      'reinvestment_cap',
      'reserve_goal'
    );
  end if;
end
$$;

alter table public.settings
  add column if not exists goals_affect_cashflow boolean not null default true,
  add column if not exists goals_reduce_month_bills boolean not null default true,
  add column if not exists default_goal_day integer not null default 25;

create table if not exists public.monthly_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_ref date not null,
  title text not null,
  type public.monthly_target_type not null,
  amount numeric(12, 2) not null,
  expected_date date null,
  applies_to_cashflow boolean not null default true,
  offsets_monthly_bills boolean not null default false,
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_monthly_targets_user_month
  on public.monthly_targets(user_id, month_ref);

create index if not exists idx_monthly_targets_user_type
  on public.monthly_targets(user_id, type);

drop trigger if exists set_monthly_targets_updated_at on public.monthly_targets;

create trigger set_monthly_targets_updated_at
before update on public.monthly_targets
for each row
execute function public.handle_updated_at();

alter table public.monthly_targets enable row level security;

drop policy if exists "monthly targets are private" on public.monthly_targets;

create policy "monthly targets are private"
on public.monthly_targets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type in ('settings', 'category', 'bill', 'income', 'brick', 'scenario', 'import', 'monthly_target'));
