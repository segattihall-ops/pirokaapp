-- Phase 20: Travel Intelligence & Destination Insights
-- Saved trips, destination activity, arrival intelligence

-- Saved trips
create table if not exists saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  destination_city text not null,
  destination_country text,
  arrival_date date,
  departure_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Destination insights
create table if not exists destination_insights (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  country text,
  avg_active_profiles integer,
  peak_hours text[], -- ['18', '19', '20', '21', '22'] for 6-10pm
  popular_places uuid[], -- top place ids
  activity_level text, -- 'low', 'moderate', 'high'
  verified_users_pct float,
  avg_response_time integer, -- minutes
  last_updated timestamp with time zone,
  created_at timestamp with time zone not null default now(),

  unique(city, country)
);

-- Trip activities
create table if not exists trip_activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references saved_trips(id) on delete cascade,
  activity_type text not null, -- 'viewed_profiles', 'sent_messages', 'planned_meetup'
  count integer,
  created_at timestamp with time zone not null default now()
);

-- Travel mode status
create table if not exists travel_mode (
  user_id uuid primary key references users(id) on delete cascade,
  is_active boolean not null default false,
  destination_city text,
  appears_in_destination boolean not null default true,
  reveal_date date, -- when to show profile in destination
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- RLS
alter table saved_trips enable row level security;
alter table destination_insights enable row level security;
alter table trip_activities enable row level security;
alter table travel_mode enable row level security;

create policy "users_manage_trips" on saved_trips
  for all using (auth.uid() = user_id);

create policy "public_destination_insights" on destination_insights
  for select using (true);

create policy "users_see_trip_activities" on trip_activities
  for select using (
    auth.uid() in (
      select user_id from saved_trips where id = trip_activities.trip_id
    )
  );

create policy "users_manage_travel_mode" on travel_mode
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_saved_trips_user on saved_trips(user_id);
create index if not exists idx_saved_trips_active on saved_trips(user_id, is_active);
create index if not exists idx_saved_trips_dates on saved_trips(arrival_date, departure_date);
create index if not exists idx_destination_insights_city on destination_insights(city);
create index if not exists idx_trip_activities_trip on trip_activities(trip_id);
create index if not exists idx_travel_mode_active on travel_mode(is_active);
