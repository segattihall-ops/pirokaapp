'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/auth/client';
import { clearSignalStore } from '@/lib/encryption/signal-store';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await clearSignalStore().catch(() => {});
        await signOut().catch(() => {});
        router.replace('/');
        router.refresh();
      }}
      className="btn-ghost h-10 text-[13px]"
    >
      {busy ? '…' : 'Sign out'}
    </button>
  );
}
