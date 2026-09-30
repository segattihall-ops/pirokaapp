import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, conversations: [] });

  const me = session.userId;
  const { data: convs, error } = await supabaseAdmin
    .from('conversations')
    .select('id, a_id, b_id, mutual, a:users!conversations_a_id_fkey(id, handle), b:users!conversations_b_id_fkey(id, handle)')
    .or(`a_id.eq.${me},b_id.eq.${me}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (convs ?? []).map((c) => c.id);
  const lastAt = new Map<string, string>();
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin
      .from('dm_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(500);
    for (const m of msgs ?? []) if (!lastAt.has(m.conversation_id)) lastAt.set(m.conversation_id, m.created_at);
  }

  const conversations = (convs ?? [])
    .map((c) => {
      const raw = (c.a_id === me ? c.b : c.a) as unknown;
      const peer = (Array.isArray(raw) ? raw[0] : raw) as { id: string; handle: string | null } | null;
      return {
        id: c.id,
        mutual: c.mutual,
        peer: { id: peer?.id ?? (c.a_id === me ? c.b_id : c.a_id), handle: peer?.handle ?? null },
        lastAt: lastAt.get(c.id) ?? null,
      };
    })
    .sort((x, y) => (y.lastAt ?? '').localeCompare(x.lastAt ?? ''));

  return NextResponse.json({ configured: true, conversations });
}
