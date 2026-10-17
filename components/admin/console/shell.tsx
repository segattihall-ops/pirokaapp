'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SEV, seedAppeals, seedVerifs, seedTickets, seedAmbassadors, seedSites } from '@/lib/admin/ts-seed';

/** Which lens the console is viewed through. Admins can preview the Moderator view; moderators are fixed. */
export type ViewRole = 'Moderator' | 'Admin';

const RoleContext = createContext<{ role: ViewRole; isAdmin: boolean; setRole: (r: ViewRole) => void }>({
  role: 'Moderator',
  isAdmin: false,
  setRole: () => {},
});
export const useRole = () => useContext(RoleContext);

type Toast = { id: number; text: string };
const ToastContext = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

type NavItem = { href: string; label: string };
const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/appeals', label: 'Appeals' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/ambassadors', label: 'Ambassadors' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/places', label: 'Places & testing' },
  { href: '/admin/regions', label: 'Risk regions' },
  { href: '/admin/audit', label: 'Audit log' },
];

/** Live-ish badge counts: Reports is fetched from the real API; the seeded queues report their seed counts. */
function useBadges() {
  const [reportsOpen, setReportsOpen] = useState<number | null>(null);
  const [reportsHot, setReportsHot] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/reports?status=open', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { reports?: { reason: string }[] } | null) => {
        if (!alive || !j?.reports) return;
        setReportsOpen(j.reports.length);
        setReportsHot(j.reports.some((r) => SEV[r.reason] === 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(
    () =>
      ({
        '/admin/reports': { count: reportsOpen ?? 0, hot: reportsHot },
        '/admin/appeals': { count: seedAppeals().filter((a) => a.status === 'open').length, hot: false },
        '/admin/verifications': { count: seedVerifs().filter((v) => v.status === 'open').length, hot: false },
        '/admin/support': { count: seedTickets().filter((t) => t.status === 'open').length, hot: false },
        '/admin/ambassadors': {
          count: seedAmbassadors().filter((b) => b.status === 'open').length,
          hot: false,
        },
        '/admin/places': { count: seedSites().filter((p) => p.status === 'open').length, hot: false },
      }) as Record<string, { count: number; hot: boolean }>,
    [reportsOpen, reportsHot],
  );
}

export function AdminShell({
  children,
  isAdmin,
  who,
}: {
  children: ReactNode;
  isAdmin: boolean;
  who: string;
}) {
  const path = usePathname();
  const [role, setRole] = useState<ViewRole>(isAdmin ? 'Admin' : 'Moderator');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const badges = useBadges();

  // Remember the admin's chosen lens across navigations.
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const saved = localStorage.getItem('piroka_admin_role');
      if (saved === 'Moderator' || saved === 'Admin') setRole(saved);
    } catch {}
  }, [isAdmin]);
  const changeRole = useCallback((r: ViewRole) => {
    setRole(r);
    try {
      localStorage.setItem('piroka_admin_role', r);
    } catch {}
  }, []);

  const pushToast = useCallback((text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <RoleContext.Provider value={{ role, isAdmin, setRole: changeRole }}>
      <ToastContext.Provider value={pushToast}>
        <div className="flex min-h-dvh bg-[#070707] text-fg">
          <nav
            className="rail:flex sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[rgba(255,255,255,0.07)] bg-[#0b0b0b] p-[18px_12px]"
            aria-label="Admin sections"
          >
            <Link
              href="/app/map"
              className="flex items-center gap-2.5 px-2 pb-[18px] pt-1"
              aria-label="πroka Admin home"
            >
              <span
                className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.16)] text-[17px] font-bold"
                style={{ background: 'linear-gradient(160deg,#262626 0%,#070707 65%)' }}
              >
                π<span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-green" />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">πroka Admin</span>
                <span className="text-[11px] text-fg-4">Trust &amp; Safety console</span>
              </span>
            </Link>

            {NAV.map((n) => {
              const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              const b = badges[n.href];
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex h-[38px] items-center justify-between rounded-[10px] px-3 text-[13px] font-medium text-fg hover:bg-white/[0.04]"
                >
                  {active && (
                    <>
                      <span className="absolute inset-0 rounded-[10px] bg-white/[0.08]" />
                      <span className="absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-[3px] bg-green" />
                    </>
                  )}
                  <span className="relative">{n.label}</span>
                  {b && b.count > 0 && (
                    <span
                      className="relative min-w-[22px] rounded-full px-[7px] py-px text-center text-[11px] font-bold"
                      style={{
                        background: b.hot ? '#f87171' : 'rgba(255,255,255,0.1)',
                        color: b.hot ? '#070707' : '#f5f5f5',
                      }}
                    >
                      {b.count}
                    </span>
                  )}
                </Link>
              );
            })}

            <span className="flex-1" />

            <div className="flex flex-col gap-1.5 rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-white/[0.03] p-3">
              <span className="text-[11px] text-fg-4">Signed in as</span>
              <span className="truncate text-[13px] font-semibold">{who}</span>
              {isAdmin ? (
                <div className="flex gap-1">
                  {(['Moderator', 'Admin'] as ViewRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => changeRole(r)}
                      className="h-7 flex-1 rounded-[8px] border text-[11px] font-semibold"
                      style={{
                        borderColor: role === r ? '#34d399' : 'rgba(255,255,255,0.12)',
                        background: role === r ? 'rgba(52,211,153,0.14)' : 'transparent',
                        color: '#f5f5f5',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-fg-4">Moderator</span>
              )}
            </div>
            <Link href="/app/map" className="px-3 py-2.5 text-[12px] text-fg-3 hover:text-green">
              ← Back to the app
            </Link>
          </nav>

          {/* Mobile top bar with a horizontal nav, since the 232px rail is desktop-only. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="rail:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] bg-[#0b0b0b]/95 px-4 py-3 backdrop-blur-md">
              <Link href="/app/map" aria-label="πroka Admin home" className="flex items-center gap-2">
                <span
                  className="relative flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(255,255,255,0.16)] text-[15px] font-bold"
                  style={{ background: 'linear-gradient(160deg,#262626 0%,#070707 65%)' }}
                >
                  π
                </span>
                <span className="text-[14px] font-semibold">Admin</span>
              </Link>
            </div>
            <div className="rail:hidden overflow-x-auto border-b border-[rgba(255,255,255,0.07)] px-3 py-2 [scrollbar-width:none]">
              <div className="flex w-max gap-1.5">
                {NAV.map((n) => {
                  const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`chip whitespace-nowrap ${active ? 'chip-selected' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-[clamp(16px,3vw,36px)] py-[26px] pb-12">
              {children}
            </main>
          </div>
        </div>

        {toasts.length > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className="rounded-[12px] bg-[#f5f5f5] px-[18px] py-3 text-[13px] font-semibold text-[#070707] shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </ToastContext.Provider>
    </RoleContext.Provider>
  );
}
