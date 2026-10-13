'use client';

/**
 * Browser error reporter. Posts uncaught errors and rejections to /api/errors/report (deduped
 * server-side). Keeps the last few messages in memory to avoid reporting the same thing in a loop.
 */

const recent = new Map<string, number>();

export function reportClientError(message: string, stack?: string, extra?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const key = `${message}|${(stack ?? '').slice(0, 80)}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 30_000) return;
  recent.set(key, now);
  if (recent.size > 50) recent.clear();
  const body = JSON.stringify({
    message: message.slice(0, 1000),
    stack: stack?.slice(0, 4000),
    path: window.location.pathname,
    extra,
  });
  fetch('/api/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

let installed = false;
export function installClientErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => {
    const err = ev.error as Error | undefined;
    reportClientError(ev.message || 'Uncaught error', err?.stack, { filename: ev.filename, line: ev.lineno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    const err = r instanceof Error ? r : new Error(typeof r === 'string' ? r : 'Unhandled rejection');
    reportClientError(err.message, err.stack, { kind: 'unhandledrejection' });
  });
}
