import { NextResponse } from 'next/server';
import { processCampaigns } from '@/lib/campaigns/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel Cron (every 10 min): sends one batch per in-flight campaign. `Authorization: Bearer $CRON_SECRET`. */
export const GET = withApi('/api/cron/campaigns', async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await processCampaigns();
  return NextResponse.json({ ok: true, ...result });
});
