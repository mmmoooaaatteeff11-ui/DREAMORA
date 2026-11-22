-- Self-cleaning test for 006. Run in the Supabase SQL editor AFTER 006.
-- Everything is rolled back: the CORRECT result is the intentional error "ALL TESTS PASSED".
-- Any message starting with FAIL means something is wrong: send it to me.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  today date := (now() at time zone 'Africa/Cairo')::date;
  n int; v numeric; g uuid; d uuid; m1 uuid; m2 uuid; l uuid; s record; r jsonb; it uuid;
begin
  insert into auth.users (id) values (a), (b);

  -- ===== act as user A =====
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  -- T1 mood: insert + upsert same day keeps one row
  insert into public.mood_entries (user_id, entry_date, mood, mood_key, note) values (a, today, 4, 'calm', 'ok');
  insert into public.mood_entries (user_id, entry_date, mood, mood_key) values (a, today, 5, 'calm')
    on conflict (user_id, entry_date) do update set mood = excluded.mood, mood_key = excluded.mood_key;
  select count(*), max(mood) into n, v from public.mood_entries where user_id = a;
  if n <> 1 or v <> 5 then raise exception 'FAIL T1 rows=% mood=%', n, v; end if;

  -- T2 invalid mood_key rejected
  begin
    insert into public.mood_entries (user_id, entry_date, mood, mood_key) values (a, today - 40, 3, 'bogus');
    raise exception 'FAIL T2 bogus mood_key accepted';
  exception when check_violation then null; end;

  -- T3 cannot write a row for another user
  begin
    insert into public.mood_entries (user_id, entry_date, mood) values (b, today - 41, 3);
    raise exception 'FAIL T3 inserted a row for another user';
  exception when insufficient_privilege then null; end;

  -- T4 journal: Arabic whole-word search + prefix search
  insert into public.journal_entries (user_id, title, body, category, tags)
    values (a, 'يوم حلو', 'النهارده حسيت بالامتنان والهدوء', 'gratitude', array['شكر']);
  select count(*) into n from public.journal_entries where search_tsv @@ websearch_to_tsquery('simple', 'الامتنان') ;
  if n <> 0 then raise exception 'FAIL T4a unexpected whole-word hit (token is "بالامتنان")'; end if;
  select count(*) into n from public.journal_entries where search_tsv @@ websearch_to_tsquery('simple', 'بالامتنان');
  if n <> 1 then raise exception 'FAIL T4b whole-word search n=%', n; end if;
  select count(*) into n from public.journal_entries where search_tsv @@ to_tsquery('simple', 'بالامت:*');
  if n <> 1 then raise exception 'FAIL T4c prefix search n=%', n; end if;
  select count(*) into n from public.journal_entries where search_tsv @@ websearch_to_tsquery('simple', 'الغضب');
  if n <> 0 then raise exception 'FAIL T4d false hit'; end if;

  -- T5 future letters
  begin
    insert into public.future_letters (user_id, title, body, deliver_on) values (a, 't', 'b', today);
    raise exception 'FAIL T5a letter for today accepted';
  exception when invalid_parameter_value then null; end;
  insert into public.future_letters (user_id, title, body, deliver_on) values (a, 'لنفسي', 'رسالة', today + 10) returning id into l;
  update public.future_letters set body = 'رسالة معدلة' where id = l;
  begin
    update public.future_letters set delivered_at = now() where id = l;
    raise exception 'FAIL T5b delivered before the date';
  exception when invalid_parameter_value then null; end;

  -- T6 roadmap + automatic progress
  insert into public.dreams (user_id, title) values (a, 'حلم') returning id into d;
  insert into public.goals (user_id, dream_id, title) values (a, d, 'هدف') returning id into g;
  insert into public.milestones (user_id, goal_id, title, position) values (a, g, 'م1', 1) returning id into m1;
  insert into public.milestones (user_id, goal_id, title, position) values (a, g, 'م2', 2) returning id into m2;
  update public.milestones set completed_at = now() where id = m1;
  select progress into n from public.goals where id = g;
  if n <> 50 then raise exception 'FAIL T6a progress=%', n; end if;
  update public.milestones set completed_at = now() where id = m2;
  select progress, status into s from public.goals where id = g;
  if s.progress <> 100 or s.status <> 'completed' then raise exception 'FAIL T6b %', s; end if;
  update public.milestones set completed_at = null where id = m2;
  select progress, status into s from public.goals where id = g;
  if s.progress <> 50 or s.status <> 'active' then raise exception 'FAIL T6c %', s; end if;

  -- T7 vision board: cap of 60 items
  insert into public.vision_items (user_id, content) select a, 'item ' || i from generate_series(1, 60) i;
  begin
    insert into public.vision_items (user_id, content) values (a, 'one too many');
    raise exception 'FAIL T7 61st item accepted';
  exception when program_limit_exceeded then null; end;
  select id into it from public.vision_items where user_id = a limit 1;

  -- T8 bad color / position rejected
  begin
    update public.vision_items set color = 'red' where id = it;
    raise exception 'FAIL T8 bad color accepted';
  exception when check_violation then null; end;

  -- ===== streak + recap (need rows on specific days) =====
  reset role;
  delete from public.mood_entries where user_id = a;
  delete from public.journal_entries where user_id = a;
  insert into public.mood_entries (user_id, entry_date, mood, mood_key) values
    (a, today, 5, 'calm'), (a, today - 1, 4, 'calm'), (a, today - 2, 3, 'sad'), (a, today - 6, 2, null);
  insert into public.journal_entries (user_id, body, created_at) values
    (a, 'x', ((today - 3)::timestamp + interval '12 hours') at time zone 'Africa/Cairo');
  insert into public.spiritual_daily_progress (user_id, entry_date) values (a, today - 4);

  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  -- T9 streak: today..today-4 are consecutive (mood x3, journal, spiritual) -> 5; today-6 is separate
  select * into s from public.my_streak();
  if s.current_streak <> 5 or s.best_streak <> 5 or s.active_days_30 <> 6 then raise exception 'FAIL T9 %', s; end if;

  -- T10 weekly recap
  r := public.weekly_recap();
  if (r->>'mood_days')::int <> 4 or (r->>'avg_mood')::numeric <> 3.5 or r->>'top_mood_key' <> 'calm'
     or (r->>'journal_entries')::int <> 1 or (r->>'active_days')::int <> 6 then
    raise exception 'FAIL T10 %', r;
  end if;

  -- ===== act as user B: isolation =====
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.mood_entries; if n <> 0 then raise exception 'FAIL T11a B sees A mood'; end if;
  select count(*) into n from public.journal_entries; if n <> 0 then raise exception 'FAIL T11b B sees A journal'; end if;
  select count(*) into n from public.future_letters; if n <> 0 then raise exception 'FAIL T11c B sees A letters'; end if;
  select count(*) into n from public.vision_items; if n <> 0 then raise exception 'FAIL T11d B sees A vision'; end if;
  select count(*) into n from public.goals; if n <> 0 then raise exception 'FAIL T11e B sees A goals'; end if;
  delete from public.vision_items where id = it;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL T11f B deleted A vision item'; end if;
  s := null;
  select * into s from public.my_streak();
  if s.current_streak <> 0 then raise exception 'FAIL T11g B streak sees A data %', s; end if;

  -- ===== sealed letter =====
  reset role;
  alter table public.future_letters disable trigger future_letters_guard_trg;
  update public.future_letters set deliver_on = today - 1 where id = l;
  alter table public.future_letters enable trigger future_letters_guard_trg;
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    update public.future_letters set body = 'tamper' where id = l;
    raise exception 'FAIL T12a sealed letter edited';
  exception when invalid_parameter_value then null; end;
  update public.future_letters set delivered_at = now() where id = l;
  begin
    update public.future_letters set delivered_at = null where id = l;
    raise exception 'FAIL T12b delivered_at reset';
  exception when invalid_parameter_value then null; end;

  -- ===== privileges =====
  reset role;
  set local role anon;
  begin
    perform 1 from public.mood_entries limit 1;
    raise exception 'FAIL T13a anon can read mood_entries';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    truncate public.mood_entries;
    raise exception 'FAIL T13b authenticated can TRUNCATE';
  exception when insufficient_privilege then null; end;

  reset role;
  raise exception 'ALL TESTS PASSED';
end $$;
