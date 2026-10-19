-- 043: local board auto-posts (FEATURES §7). The post is written at the member's FUZZED public
-- position, rounded to the board's ~1 km grid, so the exact spot never reaches a public row.
-- Service-role only. Idempotent.
create or replace function public.board_auto_post(p_user uuid, p_content text) returns void
language plpgsql security definer set search_path = public as $$
declare
  g geometry;
begin
  select l.public_geo::geometry into g from public.locations l where l.user_id = p_user;
  if g is null then return; end if;
  insert into public.area_messages (author_id, lat, lon, content)
  values (p_user, round(st_y(g)::numeric, 2), round(st_x(g)::numeric, 2), left(p_content, 280));
end $$;
revoke all on function public.board_auto_post(uuid, text) from public, anon, authenticated;
