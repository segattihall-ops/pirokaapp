import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import { AdminShell } from '@/components/admin/console/shell';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

/** Trust & Safety console shell (design_handoff → Piroka_Admin.dc.html). Gates to admins, then renders the
 *  prototype's sidebar + main around every admin page. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/?gate=1&next=%2Fadmin');
  if (!isAdmin(session)) redirect('/app/map');

  return (
    <AdminShell isAdmin who={session.email ?? session.userId}>
      {children}
    </AdminShell>
  );
}
