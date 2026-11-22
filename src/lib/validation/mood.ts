import { z } from 'zod';

export const MOOD_OPTIONS = [
  { key: 'joyful', emoji: '😄', score: 5 },
  { key: 'grateful', emoji: '🙏', score: 5 },
  { key: 'calm', emoji: '😌', score: 4 },
  { key: 'hopeful', emoji: '🌱', score: 4 },
  { key: 'motivated', emoji: '💪', score: 4 },
  { key: 'tired', emoji: '😴', score: 2 },
  { key: 'anxious', emoji: '😟', score: 2 },
  { key: 'sad', emoji: '😔', score: 1 },
  { key: 'angry', emoji: '😠', score: 1 },
  { key: 'lonely', emoji: '🫂', score: 1 },
] as const;

export const moodKeySchema = z.enum([
  'joyful',
  'grateful',
  'calm',
  'hopeful',
  'motivated',
  'tired',
  'anxious',
  'sad',
  'angry',
  'lonely',
]);

export type MoodKey = z.infer<typeof moodKeySchema>;

export const moodScoreByKey: Record<MoodKey, number> = Object.fromEntries(
  MOOD_OPTIONS.map(({ key, score }) => [key, score]),
) as Record<MoodKey, number>;

export const saveMoodSchema = z
  .object({
    moodKey: moodKeySchema,
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const moodHistoryRowSchema = z
  .object({
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mood: z.number().int().min(1).max(5),
    mood_key: moodKeySchema.nullable(),
    note: z.string().max(1000).nullable(),
  })
  .strict();

export type MoodHistoryEntry = {
  entryDate: string;
  mood: number;
  moodKey: MoodKey | null;
};
