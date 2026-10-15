import 'server-only';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { opsAlert } from '@/lib/alerts/server';

/**
 * Error tracking. `captureError` dedupes by fingerprint into `error_events` (count + last_seen) and,
 * when SENTRY_DSN is set, forwards the event to Sentry's envelope endpoint. `withApi` wraps a route
 * handler so an uncaught throw becomes a logged 500 instead of an opaque crash.
 */

export type Severity = 'info' | 'warning' | 'error' | 'fatal';

export type CaptureContext = {
  route?: string;
  userId?: string | null;
  source?: 'server' | 'client';
  severity?: Severity;
  extra?: Record<string, unknown>;
};

export function fingerprintOf(message: string, stack: string | undefined, route: string | undefined): string {
  // First stack frame + message + route: stable across requests, distinct per bug.
  const frame =
    (stack ?? '')
      .split('\n')
      .find((l) => /^\s+at /.test(l))
      ?.trim() ?? '';
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<uuid>')
    .replace(/\d{3,}/g, '<n>')
    .slice(0, 300);
  return createHash('sha1')
    .update(`${route ?? ''}|${normalized}|${frame}`)
    .digest('hex')
    .slice(0, 24);
}

function parseDsn(dsn: string) {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '');
    if (!u.username || !projectId) return null;
    return { key: u.username, host: `${u.protocol}//${u.host}`, projectId };
  } catch {
    return null;
  }
}

async function forwardToSentry(err: Error, ctx: CaptureContext, fingerprint: string) {
  const dsn = process.env.SENTRY_DSN && parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;
  const eventId = fingerprint.padEnd(32, '0').slice(0, 32);
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: ctx.severity ?? 'error',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    transaction: ctx.route,
    user: ctx.userId ? { id: ctx.userId } : undefined,
    fingerprint: [fingerprint],
    extra: ctx.extra,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split('\n')
                  .filter((l) => /^\s+at /.test(l))
                  .reverse()
                  .map((l) => ({ function: l.trim().replace(/^at\s+/, '') })),
              }
            : undefined,
        },
      ],
    },
  };
  const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  try {
    await fetch(`${dsn.host}/api/${dsn.projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=piroka/1.0`,
      },
      body: envelope,
      cache: 'no-store',
    });
  } catch (e) {
    console.error('sentry forward failed', e);
  }
}

const ALERT_AT = new Set([10, 50, 100, 500]);

export async function captureError(error: unknown, ctx: CaptureContext = {}): Promise<string> {
  const err =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  const fingerprint = fingerprintOf(err.message, err.stack, ctx.route);
  console.error(`[error ${fingerprint}] ${ctx.route ?? ''}`, err);

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.rpc('record_error_event', {
        p_fingerprint: fingerprint,
        p_message: err.message || err.name,
        p_stack: err.stack ?? null,
        p_source: ctx.source ?? 'server',
        p_route: ctx.route ?? null,
        p_user_id: ctx.userId ?? null,
        p_severity: ctx.severity ?? 'error',
      });
      const { data } = await supabaseAdmin
        .from('error_events')
        .select('count')
        .eq('fingerprint', fingerprint)
        .maybeSingle();
      const n = Number(data?.count ?? 0);
      if (n === 1 && (ctx.severity === 'fatal' || ctx.source !== 'client')) {
        void opsAlert('error', `New error in ${ctx.route ?? 'app'}: ${err.message.slice(0, 160)}`);
      } else if (ALERT_AT.has(n)) {
        void opsAlert('error', `Error spike (${n}×) in ${ctx.route ?? 'app'}: ${err.message.slice(0, 160)}`);
      }
    } catch (e) {
      console.error('record_error_event failed', e);
    }
  }
  void forwardToSentry(err, ctx, fingerprint);
  return fingerprint;
}

type Handler<C> = (request: Request, context: C) => Promise<Response> | Response;

/** Wrap a route handler: unexpected throws are captured and answered with a JSON 500 carrying the fingerprint. */
export function withApi<C = unknown>(route: string, handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (e) {
      const id = await captureError(e, { route });
      return NextResponse.json({ error: 'Something went wrong', ref: id }, { status: 500 });
    }
  };
}

export function errorForwardingConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN && parseDsn(process.env.SENTRY_DSN));
}
