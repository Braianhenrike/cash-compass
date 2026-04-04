alter table public.settings
  add column if not exists show_goals_on_projection_charts boolean not null default true;

alter table public.brick_items
  add column if not exists purchase_affects_cash_flow boolean not null default true,
  add column if not exists reserve_invested_capital boolean not null default false,
  add column if not exists reserve_profit_for_reinvestment boolean not null default false;

alter table public.monthly_targets
  add column if not exists recurrence_mode text not null default 'single',
  add column if not exists recurrence_weekdays integer[] not null default '{}',
  add column if not exists recurrence_occurrences integer null;

alter table public.monthly_targets
  drop constraint if exists monthly_targets_recurrence_mode_check;

alter table public.monthly_targets
  add constraint monthly_targets_recurrence_mode_check
  check (recurrence_mode in ('single', 'weekly'));
