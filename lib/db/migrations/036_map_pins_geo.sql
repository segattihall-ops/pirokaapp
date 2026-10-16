-- App v2 map parity: give the map the coordinates it needs to draw event and arrival (traveler) pins,
-- the same way person and place pins already carry public positions. Additive; re-runnable.

-- Arrival pins: expose the trip's announced city point so "visiting soon" people can sit on the map.
drop function if exists public.trips_near(double precision, double precision, integer, uuid);
create function public.trips_near(
  center_lat double precision,
  center_lon double precision,
  radius_m integer,
  requester_id uuid
)
returns table (
  id uuid, user_id uuid, handle text, city text, arrive_on date, nights smallint,
  photo_blur_key text, lat double precision, lon double precision
)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, u.handle, t.city, t.arrive_on, t.nights, p.blur_key,
         st_y(t.geo::geometry), st_x(t.geo::geometry)
  from public.trips t
  join public.users u on u.id = t.user_id
  left join public.photos p on p.user_id = u.id and p.slot = 0
  where st_dwithin(t.geo, st_point(center_lon, center_lat)::geography, radius_m)
    and t.arrive_on + t.nights >= current_date
    and t.arrive_on <= current_date + 30
    and t.user_id <> requester_id
    and u.deleted_at is null
    and (u.mod_step is null or u.mod_step not in ('suspended', 'removed'))
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = requester_id and b.blocked_id = t.user_id) or (b.blocker_id = t.user_id and b.blocked_id = requester_id)
    )
  order by t.arrive_on
  limit 100
$$;
revoke all on function public.trips_near(double precision, double precision, integer, uuid) from public, anon, authenticated;
grant execute on function public.trips_near(double precision, double precision, integer, uuid) to service_role;

-- Event pins: add the venue coordinates to the nearby-events result.
drop function if exists public.nearby_events(double precision, double precision, double precision);
create function public.nearby_events(
  user_lat double precision,
  user_lon double precision,
  radius_km double precision
)
returns table (
  id uuid, creator_id uuid, title text, description text, location_name text, photo text,
  starts_at timestamp without time zone, ends_at timestamp without time zone, category text,
  max_attendees integer, created_at timestamp without time zone, attendee_count integer,
  my_rsvp_status text, distance_km double precision, lat double precision, lon double precision
)
language sql stable security definer set search_path = public as $$
  with origin as (select st_point(user_lon, user_lat)::geography as point)
  select
    e.id, e.creator_id, e.title, e.description, e.location_name, e.photo,
    e.starts_at, e.ends_at, e.category::text, e.max_attendees, e.created_at,
    (select count(*) from public.event_attendees a where a.event_id = e.id)::int as attendee_count,
    null::text as my_rsvp_status,
    round((st_distance(e.location::geography, origin.point) / 1000.0)::numeric, 1)::double precision as distance_km,
    st_y(e.location::geometry), st_x(e.location::geometry)
  from public.events e
  cross join origin
  where st_dwithin(e.location::geography, origin.point, greatest(1.0, least(coalesce(radius_km, 10.0), 50.0)) * 1000.0)
    and e.starts_at > now()
  order by e.starts_at asc;
$$;
revoke all on function public.nearby_events(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.nearby_events(double precision, double precision, double precision) to service_role;
