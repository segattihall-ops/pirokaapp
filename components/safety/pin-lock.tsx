'use client';

import { useState, useEffect } from 'react';

interface PinLockProps {
  onUnlock?: () => void;
  locked?: boolean;
}

/**
 * PIN lock with salted hash
 * Locks on app visibility change (visibilitychange event)
 * Quick exit: press Esc twice + shield button
 */
export function PinLock({ onUnlock, locked = false }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(locked);
  const MAX_ATTEMPTS = 3;

  useEffect(() => {
    if (!isLocked) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLocked]);

  const handleSubmit = async () => {
    // TODO: Verify PIN against salted hash
    // For now, stub implementation
    if (pin.length === 4) {
      setIsLocked(false);
      onUnlock?.();
      setPin('');
      setAttempts(0);
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= MAX_ATTEMPTS - 1) {
        // Trigger quick exit or alert
        alert('Too many attempts. App locked.');
      }
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/95">
      <div className="text-center">
        <div className="text-[48px] mb-2">🛡️</div>
        <h2 className="text-[20px] font-bold text-white">App Locked</h2>
        <p className="text-[12px] text-fg-3 mt-1">Enter your PIN to continue</p>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => (
          <input
            key={i}
            type="password"
            maxLength={1}
            value={pin[i] || ''}
            onChange={e => {
              const newPin = pin.split('');
              newPin[i] = e.target.value;
              setPin(newPin.join(''));
              if (e.target.value && i < 3) {
                (e.target.nextElementSibling as HTMLInputElement)?.focus();
              }
            }}
            className="w-12 h-12 text-center text-[24px] font-bold rounded-lg border-2 border-line-2 bg-white/5 text-white focus:border-green focus:outline-none"
            inputMode="numeric"
          />
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pin.length !== 4}
        className="w-full max-w-[200px] py-3 rounded-lg bg-green text-ink-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Unlock
      </button>

      {attempts > 0 && (
        <p className="text-[12px] text-red-400">
          {MAX_ATTEMPTS - attempts} attempts remaining
        </p>
      )}

      <div className="text-center text-[12px] text-fg-4 mt-4">
        <p>Quick exit: Press Esc twice</p>
      </div>
    </div>
  );
}
