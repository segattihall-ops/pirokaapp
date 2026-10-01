-- P0 privacy lockdown: remove browser Data API access to sensitive profile
-- and legacy chat tables. Keep only authenticated SELECT paths required by
-- realtime DM RLS, scoped to conversation participants.

drop policy if exists "users_read" on public.users;
drop policy if exists "photos_read" on public.photos;
drop policy if exists "Allow read all profiles" on public.user_profiles;

revoke all privileges on table public.users from anon, authenticated;
revoke all privileges on table public.photos from anon, authenticated;
revoke all privileges on table public.user_profiles from anon, authenticated;

grant all privileges on table public.users to service_role;
grant all privileges on table public.photos to service_role;
grant all privileges on table public.user_profiles to service_role;

drop policy if exists "conversations_read" on public.conversations;
drop policy if exists "conversations_write" on public.conversations;

create policy "conversation participants read"
on public.conversations
for select
to authenticated
using (auth.uid() = a_id or auth.uid() = b_id);

revoke all privileges on table public.conversations from anon, authenticated;
grant select on table public.conversations to authenticated;
grant all privileges on table public.conversations to service_role;

revoke all privileges on table public.dm_messages from anon, authenticated;
grant select on table public.dm_messages to authenticated;
grant all privileges on table public.dm_messages to service_role;

drop policy if exists "messages_read" on public.messages;
drop policy if exists "messages_write" on public.messages;

revoke all privileges on table public.messages from anon, authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant all privileges on table public.messages to service_role;
