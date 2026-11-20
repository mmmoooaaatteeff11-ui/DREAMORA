import { z } from 'zod';
import { PRAYER_KEYS } from '@/lib/faith/prayer-times';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const adhkarSchema = z.object({
  morning1: z.number().int().min(0).max(1),
  morning2: z.number().int().min(0).max(1),
  evening1: z.number().int().min(0).max(1),
  evening2: z.number().int().min(0).max(1),
  post1: z.number().int().min(0).max(3),
  post2: z.number().int().min(0).max(1),
}).strict();

export const faithProgressSchema = z
  .object({
    date: dateSchema,
    prayers: z.array(z.enum(PRAYER_KEYS)).max(PRAYER_KEYS.length).refine((values) => new Set(values).size === values.length),
    adhkar: adhkarSchema,
    tasbeehCount: z.number().int().min(0).max(100),
    quranPages: z.number().int().min(0).max(604),
  })
  .strict();

export type FaithProgress = z.infer<typeof faithProgressSchema>;
