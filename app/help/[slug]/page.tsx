import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LogoTile, Wordmark } from '@/components/logo';
import { HELP_SECTIONS, HELP_SLUGS, isHelpSlug, type HelpSlug } from '@/lib/help';
import { HELP_CONTENT } from '@/lib/help-content';
import { HelpCenter } from '@/components/help/help-center';
import { SupportChat } from '@/components/help/support-chat';
import { AccountStanding } from '@/components/help/account-standing';
import { ReportForm } from '@/components/help/report-form';

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return HELP_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  return { title: isHelpSlug(params.slug) ? HELP_SECTIONS[params.slug].title : 'Help' };
}

const INTERACTIVE: Partial<Record<HelpSlug, () => JSX.Element>> = {
  help: HelpCenter,
  support: SupportChat,
  appeals: AccountStanding,
  report: ReportForm,
};

/** Help, safety & legal — design_handoff → Piroka_Help.dc.html: header, sticky left nav (Help / Policies), tab content. */
export default function HelpPage({ params }: Props) {
  if (!isHelpSlug(params.slug)) notFound();
  const slug = params.slug;
  const Tab = INTERACTIVE[slug];
  const doc = HELP_CONTENT[slug];
  const groups = ['Help', 'Policies'] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-fg">
      <header className="flex items-center justify-between gap-3 border-b border-line-1 px-[clamp(18px,4vw,40px)] py-[18px]">
        <Link href="/" className="flex items-center gap-2.5 rounded-logo">
          <LogoTile size={36} />
          <Wordmark />
        </Link>
        <Link
          href="/app/map"
          className="tap flex h-[38px] items-center rounded-input border border-line-3 px-3.5 text-[13px] font-medium text-fg"
        >
          Back to the app
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-wrap gap-7 px-[clamp(18px,4vw,40px)] pb-12 pt-7">
        <nav
          aria-label="Help sections"
          className="flex w-full flex-col gap-1 rail:sticky rail:top-5 rail:w-[240px] rail:shrink-0 rail:self-start"
        >
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-1">
              <span className="px-3 pb-1.5 pt-3.5 text-eyebrow text-fg-4">{g}</span>
              {HELP_SLUGS.filter((s) => HELP_SECTIONS[s].group === g).map((s) => {
                const active = s === slug;
                return (
                  <Link
                    key={s}
                    href={`/help/${s}`}
                    aria-current={active ? 'page' : undefined}
                    className="relative flex items-center justify-between rounded-input px-3 py-2.5 text-[14px] font-medium text-fg-2 hover:bg-ink-850 hover:text-fg"
                  >
                    {active && (
                      <>
                        <span className="absolute inset-0 rounded-input bg-ink-850" />
                        <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-chip bg-green" />
                      </>
                    )}
                    <span className={`relative ${active ? 'text-fg' : ''}`}>{HELP_SECTIONS[s].title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <main className="flex min-w-0 flex-[999_1_420px] animate-in flex-col gap-[18px]">
          {Tab ? (
            <Tab />
          ) : doc ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h1 className="text-h1">{doc.title}</h1>
                <span className="text-[13px] text-fg-4">{doc.meta}</span>
              </div>
              {doc.draft && (
                <span className="rounded-input border border-dashed border-line-3 px-3.5 py-2.5 text-[12px] text-fg-3">
                  Draft text for design review. Have it reviewed by counsel before launch.
                </span>
              )}
              {doc.sections.map((sec) => (
                <section key={sec.heading} className="flex flex-col gap-2 pt-2">
                  <h2 className="text-[17px] font-semibold">{sec.heading}</h2>
                  <p className="max-w-[68ch] text-[15px] leading-[1.65] text-fg-2 [text-wrap:pretty]">
                    {sec.body}
                  </p>
                </section>
              ))}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
