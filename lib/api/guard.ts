import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import type { Session } from '@/lib/auth/types';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** Session + database, or the matching error response. Keeps every route's preamble identical. */
export async function requireUser(): Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const session = await getSession();
  if (!session?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!supabaseAdmin) return { error: NextResponse.json({ error: 'Database not configured' }, { status: 503 }) };
  return { session };
}
