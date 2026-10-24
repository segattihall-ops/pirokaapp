-- 054 · Restore metres on public.nearby_area_messages.
--
-- Production (checked 2026-10-24, after 053) still has the pre-037 body that
-- draft PR #54 installed: earth_distance(...) / 1000, compared to
-- p_radius_m * 1000, with parent_id is null. earth_distance returns metres
-- (0.001 degrees of latitude is about 111.3). The board calls this with
-- p_radius_m = 8047, so the live filter matches about 8,047 km.
--
-- This replaces that body with migration 037's metre comparison
-- (earth_distance(...)::integer and <= p_radius_m, limit 200) and keeps
-- parent_id is null. Signature and return columns stay exactly:
--   nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer)
--   returns table (id bigint, author_id uuid, content text,
--                   created_at timestamp with time zone, distance_m integer)
-- lat and lon are used only to compute that integer distance. They are not
-- returned. search_path stays public, pg_temp (053).
--
-- Grants read on production: EXECUTE for postgres and service_role only,
-- neither WITH GRANT OPTION. No PUBLIC, anon, or authenticated. CREATE OR
-- REPLACE keeps an existing ACL; the statements below restate that ACL.
--
-- Idempotent. Re-running replaces the same function and grants. If
-- area_messages.parent_id is missing (main's migrations do not add it; the
-- column is in production from unmerged #54), the replace is skipped with a
-- notice. Migration 037's function, which is already in metres, is left as-is.
--
-- Do not apply from an app deploy. The owner applies this file after review.
-- If #54 later CREATE OR REPLACEs this function without the metre comparison
-- and without SET search_path, it puts the bug back. See the PR.
--
-- Rollback (previous production body, search_path and grants kept):
--   create or replace function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer)
--   returns table (id bigint, author_id uuid, content text, created_at timestamp with time zone, distance_m integer)
--   language sql stable
--   set search_path = public, pg_temp
--   as $$
--     select am.id, am.author_id, am.content, am.created_at,
--            (earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) / 1000)::integer
--     from area_messages am
--     where am.parent_id is null
--       and earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) <= p_radius_m * 1000
--     order by am.created_at desc
--   $$;
--   revoke all on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) from public, anon, authenticated;
--   grant execute on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) to postgres;
--   grant execute on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) to service_role;

do $mig$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'area_messages'
      and column_name = 'parent_id'
  ) then
    raise notice 'skipped nearby_area_messages metre fix: area_messages.parent_id is not present';
    return;
  end if;

  execute $fn$
    create or replace function public.nearby_area_messages(
      p_lat double precision,
      p_lon double precision,
      p_radius_m integer
    )
    returns table (
      id bigint,
      author_id uuid,
      content text,
      created_at timestamp with time zone,
      distance_m integer
    )
    language sql
    stable
    set search_path = public, pg_temp
    as $body$
      select
        am.id,
        am.author_id,
        am.content,
        am.created_at,
        public.earth_distance(public.ll_to_earth(p_lat, p_lon), public.ll_to_earth(am.lat, am.lon))::integer as distance_m
      from public.area_messages am
      where am.parent_id is null
        and public.earth_distance(public.ll_to_earth(p_lat, p_lon), public.ll_to_earth(am.lat, am.lon)) <= p_radius_m
      order by am.created_at desc
      limit 200
    $body$
  $fn$;

  execute 'revoke all on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) from public, anon, authenticated';
  execute 'grant execute on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) to postgres';
  execute 'grant execute on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) to service_role';
end
$mig$;
