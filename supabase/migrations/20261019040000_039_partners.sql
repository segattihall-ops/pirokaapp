-- 039 · Partner dashboard (design_handoff → Piroka Partners.dc.html, FEATURES §14)
--
-- Venues and clinics manage their own listing (hours, what they offer / services) and post events
-- that a local ambassador or admin reviews before they appear on the map. Partners only ever see
-- totals: the metrics table below carries no user ids, and every read goes through the service
-- role (RLS on, no policies, anon/authenticated revoked — the 032 rule).

-- Listing fields partners edit.
alter table public.places add column if not exists hours jsonb;
alter table public.places add column if not exists tags text[] not null default '{}';
alter table public.places add column if not exists partner_verified boolean not null default false;
alter table public.testing_sites add column if not exists hours_json jsonb;
alter table public.testing_sites add column if not exists services text[];
alter table public.testing_sites add column if not exists partner_verified boolean not null default false;

-- Events can belong to a listing and go through review. Member-created events stay 'approved'
-- (unchanged behaviour); partner-posted events start 'pending'.
alter table public.events add column if not exists place_id uuid references public.places(id) on delete set null;
alter table public.events add column if not exists review_status text not null default 'approved';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_review_status_check') then
    alter table public.events add constraint events_review_status_check
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;
alter table public.events add column if not exists reviewed_by uuid references public.users(id) on delete set null;
alter table public.events add column if not exists reviewed_at timestamptz;
alter table public.events add column if not exists review_note text;
create index if not exists idx_events_review_status on public.events(review_status);
create index if not exists idx_events_place on public.events(place_id);

-- Who manages which listing.
create table if not exists public.partner_members (
  user_id         uuid not null references public.users(id) on delete cascade,
  listing_kind    text not null check (listing_kind in ('place', 'testing_site')),
  place_id        uuid references public.places(id) on delete cascade,
  testing_site_id text,
  role            text not null default 'manager' check (role in ('owner', 'manager')),
  created_at      timestamptz not null default now(),
  check ((listing_kind = 'place' and place_id is not null) or (listing_kind = 'testing_site' and testing_site_id is not null))
);
create unique index if not exists idx_partner_members_place on public.partner_members(user_id, place_id) where place_id is not null;
create unique index if not exists idx_partner_members_site on public.partner_members(user_id, testing_site_id) where testing_site_id is not null;
create index if not exists idx_partner_members_user on public.partner_members(user_id);

-- "Claim your listing" requests, reviewed in the admin console.
create table if not exists public.partner_claims (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  listing_name text not null,
  address      text not null,
  kind         text not null check (kind in ('venue', 'clinic', 'organizer')),
  contact      text not null,
  place_id     uuid references public.places(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_partner_claims_status on public.partner_claims(status, created_at desc);

-- Anonymous counters behind the stat tiles (profile views, direction taps, calls). No user ids.
create table if not exists public.partner_metrics (
  id              bigserial primary key,
  listing_kind    text not null check (listing_kind in ('place', 'testing_site')),
  listing_id      text not null,
  kind            text not null check (kind in ('view', 'directions', 'call', 'checkin', 'going')),
  at              timestamptz not null default now()
);
create index if not exists idx_partner_metrics_listing on public.partner_metrics(listing_kind, listing_id, kind, at desc);

-- Count check-ins for the "Check-ins" tile without keeping who checked in: log an anonymous row
-- whenever a check-in is written. (checkins rows themselves are deleted when they expire.)
create or replace function public.log_partner_checkin() returns trigger language plpgsql as $$
begin
  insert into public.partner_metrics (listing_kind, listing_id, kind)
  values ('place', new.place_id::text, case when new.kind = 'here' then 'checkin' else 'going' end);
  return null;
end $$;
drop trigger if exists trigger_log_partner_checkin on public.checkins;
create trigger trigger_log_partner_checkin after insert on public.checkins for each row execute function public.log_partner_checkin();

alter table public.partner_members enable row level security;
alter table public.partner_claims enable row level security;
alter table public.partner_metrics enable row level security;
revoke all on public.partner_members, public.partner_claims, public.partner_metrics from public, anon, authenticated;

-- Listings a member manages, with the venue's own coordinates (a venue's address is public).
drop function if exists public.partner_listings_for(uuid);
create function public.partner_listings_for(member_id uuid)
returns table (
  listing_kind text, id text, name text, type text, address text, verified boolean,
  lat double precision, lon double precision, hours jsonb, tags text[], role text
)
language sql stable security definer set search_path = public as $$
  select 'place', p.id::text, p.name, p.kind, p.address, p.partner_verified,
         st_y(p.geo::geometry), st_x(p.geo::geometry), p.hours, p.tags, m.role
  from public.partner_members m join public.places p on p.id = m.place_id
  where m.user_id = member_id and m.listing_kind = 'place'
  union all
  select 'testing_site', t.id::text, t.name, 'clinic', t.address, t.partner_verified,
         st_y(t.geo::geometry), st_x(t.geo::geometry), t.hours_json, coalesce(t.services, '{}'), m.role
  from public.partner_members m join public.testing_sites t on t.id::text = m.testing_site_id
  where m.user_id = member_id and m.listing_kind = 'testing_site'
  order by 3
$$;
revoke all on function public.partner_listings_for(uuid) from public, anon, authenticated;
grant execute on function public.partner_listings_for(uuid) to service_role;

-- One listing by kind + id (admins may open any listing).
drop function if exists public.partner_listing_one(text, text);
create function public.partner_listing_one(p_kind text, p_id text)
returns table (
  listing_kind text, id text, name text, type text, address text, verified boolean,
  lat double precision, lon double precision, hours jsonb, tags text[]
)
language sql stable security definer set search_path = public as $$
  select 'place', p.id::text, p.name, p.kind, p.address, p.partner_verified,
         st_y(p.geo::geometry), st_x(p.geo::geometry), p.hours, p.tags
  from public.places p where p_kind = 'place' and p.id::text = p_id
  union all
  select 'testing_site', t.id::text, t.name, 'clinic', t.address, t.partner_verified,
         st_y(t.geo::geometry), st_x(t.geo::geometry), t.hours_json, coalesce(t.services, '{}')
  from public.testing_sites t where p_kind = 'testing_site' and t.id::text = p_id
$$;
revoke all on function public.partner_listing_one(text, text) from public, anon, authenticated;
grant execute on function public.partner_listing_one(text, text) to service_role;

-- Members only see approved events on the map and in lists.
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
    and coalesce(e.review_status, 'approved') = 'approved'
  order by e.starts_at asc;
$$;
revoke all on function public.nearby_events(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.nearby_events(double precision, double precision, double precision) to service_role;
