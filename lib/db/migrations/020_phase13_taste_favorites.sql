-- Phase 13: AI Assistant, Taste Learning, Favorites
-- Track user preferences and match scoring

-- Taste vectors: record actions (like/pass/message) for taste learning
create table taste_vectors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  target_id     uuid not null references users(id) on delete cascade,
  action        text not null check (action in ('like', 'pass', 'message')),
  confidence    float not null default 0.5 check (confidence between 0 and 1),
  created_at    timestamptz not null default now(),
  unique (user_id, target_id, action)
);

create index idx_taste_vectors_user on taste_vectors(user_id);
create index idx_taste_vectors_target on taste_vectors(target_id);
create index idx_taste_vectors_action on taste_vectors(action);

-- Favorites: starred profiles
create table favorites (
  user_id       uuid not null references users(id) on delete cascade,
  favorite_id   uuid not null references users(id) on delete cascade,
  starred_at    timestamptz not null default now(),
  primary key (user_id, favorite_id)
);

create index idx_favorites_user on favorites(user_id);
create index idx_favorites_favorite on favorites(favorite_id);

-- Match scores: computed match compatibility (cached)
create table match_scores (
  user_id       uuid not null references users(id) on delete cascade,
  target_id     uuid not null references users(id) on delete cascade,
  score         float not null check (score between 0 and 1),
  computed_at   timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  primary key (user_id, target_id)
);

create index idx_match_scores_user on match_scores(user_id);
create index idx_match_scores_expires on match_scores(expires_at);

-- RLS: Users can read own taste vectors and match scores
alter table taste_vectors enable row level security;
create policy "users_read_own_taste_vectors" on taste_vectors
  for select using (auth.uid() = user_id or auth.uid() = target_id);
create policy "users_insert_own_taste_vectors" on taste_vectors
  for insert with check (auth.uid() = user_id);

alter table favorites enable row level security;
create policy "users_read_own_favorites" on favorites
  for select using (auth.uid() = user_id or auth.uid() = favorite_id);
create policy "users_insert_own_favorites" on favorites
  for insert with check (auth.uid() = user_id);

alter table match_scores enable row level security;
create policy "users_read_own_match_scores" on match_scores
  for select using (auth.uid() = user_id or auth.uid() = target_id);
