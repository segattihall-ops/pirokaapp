import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().trim().email().max(120).or(z.literal('')) });

/** Where receipts go. Empty clears it (falls back to the account email). */
export async function PATCH(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  await ensureUserRow(g.session);
  const { error } = await supabaseAdmin!
    .from('users')
    .update({ billing_email: parsed.data.email || null })
    .eq('id', g.session.userId);
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('041_billing_v2'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, billingEmail: parsed.data.email || null });
}
