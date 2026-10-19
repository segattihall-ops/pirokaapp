import type { NearbyPerson } from '@/app/api/nearby/route';
import { INTENT_BADGE_PATH, ringDegrees, type Intent, type Status } from '@/lib/intent';
import { intentMeta } from '@/lib/geo/client';
import { positionMarkPath } from '@/lib/design/icon-paths';
import { dur } from '@/lib/map/pin-anatomy';

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
  return dur(minutes);
}

export function activityLabel(activity: NearbyPerson['activity']): string {
  if (activity === 'active') return 'active now';
  if (activity === 'recent') return 'recent';
  return 'today';
}

export const isRecent = (p: NearbyPerson) => p.activity === 'active' || p.activity === 'recent';
const isDesperate = (p: NearbyPerson, now: number) =>
  Boolean(p.desperateUntil && new Date(p.desperateUntil).getTime() > now);

/** The privacy blur the design applies to a pin photo (px): clear once revealed, otherwise fuzzed. */
function photoBlur(p: NearbyPerson): number {
  return p.photoRevealed && (p.relationship === 'mutual' || p.relationship === 'meet') ? 0 : p.relationship === 'chatted' ? 5 : 11;
}

/** Head-and-shoulders silhouette the prototype draws when a member has no photo (never an initial). */
const SILHOUETTE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/></svg>`;

const svgPath = (d: string, stroke: string, width = 1.8) =>
  `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/**
 * Build a person pin exactly as the App v2 prototype draws it: a conic intent/time ring, a privacy-blurred
 * photo (or a silhouette), an intent badge bottom-right and a position glyph top-left — nothing else on the
 * pin itself (verified / time-left / activity all live in the hover card and profile, not here).
 */
export function pinElement(p: NearbyPerson, now: number, showLabels: boolean): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tap';
  el.style.cssText =
    'background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:44px';

  const shell = document.createElement('span');
  shell.dataset.pinShell = 'true';
  shell.style.cssText =
    'position:relative;width:44px;height:44px;border-radius:999px;padding:3px;box-shadow:0 6px 16px rgba(0,0,0,.55);display:block;animation:pinIn .35s ease-out both';

  const desp = document.createElement('span');
  desp.dataset.pinDesp = 'true';
  desp.setAttribute('aria-hidden', 'true');
  desp.style.cssText =
    'position:absolute;inset:-6px;border-radius:999px;border:2.5px solid #ef4444;box-shadow:0 0 18px rgba(239,68,68,.8);animation:piBlink .8s ease-in-out infinite;pointer-events:none';
  shell.appendChild(desp);

  // Inner disc: dark radial gradient with a thin ink border; holds either the blurred photo or the silhouette.
  const disc = document.createElement('span');
  disc.dataset.pinDisc = 'true';
  disc.style.cssText =
    'position:relative;display:flex;width:100%;height:100%;border-radius:999px;border:2px solid #070707;overflow:hidden;background:radial-gradient(120% 90% at 30% 20%,#1a1a1a,#0a0a0a);align-items:center;justify-content:center';
  const photo = document.createElement('span');
  photo.dataset.pinPhoto = 'true';
  photo.setAttribute('aria-hidden', 'true');
  photo.style.cssText =
    'position:absolute;inset:-4px;background-size:cover;background-position:center;background-repeat:no-repeat';
  disc.appendChild(photo);
  const fallback = document.createElement('span');
  fallback.dataset.pinFallback = 'true';
  fallback.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center';
  fallback.innerHTML = SILHOUETTE;
  disc.appendChild(fallback);
  shell.appendChild(disc);

  const intentBadge = document.createElement('span');
  intentBadge.dataset.pinIntent = 'true';
  intentBadge.setAttribute('aria-hidden', 'true');
  intentBadge.style.cssText =
    'position:absolute;right:-3px;bottom:-3px;width:19px;height:19px;border-radius:999px;background:#f5f5f5;color:#070707;display:flex;align-items:center;justify-content:center';
  shell.appendChild(intentBadge);

  const pos = document.createElement('span');
  pos.dataset.pinPos = 'true';
  pos.setAttribute('aria-hidden', 'true');
  pos.style.cssText =
    'position:absolute;left:-4px;top:-4px;width:19px;height:19px;border-radius:999px;background:#070707;border:1.5px solid #f5f5f5;color:#f5f5f5;display:flex;align-items:center;justify-content:center';
  shell.appendChild(pos);

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
  const desperate = isDesperate(p, now);

  el.setAttribute('aria-label', p.handle ? `@${p.handle}` : 'Member');
  el.dataset.userId = p.id;
  el.dataset.intent = p.intent ?? 'none';
  el.dataset.activity = p.activity;
  el.dataset.distanceM = String(p.distanceM);
  el.style.opacity = p.intent === 'looking' ? '0.55' : '1';

  const shell = el.querySelector<HTMLElement>('[data-pin-shell]');
  const photo = el.querySelector<HTMLElement>('[data-pin-photo]');
  const fallback = el.querySelector<HTMLElement>('[data-pin-fallback]');
  const intentBadge = el.querySelector<HTMLElement>('[data-pin-intent]');
  const positionBadge = el.querySelector<HTMLElement>('[data-pin-pos]');
  const desp = el.querySelector<HTMLElement>('[data-pin-desp]');
  const label = el.querySelector<HTMLElement>('[data-pin-label]');
  if (!shell || !photo || !fallback || !intentBadge || !positionBadge || !desp || !label) return;

  const ringColor = desperate ? '#ef4444' : color;
  shell.style.background = `conic-gradient(${ringColor} ${degrees}deg,rgba(255,255,255,.12) 0deg)`;

  if (p.photo) {
    photo.style.backgroundImage = `url('${escapeUrl(p.photo)}')`;
    photo.style.filter = `blur(${photoBlur(p)}px)`;
    photo.hidden = false;
    fallback.hidden = true;
  } else {
    photo.style.backgroundImage = 'none';
    photo.hidden = true;
    fallback.hidden = false;
  }

  const badgePath = p.intent ? INTENT_BADGE_PATH[p.intent] : undefined;
  intentBadge.hidden = !badgePath;
  if (badgePath) intentBadge.innerHTML = svgPath(badgePath, 'currentColor', 2.6);

  const posGlyph = (p.attrs?.position ?? []).map(positionMarkPath).find(Boolean);
  positionBadge.hidden = !posGlyph;
  if (posGlyph) positionBadge.innerHTML = svgPath(posGlyph, 'currentColor', 3);

  desp.hidden = !desperate;

  label.hidden = !showLabels;
  const travel = p.travelMi ? ` · ${p.travelMi} mi` : '';
  label.textContent = [meta ? meta.label + travel : null, activityLabel(p.activity)]
    .filter(Boolean)
    .join(' · ');
  label.style.color = meta?.color ?? '#aaa';
}

