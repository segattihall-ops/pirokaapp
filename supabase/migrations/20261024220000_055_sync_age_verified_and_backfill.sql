-- 055 — age-verified badge: one source of truth, and a backfill.
--
-- The age gate of record is a user's auth app_metadata (`age_verified`). Search and the
-- "verified" badge, however, read columns on public.users. Two problems had built up:
--   1. nearby_users judged "verified" off `users.verified_at`, which nothing ever wrote — so the
--      badge/filter matched nobody in nearby search.
--   2. The gate was never mirrored onto public.users at all, so `users.age_verified` lagged the
--      auth metadata (1 row true while 9 members were actually verified).
--
-- The app code now mirrors every grant/clear onto public.users (age_verified + verified_at).
-- This migration (a) points nearby_users at the same canonical boolean the rest of the app uses,
-- and (b) backfills public.users from the auth gate so existing members are correct immediately.
--
-- nearby_users is replaced with CREATE OR REPLACE (identical signature and body) — only the
-- "verified" expression changes — so no dependent view/policy is disturbed.

create or replace function public.nearby_users(
  user_lat double precision,
  user_lon double precision,
  radius_m integer,
  requester_id uuid,
  limit_count integer default 200
)
returns table(
  id uuid,
  handle text,
  lat double precision,
  lon double precision,
  distance_m double precision,
  intent text,
  intent_ends_at timestamp with time zone,
  photo_blur_key text,
  verified boolean,
  plan text,
  presence_at timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    u.id,
    u.handle,
    st_y(l.public_geo::geometry),
    st_x(l.public_geo::geometry),
    st_distance(l.public_geo, st_point(user_lon, user_lat)::geography),
    s.intent::text,
    s.ends_at,
    p.blur_key,
    (u.age_verified is true),
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
$function$;

-- Backfill from the gate of record (auth app_metadata). A held/declined account has its auth
-- flag set false already, so it stays unverified. verified_at keeps its existing value when set,
-- otherwise falls back to the last age-check update, otherwise now().
update public.users u
set
  age_verified = coalesce((a.raw_app_meta_data ->> 'age_verified')::boolean, false),
  verified_at = case
    when (a.raw_app_meta_data ->> 'age_verified')::boolean is true
      then coalesce(u.verified_at, u.age_check_updated_at, now())
    else null
  end
from auth.users a
where a.id = u.id
  and u.age_verified is distinct from coalesce((a.raw_app_meta_data ->> 'age_verified')::boolean, false);
