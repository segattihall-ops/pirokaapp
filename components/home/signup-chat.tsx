'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchSession,
  isDemoClient,
  recordConsent,
  signInAnonymously,
  signInWithMagicLink,
  signInWithOAuth,
  signInWithPassword,
  signOut,
  submitAgeCheck,
} from '@/lib/auth/client';
import { AFTER_GATE_PATH, APP_PATH, type AuthProvider, type Session } from '@/lib/auth/types';

type Msg = { id: number; isBot?: boolean; isUser?: boolean; text: string; time?: string };
type Step = 'ask' | 'action' | 'wait' | 'consent' | 'face' | 'done' | 'emailWait';
type Face = 'idle' | 'starting' | 'scanning' | 'passed' | 'error';
type Pick = Exclude<AuthProvider, 'anonymous'> | 'anon';

const WELCOME: Msg = {
  id: 0,
  isBot: true,
  text: 'Welcome to πroka. How would you like to get in? Everything here stays private by default.',
};
const PICK_LABEL: Record<Pick, string> = {
  google: 'With Google',
  apple: 'With Apple',
  email: 'With my email',
  anon: 'Stay anonymous',
};
const PICK_REPLY: Record<Pick, string> = {
  google: 'Perfect. Tap below to sign in securely with Google — nothing is ever posted or shared.',
  apple: 'Great choice. Tap below to sign in with Apple — you can keep your email hidden.',
  email: "Works for me. Tap below and I'll send a one-time link — no password needed.",
  anon: 'No problem. Tap below to enter anonymously — no name, no email.',
};
const CONSENT_INTRO: Record<AuthProvider, string> = {
  google: 'Signed in with Google. Before you enter — πroka is adults-only, so two quick confirmations.',
  apple: 'Signed in with Apple. Before you enter — πroka is adults-only, so two quick confirmations.',
  email: 'Link confirmed. Before you enter — πroka is adults-only, so two quick confirmations.',
  anonymous:
    "You'll stay anonymous — no name, no email. πroka is adults-only, so two quick confirmations first.",
};
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function SignupChat({ gated, authError = null }: { gated: boolean; authError?: string | null }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [step, setStep] = useState<Step>('ask');
  const [provider, setProvider] = useState<Pick | null>(null);
  const [mode, setMode] = useState<'auth' | 'email' | 'done'>('auth');
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [view, setView] = useState<'chat' | 'classic'>('chat');
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [face, setFace] = useState<Face>('idle');
  const [faceP, setFaceP] = useState(0);
  const [faceMode, setFaceMode] = useState<'cam' | 'id'>('cam');
  const [session, setSession] = useState<Session | null>(null);
  const [cEmail, setCEmail] = useState('');
  const [cPass, setCPass] = useState('');
  const [cErr, setCErr] = useState('');
  const [cBusy, setCBusy] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const bot = useCallback(
    (reply: string, after?: () => void, ms = 1100) => {
      setTyping(true);
      setStep('wait');
      later(() => {
        setTyping(false);
        setMessages((m) => [...m, { id: Date.now(), isBot: true, text: reply }]);
        after?.();
      }, ms);
    },
    [later],
  );
  const say = useCallback(
    (userText: string, reply: string, after?: () => void) => {
      setMessages((m) => [...m, { id: Date.now(), isUser: true, text: userText, time: now() }]);
      bot(reply, after);
    },
    [bot],
  );
  const fail = useCallback(
    (e: unknown) =>
      bot(e instanceof Error ? e.message : 'Something went wrong. Try again.', () => setStep('ask'), 500),
    [bot],
  );

  /** Continue from wherever a signed-in visitor is in the gate: consent, face check, or done. */
  const resume = useCallback(
    (s: Session) => {
      setSession(s);
      if (s.ageVerified) {
        bot(
          gated ? "You're verified 18+. Enter πroka to continue." : "Welcome back — you're verified 18+.",
          () => {
            setStep('done');
            setMode('done');
          },
          400,
        );
      } else if (!s.consentAt) {
        bot(CONSENT_INTRO[s.provider], () => setStep('consent'), 600);
      } else {
        bot(
          'Last step: a quick face check to estimate your age. It runs on your device and the image is never stored.',
          () => {
            setStep('face');
            setFace('idle');
            setFaceP(0);
          },
          600,
        );
      }
    },
    [bot, gated],
  );

  /** Resume on mount (OAuth / magic-link return, or a gate redirect). */
  useEffect(() => {
    let cancelled = false;
    fetchSession().then((s) => {
      if (cancelled) return;
      if (s) resume(s);
      else if (authError) {
        // A failed OAuth / magic-link return: say what went wrong instead of silently showing the welcome.
        bot(
          `That sign-in didn't complete (${authError}). Pick an option below to try again.`,
          () => setStep('ask'),
          400,
        );
        // Drop the error from the address bar so a refresh doesn't repeat it.
        router.replace('/');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resume, authError, bot, router]);

  useEffect(() => {
    const s = scrollRef.current;
    if (s) s.scrollTop = s.scrollHeight;
  }, [messages, typing, step, face]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(
    () => () => {
      stopCam();
      if (scanRef.current) clearInterval(scanRef.current);
      timers.current.forEach(clearTimeout);
    },
    [stopCam],
  );

  const pick = (p: Pick) =>
    say(PICK_LABEL[p], PICK_REPLY[p], () => {
      setStep('action');
      setProvider(p);
    });

  const toConsent = (prov: AuthProvider) => bot(CONSENT_INTRO[prov], () => setStep('consent'), 900);

  const act = async () => {
    const p = provider;
    if (!p) return;
    try {
      if (p === 'google' || p === 'apple') {
        setStep('wait');
        await signInWithOAuth(p, '/');
        if (isDemoClient()) {
          setSession(await fetchSession());
          toConsent(p);
        }
        // Supabase mode navigates away to the provider; we resume on return via fetchSession().
      } else if (p === 'email') {
        bot(
          "What's your email?",
          () => {
            setStep('done');
            setMode('email');
            later(() => inputRef.current?.focus(), 50);
          },
          800,
        );
      } else {
        setStep('wait');
        await signInAnonymously();
        setSession(await fetchSession());
        toConsent('anonymous');
      }
    } catch (e) {
      fail(e);
    }
  };

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    if (mode === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t))
        return say(t, "That doesn't look like an email. Try again?", () => setStep('done'));
      try {
        setStep('wait');
        setMessages((m) => [...m, { id: Date.now(), isUser: true, text: t, time: now() }]);
        await signInWithMagicLink(t, '/');
        if (isDemoClient()) {
          setSession(await fetchSession());
          setMode('auth');
          bot(
            'Link confirmed (demo). Two quick confirmations — πroka is adults-only.',
            () => setStep('consent'),
            900,
          );
        } else {
          setMode('auth');
          bot(
            "Link sent — it expires in 15 minutes. Open it on this device and we'll pick up right here.",
            () => setStep('emailWait'),
            900,
          );
        }
      } catch (e) {
        setMode('auth');
        fail(e);
      }
    } else if (step === 'done')
      say(t, "Noted. Your profile setup is next — I'll guide you.", () => setStep('done'));
    else say(t, "Happy to chat once you're in. How would you like to continue?", () => setStep('ask'));
  };

  const consent = async () => {
    if (!ageOk || !termsOk) return;
    try {
      setStep('wait');
      const s = await recordConsent();
      setSession(s);
      say(
        "I'm 18+ and I accept the terms",
        'Thanks. Last step: a quick face check to estimate your age. It runs on your device and the image is never stored.',
        () => {
          setStep('face');
          setFace('idle');
          setFaceP(0);
        },
      );
    } catch (e) {
      fail(e);
    }
  };

  const finishAge = useCallback(
    async (method: 'face' | 'id') => {
      try {
        const s = await submitAgeCheck(method, `local:${method}:${Date.now()}`);
        setSession(s);
        setFace('passed');
        later(
          () =>
            bot(
              "Age check passed — you're verified 18+. Welcome to πroka.",
              () => {
                setStep('done');
                setMode('done');
              },
              700,
            ),
          600,
        );
      } catch (e) {
        setFace('error');
        fail(e);
      }
    },
    [bot, fail, later],
  );

  const scan = useCallback(
    (method: 'face' | 'id') => {
      if (scanRef.current) clearInterval(scanRef.current);
      setFace('scanning');
      setFaceP(0);
      let p = 0;
      scanRef.current = setInterval(() => {
        p = Math.min(100, p + 2.2);
        setFaceP(p);
        if (p >= 100) {
          if (scanRef.current) clearInterval(scanRef.current);
          stopCam();
          void finishAge(method);
        }
      }, 70);
    },
    [finishAge, stopCam],
  );

  const startFace = async () => {
    setFace('starting');
    setFaceMode('cam');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 } },
        audio: false,
      });
      const v = videoRef.current;
      if (v) {
        v.muted = true;
        v.setAttribute('playsinline', '');
        v.srcObject = streamRef.current;
        try {
          await v.play();
        } catch {}
      }
      scan('face');
    } catch {
      stopCam();
      setFace('error');
    }
  };
  const idCheck = () => {
    stopCam();
    setFaceMode('id');
    scan('id');
  };

  const restart = async () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopCam();
    if (scanRef.current) clearInterval(scanRef.current);
    await signOut().catch(() => {});
    setSession(null);
    setMessages([WELCOME]);
    setStep('ask');
    setProvider(null);
    setMode('auth');
    setTyping(false);
    setInput('');
    setAgeOk(false);
    setTermsOk(false);
    setFace('idle');
    setFaceP(0);
  };

  const signin = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cEmail.trim())) return setCErr('Enter a valid email address.');
    if (cPass.length < 6) return setCErr('Password must be at least 6 characters.');
    setCBusy('Signing in…');
    setCErr('');
    try {
      await signInWithPassword(cEmail.trim(), cPass);
      const s = await fetchSession();
      if (s?.ageVerified) return router.push(APP_PATH);
      // Not through the gate yet: hand over to the chat, which continues at consent or the face check.
      setCBusy('');
      setView('chat');
      if (s) resume(s);
    } catch (e) {
      setCBusy('');
      setCErr(e instanceof Error ? e.message : 'Could not sign in.');
    }
  };
  const classicOAuth = async (p: 'google' | 'apple') => {
    setCBusy(p === 'google' ? 'Connecting to Google…' : 'Connecting to Apple…');
    setCErr('');
    try {
      await signInWithOAuth(p, APP_PATH);
      if (isDemoClient()) {
        setView('chat');
        setCBusy('');
        setSession(await fetchSession());
        toConsent(p);
      }
    } catch (e) {
      setCBusy('');
      setCErr(e instanceof Error ? e.message : 'Could not sign in.');
    }
  };

  const idle = !typing;
  const faceDeg = Math.round((face === 'passed' ? 100 : faceP) * 3.6);
  const faceTitle = {
    idle: 'Quick face age check',
    starting: 'Opening camera…',
    scanning:
      faceMode === 'id' ? `Checking your ID… ${Math.round(faceP)}%` : `Scanning… ${Math.round(faceP)}%`,
    passed: 'Verified 18+',
    error: 'Camera unavailable',
  }[face];
  const faceSub = {
    idle: 'We estimate your age from a live selfie. Processed on-device, never stored.',
    starting: 'Allow camera access to continue.',
    scanning: faceP < 45 ? 'Center your face in the circle and hold still.' : 'Estimating age…',
    passed: 'Thanks. Your image has been discarded.',
    error: 'Allow camera access, or verify with a photo ID instead.',
  }[face];
  const showFace = view === 'chat' && (step === 'face' || (face === 'passed' && step !== 'ask'));
  const showEnter =
    view === 'chat' && step === 'done' && mode !== 'email' && !typing && Boolean(session?.ageVerified);

  return (
    <div className="flex w-full max-w-[440px] animate-[piIn_.9s_.15s_cubic-bezier(.2,.7,.2,1)_both] flex-col gap-3">
      <section
        className="relative overflow-hidden rounded-hero border border-[rgba(255,255,255,0.13)]"
        style={{
          background:
            'linear-gradient(155deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.025) 45%, rgba(255,255,255,0.04) 100%)',
          backdropFilter: 'blur(28px) saturate(170%)',
          WebkitBackdropFilter: 'blur(28px) saturate(170%)',
          boxShadow:
            '0 40px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(255,255,255,0.04), 0 0 60px rgba(52,211,153,0.06)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-hero"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 18%), radial-gradient(120% 60% at 0% 0%, rgba(52,211,153,0.07), rgba(52,211,153,0) 60%)',
          }}
        />

        {/* Card header */}
        <div className="flex items-center justify-between border-b border-line-1 px-5 py-[18px]">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[rgba(52,211,153,0.45)] bg-ink-900 text-[16px] font-bold text-green shadow-[0_0_14px_rgba(52,211,153,0.25)]">
              π
            </div>
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold tracking-[-0.01em]">πroka</span>
              <span className="flex items-center gap-1.5 text-[12px] text-green">
                <span className="h-[7px] w-[7px] animate-[piPulseSm_2s_infinite] rounded-full bg-green" />
                Online
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {view === 'chat' && messages.length > 1 && (
              <button
                type="button"
                onClick={restart}
                title="Start over"
                aria-label="Start over"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 bg-white/5 text-fg-3 transition-colors hover:border-[rgba(52,211,153,0.45)] hover:text-fg"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            )}
            {view === 'chat' ? (
              <button
                type="button"
                onClick={() => {
                  setView('classic');
                  setCErr('');
                  setCBusy('');
                }}
                className="h-10 rounded-chip border border-line-2 bg-white/5 px-[13px] text-[12px] font-medium text-fg transition-colors hover:border-[rgba(52,211,153,0.5)]"
              >
                Log in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView('chat')}
                className="flex h-10 items-center gap-1.5 rounded-chip border border-line-2 bg-white/5 px-[13px] text-[12px] font-medium text-fg transition-colors hover:border-[rgba(52,211,153,0.5)]"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back to chat
              </button>
            )}
          </div>
        </div>

        {view === 'chat' ? (
          <>
            <div
              ref={scrollRef}
              className="flex max-h-[380px] min-h-[300px] flex-col gap-3.5 overflow-y-auto p-5"
            >
              {messages.map((m) =>
                m.isBot ? (
                  <div key={m.id} className="flex animate-[piIn_.45s_ease-out_both] items-end gap-2.5">
                    <BotAvatar />
                    <div className="max-w-[85%] rounded-[18px_18px_18px_6px] border border-[rgba(255,255,255,0.09)] bg-white/[0.07] px-[15px] py-3 text-[14px] leading-[1.5] text-fg [text-wrap:pretty]">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className="flex animate-[piIn_.35s_ease-out_both] flex-col items-end gap-[5px]"
                  >
                    <div className="max-w-[80%] rounded-[18px_18px_6px_18px] bg-green px-[15px] py-2.5 text-[14px] font-semibold leading-[1.4] text-ink-950">
                      {m.text}
                    </div>
                    <span className="text-[11px] text-fg-4">{m.time}</span>
                  </div>
                ),
              )}

              {idle && step === 'ask' && (
                <div className="flex animate-[piIn_.5s_.05s_ease-out_both] flex-wrap gap-2 pl-[38px]">
                  {(['google', 'apple', 'email', 'anon'] as Pick[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => pick(p)}
                      className="rounded-chip border border-[rgba(255,255,255,0.14)] bg-white/5 px-[15px] py-[9px] text-[13px] font-medium text-fg transition-colors hover:border-[rgba(52,211,153,0.5)] hover:bg-[rgba(52,211,153,0.08)]"
                    >
                      {PICK_LABEL[p]}
                    </button>
                  ))}
                </div>
              )}

              {idle && step === 'action' && provider && (
                <div className="flex animate-[piIn_.5s_ease-out_both] flex-col gap-2 pl-[38px]">
                  {provider === 'google' && (
                    <ActionButton onClick={act} variant="white">
                      <span className="text-[16px] font-bold">G</span>Continue with Google
                    </ActionButton>
                  )}
                  {provider === 'apple' && (
                    <ActionButton onClick={act} variant="black">
                      <AppleIcon />
                      Continue with Apple
                    </ActionButton>
                  )}
                  {provider === 'email' && (
                    <ActionButton onClick={act} variant="subtle">
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                      Use Email Instead
                    </ActionButton>
                  )}
                  {provider === 'anon' && (
                    <ActionButton onClick={act} variant="subtle">
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.9 4.2A10 10 0 0 1 12 4c5.5 0 9 6 9 8a13 13 0 0 1-2.2 3.2M6.6 6.6C4.3 8.1 3 10.6 3 12c0 2 3.5 8 9 8a9.7 9.7 0 0 0 5.4-1.6" />
                        <path d="m3 3 18 18" />
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </svg>
                      Continue Anonymously
                    </ActionButton>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStep('ask');
                      setProvider(null);
                    }}
                    className="self-center p-1.5 text-[12px] font-medium text-fg-3 hover:text-fg"
                  >
                    Choose another way
                  </button>
                </div>
              )}

              {typing && (
                <div className="flex items-end gap-2.5">
                  <BotAvatar />
                  <div className="flex gap-[5px] rounded-[18px_18px_18px_6px] border border-[rgba(255,255,255,0.09)] bg-white/[0.07] px-4 py-[15px]">
                    {[0, 0.15, 0.3].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-fg"
                        style={{ animation: `piDot 1.2s ${d}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {view === 'chat' && step === 'consent' && !typing && (
                <div className="ml-[38px] flex animate-[piIn_.45s_ease-out_both] flex-col gap-3.5 rounded-[18px] border border-line-2 bg-white/5 p-4">
                  <ConsentRow checked={ageOk} onToggle={() => setAgeOk((v) => !v)}>
                    <span className="font-semibold">I&apos;m 18 or older.</span> πroka is for adults only.
                  </ConsentRow>
                  <ConsentRow checked={termsOk} onToggle={() => setTermsOk((v) => !v)}>
                    I accept the <PolicyLink href="/help/terms">Terms of Service</PolicyLink>,{' '}
                    <PolicyLink href="/help/privacy">Privacy Policy</PolicyLink> and{' '}
                    <PolicyLink href="/help/guidelines">Community Guidelines</PolicyLink>.
                  </ConsentRow>
                  <button
                    type="button"
                    onClick={consent}
                    disabled={!(ageOk && termsOk)}
                    className="h-11 rounded-input bg-green text-[14px] font-semibold text-ink-950 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-fg-4"
                  >
                    Continue
                  </button>
                </div>
              )}

              {showFace && (
                <div className="ml-[38px] flex animate-[piIn_.45s_ease-out_both] flex-col items-center gap-2.5 rounded-[18px] border border-line-2 bg-white/5 px-4 py-5 text-center">
                  <div
                    className="h-[176px] w-[176px] rounded-full p-1 shadow-[0_0_40px_rgba(52,211,153,0.15)]"
                    style={{
                      background: `conic-gradient(#34d399 ${faceDeg}deg, rgba(255,255,255,0.1) 0deg)`,
                    }}
                  >
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-ink-900">
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                      />
                      {(face === 'idle' || face === 'error') && (
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="relative"
                        >
                          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
                        </svg>
                      )}
                      {(face === 'scanning' || face === 'starting') && (
                        <span className="absolute left-[10%] right-[10%] h-[2px] animate-[piScan_1.8s_ease-in-out_infinite] bg-green shadow-[0_0_14px_3px_rgba(52,211,153,0.6)]" />
                      )}
                      {face === 'passed' && (
                        <span className="absolute inset-0 flex animate-[piFade_.4s_ease-out_both] items-center justify-center bg-[rgba(7,7,7,0.7)]">
                          <svg
                            width="56"
                            height="56"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="mt-1 text-[15px] font-semibold">{faceTitle}</span>
                  <span className="max-w-[270px] text-[12px] leading-[1.5] text-fg-3">{faceSub}</span>
                  {(face === 'idle' || face === 'error') && (
                    <div className="mt-1 flex w-full flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={startFace}
                        className="h-11 rounded-input bg-white text-[14px] font-semibold text-ink-950"
                      >
                        Start face check
                      </button>
                      <button
                        type="button"
                        onClick={idCheck}
                        className="h-9 text-[12px] font-medium text-fg-3 hover:text-fg"
                      >
                        Verify with a photo ID instead
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showEnter && (
              <div className="animate-[piIn_.45s_ease-out_both] pb-4 pl-[58px] pr-5">
                <Link
                  href={AFTER_GATE_PATH}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-btn bg-green text-[14px] font-semibold text-ink-950 shadow-[0_10px_30px_rgba(52,211,153,0.3)]"
                >
                  Enter πroka →
                </Link>
              </div>
            )}

            <div className="flex gap-2 border-t border-line-1 px-4 pb-4 pt-3.5">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={mode === 'email' ? 'you@email.com' : 'Type a message…'}
                type={mode === 'email' ? 'email' : 'text'}
                inputMode={mode === 'email' ? 'email' : 'text'}
                autoComplete={mode === 'email' ? 'email' : 'off'}
                aria-label={mode === 'email' ? 'Your email' : 'Message'}
                className="h-[46px] min-w-0 flex-1 rounded-btn border border-[rgba(255,255,255,0.08)] bg-black/[0.28] px-4 text-[14px] text-fg outline-none transition-colors placeholder:text-fg-4 focus:border-[rgba(52,211,153,0.5)]"
              />
              <button
                type="button"
                onClick={send}
                className="h-[46px] rounded-btn bg-white px-5 text-[14px] font-semibold text-ink-950"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="relative flex animate-[piIn_.45s_ease-out_both] flex-col gap-3.5 px-5 pb-[22px] pt-6">
            <div className="flex flex-col gap-1">
              <span className="text-[20px] font-semibold tracking-[-0.02em]">Log in</span>
              <span className="text-[13px] text-fg-3">Welcome back. Your profile stays private.</span>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-fg-3">Email</span>
              <input
                type="email"
                value={cEmail}
                onChange={(e) => {
                  setCEmail(e.target.value);
                  setCErr('');
                }}
                autoComplete="email"
                placeholder="you@email.com"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[12px] text-fg-3">
                <span>Password</span>
                <Link href="/account/forgot" className="text-fg-3 hover:text-green">
                  Forgot password?
                </Link>
              </span>
              <input
                type="password"
                value={cPass}
                onChange={(e) => {
                  setCPass(e.target.value);
                  setCErr('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && signin()}
                autoComplete="current-password"
                placeholder="••••••••"
                className="input"
              />
            </label>
            {cErr && (
              <span role="alert" className="text-[12px] text-danger">
                {cErr}
              </span>
            )}
            <button
              type="button"
              onClick={signin}
              disabled={Boolean(cBusy)}
              className="h-[46px] rounded-btn bg-white text-[14px] font-semibold text-ink-950 disabled:opacity-70"
            >
              {cBusy || 'Log in'}
            </button>
            <div className="flex items-center gap-3 text-[12px] text-fg-4">
              <span className="h-px flex-1 bg-line-2" />
              or
              <span className="h-px flex-1 bg-line-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => classicOAuth('google')}
                className="btn-secondary h-11 gap-2"
              >
                <span className="text-[15px] font-bold">G</span>Google
              </button>
              <button
                type="button"
                onClick={() => classicOAuth('apple')}
                className="btn-secondary h-11 gap-2"
              >
                <AppleIcon size={14} />
                Apple
              </button>
            </div>
            <div className="text-center text-[12px] text-fg-3">
              New to πroka?{' '}
              <button
                type="button"
                onClick={() => setView('chat')}
                className="font-medium text-fg hover:text-green"
              >
                Create account
              </button>
            </div>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => (step === 'action' ? act() : inputRef.current?.focus())}
        className="h-12 rounded-btn border border-line-2 bg-white/[0.04] text-[14px] font-semibold text-fg transition-colors hover:border-[rgba(52,211,153,0.5)]"
      >
        Start chatting
      </button>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(52,211,153,0.35)] bg-ink-900 text-[13px] font-bold text-green">
      π
    </div>
  );
}

function ActionButton({
  onClick,
  variant,
  children,
}: {
  onClick: () => void;
  variant: 'white' | 'black' | 'subtle';
  children: React.ReactNode;
}) {
  const cls = {
    white: 'bg-white text-ink-950',
    black: 'border border-[rgba(255,255,255,0.16)] bg-black text-white',
    subtle: 'border border-[rgba(255,255,255,0.14)] bg-white/[0.06] text-fg',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[46px] items-center justify-center gap-2.5 rounded-btn text-[14px] font-semibold transition-transform active:scale-[0.99] ${cls}`}
    >
      {children}
    </button>
  );
}

function ConsentRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex items-start gap-3 text-left text-[13px] leading-[1.45] text-fg"
    >
      {checked ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-green">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#070707"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-[6px] border-[1.5px] border-white/30" />
      )}
      <span>{children}</span>
    </button>
  );
}

function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="text-green underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

function AppleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z" />
    </svg>
  );
}
