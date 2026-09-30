-- πroka — Postgres 15 + PostGIS schema (Supabase-compatible)
-- Principles: never expose raw coordinates; statuses and check-ins expire; E2E chat stores ciphertext only.
create extension if not exists postgis;
create extension if not exists pgcrypto;

create type plan_t        as enum ('anonymous','free','plus','premium');
create type visibility_t  as enum ('neighborhood','area','hidden');
create type intent_t      as enum ('now','next','hosting','travel','tonight','later','visiting','looking');
create type trust_t       as enum ('human','photo','phone');
create type mod_step_t    as enum ('warning','limited','suspended','removed');

create table users (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  auth_provider text not null check (auth_provider in ('google','apple','email','anonymous')),
  email         citext unique,
  handle        text check (char_length(handle) between 2 and 24),   -- null = anonymous
  pronouns      text[] not null default '{}',
  gender        text[] not null default '{}',
  orientation   text[] not null default '{}',
  communities   text[] not null default '{}',
  show_me       text[] not null default '{}',                          -- empty = everyone
  bio           text check (char_length(bio) <= 160),
  plan          plan_t not null default 'free',
  visibility    visibility_t not null default 'neighborhood',
  age_verified  boolean not null default false,                       -- only the boolean is stored
  disguise_icon text not null default 'piroka',
  safety_prefs  jsonb not null default '{"blurPhotos":true,"verifiedOnly":false,"strangerFilter":true}',
  notif_prefs   jsonb not null default '{"match":true,"album":true,"arrival":true,"status":true,"safety":true}',
  deleted_at    timestamptz
);

create table trust_signals (
  user_id     uuid references users(id) on delete cascade,
  kind        trust_t,
  verified_at timestamptz not null default now(),
  expires_at  timestamptz,                                            -- photo: +90 days
  primary key (user_id, kind)
);

create table photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  slot        smallint not null check (slot between 0 and 5),         -- 0 = main, 1..5 = album
  storage_key text not null,                                          -- EXIF/GPS stripped on upload
  blur_key    text not null,                                          -- server-rendered blurred variant
  created_at  timestamptz not null default now(),
  unique (user_id, slot)
);
-- enforce album limit: anonymous/free = 2, plus/premium = 5 (check in API layer or trigger)

create table album_grants (
  owner_id   uuid references users(id) on delete cascade,
  grantee_id uuid references users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (owner_id, grantee_id)
);
create table album_requests (
  from_id    uuid references users(id) on delete cascade,
  to_id      uuid references users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

-- Location: true position at reduced precision, 24h retention. Public position is fuzzed per session.
create table locations (
  user_id      uuid primary key references users(id) on delete cascade,
  true_geo     geography(point, 4326) not null,                       -- ~11 m precision (4 decimals)
  public_geo   geography(point, 4326) not null,                       -- see lib/geo/fuzz.ts
  fuzz_seed    bytea not null,                                         -- rotated per session
  country_code char(2),
  risk_region  boolean not null default false,
  updated_at   timestamptz not null default now()
);
create index on locations using gist (public_geo);

create table statuses (
  user_id    uuid primary key references users(id) on delete cascade,
  intent     intent_t not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  warned     boolean not null default false,
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours')
);
create index on statuses (ends_at);

create table meets (
  id           uuid primary key default gen_random_uuid(),
  a_id         uuid not null references users(id),
  b_id         uuid not null references users(id),
  meet_type    text not null check (meet_type in ('public','a_place','b_place')),
  eta_minutes  smallint not null,
  boundaries   text,
  accepted_at  timestamptz,
  ends_at      timestamptz,                                            -- accepted_at + 2h
  checkin_every smallint not null default 15,
  trusted_contact jsonb                                                -- {name, phone} shared only while active
);

create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text not null, geo geography(point, 4326) not null,
  peak_hint text, verified boolean default false
);
create table checkins (
  user_id uuid references users(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  kind text not null check (kind in ('here','going')),
  expires_at timestamptz not null,
  primary key (user_id, place_id)
);
create table events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references places(id), group_id uuid,
  name text not null, starts_at timestamptz not null, ends_at timestamptz
);
create table rsvps (event_id uuid references events(id) on delete cascade, user_id uuid references users(id) on delete cascade, primary key (event_id, user_id));
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null, glyph text, about text, city text,
  verified_only boolean default false
);
create table group_members (group_id uuid references groups(id) on delete cascade, user_id uuid references users(id) on delete cascade, role text default 'member', primary key (group_id, user_id));
-- Rooms (place + group chat) are moderated, not E2E
create table room_messages (
  id bigserial primary key, room text not null,                        -- 'p:<place_id>' | 'g:<group_id>'
  user_id uuid references users(id) on delete set null, body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create index on room_messages (room, created_at desc);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  city text not null, geo geography(point, 4326) not null,
  arrive_on date not null, nights smallint not null default 3
);
create index on trips using gist (geo);

