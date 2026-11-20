import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

/**
 * Server client (Server Components, Server Actions, Route Handlers).
 * Uses the anon key + the user's session cookies, so RLS is enforced.
 * Create one per request; never share across requests.
 */
export function createClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: middleware refreshes the session cookies.
        }
      },
    },
  });
}
