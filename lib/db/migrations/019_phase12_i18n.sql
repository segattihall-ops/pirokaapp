-- Phase 12: i18n, Ethnicity, Position Marks
-- Add position marks (top/versatile/bottom) and language preference to users table

alter table users add column if not exists position_marks text[] not null default '{}';
alter table users add column if not exists language text not null default 'en' check (language in ('en', 'pt-BR', 'es'));

-- Index for language filtering
create index if not exists idx_users_language on users(language);
