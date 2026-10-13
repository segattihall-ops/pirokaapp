import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoTile } from '@/components/logo';
import { getSystemStatus } from '@/lib/status/server';

export const metadata: Metadata = { title: 'Status' };
export const dynamic = 'force-dynamic';

const DOT: Record<string, string> = { ok: 'bg-green', degraded: 'bg-warning', off: 'bg-fg-4' };
const WORD: Record<string, string> = { ok: 'Operational', degraded: 'Degraded', off: 'Not enabled' };

export default async function StatusPage() {
  const s = await getSystemStatus();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-5 px-4 py-10 text-fg">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoTile size={36} />
        <span className="text-[17px] font-semibold">πroka status</span>
      </Link>
      <div className="glass flex items-center gap-3 rounded-card px-4 py-3.5">
        <span className={`h-3 w-3 rounded-full ${s.ok ? 'bg-green' : 'bg-danger'}`} />
        <div>
          <p className="text-[15px] font-semibold">{s.ok ? 'All systems operational' : 'Service disruption'}</p>
          <p className="text-[12px] text-fg-3">Checked {new Date(s.checkedAt).toUTCString()}</p>
        </div>
      </div>
      <ul className="glass flex flex-col rounded-card px-4">
        {s.components.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 border-t border-line-1 py-3 first:border-t-0">
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{c.label}</p>
              <p className="truncate text-[12px] text-fg-3">{c.detail}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-[12px] text-fg-2">
              <span className={`h-2 w-2 rounded-full ${DOT[c.state]}`} />
              {WORD[c.state]}
              {c.latencyMs !== undefined ? ` · ${c.latencyMs} ms` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-fg-4">
        Machine-readable: <code>/api/status</code>
      </p>
    </div>
  );
}
