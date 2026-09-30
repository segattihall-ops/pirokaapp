import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';

export type ConversationRow = { id: string; a_id: string; b_id: string; mutual: boolean };

export async function getConversationForUser(conversationId: string, userId: string): Promise<ConversationRow | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id, a_id, b_id, mutual')
    .eq('id', conversationId)
    .maybeSingle();
  if (!data) return null;
  return data.a_id === userId || data.b_id === userId ? (data as ConversationRow) : null;
}

export const peerOf = (c: ConversationRow, userId: string) => (c.a_id === userId ? c.b_id : c.a_id);

export async function getHandle(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from('users').select('handle').eq('id', userId).maybeSingle();
  return data?.handle ?? null;
}

/** True when either user has blocked the other. */
export async function isBlocked(a: string, b: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return Boolean(data?.length);
}

/** Ids this user has blocked or been blocked by. */
export async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supabaseAdmin) return out;
  const { data } = await supabaseAdmin
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  for (const b of data ?? []) out.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
  return out;
}

/** True if there is a 1:1 conversation between the two users. */
export async function haveConversation(a: string, b: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .or(`and(a_id.eq.${a},b_id.eq.${b}),and(a_id.eq.${b},b_id.eq.${a})`)
    .limit(1);
  return Boolean(data?.length);
}
