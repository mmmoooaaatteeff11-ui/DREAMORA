import { z } from 'zod';

const localeSchema = z.enum(['ar', 'en']).optional();

export const dreamSceneRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    goal: z.string().trim().min(1).max(2000),
    locale: localeSchema,
  }),
  z.object({
    action: z.literal('continue'),
    runId: z.string().uuid(),
    choice: z.string().trim().min(1).max(1000),
    locale: localeSchema,
  }),
]);
