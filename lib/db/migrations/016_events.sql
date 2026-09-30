-- Events & group meetups (Fase 6)

create type public.event_category as enum ('party', 'meetup', 'sports', 'cultural', 'nightlife', 'other');
create type public.rsvp_status as enum ('interested', 'going', 'maybe');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  location public.geometry(point, 4326) not null,
  location_name text not null, -- "The Loft", "Cedar Springs Park"
  photo text, -- URL or storage path
  starts_at timestamp not null,
  ends_at timestamp not null,
  category public.event_category default 'other',
  max_attendees int, -- null = unlimited
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (ends_at > starts_at),
  check (max_attendees is null or max_attendees > 0)
);

create index events_creator_id on public.events(creator_id);
create index events_location on public.events using gist(location);
create index events_starts_at on public.events(starts_at);

-- Attendee RSVPs: user can RSVP to any event
create table public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.rsvp_status default 'interested',
  rsvp_at timestamp default now(),
  primary key (event_id, user_id)
);

create index event_attendees_user_id on public.event_attendees(user_id);

-- RLS: Realtime for attendee changes
alter table public.event_attendees replica identity full;

-- Row-level security
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

-- Anyone can list events by location (no auth needed)
create policy "events_select_all" on public.events for select using (true);

-- Creator can update/delete their own events
create policy "events_update_own" on public.events for update using (auth.uid() = creator_id);
create policy "events_delete_own" on public.events for delete using (auth.uid() = creator_id);

-- Auth'd users can create events
create policy "events_insert_auth" on public.events for insert with check (
  auth.uid() is not null and auth.uid() = creator_id
);

-- Anyone can see attendees of any event
create policy "event_attendees_select_all" on public.event_attendees for select using (true);

-- Authenticated users can RSVP to events (if event exists, the FK ensures it)
create policy "event_attendees_insert_auth" on public.event_attendees for insert with check (
  auth.uid() is not null and auth.uid() = user_id
);

-- Users can only remove their own RSVPs
create policy "event_attendees_delete_own" on public.event_attendees for delete using (
  auth.uid() is not null and auth.uid() = user_id
);

-- Users can update their own RSVP status
create policy "event_attendees_update_own" on public.event_attendees for update using (
  auth.uid() is not null and auth.uid() = user_id
);
