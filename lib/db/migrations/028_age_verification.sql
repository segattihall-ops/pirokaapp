-- Age Verification Fields
-- Supports self-declared (MVP), Yoti (month 1), and government ID (future)

alter table users add column if not exists age_verified boolean default false;
alter table users add column if not exists age_verified_at timestamp with time zone;
alter table users add column if not exists age_verification_method text; -- 'self-declared', 'yoti', 'government-id'

-- Audit log for age verifications
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action text not null, -- 'age_verification', 'payment_dispute', 'content_report'
  details jsonb,
  created_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table audit_log enable row level security;

create policy "users_see_own_audit_log" on audit_log
  for select using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_users_age_verified on users(age_verified);
create index if not exists idx_audit_log_user on audit_log(user_id);
create index if not exists idx_audit_log_action on audit_log(action);
