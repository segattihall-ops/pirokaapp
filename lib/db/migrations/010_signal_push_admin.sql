-- 010: Signal pre-keys, push subscriptions, users row provisioning, moderation columns.
-- Run after 001, 008, 009 and the RLS policies. Idempotent.

-- ---------- users: columns referenced by app code / RLS that 001 lacked ----------
alter table public.users add column if not exists mod_step mod_step_t;
alter table public.users add column if not exists verified_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users add column if not exists last_seen_at timestamptz;

alter table public.audit_log add column if not exists target_user_id uuid;
alter table public.audit_log add column if not exists details jsonb;

alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolved_by uuid;

-- ---------- 1:1 chat ciphertext (named dm_messages: some projects already own a `messages` table) ----------
create table if not exists public.dm_messages (
  id              bigserial primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id       uuid references public.users(id),
  ciphertext      bytea not null,
  kind            text default 'text',
  created_at      timestamptz not null default now()
);
create index if not exists idx_dm_messages_conversation_created on public.dm_messages(conversation_id, created_at desc);

alter table public.dm_messages enable row level security;
drop policy if exists "participants read dm messages" on public.dm_messages;
create policy "participants read dm messages"
  on public.dm_messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = dm_messages.conversation_id and (c.a_id = auth.uid() or c.b_id = auth.uid())
  ));
drop policy if exists "participants send dm messages" on public.dm_messages;
create policy "participants send dm messages"
  on public.dm_messages for insert
  with check (
    auth.uid() = sender_id and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.a_id = auth.uid() or c.b_id = auth.uid())
    )
  );

-- ---------- provision public.users from auth.users (own trigger name: never replace another app's) ----------
create or replace function public.handle_new_piroka_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, auth_provider, email)
  values (
    new.id,
    case
      when coalesce(new.is_anonymous, false) then 'anonymous'
      when coalesce(new.raw_app_meta_data->>'provider', 'email') in ('google', 'apple')
        then new.raw_app_meta_data->>'provider'
      else 'email'
    end,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created_piroka on auth.users;
create trigger on_auth_user_created_piroka
  after insert on auth.users
  for each row execute function public.handle_new_piroka_user();

-- Backfill anyone who signed up before this trigger existed.
insert into public.users (id, auth_provider, email)
select
  u.id,
  case
    when coalesce(u.is_anonymous, false) then 'anonymous'
    when coalesce(u.raw_app_meta_data->>'provider', 'email') in ('google', 'apple')
      then u.raw_app_meta_data->>'provider'
    else 'email'
  end,
  u.email
from auth.users u
on conflict (id) do nothing;

-- ---------- Signal pre-key bundles (public material only; private keys stay on device) ----------
create table if not exists public.signal_identities (
  user_id            uuid primary key references public.users(id) on delete cascade,
  identity_key       text not null,   -- X25519 public, base64
  signing_key        text not null,   -- Ed25519 public, base64
  signed_prekey_id   integer not null,
  signed_prekey      text not null,
  signed_prekey_sig  text not null,
  updated_at         timestamptz not null default now()
);

create table if not exists public.signal_one_time_prekeys (
  user_id     uuid not null references public.users(id) on delete cascade,
  key_id      integer not null,
  public_key  text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, key_id)
);

-- Atomically hand out one one-time pre-key for a user (or none if they ran out).
create or replace function public.claim_one_time_prekey(target uuid)
returns table (key_id integer, public_key text)
language sql
security definer
set search_path = public
as $$
  with picked as (
    select p.user_id, p.key_id
    from public.signal_one_time_prekeys p
    where p.user_id = target
    order by p.key_id
    limit 1
    for update skip locked
  )
  delete from public.signal_one_time_prekeys p
  using picked
  where p.user_id = picked.user_id and p.key_id = picked.key_id
  returning p.key_id, p.public_key;
$$;

alter table public.signal_identities enable row level security;
alter table public.signal_one_time_prekeys enable row level security;

drop policy if exists "identities readable by signed-in users" on public.signal_identities;
create policy "identities readable by signed-in users"
  on public.signal_identities for select
  using (auth.role() = 'authenticated');
-- writes and one-time key claims go through the service role only

-- ---------- Web push ----------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Realtime: chat needs INSERTs on dm_messages streamed to participants ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dm_messages'
  ) then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;
