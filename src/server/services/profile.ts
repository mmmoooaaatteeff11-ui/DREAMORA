'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_ERROR_CODES, profileSchema } from '@/lib/validation/profile';
import type { ActionState } from '@/types/action';

const KNOWN = new Set<string>(PROFILE_ERROR_CODES);

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

/** Updates the user's own profile row. RLS + the DB trigger make sure role/plan can never change here. */
export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    displayName: str(formData, 'displayName'),
    language: str(formData, 'language'),
    timezone: str(formData, 'timezone'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = KNOWN.has(issue.message) ? issue.message : 'invalid';
    }
    return { status: 'error', code: 'validation', fieldErrors };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { displayName, language, timezone } = parsed.data;
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, language, timezone })
    .eq('id', user.id);

  if (error) return { status: 'error', code: 'generic' };

  const locale = await getLocale();
  if (language !== locale) {
    // The user picked another language: continue in it.
    return redirect({ href: '/settings', locale: language });
  }

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

/**
 * AI memory consent. OFF by default (user_preferences.ai_memory_enabled = false);
 * it only becomes true when the user explicitly flips the switch.
 */
export async function setAiMemory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const enabled = formData.get('enabled') === 'true';

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, ai_memory_enabled: enabled }, { onConflict: 'user_id' });

  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

/** Deletes every saved AI memory of the current user (RLS limits the delete to their own rows). */
export async function deleteAllMemory(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('user_memory').delete().eq('user_id', user.id);
  revalidatePath('/', 'layout');
}
