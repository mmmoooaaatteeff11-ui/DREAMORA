-- Explicit, least-privilege table grants for the authenticated app.
-- Existing RLS policies remain the row-level boundary for every operation.
grant usage on schema public to authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, delete on table public.user_memory to authenticated;
