# Enabling the verification badges

πroka ships two trust badges that are **built but dormant** until their provider env vars are set.
Neither badge is the age gate, and neither gates access — both are display-only signals on a member's
profile:

- **Phone** — the member proved control of a phone number (Twilio Verify OTP).
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

## Phone badge (Twilio Verify)

### What you need to do

Create a Twilio Verify service, then set three env vars in Vercel (Production + Preview) and
redeploy:

```
TWILIO_ACCOUNT_SID=…            # Twilio console → Account
TWILIO_AUTH_TOKEN=…
TWILIO_VERIFY_SERVICE_SID=…     # Twilio console → Verify → Services (starts with VA…)
```

The OTP send/check flow and the badge UI are already wired; they light up as soon as the three vars
are present.

### How to verify after deploy

1. The phone-verify control on the ME screen accepts a number and sends an SMS code.
2. Entering the correct code marks the member phone-verified and shows the badge.

---

## Notes

- Both badges are intentionally independent of the age gate (`DIDIT_WORKFLOW_ID` /
  `DIDIT_ID_WORKFLOW_ID`). Enabling or disabling a badge never affects 18+ verification.
- Under the current all-access launch everyone already has full feature access; these badges add
  trust signal, not entitlement.
- Full variable list lives in `.env.example`.
