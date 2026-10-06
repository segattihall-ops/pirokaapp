import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LogoTile, Wordmark } from '@/components/logo';
import { HELP_SECTIONS, HELP_SLUGS, isHelpSlug } from '@/lib/help';
import { HELP_CONTENT } from '@/lib/help-content';

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return HELP_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  return { title: isHelpSlug(params.slug) ? HELP_SECTIONS[params.slug].title : 'Help' };
}

/** Help & Legal — header, sticky left nav (Help / Policies), content. Content lands in Phase 7. */
export default function HelpPage({ params }: Props) {
  if (!isHelpSlug(params.slug)) notFound();
  const current = HELP_SECTIONS[params.slug];
  const groups = ['Help', 'Policies'] as const;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col px-4 pt-[calc(16px+var(--safe-top))] sm:px-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 rounded-logo">
          <LogoTile />
          <Wordmark />
        </Link>
        <span className="ml-2 text-[12px] text-fg-3">Help & Legal</span>
      </header>

      <div className="mt-6 grid gap-6 rail:grid-cols-[220px_1fr]">
        <nav
          aria-label="Help sections"
          className="-mx-4 overflow-x-auto px-4 rail:sticky rail:top-6 rail:mx-0 rail:self-start rail:overflow-visible rail:px-0"
        >
          <div className="flex gap-4 rail:flex-col rail:gap-5">
            {groups.map((g) => (
              <div key={g} className="flex shrink-0 flex-col gap-1">
                <span className="eyebrow mb-1">{g}</span>
                <div className="flex gap-1 rail:flex-col">
                  {HELP_SLUGS.filter((s) => HELP_SECTIONS[s].group === g).map((s) => {
                    const active = s === params.slug;
                    return (
                      <Link
                        key={s}
                        href={`/help/${s}`}
                        aria-current={active ? 'page' : undefined}
                        className={`tap flex items-center whitespace-nowrap rounded-[10px] px-3 text-[13px] font-medium ${
                          active ? 'bg-sel-fill text-fg' : 'text-fg-3 hover:text-fg'
                        }`}
                      >
                        {HELP_SECTIONS[s].title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <article className="glass animate-in rounded-hero p-5 sm:p-8">
          {'draft' in current && current.draft && (
            <div className="mb-4 inline-flex rounded-chip border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-warning">
              Draft — counsel review pending
            </div>
          )}
          <h1 className="text-h2 sm:text-h1">{current.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{current.blurb}</p>

          {params.slug in HELP_CONTENT && (
            <div className="mt-8 space-y-6">
              {HELP_CONTENT[params.slug as keyof typeof HELP_CONTENT].sections.map((section, i) => (
                <div key={i}>
                  <h2 className="text-[16px] font-semibold text-fg">{section.heading}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{section.body}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
      <div className="h-[calc(24px+var(--safe-bottom))]" />
    </div>
  );
}
