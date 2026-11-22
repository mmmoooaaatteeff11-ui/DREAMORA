-- DREAMORA 006: database for Mood, Journal, Future Letters, Streak/Recap, Dream Roadmap and Vision Board.
-- Additive and re-runnable. One transaction: if anything fails, nothing is changed.
-- Run AFTER 005. Apply on a TEST project first if you have real users.
--
-- What it does
--  1. GRANTs (minimum needed) so the app can use these tables. Row Level Security keeps every user inside their own rows.
--  2. mood_entries: named mood (mood_key). journal_entries: title, category, tags and Arabic-friendly search.
--  3. future_letters: guard trigger (future date only, sealed once it arrives, delivered once).
--  4. milestones/tasks: position column; goal progress is recalculated from completed milestones.
--  5. vision_items: new table for the vision board (max 60 items per user).
--  6. my_streak() and weekly_recap(): read-only helper functions (they respect RLS).
--  7. Removes useless privileges (TRUNCATE/TRIGGER/REFERENCES) from anon + authenticated.
-- NOT included: credits for completing the daily faith routine (needs the faith code first -> migration 007).

begin;

-- 0) Preflight --------------------------------------------------------------------------------------------------
do $$
declare t text; missing text := '';
begin
  foreach t in array array[
    'mood_entries.user_id', 'mood_entries.entry_date', 'mood_entries.mood', 'mood_entries.note',
    'journal_entries.user_id', 'journal_entries.body', 'journal_entries.created_at',
    'future_letters.user_id', 'future_letters.title', 'future_letters.body', 'future_letters.deliver_on', 'future_letters.delivered_at',
    'dreams.id', 'dreams.user_id', 'goals.id', 'goals.user_id', 'goals.progress', 'goals.status',
    'milestones.goal_id', 'milestones.completed_at', 'tasks.goal_id', 'tasks.completed_at',
    'spiritual_daily_progress.entry_date'
  ] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = split_part(t, '.', 1) and column_name = split_part(t, '.', 2)) then
      missing := missing || ' ' || t || ';';
    end if;
  end loop;
  if missing <> '' then raise exception '006 preflight failed, missing:%', missing; end if;
end $$;

-- 1) Mood ---------------------------------------------------------------------------------------------------------
alter table public.mood_entries add column if not exists mood_key text;
alter table public.mood_entries drop constraint if exists mood_entries_mood_key_check;
alter table public.mood_entries add constraint mood_entries_mood_key_check
  check (mood_key is null or mood_key in
    ('joyful', 'grateful', 'calm', 'hopeful', 'motivated', 'tired', 'anxious', 'sad', 'angry', 'lonely'));
create index if not exists mood_entries_user_date_idx on public.mood_entries (user_id, entry_date desc);

-- 2) Journal ------------------------------------------------------------------------------------------------------
alter table public.journal_entries add column if not exists title text;
alter table public.journal_entries add column if not exists category text not null default 'general';
alter table public.journal_entries add column if not exists tags text[] not null default '{}';

alter table public.journal_entries drop constraint if exists journal_entries_title_len;
alter table public.journal_entries add constraint journal_entries_title_len check (title is null or char_length(title) <= 200);
alter table public.journal_entries drop constraint if exists journal_entries_category_check;
alter table public.journal_entries add constraint journal_entries_category_check
  check (category in ('general', 'gratitude', 'dream', 'reflection', 'faith', 'goals'));
alter table public.journal_entries drop constraint if exists journal_entries_tags_check;
alter table public.journal_entries add constraint journal_entries_tags_check
  check (cardinality(tags) <= 10 and char_length(array_to_string(tags, ' ')) <= 300);

-- Search: 'simple' configuration = no stemming, works for Arabic words as typed (whole-word search).
alter table public.journal_entries add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || body)) stored;
create index if not exists journal_entries_search_idx on public.journal_entries using gin (search_tsv);
create index if not exists journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);

-- 3) Future letters guard -------------------------------------------------------------------------------------------
create or replace function public.future_letters_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if tg_op = 'INSERT' then
    if new.deliver_on < today + 1 then
      raise exception 'deliver_on must be at least tomorrow' using errcode = '22023';
    end if;
    if new.deliver_on > today + 3660 then
      raise exception 'deliver_on is too far away' using errcode = '22023';
    end if;
    new.delivered_at := null;
    return new;
  end if;

  -- UPDATE
  if old.deliver_on <= today or old.delivered_at is not null then
    -- the letter has arrived: its content is sealed, only delivered_at may be set (once)
    if new.title is distinct from old.title or new.body is distinct from old.body
       or new.deliver_on is distinct from old.deliver_on or new.goal_id is distinct from old.goal_id
       or new.user_id is distinct from old.user_id then
      raise exception 'this letter is sealed' using errcode = '22023';
    end if;
  elsif new.deliver_on is distinct from old.deliver_on and (new.deliver_on < today + 1 or new.deliver_on > today + 3660) then
    raise exception 'deliver_on must be in the future' using errcode = '22023';
  end if;

  if old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then
    raise exception 'already delivered' using errcode = '22023';
  end if;
  if new.delivered_at is not null and new.deliver_on > today then
    raise exception 'not due yet' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists future_letters_guard_trg on public.future_letters;
