'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { worldProfileSchema } from '@/lib/validation/world';
import type { ActionState } from '@/types/action';

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function saveWorldProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = worldProfileSchema.safeParse({
    heroName: field(formData, 'heroName'),
    heroGender: field(formData, 'heroGender'),
    heroSkin: field(formData, 'heroSkin'),
    heroHair: field(formData, 'heroHair'),
    heroShirt: field(formData, 'heroShirt'),
    companionName: field(formData, 'companionName'),
    companionGender: field(formData, 'companionGender'),
    companionForm: field(formData, 'companionForm'),
    companionTint: field(formData, 'companionTint'),
    voiceEnabled: formData.get('voiceEnabled') === 'on',
  });
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const {
    heroName,
    heroGender,
    heroSkin,
    heroHair,
    heroShirt,
    companionName,
    companionGender,
    companionForm,
    companionTint,
    voiceEnabled,
  } = parsed.data;
  const { error } = await supabase.from('world_profiles').upsert(
    {
      user_id: user.id,
      hero_name: heroName,
      hero_gender: heroGender,
      hero_skin: heroSkin,
      hero_hair: heroHair,
      hero_shirt: heroShirt,
      companion_name: companionName,
      companion_gender: companionGender,
      companion_form: companionForm,
      companion_tint: companionTint,
      voice_enabled: voiceEnabled,
    },
    { onConflict: 'user_id' },
  );
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}
