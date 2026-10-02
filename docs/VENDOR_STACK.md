# PIROKA Production Vendor Stack

**Last Updated:** 2026-10-02  
**Launch Status:** Ready for Privacy Policy & Terms finalization

## Core Infrastructure

| Service | Provider | Purpose | Data Classification | Privacy Link |
|---------|----------|---------|---------------------|--------------|
| **Hosting** | Vercel | Next.js deployment, CDN, serverless functions | Runtime logs, user IPs | [Vercel Privacy](https://vercel.com/legal/privacy-policy) |
| **Database** | Supabase (PostgreSQL) | User profiles, messages, locations, matches | PII, behavioral data | [Supabase Privacy](https://supabase.com/privacy) |
| **Authentication** | Supabase Auth + Google OAuth | Sign-in, session management, MFA | Auth tokens, email | [Google Privacy](https://policies.google.com/privacy) |
| **File Storage** | Supabase Storage (default) | Profile photos, album media (path: users/{userId}/photos/) | User-generated images | Supabase Privacy (above) |
| **File Storage (Optional)** | Cloudflare R2 | Alternative media storage (if STORAGE_PROVIDER=r2) | User-generated images | [Cloudflare Privacy](https://www.cloudflare.com/privacy/) |
| **Spatial Data** | PostGIS (PostgreSQL) | Proximity search, location queries (server-side only) | Coordinates, no external calls | Supabase Privacy (above) |
| **Bot Protection** | Cloudflare Turnstile | CAPTCHA on signup/signin (if NEXT_PUBLIC_TURNSTILE_SITE_KEY set) | Challenge tokens | [Cloudflare Privacy](https://www.cloudflare.com/privacy/) |

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
| **Email (Transactional)** | Resend | Verification codes, welcome, password reset, notifications | Auth codes, user email | [Resend Privacy](https://resend.com/privacy) |
| **Web Push** | Native Web Push API (VAPID) | Real-time notifications | Push subscription tokens | N/A (local only) |
| **Customer Support** | Zoho Desk | Ticketing, user support inquiries | Support conversations, contact info | [Zoho Privacy](https://www.zoho.com/privacy.html) |

---

## Maps & Location Services

| Service | Provider | Purpose | Data Sent | Privacy Link |
|---------|----------|---------|-----------|--------------|
| **Map Renderer** | MapLibre GL | Interactive map UI (client-side) | None (local rendering) | N/A |
| **Map Tiles (Optional)** | Carto | Basemap & styling (if NEXT_PUBLIC_CARTO_KEY set) | API key (non-identifying) | [Carto Privacy](https://carto.com/privacy/) |
| **City Search/Geocoding** | Photon (Komoot) | Convert city names to coordinates (travel mode) | City name query, user agent | [Komoot Privacy](https://www.komoot.de/privacy-policy) |
| **Geocoding Fallback** | Nominatim (OpenStreetMap) | City geocoding (fallback if Photon fails) | City name query, user agent | [OSM Privacy](https://wiki.openstreetmap.org/wiki/Privacy_Policy) |
| **Spatial Queries** | PostGIS (server-side) | Proximity search, location-based matching | None (processed server-side) | Supabase Privacy (above) |

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

## Third-Party Authentication & APIs

| Service | Provider | Purpose | Data Sent | Privacy Link |
|---------|----------|---------|-----------|--------------|
| **Social Login** | Google OAuth | Optional signup/signin via Google account | Email, name, profile picture | [Google Privacy](https://policies.google.com/privacy) |
| **Generative AI** | Anthropic (Claude API) | Search query refinement, content moderation | User search queries (optional, if search assist enabled) | [Anthropic Privacy](https://www.anthropic.com/privacy) |

---

## Storage Configuration (LOCKED: Supabase Storage Only)

### Production Configuration
```
STORAGE_PROVIDER=supabase  # All media → Supabase Storage
```

**Data Flow:**
- Profile photos (slots 0-5): `users/{userId}/photos/0-5.original.jpg` → Supabase Storage (public)
- Blur placeholders: `users/{userId}/photos/0-5.blur.jpg` → Supabase Storage (public)
- Private albums: Signed URLs with expiry (Supabase)
- Access: Public URLs for profile display, signed URLs for private/members-only

### Privacy Policy Statement (LOCKED)

> "Media files including profile photos and private albums are stored on Supabase Storage, operated by Supabase Inc. All media is encrypted in transit (HTTPS) and at rest. Public profile photos are served via Supabase's CDN globally. Private album photos require authentication and use time-limited signed URLs. See [Supabase Privacy Policy](https://supabase.com/privacy) for their data handling practices."

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

## Storage Decision (✅ LOCKED: Supabase Storage Only)

**Selected:** ✅ **Supabase Storage only**
- All profile photos and private albums stored in Supabase
- Encrypted in transit (HTTPS) and at rest
- Public photos served via Supabase CDN
- Private albums: signed URLs with expiry

---

## Mapping & Location Decision (REQUIRED BEFORE PRIVACY POLICY)

**Current Implementation:**
- ✅ MapLibre GL (client-side, no external calls)
- ✅ PostGIS (server-side, stays in-database)
- ✅ Photon (Komoot) + Nominatim (OpenStreetMap) for city geocoding
- ✅ Carto (optional basemap tiles, if NEXT_PUBLIC_CARTO_KEY set)
- ⚠️ Google OAuth (email, name, picture sent to Google)

**Privacy Policy must state:**
> "City search uses Photon (Komoot) and Nominatim (OpenStreetMap) APIs, which receive your search query and user agent. Map rendering is client-side only. Coordinate data never leaves our servers except for your own queries. See [Komoot Privacy](https://www.komoot.de/privacy-policy) and [OSM Privacy](https://wiki.openstreetmap.org/wiki/Privacy_Policy)."

---

## Launch Checklist (Before Go-Live)

**Configuration (All Locked):**
- ✅ Storage: Supabase Storage only
- ✅ Mapping: MapLibre + PostGIS + Photon/Nominatim disclosed
- [ ] Sentry DSN configured (server + client)
- [ ] Zoho Desk portal ID & account name set
- [ ] Carto API key set (optional for custom map tiles)
- [ ] Turnstile site key set (optional for CAPTCHA)
- [ ] Remove `NEXT_PUBLIC_AUTH_DEMO=1` from production

**Legal & Compliance (9 Vendors):**
- [ ] **Privacy Policy finalized** with:
  - ✅ Storage: Supabase Storage (encrypted, CDN, signed URLs)
  - ✅ Mapping: Photon (Komoot) + Nominatim (OSM) + Google OAuth disclosed
  - ✅ Complete vendor list (below)

- [ ] **Data Processing Addendum (DPA) signed with:**
  - [ ] Supabase (database, storage)
  - [ ] Vercel (hosting, CDN)
  - [ ] PayPal (payments, subscriptions)
  - [ ] Sentry (error monitoring)
  - [ ] Zoho Desk (customer support)
  - [ ] Resend (transactional email)
  - [ ] Cloudflare (Turnstile CAPTCHA)
  - [ ] Google (OAuth authentication)
  - [ ] Komoot (Photon geocoding API)
  - [ ] OpenStreetMap/Nominatim (geocoding fallback)
  - [ ] Carto (optional map tiles, if enabled)

- [ ] **Terms of Service finalized:**
  - [ ] Arbitration clause with 30-day opt-out
  - [ ] Governing law & venue selected
  - [ ] Content policies (nudity, explicit content, age assurance)
  - [ ] Acceptable use & abuse reporting

- [ ] GDPR consent banner implemented (if serving EU users)
- [ ] Cookies policy documented
- [ ] Incident response plan documented
- [ ] ✅ **READY FOR ATTORNEY REVIEW**
