-- Append-only, user-owned text scenes for the Dream Scenes experience.
create table public.dream_scene_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  scene_number integer not null check (scene_number > 0),
  dream text not null check (char_length(dream) between 1 and 2000),
  selected_choice text check (selected_choice is null or char_length(selected_choice) between 1 and 1000),
  scene_text text not null check (char_length(scene_text) between 1 and 8000),
  choices jsonb not null check (
    case
      when jsonb_typeof(choices) = 'array' then jsonb_array_length(choices) between 2 and 3
      else false
    end
  ),
  first_step text not null check (char_length(first_step) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, run_id, scene_number)
);

create index dream_scene_turns_user_run_idx
  on public.dream_scene_turns (user_id, run_id, scene_number desc);
create index dream_scene_turns_user_created_idx
  on public.dream_scene_turns (user_id, created_at desc);

alter table public.dream_scene_turns enable row level security;

create policy "read own dream scene turns" on public.dream_scene_turns
  for select to authenticated using (user_id = auth.uid());
create policy "insert own dream scene turns" on public.dream_scene_turns
  for insert to authenticated with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert on table public.dream_scene_turns to authenticated;
