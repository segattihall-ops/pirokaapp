import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import type { EventName } from './events';

/**
 * Server-side product analytics. Writes `analytics_events` and, when POSTHOG_KEY is set, mirrors the
 * event to PostHog. Fire-and-forget: never throws, never blocks the response for long.
 */

export type TrackInput = {
  userId?: string | null;
  anonId?: string | null;
  event: EventName;
  props?: Record<string, unknown>;
  path?: string | null;
};

const SAFE_PROP = /^[a-zA-Z0-9_.-]{1,48}$/;

function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE_PROP.test(k)) continue;
    if (v === null || typeof v === 'boolean' || typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 200);
  }
  return out;
}

async function forwardToPostHog(input: TrackInput, props: Record<string, unknown>) {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '');
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.userId ?? input.anonId ?? 'anonymous',
        properties: { ...props, $current_url: input.path ?? undefined, source: 'server' },
        timestamp: new Date().toISOString(),
      }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('posthog forward failed', e);
  }
}

export async function track(input: TrackInput): Promise<void> {
  const props = sanitizeProps(input.props);
  const event = String(input.event).slice(0, 64);
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV !== 'production') console.info(`[analytics:console] ${event}`, props);
    return;
  }
  try {
    const { error } = await supabaseAdmin.from('analytics_events').insert({
      user_id: input.userId ?? null,
      anon_id: input.anonId ?? null,
      event,
      props,
      path: input.path?.slice(0, 200) ?? null,
    });
    if (error) console.error('analytics insert failed', error.message);
  } catch (e) {
    console.error('track failed', e);
  }
  void forwardToPostHog({ ...input, event }, props);
}

/** Background variant for route handlers that should not await the write. */
export function trackAsync(input: TrackInput): void {
  void track(input);
}

export function analyticsForwardingConfigured(): boolean {
  return Boolean(process.env.POSTHOG_KEY);
}
