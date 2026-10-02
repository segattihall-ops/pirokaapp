# Email Templates & Resend Integration

## Overview

ΠROKA uses **Resend** for transactional emails:
- Verification codes
- Password resets
- Welcome messages
- Push notifications
- Support confirmations

**File:** `lib/email/resend.ts`

---

## Configuration

### Production
```bash
RESEND_API_KEY=re_xxx...xxx    # Get from https://resend.com/
EMAIL_FROM="πroka <no-reply@piroka.app>"
NEXTAUTH_URL=https://piroka.app
```

### Development (No API Key)
Falls back to console logging:
```
[EMAIL DEV MODE] {
  from: "πroka <noreply@piroka.app>",
  to: "user@example.com",
  subject: "Verify your ΠROKA account",
  html: "..."
}
```

---

## Available Functions

### `sendEmail(template: EmailTemplate)`
Generic email sender for custom templates.

```typescript
import { sendEmail } from '@/lib/email/resend';

await sendEmail({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Test email</p>',
  text: 'Test email',
});
```

### `sendVerificationEmail(email, code)`
Sends email verification code with clickable link.

```typescript
await sendVerificationEmail('user@example.com', '123456');
// Email includes: verification link + code fallback
```

### `sendPasswordResetEmail(email, resetUrl)`
Password reset link (expires 24h).

```typescript
await sendPasswordResetEmail('user@example.com', 'https://piroka.app/reset?token=...');
```

### `sendWelcomeEmail(email, name?)`
Welcome email after successful signup.

```typescript
await sendWelcomeEmail('user@example.com', 'Alice');
```

### `sendNotificationEmail(email, title, message, actionUrl?, actionLabel?)`
Generic notification (new match, message, etc.).

```typescript
await sendNotificationEmail(
  'user@example.com',
  'New Match!',
  'Someone liked your profile',
  'https://piroka.app/matches/123',
  'View Profile'
);
```

---

## Usage Examples

### In API Route
```typescript
import { sendEmail } from '@/lib/email/resend';

export async function POST(request: Request) {
  const { email, code } = await request.json();

  const result = await sendVerificationEmail(email, code);

  if (result.success) {
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}
```

### In Callback
```typescript
import { sendWelcomeEmail } from '@/lib/email/resend';

// After user signs up
const user = await createUser(userData);
await sendWelcomeEmail(user.email, user.name);
```

---

## Email Design

All templates use:
- **System fonts** (no web fonts for better deliverability)
- **Responsive design** (mobile-friendly)
- **ADA accessible** (high contrast, semantic HTML)
- **Dark mode support** (inline styles)

### Customization

Edit `lib/email/resend.ts` to update:
- Colors (`#2563eb` = blue)
- Text & messaging
- Button styling
- Footer/unsubscribe links

---

## Monitoring

### Resend Dashboard
- Delivery rates
- Bounce & complaint rates
- Read counts (if tracking enabled)
- Send logs

**Access:** https://resend.com/emails

### Error Logging
All email errors logged to:
- Browser console (dev mode)
- Server logs (production)
- Sentry (error monitoring)

---

## Compliance

### GDPR
- ✅ Email requires opt-in (collected at signup)
- ✅ Unsubscribe link in all emails
- ✅ User can request deletion of emails

### CAN-SPAM (US)
- ✅ Clear sender identification
- ✅ Unsubscribe mechanism
- ✅ Transactional emails exempt

### CASL (Canada)
- ✅ Implied consent (user initiated signup)
- ✅ Sender info included
- ✅ Unsubscribe option

---

## Troubleshooting

### "Email not sending"
1. Check `RESEND_API_KEY` is set
2. Verify sender domain verified in Resend dashboard
3. Check Sentry for errors
4. Test with `console.log` in dev mode first

### "Email marked as spam"
- Resend includes SPF/DKIM authentication
- Avoid spam trigger words (free, limited time, etc.)
- Use plain text version alongside HTML
- Include unsubscribe link

### "Bounces increasing"
- Monitor Resend dashboard
- Remove invalid emails from system
- Update email verification

---

## Roadmap

- [ ] Email templates in database (WYSIWYG editor)
- [ ] A/B testing templates
- [ ] Subscriber segmentation
- [ ] Automated drip campaigns
- [ ] SMS fallback (Twilio)
