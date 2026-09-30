# πroka Setup Guide

## 🚀 Quick Start

### 1. Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000 in browser
```

**Demo mode** runs with `AGE_PROVIDER=local` by default — no auth keys needed.

---

## 🔑 Environment Variables

### Phase 1: Auth (Required for Production)

```env
# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Age verification (choose one provider)
AGE_PROVIDER=local  # demo mode (no key needed)
# OR
AGE_PROVIDER=yoti
YOTI_CLIENT_SDK_ID=your_sdk_id
YOTI_PEM=your_private_key
# OR
AGE_PROVIDER=persona
PERSONA_API_KEY=your_api_key

# OAuth providers (optional for demo)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
APPLE_ID=your_apple_id
APPLE_SECRET=your_apple_secret

# Email magic links
EMAIL_SERVER=smtp://user:pass@smtp.gmail.com:587
EMAIL_FROM="πroka <no-reply@piroka.app>"
```

### Phase 2: Database (Supabase)

```env
# Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Setup Supabase**:
1. Create project at supabase.com
2. Run, in order: `lib/db/migrations/001_schema.sql`, `008_postgis_functions.sql`, `009_paypal_billing.sql`, `010_signal_push_admin.sql`, then `lib/db/rls-policies-v2.sql`
3. Enable PostGIS extension: `create extension if not exists postgis;`
4. Copy keys to `.env.local`

### Phase 8: Billing (PayPal)

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID=P-...
NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID=P-...
```

See `PAYPAL_SETUP.md` and `KEYS.md`.

### Push notifications

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@yourdomain.com
```

### Admin

```env
ADMIN_EMAILS=you@yourdomain.com
```

### Phase 9: AI (Claude API)

```env
ANTHROPIC_API_KEY=sk-ant-your_key
```

---

## 📱 Mobile Testing

Test at **390px width** (iPhone SE) for mobile-first design:

```bash
# Chrome DevTools
1. Press F12
2. Click Device Toolbar (Ctrl+Shift+M)
3. Select iPhone SE (375px) or set custom 390px
```

---

## 🗺️ Map Layers

### Default Style: CARTO Dark All
- Fallback: Esri Dark Gray (if CARTO unavailable)
- User pins with intent rings (now/next/future)
- Place check-ins (4h TTL) and "going" (24h TTL)
- Pulse hotspot clustering (≥3 people per 450m cell)
- Arrival pins with origin flags

### Location Privacy
- **Public**: Fuzzy location (0–800m obfuscation per session)
- **Server**: True location stored, never sent to client
- **Meet Mode**: Precise sharing for 2h only (revokes after)

---

## 🔐 Auth Flow

### Phase 1: Age Gate
1. User arrives at homepage
2. Three.js globe + signup chat
3. "18+" consent + terms agreement
4. Age verification (face/ID via Yoti or local demo)

### Phase 2: Onboarding
1. Profile (name, pronouns, gender, orientation)
2. Identities (66 options from communities/gender/orientation)
3. Show me (who to match with)
4. Photos (6 slots with EXIF stripping + blur variants)
5. Location (fuzzy coords saved, true coords server-only)

### Providers
- **Google** / **Apple**: OAuth 2.0
- **Email**: Magic link via SMTP
- **Anonymous**: Demo-only temporary session

---

## 🛡️ Safety Features

### PIN Lock (Phase 7)
- 4-digit code (salted hash verification)
- Auto-lock on app visibility change
- Quick exit: Press Esc twice + shield button
- Max 3 attempts before alert

### Moderation Ladder (Phase 7)
1. **Warning**: User notified, no action
2. **Limited**: Reduced visibility (temporary)
3. **Suspended**: App access revoked
4. **Removed**: Account deleted permanently

All actions logged to `audit_log` table with moderator ID and reason.

### E2E Encryption (Phase 4)
- Chat messages encrypted with libsignal X3DH + Double Ratchet
- Health data encrypted with envelope keys
- Ciphertext-only storage in database

---

## 💳 Billing (Phase 8)

### Plans

| Feature | Free | Plus | Premium |
|---------|------|------|---------|
| Profiles | ✅ | ✅ | ✅ |
| Map | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ |
| Albums | 2 photos | 5 photos | Unlimited |
| Saved Trips | — | ✅ | ✅ |
| Taste Learning | — | — | ✅ |
| Smart Search | — | — | ✅ |
| Early Access | — | — | ✅ |
| Price | Free | $5/mo | $10/mo |

