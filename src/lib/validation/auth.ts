import { z } from 'zod';

/**
 * Validation messages are i18n KEYS (under `auth.validation.*` in messages/*.json),
 * not display text, so the UI can translate them.
 */
export const VALIDATION_CODES = [
  'email_invalid',
  'password_required',
  'password_short',
  'password_long',
  'password_weak',
  'password_mismatch',
  'name_long',
  'invalid',
] as const;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'email_invalid')
  .max(254, 'email_invalid')
  .email('email_invalid');

// bcrypt (used by Supabase) only considers the first 72 bytes; cap to avoid silent truncation surprises.
const newPassword = z
  .string()
  .min(8, 'password_short')
  .max(72, 'password_long')
  .regex(/\p{L}/u, 'password_weak')
  .regex(/\d/, 'password_weak');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'password_required').max(72, 'password_long'),
});

export const signupSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(80, 'name_long')
      .transform((v) => (v === '' ? undefined : v)),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });
