'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dateKeyInTimeZone, letterDateLimits } from '@/lib/letters/date';
import {
  createLetterSchema,
  letterIdSchema,
  updateLetterSchema,
  type LetterDraft,
} from '@/lib/validation/letters';

type LetterError = { status: 'error'; code: string };
type LetterSuccess = { status: 'success' };
type CreateLetterResult = LetterError | (LetterSuccess & { id: string });
type OpenLetterResult =
  | LetterError
  | { status: 'success'; body: string; deliveredAt: string };
type EditLetterResult = LetterError | { status: 'success'; letter: LetterDraft };

async function getLetterContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' as const, code: 'session_expired' };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return { status: 'error' as const, code: 'generic' };

  const timeZone = profile?.timezone ?? 'Africa/Cairo';
  const today = dateKeyInTimeZone(new Date(), timeZone);
  return { status: 'success' as const, supabase, user, today };
}

function isWithinDateLimits(deliverOn: string, today: string): boolean {
  const { minDate, maxDate } = letterDateLimits(today);
  return deliverOn >= minDate && deliverOn <= maxDate;
}

function databaseErrorCode(error: { code?: string; message?: string }): string {
  if (error.code !== '22023') return 'generic';
  return error.message?.toLowerCase().includes('sealed') ? 'sealed' : 'future_date';
}

export async function createFutureLetter(input: unknown): Promise<CreateLetterResult> {
  const parsed = createLetterSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getLetterContext();
  if (context.status === 'error') return context;
  if (!isWithinDateLimits(parsed.data.deliver_on, context.today)) {
    return { status: 'error', code: 'future_date' };
  }

  const { data, error } = await context.supabase
    .from('future_letters')
    .insert({
      user_id: context.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      deliver_on: parsed.data.deliver_on,
    })
    .select('id')
    .single();
  if (error) return { status: 'error', code: databaseErrorCode(error) };

  revalidatePath('/', 'layout');
  return { status: 'success', id: data.id };
}

export async function getFutureLetterForEdit(input: unknown): Promise<EditLetterResult> {
  const parsed = letterIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getLetterContext();
  if (context.status === 'error') return context;

  const { data, error } = await context.supabase
    .from('future_letters')
    .select('id,title,body,deliver_on')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .gt('deliver_on', context.today)
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (data) return { status: 'success', letter: data as LetterDraft };

  const { data: existing, error: existingError } = await context.supabase
    .from('future_letters')
    .select('deliver_on')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (existingError) return { status: 'error', code: 'generic' };
  return {
    status: 'error',
    code: existing ? 'sealed' : 'not_found',
  };
}

export async function updateFutureLetter(input: unknown): Promise<LetterSuccess | LetterError> {
  const parsed = updateLetterSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getLetterContext();
  if (context.status === 'error') return context;
  if (!isWithinDateLimits(parsed.data.deliver_on, context.today)) {
    return { status: 'error', code: 'future_date' };
  }

  const { data: existing, error: existingError } = await context.supabase
    .from('future_letters')
    .select('deliver_on')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (existingError) return { status: 'error', code: 'generic' };
  if (!existing) return { status: 'error', code: 'not_found' };
  if (existing.deliver_on <= context.today) return { status: 'error', code: 'sealed' };

  const { data, error } = await context.supabase
    .from('future_letters')
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      deliver_on: parsed.data.deliver_on,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .gt('deliver_on', context.today)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: databaseErrorCode(error) };
  if (!data) return { status: 'error', code: 'sealed' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

export async function deleteFutureLetter(input: unknown): Promise<LetterSuccess | LetterError> {
  const parsed = letterIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getLetterContext();
  if (context.status === 'error') return context;

  const { data, error } = await context.supabase
    .from('future_letters')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .gt('deliver_on', context.today)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (data) {
    revalidatePath('/', 'layout');
    return { status: 'success' };
  }

  const { data: existing, error: existingError } = await context.supabase
    .from('future_letters')
    .select('deliver_on')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (existingError) return { status: 'error', code: 'generic' };
  return { status: 'error', code: existing ? 'sealed' : 'not_found' };
}

export async function openFutureLetter(input: unknown): Promise<OpenLetterResult> {
  const parsed = letterIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getLetterContext();
  if (context.status === 'error') return context;

  const { data: letter, error: letterError } = await context.supabase
    .from('future_letters')
    .select('id,deliver_on,delivered_at')
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (letterError) return { status: 'error', code: 'generic' };
  if (!letter) return { status: 'error', code: 'not_found' };
  if (letter.deliver_on > context.today) return { status: 'error', code: 'future_date' };

  if (letter.delivered_at === null) {
    const { data, error } = await context.supabase
      .from('future_letters')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', letter.id)
      .eq('user_id', context.user.id)
      .lte('deliver_on', context.today)
      .is('delivered_at', null)
      .select('body,delivered_at')
      .maybeSingle();
    if (error) return { status: 'error', code: databaseErrorCode(error) };
    if (data) {
      revalidatePath('/', 'layout');
      return { status: 'success', body: data.body, deliveredAt: data.delivered_at };
    }
  }

  const { data, error } = await context.supabase
    .from('future_letters')
    .select('body,delivered_at')
    .eq('id', letter.id)
    .eq('user_id', context.user.id)
    .lte('deliver_on', context.today)
    .not('delivered_at', 'is', null)
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return { status: 'success', body: data.body, deliveredAt: data.delivered_at };
}
