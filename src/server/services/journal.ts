'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createJournalEntrySchema,
  deleteJournalEntrySchema,
  journalListSchema,
  updateJournalEntrySchema,
  type JournalEntry,
} from '@/lib/validation/journal';
import type { ActionState } from '@/types/action';

const PAGE_SIZE = 20;

export type JournalListResult =
  | { status: 'success'; entries: JournalEntry[]; hasMore: boolean }
  | { status: 'error'; code: string };

export async function listJournalEntries(input: unknown): Promise<JournalListResult> {
  const parsed = journalListSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { query, category, offset } = parsed.data;
  let request = supabase
    .from('journal_entries')
    .select('id,title,body,category,tags,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (category !== 'all') request = request.eq('category', category);
  if (query) {
    // It matches WHOLE words as typed (no stemming).
    request = request.textSearch('search_tsv', query, { config: 'simple', type: 'websearch' });
  }

  const { data, error } = await request.range(offset, offset + PAGE_SIZE);
  if (error) return { status: 'error', code: 'load_failed' };

  const rows = (data ?? []) as JournalEntry[];
  return {
    status: 'success',
    entries: rows.slice(0, PAGE_SIZE),
    hasMore: rows.length > PAGE_SIZE,
  };
}

export async function createJournalEntry(input: unknown): Promise<ActionState> {
  const parsed = createJournalEntrySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { error } = await supabase.from('journal_entries').insert({
    user_id: user.id,
    title: parsed.data.title || null,
    body: parsed.data.body,
    category: parsed.data.category,
    tags: parsed.data.tags,
  });
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

export async function updateJournalEntry(input: unknown): Promise<ActionState> {
  const parsed = updateJournalEntrySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { id, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from('journal_entries')
    .update({
      title: fields.title || null,
      body: fields.body,
      category: fields.category,
      tags: fields.tags,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

export async function deleteJournalEntry(input: unknown): Promise<ActionState> {
  const parsed = deleteJournalEntrySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'session_expired' };

  const { data, error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };

  revalidatePath('/', 'layout');
  return { status: 'success' };
}