-- 1:1 chat — ciphertext only (libsignal / MLS). Server never sees plaintext.
create table conversations (id uuid primary key default gen_random_uuid(), a_id uuid references users(id), b_id uuid references users(id), mutual boolean default false, unique (a_id, b_id));
create table dm_messages (
  id bigserial primary key, conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references users(id), ciphertext bytea not null, kind text default 'text',
  created_at timestamptz not null default now()
);

create table blocks (blocker_id uuid references users(id) on delete cascade, blocked_id uuid references users(id) on delete cascade, created_at timestamptz default now(), primary key (blocker_id, blocked_id));
create table reports (
  id text primary key default ('TS-' || lpad((floor(random()*99999))::text, 5, '0')),
  reporter_id uuid references users(id), target_id uuid references users(id),
  reason text not null, details text, evidence jsonb,                  -- client-decrypted, reporter-approved
  created_at timestamptz default now(), status text default 'open'
);
create table mod_actions (
  id text primary key default ('PR-' || lpad((floor(random()*99999))::text, 5, '0')),
  user_id uuid references users(id), step mod_step_t not null, reason text not null, rule_ref text not null,
  created_at timestamptz default now(), expires_at timestamptz
);
create table appeals (
  action_id text references mod_actions(id), body text not null, reviewer_id uuid,  -- must differ from original moderator
  status text default 'pending', created_at timestamptz default now(), primary key (action_id)
);
create table notifications (
  id bigserial primary key, user_id uuid references users(id) on delete cascade,
  kind text not null check (kind in ('match','album','arrival','status','safety')),
  body text not null, ref_user uuid, read_at timestamptz, created_at timestamptz default now()
);

-- Expiry jobs (pg_cron): statuses, check-ins, meets, 24h location retention
-- select cron.schedule('expire', '* * * * *', $$
--   delete from statuses where ends_at < now();
--   delete from checkins where expires_at < now();
--   update meets set trusted_contact = null where ends_at < now();
--   delete from locations where updated_at < now() - interval '24 hours';
-- $$);

-- Nearby query (never returns true_geo; distance rounded to 0.1 mi on the API side)
-- select u.id, st_distance(l.public_geo, $me) as m
-- from locations l join users u on u.id = l.user_id
-- where st_dwithin(l.public_geo, $me, 5000) and u.visibility <> 'hidden'
--   and not exists (select 1 from blocks b where (b.blocker_id = $uid and b.blocked_id = u.id) or (b.blocker_id = u.id and b.blocked_id = $uid))
-- order by m limit 200;

