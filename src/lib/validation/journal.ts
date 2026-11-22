import { z } from 'zod';

export const JOURNAL_CATEGORIES = [
  'general',
  'gratitude',
  'dream',
  'reflection',
  'faith',
  'goals',
] as const;

export const journalCategorySchema = z.enum(JOURNAL_CATEGORIES);
export type JournalCategory = z.infer<typeof journalCategorySchema>;

const journalFieldsSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    body: z.string().min(1).max(10000).refine((value) => value.trim().length > 0),
    category: journalCategorySchema,
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  })
  .strict();

export const createJournalEntrySchema = journalFieldsSchema;
export const updateJournalEntrySchema = journalFieldsSchema.extend({
  id: z.string().uuid(),
});
export const deleteJournalEntrySchema = z.object({ id: z.string().uuid() }).strict();

export const journalListSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    category: z.union([journalCategorySchema, z.literal('all')]).default('all'),
    offset: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

export type JournalEntry = {
  id: string;
  title: string | null;
  body: string;
  category: JournalCategory;
  tags: string[];
  created_at: string;
};
