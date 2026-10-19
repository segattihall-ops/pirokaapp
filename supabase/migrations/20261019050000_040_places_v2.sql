-- 040: Places v2 — "I'm going" with an ETA, auto check-in on arrival, no-show accounting
-- (two in 30 days pause "I'm going" for 5 days), "It's popping!" votes (5+ on-site votes in
-- 90 min → red flame), visitors / peak-hour stats and the moderated place chat room.
-- Idempotent; safe to re-run. New tables are service-role only (the API layer owns access).

-- ─── checkins: arrival time for "going" ──────────────────────────────────────────────────
alter table public.checkins add column if not exists eta_at timestamptz;
alter table public.checkins add column if not exists created_at timestamptz not null default now();
comment on column public.checkins.eta_at is 'When a "going" member said they would arrive (15/30/60 min). Null for "here".';

-- ─── users: "I'm going" pause after two no-shows ─────────────────────────────────────────
alter table public.users add column if not exists going_paused_until timestamptz;
comment on column public.users.going_paused_until is 'Set to now()+5 days after two no-shows within 30 days; "I''m going" is refused until then.';

-- ─── no-shows ────────────────────────────────────────────────────────────────────────────
create table if not exists public.place_no_shows (
  id        bigserial primary key,
  user_id   uuid not null references public.users(id) on delete cascade,
  place_id  uuid not null references public.places(id) on delete cascade,
  eta_at    timestamptz,
  at        timestamptz not null default now()
);
create index if not exists idx_place_no_shows_user_at on public.place_no_shows (user_id, at desc);
alter table public.place_no_shows enable row level security;
-- No member policies: reads and writes go through the service role only.

-- ─── "It's popping!" votes ───────────────────────────────────────────────────────────────
create table if not exists public.place_votes (
  user_id   uuid not null references public.users(id) on delete cascade,
  place_id  uuid not null references public.places(id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists idx_place_votes_place_at on public.place_votes (place_id, at desc);
alter table public.place_votes enable row level security;

-- room_messages (001) is the place/group chat store ('p:<place_id>'). Lock it to the service role.
alter table public.room_messages enable row level security;

-- ─── expiry + no-show accounting ─────────────────────────────────────────────────────────
-- A "going" row that reaches its expiry without having become "here" is a no-show. Record it
-- (once — the delete makes this idempotent), then apply the pause when the member has two
-- no-shows in the last 30 days. Called by the API before every read/write of check-ins and by
-- the statement trigger below.
create or replace function public.record_no_shows() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    delete from public.checkins c
    where c.kind = 'going' and c.expires_at < now()
    returning c.user_id, c.place_id, c.eta_at
  ), logged as (
    insert into public.place_no_shows (user_id, place_id, eta_at)
    select user_id, place_id, eta_at from expired
    returning user_id
  )
  select count(*) into n from logged;

  update public.users u
  set going_paused_until = now() + interval '5 days'
  where (u.going_paused_until is null or u.going_paused_until < now())
    and (select count(*) from public.place_no_shows s
         where s.user_id = u.id and s.at > now() - interval '30 days') >= 2;

  delete from public.checkins where expires_at < now();
  delete from public.place_votes where at < now() - interval '90 minutes';
  return coalesce(n, 0);
end $$;
revoke all on function public.record_no_shows() from public, anon, authenticated;

create or replace function public.expire_old_checkins() returns trigger language plpgsql as $$
begin
  perform public.record_no_shows();
  return null;
end $$;
drop trigger if exists trigger_expire_checkins on public.checkins;
create trigger trigger_expire_checkins after insert on public.checkins for each statement execute function public.expire_old_checkins();

-- ─── nearby_places v2: popping, votes, visitors, my eta ──────────────────────────────────
drop function if exists public.nearby_places(double precision, double precision, integer, uuid);
create or replace function public.nearby_places(
  user_lat double precision,
  user_lon double precision,
  radius_m integer,
  requester_id uuid
)
returns table (
  id uuid, name text, kind text, address text, lat double precision, lon double precision, distance_m double precision,
  verified boolean, peak_hint text, here_count bigint, going_count bigint, visitors bigint, votes bigint, popping boolean,
  my_kind text, my_expires_at timestamptz, my_eta_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.kind, p.address,
    st_y(p.geo::geometry), st_x(p.geo::geometry),
    st_distance(p.geo, st_point(user_lon, user_lat)::geography),
    p.verified, p.peak_hint,
    (select count(*) from public.checkins c where c.place_id = p.id and c.kind = 'here' and c.expires_at > now()),
    (select count(*) from public.checkins c where c.place_id = p.id and c.kind = 'going' and c.expires_at > now()),
    (select count(*) from public.checkins c
       join public.statuses s on s.user_id = c.user_id and s.ends_at > now() and s.intent::text = 'visiting'
       where c.place_id = p.id and c.kind = 'here' and c.expires_at > now()),
    (select count(*) from public.place_votes v where v.place_id = p.id and v.at > now() - interval '90 minutes'),
    (select count(*) from public.place_votes v where v.place_id = p.id and v.at > now() - interval '90 minutes') >= 5,
    (select c.kind from public.checkins c where c.place_id = p.id and c.user_id = requester_id and c.expires_at > now() limit 1),
    (select c.expires_at from public.checkins c where c.place_id = p.id and c.user_id = requester_id and c.expires_at > now() limit 1),
    (select c.eta_at from public.checkins c where c.place_id = p.id and c.user_id = requester_id and c.expires_at > now() limit 1)
  from public.places p
  where st_dwithin(p.geo, st_point(user_lon, user_lat)::geography, radius_m)
  order by 7 asc
  limit 100
$$;
revoke all on function public.nearby_places(double precision, double precision, integer, uuid) from public, anon, authenticated;

-- ─── place detail: peak hour over the last 30 days (local to the server's time zone) ─────
create or replace function public.place_peak_hour(p_place uuid)
returns table (hour integer, checkins bigint)
language sql stable security definer set search_path = public as $$
  select extract(hour from c.created_at)::int as hour, count(*) as checkins
  from public.checkins c
  where c.place_id = p_place and c.kind = 'here' and c.created_at > now() - interval '30 days'
  group by 1 order by 2 desc, 1 asc limit 1
$$;
revoke all on function public.place_peak_hour(uuid) from public, anon, authenticated;

-- ─── auto check-in: is this fix within `max_m` of the place? Nothing is stored. ──────────
create or replace function public.place_within(p_place uuid, user_lat double precision, user_lon double precision, max_m integer)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.places p
    where p.id = p_place and st_dwithin(p.geo, st_point(user_lon, user_lat)::geography, max_m)
  )
$$;
revoke all on function public.place_within(uuid, double precision, double precision, integer) from public, anon, authenticated;
