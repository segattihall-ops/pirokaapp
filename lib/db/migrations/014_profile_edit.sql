-- 014: handles are unique (case-insensitive) so @handle lookups and chat/start are unambiguous.
create unique index if not exists idx_users_handle_lower on public.users (lower(handle)) where handle is not null and deleted_at is null;
