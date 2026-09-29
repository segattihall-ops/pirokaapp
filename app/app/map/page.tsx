import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Map' };

/**
 * MAP — Phase 0 shell. MapLibre, pins, scrubber and sheets arrive in Phase 3.
 * The overlay geometry (14px inset, chips row, bottom pill) is already in place.
 */
export default function MapPage() {
  return (
    <div className="relative h-[calc(100dvh-66px-var(--safe-bottom))] w-full overflow-hidden rail:h-dvh">
      {/* Map canvas placeholder — replaced by <MapLibre /> in Phase 3 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-ink-900"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 55%, rgba(52,211,153,0.06), transparent 40%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: 'auto, 48px 48px, 48px 48px',
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.7)]"
      />

      {/* Your dot inside the fog circle */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="flex h-[240px] w-[240px] items-center justify-center rounded-full border border-dashed border-line-3">
          <div className="relative flex flex-col items-center">
            <span className="flex h-[54px] w-[54px] animate-pulse items-center justify-center rounded-full border-[3px] border-green bg-ink-750 text-[22px] font-semibold text-white">
              π
            </span>
            <span className="mt-2 rounded-chip bg-green px-2.5 py-0.5 text-[11px] font-semibold text-ink-950">
              You
            </span>
          </div>
        </div>
      </div>

      {/* Top overlay */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-2.5 p-3.5 pt-[calc(14px+var(--safe-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="tap flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full border border-fg-4" />
            Set your intent
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="tap flex h-11 w-11 items-center justify-center rounded-[14px] border border-line-2 bg-ink-850/90 backdrop-blur-md"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
              </svg>
            </button>
            <button
              type="button"
              className="tap rounded-[14px] border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
            >
              Layers
            </button>
            <button
              type="button"
              className="tap rounded-[14px] border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
            >
              Filter
            </button>
          </div>
        </div>
        <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none]">
          {['Everyone', 'Now', 'Tonight', 'Hosting', 'Visitors'].map((c, i) => (
            <button key={c} type="button" className={`chip shrink-0 ${i === 0 ? 'chip-selected' : ''}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-green' : 'bg-fg-4'}`} />
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom pill (time scrubber, collapsed) */}
      <div className="absolute inset-x-0 bottom-3.5 flex justify-center">
        <button
          type="button"
          className="tap flex items-center gap-2 rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
        >
          <span className="h-2 w-2 rounded-full bg-green" />
          Right now <span className="text-fg-3">0 available</span>
        </button>
      </div>
    </div>
  );
}
