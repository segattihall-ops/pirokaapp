'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isDemoClient, requestPasswordReset, signInWithMagicLink, updatePassword } from '@/lib/auth/client';
import { APP_PATH } from '@/lib/auth/types';

export type AccountView = 'forgot' | 'magic' | 'reset';
type View = AccountView | 'sent' | 'done';

const IC = {
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v2h3v-2h2.1A4 4 0 0 1 15 7zM16 10h.01',
  check: 'm5 12 5 5L20 7',
  spark: 'M13 2 4 14h7l-1 8 9-12h-7z',
};
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Port of design/Piroka Account.dc.html: forgot → sent → reset → done, and magic → sent → done. */
export function AccountFlow({ initial }: { initial: AccountView }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initial);
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [sentMode, setSentMode] = useState<'reset' | 'magic'>(initial === 'magic' ? 'magic' : 'reset');
  const [err, setErr] = useState('');
  const cd = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const e = sessionStorage.getItem('piroka_email');
      if (e) setEmail(e);
    } catch {}
    return () => {
      if (cd.current) clearInterval(cd.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(30);
    if (cd.current) clearInterval(cd.current);
    cd.current = setInterval(
      () => setCooldown((c) => (c <= 1 ? (clearInterval(cd.current!), 0) : c - 1)),
      1000,
    );
  };

  const send = async (mode: 'reset' | 'magic') => {
    if (!emailOk(email)) return setTried(true);
    setBusy(true);
    setErr('');
    try {
      if (mode === 'magic') await signInWithMagicLink(email.trim(), APP_PATH);
      else await requestPasswordReset(email.trim());
      setSentMode(mode);
      setView('sent');
      startCooldown();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the email.');
    } finally {
      setBusy(false);
    }
  };

  const rules: [string, boolean][] = [
    ['At least 10 characters', pw.length >= 10],
    ['A number', /\d/.test(pw)],
    ['Upper and lower case', /[a-z]/.test(pw) && /[A-Z]/.test(pw)],
    ['Passwords match', Boolean(pw) && pw === pw2],
  ];
  const pwOk = rules.every((r) => r[1]);

  const savePassword = async () => {
    if (!pwOk) return;
    setBusy(true);
    setErr('');
    try {
      await updatePassword(pw);
      setSentMode('reset');
      setView('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  const C: Record<
    View,
    { title: string; sub: string; icon: string; cta: string; action: (() => void) | null }
  > = {
    forgot: {
      title: 'Reset your password',
      sub: 'Enter the email on your account. We’ll send a secure link to set a new password.',
      icon: IC.key,
      cta: 'Send reset link',
      action: () => send('reset'),
    },
    magic: {
      title: 'Sign in with a link',
      sub: 'No password needed. We’ll email you a one-time link that signs you in on this device.',
      icon: IC.spark,
      cta: 'Email me a link',
      action: () => send('magic'),
    },
    sent: {
      title: 'Check your inbox',
      sub:
        sentMode === 'magic'
          ? 'Tap the link in the email to sign in. It only works once.'
          : 'Tap the link in the email to choose a new password.',
      icon: IC.mail,
      cta: '',
      action: null,
    },
    reset: {
      title: 'Choose a new password',
      sub: 'You’ll be signed out everywhere else for safety.',
      icon: IC.key,
      cta: 'Save password',
      action: savePassword,
    },
    done: {
      title: sentMode === 'magic' ? 'You’re signed in' : 'Password updated',
      sub:
        sentMode === 'magic'
          ? 'Welcome back. Your map is ready.'
          : 'Use your new password next time you log in.',
      icon: IC.check,
      cta: '',
      action: null,
    },
  };
  const c = C[view];
  const bad = tried && !emailOk(email);
  const canPrimary = view === 'reset' ? pwOk : true;
  const links =
    view === 'magic'
      ? [
          { label: 'Use a password instead', href: '/' },
          { label: 'Forgot password?', href: '/account/forgot' },
        ]
      : [
          { label: '← Back to log in', href: '/' },
          { label: 'Email me a sign-in link', href: '/account/magic' },
        ];

  return (
    <section
      className="flex w-full max-w-[420px] animate-[piIn_.4s_ease-out_both] flex-col gap-4 rounded-hero border border-line-2 px-6 py-7 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      style={{
        background:
          'linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 50%), rgba(12,12,12,0.9)',
      }}
    >
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] border border-[rgba(52,211,153,0.45)] bg-[rgba(52,211,153,0.12)]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={c.icon} />
        </svg>
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] [text-wrap:balance]">{c.title}</h1>
        <p className="text-[14px] leading-[1.55] text-fg-3 [text-wrap:pretty]">{c.sub}</p>
      </div>

      {(view === 'forgot' || view === 'magic') && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-3">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                try {
                  sessionStorage.setItem('piroka_email', e.target.value);
                } catch {}
              }}
              onKeyDown={(e) => e.key === 'Enter' && c.action?.()}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={bad}
              className="h-12 rounded-btn border bg-black/35 px-3.5 text-[15px] text-fg outline-none placeholder:text-fg-4 focus:border-[rgba(52,211,153,0.55)]"
              style={{ borderColor: bad ? 'rgba(248,113,113,0.7)' : 'rgba(255,255,255,0.12)' }}
            />
          </label>
          {bad && (
            <span role="alert" className="-mt-2 text-[12px] text-danger">
              Enter a valid email address.
            </span>
          )}
        </>
      )}

      {view === 'sent' && (
        <>
          <div className="flex flex-col gap-1.5 rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-white/[0.04] p-3.5">
            <span className="text-[13px] text-fg-3">Sent to</span>
            <span className="break-all text-[15px] font-semibold">{email}</span>
            <span className="text-[12px] text-fg-4">
              Expires in {sentMode === 'magic' ? '15 minutes' : '30 minutes'}. Check spam if you don’t see it.
            </span>
          </div>
          {isDemoClient() && (
            <button
              type="button"
              onClick={() => (sentMode === 'magic' ? router.push(APP_PATH) : setView('reset'))}
              className="h-12 rounded-btn border border-dashed border-[rgba(52,211,153,0.6)] bg-[rgba(52,211,153,0.06)] text-[14px] font-semibold text-green"
            >
              Open the link (demo)
            </button>
          )}
          <button
            type="button"
            onClick={() => !cooldown && send(sentMode)}
            disabled={cooldown > 0}
            className="h-10 text-[13px] font-medium"
            style={{ color: cooldown ? '#666' : '#34d399' }}
          >
            {cooldown ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
        </>
      )}

      {view === 'reset' && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-3">New password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 10 characters"
              className="input h-12 bg-black/35"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-3">Confirm password</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && savePassword()}
              autoComplete="new-password"
              className="input h-12 bg-black/35"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            {rules.map(([label, pass]) => (
              <span
                key={label}
                className="flex items-center gap-2 text-[12px]"
                style={{ color: pass ? '#34d399' : '#999' }}
              >
                <span className="w-3.5 text-center">{pass ? '✓' : '·'}</span>
                {label}
              </span>
            ))}
          </div>
        </>
      )}

      {view === 'done' && (
        <Link
          href={sentMode === 'magic' ? APP_PATH : '/'}
          className="flex h-12 items-center justify-center rounded-btn bg-green text-[15px] font-semibold text-ink-950"
        >
          {sentMode === 'magic' ? 'Open πroka' : 'Back to log in'}
        </Link>
      )}

      {err && (
        <span role="alert" className="text-[12px] text-danger">
          {err}
        </span>
      )}

      {c.cta && (
        <button
          type="button"
          onClick={() => !busy && c.action?.()}
          disabled={!canPrimary || busy}
          className="flex h-[50px] items-center justify-center gap-2.5 rounded-[15px] text-[15px] font-semibold"
          style={{
            background: canPrimary ? '#34d399' : 'rgba(255,255,255,0.08)',
            color: canPrimary ? '#070707' : '#666',
          }}
        >
          {busy && (
            <span className="h-4 w-4 animate-[piSpin_.8s_linear_infinite] rounded-full border-2 border-[rgba(7,7,7,0.25)] border-t-ink-950" />
          )}
          {busy ? 'Sending…' : c.cta}
        </button>
      )}

      <div className="flex flex-wrap justify-between gap-3 text-[13px]">
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="text-fg-3 hover:text-green">
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
