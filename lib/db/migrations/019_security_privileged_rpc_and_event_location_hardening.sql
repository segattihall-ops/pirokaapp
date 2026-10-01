-- Harden privileged PIROKA RPCs and event location privacy.

revoke all on function public.claim_one_time_prekey(uuid) from public, anon, authenticated;
grant execute on function public.claim_one_time_prekey(uuid) to service_role;

revoke all on function public.favoriters_near(uuid, double precision, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.favoriters_near(uuid, double precision, double precision, integer)
  to service_role;

revoke all on function public.favoriters_of(uuid) from public, anon, authenticated;
grant execute on function public.favoriters_of(uuid) to service_role;

revoke all on function public.trips_near(double precision, double precision, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.trips_near(double precision, double precision, integer, uuid)
  to service_role;

revoke all on function public.handle_new_piroka_user() from public, anon, authenticated;

create or replace function public.expire_old_statuses()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.statuses where ends_at < now();
  return null;
end
$$;
revoke all on function public.expire_old_statuses() from public, anon, authenticated;

create or replace function public.expire_old_checkins()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.checkins where expires_at < now();
  return null;
end
$$;
revoke all on function public.expire_old_checkins() from public, anon, authenticated;

drop function if exists public.nearby_events(double precision, double precision, double precision);

create or replace function public.nearby_events(
  user_lat double precision,
  user_lon double precision,
  radius_km double precision
)
returns table (
  id uuid,
  creator_id uuid,
  title text,
  description text,
  location_name text,
  photo text,
  starts_at timestamp without time zone,
  ends_at timestamp without time zone,
  category text,
  max_attendees integer,
  created_at timestamp without time zone,
  attendee_count integer,
  my_rsvp_status text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_point(user_lon, user_lat)::geography as point
  )
  select
    e.id,
    e.creator_id,
    e.title,
    e.description,
    e.location_name,
    e.photo,
    e.starts_at,
    e.ends_at,
    e.category::text,
    e.max_attendees,
    e.created_at,
    (select count(*) from public.event_attendees a where a.event_id = e.id)::int as attendee_count,
    null::text as my_rsvp_status,
    round((st_distance(e.location::geography, origin.point) / 1000.0)::numeric, 1)::double precision
      as distance_km
  from public.events e
  cross join origin
  where st_dwithin(
    e.location::geography,
    origin.point,
    greatest(1.0, least(coalesce(radius_km, 10.0), 50.0)) * 1000.0
  )
    and e.starts_at > now()
  order by e.starts_at asc;
$$;

revoke all on function public.nearby_events(double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.nearby_events(double precision, double precision, double precision)
  to service_role;
