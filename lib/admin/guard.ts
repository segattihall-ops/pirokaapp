import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import type { Session } from '@/lib/auth/types';

/** Route-handler guard: returns the admin session or a ready-to-return error response. */
export async function requireAdmin(): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();
  if (!session?.userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}
