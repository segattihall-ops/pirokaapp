import 'server-only';
import nodemailer from 'nodemailer';
import { DEFAULT_EMAIL_FROM } from '@/lib/contact';
import { supabaseAdmin } from '@/lib/db/client';
import type { EmailContent } from './templates';

/**
 * One door for every email the app sends.
 *   provider: RESEND_API_KEY → Resend HTTP · EMAIL_SERVER → SMTP (nodemailer) · neither → console (demo)
 * Every attempt is written to `email_log`. Marketing mail (`marketing: true`) is skipped for users who
 * opted out; transactional mail always goes. Never throws.
 */

export type EmailProvider = 'resend' | 'smtp' | 'console';

export type SendEmailInput = EmailContent & {
  to: string;
  template: string;
  userId?: string | null;
  campaignId?: string | null;
  marketing?: boolean;
  unsubscribeUrl?: string;
};

export type SendEmailResult = {
  ok: boolean;
  status: 'sent' | 'failed' | 'skipped' | 'console';
  provider: EmailProvider;
  messageId?: string;
  error?: string;
};

const FROM = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;

export function emailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_SERVER) return 'smtp';
  return 'console';
}

export function emailConfigured(): boolean {
  return emailProvider() !== 'console';
}

/** The footer link opens the /unsubscribe page; mail clients POST one-click requests to the API route. */
const oneClickUrl = (pageUrl: string) => pageUrl.replace('/unsubscribe?', '/api/unsubscribe?');

let smtp: nodemailer.Transporter | null = null;
function smtpTransport() {
  if (!smtp && process.env.EMAIL_SERVER) smtp = nodemailer.createTransport(process.env.EMAIL_SERVER);
  return smtp;
}

async function viaResend(input: SendEmailInput): Promise<{ id?: string }> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [{ name: 'template', value: input.template.replace(/[^a-zA-Z0-9_-]/g, '_') }],
      ...(input.unsubscribeUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${oneClickUrl(input.unsubscribeUrl)}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    }),
    cache: 'no-store',
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as { id?: string }) : {};
}

async function viaSmtp(input: SendEmailInput): Promise<{ id?: string }> {
  const t = smtpTransport();
  if (!t) throw new Error('EMAIL_SERVER missing');
  const info = await t.sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.unsubscribeUrl
      ? {
          headers: {
            'List-Unsubscribe': `<${oneClickUrl(input.unsubscribeUrl)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  });
  return { id: info.messageId };
}

async function log(input: SendEmailInput, res: SendEmailResult) {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('email_log')
    .insert({
      user_id: input.userId ?? null,
      to_email: input.to,
      template: input.template,
      subject: input.subject,
      provider: res.provider,
      status: res.status,
      error: res.error ?? null,
      message_id: res.messageId ?? null,
      campaign_id: input.campaignId ?? null,
    })
    .then(({ error }) => error && console.error('email_log insert failed', error.message));
}

async function optedOut(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('users')
    .select('marketing_opt_out, deleted_at')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data?.marketing_opt_out || data?.deleted_at);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = emailProvider();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.to)) {
    return { ok: false, status: 'failed', provider, error: 'invalid recipient' };
  }
  if (input.marketing && input.userId && (await optedOut(input.userId))) {
    const res: SendEmailResult = { ok: false, status: 'skipped', provider, error: 'marketing opt-out' };
    await log(input, res);
    return res;
  }

  let res: SendEmailResult;
  try {
    if (provider === 'resend') {
      const { id } = await viaResend(input);
      res = { ok: true, status: 'sent', provider, messageId: id };
    } else if (provider === 'smtp') {
      const { id } = await viaSmtp(input);
      res = { ok: true, status: 'sent', provider, messageId: id };
    } else {
      console.info(`[email:console] to=${input.to} template=${input.template} subject="${input.subject}"`);
      res = { ok: true, status: 'console', provider };
    }
  } catch (e) {
    res = { ok: false, status: 'failed', provider, error: e instanceof Error ? e.message : String(e) };
    console.error('sendEmail failed', res.error);
  }
  await log(input, res);
  return res;
}

/** Look up the address for a user id; null for anonymous or deleted accounts. */
export async function emailOfUser(userId: string): Promise<{ email: string; handle: string | null } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('users')
    .select('email, handle, deleted_at')
    .eq('id', userId)
    .maybeSingle();
  if (!data?.email || data.deleted_at) return null;
  return { email: data.email as string, handle: (data.handle as string | null) ?? null };
}

/** Has this user already received `template` in the last `withinDays`? Used by lifecycle sends. */
export async function alreadySent(userId: string, template: string, withinDays = 3650): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const since = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { count } = await supabaseAdmin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('template', template)
    .in('status', ['sent', 'console'])
    .gte('created_at', since);
  return (count ?? 0) > 0;
}
