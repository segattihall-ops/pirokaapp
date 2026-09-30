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
4. `lib/db/migrations/010_signal_push_admin.sql` ← creates the `auth.users → public.users` trigger, Signal pre-key tables, push subscriptions, and turns on realtime for `dm_messages`
5. `lib/db/migrations/011_discovery.sql`, `012_places.sql`, `013_social.sql`, `014_profile_edit.sql` ← map, places, notifications/favourites/album/trips, unique handles
6. `lib/db/rls-policies-v2.sql`

(The PIROKA project already has all of these applied.)

Auth providers (Supabase → Authentication → Sign In / Providers):

1. **Email** — on by default (magic link). Under *Email* keep "Confirm email" on.
2. **Anonymous** — the homepage's "Stay anonymous" button needs the toggle **"Allow anonymous sign-ins"** switched on
   (same page, under *User Signups*). Until it is, the button says the option isn't available yet and the
   Supabase log shows `Anonymous sign-ins are disabled`. Supabase recommends enabling **CAPTCHA**
   (Authentication → Attack Protection → Bot and abuse protection) once anonymous sign-ins are on.
3. **Google** / **Apple** — optional, with the IDs below.

Then add `https://<your-domain>/auth/callback` (and your Vercel preview URL) to Authentication → URL Configuration → Redirect URLs.

### CAPTCHA (bot protection) — do it in this order or sign-ins break

The app sends a Cloudflare **Turnstile** token with every email, password and anonymous sign-in as soon as the
site key exists. Supabase rejects those sign-ins if its captcha is on but no token arrives — so add the key to
the app **first**, then flip the Supabase switch.

1. https://dash.cloudflare.com → **Turnstile** → **Add widget**: name `piroka`, widget mode **Managed**,
   pre-clearance off → Create. Copy **Site Key** and **Secret Key**.
2. Same widget → **Hostname management**. Turnstile only accepts exact hostnames (no `*` wildcards) and each
   one covers its own subdomains, so add every host the app is served from, one per line:
   - `pirokaapp.vercel.app` (production)
   - `pirokaapp-git-claude-phase-1-homepage-auth-6smkpp-mm-website.vercel.app` (branch preview, if you test there)
   - `localhost` (local dev)
   - your custom domain once you have one
   A host that is missing fails every sign-in with **error 110200** ("Security check failed" in the chat).
3. Vercel → Environment Variables → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site Key → redeploy.
4. Supabase → PIROKA → **Authentication** → **Attack Protection** → **Enable Captcha protection** → provider
   **Turnstile** → paste the **Secret Key** → Save.
5. Open the homepage and sign in with email once; Cloudflare's badge appears only if it decides to challenge.

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel (public) |
| Turnstile Secret Key | Supabase dashboard only — never in the app |

OAuth (Google/Apple) sign-ins don't go through the captcha; Supabase only checks it for email/password/anonymous.

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
| `CRON_SECRET` | SafeMeet check-in reminders. `vercel.json` schedules `/api/cron/safemeet` every 5 min; Vercel sends this value as the bearer token automatically once the variable exists. (Hobby plan runs crons once a day — the contact page is still correct because its state comes from timestamps; only the push nudges arrive late.) |

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

## 8. Video calls — *Optional* (works without a key on most networks)

Calls are peer-to-peer WebRTC; signalling rides on Supabase Realtime and nothing is stored. Without a key the app
uses Google's public STUN servers, which connects most phones. Behind strict corporate/carrier NATs a **TURN**
relay is needed: create one on https://www.metered.ca/stun-turn (free tier), Twilio, or run coturn, then set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ICE_SERVERS` | JSON array, e.g. `[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:a.relay.metered.ca:443","username":"…","credential":"…"}]` |

---

## 9. Optional

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
6. Star a profile (☆), have that account go live → the bell (top right) and a push arrive.
7. In a chat tap the camera icon on two phones on different networks; if it stays on "Connecting…", add a TURN server (section 8).
