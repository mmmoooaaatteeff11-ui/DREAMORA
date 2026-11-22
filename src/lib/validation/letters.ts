import { z } from 'zod';
import { isDateKey } from '@/lib/letters/date';

const dateKeySchema = z.string().refine(isDateKey);

const letterFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().min(1).max(10000).refine((value) => value.trim().length > 0),
    deliver_on: dateKeySchema,
  })
  .strict();

export const createLetterSchema = letterFieldsSchema;
export const updateLetterSchema = letterFieldsSchema.extend({
  id: z.string().uuid(),
});
export const letterIdSchema = z.object({ id: z.string().uuid() }).strict();

export type WaitingLetter = {
  id: string;
  title: string;
  deliver_on: string;
};

export type ArrivedLetter = WaitingLetter & {
  delivered_at: string | null;
};

export type LetterDraft = {
  id: string;
  title: string;
  body: string;
  deliver_on: string;
};
