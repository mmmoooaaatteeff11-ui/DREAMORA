create table public.spiritual_daily_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  prayer_marks jsonb not null default '[]'::jsonb
    check (
      case
        when jsonb_typeof(prayer_marks) = 'array' then jsonb_array_length(prayer_marks) <= 5
        else false
      end
    ),
  adhkar_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(adhkar_counts) = 'object'),
  tasbeeh_count smallint not null default 0 check (tasbeeh_count between 0 and 100),
  quran_pages smallint not null default 0 check (quran_pages between 0 and 604),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);

create index spiritual_daily_progress_date_idx
  on public.spiritual_daily_progress (entry_date desc);

create trigger set_updated_at before update on public.spiritual_daily_progress
  for each row execute function public.set_updated_at();

alter table public.spiritual_daily_progress enable row level security;

create policy "read own spiritual progress" on public.spiritual_daily_progress
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.spiritual_daily_progress from anon, authenticated;
grant select on table public.spiritual_daily_progress to authenticated;
grant all on table public.spiritual_daily_progress to service_role;

create table public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason = 'daily_app_visit'),
  credit_date date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, credit_date, reason),
  unique (user_id, idempotency_key)
);

create index credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;

create policy "read own credit account" on public.credit_accounts
  for select to authenticated using (user_id = auth.uid());
create policy "read own credit ledger" on public.credit_ledger
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.credit_accounts, public.credit_ledger from anon, authenticated, service_role;
grant select on table public.credit_accounts, public.credit_ledger to authenticated;

create or replace function public.claim_daily_app_credit(claimant_id uuid)
returns table (awarded boolean, balance integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reward_date date := (now() at time zone 'UTC')::date;
  ledger_entry uuid;
  current_balance integer;
begin
  if auth.role() is distinct from 'service_role' or claimant_id is null then
    raise exception 'server authorization required' using errcode = '42501';
  end if;

  insert into public.credit_accounts (user_id)
  values (claimant_id)
  on conflict (user_id) do nothing;

  select account.balance into current_balance
  from public.credit_accounts as account
  where account.user_id = claimant_id
  for update;

  insert into public.credit_ledger (user_id, amount, reason, credit_date, idempotency_key)
  values (
    claimant_id,
    1,
    'daily_app_visit',
    reward_date,
    'daily-app-visit:' || reward_date::text
  )
  on conflict (user_id, credit_date, reason) do nothing
  returning id into ledger_entry;

  if ledger_entry is not null then
    update public.credit_accounts as account
    set balance = account.balance + 1,
        updated_at = now()
    where account.user_id = claimant_id;
  end if;

  select account.balance into current_balance
  from public.credit_accounts as account
  where account.user_id = claimant_id;

  return query select (ledger_entry is not null), current_balance;
end;
$$;

revoke all on function public.claim_daily_app_credit(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_app_credit(uuid) to service_role;
