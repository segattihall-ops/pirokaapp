-- 046 meet_proposals — a lightweight "let's meet" handshake, distinct from the SafeMeet safety timer.
-- One member proposes a meet in a conversation (where / when, free text); the invitee accepts or
-- declines; the proposer may cancel while pending. Service-role only (RLS enabled, no policy): the
-- /api/meet/propose routes enforce who may see and act on each proposal.

create table if not exists public.meet_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposer_id uuid not null references public.users(id) on delete cascade,
  invitee_id uuid not null references public.users(id) on delete cascade,
  place_label text,
  when_text text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (proposer_id <> invitee_id)
);

-- At most one pending proposal per proposer per conversation.
create unique index if not exists meet_proposals_one_pending
  on public.meet_proposals (conversation_id, proposer_id)
  where status = 'pending';
create index if not exists meet_proposals_conversation on public.meet_proposals (conversation_id, created_at desc);

alter table public.meet_proposals enable row level security;
revoke all on public.meet_proposals from anon, authenticated;
