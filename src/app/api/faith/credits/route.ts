import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => Response.json({ error }, { status });
const claimResultSchema = z.array(z.object({ awarded: z.boolean(), balance: z.number().int().nonnegative() }));

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized', 401);

  const { data, error } = await supabase
    .from('credit_accounts')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.error('[faith-credits] balance read failed', error.code);
    return fail('service_unavailable', 503);
  }

  return Response.json(
    { balance: data?.balance ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail('forbidden', 403);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized', 401);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('claim_daily_app_credit', { claimant_id: user.id });
    if (error) {
      console.error('[faith-credits] daily claim failed', error.code);
      return fail('service_unavailable', 503);
    }

    const parsed = claimResultSchema.safeParse(data);
    const result = parsed.success ? parsed.data[0] : undefined;
    if (!result) {
      console.error('[faith-credits] daily claim returned an invalid result');
      return fail('service_unavailable', 503);
    }

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[faith-credits] daily claim unavailable', error instanceof Error ? error.name : 'unknown');
    return fail('service_unavailable', 503);
  }
}
