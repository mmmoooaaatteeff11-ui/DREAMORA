import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type CreditReservation = {
  reservation_id: string | null;
  allowed: boolean;
  reason: string;
  source: string | null;
  cost: number;
  duplicate: boolean;
};

const serverErrorReservation: CreditReservation = {
  reservation_id: null,
  allowed: false,
  reason: 'server_error',
  source: null,
  cost: 0,
  duplicate: false,
};

export async function reserveCredits(
  userId: string,
  feature: string,
  key: string,
  model = '*',
): Promise<CreditReservation> {
  try {
    const { data, error } = await createAdminClient().rpc('reserve_credits', {
      p_user: userId,
      p_feature: feature,
      p_key: key,
      p_model: model,
    });
    if (error || !Array.isArray(data)) return serverErrorReservation;

    const row = data[0] as Partial<CreditReservation> | undefined;
    if (
      !row ||
      typeof row.allowed !== 'boolean' ||
      typeof row.reason !== 'string' ||
      typeof row.cost !== 'number' ||
      typeof row.duplicate !== 'boolean' ||
      (row.reservation_id !== null && typeof row.reservation_id !== 'string') ||
      (row.source !== null && typeof row.source !== 'string')
    ) {
      return serverErrorReservation;
    }

    return {
      reservation_id: row.reservation_id ?? null,
      allowed: row.allowed,
      reason: row.reason,
      source: row.source ?? null,
      cost: row.cost,
      duplicate: row.duplicate,
    };
  } catch {
    return serverErrorReservation;
  }
}

export async function commitCredits(reservationId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('commit_credits', {
      p_reservation: reservationId,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function refundCredits(reservationId: string, note?: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('refund_credits', {
      p_reservation: reservationId,
      p_note: note ?? null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
