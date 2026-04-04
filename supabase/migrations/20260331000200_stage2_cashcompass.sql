alter table public.settings
  add column if not exists bill_due_alert_days integer not null default 3,
  add column if not exists default_bill_priority public.bill_priority not null default 'medium';

alter table public.income_entries
  add column if not exists category_id uuid null references public.categories(id) on delete set null;

create index if not exists idx_income_entries_user_category
  on public.income_entries(user_id, category_id);
