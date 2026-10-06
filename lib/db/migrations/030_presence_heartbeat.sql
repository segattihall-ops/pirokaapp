-- Keep app presence separate from location capture/retention.
-- updated_at remains the coordinate capture timestamp and continues to enforce
-- the 24-hour location retention/freshness boundary.
alter table public.locations
  add column if not exists presence_at timestamptz;

update public.locations
set presence_at = updated_at
where presence_at is null;

alter table public.locations
  alter column presence_at set default now(),
  alter column presence_at set not null;

drop function if exists public.nearby_users(
  double precision,
  double precision,
  integer,
  uuid,
  integer
);

create function public.nearby_users(
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
  presence_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.handle,
    st_y(l.public_geo::geometry),
    st_x(l.public_geo::geometry),
    st_distance(l.public_geo, st_point(user_lon, user_lat)::geography),
    s.intent::text,
    s.ends_at,
    p.blur_key,
    (u.verified_at is not null),
    u.plan::text,
    l.presence_at
  from public.locations l
  join public.users u on u.id = l.user_id
  left join public.statuses s on s.user_id = u.id and s.ends_at > now()
  left join public.photos p on p.user_id = u.id and p.slot = 0
  where st_dwithin(l.public_geo, st_point(user_lon, user_lat)::geography, radius_m)
    and u.id <> requester_id
    and u.deleted_at is null
    and (u.mod_step is null or u.mod_step not in ('suspended', 'removed'))
    and u.visibility <> 'hidden'
    -- Coordinate freshness/retention remains independent of presence heartbeats.
    and l.updated_at > now() - interval '24 hours'
    and not exists (
      select 1
      from public.blocks b
      where (b.blocker_id = requester_id and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = requester_id)
    )
  order by (s.intent is not null) desc, 5 asc
  limit limit_count
$$;

revoke all on function public.nearby_users(
  double precision,
  double precision,
  integer,
  uuid,
  integer
) from public, anon, authenticated;

grant execute on function public.nearby_users(
  double precision,
  double precision,
  integer,
  uuid,
  integer
) to service_role;
