'use client';

import { useEffect, useState } from 'react';
import { currentPushSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push/client';

export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (!ok) return;
    setDenied(Notification.permission === 'denied');
    currentPushSubscription()
      .then((s) => setEnabled(Boolean(s)))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        const ok = await subscribeToPush();
        setEnabled(ok);
        setDenied(Notification.permission === 'denied');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass flex items-center justify-between rounded-card px-4 py-3.5">
      <div>
        <p className="text-[14px] font-medium">Push notifications</p>
        <p className="text-[12px] text-fg-3">
          {supported === false
            ? 'Not available on this device or not configured'
            : denied
              ? 'Blocked in browser settings'
              : enabled
                ? 'On for this device'
                : 'Get notified about new messages'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={!supported || denied || busy}
        onClick={toggle}
        className={`relative h-7 w-12 rounded-chip border transition-colors disabled:opacity-40 ${
          enabled ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'
        }`}
      >
        <span
          className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
