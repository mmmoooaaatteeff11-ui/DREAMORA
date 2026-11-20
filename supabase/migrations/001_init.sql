-- DREAMORA — 001_init.sql
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ============ Helpers ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  language text not null default 'ar' check (language in ('ar','en')),
  timezone text not null default 'Africa/Cairo',
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','premium','pro')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  ai_memory_enabled boolean not null default false,
  voice_output boolean not null default false,
  daily_checkin boolean not null default false,
  reminders jsonb not null default '{}'::jsonb,
  privacy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  answers jsonb not null default '{}'::jsonb,
  narrative text,
  future_letter text,
  roadmap jsonb,
  status text not null default 'draft' check (status in ('draft','generated','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dream_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dream_id uuid not null references public.dreams(id) on delete cascade,
  position smallint not null default 0,
  title text not null,
  description text not null,
  image_path text,
  image_source text not null default 'none' check (image_source in ('ai_generated','user_uploaded','none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dream_id uuid references public.dreams(id) on delete set null,
  title text not null check (char_length(title) <= 200),
  description text,
  deadline date,
  status text not null default 'active' check (status in ('active','completed','paused','archived')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null check (char_length(title) <= 200),
  cadence text not null default 'once' check (cadence in ('once','daily','weekly')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  category text not null default 'custom'
    check (category in ('prayer','quran','fasting','spiritual','exercise','reading','learning','sleep','health','custom')),
  target_value numeric,
  unit text,
  reminder_time time,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null,
  value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood smallint not null check (mood between 1 and 5),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood_entry_id uuid references public.mood_entries(id) on delete set null,
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.future_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null check (char_length(title) <= 200),
  body text not null check (char_length(body) <= 10000),
  deliver_on date not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ Indexes ============
create index on public.messages (conversation_id, created_at);
create index on public.conversations (user_id, updated_at desc);
create index on public.dream_scenes (dream_id, position);
create index on public.milestones (goal_id);
create index on public.tasks (user_id, due_date);
create index on public.habit_completions (user_id, completed_on);
create index on public.mood_entries (user_id, entry_date desc);
create index on public.future_letters (deliver_on) where delivered_at is null;
create index on public.notifications (user_id, created_at desc);

-- ============ updated_at triggers, user_id indexes, RLS ============
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','conversations','messages','user_memory','dreams',
    'dream_scenes','goals','milestones','tasks','habits','habit_completions',
    'mood_entries','journal_entries','achievements','future_letters','notifications'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);

    if t <> 'profiles' then
      execute format('create index on public.%I (user_id)', t);
      execute format('create policy "own rows" on public.%I for all to authenticated
                      using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- profiles: id = auth.uid()
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- no insert/delete policy: rows are created by trigger, removed via cascade on account deletion

-- Users cannot change their own role or plan (service role bypasses RLS, auth.uid() is null there)
create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (new.role is distinct from old.role or new.plan is distinct from old.plan) then
    raise exception 'role and plan can only be changed server-side';
  end if;
  return new;
end $$;

create trigger protect_privileged before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ============ New user bootstrap ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'display_name', ''));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
