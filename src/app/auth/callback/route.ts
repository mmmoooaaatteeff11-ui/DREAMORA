import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { localeFromPath, sanitizeInternalPath } from '@/lib/auth/redirect';
import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';

/**
 * Email links (signup confirmation, password recovery) land here.
 * Exchanges the one-time code for a session cookie, then forwards to a validated internal path.
 * This route is excluded from the i18n middleware matcher, so `next` must already include the locale.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const next = sanitizeInternalPath(searchParams.get('next')) ?? `/${routing.defaultLocale}/dashboard`;
  const locale = localeFromPath(next);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supabase = createClient();
  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  }

  if (failed) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=auth_callback`, origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
