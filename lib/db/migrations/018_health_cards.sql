-- Sexual Health + Testing (Fase 11)

create table public.health_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text check (status in ('unverified', 'pending', 'verified', 'rejected')),
  hiv_month int check (hiv_month >= 0 and hiv_month <= 12),
  sti_month int check (sti_month >= 0 and sti_month <= 12),
  prevention text[] default '{}',
  visibility text check (visibility in ('private', 'verified_only', 'everyone')) default 'private',
  verified_month int,
  verified_tests text[] default '{}',
  verification_reason text,
  ciphertext bytea,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (user_id)
);

create index health_cards_status on public.health_cards(status);
create index health_cards_user_id on public.health_cards(user_id);

-- Health card shares: user A shares verified status with user B
create table public.health_shares (
  owner_id uuid not null references public.users(id) on delete cascade,
  grantee_id uuid not null references public.users(id) on delete cascade,
  shared_at timestamp default now(),
  primary key (owner_id, grantee_id)
);

create index health_shares_owner_id on public.health_shares(owner_id);
create index health_shares_grantee_id on public.health_shares(grantee_id);

-- Testing sites directory: seeded with verified sites
create table public.testing_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  zip text not null,
  latitude float not null,
  longitude float not null,
  phone text,
  website text,
  hours text,
  services text[] default '{}',
  verified boolean default false,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamp,
  source text default 'admin',
  created_at timestamp default now()
);

create index testing_sites_zip on public.testing_sites(zip);
create index testing_sites_location on public.testing_sites(latitude, longitude);
create index testing_sites_verified on public.testing_sites(verified);

-- Verifications queue: pending health card + test photo reviews
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('health_card', 'age', 'photo')) default 'health_card',
  user_id uuid not null references public.users(id) on delete cascade,
  data jsonb,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  reviewer_id uuid references public.users(id) on delete set null,
  rejection_reason text,
  created_at timestamp default now(),
  reviewed_at timestamp
);

create index verifications_status on public.verifications(status);
create index verifications_type on public.verifications(type);
create index verifications_user_id on public.verifications(user_id);

-- Row-level security
alter table public.health_cards enable row level security;
alter table public.health_shares enable row level security;
alter table public.testing_sites enable row level security;
alter table public.verifications enable row level security;

-- Health cards: users can read own, admins can see all
create policy "health_cards_select_own" on public.health_cards for select using (
  auth.uid() = user_id or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

create policy "health_cards_insert_own" on public.health_cards for insert with check (
  auth.uid() is not null and auth.uid() = user_id
);

create policy "health_cards_update_own" on public.health_cards for update using (
  auth.uid() = user_id
);

-- Health shares: users can read/write own, admins can see all
create policy "health_shares_select" on public.health_shares for select using (
  auth.uid() = owner_id or auth.uid() = grantee_id or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

create policy "health_shares_insert_own" on public.health_shares for insert with check (
  auth.uid() is not null and auth.uid() = owner_id
);

create policy "health_shares_delete_own" on public.health_shares for delete using (
  auth.uid() = owner_id
);

-- Testing sites: public read, admins can write
create policy "testing_sites_select_all" on public.testing_sites for select using (true);

create policy "testing_sites_insert_admin" on public.testing_sites for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

create policy "testing_sites_update_admin" on public.testing_sites for update using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Verifications: users can read own, admins can see all
create policy "verifications_select" on public.verifications for select using (
  auth.uid() = user_id or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

create policy "verifications_insert_admin" on public.verifications for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

create policy "verifications_update_admin" on public.verifications for update using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
