import { NextResponse } from 'next/server';
import { signOutServer } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  await signOutServer();
  return NextResponse.json({ ok: true });
}
