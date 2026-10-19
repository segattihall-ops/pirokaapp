import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { LogoTile, Wordmark } from '@/components/logo';
import { ShareButton } from '@/components/event/share-button';

export const dynamic = 'force-dynamic';

type EventView = {
  name: string;
  type: string;
  day: string;
  time: string;
  venue: string;
  area: string;
  going: number;
  about: string;
  mapsQuery: string;
};

// The prototype's three sample events keep /e/e0–e2 shareable without a backend.
const SAMPLE: Record<string, EventView> = {
  e0: {
    name: 'Drag Bingo',
    type: 'Community night',
    day: 'TONIGHT',
    time: '9 PM',
    venue: 'Club Rain',
    area: 'Oak Lawn, Dallas',
    going: 64,
    about:
      'Queens, cards and prizes. Everyone welcome — come solo or bring friends. Proceeds go to local HIV testing.',
    mapsQuery: 'Club Rain Cedar Springs Rd, Dallas, TX 75219',
  },
  e1: {
    name: 'Sapphic Social',
    type: 'Meetup',
    day: 'FRI',
    time: '8 PM',
    venue: 'Rooftop 9',
    area: 'Uptown, Dallas',
    going: 38,
    about: 'A relaxed rooftop meetup for lesbian, bi and queer women and non-binary friends.',
    mapsQuery: 'Rooftop 9 McKinney Ave, Dallas, TX 75204',
  },
  e2: {
    name: 'Queer Run Club',
    type: 'Sport',
    day: 'SAT',
    time: '8 AM',
    venue: 'Katy Trail',
    area: 'Dallas',
    going: 27,
    about: 'Five easy kilometers, all paces, coffee after.',
    mapsQuery: 'Katy Trail, Dallas, TX',
  },
};

function dayLabel(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return {
    day: today ? 'TONIGHT' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined }),
  };
}

/** Public, shareable event page. Reads only public fields; the guest list and locations stay inside the app. */
async function loadEvent(id: string): Promise<EventView | null> {
  // Prototype samples are a design aid; production only serves real events.
  if (process.env.NODE_ENV !== 'production' && SAMPLE[id]) return SAMPLE[id];
  if (!isUuid(id) || !supabaseAdmin) return null;
  const [{ data: ev }, { count }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('title,description,location_name,starts_at,category,review_status')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('event_attendees')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_id', id),
  ]);
  // Partner-posted events are public only once an ambassador or admin approved them.
  if (!ev || ((ev as { review_status?: string | null }).review_status ?? 'approved') !== 'approved') return null;
  const { day, time } = dayLabel(ev.starts_at);
  return {
    name: ev.title,
    type: ev.category ?? 'Event',
    day,
    time,
    venue: ev.location_name,
    area: '',
    going: count ?? 0,
    about: ev.description ?? '',
    mapsQuery: ev.location_name,
  };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ev = await loadEvent(params.id);
  return ev
    ? { title: `${ev.name} · πroka`, description: ev.about || `${ev.type} at ${ev.venue}` }
    : { title: 'Event · πroka' };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const ev = await loadEvent(params.id);
  if (!ev) notFound();
  const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.mapsQuery);

  return (
    <div
      className="flex min-h-dvh flex-col items-center px-4 pb-10 pt-[calc(20px+var(--safe-top))] text-fg"
      style={{
        background: 'radial-gradient(70% 45% at 50% 0%, rgba(52,211,153,0.14), rgba(7,7,7,0) 70%), #070707',
      }}
    >
      <div className="flex w-full max-w-[520px] flex-col gap-[18px]">
        <Link href="/" className="flex items-center gap-2.5 rounded-logo">
          <LogoTile size={36} />
          <Wordmark />
        </Link>

        <section className="relative flex flex-col gap-3.5 overflow-hidden rounded-hero border border-line-2 bg-ink-850 bg-glass px-[22px] py-[26px] shadow-float">
          <div className="flex items-center gap-3">
            <span className="flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-btn border border-sel-border bg-sel-fill py-2">
              <span className="text-[10px] font-bold tracking-[0.1em] text-green">{ev.day}</span>
              <span className="text-[18px] font-semibold">{ev.time}</span>
            </span>
            <span className="flex flex-col gap-[3px]">
              <span className="text-[12px] font-semibold text-green">{ev.type}</span>
              <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] [text-wrap:balance]">
                {ev.name}
              </h1>
            </span>
          </div>
          {ev.about && <p className="text-[15px] leading-[1.55] text-fg-2 [text-wrap:pretty]">{ev.about}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-[3px] rounded-btn bg-ink-800 px-3.5 py-3">
              <span className="text-[11px] text-fg-3">Where</span>
              <span className="text-[14px] font-semibold">{ev.venue}</span>
              {ev.area && <span className="text-[12px] text-fg-3">{ev.area}</span>}
            </div>
            <div className="flex flex-col gap-[3px] rounded-btn bg-ink-800 px-3.5 py-3">
              <span className="text-[11px] text-fg-3">Going</span>
              <span className="text-[22px] font-semibold text-green">{ev.going}</span>
              <span className="text-[12px] text-fg-3">Names stay private</span>
            </div>
          </div>

          <Link
            href="/onboarding"
            className="tap flex h-12 items-center justify-center rounded-btn bg-green text-[15px] font-semibold text-ink-950"
          >
            RSVP in πroka
          </Link>
          <div className="flex gap-2">
            <ShareButton title={ev.name} />
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="tap flex h-11 flex-1 items-center justify-center rounded-btn border border-line-3 text-[13px] font-semibold text-fg"
            >
              Directions
            </a>
          </div>
        </section>

        <p className="text-center text-[12px] leading-[1.55] text-fg-4">
          18+ only. The exact guest list and anyone&apos;s location are only visible inside πroka.{' '}
          <Link href="/help/guidelines" className="text-green hover:text-green-hover">
            Community Guidelines
          </Link>
        </p>
      </div>
    </div>
  );
}
