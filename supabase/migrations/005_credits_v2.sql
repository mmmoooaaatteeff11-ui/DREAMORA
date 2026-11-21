-- DREAMORA 005: credits v2 (spend / refund) + free quotas.
-- Additive. Extends the existing credit_ledger / credit_accounts from 004 and does NOT touch claim_daily_app_credit.
-- Run the whole file in ONE go (it is a single transaction). Apply on a TEST Supabase project first.
--
-- Lifecycle of one AI call:
--   reserve_credits(...)   BEFORE calling Gemini  -> consumes a free quota unit, or atomically deducts credits
--   commit_credits(id)     after a successful reply
--   refund_credits(id)     if the call failed      -> gives the quota unit / credits back (only once)
--   sweep_stale_reservations() run every few minutes -> refunds reservations stuck in 'pending'
-- Crisis replies must NEVER go through reserve_credits (they are free, always).

begin;

-- 0) Preflight: fail early, with a readable message, if 004 does not look the way this file expects.
do $$
declare
  missing text := '';
  extra text;
begin
  if to_regclass('public.credit_accounts') is null then missing := missing || ' table credit_accounts;'; end if;
  if to_regclass('public.credit_ledger') is null then missing := missing || ' table credit_ledger;'; end if;
  if to_regclass('public.profiles') is null then missing := missing || ' table profiles;'; end if;
  if missing = '' then
    foreach extra in array array[
      'credit_accounts.user_id', 'credit_accounts.balance',
      'credit_ledger.id', 'credit_ledger.user_id', 'credit_ledger.amount', 'credit_ledger.reason',
      'credit_ledger.idempotency_key', 'credit_ledger.created_at', 'profiles.id', 'profiles.plan'
    ] loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = split_part(extra, '.', 1) and column_name = split_part(extra, '.', 2)
      ) then
        missing := missing || ' column ' || extra || ';';
      end if;
    end loop;
  end if;
  if missing <> '' then
    raise exception '005 preflight failed, missing:%', missing;
  end if;

  -- Any other NOT NULL column without a default on credit_ledger would break our inserts.
  select string_agg(column_name, ', ') into extra
  from information_schema.columns
  where table_schema = 'public' and table_name = 'credit_ledger'
    and is_nullable = 'NO' and column_default is null and is_identity = 'NO'
    and column_name not in ('user_id', 'amount', 'reason', 'idempotency_key', 'credit_date');
  if extra is not null then
    raise exception '005 preflight failed: credit_ledger has extra required columns (%). Send me 004 so I can adapt.', extra;
  end if;
end $$;

-- 1) credit_ledger: allow spends and refunds, keep the daily-visit uniqueness exactly as 004 defined it.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.credit_ledger'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%reason%' or pg_get_constraintdef(oid) ilike '%amount%')
  loop
    execute format('alter table public.credit_ledger drop constraint %I', r.conname);
  end loop;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'credit_ledger' and column_name = 'credit_date' and is_nullable = 'NO'
  ) then
    alter table public.credit_ledger alter column credit_date drop not null;
  end if;
end $$;

alter table public.credit_ledger add constraint credit_ledger_amount_nonzero check (amount <> 0);

alter table public.credit_ledger add column if not exists feature text;
alter table public.credit_ledger add column if not exists model text;
alter table public.credit_ledger add column if not exists status text not null default 'committed';
alter table public.credit_ledger add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.credit_ledger drop constraint if exists credit_ledger_status_check;
alter table public.credit_ledger add constraint credit_ledger_status_check
  check (status in ('pending', 'committed', 'refunded'));


-- 2) Pricing + free quota per feature (and per model, '*' = any model). Readable by users, writable only by admins via SQL.
create table if not exists public.feature_pricing (
  feature text not null,
  model text not null default '*',
  credits_cost integer not null default 0 check (credits_cost >= 0),
  free_quota integer not null default 0 check (free_quota >= 0),
  free_period text not null default 'month' check (free_period in ('day', 'month', 'lifetime')),
  min_plan text not null default 'free' check (min_plan in ('free', 'premium', 'pro')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (feature, model)
);
alter table public.feature_pricing enable row level security;
drop policy if exists feature_pricing_read on public.feature_pricing;
create policy feature_pricing_read on public.feature_pricing for select to authenticated using (true);
grant select on public.feature_pricing to authenticated;

-- 3) How many free uses a user already consumed in each period.
create table if not exists public.feature_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  period_key text not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, feature, period_key)
);
alter table public.feature_usage enable row level security;
drop policy if exists feature_usage_own on public.feature_usage;
create policy feature_usage_own on public.feature_usage for select to authenticated using (auth.uid() = user_id);
grant select on public.feature_usage to authenticated;

