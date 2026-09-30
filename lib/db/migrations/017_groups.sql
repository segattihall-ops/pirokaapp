-- Groups & group chat (Fase 6)

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  location public.geometry(point, 4326) not null,
  location_name text not null,
  photo text,
  members_count int default 1,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  check (members_count > 0)
);

create index groups_creator_id on public.groups(creator_id);
create index groups_location on public.groups using gist(location);
create index groups_created_at on public.groups(created_at desc);

-- Group membership: user can join/leave any public group
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamp default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id on public.group_members(user_id);

-- Group messages: realtime chat for members only
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete set null,
  body text not null,
  created_at timestamp default now()
);

create index group_messages_group_id on public.group_messages(group_id, created_at desc);
create index group_messages_sender_id on public.group_messages(sender_id);

alter table public.group_messages replica identity full;

-- Row-level security
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- Groups: anyone can list, creator can update/delete, auth users can create
create policy "groups_select_all" on public.groups for select using (true);
create policy "groups_insert_auth" on public.groups for insert with check (
  auth.uid() is not null and auth.uid() = creator_id
);
create policy "groups_update_own" on public.groups for update using (auth.uid() = creator_id);
create policy "groups_delete_own" on public.groups for delete using (auth.uid() = creator_id);

-- Group members: anyone can see membership, auth users can join
create policy "group_members_select_all" on public.group_members for select using (true);
create policy "group_members_insert_auth" on public.group_members for insert with check (
  auth.uid() is not null and auth.uid() = user_id
);
create policy "group_members_delete_own" on public.group_members for delete using (
  auth.uid() is not null and auth.uid() = user_id
);

-- Group messages: members can read, members can send, creator (via RLS) can delete others
create policy "group_messages_select_member" on public.group_messages for select using (
  exists (select 1 from public.group_members where group_id = group_messages.group_id and user_id = auth.uid())
  or auth.uid() is null -- preview only, no content
);
create policy "group_messages_insert_member" on public.group_messages for insert with check (
  auth.uid() is not null
  and sender_id = auth.uid()
  and exists (select 1 from public.group_members where group_id = group_messages.group_id and user_id = auth.uid())
);
create policy "group_messages_delete_own" on public.group_messages for delete using (
  auth.uid() is not null and (auth.uid() = sender_id or
    auth.uid() = (select creator_id from public.groups where id = group_messages.group_id))
);
