'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUnsubscribe = async () => {
    if (!email || !token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please check your email.');
      return;
    }

    setLoading(true);
    setStatus('loading');

    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('You have been unsubscribed from email notifications.');
      } else {
        const error = await res.json();
        setStatus('error');
        setMessage(error.message || 'Failed to unsubscribe. Please try again.');
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setStatus('error');
      setMessage('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
        <h1 className="mb-4 text-center text-2xl font-bold text-white">Email Preferences</h1>

        {status === 'idle' && (
          <>
            <p className="mb-6 text-center text-slate-300">
              Are you sure you want to unsubscribe from ΠROKA email notifications?
            </p>

            <button
              onClick={handleUnsubscribe}
              disabled={!email || !token || loading}
              className="w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Unsubscribing...' : 'Unsubscribe'}
            </button>
          </>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mb-4 text-4xl">✓</div>
            <p className="text-green-400">{message}</p>
            <p className="mt-4 text-sm text-slate-400">You can manage your preferences anytime by logging in to your account.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mb-4 text-4xl">✗</div>
            <p className="text-red-400">{message}</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500"></div>
            <p className="text-slate-300">Processing...</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          This action will disable promotional and notification emails. You'll still receive transactional emails (account confirmations, password resets).
        </p>
      </div>
    </div>
  );
}
