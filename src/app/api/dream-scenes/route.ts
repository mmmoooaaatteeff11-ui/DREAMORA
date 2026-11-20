import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dreamSceneRequestSchema } from '@/lib/validation/dream-scene';
import { checkDreamSceneRateLimit } from '@/server/rate-limit';
import { AiProviderError } from '@/server/ai/provider';
import {
  DreamSceneOutputError,
  generateDreamScene,
  type GeneratedDreamScene,
} from '@/server/ai/dream-scenes';
import { crisisResponse, detectCrisis, pickLanguage } from '@/server/ai/crisis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const encoder = new TextEncoder();

type SceneEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'complete';
      runId: string;
      sceneNumber: number;
      sceneText: string;
      choices: string[];
      firstStep: string;
    }
  | { type: 'crisis'; text: string }
  | { type: 'error'; code: string }
  | { type: 'done' };

const sse = (event: SceneEvent) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
const fail = (error: string, status: number, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers });

function eventStream(events: SceneEvent[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(sse(event));
      controller.close();
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

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_request', 400);
  }
  const parsed = dreamSceneRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_request', 400);

  const { data } = parsed;
  const locale = data.locale ?? 'ar';
  const safetyText = data.action === 'start' ? data.goal : data.choice;

  if (detectCrisis(safetyText)) {
    return eventStream([
      { type: 'crisis', text: crisisResponse(pickLanguage(safetyText, locale)) },
      { type: 'done' },
    ]);
  }
  if (!process.env.LLM_API_KEY) return fail('not_configured', 503);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('[dream-scenes] profile query failed', profileError.code);
    return fail('service_unavailable', 503);
  }

  const limit = await checkDreamSceneRateLimit(supabase, user.id, profile?.plan);
  if (!limit.allowed) {
    if (limit.reason === 'unavailable') return fail('rate_limit_unavailable', 503);
    return fail('rate_limited', 429, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  let runId: string;
  let sceneNumber: number;
  let dream: string;
  let previousScene: string | undefined;
  let selectedChoice: string | null;

  if (data.action === 'start') {
    runId = randomUUID();
    sceneNumber = 1;
    dream = data.goal;
    selectedChoice = null;
  } else {
    const { data: previous, error: previousError } = await supabase
      .from('dream_scene_turns')
      .select('run_id, scene_number, dream, scene_text')
      .eq('user_id', user.id)
      .eq('run_id', data.runId)
      .order('scene_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) {
      console.error('[dream-scenes] continuation query failed', previousError.code);
      return fail('service_unavailable', 503);
    }
    if (!previous) return fail('not_found', 404);

    runId = previous.run_id;
    sceneNumber = previous.scene_number + 1;
    dream = previous.dream;
    previousScene = previous.scene_text;
    selectedChoice = data.choice;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SceneEvent) => {
        try {
          controller.enqueue(sse(event));
        } catch {
          // The client may have disconnected while generation was in progress.
        }
      };

      let generated: GeneratedDreamScene;
      try {
        generated = await generateDreamScene({
          goal: dream,
          previousScene,
          choice: selectedChoice ?? undefined,
          locale,
          signal: request.signal,
          onDelta: (text) => send({ type: 'delta', text }),
        });
      } catch (error) {
        const code =
          error instanceof AiProviderError
            ? error.code
            : error instanceof DreamSceneOutputError
              ? 'invalid_output'
              : request.signal.aborted
                ? 'cancelled'
                : 'upstream';
        if (!request.signal.aborted) {
          console.error('[dream-scenes] generation failed', {
            code,
            status: error instanceof AiProviderError ? error.status : undefined,
          });
          send({ type: 'error', code });
        }
        send({ type: 'done' });
        try {
          controller.close();
        } catch {
          // The client may have disconnected.
        }
        return;
      }

      try {
        const { error } = await supabase.from('dream_scene_turns').insert({
          user_id: user.id,
          run_id: runId,
          scene_number: sceneNumber,
          dream,
          selected_choice: selectedChoice,
          scene_text: generated.sceneText,
          choices: generated.choices,
          first_step: generated.firstStep,
        });

        if (error) {
          console.error('[dream-scenes] scene save failed', error.code);
          send({ type: 'error', code: 'save_failed' });
        } else {
          send({
            type: 'complete',
            runId,
            sceneNumber,
            sceneText: generated.sceneText,
            choices: generated.choices,
            firstStep: generated.firstStep,
          });
        }
      } catch (error) {
        console.error('[dream-scenes] persistence failed', error instanceof Error ? error.name : 'unknown');
        send({ type: 'error', code: 'save_failed' });
      }

      send({ type: 'done' });
      try {
        controller.close();
      } catch {
        // The client may have disconnected.
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
