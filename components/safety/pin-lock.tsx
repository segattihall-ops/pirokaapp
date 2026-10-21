'use client';

import { useCallback, useEffect, useState } from 'react';

// PIN lock is a per-device privacy gate (FEATURES §9), not account auth: the PIN never leaves the
// device. We store only a SHA-256 hash in localStorage, and a per-session "unlocked" flag so the lock
// appears once per app open. All storage access is guarded — private windows can throw.
const PIN_KEY = 'piroka.pinHash';
const UNLOCKED_KEY = 'piroka.pinUnlocked';
const LEN = 4;

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`piroka:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const readPinHash = (): string | null => {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
};
export const hasPinSet = () => readPinHash() !== null;

function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onDigit(d)}
          className="tap flex h-16 items-center justify-center rounded-btn border border-line-2 bg-ink-850 text-[22px] font-semibold text-fg hover:border-line-3"
        >
          {d}
        </button>
      ))}
      <span />
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="tap flex h-16 items-center justify-center rounded-btn border border-line-2 bg-ink-850 text-[22px] font-semibold text-fg hover:border-line-3"
      >
        0
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="tap flex h-16 items-center justify-center rounded-btn text-fg-3 hover:text-fg"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
      </button>
    </div>
  );
}

function Dots({ n }: { n: number }) {
  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: LEN }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full ${i < n ? 'bg-green' : 'border border-line-3'}`}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen lock shown once per app open when a PIN is set. Mounted in the app shell so it gates the
 * whole authed app. Renders nothing when no PIN is set or the session is already unlocked.
 */
export function PinLock() {
  const [locked, setLocked] = useState(false);
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    let unlocked = false;
    try {
      unlocked = sessionStorage.getItem(UNLOCKED_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (hasPinSet() && !unlocked) setLocked(true);
  }, []);

  const submit = useCallback(async (pin: string) => {
    const stored = readPinHash();
    if (stored && (await hashPin(pin)) === stored) {
      try {
        sessionStorage.setItem(UNLOCKED_KEY, '1');
      } catch {
        /* ignore */
      }
      setLocked(false);
      setEntry('');
    } else {
      setErr(true);
      setEntry('');
      setTimeout(() => setErr(false), 600);
    }
  }, []);

  const push = (d: string) => {
    setEntry((e) => {
      if (e.length >= LEN) return e;
      const next = e + d;
      if (next.length === LEN) void submit(next);
      return next;
    });
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-7 bg-ink-950 px-8">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[26px] font-bold text-green">π</span>
        <p className="text-[15px] font-semibold text-fg">Enter your PIN</p>
      </div>
      <div className={err ? 'animate-pulse' : ''}>
        <Dots n={entry.length} />
      </div>
      <div className="w-full max-w-[280px]">
        <Keypad onDigit={push} onDelete={() => setEntry((e) => e.slice(0, -1))} />
      </div>
      {err && <p className="text-[12px] text-danger">Wrong PIN — try again.</p>}
    </div>
  );
}

/** ME → Privacy: set, change, or turn off the device PIN lock. */
export function PinSettings() {
  const [set, setSet] = useState(false);
  const [mode, setMode] = useState<'idle' | 'new' | 'confirm'>('idle');
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setSet(hasPinSet());
  }, []);

  const finish = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    try {
      localStorage.setItem(PIN_KEY, hash);
      sessionStorage.setItem(UNLOCKED_KEY, '1');
    } catch {
      /* ignore */
    }
    setSet(true);
    setMode('idle');
    setFirst('');
    setEntry('');
    setMsg('PIN lock is on.');
  }, []);

  const push = (d: string) => {
    setEntry((e) => {
      if (e.length >= LEN) return e;
      const next = e + d;
      if (next.length === LEN) {
        if (mode === 'new') {
          setFirst(next);
          setMode('confirm');
          setTimeout(() => setEntry(''), 150);
          return next;
        }
        if (mode === 'confirm') {
          if (next === first) void finish(next);
          else {
            setMsg('PINs didn’t match — start again.');
            setMode('new');
            setFirst('');
          }
          setTimeout(() => setEntry(''), 150);
          return '';
        }
      }
      return next;
    });
  };

  const turnOff = () => {
    try {
      localStorage.removeItem(PIN_KEY);
      sessionStorage.removeItem(UNLOCKED_KEY);
    } catch {
      /* ignore */
    }
    setSet(false);
    setMode('idle');
    setMsg('PIN lock is off.');
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">PIN lock</p>
        <span className={`text-[11px] font-semibold ${set ? 'text-green' : 'text-fg-4'}`}>
          {set ? 'On' : 'Off'}
        </span>
      </div>
      <p className="text-[13px] leading-[1.5] text-fg-4">
        A 4-digit code to open πroka on this device. It stays on your device and is never sent anywhere.
      </p>

      {mode === 'idle' ? (
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('new');
              setEntry('');
              setFirst('');
              setMsg('');
            }}
            className="btn-secondary h-10 flex-1 text-[13px]"
          >
            {set ? 'Change PIN' : 'Set a PIN'}
          </button>
          {set && (
            <button
              type="button"
              onClick={turnOff}
              className="btn-secondary h-10 flex-1 text-[13px] text-danger"
            >
              Turn off
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-col items-center gap-4 rounded-input border border-line-1 p-3">
          <p className="text-[13px] font-medium text-fg-2">
            {mode === 'new' ? 'Choose a 4-digit PIN' : 'Re-enter to confirm'}
          </p>
          <Dots n={entry.length} />
          <div className="w-full max-w-[260px]">
            <Keypad onDigit={push} onDelete={() => setEntry((e) => e.slice(0, -1))} />
          </div>
          <button
            type="button"
            onClick={() => {
              setMode('idle');
              setEntry('');
              setFirst('');
            }}
            className="tap-link text-[12px] font-semibold text-fg-3"
          >
            Cancel
          </button>
        </div>
      )}

      {msg && <p className="text-[12px] text-green">{msg}</p>}
    </div>
  );
}
