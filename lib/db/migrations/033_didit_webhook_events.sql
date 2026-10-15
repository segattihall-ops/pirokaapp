-- 033: Didit webhook idempotency + per-user age-check status. Idempotent, service-role only.

-- One row per Didit event_id. The insert is the dedupe: a retry or a fan-out duplicate hits the
-- primary key and is acknowledged without being applied twice.
create table if not exists public.didit_webhook_events (
  event_id      uuid primary key,
  webhook_type  text not null,
  session_id    uuid,
  status        text,
  vendor_data   text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
create index if not exists idx_didit_webhook_events_session on public.didit_webhook_events(session_id, received_at desc);

-- Latest known state of the user's age check: not_started | in_progress | pending_review |
-- approved | declined | resubmitted | abandoned | expired. Only the label, never decision data.
alter table public.users add column if not exists age_check_status text;
alter table public.users add column if not exists age_check_updated_at timestamptz;

alter table public.didit_webhook_events enable row level security;
revoke all privileges on table public.didit_webhook_events from anon, authenticated;
grant all privileges on table public.didit_webhook_events to service_role;