-- v3 additions
alter table users add column if not exists ethnicity text[] not null default '{}';
alter table users add column if not exists lang text not null default 'en' check (lang in ('en','pt','es'));
create table if not exists health_cards (
  user_id uuid primary key references users(id) on delete cascade,
  enc_payload bytea not null,          -- {status, hivMonth, stiMonth, prevention[]} encrypted with per-user DEK
  visibility text not null default 'me' check (visibility in ('me','share','all')),
  verified_month char(7), verified_tests text[],
  consent_at timestamptz not null, updated_at timestamptz not null default now()
);
create table if not exists health_shares (owner_id uuid references users(id) on delete cascade, grantee_id uuid references users(id) on delete cascade, shared_at timestamptz default now(), primary key (owner_id, grantee_id));
create table if not exists verifications (id text primary key, user_id uuid references users(id) on delete cascade, kind text not null check (kind in ('age','photo','phone','health')), ai_result jsonb, status text not null default 'open', reviewer_id uuid, decided_at timestamptz);
create table if not exists testing_sites (id text primary key, name text not null, address text not null, zip text, geo geography(point,4326) not null, services text[], cost text, phone text, notes text, verified boolean default false);
create table if not exists audit_log (id bigserial primary key, actor_id uuid, action text not null, target text, created_at timestamptz default now());
-- appeals must be reviewed by someone else
-- alter table appeals add constraint appeal_other_reviewer check (reviewer_id is distinct from (select ...)) -- enforce via trigger
insert into testing_sites (id, name, address, zip, geo, services, cost, phone) values
 ('t0','Kind Clinic — Oak Lawn','3802 Cedar Springs Rd, Dallas, TX 75219','75219', st_point(-96.8117,32.8109)::geography, '{HIV,Syphilis,Gonorrhea,Chlamydia,"Hep C",PrEP,PEP}','Free','1-833-937-5463'),
 ('t1','CAN Community Health','4211 Cedar Springs Rd, Suite 200A, Dallas, TX 75219','75219', st_point(-96.8180,32.8150)::geography, '{HIV,STI,"Hep C"}','Free / low cost','954-351-0450'),
 ('t2','Prism Health North Texas — Oak Lawn','2801 Lemmon Ave, Dallas, TX 75204','75204', st_point(-96.8010,32.8036)::geography, '{HIV,STI,PrEP}','Sliding scale','214-521-5191'),
 ('t3','Free HIV & STI Testing — Oak Lawn UMC','3014 Oak Lawn Ave, Dallas, TX 75219','75219', st_point(-96.8067,32.8062)::geography, '{HIV,STI}','Free','469-291-2899'),
 ('t4','UT Southwestern CPIU','8150 Brookriver Dr, Suite S400, Dallas, TX 75247','75247', st_point(-96.8740,32.8250)::geography, '{HIV,STI}','Free','469-291-2899'),
 ('t5','Dallas County Health & Human Services','2377 N Stemmons Fwy, Dallas, TX 75207','75207', st_point(-96.8243,32.8003)::geography, '{HIV,STI}','Low cost',null),
 ('t6','Prism Health North Texas — Oak Cliff','219 Sunset Ave, Suite 116-A, Dallas, TX 75208','75208', st_point(-96.8248,32.7485)::geography, '{HIV,STI,PrEP}','Sliding scale','214-521-5191'),
 ('t7','The Stewpot','1822 Young St, Dallas, TX 75201','75201', st_point(-96.7937,32.7767)::geography, '{HIV,TB}','Free','214-746-2785');

-- v4 additions
alter table users add column if not exists origin text;  -- 'br', 'mx', 'us-tx', …
create table if not exists favorites (user_id uuid references users(id) on delete cascade, fav_id uuid references users(id) on delete cascade, alerts boolean default true, created_at timestamptz default now(), primary key (user_id, fav_id));
create table if not exists taste_events (id bigserial primary key, user_id uuid references users(id) on delete cascade, target_id uuid references users(id) on delete cascade, kind text check (kind in ('open','interest','chat','skip')), weight real not null, at timestamptz default now());
create table if not exists taste_flags (user_id uuid references users(id) on delete cascade, trait text not null, flag text check (flag in ('like','avoid')), primary key (user_id, trait));
