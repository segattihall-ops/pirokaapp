import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';

export type AdminStats = {
  users: number;
  verified: number;
  paying: number;
  openReports: number;
  messages24h: number;
  activeStatuses: number;
  pushDevices: number;
};

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  if (!supabaseAdmin) return 0;
  let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count: n } = await q;
  return n ?? 0;
}

export async function getAdminStats(): Promise<AdminStats> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [users, verified, paying, openReports, messages24h, activeStatuses, pushDevices] = await Promise.all([
    count('users', (q) => q.is('deleted_at', null)),
    count('users', (q) => q.eq('age_verified', true)),
    count('users', (q) => q.in('plan', ['plus', 'premium'])),
    count('reports', (q) => q.eq('status', 'open')),
    count('dm_messages', (q) => q.gte('created_at', dayAgo)),
    count('statuses', (q) => q.gte('ends_at', new Date().toISOString())),
    count('push_subscriptions'),
  ]);
  return { users, verified, paying, openReports, messages24h, activeStatuses, pushDevices };
}
