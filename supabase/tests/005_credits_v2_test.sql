-- Self-cleaning test for 005 + 005b. Run in the SQL editor of a TEST project.
-- Everything is rolled back at the end: the CORRECT result is the intentional error "ALL TESTS PASSED".
-- Any message starting with FAIL means something is wrong: send it to me.
do $$
declare
  u uuid := gen_random_uuid();
  r record; r2 record; r3 record;
  bal int; n int; ok boolean; used_n int;
begin
  insert into auth.users (id) values (u);
  insert into public.profiles (id) values (u) on conflict (id) do nothing;

  -- T1: free quota (companion: 2/day) then no credits => refused
  select * into r from public.reserve_credits(u, 'companion_message', 't1a');
  if not (r.allowed and r.source = 'free_quota') then raise exception 'FAIL T1a %', r; end if;
  select * into r from public.reserve_credits(u, 'companion_message', 't1b');
  if not (r.allowed and r.source = 'free_quota') then raise exception 'FAIL T1b %', r; end if;
  select * into r from public.reserve_credits(u, 'companion_message', 't1c');
  if r.allowed or r.reason <> 'quota_exhausted_no_credits' then raise exception 'FAIL T1c %', r; end if;

  -- T2: with balance 10, the 3rd message is charged 4
  insert into public.credit_accounts (user_id, balance) values (u, 10) on conflict (user_id) do update set balance = 10;
  select * into r from public.reserve_credits(u, 'companion_message', 't2');
  select balance into bal from public.credit_accounts where user_id = u;
  if not (r.allowed and r.source = 'credits' and bal = 6) then raise exception 'FAIL T2 % bal=%', r, bal; end if;

  -- T3: same key again => same reservation, NOT charged twice
  select * into r2 from public.reserve_credits(u, 'companion_message', 't2');
  select balance into bal from public.credit_accounts where user_id = u;
  if not (r2.duplicate and r2.reservation_id = r.reservation_id and bal = 6) then raise exception 'FAIL T3 % bal=%', r2, bal; end if;

  -- T4: commit once ok, twice harmless
  select public.commit_credits(r.reservation_id) into ok;
  if not ok then raise exception 'FAIL T4a'; end if;
  select public.commit_credits(r.reservation_id) into ok;
  if ok then raise exception 'FAIL T4b double commit returned true'; end if;
  -- a committed call can no longer be refunded
  select public.refund_credits(r.reservation_id) into ok;
  if ok then raise exception 'FAIL T4c refund after commit'; end if;

  -- T5: refund of a paid call gives credits back exactly once and writes one refund row
  select * into r from public.reserve_credits(u, 'companion_message', 't5');
  select public.refund_credits(r.reservation_id, 'gemini failed') into ok;
  select balance into bal from public.credit_accounts where user_id = u;
  if not (ok and bal = 6) then raise exception 'FAIL T5a ok=% bal=%', ok, bal; end if;
  select public.refund_credits(r.reservation_id) into ok;
  select balance into bal from public.credit_accounts where user_id = u;
  select count(*) into n from public.credit_ledger where user_id = u and reason = 'refund';
  if ok or bal <> 6 or n <> 1 then raise exception 'FAIL T5b ok=% bal=% refunds=%', ok, bal, n; end if;

  -- T6: refund of a free-quota call restores the quota unit
  insert into public.credit_accounts (user_id, balance) values (u, 0) on conflict (user_id) do update set balance = 0;
  select * into r from public.reserve_credits(u, 'dream_scene', 't6a');   -- free_quota use 1 of 6
  select used into used_n from public.feature_usage where user_id = u and feature = 'dream_scene';
  if used_n <> 1 then raise exception 'FAIL T6a used=%', used_n; end if;
  perform public.refund_credits(r.reservation_id);
  select used into used_n from public.feature_usage where user_id = u and feature = 'dream_scene';
  if used_n <> 0 then raise exception 'FAIL T6b used=%', used_n; end if;

  -- T7: not enough credits => refused, balance untouched
  update public.credit_accounts set balance = 3 where user_id = u;
  select * into r from public.reserve_credits(u, 'cinema_storyboard', 't7');
  select balance into bal from public.credit_accounts where user_id = u;
  if r.allowed or r.reason <> 'insufficient_credits' or bal <> 3 then raise exception 'FAIL T7 % bal=%', r, bal; end if;

  -- T8: per-model price (cinema_video: lite 430 vs fast 1300)
  update public.credit_accounts set balance = 500 where user_id = u;
  select * into r from public.reserve_credits(u, 'cinema_video', 't8a', 'lite');
  select * into r2 from public.reserve_credits(u, 'cinema_video', 't8b', 'fast');
  select balance into bal from public.credit_accounts where user_id = u;
  if not (r.allowed and r.cost = 430 and not r2.allowed and bal = 70) then raise exception 'FAIL T8 % % bal=%', r, r2, bal; end if;

  -- T9: unknown / disabled features are refused
  select * into r from public.reserve_credits(u, 'does_not_exist', 't9');
  if r.allowed or r.reason <> 'unknown_feature' then raise exception 'FAIL T9 %', r; end if;

  -- T10: stale pending reservation (older than 15 min) is swept and refunded
  update public.credit_accounts set balance = 10 where user_id = u;
  select * into r from public.reserve_credits(u, 'journal_summary', 't10a');   -- uses free quota
  select * into r2 from public.reserve_credits(u, 'voice_reply_server', 't10b'); -- paid 8
  update public.credit_reservations set created_at = now() - interval '20 minutes' where id in (r.reservation_id, r2.reservation_id);
  select public.sweep_stale_reservations(15) into n;
  select balance into bal from public.credit_accounts where user_id = u;
  if n <> 2 or bal <> 10 then raise exception 'FAIL T10 swept=% bal=%', n, bal; end if;

  -- T11: plan gate
  update public.feature_pricing set min_plan = 'premium' where feature = 'dream_avatar';
  select * into r from public.reserve_credits(u, 'dream_avatar', 't11');
  if r.allowed or r.reason <> 'plan_required' then raise exception 'FAIL T11 %', r; end if;

  -- T12: a normal signed-in user must NOT be able to call the spend functions
  begin
    set local role authenticated;
    perform * from public.reserve_credits(u, 'companion_message', 't12');
    reset role;
    raise exception 'FAIL T12 authenticated could call reserve_credits';
  exception when insufficient_privilege then
    reset role;
  end;

  -- T13: nor write to the ledger directly
  begin
    set local role authenticated;
    insert into public.credit_ledger (user_id, amount, reason, idempotency_key) values (u, 999, 'hack', 'x');
    reset role;
    raise exception 'FAIL T13 authenticated could insert into credit_ledger';
  exception when insufficient_privilege then
    reset role;
  end;

  raise exception 'ALL TESTS PASSED';
end $$;
