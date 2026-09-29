import Link from 'next/link';

/**
 * Logo tile: gradient square, hairline border, white π, 7px green dot top-right with glow.
 * Spec: design_handoff/README.md → Design tokens → Logo.
 */
export function LogoTile({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center rounded-logo border border-[rgba(255,255,255,0.16)] bg-logo font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      π
      <span
        className="absolute rounded-full bg-green"
        style={{ width: 7, height: 7, top: 6, right: 6, boxShadow: '0 0 8px #34d399' }}
      />
    </span>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`text-[17px] font-semibold tracking-[-0.02em] text-fg ${className}`}>πroka</span>;
}

export function LogoLockup({ href = '/', tagline = false }: { href?: string; tagline?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3 rounded-logo">
      <LogoTile />
      <span className="flex flex-col leading-none">
        <Wordmark />
        {tagline && <span className="mt-1 text-[12px] text-fg-3">Know who’s ready.</span>}
      </span>
    </Link>
  );
}
