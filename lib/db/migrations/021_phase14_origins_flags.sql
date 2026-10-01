-- Phase 14: Origins + Flags
-- Add country origin and flag display support

alter table users add column if not exists origin text;
alter table users add column if not exists origin_flag text; -- Emoji flag code

-- Create index for filtering by origin
create index if not exists idx_users_origin on users(origin);
