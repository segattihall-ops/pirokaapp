import Link from 'next/link';

/** Account flows: forgot password, magic link, reset. Spec: design/Piroka Account.dc.html. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-[22px] px-[18px] pb-[calc(32px+var(--safe-bottom))] pt-[calc(32px+var(--safe-top))] text-fg"
      style={{
        background: 'radial-gradient(60% 45% at 50% 20%, rgba(52,211,153,0.08), rgba(7,7,7,0) 70%), #070707',
      }}
    >
      <Link href="/" aria-label="πroka home" className="flex items-center gap-2.5 rounded-logo">
        <span
          className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.16)] text-[20px] font-bold"
          style={{ background: 'linear-gradient(160deg, #262626 0%, #070707 65%)' }}
        >
          π<span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-green" />
        </span>
        <span className="text-[19px] font-semibold tracking-[-0.02em]">πroka</span>
      </Link>
      {children}
      <Link href="/help/support" className="tap-link text-[13px] text-fg-3 hover:text-green">
        Locked out? Talk to a person
      </Link>
    </div>
  );
}