-- 4) One row per AI call attempt. Server-only (RLS on, no policies, no grants).
create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  model text not null default '*',
  idempotency_key text not null,
  source text not null check (source in ('free_quota', 'credits', 'free_feature')),
  cost integer not null default 0,
  period_key text,
  status text not null default 'pending' check (status in ('pending', 'committed', 'refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key)
);
alter table public.credit_reservations enable row level security;
create index if not exists credit_reservations_pending_idx on public.credit_reservations (created_at) where status = 'pending';

-- ref_id / ledger_id must have the SAME type as credit_ledger.id (uuid or bigint), so read it instead of assuming.
do $$
declare id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.credit_ledger'::regclass and a.attname = 'id' and not a.attisdropped;
  if id_type is null then
    raise exception '005 preflight failed: credit_ledger.id not found';
  end if;
  execute format('alter table public.credit_ledger add column if not exists ref_id %s references public.credit_ledger (id)', id_type);
  execute format('alter table public.credit_reservations add column if not exists ledger_id %s references public.credit_ledger (id)', id_type);
end $$;

-- a spend can be refunded once, ever
create unique index if not exists credit_ledger_one_refund_per_spend
  on public.credit_ledger (ref_id) where reason = 'refund';

-- 5) Helpers
create or replace function public._quota_period_key(p_period text)
returns text language sql stable set search_path = public, pg_temp as $$
  -- Periods roll over at midnight Cairo time (not UTC).
  select case p_period
    when 'day' then to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD')
    when 'month' then to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM')
    else 'lifetime'
  end
$$;

-- 6) reserve_credits: decide + charge atomically. Never raises for "normal" refusals; check `allowed`.
create or replace function public.reserve_credits(
  p_user uuid, p_feature text, p_key text, p_model text default '*'
)
returns table (reservation_id uuid, allowed boolean, reason text, source text, cost integer, duplicate boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pr public.feature_pricing%rowtype;
  existing public.credit_reservations%rowtype;
  user_plan text;
  period text;
  new_used integer;
  new_balance integer;
  led_id public.credit_ledger.id%type;
  res_id uuid;
begin
  if p_user is null or p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    return query select null::uuid, false, 'invalid_request', null::text, 0, false;
    return;
  end if;

  -- Serialise concurrent calls with the same (user, key).
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key, 0));

  select * into existing from public.credit_reservations r where r.user_id = p_user and r.idempotency_key = p_key;
  if found then
    return query select existing.id, (existing.status <> 'refunded'), 'duplicate', existing.source, existing.cost, true;
    return;
  end if;

  select * into pr from public.feature_pricing f where f.feature = p_feature and f.model = p_model;
  if not found then
    select * into pr from public.feature_pricing f where f.feature = p_feature and f.model = '*';
  end if;
  if not found or not pr.enabled then
    return query select null::uuid, false, 'unknown_feature', null::text, 0, false;
    return;
  end if;

  select coalesce(p.plan, 'free') into user_plan from public.profiles p where p.id = p_user;
  user_plan := coalesce(user_plan, 'free');
  if coalesce(array_position(array['free', 'premium', 'pro'], user_plan), 1)
     < array_position(array['free', 'premium', 'pro'], pr.min_plan) then
    return query select null::uuid, false, 'plan_required', null::text, pr.credits_cost, false;
    return;
  end if;

  -- (a) free quota: one atomic upsert, only counts while below the limit
  if pr.free_quota > 0 then
    period := public._quota_period_key(pr.free_period);
    insert into public.feature_usage as u (user_id, feature, period_key, used)
    values (p_user, pr.feature, period, 1)
    on conflict (user_id, feature, period_key)
    do update set used = u.used + 1 where u.used < pr.free_quota
    returning u.used into new_used;

    if new_used is not null then
      insert into public.credit_reservations (user_id, feature, model, idempotency_key, source, cost, period_key)
      values (p_user, pr.feature, p_model, p_key, 'free_quota', 0, period)
      returning id into res_id;
      return query select res_id, true, 'ok', 'free_quota'::text, 0, false;
      return;
    end if;
  end if;

  -- (b) feature that is simply free
  if pr.credits_cost = 0 then
    insert into public.credit_reservations (user_id, feature, model, idempotency_key, source, cost)
    values (p_user, pr.feature, p_model, p_key, 'free_feature', 0)
    returning id into res_id;
    return query select res_id, true, 'ok', 'free_feature'::text, 0, false;
    return;
  end if;

  -- (c) paid: single UPDATE with the balance check, so two parallel requests can never overspend
  update public.credit_accounts a
     set balance = a.balance - pr.credits_cost, updated_at = now()
   where a.user_id = p_user and a.balance >= pr.credits_cost
   returning a.balance into new_balance;

  if new_balance is null then
    return query select null::uuid, false,
      case when pr.free_quota > 0 then 'quota_exhausted_no_credits' else 'insufficient_credits' end,
      null::text, pr.credits_cost, false;
    return;
  end if;

  insert into public.credit_ledger (user_id, amount, reason, idempotency_key, status, feature, model)
  values (p_user, -pr.credits_cost, 'ai_usage', p_key, 'pending', pr.feature, p_model)
  returning id into led_id;

  insert into public.credit_reservations (user_id, feature, model, idempotency_key, source, cost, ledger_id)
  values (p_user, pr.feature, p_model, p_key, 'credits', pr.credits_cost, led_id)
  returning id into res_id;

  return query select res_id, true, 'ok', 'credits'::text, pr.credits_cost, false;
