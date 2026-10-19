-- 042: ambassadors. Members apply; admins approve/decline, and can remove an active ambassador.
-- Service-role only (all access through the server APIs).
create table if not exists ambassadors (
  id text primary key default ('AM-' || lpad((floor(random() * 99999))::text, 5, '0')),
  user_id uuid references users(id) on delete cascade,
  handle text,                      -- denormalised display name
  city text not null,
  hours text,                       -- self-reported availability, e.g. '2–4h'
  why text,                         -- application text
  status text not null default 'open' check (status in ('open', 'active', 'declined', 'removed')),
  actions integer not null default 0,  -- moderation actions taken while active
  agree integer not null default 0,    -- % agreement with moderators
  reviewer_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- One live row per member (a declined/removed member can re-apply only after that row is cleared).
create unique index if not exists ambassadors_user_live_idx
  on ambassadors (user_id) where status in ('open', 'active');
alter table ambassadors enable row level security;
