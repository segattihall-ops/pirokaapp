# Supabase Activated ✅

Your Supabase project is now connected to πroka.

## Configuration

**Project URL:** https://clwqmzgoqfqibnfevhyb.supabase.co  
**Anon Key:** sb_publishable_65uwhDNPWUpiUnEFp5DkRQ_OBSz3xax  
**Service Role Key:** Set in `.env.local`

## Next Steps

### 1. Apply Database Schema

Go to your Supabase dashboard:
https://supabase.com/dashboard/project/clwqmzgoqfqibnfevhyb/sql/new

Copy the entire contents of:
```
lib/db/migrations/001_schema.sql
```

Paste into the SQL editor and click **Run**.

This creates:
- Users table with auth metadata
- Photos table with EXIF-stripped storage keys
- Locations table (true + fuzzed coordinates)
- Conversations & messages (E2E encryption)
- All other tables for Phases 3-5

### 2. Create Storage Bucket

In Supabase dashboard:
1. Go to **Storage** → **Buckets**
2. Create new bucket: `photos`
3. Set visibility to **Private**

### 3. Set Up RLS Policies (Optional but Recommended)

In SQL Editor, run:
```sql
-- Photos: users can read own photos
alter table photos enable row level security;
create policy "users_read_own_photos" on photos
  for select using (auth.uid() = user_id);

-- Users: everyone can read public profiles
alter table users enable row level security;
create policy "users_read_public_profiles" on users
  for select using (age_verified = true);
```

### 4. Test Locally

```bash
npm run dev
# Navigate to http://localhost:3000/onboarding
# Fill out onboarding form
# Data should persist to Supabase
```

## Troubleshooting

**"Error: Supabase not configured"**
- Make sure `.env.local` has all three keys
- Restart dev server: `npm run dev`

**"relation 'public.users' does not exist"**
- Schema not applied yet
- Run the SQL from step 1

**Photo upload fails**
- Create the `photos` bucket (step 2)
- Check RLS policies allow uploads

**Can't login**
- Auth.js demo mode is still active
- To switch to Supabase auth, update `AGE_PROVIDER=local` to something else

## Production Deploy

Once tested locally:
1. Add Supabase credentials to Vercel environment
2. Re-deploy: `git push origin main`
3. Vercel auto-rebuilds and deploys

## Architecture

- **Postgres + PostGIS** for geospatial queries
- **Location fuzzing** keeps true coordinates server-only
- **E2E encryption ready** (libsignal configured)
- **RLS policies** control data access
- **Storage** for photos (EXIF stripped on upload)

All phases (1-5) now have live database backing!

---

Questions? Check SUPABASE_SETUP.md for detailed steps.
