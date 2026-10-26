-- 053 · Email verification (trust badge) — replaces the Twilio SMS phone badge.
--
-- The member proves control of an email address with a 6-digit code we generate, send (via the app's
-- own mailer) and check ourselves — no third-party SMS provider. We store only the verified address
-- and a flag on the users row; the pending code lives hashed in email_otps and is deleted on success.
-- Both statements on users are idempotent. The phone_* columns (047) are left in place but unused.

alter table users add column if not exists email_verified boolean not null default false;
alter table users add column if not exists verified_email text;

create table if not exists email_otps (
  user_id uuid primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Service-role only, like the rest of the app's tables: RLS on, no policies, so the anon/auth roles
-- can never read a pending code. Only supabaseAdmin (service role) touches this table.
alter table email_otps enable row level security;
