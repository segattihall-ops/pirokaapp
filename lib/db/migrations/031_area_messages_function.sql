-- Function to get nearby area messages with distance
create or replace function nearby_area_messages(
  p_lat float8, p_lon float8, p_radius_m int
)
returns table(
  id bigint, author_id uuid, content text, created_at timestamptz, distance_m int
) as $$
  select
    am.id, am.author_id, am.content, am.created_at,
    (earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) / 1000)::int
  from area_messages am
  where earth_distance(ll_to_earth(p_lat, p_lon), ll_to_earth(am.lat, am.lon)) <= p_radius_m * 1000
  order by am.created_at desc
$$ language sql stable;
