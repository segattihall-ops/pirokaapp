-- 053 · Pin search_path on the two advisor hits, and try to lock down PostGIS
-- st_estimatedextent.
--
-- function_search_path_mutable (checked 2026-10-24 on project clwqmzgoqfqibnfevhyb):
--   public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer)
--   public.campaign_segment_sql(p_segment text)
-- Both are LANGUAGE sql, not SECURITY DEFINER, owned by postgres, and proconfig is null.
--
-- The signatures above are the production identities from pg_get_function_identity_arguments.
-- nearby_area_messages keeps that same argument list in migration 037 and in draft PR #54
-- (20261024090000). This file does not CREATE OR REPLACE either function, so it does not
-- depend on area_messages.parent_id and it does not change the #54 body. It is safe whether
-- or not 052 has run.
--
-- Extensions on this database: postgis, earthdistance, and cube are in schema public.
-- nearby_area_messages calls unqualified earth_distance() and ll_to_earth() (both public).
-- campaign_segment_sql uses only built-in SQL, which resolves through pg_catalog even when
-- search_path is pinned. search_path = public, pg_temp is enough. Schema extensions holds
-- pgcrypto, uuid-ossp, and pg_stat_statements; these two functions do not call them.
-- pg_temp is last so a temporary object cannot shadow public.
--
-- Both functions already GRANT EXECUTE to service_role only. The GRANT below repeats that
-- so the privilege stays explicit. Supabase requires an explicit grant to service_role for
-- objects created after 30 October 2026. ALTER FUNCTION does not create a new object.
--
-- If 20261024090000 is applied again after this file, its CREATE OR REPLACE omits
-- SET search_path and clears this pin. Apply this file after that one.
--
-- The owner applies this file after review. Do not apply it from an app deploy.
--
-- Rollback:
--   alter function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) reset search_path;
--   alter function public.campaign_segment_sql(p_segment text) reset search_path;
--   grant execute on function public.st_estimatedextent(text, text) to public, anon, authenticated;
--   grant execute on function public.st_estimatedextent(text, text, text) to public, anon, authenticated;
--   grant execute on function public.st_estimatedextent(text, text, text, boolean) to public, anon, authenticated;
-- The st_estimatedextent grants are only needed if the revoke below actually ran.
-- campaign_segment_sql is created in lib/db/migrations/032, not under supabase/migrations.
-- A database that has never created it skips that pin with a notice.

do $$
begin
  if to_regprocedure('public.nearby_area_messages(double precision, double precision, integer)') is null then
    raise notice 'skipped search_path on public.nearby_area_messages(double precision, double precision, integer): function not found';
  else
    execute 'alter function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) set search_path = public, pg_temp';
    execute 'grant execute on function public.nearby_area_messages(p_lat double precision, p_lon double precision, p_radius_m integer) to service_role';
  end if;

  if to_regprocedure('public.campaign_segment_sql(text)') is null then
    raise notice 'skipped search_path on public.campaign_segment_sql(text): function not found';
  else
    execute 'alter function public.campaign_segment_sql(p_segment text) set search_path = public, pg_temp';
    execute 'grant execute on function public.campaign_segment_sql(p_segment text) to service_role';
  end if;
end
$$;

-- anon_security_definer_function_executable and
-- authenticated_security_definer_function_executable: three PostGIS overloads,
-- SECURITY DEFINER, owner supabase_admin.
-- Production ACLs grant EXECUTE to PUBLIC as well as to anon and authenticated.
-- anon and authenticated keep access through PUBLIC unless that grant is revoked too,
-- so this revoke lists public, anon, and authenticated. service_role, postgres, and
-- supabase_admin keep their own grants.
-- A session that is not the owner, or that is not supabase_admin, gets
-- insufficient_privilege. Notice and continue so this migration never fails on that.

do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.st_estimatedextent(text, text)',
    'public.st_estimatedextent(text, text, text)',
    'public.st_estimatedextent(text, text, text, boolean)'
  ]
  loop
    begin
      if to_regprocedure(sig) is null then
        raise notice 'skipped revoke on %: function not found', sig;
      else
        execute format(
          'revoke execute on function %s from public, anon, authenticated',
          sig
        );
      end if;
    exception
      when insufficient_privilege then
        raise notice 'skipped revoke on %: insufficient_privilege: %', sig, sqlerrm;
    end;
  end loop;
end
$$;
