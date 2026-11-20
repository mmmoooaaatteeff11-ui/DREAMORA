import { routing } from '@/i18n/routing';

/**
 * Open-redirect protection: only same-site, absolute-path redirects are allowed.
 * Rejects "//evil.com", "/\evil.com", "https://...", and control characters.
 */
export function sanitizeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);

/** "/ar/dashboard?x=1" -> "/dashboard?x=1" (next-intl's redirect() re-adds the locale). */
export function stripLocale(path: string): string {
  return path.replace(LOCALE_PREFIX, '') || '/';
}

/** Returns the locale a path starts with, or the default locale. */
export function localeFromPath(path: string): string {
  const match = path.match(LOCALE_PREFIX);
  return match?.[1] ?? routing.defaultLocale;
}
