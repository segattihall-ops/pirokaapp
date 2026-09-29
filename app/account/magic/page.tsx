import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Magic link' };

export default function Page() {
  return (
    <>
      <span className="eyebrow">Account</span>
      <h1 className="mt-3 text-h2">Sign in with a magic link</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-fg-3">
        We’ll email you a link. It expires in 15 minutes.
      </p>
      <label className="mt-6 block text-[12px] text-fg-3" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        className="input mt-1.5"
        placeholder="you@example.com"
        disabled
      />
      <button type="button" className="btn-primary mt-4 w-full" disabled>
        Email me a link
      </button>
    </>
  );
}
