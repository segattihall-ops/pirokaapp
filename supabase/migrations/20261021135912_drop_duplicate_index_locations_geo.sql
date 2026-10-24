-- Drop a duplicate GiST index on locations.public_geo.
--
-- locations had two identical GiST indexes on public_geo: idx_locations_public_geo and
-- locations_public_geo_idx. This drops the redundant one, leaving locations_public_geo_idx.
-- Applied directly to production on 2026-10-21 (migration 20261021135912); this file backfills
-- the repo so the migration history and the tree match. Idempotent — a no-op where already dropped.

drop index if exists public.idx_locations_public_geo;
