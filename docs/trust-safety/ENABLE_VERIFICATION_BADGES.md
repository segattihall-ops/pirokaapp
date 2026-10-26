# Enabling the verification badges

πroka ships two trust badges that are **built but dormant** until their provider env vars are set.
Neither badge is the age gate, and neither gates access — both are display-only signals on a member's
profile:

- **Email** — the member proved control of an email address (a 6-digit code sent and checked by the
  app itself, no third-party SMS provider).
- **Photo** — a live selfie passed a 1:1 face match against the member's own profile photo (Didit).
  This is the anti-catfish signal: it proves the person in the photos is the person holding the phone.

Setting the env vars is all that's needed; the code paths, webhook routing, and UI are already live.

---

## Photo badge (Didit live selfie + face match)

### What's already done

- A dedicated **Face Match** workflow is published in the **live** Didit application
  (`My Application`), separate from the age-gate workflows:
  - Workflow label: **Biometric Authentication**
  - Workflow id: **`cfc9b9e1-9234-456a-9f40-c6e87ba3aeb5`**
  - Features: passive **LIVENESS** (live selfie) → **FACE_MATCH** (1:1 vs the supplied profile
    photo) → status. A missing or non-matching portrait routes to review, never a silent pass.
- The app passes the member's profile photo to Didit as the reference `portrait_image` at session
  create time (a short-lived signed URL Didit fetches once).
- The webhook handler (`/api/webhooks/didit`) already routes any decision whose `workflow_id`
  equals `DIDIT_PHOTO_WORKFLOW_ID` to the display-only "Photo" badge path — it grants
  `users.photo_verified` and **never** touches the age gate or `age_check_status`.

Because this workflow lives in the **same Didit application** as the age-gate workflows, the
application's existing webhook destination and `DIDIT_WEBHOOK_SECRET` already cover it. Nothing new
to configure in the Didit console.

### What you need to do

Set one env var in Vercel (Production + Preview), then redeploy:

```
DIDIT_PHOTO_WORKFLOW_ID=cfc9b9e1-9234-456a-9f40-c6e87ba3aeb5
```

These must already be set (the age gate uses them) — confirm they're present:

```
DIDIT_API_KEY=…            # Didit console → API keys
DIDIT_WEBHOOK_SECRET=…     # secret_shared_key of the webhook destination
```

### How to verify after deploy

1. `GET /api/me/photo` returns `{ "configured": true, … }` for a signed-in member.
2. On the ME screen, a member who has a profile photo sees the "Verify photo" control.
3. Complete a selfie check → the webhook writes `photo.verified` to `audit_log` and flips
   `users.photo_verified` to `true`; the badge appears.
4. Each completed check costs ~USD 0.10–0.13 on the Didit account (liveness + face match + IP).
   No cost is incurred until a member runs a check.

### Turning it off again

Unset `DIDIT_PHOTO_WORKFLOW_ID` and redeploy. The control disappears (`configured: false`) and no
new sessions can start. Existing `photo_verified` rows are left as they are.

---

## Email badge (self-hosted OTP)

### What you need to do

**Nothing new.** Email verification has no provider keys of its own — it sends the 6-digit code
through the app's existing mailer (`RESEND_API_KEY` for Resend, or `EMAIL_SERVER` for SMTP). If the
app is already sending email (digests, receipts, magic links), the email badge works. In
console/demo mode (no mailer configured) the control is hidden and the API answers 503.

Apply migration `20261026120000_053_email_verification.sql` (adds `users.email_verified` /
`users.verified_email` and the `email_otps` table). It is additive and idempotent.

### How to verify after deploy

1. The email-verify control on the ME screen accepts an email and sends a 6-digit code.
2. Entering the correct code marks the member email-verified and shows the **Email** badge on their
   profile. Codes expire in 10 minutes, allow 5 guesses, and are consumed on success.

### Note on the retired phone badge

The Twilio SMS phone badge has been removed (no `TWILIO_*` vars, no `/api/me/phone`). The
`users.phone` / `users.phone_verified` columns from migration 047 are left in place but unused.

---

## Notes

- Both badges are intentionally independent of the age gate (`DIDIT_WORKFLOW_ID` /
  `DIDIT_ID_WORKFLOW_ID`). Enabling or disabling a badge never affects 18+ verification.
- Under the current all-access launch everyone already has full feature access; these badges add
  trust signal, not entitlement.
- Full variable list lives in `.env.example`.
