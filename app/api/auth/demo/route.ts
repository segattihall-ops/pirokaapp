import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authMode } from '@/lib/auth/mode';
import { demoSignIn, signOutServer } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signin'), provider: z.enum(['google', 'anonymous']) }),
  z.object({ action: z.literal('magic'), email: z.string().email() }),
  z.object({ action: z.literal('password'), email: z.string().email(), password: z.string().min(6) }),
  z.object({ action: z.literal('signout') }),
]);

/** Demo-mode auth. Refuses to run when Supabase is configured. */
export async function POST(req: Request) {
  if (authMode() !== 'demo') return NextResponse.json({ error: 'Demo auth is disabled' }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const b = parsed.data;
  if (b.action === 'signout') {
    await signOutServer();
    return NextResponse.json({ session: null });
  }
  if (b.action === 'signin') return NextResponse.json({ session: await demoSignIn(b.provider) });
  // Magic link and password: demo signs in immediately (no email is sent).
  return NextResponse.json({ session: await demoSignIn('email', b.email) });
}
