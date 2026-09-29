/**
 * Phase 0 placeholder for screens that arrive in later phases.
 * Keeps the route tree, layout and tokens real while content is pending.
 */
export function Placeholder({
  eyebrow,
  title,
  phase,
  spec,
  children,
}: {
  eyebrow: string;
  title: string;
  phase: string;
  spec: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="text-h2 sm:text-h1">{title}</h1>
      <p className="text-[14px] leading-relaxed text-fg-3">
        Built in <span className="text-fg-2">{phase}</span>. Reference:{' '}
        <code className="rounded-[6px] bg-ink-850 px-1.5 py-0.5 text-[12px] text-fg-2">{spec}</code>
      </p>
      {children}
    </section>
  );
}
