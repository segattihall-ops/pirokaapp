import { appUrl } from '@/lib/app-url';

/**
 * Every email the app sends. Each template returns subject + html + text so the sender never
 * has to assemble markup. Marketing templates take an `unsubscribeUrl`; transactional ones do not.
 */

export type EmailContent = { subject: string; html: string; text: string };

const GREEN = '#34d399';
const INK = '#070707';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal Markdown-lite for campaign bodies: paragraphs, **bold**, [text](url), line breaks. */
export function markdownLite(src: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" style="color:${GREEN}">$1</a>`)
      .replace(/\n/g, '<br>');
  return src
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${inline(p)}</p>`)
    .join('');
}

export function layout(opts: {
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
  unsubscribeUrl?: string;
}): string {
  const cta = opts.cta
    ? `<p style="margin:22px 0 0"><a href="${opts.cta.url}" style="display:inline-block;background:${GREEN};color:${INK};padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700">${escapeHtml(opts.cta.label)}</a></p>`
    : '';
  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:8px 0 0"><a href="${opts.unsubscribeUrl}" style="color:#888">Unsubscribe from these emails</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#0c0c0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#eaeaea">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="margin:0 0 18px;font-size:18px;font-weight:700"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:#1b1b1b;border:1px solid #333">π</span>&nbsp; πroka</p>
  <div style="background:#141414;border:1px solid #262626;border-radius:16px;padding:22px">
    <h1 style="margin:0 0 12px;font-size:21px;letter-spacing:-0.02em">${escapeHtml(opts.title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#d4d4d4">${opts.bodyHtml}</div>
    ${cta}
  </div>
  <div style="margin-top:18px;font-size:12px;color:#777;line-height:1.5">
    ${opts.footerNote ? `<p style="margin:0 0 8px">${escapeHtml(opts.footerNote)}</p>` : ''}
    <p style="margin:0">πroka · Know who’s ready. · <a href="${appUrl('/help/privacy')}" style="color:#888">Privacy</a></p>
    ${unsub}
  </div>
</div></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;

export const templates = {
  welcome(handle: string | null): EmailContent {
    const name = handle ? `@${handle}` : 'there';
    return {
      subject: 'Welcome to πroka 🌍',
      html: layout({
        title: `Welcome, ${escapeHtml(name)}`,
        bodyHtml:
          p('Your profile is live. Set an intent, see who’s ready near you, and chat end-to-end encrypted.') +
          p('Three things worth doing first: add a photo, turn on push, and read how SafeMeet works.'),
        cta: { label: 'Open the map', url: appUrl('/app/map') },
        footerNote: 'You’re getting this because you just created a πroka account.',
      }),
      text: `Welcome, ${name}!\n\nYour profile is live. Open the map: ${appUrl('/app/map')}`,
    };
  },

  subscribed(plan: string): EmailContent {
    return {
      subject: `You’re on πroka ${plan[0].toUpperCase()}${plan.slice(1)} ✓`,
      html: layout({
        title: `Thanks for going ${escapeHtml(plan)}`,
        bodyHtml:
          p('Your subscription is active. New features unlock right away on every device.') +
          p('You can cancel at any time from your profile; access stays until the end of the billing period.'),
        cta: { label: 'See your plan', url: appUrl('/app/me') },
        footerNote: 'Billing is handled by PayPal. This is a transactional receipt.',
      }),
      text: `Thanks for going ${plan}. Your subscription is active. Manage it at ${appUrl('/app/me')}`,
    };
  },

  receipt(amount: number, currency: string, plan: string, paymentId: string): EmailContent {
    const money = `${currency} ${amount.toFixed(2)}`;
    return {
      subject: `Receipt: ${money} for πroka ${plan}`,
      html: layout({
        title: 'Payment received',
        bodyHtml:
          p(`We received <strong>${escapeHtml(money)}</strong> for your πroka ${escapeHtml(plan)} subscription.`) +
          p(`Reference: <code style="color:#aaa">${escapeHtml(paymentId)}</code>`),
        cta: { label: 'Billing & plan', url: appUrl('/app/me') },
        footerNote: 'Keep this email for your records. Charged via PayPal.',
      }),
      text: `Payment received: ${money} for πroka ${plan}. Reference ${paymentId}.`,
    };
  },

  paymentFailed(day: 0 | 3 | 7): EmailContent {
    const urgency =
      day === 0
        ? 'We couldn’t charge your payment method for πroka.'
        : day === 3
          ? 'Your πroka payment is still failing after 3 days.'
          : 'Last reminder: your πroka plan will downgrade to Free unless payment succeeds.';
    return {
      subject: day === 7 ? 'Final notice: update your payment method' : 'Action needed: your πroka payment failed',
      html: layout({
        title: 'Payment failed',
        bodyHtml:
          p(urgency) +
          p('Update your card or PayPal balance and we’ll retry automatically. Your features stay on while we retry.'),
        cta: { label: 'Fix payment', url: appUrl('/app/me') },
        footerNote: 'Transactional notice about your subscription.',
      }),
      text: `${urgency}\nFix it here: ${appUrl('/app/me')}`,
    };
  },

  cancelled(): EmailContent {
    return {
      subject: 'Your πroka subscription is cancelled',
      html: layout({
        title: 'Cancelled — no further charges',
        bodyHtml:
          p('Your subscription is cancelled. You keep paid features until the end of the current period, then move to Free.') +
          p('Changed your mind? Resubscribe from your profile any time.'),
        cta: { label: 'Your profile', url: appUrl('/app/me') },
      }),
      text: `Your πroka subscription is cancelled. Resubscribe any time at ${appUrl('/app/me')}`,
    };
  },

  accountDeleted(): EmailContent {
    return {
      subject: 'Your πroka account was deleted',
      html: layout({
        title: 'Account deleted',
        bodyHtml:
          p('Everything tied to your account — photos, statuses, chats, favourites — is gone. This can’t be undone.') +
          p('If this wasn’t you, reply to this email immediately.'),
        footerNote: 'Final message about this account.',
      }),
      text: 'Your πroka account was deleted. If this wasn’t you, reply to this email immediately.',
    };
  },

  passwordChanged(): EmailContent {
    return {
      subject: 'Your πroka password was changed',
      html: layout({
        title: 'Password changed',
        bodyHtml:
          p('Your password was just updated and other sessions were signed out.') +
          p('If you didn’t do this, reset your password now and contact support.'),
        cta: { label: 'Reset password', url: appUrl('/account/forgot') },
      }),
      text: `Your πroka password was changed. Not you? Reset it: ${appUrl('/account/forgot')}`,
    };
  },

  reengage(days: 7 | 30, handle: string | null, unsubscribeUrl: string): EmailContent {
    const name = handle ? `@${handle}` : 'there';
    return {
      subject: days === 7 ? 'People near you are ready' : 'We miss you on πroka',
      html: layout({
        title: days === 7 ? `Hey ${escapeHtml(name)}, the map moved` : `Still here for you, ${escapeHtml(name)}`,
        bodyHtml:
          p(
            days === 7
              ? 'It’s been a week. New people set intents near you every day — a 30-second status puts you back on the map.'
              : 'It’s been a month. Your profile is still safe and private. Come see who’s around tonight.',
          ),
        cta: { label: 'Set a status', url: appUrl('/app/map') },
        unsubscribeUrl,
      }),
      text: `Hey ${name}, come back to the map: ${appUrl('/app/map')}\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },

  winback(unsubscribeUrl: string): EmailContent {
    return {
      subject: 'Missing SafeMeet? Come back to Plus',
      html: layout({
        title: 'We’d love to have you back',
        bodyHtml:
          p('You cancelled a few days ago. If something didn’t work, reply and tell us — we read every message.') +
          p('Resubscribing takes one tap and your settings are exactly as you left them.'),
        cta: { label: 'Resubscribe', url: appUrl('/app/me') },
        unsubscribeUrl,
      }),
      text: `Come back to πroka Plus: ${appUrl('/app/me')}\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },

  campaign(subject: string, bodyMarkdown: string, unsubscribeUrl: string): EmailContent {
    return {
      subject,
      html: layout({ title: subject, bodyHtml: markdownLite(bodyMarkdown), unsubscribeUrl }),
      text: `${subject}\n\n${bodyMarkdown}\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },

  adminDigest(lines: string[]): EmailContent {
    return {
      subject: `πroka weekly digest — ${new Date().toISOString().slice(0, 10)}`,
      html: layout({
        title: 'Weekly digest',
        bodyHtml: `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li style="margin:0 0 6px">${escapeHtml(l)}</li>`).join('')}</ul>`,
        cta: { label: 'Open admin', url: appUrl('/admin') },
      }),
      text: lines.join('\n'),
    };
  },
};

export type TemplateName = keyof typeof templates;
