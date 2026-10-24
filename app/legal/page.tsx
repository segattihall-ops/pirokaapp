import Link from 'next/link';
import { LogoTile, Wordmark } from '@/components/logo';
import { HELP_GROUPS, HELP_SECTIONS, HELP_SLUGS } from '@/lib/help';

export const metadata = {
  title: 'Legal Center',
  description: 'PIROKA legal, privacy, safety, content, billing, and reporting policies.',
};

export default function LegalCenterPage() {
  const legalGroups = HELP_GROUPS.filter((g) => g !== 'Help');

  return (
    <div className="min-h-dvh bg-ink-950 text-fg">
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

      <main className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-[clamp(18px,4vw,40px)] py-10">
        <div className="flex max-w-[720px] flex-col gap-3">
          <span className="text-eyebrow text-green">PIROKA</span>
          <h1 className="text-h1">Legal Center</h1>
          <p className="text-[15px] leading-[1.65] text-fg-2">
            Terms, privacy, billing, safety, content, reporting, and enforcement policies for PIROKA.
          </p>
        </div>

        {legalGroups.map((group) => (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">{group}</h2>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
              {HELP_SLUGS.filter((slug) => HELP_SECTIONS[slug].group === group).map((slug) => (
                <Link
                  key={slug}
                  href={`/help/${slug}`}
                  className="flex min-h-[116px] flex-col gap-2 rounded-card border border-line-1 bg-ink-900 p-4 transition-colors hover:border-sel-border hover:bg-ink-850"
                >
                  <span className="text-[15px] font-semibold">{HELP_SECTIONS[slug].title}</span>
                  <span className="text-[13px] leading-[1.5] text-fg-3">{HELP_SECTIONS[slug].blurb}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-card border border-line-1 bg-ink-900 p-5 text-[13px] leading-[1.6] text-fg-3">
          For urgent safety or removal requests, use{' '}
          <Link href="/help/report" className="text-green">
            Report or request removal
          </Link>
          . For account questions, use{' '}
          <Link href="/help/support" className="text-green">
            Support
          </Link>
          .
        </section>
      </main>
    </div>
  );
}
