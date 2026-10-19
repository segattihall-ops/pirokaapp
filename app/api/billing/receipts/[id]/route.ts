import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { listReceipts } from '@/lib/billing/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A printable receipt (HTML download). Only the owner can fetch it. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { receipts } = await listReceipts(g.session.userId);
  const r = receipts.find((x) => x.id === params.id);
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: u } = await supabaseAdmin!
    .from('users')
    .select('billing_email, email, paypal_payer_email')
    .eq('id', g.session.userId)
    .maybeSingle();
  const to = (u?.billing_email ?? u?.email ?? null) as string | null;
  const amount = `${r.currency === 'USD' ? '$' : `${r.currency} `}${r.amount.toFixed(2)}`;
  const date = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(r.receiptNo)}</title>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:40px auto;color:#111;padding:0 16px">
<h2 style="margin:0 0 4px">πroka receipt</h2>
<p style="margin:0 0 20px;color:#444">${esc(r.receiptNo)}<br>${esc(date)}${to ? `<br>${esc(to)}` : ''}</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">
<tr><td style="padding:6px 0">πroka ${esc(r.plan)} (1 month)</td><td style="text-align:right;padding:6px 0">${amount}</td></tr>
<tr><td style="border-top:1px solid #ccc;padding-top:8px"><b>Total</b></td><td style="border-top:1px solid #ccc;padding-top:8px;text-align:right"><b>${amount}</b></td></tr>
</table>
<p style="color:#666;font-size:12px;margin-top:24px">Status: ${esc(r.status)}${u?.paypal_payer_email ? ` · PayPal ${esc(u.paypal_payer_email)}` : ''}<br>Billed as PRK Digital. No ads, no data sales.</p>
</body></html>`;
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${r.receiptNo}.html"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
