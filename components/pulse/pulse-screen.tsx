'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { distanceLabel, getPosition, INTENTS, intentMeta } from '@/lib/geo/client';
import type { NearbyPerson } from '@/app/api/nearby/route';
import { ProfileSheet } from '@/components/map/profile-sheet';
import { AssistantPanel } from '@/components/map/assistant-panel';
import { useFeatures } from '@/lib/billing/use-features';
import { FeaturePaywall } from '@/components/billing/feature-paywall';
import { ActivityHeatmap } from './activity-heatmap';
import { ActivityTrends } from './activity-trends';

export function PulseScreen() {
  const router = useRouter();
  const { isPremium } = useFeatures();
  const [people, setPeople] = useState<NearbyPerson[] | null>(null);
  const [hotspots, setHotspots] = useState<{ lat: number; lon: number; count: number }[]>([]);
  const [configured, setConfigured] = useState(true);
  const [selected, setSelected] = useState<NearbyPerson | null>(null);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [tab, setTab] = useState<'people' | 'trends' | 'heatmap'>('people');
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getPosition();
      setPos({ lat: p.lat, lon: p.lon });
      const r = await fetch(`/api/nearby?lat=${p.lat}&lon=${p.lon}&radius=25000`, {
        cache: 'no-store',
      }).catch(() => null);
      if (!r?.ok) return setPeople([]);
      const j = await r.json();
      setConfigured(j.configured);
      setPeople(j.people);
      setHotspots(j.hotspots);
    })();
  }, []);

  // Pulse itself is free (FEATURES §5); only the Trends and Heatmap intelligence are Premium.
  const count = (intent: string) => (people ?? []).filter((p) => p.intent === intent).length;
  const live = (people ?? []).filter((p) => p.intent);

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">Pulse</span>
      <h1 className="text-h2 sm:text-h1">Activity Intelligence</h1>
      {!configured && (
        <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
          Pulse needs Supabase — add the keys and run the migrations.
        </p>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-input border border-line-1 bg-ink-850/50 p-1">
        {(['people', 'trends', 'heatmap'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-input px-3 py-2 text-[12px] font-semibold capitalize transition-colors ${
              tab === t ? 'bg-ink-950 text-green' : 'text-fg-3 hover:text-fg'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* People Tab */}
      {tab === 'people' && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {INTENTS.slice(0, 4).map((i) => (
              <div key={i.value} className="glass rounded-card p-4">
                <div className="text-[26px] font-semibold tracking-[-0.03em]">
                  {people ? count(i.value) : '—'}
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-fg-3">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.color }} />
                  {i.label}
                </div>
              </div>
            ))}
          </div>

          {hotspots.length > 0 && (
            <p className="text-[13px] text-fg-3">
              {hotspots.length} hotspot{hotspots.length > 1 ? 's' : ''} within 25 mi · busiest has{' '}
              {hotspots[0].count} people.{' '}
              <Link href="/app/map" className="text-green">
                See the map
              </Link>
            </p>
          )}
        </>
      )}

      {/* Trends Tab — Premium intelligence */}
      {tab === 'trends' &&
        (!isPremium ? (
          <FeaturePaywall
            featureName="Pulse Trends"
            requiredPlan="premium"
            description="See how activity rises and falls across the week — a πroka Premium insight."
          />
        ) : pos ? (
          <ActivityTrends lat={pos.lat} lon={pos.lon} />
        ) : (
          <p className="text-center text-[13px] text-fg-3">Finding your area…</p>
        ))}

      {/* Heatmap Tab — Premium intelligence */}
      {tab === 'heatmap' &&
        (!isPremium ? (
          <FeaturePaywall
            featureName="Pulse Heatmap"
            requiredPlan="premium"
            description="See where people gather near you — a πroka Premium insight."
          />
        ) : pos ? (
          <ActivityHeatmap lat={pos.lat} lon={pos.lon} />
        ) : (
          <p className="text-center text-[13px] text-fg-3">Finding your area…</p>
        ))}

      <div className="flex flex-col gap-1.5">
        {people === null ? (
          <p className="text-[13px] text-fg-3">Loading…</p>
        ) : live.length === 0 ? (
          <p className="text-[13px] text-fg-3">
            Nobody has set an intent nearby yet. Be the first from the map.
          </p>
        ) : (
          live.map((p) => {
            const meta = intentMeta(p.intent);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="glass flex items-center gap-3 rounded-card px-4 py-3 text-left"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-800 bg-cover bg-center text-[14px] font-bold text-fg-2"
                  style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined}
                >
                  {p.photo ? '' : (p.handle ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">@{p.handle}</span>
                  <span className="block text-[12px] text-fg-3">{distanceLabel(p.distanceM)}</span>
                </span>
                {meta && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
      {selected && (
        <ProfileSheet userId={selected.id} distanceM={selected.distanceM} onClose={() => setSelected(null)} />
      )}

      {/* π assistant — also available on Pulse (FEATURES §11) */}
      <button
        type="button"
        aria-label="Ask πroka"
        onClick={() => setAiOpen(true)}
        className="tap fixed bottom-[calc(84px+var(--safe-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-green text-[22px] font-bold text-ink-950 shadow-float rail:bottom-6"
      >
        π
      </button>
      {aiOpen && (
        <AssistantPanel
          people={people ?? []}
          premium={isPremium}
          onApply={() => {
            setAiOpen(false);
            router.push('/app/map');
          }}
          onOpenPerson={(id) => {
            setAiOpen(false);
            const person = (people ?? []).find((x) => x.id === id);
            if (person) setSelected(person);
          }}
          onClose={() => setAiOpen(false)}
        />
      )}
    </section>
  );
}
