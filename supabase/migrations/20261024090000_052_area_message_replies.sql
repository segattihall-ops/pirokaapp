-- 052 · Area Board replies (one level)
--
-- A reply is an area_messages row whose parent_id points at a top-level post. The board shows only
-- top-level posts; replies are fetched per-thread and counted in the API. FK is ON DELETE CASCADE,
-- so deleting a post removes its replies.
--
-- The RPC keeps its exact return signature (no new column) so this is a plain CREATE OR REPLACE —
-- no destructive DROP. It only gains the `parent_id is null` filter so replies never surface as
-- top-level board posts. Reply counts are computed in the API from a grouped read.

alter table area_messages add column if not exists parent_id bigint references area_messages(id) on delete cascade;
create index if not exists idx_area_messages_parent on area_messages(parent_id);

create or replace function nearby_area_messages(p_lat float8, p_lon float8, p_radius_m int)
returns table(
  id bigint, author_id uuid, content text, created_at timestamptz, distance_m int
) as $$
  select
    am.id, am.author_id, am.content, am.created_at,
    (earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) / 1000)::int
  from area_messages am
  where am.parent_id is null
    and earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) <= p_radius_m * 1000
  order by am.created_at desc
$$ language sql stable;
