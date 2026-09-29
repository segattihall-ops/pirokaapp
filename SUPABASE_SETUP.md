# Supabase Setup for πroka

Follow these steps to connect your Supabase project.

## 1. Create a Supabase Project

1. Go to https://supabase.com
2. Sign in or create an account
3. Create a new project (free tier is fine for development)
4. Choose a region close to your target users
5. Set a strong database password

## 2. Apply Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy the entire contents of `lib/db/migrations/001_schema.sql`
4. Paste into the query editor
5. Click **Run**

This will create all tables, types, extensions, and seed testing sites data.

## 3. Configure Environment Variables

Copy these from your Supabase project settings (Project Settings → API):

```env
# .env.local

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage
STORAGE_PROVIDER=supabase
# For Cloudflare R2 alternative:
# STORAGE_PROVIDER=r2
# R2_ACCOUNT_ID=your-account-id
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET=piroka-media
```

## 4. Enable Storage

In Supabase dashboard:

1. Go to **Storage**
2. Create a new bucket named `photos`
3. Set visibility to **Private** (RLS policies will control access)

## 5. Set Up Row-Level Security (RLS)

Create RLS policies to prevent unauthorized access:

```sql
-- Photos: users can read own photos and photos they have access to
-- (via album_grants)
alter table photos enable row level security;

create policy "users_read_own_photos" on photos
  for select using (auth.uid() = user_id);

-- Users: everyone can read age_verified users' public profile fields
-- (not email, true_geo, or prefs)
alter table users enable row level security;

create policy "users_read_public_profiles" on users
  for select using (age_verified = true);

-- Locations: never expose true_geo to client
-- (API layer handles queries with service key)
alter table locations enable row level security;

create policy "users_manage_own_location" on locations
  for all using (auth.uid() = user_id);

-- Conversations: only participants can read/write
alter table conversations enable row level security;

create policy "users_read_own_conversations" on conversations
  for select using (auth.uid() = a_id or auth.uid() = b_id);

-- Messages: only conversation participants can read
alter table messages enable row level security;

create policy "users_read_conversation_messages" on messages
  for select using (
    conversation_id in (
      select id from conversations 
      where auth.uid() = a_id or auth.uid() = b_id
    )
  );
```

## 6. Test Connection

```bash
npm run dev
# Navigate to http://localhost:3000/onboarding
# Check browser DevTools > Network for API calls
# Should see requests to /api/onboarding/save
```

## Troubleshooting

**"Cannot find module '@supabase/supabase-js'"**
```bash
npm install @supabase/supabase-js
```

**"NEXT_PUBLIC_SUPABASE_URL is not configured"**
- Verify .env.local has both keys set
- Restart dev server after adding env vars

**RLS Policy Error (403)**
- Check that RLS policies are created (step 5)
- Use service role key for server-side operations
- Use anon key for client-side (RLS enforced)

**Storage Upload Fails**
- Ensure bucket exists and is private
- Check bucket RLS policies are created
- Verify file size < 5MB

## Next Steps

Once Supabase is configured:

1. Test onboarding → should persist to `users` table
2. Test photo upload → should appear in `photos` table
3. Test location save → should appear in `locations` table (server-side only)
4. Proceed to Phase 2.2 work
