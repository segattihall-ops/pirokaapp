-- 041: support tickets. The Help "talk to a person" helper opens a ticket here; the admin Support
-- queue reads and answers them. Service-role only (all access goes through the server APIs).
create table if not exists support_tickets (
  id text primary key default ('SP-' || lpad((floor(random() * 99999))::text, 5, '0')),
  user_id uuid references users(id) on delete set null,
  handle text,                      -- denormalised display name; null for guests (no account)
  email text,                       -- optional contact a guest can leave
  topic text not null,
  lang text not null default 'EN',  -- 'EN' | 'PT' | 'ES'
  body text not null,
  plan text,                        -- real plan at submit time, for SLA (free/plus/premium)
  status text not null default 'open' check (status in ('open', 'replied', 'escalated', 'resolved')),
  reply text,
  handled_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index if not exists support_tickets_status_idx on support_tickets (status, created_at desc);
alter table support_tickets enable row level security;
-- No policies: only the service role (server APIs) may read or write. Members never query it directly.
