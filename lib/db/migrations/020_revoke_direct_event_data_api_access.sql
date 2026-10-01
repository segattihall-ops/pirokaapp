-- Events are served through authenticated server routes only.
-- Revoke direct Data API access so exact geometry and attendee identity cannot
-- be queried by browser roles.

revoke all privileges on table public.events from anon, authenticated;
revoke all privileges on table public.event_attendees from anon, authenticated;

grant all privileges on table public.events to service_role;
grant all privileges on table public.event_attendees to service_role;
