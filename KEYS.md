# Keys to place before launch

Everything is built and deployed. The app runs in demo mode until these credentials exist.
Paste each value in **Vercel → Project → Settings → Environment Variables** (Production + Preview)
and in `.env.local` for local dev. Names must match exactly.

Legend: **Required** = the feature is off without it · *Optional* = nice to have.

---

## 1. Supabase — **Required** (auth, database, realtime chat, push, billing state)

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key (server only) |

Then run, in order, in **SQL Editor**:

1. `lib/db/migrations/001_schema.sql`
2. `lib/db/migrations/008_postgis_functions.sql`
3. `lib/db/migrations/009_paypal_billing.sql`
4. `lib/db/migrations/010_signal_push_admin.sql` ← creates the `auth.users → public.users` trigger, Signal pre-key tables, push subscriptions, and turns on realtime for `messages`
5. `lib/db/rls-policies-v2.sql`

Auth providers (Supabase → Authentication → Providers): enable **Email** (magic link), **Anonymous**, and optionally
**Google** / **Apple** with the IDs below. Add `https://<your-domain>/auth/callback` to the redirect allow-list.

| Variable | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client (Web) |
| `APPLE_ID` / `APPLE_SECRET` | Apple Developer → Certificates, IDs & Profiles → Services ID |

Finally remove `NEXT_PUBLIC_AUTH_DEMO` from Production so the demo cookie can't be used.

---

## 2. PayPal — **Required** for Plus / Premium

1. https://developer.paypal.com → **Apps & Credentials** → create a REST app (Sandbox first, then Live).
2. **Products → Subscriptions → Plans**: create *πroka Plus* ($5 / month) and *πroka Premium* ($10 / month). Copy each Plan ID (`P-…`).
3. **Webhooks** → Add webhook → URL `https://<your-domain>/api/webhooks/paypal` → subscribe to:
   `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`,
   `PAYMENT.SALE.COMPLETED`. Copy the Webhook ID.

| Variable | Value |
|---|---|
| `PAYPAL_ENV` | `sandbox` while testing, `live` for launch |
| `PAYPAL_CLIENT_ID` | REST app Client ID |
| `PAYPAL_CLIENT_SECRET` | REST app Secret |
| `PAYPAL_WEBHOOK_ID` | from step 3 |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | same Client ID (renders the buttons in the browser) |
| `NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID` | Plus plan `P-…` |
| `NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID` | Premium plan `P-…` |

Where it's wired: `components/billing/paypal-checkout.tsx` (buttons on **Me**), `app/api/billing/*`,
`app/api/webhooks/paypal/route.ts` (signature-verified with PayPal before any DB write).

---

## 3. Web push — **Required** for message notifications

```bash
npx web-push generate-vapid-keys
```

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Key from the command |
| `VAPID_PRIVATE_KEY` | Private Key from the command |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` |

Users opt in from **Me → Push notifications**. Sends happen in `lib/push/server.ts` when a message lands.

---

## 4. Secrets you generate — **Required**

```bash
openssl rand -base64 32   # run twice
```

| Variable | Notes |
|---|---|
| `NEXTAUTH_SECRET` | signs sessions |
| `DEMO_AUTH_SECRET` | only needed while demo mode is on |
| `NEXTAUTH_URL` | `https://<your-domain>` in production |

---

## 5. Admin access — **Required** to open `/admin`

| Variable | Value |
|---|---|
| `ADMIN_EMAILS` | `you@yourdomain.com,other@yourdomain.com` |

---

## 6. Email — **Required** for magic links outside Supabase's built-in mailer

| Variable | Value |
|---|---|
| `EMAIL_SERVER` | `smtp://user:pass@smtp.provider.com:587` (Resend, Postmark, SendGrid, Gmail app password…) |
| `EMAIL_FROM` | `πroka <no-reply@yourdomain.com>` |

Also set the same SMTP under Supabase → Authentication → SMTP so Supabase's own auth emails come from your domain.

---

## 7. Age verification — **Required before real users**

The 18+ gate is what keeps the app legal. Today it runs in **demo** mode: `AGE_PROVIDER=local` accepts the
on-device face/ID prototype flow and proves nothing. That mode is refused in production unless `AGE_PROVIDER=local`
is set on purpose, so the preview works only because the variable is set explicitly.

| Variable | Value |
|---|---|
| `AGE_PROVIDER` | `yoti` for launch (`local` = demo only) |
| `YOTI_CLIENT_SDK_ID` | https://hub.yoti.com → your app |
| `YOTI_PEM_PATH` | path to the downloaded `.pem` (on Vercel: store the PEM as a secret and write it to disk in the build step) |

Server-to-server verification against Yoti's Age Estimation API is stubbed to **fail closed** in
`lib/age/index.ts` (`verifyYoti`): with `AGE_PROVIDER=yoti` nobody passes until that call is wired to your
Yoti contract. Do not "fix" it by trusting a token decoded from the client — the server must ask Yoti.

---

## 8. Optional

| Variable | Feature |
|---|---|
| `NEXT_PUBLIC_CARTO_KEY` | CARTO dark map tiles (falls back to Esri without it) |
| `ANTHROPIC_API_KEY` | smart search / moderation assist |
| `TWILIO_*` | phone OTP |
| `R2_*` | media storage |

---

## After pasting

1. Redeploy on Vercel (env changes need a new build for `NEXT_PUBLIC_*`).
2. Sign in, open **Me** → subscribe with a PayPal sandbox buyer → confirm `users.plan` flips to `plus`/`premium`.
3. Open **Chats** on two accounts, start a chat by @handle, send both ways, tap the 🔒 line to compare safety numbers.
4. Toggle push on one device, message it from the other.
5. Add your email to `ADMIN_EMAILS`, open `/admin`, file a test report and run the moderation ladder.
