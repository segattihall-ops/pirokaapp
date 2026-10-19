-- 045 profile_views — records who viewed whose profile, for the premium "Who viewed you" list.
-- One row per (viewer, viewee); a repeat view refreshes viewed_at. Service-role only: RLS is enabled
-- with no policy, so clients cannot read it directly — only the server APIs (via the service role)
-- expose it, gated by plan.

create table if not exists public.profile_views (
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewee_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_id, viewee_id),
  check (viewer_id <> viewee_id)
);

create index if not exists profile_views_viewee on public.profile_views(viewee_id, viewed_at desc);

alter table public.profile_views enable row level security;
revoke all on public.profile_views from anon, authenticated;
