-- 048 pulse_snapshot EXECUTE lockdown. pulse_snapshot() is a SECURITY DEFINER aggregate writer called
-- only by the hourly cron (service role). It was executable by PUBLIC/anon/authenticated, which the
-- Supabase advisor flags (security_definer_function_executable). Revoke those grants so only the
-- service role (and postgres) can run it. Applied to production.
revoke execute on function public.pulse_snapshot() from public, anon, authenticated;
