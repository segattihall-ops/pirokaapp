-- Privacy/security hardening for PIROKA groups.
-- Exact group geometry stays server-side. Public API callers only receive
-- safe metadata plus coarse distance through the server-owned RPC.

create index if not exists groups_location_geography_idx
  on public.groups
  using gist ((location::geography));

drop function if exists public.nearby_groups(double precision, double precision, double precision, integer);

create or replace function public.nearby_groups(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 50,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  description text,
  location_name text,
  photo text,
  members_count integer,
  created_at timestamp without time zone,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as point
  )
  select
    g.id,
    g.name,
    g.description,
    g.location_name,
    g.photo,
    coalesce(g.members_count, 0) as members_count,
    g.created_at,
    round((st_distance(g.location::geography, origin.point) / 1000.0)::numeric, 1)::double precision
      as distance_km
  from public.groups g
  cross join origin
  where st_dwithin(
    g.location::geography,
    origin.point,
    greatest(1.0, least(coalesce(p_radius_km, 50.0), 500.0)) * 1000.0
  )
  order by st_distance(g.location::geography, origin.point) asc, g.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.nearby_groups(double precision, double precision, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.nearby_groups(double precision, double precision, double precision, integer)
  to service_role;

revoke all privileges on table public.groups from anon, authenticated;
revoke all privileges on table public.group_members from anon, authenticated;

grant all privileges on table public.groups to service_role;
grant all privileges on table public.group_members to service_role;

-- The FK uses ON DELETE SET NULL, so the column must permit NULL.
alter table public.group_messages
  alter column sender_id drop not null;
