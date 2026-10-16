import type { NearbyPerson } from '@/app/api/nearby/route';
import { INTENTS, INTENT_BADGE_PATH, ringDegrees, type Intent, type Status } from '@/lib/intent';
import { intentMeta } from '@/lib/geo/client';
import { POSITION_GLYPH } from './filters';

/** Strip the characters that would break out of a CSS url('…') literal. */
export function escapeUrl(url: string): string {
  return url.replace(/[()'"]/g, '');
}

/** Remaining-time ring in degrees for a person pin, from their live status window. */
export function pinRingDegrees(p: NearbyPerson, now: number): number {
  if (!p.intent || p.intent === 'looking') return 360;
  if (!p.intentEndsAt) return 360;
  const end = new Date(p.intentEndsAt).getTime();
  if (!Number.isFinite(end) || end <= now) return 8;
  const parsedStart = p.intentStartsAt ? new Date(p.intentStartsAt).getTime() : Number.NaN;
  const start = Number.isFinite(parsedStart) ? parsedStart : end - 2 * 60 * 60_000;
  return ringDegrees({ intent: p.intent as Intent, startsAt: start, endsAt: end } satisfies Status, now);
}

export function timeLeftLabel(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'ending';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.ceil(minutes / 60)}h`;
}

export function activityLabel(activity: NearbyPerson['activity']): string {
  if (activity === 'active') return 'active now';
  if (activity === 'recent') return 'recent';
  return 'today';
}

export const isRecent = (p: NearbyPerson) => p.activity === 'active' || p.activity === 'recent';
const isDesperate = (p: NearbyPerson, now: number) =>
  Boolean(p.desperateUntil && new Date(p.desperateUntil).getTime() > now);

const svgPath = (d: string, stroke: string, width = 1.8) =>
  `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/** Build a person pin: conic intent ring, progressive-blur photo, intent + position badges, live dot, label. */
export function pinElement(p: NearbyPerson, now: number, showLabels: boolean): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tap';
  el.style.cssText =
    'background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:50px';

  const shell = document.createElement('span');
  shell.dataset.pinShell = 'true';
  shell.style.cssText =
    'position:relative;width:48px;height:48px;border-radius:999px;padding:3px;box-shadow:0 7px 18px rgba(0,0,0,.58);display:block';

  const desp = document.createElement('span');
  desp.dataset.pinDesp = 'true';
  desp.setAttribute('aria-hidden', 'true');
  desp.style.cssText =
    'position:absolute;inset:-5px;border-radius:999px;border:2.5px solid #ef4444;box-shadow:0 0 16px rgba(239,68,68,.8);animation:piBlink .8s ease-in-out infinite;pointer-events:none';
  shell.appendChild(desp);

  const photo = document.createElement('span');
  photo.dataset.pinPhoto = 'true';
  photo.style.cssText =
    'position:relative;display:flex;width:100%;height:100%;border-radius:999px;border:2px solid #070707;background:#1a1a1a center/cover no-repeat;align-items:center;justify-content:center;font:700 15px/1 Geist,ui-sans-serif,sans-serif;color:#f5f5f5;overflow:hidden';
  shell.appendChild(photo);

  const intentBadge = document.createElement('span');
  intentBadge.dataset.pinIntent = 'true';
  intentBadge.setAttribute('aria-hidden', 'true');
  intentBadge.style.cssText =
    'position:absolute;right:-3px;bottom:-3px;width:19px;height:19px;border-radius:999px;background:#f5f5f5;color:#070707;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #070707';
  shell.appendChild(intentBadge);

  const pos = document.createElement('span');
  pos.dataset.pinPos = 'true';
  pos.setAttribute('aria-hidden', 'true');
  pos.style.cssText =
    'position:absolute;left:-4px;top:-4px;width:19px;height:19px;border-radius:999px;background:#070707;border:1.5px solid #f5f5f5;color:#f5f5f5;display:flex;align-items:center;justify-content:center';
  shell.appendChild(pos);

  const verified = document.createElement('span');
  verified.dataset.pinVerified = 'true';
  verified.setAttribute('aria-label', 'Verified');
  verified.textContent = '✓';
  verified.style.cssText =
    'position:absolute;right:-3px;top:-3px;width:16px;height:16px;border-radius:999px;background:#34d399;color:#070707;display:flex;align-items:center;justify-content:center;font:800 9px/1 Geist,sans-serif;box-shadow:0 0 0 2px #070707';
  shell.appendChild(verified);

  const time = document.createElement('span');
  time.dataset.pinTime = 'true';
  time.style.cssText =
    'position:absolute;left:50%;top:-8px;transform:translateX(-50%);height:18px;padding:0 5px;border-radius:999px;background:#070707;color:#f5f5f5;display:flex;align-items:center;font:700 9px/1 Geist,sans-serif;white-space:nowrap;box-shadow:0 0 0 1px rgba(255,255,255,.12)';
  shell.appendChild(time);

  const live = document.createElement('span');
  live.dataset.pinLive = 'true';
  live.setAttribute('aria-hidden', 'true');
  live.style.cssText =
    'position:absolute;left:-2px;bottom:2px;width:9px;height:9px;border-radius:999px;background:#34d399;box-shadow:0 0 0 2px #070707,0 0 10px rgba(52,211,153,.75)';
  shell.appendChild(live);

  el.appendChild(shell);

  const label = document.createElement('span');
  label.dataset.pinLabel = 'true';
  label.style.cssText =
    'max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:rgba(7,7,7,.82);padding:3px 7px;font:700 9px/1.15 Geist,ui-sans-serif,sans-serif;text-shadow:0 1px 2px #000';
  el.appendChild(label);

  updatePinElement(el, p, now, showLabels);
  return el;
}

export function updatePinElement(el: HTMLButtonElement, p: NearbyPerson, now: number, showLabels: boolean) {
  const meta = intentMeta(p.intent);
  const color = meta?.color ?? 'rgba(255,255,255,0.38)';
  const degrees = pinRingDegrees(p, now);
  const left = timeLeftLabel(p.intentEndsAt, now);
  const recent = isRecent(p);
  const desperate = isDesperate(p, now);

  el.setAttribute('aria-label', p.handle ? `@${p.handle}` : 'Member');
  el.dataset.userId = p.id;
  el.dataset.intent = p.intent ?? 'none';
  el.dataset.activity = p.activity;
  el.dataset.distanceM = String(p.distanceM);
  el.style.opacity = p.intent === 'looking' ? '0.72' : '1';

  const shell = el.querySelector<HTMLElement>('[data-pin-shell]');
  const photo = el.querySelector<HTMLElement>('[data-pin-photo]');
  const intentBadge = el.querySelector<HTMLElement>('[data-pin-intent]');
  const positionBadge = el.querySelector<HTMLElement>('[data-pin-pos]');
  const verified = el.querySelector<HTMLElement>('[data-pin-verified]');
  const time = el.querySelector<HTMLElement>('[data-pin-time]');
  const live = el.querySelector<HTMLElement>('[data-pin-live]');
  const desp = el.querySelector<HTMLElement>('[data-pin-desp]');
  const label = el.querySelector<HTMLElement>('[data-pin-label]');
  if (!shell || !photo || !intentBadge || !positionBadge || !verified || !time || !live || !desp || !label)
    return;

  const ringColor = desperate ? '#ef4444' : color;
  shell.style.background = `conic-gradient(${ringColor} ${degrees}deg,rgba(255,255,255,.14) 0deg)`;
  photo.style.backgroundImage = p.photo ? `url('${escapeUrl(p.photo)}')` : 'none';
  photo.textContent = p.photo ? '' : (p.handle ?? '?').slice(0, 1).toUpperCase();

  const badgePath = p.intent ? INTENT_BADGE_PATH[p.intent] : undefined;
  intentBadge.hidden = !badgePath;
  if (badgePath) intentBadge.innerHTML = svgPath(badgePath, 'currentColor', 2.4);

  const posGlyph = (p.attrs?.position ?? []).map((m) => POSITION_GLYPH[m]).find(Boolean);
  positionBadge.hidden = !posGlyph;
  if (posGlyph) positionBadge.innerHTML = svgPath(posGlyph, 'currentColor', 3);

  verified.hidden = !p.verified;
  time.hidden = !left;
  time.textContent = left;
  live.hidden = !recent;
  desp.hidden = !desperate;

  label.hidden = !showLabels;
  const travel = p.travelMi ? ` · ${p.travelMi} mi` : '';
  label.textContent = [meta ? meta.label + travel : null, activityLabel(p.activity)]
    .filter(Boolean)
    .join(' · ');
  label.style.color = meta?.color ?? '#aaa';
}

/** The self pin: π glyph (or your photo) in a green status ring, with a blinking red ring while Desperate. */
export function youElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'You (approximate)');
  el.style.cssText = 'position:relative;width:54px;height:54px';
  el.innerHTML = `
    <span data-you-desp hidden style="position:absolute;inset:-6px;border-radius:999px;border:2.5px solid #ef4444;box-shadow:0 0 18px rgba(239,68,68,.8);animation:piBlink .8s ease-in-out infinite;pointer-events:none"></span>
    <span data-you-ring style="display:flex;width:54px;height:54px;border-radius:999px;padding:3px;background:conic-gradient(#34d399 360deg,rgba(52,211,153,.18) 0deg);animation:piPulse 2.4s infinite;box-shadow:0 0 0 12px rgba(52,211,153,.10),0 6px 16px rgba(0,0,0,.55)">
      <span data-you-photo style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:999px;border:2px solid #070707;background:#151515 center/cover no-repeat;color:#fff;font:700 20px/1 Geist,ui-sans-serif,sans-serif">π</span>
    </span>`;
  return el;
}

export function updateYouElement(
  el: HTMLElement,
  opts: { color: string; degrees: number; photo: string | null; desperate: boolean },
) {
  const ring = el.querySelector<HTMLElement>('[data-you-ring]');
  const photo = el.querySelector<HTMLElement>('[data-you-photo]');
  const desp = el.querySelector<HTMLElement>('[data-you-desp]');
  if (!ring || !photo || !desp) return;
  const color = opts.desperate ? '#ef4444' : opts.color;
  const track = opts.desperate ? 'rgba(239,68,68,.2)' : 'rgba(52,211,153,.18)';
  ring.style.background = `conic-gradient(${color} ${opts.degrees}deg,${track} 0deg)`;
  photo.style.backgroundImage = opts.photo ? `url('${escapeUrl(opts.photo)}')` : 'none';
  photo.textContent = opts.photo ? '' : 'π';
  desp.hidden = !opts.desperate;
}
