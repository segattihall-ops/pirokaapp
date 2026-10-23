-- 051 · Reversible protective hold for an in-app underage report.
--
-- NOT APPLIED by this change. Run this file in the Supabase SQL editor (or the migration
-- pipeline) before the new app version is relied on. Do not run it against production from a
-- laptop checkout, and do not combine it with a deploy.
--
-- The hold is not a ban and not a deletion. It records the previous visibility and 18+ flags,
-- sets visibility to hidden (map, nearby, and hotspot queries already skip hidden members),
-- and stores the report id. Messaging and search also read safety_hold_at.
-- A check keeps a held row hidden until an admin clears the hold and restores visibility together.

alter table public.users
  add column if not exists safety_hold_at timestamptz,
  add column if not exists safety_hold_report_id text,
  add column if not exists safety_hold_prev_visibility public.visibility_t,
  add column if not exists safety_hold_prev_age_verified boolean,
  add column if not exists safety_hold_prev_gate boolean,
  add column if not exists safety_hold_gate_written boolean not null default false;

comment on column public.users.safety_hold_at is
  'Set when an in-app underage report places a reversible protective hold. Null means no hold. Not a ban and not a deletion.';
comment on column public.users.safety_hold_report_id is
  'reports.id that placed the hold. Moderator reference only.';
comment on column public.users.safety_hold_prev_visibility is
  'visibility to restore when an admin releases the hold.';
comment on column public.users.safety_hold_prev_age_verified is
  'users.age_verified before the hold. Restored on release.';
comment on column public.users.safety_hold_prev_gate is
  'auth app_metadata.age_verified before Require ID was flagged. Null if that flag was not read.';
comment on column public.users.safety_hold_gate_written is
  'True only after Require ID was written to auth app_metadata, so release knows to undo it.';

create index if not exists users_open_safety_hold_idx
  on public.users (safety_hold_at)
  where safety_hold_at is not null;

alter table public.users drop constraint if exists users_safety_hold_hidden;
alter table public.users add constraint users_safety_hold_hidden
  check (safety_hold_at is null or visibility = 'hidden');
