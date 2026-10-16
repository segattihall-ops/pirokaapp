-- App v2 map: every PIROKA Mode intent from the prototype, the "Can travel" radius,
-- and Premium "Desperate" alerts (30 minutes, once every 3 hours).

-- 'couchless' = can't host and can't travel far. The enum already holds next / travel.
alter type intent_t add value if not exists 'couchless';

alter table public.statuses add column if not exists travel_mi smallint
  check (travel_mi is null or travel_mi between 1 and 15);

-- One row per member. `until` is the end of the current alert; `sent_at` drives the 3-hour cooldown.
create table if not exists public.desperate_alerts (
  user_id  uuid primary key references public.users(id) on delete cascade,
  until    timestamptz not null,
  sent_at  timestamptz not null default now(),
  reached  integer not null default 0
);
create index if not exists idx_desperate_alerts_until on public.desperate_alerts (until);

-- Server-only, like the rest of the presence data: the API joins it to nearby_users by id.
alter table public.desperate_alerts enable row level security;
revoke all privileges on table public.desperate_alerts from anon, authenticated;
grant all privileges on table public.desperate_alerts to service_role;
