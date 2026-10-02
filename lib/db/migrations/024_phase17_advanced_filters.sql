-- Phase 17: Advanced Filters & Saved Filters
-- Premium discovery features for PIROKA+

-- Saved filters table
create table if not exists saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  filter_config jsonb not null,
  is_active boolean not null default true,
  use_count integer not null default 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Advanced search history
create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  query jsonb not null,
  results_count integer,
  location point,
  search_type text not null, -- 'local', 'city', 'global'
  created_at timestamp with time zone not null default now()
);

-- Compound filter presets
create table if not exists filter_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  filters jsonb not null, -- { age_range, distance, intent, status, verification, ethnicity, position_marks }
  sort_by text, -- 'recently_active', 'distance', 'newest_profile'
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  unique(user_id, name)
);

-- RLS Policies
alter table saved_filters enable row level security;
alter table search_history enable row level security;
alter table filter_presets enable row level security;

create policy "users_see_own_filters" on saved_filters
  for select using (auth.uid() = user_id);

create policy "users_create_filters" on saved_filters
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_filters" on saved_filters
  for update using (auth.uid() = user_id);

create policy "users_see_own_history" on search_history
  for select using (auth.uid() = user_id);

create policy "users_create_history" on search_history
  for insert with check (auth.uid() = user_id);

create policy "users_see_own_presets" on filter_presets
  for select using (auth.uid() = user_id);

create policy "users_crud_presets" on filter_presets
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_saved_filters_user on saved_filters(user_id);
create index if not exists idx_saved_filters_active on saved_filters(user_id, is_active);
create index if not exists idx_search_history_user on search_history(user_id);
create index if not exists idx_search_history_created on search_history(created_at desc);
create index if not exists idx_filter_presets_user on filter_presets(user_id);
create index if not exists idx_filter_presets_default on filter_presets(user_id, is_default);
