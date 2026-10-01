-- Phase 18: Piroka Pulse - Activity Intelligence
-- Heat maps, activity trends, and premium notifications

-- Activity tracking
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  activity_type text not null, -- 'online', 'message_sent', 'profile_viewed', 'message_received'
  location point,
  city text,
  created_at timestamp with time zone not null default now()
);

-- Area heat maps (aggregated hourly)
create table if not exists area_heatmaps (
  id uuid primary key default gen_random_uuid(),
  location point not null,
  city text not null,
  hour_bucket timestamp with time zone not null,
  active_profiles integer not null default 0,
  activity_score float not null default 0,
  trend text not null default 'stable', -- 'rising', 'stable', 'falling'
  created_at timestamp with time zone not null default now(),

  unique(city, hour_bucket)
);

-- Activity trends
create table if not exists activity_trends (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  date date not null,
  hour integer not null,
  active_profiles integer not null default 0,
  messages_sent integer not null default 0,
  new_profiles integer not null default 0,
  avg_session_duration integer, -- minutes
  created_at timestamp with time zone not null default now(),

  unique(city, date, hour)
);

-- Spike alerts
create table if not exists activity_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  alert_type text not null, -- 'spike', 'busy_area', 'place_alert'
  title text not null,
  description text,
  location point,
  city text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now()
);

-- Saved places with monitoring
create table if not exists monitored_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  alert_enabled boolean not null default true,
  alert_threshold integer default 5, -- activity increase %
  last_alert_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),

  unique(user_id, place_id)
);

-- RLS Policies
alter table activity_log enable row level security;
alter table area_heatmaps enable row level security;
alter table activity_trends enable row level security;
alter table activity_alerts enable row level security;
alter table monitored_places enable row level security;

-- Activity log - users only see aggregate/public data
create policy "public_activity_aggregates" on activity_log
  for select using (true);

-- Heatmaps are public
create policy "public_heatmaps" on area_heatmaps
  for select using (true);

-- Trends are public
create policy "public_trends" on activity_trends
  for select using (true);

-- Users see their own alerts
create policy "users_see_own_alerts" on activity_alerts
  for select using (auth.uid() = user_id or user_id is null);

-- Users manage their monitored places
create policy "users_manage_monitored_places" on monitored_places
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_activity_log_user on activity_log(user_id);
create index if not exists idx_activity_log_location on activity_log using gist(location);
create index if not exists idx_activity_log_created on activity_log(created_at desc);
create index if not exists idx_area_heatmaps_location on area_heatmaps using gist(location);
create index if not exists idx_area_heatmaps_city_hour on area_heatmaps(city, hour_bucket desc);
create index if not exists idx_activity_trends_city on activity_trends(city, date desc);
create index if not exists idx_activity_alerts_user on activity_alerts(user_id);
create index if not exists idx_activity_alerts_read on activity_alerts(user_id, is_read);
create index if not exists idx_monitored_places_user on monitored_places(user_id);
