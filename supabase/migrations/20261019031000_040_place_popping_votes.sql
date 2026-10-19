-- 040: authentic on-site "It's popping!" votes. A vote expires with the user's live check-in.
-- Never infer a flame from crowd size alone. Five distinct active on-site votes are required.
create table if not exists public.place_pop_votes (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index if not exists idx_place_pop_votes_active on public.place_pop_votes(place_id, expires_at);
alter table public.place_pop_votes enable row level security;
revoke all privileges on table public.place_pop_votes from public, anon, authenticated;
grant select, insert, update, delete on table public.place_pop_votes to service_role;
