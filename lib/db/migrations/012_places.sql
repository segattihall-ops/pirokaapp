-- 012: places (nearby venues, check-ins), anonymous members on the map, check-in expiry.

alter table public.places add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.places add column if not exists created_at timestamptz not null default now();
alter table public.places add column if not exists address text;
create index if not exists idx_places_geo on public.places using gist (geo);
create index if not exists idx_checkins_expires on public.checkins (expires_at);

-- Anonymous members (handle null) still show on the map; the UI renders them as "Anonymous".
create or replace function public.nearby_users(
  user_lat double precision,
  user_lon double precision,
  radius_m integer,
  requester_id uuid,
  limit_count integer default 200
)
returns table (
  id uuid, handle text, lat double precision, lon double precision, distance_m double precision,
  intent text, intent_ends_at timestamptz, photo_blur_key text, verified boolean, plan text, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    u.id, u.handle,
    st_y(l.public_geo::geometry), st_x(l.public_geo::geometry),
    st_distance(l.public_geo, st_point(user_lon, user_lat)::geography),
    s.intent::text, s.ends_at, p.blur_key, (u.verified_at is not null), u.plan::text, l.updated_at
  from public.locations l
  join public.users u on u.id = l.user_id
  left join public.statuses s on s.user_id = u.id and s.ends_at > now()
  left join public.photos p on p.user_id = u.id and p.slot = 0
  where st_dwithin(l.public_geo, st_point(user_lon, user_lat)::geography, radius_m)
    and u.id <> requester_id
    and u.deleted_at is null
    and (u.mod_step is null or u.mod_step not in ('suspended', 'removed'))
    and u.visibility <> 'hidden'
    and l.updated_at > now() - interval '24 hours'
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = requester_id and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = requester_id)
    )
  order by (s.intent is not null) desc, 5 asc
  limit limit_count
$$;

drop function if exists public.nearby_places(double precision, double precision, integer, uuid);
create or replace function public.nearby_places(
  user_lat double precision,
  user_lon double precision,
  radius_m integer,
  requester_id uuid
)
returns table (
  id uuid, name text, kind text, address text, lat double precision, lon double precision, distance_m double precision,
  verified boolean, peak_hint text, here_count bigint, going_count bigint, my_kind text, my_expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.kind, p.address,
    st_y(p.geo::geometry), st_x(p.geo::geometry),
    st_distance(p.geo, st_point(user_lon, user_lat)::geography),
    p.verified, p.peak_hint,
    (select count(*) from public.checkins c where c.place_id = p.id and c.kind = 'here' and c.expires_at > now()),
    (select count(*) from public.checkins c where c.place_id = p.id and c.kind = 'going' and c.expires_at > now()),
    (select c.kind from public.checkins c where c.place_id = p.id and c.user_id = requester_id and c.expires_at > now() limit 1),
    (select c.expires_at from public.checkins c where c.place_id = p.id and c.user_id = requester_id and c.expires_at > now() limit 1)
  from public.places p
  where st_dwithin(p.geo, st_point(user_lon, user_lat)::geography, radius_m)
  order by 7 asc
  limit 100
$$;

revoke all on function public.nearby_places(double precision, double precision, integer, uuid) from public, anon, authenticated;

create or replace function public.expire_old_checkins() returns trigger language plpgsql as $$
begin
  delete from public.checkins where expires_at < now();
  return null;
end $$;
drop trigger if exists trigger_expire_checkins on public.checkins;
create trigger trigger_expire_checkins after insert on public.checkins for each statement execute function public.expire_old_checkins();
