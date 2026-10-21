-- 047 phone verification — the earnable "phone" trust badge (trust_t already lists 'phone').
-- Additive: a stored number and a verified flag on users. The SMS code itself is never stored
-- (Twilio Verify holds it); we only record that a number was confirmed.

alter table public.users add column if not exists phone text;
alter table public.users add column if not exists phone_verified boolean not null default false;
