-- 015: SafeMeet — timed check-ins during a meet, with a share link for a trusted contact.

alter table public.meets add column if not exists status text not null default 'active'
  check (status in ('active','ended','alert','cancelled'));
alter table public.meets add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
alter table public.meets add column if not exists share_token text unique;
alter table public.meets add column if not exists place_label text check (char_length(place_label) <= 80);
alter table public.meets add column if not exists started_at timestamptz not null default now();
alter table public.meets add column if not exists last_checkin_at timestamptz;
alter table public.meets add column if not exists next_checkin_at timestamptz;
alter table public.meets add column if not exists reminded_at timestamptz;
alter table public.meets add column if not exists alert_at timestamptz;
alter table public.meets add column if not exists ended_at timestamptz;
alter table public.meets add column if not exists checkins integer not null default 0;

create index if not exists idx_meets_a_active on public.meets (a_id) where status in ('active','alert');
create index if not exists idx_meets_b_active on public.meets (b_id) where status in ('active','alert');
create index if not exists idx_meets_next_checkin on public.meets (next_checkin_at) where status = 'active';
