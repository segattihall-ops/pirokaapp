-- 042: "Interested" signals (FEATURES §4). A signal stays anonymous to its target until the target
-- signals back, at which point both members see each other ("It's mutual"). Idempotent.
create table if not exists public.interests (
  from_id    uuid not null references public.users(id) on delete cascade,
  to_id      uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists idx_interests_to on public.interests (to_id);

alter table public.interests enable row level security;
revoke all on public.interests from anon, authenticated;
