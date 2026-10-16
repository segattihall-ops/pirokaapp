-- 034: Passkeys (Face ID / Touch ID / fingerprint sign-in). Idempotent, service-role only.

create table if not exists public.passkeys (
  id            text primary key,                 -- credential id, base64url
  user_id       uuid not null references public.users(id) on delete cascade,
  public_key    text not null,                    -- COSE public key, base64url
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_type   text,                             -- singleDevice | multiDevice
  backed_up     boolean not null default false,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists idx_passkeys_user on public.passkeys(user_id);

-- One-time challenges for registration and sign-in ceremonies (5-minute lifetime).
create table if not exists public.webauthn_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  kind        text not null check (kind in ('register','authenticate')),
  challenge   text not null,
  expires_at  timestamptz not null default now() + interval '5 minutes',
  created_at  timestamptz not null default now()
);
create index if not exists idx_webauthn_challenges_expires on public.webauthn_challenges(expires_at);

alter table public.passkeys enable row level security;
alter table public.webauthn_challenges enable row level security;
revoke all privileges on table public.passkeys from anon, authenticated;
revoke all privileges on table public.webauthn_challenges from anon, authenticated;
grant all privileges on table public.passkeys to service_role;
grant all privileges on table public.webauthn_challenges to service_role;
