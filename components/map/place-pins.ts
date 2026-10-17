import type { DemoArrival, DemoEvent, DemoPlace } from '@/lib/demo/presence';
import { escapeUrl } from './pins';

/**
 * Non-person map markers from the prototype: neutral white place pins (ring fills with activity, kind glyph,
 * headcount badge, flame when popping), tonight's event pins, testing-site pins, and traveler arrival pins.
 * All are plain DOM so MapLibre can own them as markers; they never carry a person's data-user-id.
 */

const KIND_GLYPH: Record<DemoPlace['kind'], string> = {
  bar: 'M5 4h14l-7 8zM12 12v7M8 20h8M15.5 7.5h.01',
  club: 'M4 14v4M8 10v8M12 5v13M16 9v9M20 12v6',
  sauna:
    'M8 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M12 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M16 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M4 20h16',
  park: 'M12 3 6.5 11H9l-3 5h12l-3-5h2.5zM12 16v5',
  cafe: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2.5M12 3.5v2.5',
  gym: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
};
const EVENT_GLYPH = 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 14h2';
const TEST_GLYPH = 'M12 3 4.5 6v6c0 4.3 3.2 8.2 7.5 9 4.3-.8 7.5-4.7 7.5-9V6zM12 9v6M9 12h6';
const PLANE_GLYPH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';
const FLAME_GLYPH =
  'M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.2 2-1.3 3.3-2.5 3.8C13.5 8.5 12 5 9 2c.3 3-1.5 5.5-3 7.5A7.9 7.9 0 0 0 5 15c0 4 3 7 7 7z';

function svg(d: string, stroke: string, fill = 'none', size = 20, width = 1.8) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

function baseButton(title: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tap';
  el.setAttribute('aria-label', title);
  el.title = title;
  el.style.cssText =
    'background:none;border:0;padding:0;cursor:pointer;position:relative;width:44px;height:44px';
  return el;
}

/** Place pin: white activity ring, dark glyph disc, headcount badge, flame badge when popping. */
export function placePinElement(p: DemoPlace): HTMLButtonElement {
  const deg = Math.max(24, Math.round(Math.min(1, (p.here + p.arriving * 1.5) / 45) * 360));
  const el = baseButton(`${p.name} · ${p.here} here`);
  el.innerHTML = `
    ${p.popping ? `<span aria-hidden style="position:absolute;left:-7px;top:-7px;z-index:2;width:20px;height:20px;border-radius:999px;background:#f5f5f5;box-shadow:0 0 0 2px #070707;display:flex;align-items:center;justify-content:center">${svg(FLAME_GLYPH, '#ef4444', '#ef4444', 12, 1.5)}</span>` : ''}
    <span style="position:absolute;inset:0;border-radius:999px;background:conic-gradient(#f5f5f5 ${deg}deg,rgba(255,255,255,.12) 0deg);box-shadow:0 6px 16px rgba(0,0,0,.55)"></span>
    <span style="position:absolute;inset:3px;border-radius:999px;background:radial-gradient(120% 100% at 30% 18%,#1a1a1a,#0a0a0a 72%);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;color:#f5f5f5">${svg(KIND_GLYPH[p.kind], 'currentColor')}</span>
    <span style="position:absolute;top:-6px;right:-9px;min-width:20px;height:18px;padding:0 5px;border-radius:999px;background:#f5f5f5;color:#070707;font:700 10px/18px Geist,sans-serif;text-align:center;box-shadow:0 0 0 2px #070707">${p.here}</span>`;
  return el;
}

/** Tonight's event pin: calendar glyph with a time badge. */
export function eventPinElement(e: DemoEvent): HTMLButtonElement {
  const el = baseButton(`${e.name} · ${e.time} · ${e.going} going`);
  el.style.width = '40px';
  el.style.height = '40px';
  el.innerHTML = `
    <span style="position:absolute;inset:0;border-radius:999px;background:radial-gradient(120% 100% at 30% 18%,#1a1a1a,#0a0a0a 72%);border:1.5px solid rgba(52,211,153,.75);display:flex;align-items:center;justify-content:center;color:#34d399;box-shadow:0 6px 16px rgba(0,0,0,.55)">${svg(EVENT_GLYPH, 'currentColor', 'none', 18)}</span>
    <span style="position:absolute;top:-6px;right:-10px;height:17px;padding:0 5px;border-radius:999px;background:#34d399;color:#070707;font:700 9px/17px Geist,sans-serif;box-shadow:0 0 0 2px #070707;white-space:nowrap">${e.time}</span>`;
  return el;
}

/** Testing-site pin: shield glyph, cost badge. */
export function testingPinElement(t: { name: string; cost: string }): HTMLButtonElement {
  const el = baseButton(`${t.name} · HIV & STI testing`);
  el.style.width = '40px';
  el.style.height = '40px';
  el.innerHTML = `
    <span style="position:absolute;inset:0;border-radius:999px;background:rgba(52,211,153,.14);border:1.5px solid rgba(52,211,153,.75);display:flex;align-items:center;justify-content:center;color:#34d399;box-shadow:0 6px 16px rgba(0,0,0,.55)">${svg(TEST_GLYPH, 'currentColor', 'none', 18)}</span>
    <span style="position:absolute;top:-6px;right:-8px;height:17px;padding:0 6px;border-radius:999px;background:#f5f5f5;color:#070707;font:700 9px/17px Geist,sans-serif;box-shadow:0 0 0 2px #070707;white-space:nowrap">${t.cost}</span>`;
  return el;
}

/** Arrival (traveler) pin: dashed circle, plane glyph, origin-flag badge. */
export function arrivalPinElement(
  a: DemoArrival | { handle: string | null; originCode: string | null; when: string },
): HTMLButtonElement {
  const el = baseButton(`${a.handle ?? 'Traveler'} · ${a.when}`);
  el.style.width = '40px';
  el.style.height = '40px';
  const flag = a.originCode
    ? `<span aria-hidden style="position:absolute;right:-7px;bottom:-3px;width:20px;height:14px;border-radius:3px;box-shadow:0 0 0 1.5px #070707;background:#222 center/cover no-repeat;background-image:url('${escapeUrl(flagUrl(a.originCode))}')"></span>`
    : '';
  el.innerHTML = `
    <span style="position:absolute;inset:0;border-radius:999px;border:1.5px dashed rgba(245,245,245,.8);background:rgba(7,7,7,.82);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.55)"><span style="transform:rotate(-45deg)">${svg(PLANE_GLYPH, 'none', '#f5f5f5', 19)}</span></span>
    ${flag}`;
  return el;
}

/** Hotspot count label (the "N now ↑" chip that floats over a breathing glow). */
export function hotspotLabelElement(count: number, up: boolean): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'transform:translate(-50%,-50%);white-space:nowrap;padding:4px 9px;border-radius:999px;background:rgba(7,7,7,.82);border:1px solid rgba(52,211,153,.75);color:#f5f5f5;font:600 11px/1 Geist,sans-serif;pointer-events:none';
  el.textContent = `${count} now ${up ? '↑' : '↓'}`;
  return el;
}

/** Self-hosted flag image for an ISO code or us-xx (flagcdn, like the prototype). */
export function flagUrl(code: string): string {
  return `https://flagcdn.com/${code}.svg`;
}
