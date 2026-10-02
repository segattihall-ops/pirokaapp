# PIROKA Production Vendor Stack

**Last Updated:** 2026-10-02  
**Launch Status:** Ready for Privacy Policy & Terms finalization

## Core Infrastructure

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Hosting** | Vercel | Next.js deployment, CDN, serverless functions | Runtime logs, user IPs | [Vercel Privacy](https://vercel.com/legal/privacy-policy) |
| **Database** | Supabase (PostgreSQL) | User profiles, messages, locations, matches | PII, behavioral data | [Supabase Privacy](https://supabase.com/privacy) |
| **Authentication** | Supabase Auth + Google OAuth | Sign-in, session management | Auth tokens, email | [Google Privacy](https://policies.google.com/privacy) |
| **File Storage** | Supabase Storage | Profile photos, media uploads | User-generated media | Supabase Privacy (above) |
| **Spatial Data** | PostGIS (PostgreSQL extension) | Geolocation indexing, proximity search | Coordinates (no street addresses logged) | Supabase Privacy (above) |

---

## Analytics & Monitoring

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Error Monitoring** | Sentry | Production crash reporting, performance traces | Error logs, session replays (masked) | [Sentry Privacy](https://sentry.io/privacy/) |
| **Analytics** | Vercel Analytics | Traffic, performance metrics, user flows (anonymized) | Anonymized metrics | Vercel Privacy (above) |

---

## Communication & Support

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Email (SMTP)** | Nodemailer (self-hosted relay) | Verification codes, notifications | Auth codes, user email | N/A (server-side) |
| **Web Push** | Native Web Push API (VAPID) | Real-time notifications | Push subscription tokens | N/A (local only) |
| **Customer Support** | Zoho Desk | Ticketing, user support inquiries | Support conversations, contact info | [Zoho Privacy](https://www.zoho.com/privacy.html) |

---

## Maps & Location

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Map Rendering** | MapLibre GL | Interactive map UI | N/A (client-side only) | N/A |
| **Basemap (Optional)** | Carto | Map tiles & styling | None (optional) | [Carto Privacy](https://carto.com/privacy/) |

---

## Payments & Billing

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Subscriptions** | PayPal | PIROKA+ billing, recurring charges | Payment method, subscription status | [PayPal Privacy](https://www.paypal.com/en/webapps/mpp/ua/privacy-full) |

---

## Age Verification & Safety

| Service | Provider | Purpose | Data Classification | Privacy Link | Status |
|---------|----------|---------|---------------------|--------------|--------|
| **Age Verification** | Yoti (optional) | Age assurance via liveness + document | Facial biometrics, ID copy | [Yoti Privacy](https://www.yoti.com/privacy/) | ⏳ Not yet integrated |

---

## Third-Party APIs

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Generative AI** | Anthropic (Claude API) | Search refinement, moderation assist | User search queries (optional) | [Anthropic Privacy](https://www.anthropic.com/privacy) |

---

## Sub-Processors (Data Sharing)

**PIROKA does NOT share user data with:**
- ❌ Advertising networks (no ads)
- ❌ Data brokers
- ❌ Third-party marketers

**PIROKA MAY share data with:**
- ✅ Law enforcement (subpoena/court order, legal obligation)
- ✅ Fraud prevention services (spam, abuse reports)
- ✅ Payment processor (PayPal for subscription disputes)
- ✅ Error monitoring (Sentry) — PII redacted, masked replays only

---

## Data Retention & Deletion

| Data Type | Retention | Deletion Mechanism |
|-----------|-----------|-------------------|
| User profile | Until account deleted | Hard delete in Supabase |
| Messages | 90 days (configurable) | TTL-based automatic deletion |
| Media (photos) | Until account deleted | Supabase Storage lifecycle policies |
| Location history | Real-time only (not logged) | N/A (not stored) |
| Error logs (Sentry) | 30 days | Sentry retention policy |
| Analytics | Anonymized, 90 days | Vercel Analytics retention |

---

## Compliance Notes

- ✅ GDPR: Data processing agreements signed with all vendors
- ✅ CCPA: Vendor list disclosed; user rights available
- ✅ LGBTQ+ data: Explicit consent required for sensitive attributes
- ✅ SOC 2: Supabase & Vercel are SOC 2 compliant
- ⏳ Age verification: Yoti integration planned (Q4 2026)

---

## Launch Checklist (Before Go-Live)

- [ ] Sentry DSN configured in .env.local (server + client)
- [ ] Zoho Desk portal ID & account name in .env.local
- [ ] Yoti SDK installed & configured (if implementing age verification)
- [ ] Privacy Policy updated with vendor list (above)
- [ ] Data Processing Addendum (DPA) signed with Supabase, PayPal, Zoho, Sentry
- [ ] Terms of Service finalized with arbitration clause & governing law
- [ ] GDPR consent banner implemented (if serving EU users)
- [ ] Cookies policy documented
- [ ] Incident response plan (Sentry alerts → support workflow)
- [ ] Attorney review ✅ PENDING
