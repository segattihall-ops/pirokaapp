-- 013: notification center, favourites + go-live alerts, private album requests, trips (travel mode).

-- Notifications: richer kinds, a title and a deep link; indexed for the unread badge.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('message','match','album','album_request','album_grant','favorite','arrival','status','safety','call'));
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists url text;
create index if not exists idx_notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;
create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);

-- Favourites: reverse lookup ("who favourited me") for go-live alerts.
create index if not exists idx_favorites_fav on public.favorites (fav_id) where alerts;

-- Album requests: timestamp of the decision so the requester can ask again after a while.
alter table public.album_requests add column if not exists decided_at timestamptz;

-- Trips: creation time + one active announcement per user per city.
alter table public.trips add column if not exists created_at timestamptz not null default now();
create index if not exists idx_trips_user on public.trips (user_id, arrive_on);

-- Favouriters of `owner` who currently sit within `radius_m` of a point (arrival alerts for a trip).
create or replace function public.favoriters_near(
  owner uuid,
  center_lat double precision,
  center_lon double precision,
  radius_m integer
)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select f.user_id
  from public.favorites f
  join public.locations l on l.user_id = f.user_id
  join public.users u on u.id = f.user_id
  where f.fav_id = owner
    and f.alerts
    and u.deleted_at is null
    and l.updated_at > now() - interval '24 hours'
    and st_dwithin(l.public_geo, st_point(center_lon, center_lat)::geography, radius_m)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = owner and b.blocked_id = f.user_id) or (b.blocker_id = f.user_id and b.blocked_id = owner)
    )
$$;

-- People who favourited `owner` and want alerts (go-live), minus blocks.
create or replace function public.favoriters_of(owner uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select f.user_id
  from public.favorites f
  join public.users u on u.id = f.user_id
  where f.fav_id = owner
    and f.alerts
    and u.deleted_at is null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = owner and b.blocked_id = f.user_id) or (b.blocker_id = f.user_id and b.blocked_id = owner)
    )
$$;

-- Trips visible on the map: announced arrivals near a point in the next 30 days.
create or replace function public.trips_near(
  center_lat double precision,
  center_lon double precision,
  radius_m integer,
  requester_id uuid
)
returns table (id uuid, user_id uuid, handle text, city text, arrive_on date, nights smallint, photo_blur_key text)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, u.handle, t.city, t.arrive_on, t.nights, p.blur_key
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

-- Account deletion must not be blocked by chat/meet rows; moderation records survive with the user reference cleared.
alter table public.conversations drop constraint if exists conversations_a_id_fkey, drop constraint if exists conversations_b_id_fkey;
alter table public.conversations
  add constraint conversations_a_id_fkey foreign key (a_id) references public.users(id) on delete cascade,
  add constraint conversations_b_id_fkey foreign key (b_id) references public.users(id) on delete cascade;
alter table public.dm_messages drop constraint if exists dm_messages_sender_id_fkey;
alter table public.dm_messages add constraint dm_messages_sender_id_fkey foreign key (sender_id) references public.users(id) on delete cascade;
alter table public.meets drop constraint if exists meets_a_id_fkey, drop constraint if exists meets_b_id_fkey;
alter table public.meets
  add constraint meets_a_id_fkey foreign key (a_id) references public.users(id) on delete cascade,
  add constraint meets_b_id_fkey foreign key (b_id) references public.users(id) on delete cascade;
alter table public.reports drop constraint if exists reports_reporter_id_fkey, drop constraint if exists reports_target_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.users(id) on delete set null,
  add constraint reports_target_id_fkey foreign key (target_id) references public.users(id) on delete set null;
alter table public.mod_actions drop constraint if exists mod_actions_user_id_fkey;
alter table public.mod_actions add constraint mod_actions_user_id_fkey foreign key (user_id) references public.users(id) on delete set null;
