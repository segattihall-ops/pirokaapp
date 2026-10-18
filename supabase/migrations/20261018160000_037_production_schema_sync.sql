-- 037 · Production schema sync
--
-- The production project was set up from schema.sql plus a subset of lib/db/migrations, so the
-- tables added by 020, 023, 024, 025, 027, 030 and 035 never landed there while the API code
-- that reads them shipped. Every statement here is idempotent and follows the 032 rule: the
-- server talks to these tables with the service role only, so RLS is on with no policies and
-- anon/authenticated privileges are revoked.
--
-- Deliberately NOT included: 025's activity_log / activity_trends / activity_alerts /
-- monitored_places (the production database already has an unrelated activity_log table owned
-- by another system, and no API reads the other three).

create extension if not exists cube;
create extension if not exists earthdistance;

-- 020 · taste learning + match scores (favorites already exists)
create table if not exists public.taste_vectors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  target_id     uuid not null references public.users(id) on delete cascade,
  action        text not null check (action in ('like', 'pass', 'message')),
  confidence    float not null default 0.5 check (confidence between 0 and 1),
  created_at    timestamptz not null default now(),
  unique (user_id, target_id, action)
);
create index if not exists idx_taste_vectors_user on public.taste_vectors(user_id);
create index if not exists idx_taste_vectors_target on public.taste_vectors(target_id);

create table if not exists public.match_scores (
  user_id       uuid not null references public.users(id) on delete cascade,
  target_id     uuid not null references public.users(id) on delete cascade,
  score         float not null check (score between 0 and 1),
  computed_at   timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  primary key (user_id, target_id)
);
create index if not exists idx_match_scores_expires on public.match_scores(expires_at);

-- 023 · referrals, XP, leaderboards
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null unique check (length(code) >= 6 and length(code) <= 12),
  reward_credits integer not null default 100,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint code_format check (code ~ '^[A-Z0-9]+$')
);
create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  new_user_id uuid not null references public.users(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  reward_credited boolean not null default false,
  credited_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.user_xp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount != 0),
  action text not null,
  related_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.user_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  total_xp integer not null default 0,
  messages_sent integer not null default 0,
  photos_verified integer not null default 0,
  referrals_completed integer not null default 0,
  conversations_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  rank integer not null,
  user_id uuid not null references public.users(id) on delete cascade,
  total_xp integer not null,
  metric text not null,
  created_at timestamptz not null default now(),
  unique (snapshot_date, rank, metric)
);
create index if not exists idx_referral_codes_user_id on public.referral_codes(user_id);
create index if not exists idx_referral_signups_referrer on public.referral_signups(referrer_id);
create index if not exists idx_user_xp_user on public.user_xp(user_id);
create index if not exists idx_leaderboard_snapshot_date_metric on public.leaderboard_snapshots(snapshot_date, metric);

-- 024 · saved filters
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  filter_config jsonb not null,
  is_active boolean not null default true,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_saved_filters_user on public.saved_filters(user_id);

-- 025 · pulse heatmap buckets (the only pulse table the API reads)
create table if not exists public.area_heatmaps (
  id uuid primary key default gen_random_uuid(),
  location point not null,
  city text not null,
  hour_bucket timestamptz not null,
  active_profiles integer not null default 0,
  activity_score float not null default 0,
  trend text not null default 'stable',
  created_at timestamptz not null default now(),
  unique (city, hour_bucket)
);
create index if not exists idx_area_heatmaps_city_hour on public.area_heatmaps(city, hour_bucket desc);

-- 027 · travel
create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  destination_city text not null,
  destination_country text,
  arrival_date date,
  departure_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_saved_trips_user on public.saved_trips(user_id);
create table if not exists public.travel_mode (
  user_id uuid primary key references public.users(id) on delete cascade,
  is_active boolean not null default false,
  destination_city text,
  appears_in_destination boolean not null default true,
  reveal_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 030/031 · message threads + area board
alter table public.dm_messages add column if not exists parent_message_id bigint references public.dm_messages(id) on delete cascade;
create index if not exists idx_dm_messages_parent on public.dm_messages(parent_message_id);

create table if not exists public.area_messages (
  id bigserial primary key,
  author_id uuid references public.users(id) on delete cascade,
  lat float8 not null,
  lon float8 not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_area_messages_location on public.area_messages using gist (ll_to_earth(lat, lon));
create index if not exists idx_area_messages_created on public.area_messages(created_at desc);

-- 031 returned kilometres labelled as metres and compared against radius_m * 1000, which made a
-- "5 km" board global. Metres in, metres out.
create or replace function public.nearby_area_messages(p_lat float8, p_lon float8, p_radius_m int)
returns table (id bigint, author_id uuid, content text, created_at timestamptz, distance_m int)
language sql stable
set search_path = public
as $$
  select am.id, am.author_id, am.content, am.created_at,
         earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon))::int as distance_m
  from public.area_messages am
  where earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) <= p_radius_m
  order by am.created_at desc
  limit 200
$$;
revoke all on function public.nearby_area_messages(float8, float8, int) from public, anon, authenticated;
grant execute on function public.nearby_area_messages(float8, float8, int) to service_role;

-- 035 · Desperate mode
create table if not exists public.desperate_alerts (
  user_id  uuid primary key references public.users(id) on delete cascade,
  until    timestamptz not null,
  sent_at  timestamptz not null default now(),
  reached  integer not null default 0
);
create index if not exists idx_desperate_alerts_until on public.desperate_alerts (until);

-- Server-only access for everything above (and for the 001 tables that still carried default grants).
do $$
declare t text;
begin
  foreach t in array array[
    'taste_vectors','match_scores','referral_codes','referral_signups','user_xp','user_stats',
    'leaderboard_snapshots','saved_filters','area_heatmaps','saved_trips','travel_mode',
    'area_messages','desperate_alerts','trips','room_messages','places'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;
