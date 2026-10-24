-- 052 · Area Board replies (one level) — schema only.
--
-- A reply is an area_messages row whose parent_id points at a top-level post (FK ON DELETE CASCADE,
-- so deleting a post removes its replies). Reply counts are computed in the API from a grouped read.
--
-- This migration is deliberately schema-only (column + index). It does NOT redefine
-- nearby_area_messages: that function's body — the `parent_id is null` filter, the metre distance
-- comparison (053/054) and the pinned search_path — is owned by migration 054, which sorts last.
-- Keeping the function out of 052 means re-applying 052 in any order can never regress 054.
-- Both statements are idempotent.

alter table area_messages add column if not exists parent_id bigint references area_messages(id) on delete cascade;
create index if not exists idx_area_messages_parent on area_messages(parent_id);
