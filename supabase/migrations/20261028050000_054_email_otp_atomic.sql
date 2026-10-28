-- 054 · Make email-OTP verification concurrency-safe and self-cleaning.
--
-- Fixes four issues in the 053 email badge found in review:
--  P1 the send throttle/cap was read-then-write, so parallel /api/me/email `send` calls could all
--     pass the check and flood a recipient;
--  P1 the attempt counter was read-then-write, so parallel `check` calls could exceed the 5-guess
--     cap and brute-force the 6-digit code;
--  P2 sent_count never reset, locking out a member who never completed verification;
--  P2 email_otps held a pending email (PII) with no cascade, so a deleted account left it behind.
--
-- The two helpers below do the eligibility test and the counter write in a single locked statement
-- (SELECT ... FOR UPDATE), so concurrent callers serialize. An expired row counts as a fresh cycle,
-- which resets the send cap. Both are SECURITY DEFINER but executable only by the service role.

-- PII cleanup on account deletion (auth.admin.deleteUser removes the auth.users row).
alter table email_otps
  add constraint email_otps_user_fk foreign key (user_id) references auth.users (id) on delete cascade;

-- Begin a send: returns whether this caller may send now, having atomically renewed/bumped the row.
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
  select * into r from email_otps where user_id = p_user_id for update;

  -- No row, or the previous code has expired → a fresh verification cycle (resets the send cap).
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

-- Claim one check attempt: atomically consumes an attempt (when under the cap and unexpired) and
-- returns the stored hash so the caller can compare. status is 'ok' | 'none' | 'expired' | 'over'.
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

-- Service-role only: these SECURITY DEFINER helpers must never be callable by anon/authenticated.
revoke all on function email_otp_begin_send(uuid, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function email_otp_claim_attempt(uuid, integer) from public, anon, authenticated;
grant execute on function email_otp_begin_send(uuid, text, text, integer, integer, integer) to service_role;
grant execute on function email_otp_claim_attempt(uuid, integer) to service_role;