/** The self pin: π glyph (or your photo) in a green status ring, a label pill below, a red ring while Desperate. */
export function youElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'You (approximate)');
  // Fixed 54×54 box so MapLibre keeps the pin centred on your location; the label hangs below absolutely.
  el.style.cssText = 'position:relative;width:54px;height:54px';
  el.innerHTML = `
    <span data-you-fog aria-hidden="true" style="position:absolute;left:50%;top:50%;width:120px;height:120px;transform:translate(-50%,-50%);border:1px dashed rgba(52,211,153,0.5);border-radius:999px;background:radial-gradient(circle,rgba(52,211,153,0.06),transparent 72%);box-shadow:0 0 30px rgba(52,211,153,0.15);pointer-events:none"></span>
    <span data-you-desp hidden style="position:absolute;inset:-6px;border-radius:999px;border:2.5px solid #ef4444;box-shadow:0 0 18px rgba(239,68,68,.8);animation:piBlink .8s ease-in-out infinite;pointer-events:none"></span>
    <span data-you-ring style="display:flex;width:54px;height:54px;border-radius:999px;padding:3px;background:conic-gradient(#34d399 360deg,rgba(255,255,255,.12) 0deg);animation:piPulse 2.4s infinite;box-shadow:0 0 30px rgba(52,211,153,0.15),0 6px 16px rgba(0,0,0,.55)">
      <span data-you-photo style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:999px;border:2px solid #070707;background:#151515 center/cover no-repeat;color:#fff;font:700 20px/1 Geist,ui-sans-serif,sans-serif">π</span>
    </span>
    <span data-you-label style="position:absolute;left:50%;bottom:-21px;transform:translateX(-50%);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:#34d399;color:#070707;padding:2px 8px;font:700 10px/1.3 Geist,ui-sans-serif,sans-serif;box-shadow:0 0 0 2px #070707">You</span>`;
  return el;
}

export function updateYouElement(
  el: HTMLElement,
  opts: { color: string; degrees: number; photo: string | null; desperate: boolean; label?: string },
) {
  const ring = el.querySelector<HTMLElement>('[data-you-ring]');
  const photo = el.querySelector<HTMLElement>('[data-you-photo]');
  const desp = el.querySelector<HTMLElement>('[data-you-desp]');
  const label = el.querySelector<HTMLElement>('[data-you-label]');
  if (!ring || !photo || !desp) return;
  const color = opts.desperate ? '#ef4444' : opts.color;
  // Status rings always sit on the tokens' white .12 track, whatever the ring colour.
  const track = 'rgba(255,255,255,.12)';
  ring.style.background = `conic-gradient(${color} ${opts.degrees}deg,${track} 0deg)`;
  photo.style.backgroundImage = opts.photo ? `url('${escapeUrl(opts.photo)}')` : 'none';
  photo.textContent = opts.photo ? '' : 'π';
  desp.hidden = !opts.desperate;
  if (label) {
    label.textContent = opts.desperate ? 'Desperate' : (opts.label ?? 'You');
    label.style.background = opts.desperate ? '#ef4444' : '#34d399';
    label.style.color = opts.desperate ? '#fff' : '#070707';
  }
}
