-- 029: seed the 20 most active Dallas venues and parks (source: sniffies.com/map/us/tx/dallas/place-list,
-- coordinates from OpenStreetMap/Nominatim). Idempotent: a place is skipped when the same name already exists.
insert into public.places (name, kind, address, geo, verified, peak_hint)
select v.name, v.kind, v.address, st_point(v.lon, v.lat)::geography, true, v.peak_hint
from (values
  ('Club Dallas', 'sauna', '2616 Swiss Ave, Dallas, TX', -96.788544, 32.786524, 'Weekday evenings'),
  ('The Round-Up Saloon', 'bar', '3912 Cedar Springs Rd, Dallas, TX', -96.810385, 32.810606, 'Weekend nights'),
  ('JR''s Bar & Grill', 'bar', '3923 Cedar Springs Rd, Dallas, TX', -96.811293, 32.810753, 'Happy hour & weekends'),
  ('Woody''s', 'bar', '4011 Cedar Springs Rd, Dallas, TX', -96.811894, 32.811207, 'Weekend afternoons'),
  ('Station 4 (S4)', 'club', '3911 Cedar Springs Rd, Dallas, TX', -96.810991, 32.810428, 'Fri & Sat after 11pm'),
  ('Marty''s Live', 'bar', '4207 Maple Ave, Dallas, TX', -96.818667, 32.808283, 'Happy hour'),
  ('Pekers', 'bar', '2615 Oak Lawn Ave, Dallas, TX', -96.812799, 32.805541, 'Late nights'),
  ('Liquid Zoo', 'bar', '2506 Knight St, Dallas, TX', -96.817446, 32.807443, 'Evenings'),
  ('Havana Lounge', 'bar', '4006 Cedar Springs Rd, Dallas, TX', -96.811253, 32.811220, 'Weekend nights'),
  ('Kaliente', 'club', '4350 Maple Ave, Dallas, TX', -96.820284, 32.809652, 'Weekend nights'),
  ('Hunky''s', 'restaurant', '4000 Cedar Springs Rd, Dallas, TX', -96.811130, 32.811129, 'Lunch & weekend brunch'),
  ('Stoneleigh P', 'bar', '2926 Maple Ave, Dallas, TX', -96.806982, 32.798031, 'Evenings'),
  ('Reverchon Park', 'park', '3505 Maple Ave, Dallas, TX', -96.812897, 32.800375, 'After dark'),
  ('Turtle Creek Park', 'park', '3333 Turtle Creek Blvd, Dallas, TX', -96.804164, 32.808715, 'Evenings'),
  ('Exall Park', 'park', '1355 Adair St, Dallas, TX', -96.785110, 32.793228, 'Day or night'),
  ('Samuell Grand Park', 'park', '6200 E Grand Ave, Dallas, TX', -96.741285, 32.798807, 'After dark'),
  ('Tietze Park', 'park', '2700 Skillman St, Dallas, TX', -96.760824, 32.823373, 'After dark'),
  ('White Rock Lake', 'park', '8300 E Lawther Dr, Dallas, TX', -96.714721, 32.836714, 'Weekend afternoons'),
  ('Munger Park', 'park', 'Munger Blvd, Dallas, TX', -96.763795, 32.802807, 'After dark'),
  ('LA Fitness Uptown', 'gym', '2690 N Haskell Ave, Dallas, TX', -96.790677, 32.806877, 'Mornings & after work')
) as v(name, kind, address, lon, lat, peak_hint)
where not exists (select 1 from public.places p where lower(p.name) = lower(v.name));
