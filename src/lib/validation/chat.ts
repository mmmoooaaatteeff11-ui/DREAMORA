import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 2000;

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  conversationId: z.string().uuid().nullish(),
  locale: z.enum(['ar', 'en']).optional(),
});
