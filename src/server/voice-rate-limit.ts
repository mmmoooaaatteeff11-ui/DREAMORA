import 'server-only';

const attemptsByUser = new Map<string, number[]>();
const PER_MINUTE = 5;
const PER_HOUR = 20;

export function checkVoiceTranscriptionRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const previous = attemptsByUser.get(userId) ?? [];
  const recent = previous.filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  const lastMinute = recent.filter((timestamp) => now - timestamp < 60 * 1000);
  const limitedWindow =
    lastMinute.length >= PER_MINUTE
      ? lastMinute
      : recent.length >= PER_HOUR
        ? recent
        : null;

  if (limitedWindow) {
    const oldest = Math.min(...limitedWindow);
    const windowMs = limitedWindow === lastMinute ? 60 * 1000 : 60 * 60 * 1000;
    attemptsByUser.set(userId, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  attemptsByUser.set(userId, [...recent, now]);

  if (attemptsByUser.size > 5000) {
    for (const [key, timestamps] of attemptsByUser) {
      if (timestamps.some((timestamp) => now - timestamp < 60 * 60 * 1000)) continue;
      attemptsByUser.delete(key);
      if (attemptsByUser.size <= 4000) break;
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
