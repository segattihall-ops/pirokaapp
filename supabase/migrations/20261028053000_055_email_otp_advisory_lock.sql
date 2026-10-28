-- 055 · Close the first-insert race in the email-OTP helpers (054 follow-up).
--
-- 054's `select ... for update` locks nothing when the user has no email_otps row yet, so two
-- concurrent `send` calls on a brand-new (or just-expired) cycle could both take the "fresh cycle"
-- branch and both return allowed=true, bypassing the throttle for that first burst. A per-user
-- transaction-scoped advisory lock serializes all calls for the same user before the read, whether
-- or not a row exists. The lock auto-releases at the end of each rpc call's transaction.
-- CREATE OR REPLACE keeps the signatures (and grants) unchanged — no DROP needed.

create or replace function email_otp_begin_send(
  p_user_id uuid,
  p_email text,
  p_code_hash text,
  p_ttl_seconds integer,
  p_max_sends integer,
  p_resend_min_seconds integer
) returns table (allowed boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r email_otps%rowtype;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into r from email_otps where user_id = p_user_id for update;

  if r.user_id is null or r.expires_at < v_now then
    insert into email_otps (user_id, email, code_hash, expires_at, attempts, sent_count, created_at, updated_at)
    values (p_user_id, p_email, p_code_hash, v_now + make_interval(secs => p_ttl_seconds), 0, 1, v_now, v_now)
    on conflict (user_id) do update set
      email = excluded.email,
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      sent_count = 1,
      updated_at = v_now;
    return query select true, null::text;
    return;
  end if;

  if r.sent_count >= p_max_sends then
    return query select false, 'cap'::text;
    return;
  end if;
  if v_now - r.updated_at < make_interval(secs => p_resend_min_seconds) then
    return query select false, 'throttle'::text;
    return;
  end if;

  update email_otps set
    email = p_email,
    code_hash = p_code_hash,
    expires_at = v_now + make_interval(secs => p_ttl_seconds),
    attempts = 0,
    sent_count = sent_count + 1,
    updated_at = v_now
  where user_id = p_user_id;
  return query select true, null::text;
end;
$$;

create or replace function email_otp_claim_attempt(
  p_user_id uuid,
  p_max_attempts integer
) returns table (status text, email text, code_hash text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r email_otps%rowtype;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into r from email_otps where user_id = p_user_id for update;
  if r.user_id is null then
    return query select 'none'::text, null::text, null::text;
    return;
  end if;
  if r.expires_at < v_now then
    return query select 'expired'::text, r.email, null::text;
    return;
  end if;
  if r.attempts >= p_max_attempts then
    return query select 'over'::text, r.email, null::text;
    return;
  end if;
  update email_otps set attempts = attempts + 1 where user_id = p_user_id;
  return query select 'ok'::text, r.email, r.code_hash;
end;
$$;

-- Re-assert service-role-only execution (idempotent).
revoke all on function email_otp_begin_send(uuid, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function email_otp_claim_attempt(uuid, integer) from public, anon, authenticated;
grant execute on function email_otp_begin_send(uuid, text, text, integer, integer, integer) to service_role;
grant execute on function email_otp_claim_attempt(uuid, integer) to service_role;
