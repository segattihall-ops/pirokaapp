-- 040: Travel pin itinerary / origin. All values are destination-city calendar times,
-- not private GPS. Backwards compatible with existing date-only trips.
alter table public.trips add column if not exists arrival_time time without time zone;
alter table public.trips add column if not exists departure_on date;
alter table public.trips add column if not exists departure_time time without time zone;
-- The constraint did not exist on the inspected PIROKA production schema.
-- This is additive: it never drops an existing constraint.
alter table public.trips add constraint trip_departure_after_arrival
  check (departure_on is null or departure_on > arrive_on);

-- City-only traveler pins: add itinerary and optional user-provided origin code.
-- The search remains scoped to the requested city, subject to block and moderation rules.
-- Keep the existing RPC intact for clients still using the old response shape.
-- The itinerary RPC is additive and can be rolled out independently.
create function public.trips_near_v2(
  center_lat double precision,
  center_lon double precision,
  radius_m integer,
  requester_id uuid
)
returns table (
  id uuid, user_id uuid, handle text, city text, arrive_on date, nights smallint,
  photo_blur_key text, lat double precision, lon double precision,
  arrival_time time without time zone, departure_on date,
  departure_time time without time zone, origin_code text
)
language sql stable security definer set search_path = public as $travelv2$
  select
    t.id, t.user_id, u.handle, t.city, t.arrive_on, t.nights, p.blur_key,
    round(st_y(t.geo::geometry)::numeric, 2)::double precision,
    round(st_x(t.geo::geometry)::numeric, 2)::double precision,
    t.arrival_time, t.departure_on, t.departure_time, u.origin
  from public.trips t
  join public.users u on u.id = t.user_id
  left join public.photos p on p.user_id = u.id and p.slot = 0
  where st_dwithin(t.geo, st_point(center_lon, center_lat)::geography, radius_m)
    and coalesce(t.departure_on, t.arrive_on + t.nights) >= current_date
    and t.arrive_on <= current_date + 30
    and t.user_id <> requester_id
    and u.deleted_at is null
    and u.age_verified = true
    and u.visibility <> 'hidden'::public.visibility_t
    and (u.mod_step is null or u.mod_step not in ('suspended', 'removed'))
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = requester_id and b.blocked_id = t.user_id)
        or (b.blocker_id = t.user_id and b.blocked_id = requester_id)
    )
  order by t.arrive_on
  limit 100
$travelv2$;
revoke all on function public.trips_near_v2(double precision, double precision, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.trips_near_v2(double precision, double precision, integer, uuid)
  to service_role;
