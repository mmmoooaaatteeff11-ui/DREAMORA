import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const PER_HOUR: Record<string, number> = { free: 30, premium: 100, pro: 200 };
const PER_MINUTE = 6;

export type RateLimitResult =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; reason: 'limited'; retryAfterSeconds: number }
  | { allowed: false; reason: 'unavailable' };

function hourLimitFor(plan: string | null | undefined): number {
  return PER_HOUR[plan ?? 'free'] ?? PER_HOUR.free;
}

async function getCompletedChatTurns(
  supabase: SupabaseClient,
  userId: string,
  since: string,
  hourLimit: number,
): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, role, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit((hourLimit + 1) * 2);

  if (error || !data) {
    console.error('[chat] rate-limit query failed', error?.code ?? 'no data');
    return null;
  }

  const pendingUsers = new Map<string, number[]>();
  const completedUserTimes: number[] = [];
  for (const row of [...data].reverse()) {
    const timestamp = new Date(row.created_at).getTime();
    const pending = pendingUsers.get(row.conversation_id) ?? [];

    if (row.role === 'user') {
      pending.push(timestamp);
      pendingUsers.set(row.conversation_id, pending);
    } else if (row.role === 'assistant' && pending.length > 0) {
      const userTimestamp = pending.shift();
      if (userTimestamp !== undefined && timestamp >= userTimestamp) completedUserTimes.push(userTimestamp);
    }
  }
  return completedUserTimes;
}

function evaluateRateLimit(times: number[], hourLimit: number, now: number): RateLimitResult {
  const sortedTimes = times.sort((a, b) => b - a);
  const lastMinute = sortedTimes.filter((timestamp) => now - timestamp < 60 * 1000);
  if (lastMinute.length >= PER_MINUTE) {
    const oldest = Math.min(...lastMinute);
    return {
      allowed: false,
      reason: 'limited',
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000)),
    };
  }

  if (sortedTimes.length >= hourLimit) {
    const oldestInWindow = Math.min(...sortedTimes);
    return {
      allowed: false,
      reason: 'limited',
      retryAfterSeconds: Math.max(1, Math.ceil((oldestInWindow + 60 * 60 * 1000 - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkChatRateLimit(
  supabase: SupabaseClient,
  userId: string,
  plan: string | null | undefined,
): Promise<RateLimitResult> {
  const now = Date.now();
  const turns = await getCompletedChatTurns(
    supabase,
    userId,
    new Date(now - 60 * 60 * 1000).toISOString(),
    hourLimitFor(plan),
  );
  if (!turns) return { allowed: false, reason: 'unavailable' };
  return evaluateRateLimit(turns, hourLimitFor(plan), now);
}

export async function checkDreamSceneRateLimit(
  supabase: SupabaseClient,
  userId: string,
  plan: string | null | undefined,
): Promise<RateLimitResult> {
  const now = Date.now();
  const hourLimit = hourLimitFor(plan);
  const since = new Date(now - 60 * 60 * 1000).toISOString();
  const [chatTurns, sceneResult] = await Promise.all([
    getCompletedChatTurns(supabase, userId, since, hourLimit),
    supabase
      .from('dream_scene_turns')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(hourLimit + 1),
  ]);

  if (chatTurns === null || sceneResult.error || !sceneResult.data) {
    console.error('[dream-scenes] rate-limit query failed', sceneResult.error?.code ?? 'no data');
    return { allowed: false, reason: 'unavailable' };
  }

  return evaluateRateLimit(
    [...chatTurns, ...sceneResult.data.map((row) => new Date(row.created_at).getTime())],
    hourLimit,
    now,
  );
}
