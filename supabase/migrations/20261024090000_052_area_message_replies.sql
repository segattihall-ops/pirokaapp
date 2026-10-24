-- 052 · Area Board replies (one level)
--
-- A reply is an area_messages row whose parent_id points at a top-level post. The board itself shows
-- only top-level posts (parent_id is null) plus a reply count; replies are fetched per-thread. FK is
-- ON DELETE CASCADE, so deleting a post removes its replies. The RPC's return type gains a column, so
-- it must be dropped and recreated (Postgres can't change an existing function's TABLE signature in
-- place); the distance expression is preserved exactly as before.

alter table area_messages add column if not exists parent_id bigint references area_messages(id) on delete cascade;
create index if not exists idx_area_messages_parent on area_messages(parent_id);

drop function if exists nearby_area_messages(float8, float8, int);
create function nearby_area_messages(p_lat float8, p_lon float8, p_radius_m int)
returns table(
  id bigint, author_id uuid, content text, created_at timestamptz, distance_m int, reply_count int
) as $$
  select
    am.id, am.author_id, am.content, am.created_at,
    (earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) / 1000)::int,
    (select count(*) from area_messages r where r.parent_id = am.id)::int
  from area_messages am
  where am.parent_id is null
    and earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) <= p_radius_m * 1000
  order by am.created_at desc
$$ language sql stable;