create trigger future_letters_guard_trg before insert or update on public.future_letters
  for each row execute function public.future_letters_guard();

-- 4) Roadmap: ordering + automatic goal progress -----------------------------------------------------------------------
alter table public.milestones add column if not exists position smallint not null default 0;
alter table public.tasks add column if not exists position smallint not null default 0;

create or replace function public.recompute_goal_progress()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare gid uuid; total integer; done integer;
begin
  gid := coalesce(new.goal_id, old.goal_id);
  select count(*), count(completed_at) into total, done from public.milestones where goal_id = gid;
  if total > 0 then
    update public.goals
       set progress = round(100.0 * done / total)::smallint,
           status = case
                      when done = total and status = 'active' then 'completed'
                      when done < total and status = 'completed' then 'active'
                      else status
                    end,
           updated_at = now()
     where id = gid;
  end if;
  return null;
end;
$$;

drop trigger if exists milestones_progress_trg on public.milestones;
create trigger milestones_progress_trg after insert or delete or update of completed_at, goal_id on public.milestones
  for each row execute function public.recompute_goal_progress();

-- 5) Vision board -----------------------------------------------------------------------------------------------------
create table if not exists public.vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dream_id uuid references public.dreams (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'quote', 'emoji')),
  content text not null check (char_length(content) between 1 and 300),
  emoji text check (emoji is null or char_length(emoji) <= 16),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  x numeric(6, 3) not null default 0 check (x between 0 and 100),
  y numeric(6, 3) not null default 0 check (y between 0 and 100),
  z smallint not null default 0 check (z between 0 and 1000),
  size smallint not null default 2 check (size between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vision_items_user_idx on public.vision_items (user_id, created_at);

create or replace function public.vision_items_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.vision_items where user_id = new.user_id) >= 60 then
    raise exception 'vision board is full (max 60 items)' using errcode = '54000';
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists vision_items_limit_trg on public.vision_items;
create trigger vision_items_limit_trg before insert or update on public.vision_items
  for each row execute function public.vision_items_limit();

-- 6) RLS: make sure every table we use has the "own rows" policy (no-op if it already exists) -----------------------------------
do $$
declare t text;
begin
  foreach t in array array['mood_entries', 'journal_entries', 'future_letters', 'dreams', 'goals', 'milestones', 'tasks', 'vision_items'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'own rows') then
      execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- 7) GRANTs (minimum). RLS still limits every operation to the user's own rows. -------------------------------------------------
revoke all on public.vision_items from anon, authenticated;
grant select, insert, update, delete on
  public.mood_entries, public.journal_entries, public.future_letters,
  public.dreams, public.goals, public.milestones, public.tasks, public.vision_items
  to authenticated;

-- 8) Helper functions (SECURITY INVOKER: they only ever see the caller's own rows) -----------------------------------------------
create or replace function public.my_streak(p_tz text default 'Africa/Cairo')
returns table (current_streak integer, best_streak integer, active_days_30 integer)
language sql
stable
set search_path = public, pg_temp
as $$
  with today as (select (now() at time zone p_tz)::date as d),
  days as (
    select entry_date as d from public.mood_entries where user_id = auth.uid()
    union
    select entry_date from public.spiritual_daily_progress where user_id = auth.uid()
    union
    select (created_at at time zone p_tz)::date from public.journal_entries where user_id = auth.uid()
  ),
  numbered as (select d, d - (row_number() over (order by d))::integer as grp from days),
  islands as (select min(d) as s, max(d) as e, count(*)::integer as n from numbered group by grp)
  select
    coalesce((select n from islands, today where e >= today.d - 1 order by e desc limit 1), 0),
    coalesce((select max(n) from islands), 0),
    (select count(*)::integer from days, today where days.d >= today.d - 29);
$$;

create or replace function public.weekly_recap(p_tz text default 'Africa/Cairo')
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with today as (select (now() at time zone p_tz)::date as d),
  m as (select * from public.mood_entries, today where user_id = auth.uid() and entry_date between today.d - 6 and today.d),
  j as (select * from public.journal_entries, today where user_id = auth.uid() and (created_at at time zone p_tz)::date between today.d - 6 and today.d),
  active as (
    select entry_date as d from m
    union select (created_at at time zone p_tz)::date from j
    union select s.entry_date from public.spiritual_daily_progress s, today
          where s.user_id = auth.uid() and s.entry_date between today.d - 6 and today.d
  )
  select jsonb_build_object(
    'from', (select d - 6 from today),
    'to', (select d from today),
    'mood_days', (select count(*) from m),
    'avg_mood', (select round(avg(mood)::numeric, 1) from m),
    'top_mood_key', (select mood_key from m where mood_key is not null group by mood_key order by count(*) desc, mood_key limit 1),
    'journal_entries', (select count(*) from j),
    'active_days', (select count(*) from active)
  );
$$;

revoke all on function public.my_streak(text) from public, anon;
revoke all on function public.weekly_recap(text) from public, anon;
grant execute on function public.my_streak(text) to authenticated;
grant execute on function public.weekly_recap(text) to authenticated;

-- 9) Hygiene: nobody on the API needs TRUNCATE / TRIGGER / REFERENCES (TRUNCATE ignores RLS). ----------------------------------
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

commit;
