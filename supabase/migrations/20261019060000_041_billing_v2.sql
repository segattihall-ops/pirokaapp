-- 041: Plans & billing (FEATURES §10) — pause / cancel-at-period-end / resume, promo codes,
-- complimentary months, billing email, receipts. Idempotent; service-role access only.

alter table public.users add column if not exists billing_email text;
alter table public.users add column if not exists paypal_payer_email text;
alter table public.users add column if not exists renews_at timestamptz;      -- next PayPal charge
alter table public.users add column if not exists cancel_at timestamptz;      -- keeps the plan until then
alter table public.users add column if not exists paused_until timestamptz;   -- PayPal suspended; auto-reactivated
alter table public.users add column if not exists comp_plan text check (comp_plan in ('plus','premium'));
alter table public.users add column if not exists comp_until timestamptz;     -- complimentary access (promo / invite)

comment on column public.users.cancel_at is 'Subscription cancelled at PayPal; the member keeps the plan until this time, then lifecycle reverts to free.';
comment on column public.users.paused_until is 'Subscription suspended at PayPal until this time; lifecycle re-activates it.';
comment on column public.users.comp_until is 'Complimentary plan (promo or invite code) end; lifecycle reverts to free when it passes and no paid subscription is active.';

-- Receipts carry the plan they paid for.
alter table public.payments add column if not exists plan text;
alter table public.payments add column if not exists receipt_no text;
create unique index if not exists idx_payments_receipt_no on public.payments (receipt_no) where receipt_no is not null;

create sequence if not exists public.receipt_seq start 10420;

-- Campaign promo codes (PRIDE26 …). Invite codes live in referral_codes (023) and are PIROKA-<code>.
create table if not exists public.promo_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{4,24}$'),
  plan        text not null default 'plus' check (plan in ('plus','premium')),
  months      int  not null default 1 check (months between 1 and 12),
  max_uses    int,
  used_count  int  not null default 0,
  expires_at  timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  id          bigserial primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  code        text not null,
  kind        text not null check (kind in ('promo','invite')),
  plan        text not null,
  months      int  not null,
  redeemed_at timestamptz not null default now(),
  unique (user_id, code)
);
create index if not exists idx_promo_redemptions_user on public.promo_redemptions (user_id);

insert into public.promo_codes (code, plan, months, expires_at)
values ('PRIDE26', 'plus', 1, '2026-12-31T23:59:59Z')
on conflict (code) do nothing;

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.promo_codes from anon, authenticated;
revoke all on public.promo_redemptions from anon, authenticated;

create or replace function public.next_receipt_no() returns text
language sql volatile security definer set search_path = public as $$
  select 'INV-' || nextval('public.receipt_seq')::text
$$;
revoke all on function public.next_receipt_no() from public, anon, authenticated;
