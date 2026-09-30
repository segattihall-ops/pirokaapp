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
