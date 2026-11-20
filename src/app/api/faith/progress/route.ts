import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { faithProgressSchema } from '@/lib/validation/faith';

export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => Response.json({ error }, { status });

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return fail('unauthorized', 401);

  const date = request.nextUrl.searchParams.get('date');
  const parsedDate = faithProgressSchema.shape.date.safeParse(date);
  if (!parsedDate.success) return fail('invalid_request', 400);

  const { data, error } = await supabase
    .from('spiritual_daily_progress')
    .select('entry_date, prayer_marks, adhkar_counts, tasbeeh_count, quran_pages')
    .eq('user_id', user.id)
    .eq('entry_date', parsedDate.data)
    .maybeSingle();

  if (error) {
    console.error('[faith] progress read failed', error.code);
    return fail('service_unavailable', 503);
  }
  if (!data) return Response.json({ progress: null }, { headers: { 'Cache-Control': 'no-store' } });

  const validated = faithProgressSchema.safeParse({
    date: data.entry_date,
    prayers: data.prayer_marks,
    adhkar: data.adhkar_counts,
    tasbeehCount: data.tasbeeh_count,
    quranPages: data.quran_pages,
  });
  if (!validated.success) {
    console.error('[faith] stored progress failed validation');
    return fail('service_unavailable', 503);
  }

  return Response.json({ progress: validated.data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail('forbidden', 403);
  const { user } = await getUser();
  if (!user) return fail('unauthorized', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_request', 400);
  }
  const parsed = faithProgressSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_request', 400);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('spiritual_daily_progress').upsert(
      {
        user_id: user.id,
        entry_date: parsed.data.date,
        prayer_marks: parsed.data.prayers,
        adhkar_counts: parsed.data.adhkar,
        tasbeeh_count: parsed.data.tasbeehCount,
        quran_pages: parsed.data.quranPages,
      },
      { onConflict: 'user_id,entry_date' },
    );
    if (error) {
      console.error('[faith] progress write failed', error.code);
      return fail('service_unavailable', 503);
    }
  } catch (error) {
    console.error('[faith] progress write unavailable', error instanceof Error ? error.name : 'unknown');
    return fail('service_unavailable', 503);
  }

  return Response.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return fail('forbidden', 403);
  const { user } = await getUser();
  if (!user) return fail('unauthorized', 401);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('spiritual_daily_progress').delete().eq('user_id', user.id);
    if (error) {
      console.error('[faith] progress deletion failed', error.code);
      return fail('service_unavailable', 503);
    }
  } catch (error) {
    console.error('[faith] progress deletion unavailable', error instanceof Error ? error.name : 'unknown');
    return fail('service_unavailable', 503);
  }

  return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
