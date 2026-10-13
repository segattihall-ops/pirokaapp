-- 032: Post-launch systems — analytics, error tracking, email log + campaigns, feature flags,
-- announcements, feedback, rate limits, lifecycle columns. Idempotent. Service-role only:
-- the browser never reads these tables directly (same posture as 022).

-- ---------- users: lifecycle columns ----------
alter table public.users add column if not exists marketing_opt_out boolean not null default false;
alter table public.users add column if not exists payment_failed_at timestamptz;
alter table public.users add column if not exists cancelled_at timestamptz;

-- ---------- product analytics ----------
create table if not exists public.analytics_events (
  id          bigserial primary key,
  user_id     uuid references public.users(id) on delete set null,
  anon_id     text,
  event       text not null check (char_length(event) between 1 and 64),
  props       jsonb not null default '{}',
  path        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_analytics_events_event_created on public.analytics_events(event, created_at desc);
create index if not exists idx_analytics_events_user_created on public.analytics_events(user_id, created_at desc);
create index if not exists idx_analytics_events_created on public.analytics_events(created_at desc);

-- ---------- error tracking ----------
create table if not exists public.error_events (
  id           bigserial primary key,
  fingerprint  text not null unique,
  message      text not null,
  stack        text,
  source       text not null default 'server' check (source in ('server','client')),
  route        text,
  severity     text not null default 'error' check (severity in ('info','warning','error','fatal')),
  user_id      uuid,
  count        integer not null default 1,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists idx_error_events_last_seen on public.error_events(last_seen desc);

create or replace function public.record_error_event(
  p_fingerprint text, p_message text, p_stack text, p_source text, p_route text, p_user_id uuid, p_severity text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.error_events (fingerprint, message, stack, source, route, user_id, severity)
  values (p_fingerprint, left(p_message, 2000), left(p_stack, 8000), p_source, p_route, p_user_id, p_severity)
  on conflict (fingerprint) do update
    set count = public.error_events.count + 1,
        last_seen = now(),
        resolved_at = null,
        message = excluded.message,
        stack = coalesce(excluded.stack, public.error_events.stack),
        route = coalesce(excluded.route, public.error_events.route),
        user_id = coalesce(excluded.user_id, public.error_events.user_id)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- email ----------
create table if not exists public.email_log (
  id           bigserial primary key,
  user_id      uuid references public.users(id) on delete set null,
  to_email     text not null,
  template     text not null,
  subject      text not null,
  provider     text not null,
  status       text not null check (status in ('sent','failed','skipped','console')),
  error        text,
  message_id   text,
  campaign_id  uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_email_log_user_template on public.email_log(user_id, template, created_at desc);
create index if not exists idx_email_log_campaign_user on public.email_log(campaign_id, user_id);
create index if not exists idx_email_log_created on public.email_log(created_at desc);

create table if not exists public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  body          text not null,
  segment       text not null default 'all',
  status        text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at  timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  total_count   integer not null default 0,
  sent_count    integer not null default 0,
  failed_count  integer not null default 0,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_email_campaigns_status on public.email_campaigns(status, scheduled_at);

-- ---------- feature flags ----------
create table if not exists public.feature_flags (
  key          text primary key check (key ~ '^[a-z0-9_]{2,48}$'),
  enabled      boolean not null default false,
  rollout_pct  integer not null default 100 check (rollout_pct between 0 and 100),
  description  text,
  updated_at   timestamptz not null default now()
);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 120),
  body        text not null check (char_length(body) <= 600),
  url         text,
  audience    text not null default 'all' check (audience in ('all','free','paid')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_announcements_window on public.announcements(starts_at, ends_at);

-- ---------- feedback ----------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  email       text,
  kind        text not null default 'other' check (kind in ('bug','idea','other')),
  message     text not null check (char_length(message) between 1 and 2000),
  path        text,
  status      text not null default 'new' check (status in ('new','triaged','closed')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_feedback_status_created on public.feedback(status, created_at desc);

-- ---------- rate limits (fixed window) ----------
create table if not exists public.rate_limits (
  key           text primary key,
  count         integer not null default 0,
  window_start  timestamptz not null default now()
);

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_secs integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update
    set count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_secs) then 1
                     else public.rate_limits.count + 1 end,
        window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_secs) then now()
                            else public.rate_limits.window_start end
  returning count into v_count;
  -- opportunistic cleanup of stale keys
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_limit;
end $$;

-- ---------- aggregation helpers for the admin console ----------
create or replace function public.signups_daily(p_days integer)
returns table (day date, n bigint)
language sql stable security definer set search_path = public as $$
  select d::date, count(u.id)
  from generate_series((now() - make_interval(days => p_days - 1))::date, now()::date, '1 day') d
  left join public.users u on u.created_at::date = d::date
  group by d order by d
$$;

create or replace function public.active_users_daily(p_days integer)
returns table (day date, n bigint)
language sql stable security definer set search_path = public as $$
  select d::date, count(distinct e.user_id)
  from generate_series((now() - make_interval(days => p_days - 1))::date, now()::date, '1 day') d
  left join public.analytics_events e on e.created_at::date = d::date and e.user_id is not null
  group by d order by d
$$;

create or replace function public.event_counts_daily(p_event text, p_days integer)
returns table (day date, n bigint)
language sql stable security definer set search_path = public as $$
  select d::date, count(e.id)
  from generate_series((now() - make_interval(days => p_days - 1))::date, now()::date, '1 day') d
  left join public.analytics_events e on e.created_at::date = d::date and e.event = p_event
  group by d order by d
$$;

create or replace function public.top_events(p_days integer, p_limit integer default 12)
returns table (event text, n bigint, users bigint)
language sql stable security definer set search_path = public as $$
  select event, count(*), count(distinct user_id)
  from public.analytics_events
  where created_at > now() - make_interval(days => p_days)
  group by event order by 2 desc limit p_limit
$$;

create or replace function public.active_user_count(p_days integer)
returns bigint
language sql stable security definer set search_path = public as $$
  select count(distinct user_id) from public.analytics_events
  where user_id is not null and created_at > now() - make_interval(days => p_days)
$$;

create or replace function public.revenue_monthly(p_months integer)
returns table (month date, revenue numeric, payments bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('month', m)::date,
         coalesce(sum(p.amount) filter (where p.status = 'COMPLETED'), 0),
         count(p.id) filter (where p.status = 'COMPLETED')
  from generate_series(date_trunc('month', now()) - make_interval(months => p_months - 1), date_trunc('month', now()), '1 month') m
  left join public.payments p on date_trunc('month', p.created_at) = date_trunc('month', m)
  group by 1 order by 1
$$;

-- ---------- campaign audiences ----------
-- Segment predicate shared by count + recipient fetch. Always excludes deleted, opted-out and
-- address-less accounts. Segments: all, free, plus, premium, paid, inactive_7d, inactive_30d, new_7d, cancelled.
create or replace function public.campaign_segment_sql(p_segment text)
returns text language sql immutable as $$
  select case p_segment
    when 'free'         then $q$ u.plan = 'free' $q$
    when 'plus'         then $q$ u.plan = 'plus' $q$
    when 'premium'      then $q$ u.plan = 'premium' $q$
    when 'paid'         then $q$ u.plan in ('plus','premium') $q$
    when 'inactive_7d'  then $q$ coalesce(u.last_seen_at, u.created_at) < now() - interval '7 days' $q$
    when 'inactive_30d' then $q$ coalesce(u.last_seen_at, u.created_at) < now() - interval '30 days' $q$
    when 'new_7d'       then $q$ u.created_at > now() - interval '7 days' $q$
    when 'cancelled'    then $q$ u.cancelled_at is not null $q$
    else                     $q$ true $q$
  end
$$;

create or replace function public.campaign_segment_count(p_segment text)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare n bigint;
begin
  execute format(
    'select count(*) from public.users u where u.email is not null and u.deleted_at is null and not u.marketing_opt_out and (%s)',
    public.campaign_segment_sql(p_segment)
  ) into n;
  return n;
end $$;

create or replace function public.campaign_recipients(p_campaign uuid, p_segment text, p_limit integer)
returns table (id uuid, email text, handle text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query execute format(
    'select u.id, u.email::text, u.handle from public.users u
      where u.email is not null and u.deleted_at is null and not u.marketing_opt_out and (%s)
        and not exists (select 1 from public.email_log l where l.campaign_id = $1 and l.user_id = u.id)
      order by u.created_at limit $2',
    public.campaign_segment_sql(p_segment)
  ) using p_campaign, p_limit;
end $$;

-- ---------- lockdown ----------
do $$
declare t text;
begin
  foreach t in array array['analytics_events','error_events','email_log','email_campaigns','feature_flags','announcements','feedback','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on function public.record_error_event(text,text,text,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text,integer,integer) from public, anon, authenticated;
revoke all on function public.signups_daily(integer) from public, anon, authenticated;
revoke all on function public.active_users_daily(integer) from public, anon, authenticated;
revoke all on function public.event_counts_daily(text,integer) from public, anon, authenticated;
revoke all on function public.top_events(integer,integer) from public, anon, authenticated;
revoke all on function public.active_user_count(integer) from public, anon, authenticated;
revoke all on function public.revenue_monthly(integer) from public, anon, authenticated;
revoke all on function public.campaign_segment_sql(text) from public, anon, authenticated;
revoke all on function public.campaign_segment_count(text) from public, anon, authenticated;
revoke all on function public.campaign_recipients(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.campaign_segment_sql(text) to service_role;
grant execute on function public.campaign_segment_count(text) to service_role;
grant execute on function public.campaign_recipients(uuid,text,integer) to service_role;
grant execute on function public.record_error_event(text,text,text,text,text,uuid,text) to service_role;
grant execute on function public.rate_limit_hit(text,integer,integer) to service_role;
grant execute on function public.signups_daily(integer) to service_role;
grant execute on function public.active_users_daily(integer) to service_role;
grant execute on function public.event_counts_daily(text,integer) to service_role;
grant execute on function public.top_events(integer,integer) to service_role;
grant execute on function public.active_user_count(integer) to service_role;
grant execute on function public.revenue_monthly(integer) to service_role;

-- Seed a couple of flags so the admin page is not empty.
insert into public.feature_flags (key, enabled, rollout_pct, description) values
  ('smart_search', true, 100, 'Claude-powered people search on the map'),
  ('announcements', true, 100, 'Show the in-app announcement banner')
on conflict (key) do nothing;
