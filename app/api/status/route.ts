import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/status/server';

export const dynamic = 'force-dynamic';

/** Public status JSON. Safe to expose: states and labels only, never configuration values. */
export async function GET() {
  const status = await getSystemStatus();
  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
