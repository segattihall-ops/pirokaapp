import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const SendBody = z.object({ body: z.string().trim().min(1).max(2000) });

/** Is the signed-in member part of this group? Chat is members-only (reads and writes). */
async function isMember(groupId: string, userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

/** GET: list group messages (oldest→newest). `?after=<ISO>` returns only messages newer than that. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsedId = Id.safeParse(params.id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!(await isMember(parsedId.data, g.session.userId)))
    return NextResponse.json({ error: 'Join the group to read its chat' }, { status: 403 });

  const after = new URL(request.url).searchParams.get('after');

  if (after) {
    const { data, error } = await supabaseAdmin
      .from('group_messages')
      .select('id, body, created_at, sender_id, sender:users ( handle )')
      .eq('group_id', parsedId.data)
      .gt('created_at', after)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  // Initial load: newest 100, returned oldest→newest.
  const { data, error } = await supabaseAdmin
    .from('group_messages')
    .select('id, body, created_at, sender_id, sender:users ( handle )')
    .eq('group_id', parsedId.data)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  return NextResponse.json(
    { messages: (data ?? []).reverse() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

/** POST: send a message to the group. Members only. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsedId = Id.safeParse(params.id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const parsed = SendBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!(await isMember(parsedId.data, g.session.userId)))
    return NextResponse.json({ error: 'Join the group to post in its chat' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('group_messages')
    .insert({ group_id: parsedId.data, sender_id: g.session.userId, body: parsed.data.body })
    .select('id, body, created_at, sender_id, sender:users ( handle )')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
