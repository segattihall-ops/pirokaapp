import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Fixed-window rate limit. Postgres-backed (`rate_limit_hit`) so it holds across serverless
 * instances; falls back to a per-instance map when the database is absent (demo).
 */

const local = new Map<string, { count: number; start: number }>();

export async function rateLimit(key: string, limit: number, windowSecs: number): Promise<boolean> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_secs: windowSecs,
    });
    if (!error && typeof data === 'boolean') return data;
    if (error) console.error('rate_limit_hit failed', error.message);
  }
  const now = Date.now();
  const e = local.get(key);
  if (!e || now - e.start > windowSecs * 1000) {
    local.set(key, { count: 1, start: now });
    if (local.size > 5000) local.clear();
    return true;
  }
  e.count += 1;
  return e.count <= limit;
}

/** Best-effort client identity for unauthenticated endpoints. */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown').trim();
}

export const tooMany = () => NextResponse.json({ error: 'Too many requests' }, { status: 429 });
