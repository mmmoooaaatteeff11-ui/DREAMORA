import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

/** Browser client. Uses the anon key + the user's session, so RLS is always enforced. */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
