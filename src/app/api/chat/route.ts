import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatRequestSchema } from '@/lib/validation/chat';
import { AiProviderError, streamChat, type ChatTurn } from '@/server/ai/provider';
import { crisisResponse, detectCrisis, pickLanguage } from '@/server/ai/crisis';
import { buildSystemPrompt } from '@/server/ai/prompts';
import { checkChatRateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HISTORY_LIMIT = 20;
const encoder = new TextEncoder();

type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'crisis' }
  | { type: 'error'; code: string }
  | { type: 'done' };

const sse = (event: StreamEvent) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
const fail = (error: string, status: number, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers });

export async function POST(request: NextRequest) {
  // CSRF defence in depth (cookies are also SameSite=Lax): only accept same-origin browser calls.
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

  // 1) Authentication: never trust the client.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized', 401);

  // 2) Validation.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_request', 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_request', 400);
  const { message, conversationId } = parsed.data;
  const locale = parsed.data.locale ?? 'ar';

  // 3) Crisis check runs before any LLM call, and works even if the AI is not configured.
  const crisis = detectCrisis(message);
  const crisisLanguage = pickLanguage(message, locale);
  if (!crisis && !process.env.LLM_API_KEY) return fail('not_configured', 503);

  // 4) Profile, preferences, rate limit.
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from('profiles').select('display_name, plan').eq('id', user.id).maybeSingle(),
    supabase.from('user_preferences').select('ai_memory_enabled').eq('user_id', user.id).maybeSingle(),
  ]);

  const limit = await checkChatRateLimit(supabase, user.id, profile?.plan);
  if (!limit.allowed) {
    if (limit.reason === 'unavailable') return fail('rate_limit_unavailable', 503);
    return fail('rate_limited', 429, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  // 5) Conversation: must belong to this user (checked explicitly, on top of RLS).
  let convId = conversationId ?? null;
  if (convId) {
    const { data: existing, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', convId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (conversationError) {
      console.error('[chat] conversation query failed', conversationError.code);
      return fail('service_unavailable', 503);
    }
    if (!existing) return fail('not_found', 404);
    convId = existing.id;
  }

  // 6) History (before adding the new message) and, only with consent, saved memories.
  let history: ChatTurn[] = [];
  if (convId && !crisis) {
    const { data: historyRows, error: historyError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (historyError || !historyRows) {
      console.error('[chat] history query failed', historyError?.code ?? 'no data');
      return fail('service_unavailable', 503);
    }

    history = historyRows.reverse().map((row: { role: string; content: string }) => ({
      role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: row.content,
    }));
  }
  while (history.length > 0 && history[0].role !== 'user') history.shift();

  let memories: string[] = [];
  if (prefs?.ai_memory_enabled === true && !crisis) {
    const { data: memoryRows, error: memoryError } = await supabase
      .from('user_memory')
      .select('content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (memoryError) console.warn('[chat] opted-in memory query failed', memoryError.code);
    memories = (memoryRows ?? []).map((row: { content: string }) => row.content);
  }

  const system = buildSystemPrompt({ locale, displayName: profile?.display_name, memories });
  const turns: ChatTurn[] = [...history, { role: 'user', content: message }];

  // 7) Stream the reply. Persist the user/assistant pair only after a complete response,
  // so failed generations neither appear successful nor consume the user's rate limit.
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(sse(event));
        } catch {
          // Client disconnected; keep going so the reply is still saved.
        }
      };

      let reply = '';
      let failedCode: string | null = null;

      try {
        if (crisis) {
          reply = crisisResponse(crisisLanguage);
          send({ type: 'crisis' });
          send({ type: 'delta', text: reply });
        } else {
          for await (const chunk of streamChat({ system, messages: turns, signal: request.signal })) {
            reply += chunk;
            send({ type: 'delta', text: chunk });
          }
          if (!reply.trim()) throw new AiProviderError('upstream', 'empty reply');
        }
      } catch (error) {
        failedCode = error instanceof AiProviderError ? error.code : 'upstream';
        if (!request.signal.aborted) {
          // Never log message content, prompts, replies, or keys.
          console.error('[chat] generation failed:', {
            code: failedCode,
            status: error instanceof AiProviderError ? error.status : undefined,
          });
          send({ type: 'error', code: failedCode });
        }
      }

      if (!failedCode) {
        let createdConversation = false;
        try {
          if (!convId) {
            const title = crisis
              ? crisisLanguage === 'ar'
                ? 'محادثة دعم'
                : 'Support conversation'
              : message.replace(/\s+/g, ' ').slice(0, 60);
            const { data: created, error } = await supabase
              .from('conversations')
              .insert({ user_id: user.id, title })
              .select('id')
              .single();
            if (error || !created) {
              console.error('[chat] conversation save failed', error?.code ?? 'no data');
              failedCode = 'save_failed';
            } else {
              convId = created.id;
              createdConversation = true;
            }
          }

          if (!failedCode && convId) {
            const createdAt = Date.now();
            const { error } = await supabase.from('messages').insert([
              {
                user_id: user.id,
                conversation_id: convId,
                role: 'user',
                content: message,
                created_at: new Date(createdAt).toISOString(),
              },
              {
                user_id: user.id,
                conversation_id: convId,
                role: 'assistant',
                content: reply.slice(0, 8000),
                created_at: new Date(createdAt + 1).toISOString(),
              },
            ]);

            if (error) {
              console.error('[chat] message save failed', error.code);
              failedCode = 'save_failed';
              if (createdConversation) {
                const { error: cleanupError } = await supabase
                  .from('conversations')
                  .delete()
                  .eq('id', convId)
                  .eq('user_id', user.id);
                if (cleanupError) console.error('[chat] empty conversation cleanup failed', cleanupError.code);
              }
            } else {
              const { error: updateError } = await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', convId)
                .eq('user_id', user.id);
              if (updateError) console.error('[chat] conversation timestamp update failed', updateError.code);
              send({ type: 'meta', conversationId: convId });
            }
          }
        } catch (error) {
          failedCode = 'save_failed';
          console.error('[chat] persistence request failed', error instanceof Error ? error.name : 'unknown');
        }

        if (failedCode) send({ type: 'error', code: failedCode });
      }

      send({ type: 'done' });
      try {
        controller.close();
      } catch {
        // The client may have disconnected after receiving the final event.
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
