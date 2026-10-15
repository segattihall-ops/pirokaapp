import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/app-url';
import type { AgeMethod, AgeResult } from './index';

/**
 * Didit age verification (API v3).
 *
 * Two workflows, both built in the Didit console:
 *  - DIDIT_WORKFLOW_ID: selfie age estimation; clear adults pass, anyone near the threshold or
 *    inconclusive is routed to ID document + face match inside the same session.
 *  - DIDIT_ID_WORKFLOW_ID: ID document + face match only. Used when an admin forces a re-check
 *    (e.g. an account reported as underage).
 *
 * Only the pass/fail and the method ever reach our storage. The user id travels as `vendor_data`
 * so a session can never be credited to a different account.
 */

const API = 'https://verification.didit.me/v3/session';

export type DiditMode = 'standard' | 'id';

export function diditConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID);
}

function workflowFor(mode: DiditMode): string | undefined {
  return mode === 'id'
    ? process.env.DIDIT_ID_WORKFLOW_ID || process.env.DIDIT_WORKFLOW_ID
    : process.env.DIDIT_WORKFLOW_ID;
}

function allowedWorkflows(): Set<string> {
  return new Set([process.env.DIDIT_WORKFLOW_ID, process.env.DIDIT_ID_WORKFLOW_ID].filter(Boolean) as string[]);
}

export async function createDiditSession(
  userId: string,
  mode: DiditMode,
): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; reason: string }> {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = workflowFor(mode);
  if (!apiKey || !workflowId) return { ok: false, reason: 'Didit is not configured' };

  const res = await fetch(`${API}/`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: userId,
      callback: appUrl('/age/return'),
      metadata: { mode },
    }),
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, reason: 'Could not start the age check' };
  const j = (await res.json()) as { session_id?: string; url?: string };
  return j.session_id && j.url
    ? { ok: true, sessionId: j.session_id, url: j.url }
    : { ok: false, reason: 'Could not start the age check' };
}

type Decision = {
  status?: string;
  vendor_data?: string;
  workflow_id?: string;
  id_verifications?: { status?: string }[] | null;
};

export async function fetchDiditDecision(sessionId: string): Promise<Decision | null> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const res = await fetch(`${API}/${sessionId}/decision/`, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as Decision) : null;
}

/** Approved, ours, and for this user. The method is 'id' when a document step was approved. */
export function evaluateDecision(d: Decision | null, userId: string): AgeResult {
  if (!d) return { ok: false, reason: 'Could not confirm the age check' };
  if (!d.workflow_id || !allowedWorkflows().has(d.workflow_id))
    return { ok: false, reason: 'Age check does not match this app' };
  if (d.vendor_data !== userId) return { ok: false, reason: 'Age check belongs to another account' };
  if (d.status === 'In Review') return { ok: false, reason: 'Your age check is being reviewed' };
  if (d.status !== 'Approved') return { ok: false, reason: 'Age check not approved' };
  const method: AgeMethod = (d.id_verifications ?? []).some((v) => v?.status === 'Approved') ? 'id' : 'face';
  return { ok: true, method };
}

export async function verifyDidit(sessionId: string, userId: string): Promise<AgeResult> {
  return evaluateDecision(await fetchDiditDecision(sessionId), userId);
}

/** Writes the gate facts for a user who is not the current requester (webhook path). */
export async function markAgeVerified(userId: string, method: AgeMethod): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { age_verified: true, age_method: method, age_recheck: false },
  });
  if (error) console.error('markAgeVerified', error.message);
  return !error;
}

/** Whether an admin has demanded an ID-only re-check for this user. */
export async function needsIdRecheck(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.app_metadata?.age_recheck === true;
}

// ---------- webhook signature (X-Signature-V2, falling back to raw-body X-Signature) ----------

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

function hexEqual(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyDiditWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  const ts = Number(headers.get('x-timestamp'));
  if (!secret || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const v2 = headers.get('x-signature-v2');
  if (v2) {
    try {
      const canonical = JSON.stringify(sortKeys(JSON.parse(rawBody)));
      if (hexEqual(createHmac('sha256', secret).update(canonical, 'utf8').digest('hex'), v2)) return true;
    } catch {
      return false;
    }
  }
  const raw = headers.get('x-signature');
  return Boolean(raw && hexEqual(createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'), raw));
}
