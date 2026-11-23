import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_DURATION_MS,
  voiceTranscriptionHeadersSchema,
} from '@/lib/validation/voice';
import { getAudioDurationMs } from '@/server/ai/audio-duration';
import { VoiceProviderError, transcribeAudio } from '@/server/ai/voice';
import { checkChatRateLimit } from '@/server/rate-limit';
import { checkVoiceTranscriptionRateLimit } from '@/server/voice-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fail = (error: string, status: number, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const AUDIO_TYPES = new Set(['audio/wav']);

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      return fail('forbidden', 403);
    }
    if (originHost !== request.headers.get('host')) return fail('forbidden', 403);
  }

  if (request.headers.get('x-voice-consent') !== 'accepted') return fail('consent_required', 400);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized', 401);

  const attemptLimit = checkVoiceTranscriptionRateLimit(user.id);
  if (!attemptLimit.allowed) {
    return fail('rate_limited', 429, { 'Retry-After': String(attemptLimit.retryAfterSeconds) });
  }

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const chatLimit = await checkChatRateLimit(supabase, user.id, profile?.plan);
  if (!chatLimit.allowed) {
    if (chatLimit.reason === 'unavailable') return fail('rate_limit_unavailable', 503);
    return fail('rate_limited', 429, { 'Retry-After': String(chatLimit.retryAfterSeconds) });
  }

  if (!process.env.LLM_API_KEY) return fail('not_configured', 503);

  const mimeType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (!mimeType || !AUDIO_TYPES.has(mimeType)) return fail('unsupported_media', 415);

  const parsedHeaders = voiceTranscriptionHeadersSchema.safeParse({
    language: request.headers.get('x-voice-language'),
    durationMs: request.headers.get('x-voice-duration-ms'),
  });
  if (!parsedHeaders.success) return fail('invalid_request', 400);

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_VOICE_AUDIO_BYTES) {
    return fail('audio_too_large', 413);
  }
  if (!request.body) return fail('invalid_request', 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_VOICE_AUDIO_BYTES) {
        await reader.cancel();
        return fail('audio_too_large', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (request.signal.aborted) return fail('cancelled', 400);
    console.error('[voice] audio read failed', error instanceof Error ? error.name : 'unknown');
    return fail('invalid_request', 400);
  }

  if (totalBytes === 0) return fail('empty_audio', 400);

  try {
    const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const actualDurationMs = getAudioDurationMs(audio, mimeType);
    if (actualDurationMs === null) return fail('duration_unverified', 415);
    if (actualDurationMs > MAX_VOICE_DURATION_MS) return fail('duration_too_long', 413);
    if (Math.abs(actualDurationMs - parsedHeaders.data.durationMs) > 2000) {
      return fail('invalid_request', 400);
    }

    const text = await transcribeAudio({
      audio,
      mimeType,
      language: parsedHeaders.data.language,
      signal: request.signal,
    });
    return Response.json({ text }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (request.signal.aborted) return fail('cancelled', 400);
    const code = error instanceof VoiceProviderError ? error.code : 'upstream';
    const status = code === 'provider_rate_limited' ? 429 : code === 'not_configured' ? 503 : 502;
    console.error('[voice] transcription failed', {
      code,
      status: error instanceof VoiceProviderError ? error.status : undefined,
    });
    return fail(code, status);
  }
}
