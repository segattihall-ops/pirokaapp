-- 011: discovery — nearby people + hotspots (replaces the never-applied 008 functions), status expiry.
-- Never exposes true_geo: only the fuzzed public position leaves the database.

create index if not exists idx_locations_public_geo on public.locations using gist (public_geo);
create index if not exists idx_statuses_ends_at on public.statuses (ends_at desc);
create index if not exists idx_photos_user_slot on public.photos (user_id, slot);

drop function if exists public.nearby_users(double precision, double precision, integer, uuid, integer);
create or replace function public.nearby_users(
  user_lat double precision,
  user_lon double precision,
  radius_m integer,
  requester_id uuid,
  limit_count integer default 200
)
returns table (
  id uuid,
  handle text,
  lat double precision,
  lon double precision,
  distance_m double precision,
  intent text,
  intent_ends_at timestamptz,
  photo_blur_key text,
  verified boolean,
  plan text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.handle,
    st_y(l.public_geo::geometry) as lat,
    st_x(l.public_geo::geometry) as lon,
    st_distance(l.public_geo, st_point(user_lon, user_lat)::geography) as distance_m,
    s.intent::text,
    s.ends_at as intent_ends_at,
    p.blur_key as photo_blur_key,
    (u.verified_at is not null) as verified,
    u.plan::text,
    l.updated_at
  from public.locations l
  join public.users u on u.id = l.user_id
  left join public.statuses s on s.user_id = u.id and s.ends_at > now()
  left join public.photos p on p.user_id = u.id and p.slot = 0
  where st_dwithin(l.public_geo, st_point(user_lon, user_lat)::geography, radius_m)
    and u.id <> requester_id
    and u.deleted_at is null
    and u.handle is not null
    and (u.mod_step is null or u.mod_step not in ('suspended', 'removed'))
    and u.visibility <> 'hidden'
    and l.updated_at > now() - interval '24 hours'
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = requester_id and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = requester_id)
    )
  order by (s.intent is not null) desc, distance_m asc
  limit limit_count
$$;

drop function if exists public.nearby_hotspots(double precision, double precision, integer);
create or replace function public.nearby_hotspots(
  center_lat double precision,
  center_lon double precision,
  radius_m integer default 25000
)
returns table (lat double precision, lon double precision, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    avg(st_y(l.public_geo::geometry)) as lat,
    avg(st_x(l.public_geo::geometry)) as lon,
    count(*) as count
  from public.locations l
  join public.users u on u.id = l.user_id
  where st_dwithin(l.public_geo, st_point(center_lon, center_lat)::geography, radius_m)
    and u.deleted_at is null
    and u.visibility <> 'hidden'
    and l.updated_at > now() - interval '24 hours'
  group by st_geohash(l.public_geo::geometry, 7)
  having count(*) >= 3
  order by count desc
  limit 50
$$;

revoke all on function public.nearby_users(double precision, double precision, integer, uuid, integer) from public, anon, authenticated;
revoke all on function public.nearby_hotspots(double precision, double precision, integer) from public, anon, authenticated;

-- Statuses expire on their own; anything past ends_at is swept whenever a new one is set.
create or replace function public.expire_old_statuses() returns trigger language plpgsql as $$
begin
  delete from public.statuses where ends_at < now();
  return null;
end $$;
drop trigger if exists trigger_expire_statuses on public.statuses;
create trigger trigger_expire_statuses after insert on public.statuses for each statement execute function public.expire_old_statuses();
