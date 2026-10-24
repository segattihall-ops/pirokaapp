-- 051 · Per-member language preference
--
-- The language selector stores the choice in the `piroka_locale` cookie (which drives message
-- loading) and mirrors it here so the preference can follow the member across devices. Nullable;
-- a missing value is read as 'en'. /api/me/language reads and writes this column.

alter table users add column if not exists language text;
