'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

/** Deletes one conversation (its messages are removed by ON DELETE CASCADE). RLS limits it to the owner. */
export async function deleteConversation(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('conversations').delete().eq('id', id.data).eq('user_id', user.id);

  revalidatePath('/', 'layout');
  const locale = await getLocale();
  return redirect({ href: '/companion', locale });
}
