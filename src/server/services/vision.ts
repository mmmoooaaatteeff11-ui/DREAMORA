'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  updateVisionPositionSchema,
  visionIdSchema,
  visionItemSchema,
} from '@/lib/validation/vision';

type VisionError = { status: 'error'; code: string };
type VisionResult = { status: 'success' } | VisionError;
type CreatedVisionResult = { status: 'success'; item: VisionResultItem } | VisionError;
type VisionResultItem = {
  id: string;
  kind: 'text' | 'quote' | 'emoji';
  content: string;
  emoji: string | null;
  color: string | null;
  x: number;
  y: number;
  z: number;
  size: number;
};

async function getContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' as const, code: 'session_expired' };
  return { status: 'success' as const, supabase, user };
}

export async function createVisionItem(input: unknown): Promise<CreatedVisionResult> {
  const parsed = visionItemSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;

  const { data, error } = await context.supabase
    .from('vision_items')
    .insert({
      user_id: context.user.id,
      kind: parsed.data.kind,
      content: parsed.data.content,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color,
      size: parsed.data.size,
    })
    .select('id,kind,content,emoji,color,x,y,z,size')
    .single();
  if (error) {
    return { status: 'error', code: error.code === '54000' ? 'limit_reached' : 'generic' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', item: data as VisionResultItem };
}

export async function updateVisionPosition(input: unknown): Promise<VisionResult> {
  const parsed = updateVisionPositionSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;

  const { data, error } = await context.supabase
    .from('vision_items')
    .update({ x: parsed.data.x, y: parsed.data.y })
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

export async function bringVisionItemToFront(input: unknown): Promise<VisionResult> {
  const parsed = visionIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data: item, error: itemError } = await context.supabase
    .from('vision_items')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (itemError) return { status: 'error', code: 'generic' };
  if (!item) return { status: 'error', code: 'not_found' };

  const { data: highest, error: highestError } = await context.supabase
    .from('vision_items')
    .select('z')
    .eq('user_id', context.user.id)
    .order('z', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (highestError) return { status: 'error', code: 'generic' };
  const z = Math.min((highest?.z ?? -1) + 1, 1000);

  const { error } = await context.supabase
    .from('vision_items')
    .update({ z })
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id);
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

export async function deleteVisionItem(input: unknown): Promise<VisionResult> {
  const parsed = visionIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('vision_items')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}
