-- 038: capture the reporter's IP on abuse reports, for Trust & Safety moderation only.
-- The IP is moderator-only (reads go through the service-role admin API, never to members),
-- and it is cleared when the report is closed (resolved/dismissed) — see app/api/admin/reports PATCH.
alter table reports add column if not exists reporter_ip text;
comment on column reports.reporter_ip is
  'Best-effort client IP captured when an abuse report is filed. Moderator-only; never returned to members.';
