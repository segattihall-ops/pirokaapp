-- 043: risk regions. Which countries get the higher-risk protections (location widened to Area,
-- photos blurred until mutual, fast meetups flagged). Admin-managed; service-role only.
-- A row's presence with enabled=true means the country is protected.
create table if not exists risk_regions (
  country text primary key,
  enabled boolean not null default true,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table risk_regions enable row level security;
