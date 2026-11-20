import { z } from 'zod';

/** Every IANA time zone the runtime knows (Africa/Cairo, Europe/London, ...). */
export const TIMEZONES: string[] = Intl.supportedValuesOf('timeZone');
const TIMEZONE_SET = new Set(TIMEZONES);

export const PROFILE_ERROR_CODES = ['name_long', 'language_invalid', 'timezone_invalid', 'invalid'] as const;

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, 'name_long')
    .transform((v) => (v === '' ? null : v)),
  language: z.enum(['ar', 'en'], { errorMap: () => ({ message: 'language_invalid' }) }),
  timezone: z.string().refine((v) => TIMEZONE_SET.has(v), 'timezone_invalid'),
});
