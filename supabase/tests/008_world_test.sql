-- Self-cleaning test for 008. Run in the Supabase SQL editor AFTER 008.
-- Everything is rolled back: the CORRECT result is the intentional error "ALL TESTS PASSED".
-- Any message starting with FAIL means something is wrong: send it to me.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ga uuid; gb uuid; oa uuid; n int; ts timestamptz; i int;
begin
  insert into auth.users (id) values (a), (b);
  perform set_config('request.jwt.claim.sub', b::text, true);
  insert into public.goals (user_id, title) values (b, 'B goal') returning id into gb;
  perform set_config('request.jwt.claim.sub', a::text, true);
  insert into public.goals (user_id, title) values (a, 'A goal') returning id into ga;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);

  -- T1 profile insert + upsert keeps one row
  insert into public.world_profiles (user_id, hero_name, companion_name) values (a, 'سارة', 'ليلى');
  insert into public.world_profiles (user_id, hero_gender) values (a, 'f')
    on conflict (user_id) do update set hero_gender = excluded.hero_gender;
  select count(*) into n from public.world_profiles where user_id = a and hero_gender = 'f';
  if n <> 1 then raise exception 'FAIL T1 rows=%', n; end if;

  -- T2 invalid values rejected
  begin update public.world_profiles set companion_form = 'dragon' where user_id = a; raise exception 'FAIL T2a bad form accepted';
  exception when check_violation then null; end;
  begin update public.world_profiles set hero_skin = 9 where user_id = a; raise exception 'FAIL T2b bad skin accepted';
  exception when check_violation then null; end;

  -- T3 cannot write a profile for someone else
  begin insert into public.world_profiles (user_id) values (b); raise exception 'FAIL T3 wrote another user row';
  exception when insufficient_privilege then null; end;

  -- T4 obstacle: overcome needs how; overcome_at set/cleared automatically
  insert into public.goal_obstacles (user_id, goal_id, title, kind) values (a, ga, 'مفيش وقت', 'time') returning id into oa;
  begin update public.goal_obstacles set status = 'overcome' where id = oa; raise exception 'FAIL T4a overcome without how';
  exception when check_violation then null; end;
  update public.goal_obstacles set status = 'overcome', how_overcome = '10 دقايق قبل النوم' where id = oa;
  select overcome_at into ts from public.goal_obstacles where id = oa;
  if ts is null then raise exception 'FAIL T4b overcome_at not set'; end if;
  update public.goal_obstacles set status = 'open' where id = oa;
  select overcome_at into ts from public.goal_obstacles where id = oa;
  if ts is not null then raise exception 'FAIL T4c overcome_at not cleared'; end if;
  update public.goal_obstacles set status = 'overcome' where id = oa;

  -- T5 goal of another user rejected
  begin insert into public.goal_obstacles (user_id, goal_id, title) values (a, gb, 'x'); raise exception 'FAIL T5 foreign goal accepted';
  exception when foreign_key_violation then null; end;

  -- T6 steps: max 5, bad obstacle rejected
  for i in 1..5 loop insert into public.obstacle_steps (user_id, obstacle_id, title, position) values (a, oa, 's' || i, i); end loop;
  begin insert into public.obstacle_steps (user_id, obstacle_id, title) values (a, oa, 's6'); raise exception 'FAIL T6a sixth step accepted';
  exception when program_limit_exceeded then null; end;
  begin insert into public.obstacle_steps (user_id, obstacle_id, title) values (a, gen_random_uuid(), 'x'); raise exception 'FAIL T6b step on missing obstacle';
  exception when foreign_key_violation then null; end;

  -- T7 recall returns the overcome obstacle (same goal / same kind)
  select count(*) into n from public.recall_obstacles(ga, 'time');
  if n <> 1 then raise exception 'FAIL T7 recall rows=%', n; end if;

  -- T8 user B sees nothing of A
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.goal_obstacles;
  if n <> 0 then raise exception 'FAIL T8a B sees % obstacles', n; end if;
  select count(*) into n from public.recall_obstacles(null, 'time');
  if n <> 0 then raise exception 'FAIL T8b B recalls % rows', n; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
