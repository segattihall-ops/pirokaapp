# Supabase Setup for πroka

## ✅ Status: ACTIVATED

πroka is now connected to Supabase with full Row-Level Security policies active.

---

## Database Configuration

**Project:** PIROKA  
**Project ID:** `clwqmzgoqfqibnfevhyb`  
**Region:** us-east-1  
**URL:** https://clwqmzgoqfqibnfevhyb.supabase.co

### Credentials (stored in `.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://clwqmzgoqfqibnfevhyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_65uwhDNPWUpiUnEFp5DkRQ_OBSz3xax
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Row-Level Security (RLS) Policies

**Status:** ✅ 30+ policies active

### Key Principles

1. **Users can read public profiles** if verified + not suspended
2. **Locations are strictly private** — users see only their own
3. **Messages/Conversations are participant-only** — no lurking
4. **Health cards are owner-only** — encrypted + RLS
5. **Audit log is append-only** — no client inserts, no deletes
6. **Photos are viewable** if owner profile is verified

### Policy Coverage

```sql
-- All policies follow this pattern:
-- SELECT: Readable by owner or public (verified users)
-- INSERT: Only by own user_id
-- UPDATE: Only by owner
-- DELETE: Only by owner or disallowed
```

View all policies: `lib/db/rls-policies-v2.sql`

---

## Core Tables Protected

| Table | Privacy | Status |
|-------|---------|--------|
| users | Public profiles (if verified) | ✅ |
| photos | Visible if user verified | ✅ |
| locations | Owner only (24h retention) | ✅ |
| conversations | Both participants only | ✅ |
| messages | Conversation members only | ✅ |
| health_cards | Owner only (encrypted) | ✅ |
| checkins | Owner only | ✅ |
| rsvps | Owner only | ✅ |
| audit_log | Server append-only | ✅ |
| blocks | Blocker and blocked see | ✅ |
| reports | Reporter and target see | ✅ |
| statuses | Owner only | ✅ |
| favorites | Owner only | ✅ |
| taste_flags | Owner only | ✅ |

---

## Testing RLS Locally

```bash
npm run dev

# Test as authenticated user:
# 1. Sign in with demo auth (AGE_PROVIDER=local)
# 2. View your own data (always readable)
# 3. Try accessing another user's location (blocked by RLS)
# 4. Try inserting as different user_id (rejected by RLS)
```

---

## Deployment to Vercel

Add environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://clwqmzgoqfqibnfevhyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
```

Then redeploy: `git push`

---

## Next Steps

- [ ] Connect OAuth providers (Google, Apple)
- [ ] Enable realtime subscriptions (Phase 3)
- [ ] Add E2E encryption (libsignal, Phase 3)
- [ ] Set up monitoring & backups (Pro plan)
- [ ] Build moderation dashboard

---

**Support:** [Supabase Docs](https://supabase.com/docs)
