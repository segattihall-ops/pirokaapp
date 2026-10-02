'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AgeGate() {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/age-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedAge18Plus: true }),
      });

      if (res.ok) {
        router.push('/onboarding');
      } else {
        const error = await res.json();
        console.error('Age verification failed:', error.message);
      }
    } catch (err) {
      console.error('Age verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
        <h1 className="mb-4 text-center text-3xl font-bold text-white">Age Confirmation</h1>

        <p className="mb-6 text-center text-slate-300">
          ΠROKA is for adults 18+. By continuing, you confirm you are at least 18 years old and agree to our Terms.
        </p>

        <div className="mb-6 flex items-start gap-3">
          <input
            type="checkbox"
            id="age-confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-700 accent-blue-600"
          />
          <label htmlFor="age-confirm" className="cursor-pointer text-sm text-slate-300">
            I am 18 years or older and confirm my age.
          </label>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!confirmed || loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Confirming...' : 'Continue'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          This is a legal confirmation. Misrepresenting your age violates our Terms of Service.
        </p>
      </div>
    </div>
  );
}
