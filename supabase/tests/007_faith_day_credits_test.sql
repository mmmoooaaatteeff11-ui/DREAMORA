-- Self-cleaning test for 007. The CORRECT result is the intentional error "ALL TESTS PASSED". Any "FAIL ..." message: send it to me.
do $$
declare
  u uuid := gen_random_uuid();
  today date := (now() at time zone 'Africa/Cairo')::date;
  evening_t timestamptz := (today::timestamp + interval '22 hours') at time zone 'Africa/Cairo';
  morning_t timestamptz := (today::timestamp + interval '10 hours') at time zone 'Africa/Cairo';
  r record; bal int; n int; i int;
  full_marks jsonb := '["fajr","dhuhr","asr","maghrib","isha"]';
begin
  insert into auth.users (id) values (u);

  select * into r from public.award_faith_day(u, today, evening_t);
  if r.out_reason <> 'no_progress' or r.out_awarded <> 0 then raise exception 'FAIL T1 %', r; end if;

  insert into public.spiritual_daily_progress (user_id, entry_date, prayer_marks) values (u, today, '["fajr","dhuhr","asr","maghrib"]');
  select * into r from public.award_faith_day(u, today, evening_t);
  if r.out_reason <> 'prayers_incomplete' then raise exception 'FAIL T2 %', r; end if;

  update public.spiritual_daily_progress set prayer_marks = full_marks, adhkar_counts = '{"morning1":3}' where user_id = u and entry_date = today;
  select * into r from public.award_faith_day(u, today, evening_t);
  if r.out_reason <> 'adhkar_incomplete' then raise exception 'FAIL T3 %', r; end if;

  -- non-numeric values must not crash or count
  update public.spiritual_daily_progress set adhkar_counts = '{"morning1":3,"evening1":"abc","evening2":null}' where user_id = u and entry_date = today;
  select * into r from public.award_faith_day(u, today, evening_t);
  if r.out_reason <> 'adhkar_incomplete' then raise exception 'FAIL T3b %', r; end if;

  update public.spiritual_daily_progress set adhkar_counts = '{"morning1":3,"evening2":1}' where user_id = u and entry_date = today;

  -- too early in the day
  select * into r from public.award_faith_day(u, today, morning_t);
  if r.out_reason <> 'too_early' or r.out_awarded <> 0 then raise exception 'FAIL T4 %', r; end if;
  -- not today
  select * into r from public.award_faith_day(u, today - 1, evening_t);
  if r.out_reason <> 'not_today' then raise exception 'FAIL T5 %', r; end if;

  -- success
  select * into r from public.award_faith_day(u, today, evening_t);
  select balance into bal from public.credit_accounts where user_id = u;
  if r.out_reason <> 'ok' or r.out_awarded <> 10 or bal <> 10 then raise exception 'FAIL T6 % bal=%', r, bal; end if;

  -- idempotent
  select * into r from public.award_faith_day(u, today, evening_t);
  select balance into bal from public.credit_accounts where user_id = u;
  if r.out_reason <> 'already_awarded' or bal <> 10 then raise exception 'FAIL T7 % bal=%', r, bal; end if;

  -- 7-day streak bonus: 6 previous completed days + today
  delete from public.credit_ledger where user_id = u;
  update public.credit_accounts set balance = 0 where user_id = u;
  for i in 1..6 loop
    insert into public.credit_ledger (user_id, amount, reason, credit_date, idempotency_key, status)
    values (u, 10, 'faith_day_complete', today - i, 'faith_day:' || (today - i)::text, 'committed');
  end loop;
  select * into r from public.award_faith_day(u, today, evening_t);
  select balance into bal from public.credit_accounts where user_id = u;
  if r.out_awarded <> 40 or bal <> 40 then raise exception 'FAIL T8 % bal=%', r, bal; end if;
  select count(*) into n from public.credit_ledger where user_id = u and reason = 'faith_streak_7';
  if n <> 1 then raise exception 'FAIL T8b bonus rows=%', n; end if;

  -- 6 consecutive days (not 7) gives no bonus
  delete from public.credit_ledger where user_id = u;
  update public.credit_accounts set balance = 0 where user_id = u;
  for i in 1..5 loop
    insert into public.credit_ledger (user_id, amount, reason, credit_date, idempotency_key, status)
    values (u, 10, 'faith_day_complete', today - i, 'faith_day:' || (today - i)::text, 'committed');
  end loop;
  select * into r from public.award_faith_day(u, today, evening_t);
  if r.out_awarded <> 10 then raise exception 'FAIL T9 %', r; end if;

  -- ordinary users cannot call it
  begin
    set local role authenticated;
    perform * from public.award_faith_day(u, today, evening_t);
    reset role;
    raise exception 'FAIL T10 authenticated could call award_faith_day';
  exception when insufficient_privilege then
    reset role;
  end;

  raise exception 'ALL TESTS PASSED';
end $$;
