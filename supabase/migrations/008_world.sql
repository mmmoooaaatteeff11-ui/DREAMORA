-- DREAMORA 008: "Nomouk World" data: hero + companion look, goal obstacles (trophies = overcome obstacles), bridge steps.
-- Additive and re-runnable. One transaction. Run AFTER 006 (and after 007 if you have it; the number is only an order).
-- Tables: world_profiles (1 row per user) · goal_obstacles · obstacle_steps (max 5 per obstacle)
-- Function: recall_obstacles(p_goal, p_kind): up to 3 overcome obstacles, used by the companion to say "remember how you beat X?"
begin;

-- 0) Preflight ------------------------------------------------------------------------------------------------------
do $$
declare t text; missing text := '';
begin
  foreach t in array array['goals.id', 'goals.user_id', 'goals.title', 'goals.status'] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = split_part(t, '.', 1) and column_name = split_part(t, '.', 2)) then
      missing := missing || ' ' || t || ';';
    end if;
  end loop;
  if missing <> '' then raise exception '008 preflight failed, missing:%', missing; end if;
end $$;

-- 1) world_profiles ---------------------------------------------------------------------------------------------------
create table if not exists public.world_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hero_name text check (hero_name is null or char_length(hero_name) between 1 and 16),
  hero_gender text not null default 'm' check (hero_gender in ('m', 'f')),
  hero_skin smallint not null default 0 check (hero_skin between 0 and 3),
  hero_hair smallint not null default 0 check (hero_hair between 0 and 3),
  hero_shirt smallint not null default 0 check (hero_shirt between 0 and 3),
  companion_name text check (companion_name is null or char_length(companion_name) between 1 and 16),
  companion_gender text not null default 'f' check (companion_gender in ('m', 'f')),
  companion_form text not null default 'nur' check (companion_form in ('nur', 'fox', 'spirit')),
  companion_tint smallint not null default 0 check (companion_tint between 0 and 3),
  voice_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) goal_obstacles ---------------------------------------------------------------------------------------------------
create table if not exists public.goal_obstacles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  kind text not null default 'other' check (kind in ('time', 'fear', 'energy', 'other')),
  status text not null default 'open' check (status in ('open', 'overcome')),
  how_overcome text check (how_overcome is null or char_length(how_overcome) between 1 and 500),
  source text not null default 'checkin' check (source in ('checkin', 'chat', 'manual')),
  overcome_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_obstacles_overcome_needs_how check (status = 'open' or how_overcome is not null)
);
create index if not exists goal_obstacles_user_idx on public.goal_obstacles (user_id, status, created_at desc);
create index if not exists goal_obstacles_goal_idx on public.goal_obstacles (goal_id);

-- 3) obstacle_steps (the bridge planks) -----------------------------------------------------------------------------------
create table if not exists public.obstacle_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  obstacle_id uuid not null references public.goal_obstacles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  position smallint not null default 0 check (position between 0 and 9),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists obstacle_steps_obstacle_idx on public.obstacle_steps (obstacle_id, position);

-- 4) Guard triggers ---------------------------------------------------------------------------------------------------------
create or replace function public.world_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.updated_at := now();
  end if;
  if tg_table_name = 'goal_obstacles' then
    if tg_op = 'INSERT' and (select count(*) from public.goal_obstacles where user_id = new.user_id and status = 'open') >= 30 then
      raise exception 'too many open obstacles (max 30)' using errcode = '54000';
    end if;
    if new.goal_id is not null and not exists (select 1 from public.goals where id = new.goal_id and user_id = new.user_id) then
      raise exception 'goal does not belong to this user' using errcode = '23503';
    end if;
    if new.status = 'overcome' then
      new.overcome_at := coalesce(new.overcome_at, now());
    else
      new.overcome_at := null;
    end if;
  elsif tg_table_name = 'obstacle_steps' then
    if not exists (select 1 from public.goal_obstacles where id = new.obstacle_id and user_id = new.user_id) then
      raise exception 'obstacle does not belong to this user' using errcode = '23503';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.obstacle_steps where obstacle_id = new.obstacle_id) >= 5 then
      raise exception 'max 5 steps per obstacle' using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists world_profiles_guard on public.world_profiles;
create trigger world_profiles_guard before update on public.world_profiles for each row execute function public.world_guard();
drop trigger if exists goal_obstacles_guard on public.goal_obstacles;
create trigger goal_obstacles_guard before insert or update on public.goal_obstacles for each row execute function public.world_guard();
drop trigger if exists obstacle_steps_guard on public.obstacle_steps;
create trigger obstacle_steps_guard before insert or update on public.obstacle_steps for each row execute function public.world_guard();

-- 5) RLS --------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['world_profiles', 'goal_obstacles', 'obstacle_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'own rows') then
      execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- 6) GRANTs (minimum) -------------------------------------------------------------------------------------------------------
revoke all on public.world_profiles, public.goal_obstacles, public.obstacle_steps from anon, authenticated;
grant select, insert, update, delete on public.world_profiles, public.goal_obstacles, public.obstacle_steps to authenticated;

-- 7) recall_obstacles: same goal first, then same kind, newest first. SECURITY INVOKER (RLS applies). ------------------------
create or replace function public.recall_obstacles(p_goal uuid default null, p_kind text default null)
returns table (id uuid, title text, kind text, how_overcome text, overcome_at timestamptz)
language sql stable security invoker set search_path = public, pg_temp as $$
  select o.id, o.title, o.kind, o.how_overcome, o.overcome_at
  from public.goal_obstacles o
  where o.status = 'overcome' and o.user_id = auth.uid()
  order by (o.goal_id is not distinct from p_goal and p_goal is not null) desc,
           (o.kind = p_kind and p_kind is not null) desc,
           o.overcome_at desc
  limit 3;
$$;
revoke all on function public.recall_obstacles(uuid, text) from public, anon;
grant execute on function public.recall_obstacles(uuid, text) to authenticated;

commit;
