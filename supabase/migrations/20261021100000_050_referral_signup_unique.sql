-- 050 · One referral attribution per new member
--
-- A new member can be attributed to at most one referrer. The unique index makes recordReferral()
-- idempotent (a retried onboarding save can't double-count) and makes the "who referred whom" record
-- authoritative. Existing rows are untouched; the index only guards future inserts.

create unique index if not exists referral_signups_new_user_uk on referral_signups (new_user_id);
