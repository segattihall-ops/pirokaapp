# PIROKA Pre-Launch Implementation Checklist

**Status:** 20 phases ✅ | Legal ⏳ | Implementation ⏳

---

## ✅ COMPLETED (Ready to Use)

### Core Platform (20 Phases)
- [x] Phases 1-16: Core features (auth, profiles, matching, messaging, offline)
- [x] Phases 17-20: Premium features (filters, pulse, alerts, travel)
- [x] All E2E tests
- [x] CI passing on all PRs

### Infrastructure & Third-Parties
- [x] Sentry SDK installed & configured
- [x] Resend email SDK installed
- [x] Zoho Desk widget component created
- [x] PayPal subscription integration
- [x] Age verification abstraction (self-declared MVP ready)
- [x] Vendor stack documented (9 providers)
- [x] Monetization model ($109K ARR forecast)

---

## ⏳ MISSING: Integration into App Shell

### 1. Root Layout Integration

**File:** `app/layout.tsx`

**What's missing:**
```typescript
// ❌ NOT YET DONE: Add to root layout
'use client'
import './lib/monitoring/sentry.client.config'  // Initialize Sentry client-side
import { ErrorBoundary } from '@/components/error/error-boundary'
import { ZohoDeskWidget } from '@/components/support/zoho-desk-widget'

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <html>
        <Providers>
          {children}
          <ZohoDeskWidget />  {/* Support widget */}
        </Providers>
      </html>
    </ErrorBoundary>
  )
}
```

**Priority:** 🔴 HIGH (error tracking, support widget)

---

### 2. Onboarding Flow Integration

**File:** `app/onboarding/page.tsx` (or auth/onboarding)

**What's missing:**
- [x] Age gate component created (`components/auth/age-gate.tsx`)
- [x] Age verification API route created (`app/api/auth/age-verify/route.ts`)
- [ ] **MISSING:** Integration into actual onboarding flow
  - Age gate should show BEFORE profile completion
  - After age confirmation → proceed to profile setup
  - Redirect unauthenticated users to age gate

**Example needed:**
```typescript
// app/onboarding/page.tsx
import { AgeGate } from '@/components/auth/age-gate'
import { getSession } from '@/lib/api/session'

export default async function OnboardingPage() {
  const session = await getSession()
  
  if (!session) return <AgeGate />  // Age gate before profile
  if (!session.user.age_verified) return <AgeGate />
  
  return <ProfileOnboarding />
}
```

**Priority:** 🔴 HIGH (compliance requirement)

---

### 3. Email Integration

**File:** Integration throughout API routes

**What's missing:**
- [x] Resend service created (`lib/email/resend.ts`)
- [x] Email templates ready (verification, password reset, welcome, notifications)
- [ ] **MISSING:** Actually call sendEmail() in:
  - [ ] Signup flow → `sendWelcomeEmail()`
  - [ ] Password reset flow → `sendPasswordResetEmail()`
  - [ ] Email verification → `sendVerificationEmail()`
  - [ ] Message notifications → `sendNotificationEmail()`
  - [ ] Match notifications → `sendNotificationEmail()`

**Example:**
```typescript
// app/api/auth/signup/route.ts
import { sendWelcomeEmail } from '@/lib/email/resend'

// After user created:
await sendWelcomeEmail(user.email, user.name)
```

**Priority:** 🟡 MEDIUM (nice-to-have, works without it)

---

### 4. GDPR Consent Banner

**File:** New component needed

**What's missing:**
```typescript
// components/legal/gdpr-consent-banner.tsx (NOT YET CREATED)
'use client'

export function GDPRConsentBanner() {
  // Show banner if serving EU users
  // Options: Accept All | Reject Optional | Manage Preferences
  // Store consent in localStorage + database
}
```

**Needed in:** Root layout, visible on first visit (EU only)

**Priority:** 🟡 MEDIUM (required for EU launch, not needed for US-only)

---

### 5. Cookies Policy Page

**File:** New page needed

**What's missing:**
```typescript
// app/legal/cookies/page.tsx (NOT YET CREATED)
// Document:
// - Supabase session cookies
// - Vercel analytics cookies
// - Google Analytics (if using)
// - Third-party cookies (PayPal, Sentry, etc.)
```

**Priority:** 🟡 MEDIUM (required for EU, nice-to-have for US)

---

### 6. Email Unsubscribe Mechanism

**File:** New page + API route needed

**What's missing:**
```typescript
// app/api/email/unsubscribe/route.ts (NOT YET CREATED)
// POST endpoint that:
// - Takes email + unsubscribe token
// - Sets user.email_notifications = false
// - Logs to audit trail

// app/unsubscribe/page.tsx (NOT YET CREATED)
// Public page with form to unsubscribe
```

**Needed in:** All Resend emails (footer link)

**Priority:** 🔴 HIGH (GDPR requirement)

---

### 7. Privacy Policy & Terms Page

**Files:** New pages needed

**What's missing:**
```typescript
// app/legal/privacy/page.tsx (NOT YET CREATED)
// Content from attorney review + VENDOR_STACK.md

// app/legal/terms/page.tsx (NOT YET CREATED)
// Content from attorney review
```

**Linked from:** Footer, onboarding, signup

**Priority:** 🔴 HIGH (legal requirement)

---

## ⏳ MISSING: Configuration & Environment

### Environment Variables for Production

**File:** Vercel dashboard → Settings → Environment Variables