end;
$$;

-- 7) commit_credits: the reply succeeded. Returns false if it was not pending (so double-commit is harmless).
create or replace function public.commit_credits(p_reservation uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r public.credit_reservations%rowtype;
begin
  update public.credit_reservations
     set status = 'committed', settled_at = now()
   where id = p_reservation and status = 'pending'
   returning * into r;
  if not found then return false; end if;
  if r.ledger_id is not null then
    update public.credit_ledger set status = 'committed' where id = r.ledger_id;
  end if;
  return true;
end;
$$;

-- 8) refund_credits: the call failed. Gives back the free unit or the credits. Only possible once.
create or replace function public.refund_credits(p_reservation uuid, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r public.credit_reservations%rowtype;
begin
  update public.credit_reservations
     set status = 'refunded', settled_at = now()
   where id = p_reservation and status = 'pending'
   returning * into r;
  if not found then return false; end if;

  if r.source = 'free_quota' then
    update public.feature_usage
       set used = greatest(used - 1, 0)
     where user_id = r.user_id and feature = r.feature and period_key = r.period_key;
  elsif r.source = 'credits' then
    update public.credit_accounts
       set balance = balance + r.cost, updated_at = now()
     where user_id = r.user_id;
    update public.credit_ledger set status = 'refunded' where id = r.ledger_id;
    insert into public.credit_ledger (user_id, amount, reason, idempotency_key, status, feature, model, ref_id, metadata)
    values (r.user_id, r.cost, 'refund', 'refund:' || r.id::text, 'committed', r.feature, r.model, r.ledger_id,
            jsonb_build_object('note', left(coalesce(p_note, ''), 200)));
  end if;
  return true;
end;
$$;

-- 9) sweep_stale_reservations: refunds calls that never finished (server crash, timeout). Schedule it (cron / pg_cron).
create or replace function public.sweep_stale_reservations(p_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record; n integer := 0;
begin
  for r in
    select id from public.credit_reservations
    where status = 'pending' and created_at < now() - make_interval(mins => greatest(p_minutes, 1))
    order by created_at
    limit 500
    for update skip locked
  loop
    if public.refund_credits(r.id, 'stale_reservation') then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- 10) Only the server (service_role) may call these. Users and anon cannot, so they can never mint or skip charges.
revoke all on function public.reserve_credits(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.commit_credits(uuid) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, text) from public, anon, authenticated;
revoke all on function public.sweep_stale_reservations(integer) from public, anon, authenticated;
revoke all on function public._quota_period_key(text) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, text, text, text) to service_role;
grant execute on function public.commit_credits(uuid) to service_role;
grant execute on function public.refund_credits(uuid, text) to service_role;
grant execute on function public.sweep_stale_reservations(integer) to service_role;

commit;
