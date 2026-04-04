alter table public.monthly_targets
  add column if not exists status text not null default 'pending',
  add column if not exists completed_at date null;

alter table public.monthly_targets
  drop constraint if exists monthly_targets_status_check;

alter table public.monthly_targets
  add constraint monthly_targets_status_check
  check (status in ('pending', 'completed'));

create index if not exists monthly_targets_user_status_date_idx
  on public.monthly_targets (user_id, status, month_ref, expected_date);
