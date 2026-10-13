import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { EVENTS } from '@/lib/analytics/events';

export type DayPoint = { label: string; value: number };

export type GrowthStats = {
  signups30d: DayPoint[];
  active30d: DayPoint[];
  dau: number;
  wau: number;
  mau: number;
  signupsThis7: number;
  signupsPrev7: number;
  funnel: { label: string; value: number }[];
  topEvents: { event: string; n: number; users: number }[];
};

const dayLabel = (d: string) => {
  const dt = new Date(d);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
};

async function rpcDays(fn: string, args: Record<string, unknown>): Promise<DayPoint[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) {
    console.error(`${fn} failed`, error.message);
    return [];
  }
  return ((data ?? []) as { day: string; n: number }[]).map((r) => ({ label: dayLabel(r.day), value: Number(r.n) }));
}

async function rpcNumber(fn: string, args: Record<string, unknown>): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) return 0;
  return Number(data ?? 0);
}

async function distinctUsersFor(event: string, days: number): Promise<number> {
  if (!supabaseAdmin) return 0;
  // Distinct count via RPC is cheaper, but top_events already carries users for the window.
  const { data } = await supabaseAdmin.rpc('top_events', { p_days: days, p_limit: 200 });
  const row = ((data ?? []) as { event: string; users: number }[]).find((r) => r.event === event);
  return Number(row?.users ?? 0);
}

export async function getGrowthStats(): Promise<GrowthStats> {
  const empty: GrowthStats = { signups30d: [], active30d: [], dau: 0, wau: 0, mau: 0, signupsThis7: 0, signupsPrev7: 0, funnel: [], topEvents: [] };
  if (!supabaseAdmin) return empty;

  const [signups30d, active30d, dau, wau, mau, topRaw] = await Promise.all([
    rpcDays('signups_daily', { p_days: 30 }),
    rpcDays('active_users_daily', { p_days: 30 }),
    rpcNumber('active_user_count', { p_days: 1 }),
    rpcNumber('active_user_count', { p_days: 7 }),
    rpcNumber('active_user_count', { p_days: 30 }),
    supabaseAdmin.rpc('top_events', { p_days: 30, p_limit: 200 }),
  ]);

  const top = ((topRaw.data ?? []) as { event: string; n: number; users: number }[]).map((r) => ({
    event: r.event,
    n: Number(r.n),
    users: Number(r.users),
  }));
  const usersFor = (e: string) => top.find((t) => t.event === e)?.users ?? 0;

  const signupsThis7 = signups30d.slice(-7).reduce((a, d) => a + d.value, 0);
  const signupsPrev7 = signups30d.slice(-14, -7).reduce((a, d) => a + d.value, 0);

  const funnel = [
    { label: 'Signed up', value: usersFor(EVENTS.signup) },
    { label: 'Onboarded', value: usersFor(EVENTS.onboarding_completed) },
    { label: 'Set a status', value: usersFor(EVENTS.status_set) },
    { label: 'Started a chat', value: usersFor(EVENTS.chat_started) },
    { label: 'Subscribed', value: usersFor(EVENTS.subscribed) },
  ];

  return {
    signups30d,
    active30d,
    dau,
    wau,
    mau,
    signupsThis7,
    signupsPrev7,
    funnel,
    topEvents: top.filter((t) => t.event !== EVENTS.page_view).slice(0, 12),
  };
}

export { distinctUsersFor };
