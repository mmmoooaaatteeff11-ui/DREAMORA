import { z } from 'zod';

export const MAX_VOICE_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_DURATION_MS = 60_000;
export const MAX_VOICE_SPEECH_LENGTH = 4000;

export const voiceLanguageSchema = z.enum(['auto', 'ar', 'en']);
export type VoiceLanguage = z.infer<typeof voiceLanguageSchema>;

export const voiceTranscriptionHeadersSchema = z.object({
  language: voiceLanguageSchema,
  durationMs: z.coerce.number().int().min(250).max(MAX_VOICE_DURATION_MS),
});
