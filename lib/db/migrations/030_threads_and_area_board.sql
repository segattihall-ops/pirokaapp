-- Add threading support to dm_messages
alter table dm_messages add column parent_message_id bigint references dm_messages(id) on delete cascade;
create index idx_dm_messages_parent on dm_messages(parent_message_id);

-- Area messages (public, location-based, not encrypted)
create table area_messages (
  id bigserial primary key,
  author_id uuid references users(id) on delete cascade,
  lat float8 not null, lon float8 not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_area_messages_location on area_messages using gist(ll_to_earth(lat, lon));
create index idx_area_messages_created on area_messages(created_at desc);

-- RLS for area messages (anyone can read within their area, only author can delete)
alter table area_messages enable row level security;
create policy "area_messages_select" on area_messages for select using (true);
create policy "area_messages_insert" on area_messages for insert with check (auth.uid() = author_id);
create policy "area_messages_delete" on area_messages for delete using (auth.uid() = author_id);
