'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dateKeyInTimeZone } from '@/lib/mood/date';
import { moodScoreByKey, saveMoodSchema } from '@/lib/validation/mood';
import type { ActionState } from '@/types/action';

export async function saveMood(input: unknown): Promise<ActionState> {
  const parsed = saveMoodSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return { status: 'error', code: 'generic' };

  const entryDate = dateKeyInTimeZone(new Date(), profile?.timezone ?? 'Africa/Cairo');
  const { error } = await supabase.from('mood_entries').upsert(
    {
      user_id: user.id,
      entry_date: entryDate,
      mood: moodScoreByKey[parsed.data.moodKey],
      mood_key: parsed.data.moodKey,
      note: parsed.data.note || null,
    },
    { onConflict: 'user_id,entry_date' },
  );
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}
