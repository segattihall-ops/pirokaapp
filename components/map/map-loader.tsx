'use client';

import dynamic from 'next/dynamic';

const MapScreen = dynamic(() => import('./map-screen').then((m) => m.MapScreen), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-66px-var(--safe-bottom))] items-center justify-center text-[13px] text-fg-3 rail:h-dvh">
      Loading map…
    </div>
  ),
});

export function MapLoader({ userId }: { userId: string }) {
  return <MapScreen userId={userId} />;
}
