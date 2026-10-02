-- Email Notification Preferences

alter table users add column if not exists email_notifications_enabled boolean default true;

-- Index for finding unsubscribed users
create index if not exists idx_users_email_notifications on users(email_notifications_enabled);
