'use server';

import { getLocale } from 'next-intl/server';
import type { ZodError } from 'zod';
import { redirect } from '@/i18n/navigation';
import { sanitizeInternalPath, stripLocale } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import {
  VALIDATION_CODES,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/validation/auth';
import type { AuthErrorCode, AuthState } from '@/types/auth';

const KNOWN_CODES = new Set<string>(VALIDATION_CODES);

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (out[key]) continue;
    out[key] = KNOWN_CODES.has(issue.message) ? issue.message : 'invalid';
  }
  return out;
}

function validationError(error: ZodError): AuthState {
  return { status: 'error', code: 'validation', fieldErrors: toFieldErrors(error) };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Link sent in emails -> /auth/callback exchanges the code for a session, then forwards to `next`. */
function callbackUrl(next: string): string {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function mapAuthError(error: { code?: string; status?: number }): AuthErrorCode {
  switch (error.code) {
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'weak_password':
      return 'weak_password';
    case 'same_password':
      return 'same_password';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
    default:
      return error.status === 429 ? 'rate_limited' : 'generic';
  }
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: str(formData, 'email'), password: str(formData, 'password') });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Same message for wrong email and wrong password (no account enumeration).
    const code = mapAuthError(error);
    return { status: 'error', code: code === 'generic' ? 'invalid_credentials' : code };
  }

  const locale = await getLocale();
  const next = stripLocale(sanitizeInternalPath(formData.get('next')) ?? '/dashboard');
  return redirect({ href: next, locale });
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    displayName: str(formData, 'displayName'),
    email: str(formData, 'email'),
    password: str(formData, 'password'),
    confirmPassword: str(formData, 'confirmPassword'),
  });
  if (!parsed.success) return validationError(parsed.error);

  const locale = await getLocale();
  const { displayName, email, password } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user() trigger in 001_init.sql
      data: displayName ? { display_name: displayName } : {},
      emailRedirectTo: callbackUrl(`/${locale}/dashboard`),
    },
  });

  if (error) {
    const code = mapAuthError(error);
    return { status: 'error', code };
  }

  // Email confirmation disabled in Supabase -> session exists immediately.
  if (data.session) return redirect({ href: '/dashboard', locale });

  // Confirmation required. Same response whether or not the email already exists (no enumeration).
  return { status: 'success' };
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({ email: str(formData, 'email') });
  if (!parsed.success) return validationError(parsed.error);

  const locale = await getLocale();
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl(`/${locale}/reset-password`),
  });

  // Only surface rate limiting; otherwise always report success (no account enumeration).
  if (error && mapAuthError(error) === 'rate_limited') return { status: 'error', code: 'rate_limited' };
  return { status: 'success' };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: str(formData, 'password'),
    confirmPassword: str(formData, 'confirmPassword'),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', code: mapAuthError(error) };

  // Invalidate every other session after a password change.
  await supabase.auth.signOut({ scope: 'others' });

  const locale = await getLocale();
  return redirect({ href: '/dashboard', locale });
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  return redirect({ href: '/login', locale });
}
