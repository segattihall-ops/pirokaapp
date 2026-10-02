-- Phase 19: Advanced Alert System
-- Spike alerts, place monitoring, push notifications

-- Alert subscriptions
create table if not exists alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  alert_type text not null, -- 'activity_spike', 'place_alert', 'busy_area'
  enabled boolean not null default true,
  config jsonb, -- { threshold, min_profiles, alert_radius }
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamp with time zone not null default now(),

  unique(user_id, alert_type)
);

-- Alert history
create table if not exists alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references activity_alerts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  alert_type text not null,
  was_clicked boolean not null default false,
  clicked_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- Place alerts
create table if not exists place_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  last_activity_level integer, -- 0-100
  alert_sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),

  unique(user_id, place_id)
);

-- RLS
alter table alert_subscriptions enable row level security;
alter table alert_history enable row level security;
alter table place_alerts enable row level security;

create policy "users_manage_subscriptions" on alert_subscriptions
  for all using (auth.uid() = user_id);

create policy "users_see_own_history" on alert_history
  for select using (auth.uid() = user_id);

create policy "users_manage_place_alerts" on place_alerts
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_alert_subscriptions_user on alert_subscriptions(user_id);
create index if not exists idx_alert_history_user on alert_history(user_id);
create index if not exists idx_alert_history_type on alert_history(alert_type);
create index if not exists idx_place_alerts_user on place_alerts(user_id);
