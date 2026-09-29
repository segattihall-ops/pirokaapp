import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Forgot password' };

export default function Page() {
  return (
    <>
      <span className="eyebrow">Account</span>
      <h1 className="mt-3 text-h2">Forgot your password?</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-fg-3">
        We’ll send a reset link. You can resend after 30 seconds.
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
        Send reset link
      </button>
    </>
  );
}