**Need to set:**
```
# Monitoring
SENTRY_DSN=...                          # ✅ You have this
NEXT_PUBLIC_SENTRY_DSN=...              # ✅ You have this
SENTRY_AUTH_TOKEN=...                   # ✅ Likely have this

# Email
RESEND_API_KEY=...                      # ⏳ Need to set in Vercel

# Support
NEXT_PUBLIC_ZOHO_PORTAL_ID=...          # ⏳ Need Zoho setup
NEXT_PUBLIC_ZOHO_ACCOUNT_NAME=...       # ⏳ Need Zoho setup

# Optional
NEXT_PUBLIC_CARTO_KEY=...               # ⏳ If using custom map tiles
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...      # ⏳ If using CAPTCHA
```

**Priority:** 🔴 HIGH (deploy will fail without these)

---

## ⏳ MISSING: Legal Documents (Attorney Work)

### Privacy Policy

**Status:** ⏳ Waiting for attorney

**Content to include:**
- ✅ Vendor list (from VENDOR_STACK.md)
- ✅ Storage disclosure (Supabase only)
- ✅ Mapping disclosure (Photon + Nominatim)
- ✅ Age verification disclosure
- [ ] GDPR rights (data access, deletion, portability)
- [ ] CCPA rights (sell data opt-out, etc.)
- [ ] Cookie policy

**Needed by:** Launch day

---

### Terms of Service

**Status:** ⏳ Waiting for attorney

**Content to include:**
- [ ] Arbitration clause (with 30-day opt-out)
- [ ] Governing law & venue
- [ ] Content policy (our decisions already locked)
  - [x] Non-explicit nudity allowed (public)
  - [x] Explicit content in private only
  - [x] Age 18+ required
- [ ] Acceptable use & prohibited content
- [ ] Abuse reporting mechanism
- [ ] Account termination policy
- [ ] Disclaimer of warranties
- [ ] Limitation of liability
- [ ] Indemnification

**Needed by:** Launch day

---

### Data Processing Addendum (DPA)

**Status:** ⏳ Waiting to sign with vendors

**Need to sign with (9 vendors):**
1. [ ] Supabase
2. [ ] Vercel
3. [ ] PayPal
4. [ ] Sentry
5. [ ] Zoho Desk
6. [ ] Resend
7. [ ] Cloudflare (if using Turnstile)
8. [ ] Google
9. [ ] Komoot (Photon)
10. [ ] OpenStreetMap (Nominatim)
11. [ ] Carto (if using custom tiles)

**Needed by:** Launch + 30 days after (per GDPR)

---

## ⏳ MISSING: Testing & Validation

### Pre-Launch Testing

- [ ] Sentry captures errors (test in staging)
- [ ] Resend emails deliver (test signup flow)
- [ ] PayPal subscriptions work (sandbox testing)
- [ ] Zoho Desk widget loads (support ticket creation)
- [ ] Age gate flow (E2E test created, needs to be run)
- [ ] Offline queue works (Phase 16 test)
- [ ] Service worker updates (Phase 16 test)
- [ ] All APIs return correct data (existing E2E tests)

**Priority:** 🔴 HIGH (24h before launch)

---

## 📋 Summary: What to Do Next

### TODAY
1. ✅ Attorney review of Privacy Policy + Terms (send: docs/VENDOR_STACK.md)
2. ✅ Attorney review of content policy (already locked, confirm OK)

### WHEN ATTORNEY APPROVES (Day 1-2)
1. [ ] Create Privacy Policy page (`app/legal/privacy/page.tsx`)
2. [ ] Create Terms of Service page (`app/legal/terms/page.tsx`)
3. [ ] Start signing DPAs (9 vendors)

### WHEN DPAs SIGNED (Day 2-3)
1. [ ] Create Cookies Policy page
2. [ ] Add GDPR consent banner (if EU)
3. [ ] Create unsubscribe mechanism
4. [ ] Integrate age gate into onboarding

### BEFORE DEPLOYMENT (Day 4-5)
1. [ ] Set Sentry env vars in Vercel
2. [ ] Set Resend env var in Vercel
3. [ ] Set Zoho env vars in Vercel (if using)
4. [ ] Disable `NEXT_PUBLIC_AUTH_DEMO=1` in production env
5. [ ] Run pre-launch tests (Sentry, email, payments)
6. [ ] Smoke test in staging

### LAUNCH DAY (Day 5-6)
1. [ ] Deploy to production
2. [ ] Monitor Sentry for errors
3. [ ] Monitor conversion rate (free → premium)
4. [ ] Test PayPal subscriptions
5. [ ] Test support channel (Zoho)

---

## 🚨 Blockers

**Critical (Can't launch without):**
- [ ] Attorney approval of Privacy Policy + Terms
- [ ] Age gate integrated into onboarding
- [ ] Production env vars configured
- [ ] DPA signatures (at least Supabase, PayPal, legal ones)

**Important (Should have, could launch without):**
- [ ] Email unsubscribe mechanism
- [ ] GDPR consent banner (if serving EU)
- [ ] Resend emails in signup flow

**Nice-to-have (Post-launch OK):**
- [ ] Cookies policy page
- [ ] Zoho Desk (support can work without)
- [ ] GDPR data portability endpoint

---

## Timeline to Go-Live

```
Day 1: Send to attorney
Day 2: Attorney reviews
Day 3: Attorney approves
Day 4: Create legal pages
Day 5: Sign DPAs
Day 6: Set env vars + test
Day 7: Deploy + launch 🎉
```

**Realistic: 7-10 days from now**