### Webhooks
- `BILLING.SUBSCRIPTION.ACTIVATED` / `UPDATED`: set `users.plan`
- `BILLING.SUBSCRIPTION.CANCELLED` / `EXPIRED` / `SUSPENDED`: back to free
- `PAYMENT.SALE.COMPLETED` / `BILLING.SUBSCRIPTION.PAYMENT.FAILED`: recorded in `payments`

**Webhook endpoint**: `/api/webhooks/paypal` (signature verified with PayPal before any write)

---

## 🤖 AI Features (Phase 9 & 13)

### Smart Search (Phase 9)
- Free-form prompt: "Show me guys in their 20s who are into hiking"
- Claude validates output against allowed filters
- Returns structured filters + match count

### Claude Vision (Phase 11)
- Photo verification with webcam capture
- Verifies selfie matches profile photos
- Marks `verified_at` timestamp on success

### AI Assistant (Phase 13)
- Claude-powered people search
- Learns from likes/passes/messages
- Match scoring based on taste vector

---

## 🗄️ Database Schema

### Core Tables
- `users`: Profiles, preferences, safety settings
- `photos`: Image metadata, blur variants, EXIF stripped
- `locations`: Fuzzy + true coordinates
- `conversations`: 1:1 chats with E2E ciphertexts
- `messages`: Encrypted with ciphertext-only storage
- `health_cards`: E2E encrypted sexual health status
- `place_checkins`: "Here" (4h) / "Going" (24h) TTL
- `events`: Events with RSVP tracking
- `groups`: Group memberships + chat
- `trips`: City-based trip planning
- `audit_log`: All moderation actions

### PostGIS Functions
- `st_dwithin`: Nearby query (5km radius max 200 people)
- `st_geohash`: Hotspot clustering (7-char precision = 450m cells)
- `st_centroid`: Hotspot center calculation

---

## 🚀 Deployment

### Vercel

1. **Connect GitHub**
   ```bash
   gh repo create segattihall-ops/pirokaapp --public --source=.
   git push origin main
   ```

2. **Add Environment Variables** in Vercel dashboard
   - All `.env` variables except `NEXTAUTH_SECRET` (auto-generated)

3. **Deploy**
   ```bash
   vercel deploy --prod
   ```

4. **Auto-Deploy**
   - Push to `main` → Vercel auto-deploys
   - Preview deployments on PRs

### Custom Domain
- Add CNAME record to DNS
- Vercel auto-provisions SSL certificate

---

## ✅ Pre-Launch Checklist

- [ ] Supabase project created + schema applied
- [ ] OAuth keys configured (Google + Apple)
- [ ] PayPal keys + plan IDs + webhook ID added
- [ ] VAPID keys added (push)
- [ ] ADMIN_EMAILS set
- [ ] SMTP email server configured
- [ ] Claude API key set
- [ ] Yoti / Persona age verification key (or use local demo)
- [ ] Test auth flow end-to-end
- [ ] Test photo upload + EXIF stripping
- [ ] Test location fuzzing (verify coords not sent to client)
- [ ] Test PIN lock + moderation actions
- [ ] Test PayPal sandbox subscription + cancel
- [ ] Test E2E chat on two accounts (compare safety numbers)
- [ ] Test push notification on a phone
- [ ] Performance audit (Lighthouse)
- [ ] Mobile testing at 390px
- [ ] SSL certificate auto-renewal (Vercel handles)

---

## 📚 Phase Documentation

See `PROGRESS.md` for detailed status of all 16 phases.

Each phase includes:
- ✅ Completed features
- ⏳ Pending/future work
- 🔧 Component paths
- 🔌 API endpoint stubs

---

## 🐛 Troubleshooting

### "Database not configured"
→ Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### "Supabase extension 'citext' not found"
→ Run in Supabase SQL editor:
```sql
create extension if not exists citext;
create extension if not exists postgis;
```

### Vercel build fails on TypeScript
→ Check `/api` routes for type errors in session handling
→ Use `session.userId` and `session.email` (not `session.user`)

### Map doesn't load
→ CARTO style down? Check browser console for fallback to Esri
→ Verify MapLibre GL + Esri URLs are not blocked by CSP

### Phone verification code never arrives
→ Check `EMAIL_SERVER` SMTP config
→ Use real SMTP (Gmail, SendGrid, etc.) — localhost mail won't work

---

## 📞 Support

- 🆘 Issues: https://github.com/segattihall-ops/pirokaapp/issues
- 💬 Discussions: https://github.com/segattihall-ops/pirokaapp/discussions
- 📧 Email: support@piroka.app

---

**Last Updated**: 2026-09-29
**Build Status**: ✅ All 16 phases complete + deployed to Vercel
**Next Phase**: User testing + final polish
