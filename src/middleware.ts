import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, routing } from '@/i18n/routing';
import { getSupabaseEnv } from '@/lib/supabase/env';

const intlMiddleware = createIntlMiddleware(routing);

/** Pages reachable without a session (path without locale prefix). */
const AUTH_PAGES = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);
/**
 * Signed-in users are bounced away from auth pages, EXCEPT reset-password:
 * the recovery link creates a (temporary) session that must be allowed to set a new password.
 */
const ALLOWED_WHEN_SIGNED_IN = new Set(['/reset-password']);

export async function middleware(request: NextRequest) {
  // 1) Locale handling (redirects "/" -> "/ar", sets locale headers).
  const response = intlMiddleware(request);
  if (response.headers.get('location')) return response;

  const [, localeSegment = '', ...restSegments] = request.nextUrl.pathname.split('/');
  if (!isLocale(localeSegment)) return response;
  const locale = localeSegment;
  const rest = ('/' + restSegments.join('/')).replace(/\/+$/, '') || '/';

  // 2) Refresh the Supabase session; refreshed cookies are written onto `response`.
  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth (never trust getSession() on the server).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname}`;
    target.search = '';
    Object.entries(params ?? {}).forEach(([k, v]) => target.searchParams.set(k, v));
    const redirect = NextResponse.redirect(target);
    // Keep any refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // 3) Route protection.
  if (rest === '/') return redirectTo(user ? '/dashboard' : '/login');

  if (AUTH_PAGES.has(rest)) {
    if (user && !ALLOWED_WHEN_SIGNED_IN.has(rest)) return redirectTo('/dashboard');
    return response;
  }

  if (!user) {
    return redirectTo('/login', { next: rest + request.nextUrl.search });
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals, the auth callback route, and files with an extension.
  matcher: ['/((?!api|trpc|_next|_vercel|auth/callback|.*\\..*).*)'],
};
