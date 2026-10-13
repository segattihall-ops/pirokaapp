import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';

export const SEGMENTS = [
  { key: 'all', label: 'Everyone with an email' },
  { key: 'free', label: 'Free plan' },
  { key: 'plus', label: 'Plus' },
  { key: 'premium', label: 'Premium' },
  { key: 'paid', label: 'Plus + Premium' },
  { key: 'new_7d', label: 'Joined in the last 7 days' },
  { key: 'inactive_7d', label: 'Inactive 7+ days' },
  { key: 'inactive_30d', label: 'Inactive 30+ days' },
  { key: 'cancelled', label: 'Cancelled a subscription' },
] as const;
export type Segment = (typeof SEGMENTS)[number]['key'];
export const isSegment = (s: unknown): s is Segment => SEGMENTS.some((x) => x.key === s);

export type Campaign = {
  id: string;
  subject: string;
  body: string;
  segment: Segment;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function segmentCount(segment: Segment): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin.rpc('campaign_segment_count', { p_segment: segment });
  if (error) {
    console.error('campaign_segment_count', error.message);
    return 0;
  }
  return Number(data ?? 0);
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(100);
  return (data ?? []) as Campaign[];
}

const BATCH = 100;
const CONCURRENCY = 5;

/**
 * One cron tick: promote due `scheduled` campaigns to `sending`, then push one batch for every
 * `sending` campaign. Recipients are chosen by SQL excluding anyone already in email_log for the
 * campaign, so retries never double-send. Returns what happened for the cron log.
 */
export async function processCampaigns(): Promise<{ promoted: number; sent: number; failed: number; finished: number }> {
  const out = { promoted: 0, sent: 0, failed: 0, finished: 0 };
  if (!supabaseAdmin) return out;
  const db = supabaseAdmin;
  const nowIso = new Date().toISOString();

  const { data: due } = await db.from('email_campaigns').select('id, segment').eq('status', 'scheduled').lte('scheduled_at', nowIso).limit(10);
  for (const c of due ?? []) {
    const total = await segmentCount(c.segment as Segment);
    const { error } = await db
      .from('email_campaigns')
      .update({ status: 'sending', started_at: nowIso, total_count: total, updated_at: nowIso })
      .eq('id', c.id)
      .eq('status', 'scheduled');
    if (!error) out.promoted += 1;
  }

  const { data: sending } = await db.from('email_campaigns').select('*').eq('status', 'sending').limit(5);
  for (const c of (sending ?? []) as Campaign[]) {
    const { data: recipients, error } = await db.rpc('campaign_recipients', { p_campaign: c.id, p_segment: c.segment, p_limit: BATCH });
    if (error) {
      console.error('campaign_recipients', error.message);
      continue;
    }
    const rows = (recipients ?? []) as { id: string; email: string; handle: string | null }[];
    if (rows.length === 0) {
      await db
        .from('email_campaigns')
        .update({ status: 'sent', finished_at: nowIso, updated_at: nowIso })
        .eq('id', c.id);
      out.finished += 1;
      continue;
    }
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const slice = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map((r) =>
          sendEmail({
            to: r.email,
            userId: r.id,
            template: 'campaign',
            campaignId: c.id,
            marketing: true,
            unsubscribeUrl: unsubscribeUrl(r.id),
            ...templates.campaign(c.subject, c.body, unsubscribeUrl(r.id)),
          }),
        ),
      );
      for (const r of results) (r.ok ? (sent += 1) : (failed += 1));
    }
    await db
      .from('email_campaigns')
      .update({ sent_count: c.sent_count + sent, failed_count: c.failed_count + failed, updated_at: nowIso })
      .eq('id', c.id);
    out.sent += sent;
    out.failed += failed;
  }
  return out;
}

/** Preview/test: render the campaign for one address, bypassing opt-out and the log's campaign dedupe. */
export async function sendTest(c: Pick<Campaign, 'subject' | 'body'>, to: string, userId: string) {
  return sendEmail({ to, userId, template: 'campaign_test', ...templates.campaign(c.subject, c.body, unsubscribeUrl(userId)) });
}
