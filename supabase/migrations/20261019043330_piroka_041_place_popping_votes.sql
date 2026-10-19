-- 041: authentic on-site "It's popping!" votes. A vote expires with the user's live check-in.
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

-- Privacy-preserving proximity check. The API never returns true_geo or an exact distance.
-- Require a fresh location publication within 15 minutes, close to the venue (300m).
-- GPS is not hardware-attested: this rejects stale/remote casual votes but cannot prove
-- physical presence against a deliberately spoofed device fix.
create or replace function public.can_vote_popping(p_user uuid, p_place uuid)
returns boolean
language sql stable security definer set search_path = public as $poppingv1$
  select exists (
    select 1
    from public.locations l
    join public.places p on p.id = p_place
    where l.user_id = p_user
      and l.updated_at >= now() - interval '15 minutes'
      and st_dwithin(l.true_geo, p.geo, 300)
  );
$poppingv1$;
revoke all on function public.can_vote_popping(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_vote_popping(uuid, uuid) to service_role;
