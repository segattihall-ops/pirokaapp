-- 049 · Photo (selfie) verification
--
-- A "photo verified" badge means the member passed a live selfie that a 1:1 face match confirmed
-- against their own profile photo (Didit). It is anti-catfish: it proves the person in the photos is
-- the person holding the phone. It is NOT the age gate — age lives in auth metadata — and NOT the
-- phone badge (048/047). Display-only, like phone_verified, so it rides on the users row.

alter table users add column if not exists photo_verified boolean not null default false;
