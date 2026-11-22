-- DREAMORA 007: credits for completing the daily routine in the app (5 prayers + morning + evening adhkar).
-- Run AFTER 005 (and 006). Additive, re-runnable, one transaction.
--
-- IMPORTANT (honesty): progress is SELF-REPORTED. This rewards finishing your daily routine in the app, not worship itself.
-- The server cannot verify prayer. Limits that keep it fair and cheap:
--   * only for TODAY (Cairo time), never back-filled
--   * not before 18:00 Cairo (the earliest Isha in Egypt is about 18:10), so ticking everything in the morning does nothing
--   * once per day, 10 credits; +30 bonus on every 7th consecutive completed day
--   * the function can only be called by the server (service_role), with the user id taken from the signed-in session
-- "Complete" = prayer_marks contains fajr, dhuhr, asr, maghrib, isha
--              AND adhkar_counts morning1+morning2 > 0 AND evening1+evening2 > 0.

begin;

do $$
begin
  if to_regclass('public.spiritual_daily_progress') is null then raise exception '007 preflight failed: spiritual_daily_progress missing'; end if;
  if to_regclass('public.credit_ledger') is null or to_regclass('public.credit_accounts') is null then
    raise exception '007 preflight failed: credit tables missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'credit_ledger' and column_name = 'status') then
    raise exception '007 preflight failed: run 005_credits_v2.sql first (credit_ledger.status missing)';
  end if;
end $$;

create or replace function public.award_faith_day(p_user uuid, p_day date, p_now timestamptz default now())
returns table (out_awarded integer, out_reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cairo_now timestamp := p_now at time zone 'Africa/Cairo';
  today date := (p_now at time zone 'Africa/Cairo')::date;
  prog public.spiritual_daily_progress%rowtype;
  morning numeric;
  evening numeric;
  n integer;
  total integer := 0;
  streak integer := 0;
  d date;
begin
  if p_user is null or p_day is null then
    return query select 0, 'invalid_request'::text; return;
  end if;
  if p_day <> today then
    return query select 0, 'not_today'::text; return;
  end if;
  if extract(hour from cairo_now) < 18 then
    return query select 0, 'too_early'::text; return;
  end if;

  select * into prog from public.spiritual_daily_progress s where s.user_id = p_user and s.entry_date = p_day;
  if not found then
    return query select 0, 'no_progress'::text; return;
  end if;

  if not (prog.prayer_marks @> '["fajr","dhuhr","asr","maghrib","isha"]'::jsonb) then
    return query select 0, 'prayers_incomplete'::text; return;
  end if;

  morning := (case when jsonb_typeof(prog.adhkar_counts -> 'morning1') = 'number' then (prog.adhkar_counts ->> 'morning1')::numeric else 0 end)
           + (case when jsonb_typeof(prog.adhkar_counts -> 'morning2') = 'number' then (prog.adhkar_counts ->> 'morning2')::numeric else 0 end);
  evening := (case when jsonb_typeof(prog.adhkar_counts -> 'evening1') = 'number' then (prog.adhkar_counts ->> 'evening1')::numeric else 0 end)
           + (case when jsonb_typeof(prog.adhkar_counts -> 'evening2') = 'number' then (prog.adhkar_counts ->> 'evening2')::numeric else 0 end);
  if morning <= 0 or evening <= 0 then
    return query select 0, 'adhkar_incomplete'::text; return;
  end if;

  insert into public.credit_ledger (user_id, amount, reason, credit_date, idempotency_key, status, feature)
  values (p_user, 10, 'faith_day_complete', today, 'faith_day:' || today::text, 'committed', 'faith_routine')
  on conflict (user_id, credit_date, reason) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return query select 0, 'already_awarded'::text; return;
  end if;
  total := 10;
  insert into public.credit_accounts as a (user_id, balance) values (p_user, 10)
  on conflict (user_id) do update set balance = a.balance + 10, updated_at = now();

  -- consecutive completed days ending today
  d := today;
  while exists (select 1 from public.credit_ledger l where l.user_id = p_user and l.reason = 'faith_day_complete' and l.credit_date = d) loop
    streak := streak + 1;
    d := d - 1;
  end loop;

  if streak > 0 and streak % 7 = 0 then
    insert into public.credit_ledger (user_id, amount, reason, credit_date, idempotency_key, status, feature)
    values (p_user, 30, 'faith_streak_7', today, 'faith_streak:' || today::text, 'committed', 'faith_routine')
    on conflict (user_id, credit_date, reason) do nothing;
    get diagnostics n = row_count;
    if n > 0 then
      total := total + 30;
      update public.credit_accounts a set balance = a.balance + 30, updated_at = now() where a.user_id = p_user;
    end if;
  end if;

  return query select total, 'ok'::text;
end;
$$;

revoke all on function public.award_faith_day(uuid, date, timestamptz) from public, anon, authenticated;
grant execute on function public.award_faith_day(uuid, date, timestamptz) to service_role;

commit;
