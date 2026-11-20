import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * SERVICE-ROLE client. Bypasses RLS entirely.
 *
 * Use ONLY in trusted server code (admin routes after a server-side role check,
 * cron jobs, account deletion). Never import this from a client component and never
 * expose the key via NEXT_PUBLIC_*. `server-only` makes the build fail if it is imported client-side.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
