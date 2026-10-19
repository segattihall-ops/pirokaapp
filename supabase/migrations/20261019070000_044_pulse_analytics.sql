-- 044: Pulse analytics history. An hourly cron snapshots how many members are active per coarse
-- (~11 km) cell, so the Trends tab shows a real curve instead of fabricated numbers. The Heatmap tab
-- reads live density directly from nearby_hotspots, so it needs no table.
create table if not exists activity_snapshots (
  bucket timestamptz not null,                 -- hour bucket
  cell_lat numeric(4, 1) not null,             -- round(lat, 1) ~ 11 km
  cell_lon numeric(4, 1) not null,
  active integer not null default 0,
  primary key (bucket, cell_lat, cell_lon)
);
create index if not exists activity_snapshots_cell_idx on activity_snapshots (cell_lat, cell_lon, bucket desc);
alter table activity_snapshots enable row level security;

-- Count members whose heartbeat is fresh, grouped into coarse cells, into the current hour bucket.
-- Coordinates come from public_geo (already fuzzed), never true_geo. Security definer so the cron
-- (service role) can run it; it reads only aggregate counts, never identities.
create or replace function pulse_snapshot() returns void
language sql security definer set search_path = public as $$
  insert into activity_snapshots (bucket, cell_lat, cell_lon, active)
  select date_trunc('hour', now()),
         round(ST_Y(public_geo::geometry)::numeric, 1),
         round(ST_X(public_geo::geometry)::numeric, 1),
         count(*)
  from locations
  where presence_at > now() - interval '20 minutes'
  group by 1, 2, 3
  on conflict (bucket, cell_lat, cell_lon) do update set active = excluded.active;
$$;
