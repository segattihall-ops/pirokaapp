-- Phase 15: Growth & Referral Program
-- Referral codes, tracking, XP system, and leaderboards

-- Referral codes table
create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code text not null unique check (length(code) >= 6 and length(code) <= 12),
  reward_credits integer not null default 100,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),

  constraint code_format check (code ~ '^[A-Z0-9]+$')
);

-- Referral signups
create table if not exists referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id) on delete set null,
  new_user_id uuid not null references users(id) on delete cascade,
  referral_code_id uuid not null references referral_codes(id) on delete cascade,
  reward_credited boolean not null default false,
  credited_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- XP system
create table if not exists user_xp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  amount integer not null check (amount != 0),
  action text not null, -- 'profile_complete', 'message_sent', 'photo_verified', 'referral_bonus'
  related_id uuid, -- profile/message/photo id
  created_at timestamp with time zone not null default now()
);

-- User stats (denormalized for performance)
create table if not exists user_stats (
  user_id uuid primary key references users(id) on delete cascade,
  total_xp integer not null default 0,
  messages_sent integer not null default 0,
  photos_verified integer not null default 0,
  referrals_completed integer not null default 0,
  conversations_count integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

-- Leaderboard snapshots (weekly)
create table if not exists leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  rank integer not null,
  user_id uuid not null references users(id) on delete cascade,
  total_xp integer not null,
  metric text not null, -- 'weekly_xp', 'referrals_count', 'messages_sent'
  created_at timestamp with time zone not null default now(),

  unique(snapshot_date, rank, metric)
);

-- RLS Policies
alter table referral_codes enable row level security;
alter table referral_signups enable row level security;
alter table user_xp enable row level security;
alter table user_stats enable row level security;
alter table leaderboard_snapshots enable row level security;

-- Users can only see their own referral codes
create policy "users_see_own_referral_codes" on referral_codes
  for select using (auth.uid() = user_id);

create policy "users_create_referral_codes" on referral_codes
  for insert with check (auth.uid() = user_id);

-- Users can see referral signups they received
create policy "referrers_see_their_signups" on referral_signups
  for select using (auth.uid() = referrer_id);

-- Only new users can see their own signup record
create policy "new_users_see_their_signup" on referral_signups
  for select using (auth.uid() = new_user_id);

-- Users see their own XP
create policy "users_see_own_xp" on user_xp
  for select using (auth.uid() = user_id);

-- Users see their stats
create policy "users_see_own_stats" on user_stats
  for select using (auth.uid() = user_id);

-- Leaderboards are public
create policy "public_leaderboard_access" on leaderboard_snapshots
  for select using (true);

-- Indexes
create index if not exists idx_referral_codes_user_id on referral_codes(user_id);
create index if not exists idx_referral_codes_code on referral_codes(code);
create index if not exists idx_referral_signups_referrer on referral_signups(referrer_id);
create index if not exists idx_referral_signups_new_user on referral_signups(new_user_id);
create index if not exists idx_referral_signups_referrer_created on referral_signups(referrer_id, created_at desc);
create index if not exists idx_user_xp_user on user_xp(user_id);
create index if not exists idx_user_xp_action on user_xp(action);
create index if not exists idx_user_xp_created on user_xp(created_at desc);
create index if not exists idx_leaderboard_snapshot_date_metric on leaderboard_snapshots(snapshot_date, metric);
create index if not exists idx_leaderboard_snapshot_rank on leaderboard_snapshots(snapshot_date, rank);
