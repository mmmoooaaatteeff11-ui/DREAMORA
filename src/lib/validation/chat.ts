import { z } from 'zod';
import { voiceLanguageSchema } from '@/lib/validation/voice';

export const MAX_MESSAGE_LENGTH = 2000;

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  conversationId: z.string().uuid().nullish(),
  locale: z.enum(['ar', 'en']).optional(),
  requestId: z.string().uuid().optional(),
  voice: z.boolean().optional().default(false),
  voiceConsent: z.boolean().optional().default(false),
  voiceLanguage: voiceLanguageSchema.optional().default('auto'),
}).superRefine((request, context) => {
  if (request.voice && !request.voiceConsent) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['voiceConsent'], message: 'consent_required' });
  }
});
