'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMM, GENDER, HANDLE_RE, ICONS, ORIENT, PRONOUNS, SHOW_ME, VIS_OPTS } from '@/lib/profile/options';

type Profile = {
  handle: string | null;
  pronouns: string[];
  gender: string[];
  orientation: string[];
  communities: string[];
  showMe: string[];
  bio: string;
  visibility: 'neighborhood' | 'area' | 'hidden';
  disguiseIcon: string;
  safetyPrefs: { blurPhotos: boolean; verifiedOnly: boolean; strangerFilter: boolean };
  plan: string;
  verified: boolean;
};
type Photo = { slot: number; url: string };

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Everything set during onboarding, editable afterwards. Saves field groups on "Save"; photos save immediately. */
export function EditProfile() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [limit, setLimit] = useState(3);
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [photoErr, setPhotoErr] = useState('');
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);

  const load = useCallback(async () => {
    const r = await fetch('/api/me/profile', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return setErr('Could not load your profile');
    const j = (await r.json()) as { profile: Profile; photos: Photo[]; photoLimit: number };
    setP(j.profile);
    setAnonymous(j.profile.handle === null);
    setPhotos(j.photos);
    setLimit(j.photoLimit);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!p) return;
    setSaving(true);
    setErr('');
    setSaved(false);
    const handle = anonymous ? null : (p.handle ?? '').replace(/^@/, '');
    if (!anonymous && !HANDLE_RE.test(handle ?? '')) {
      setSaving(false);
      return setErr('Pick a name of 2–24 letters, numbers, dots or dashes');
    }
    const r = await fetch('/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        pronouns: p.pronouns,
        gender: p.gender,
        orientation: p.orientation,
        communities: p.communities,
        showMe: p.showMe,
        bio: p.bio,
        visibility: p.visibility,
        disguiseIcon: p.disguiseIcon,
        safetyPrefs: p.safetyPrefs,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) return setErr(j.error ?? 'Could not save');
    setSaved(true);
    router.refresh();
  };

  const pick = (slot: number) => {
    slotRef.current = slot;
    fileRef.current?.click();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const slot = slotRef.current;
    setUploading(slot);
    setPhotoErr('');
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('slot', String(slot));
    const r = await fetch('/api/onboarding/photos/upload', { method: 'POST', body: fd }).catch(() => null);
    setUploading(null);
    if (fileRef.current) fileRef.current.value = '';
    if (!r?.ok) return setPhotoErr((await r?.json().catch(() => ({})))?.error ?? 'Upload failed');
    load();
  };

  const remove = async (slot: number) => {
    if (!confirm(slot === 0 ? 'Remove your main photo?' : 'Remove this album photo?')) return;
    setUploading(slot);
    await fetch('/api/me/photos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) }).catch(() => {});
    setUploading(null);
    load();
  };

  if (!p) return <p className="py-10 text-center text-[13px] text-fg-3">{err || 'Loading…'}</p>;

  const chips = (label: string, options: string[], key: 'pronouns' | 'gender' | 'orientation' | 'communities', max: number) => (
    <section className="glass flex flex-col gap-2 rounded-card px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
        {label} <span className="font-normal normal-case tracking-normal text-fg-4">· up to {max}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = p[key].includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={!on && p[key].length >= max}
              onClick={() => setP({ ...p, [key]: toggle(p[key], o) })}
              className={`chip ${on ? 'chip-selected' : ''} disabled:opacity-40`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </section>
  );

  const slots = Array.from({ length: limit }, (_, i) => i);

  return (
    <div className="flex flex-col gap-4">
      {/* Photos */}
      <section className="glass flex flex-col gap-2 rounded-card px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
          Photos <span className="font-normal normal-case tracking-normal text-fg-4">· main + {limit - 1} album{limit < 6 ? ' · Plus unlocks 5' : ''}</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const ph = photos.find((x) => x.slot === slot);
            const busy = uploading === slot;
            return (
              <div key={slot} className={`relative overflow-hidden rounded-[14px] border bg-ink-850 ${slot === 0 ? 'col-span-1 row-span-1 border-sel-border' : 'border-line-2'} aspect-[3/4]`}>
                {ph ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt={slot === 0 ? 'Main photo' : `Album photo ${slot}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => pick(slot)} disabled={busy} className="tap absolute bottom-1.5 left-1.5 rounded-chip bg-black/70 px-2.5 text-[11px] font-semibold text-fg">
                      Replace
                    </button>
                    <button type="button" onClick={() => remove(slot)} disabled={busy} aria-label={`Remove photo ${slot}`} className="tap absolute right-1 top-1 flex items-center justify-center rounded-full bg-black/70 text-[18px] font-bold text-fg">
                      ×
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => pick(slot)} disabled={busy} aria-label={slot === 0 ? 'Add main photo' : `Add album photo ${slot}`} className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-fg-3 hover:text-fg">
                    <span className="text-2xl text-green">{busy ? '…' : '+'}</span>
                    <span className="text-[11px] font-medium">{slot === 0 ? 'Main' : 'Album'}</span>
                  </button>
                )}
                {slot > 0 && <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-chip bg-black/60 px-1.5 text-[10px] text-fg-2">🔒</span>}
              </div>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <p className="text-[12px] text-fg-4">Location data is stripped from every photo. Album photos stay blurred until you let someone in.</p>
        {photoErr && (
          <p role="alert" className="text-[12px] text-danger">
            {photoErr}
          </p>
        )}
      </section>

      {/* Name */}
      <section className="glass flex flex-col gap-3 rounded-card px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Name</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAnonymous(false)} className={`chip flex-1 justify-center ${!anonymous ? 'chip-selected' : ''}`}>
            @ name
          </button>
          <button type="button" onClick={() => setAnonymous(true)} className={`chip flex-1 justify-center ${anonymous ? 'chip-selected' : ''}`}>
            Anonymous
          </button>
        </div>
        {!anonymous && (
          <input
            value={p.handle ?? ''}
            onChange={(e) => setP({ ...p, handle: e.target.value })}
            placeholder="yourname"
            aria-label="Name"
            maxLength={25}
            autoCapitalize="none"
            autoCorrect="off"
            className="input h-12"
          />
        )}
        <textarea
          value={p.bio}
          onChange={(e) => setP({ ...p, bio: e.target.value.slice(0, 160) })}
          placeholder="Bio (160 characters)"
          aria-label="Bio"
          rows={3}
          className="input"
        />
        <p className="text-right text-[11px] text-fg-4">{p.bio.length}/160</p>
      </section>

      {chips('Pronouns', PRONOUNS, 'pronouns', 3)}
      {chips('Gender', GENDER, 'gender', 5)}
      {chips('Orientation', ORIENT, 'orientation', 5)}
      {chips('Communities', COMM, 'communities', 8)}

      {/* Show me */}
      <section className="glass flex flex-col gap-2 rounded-card px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Show me</p>
        <div className="flex flex-wrap gap-1.5">
          {SHOW_ME.map(([l, s]) => {
            const on = p.showMe.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => setP({ ...p, showMe: l === 'Everyone' ? ['Everyone'] : toggle(p.showMe.filter((x) => x !== 'Everyone'), l) })}
                className={`chip ${on ? 'chip-selected' : ''}`}
                title={s}
              >
                {l}
              </button>
            );
          })}
        </div>
      </section>

      {/* Privacy */}
      <section className="glass flex flex-col gap-3 rounded-card px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Privacy</p>
        <div className="flex gap-1.5">
          {VIS_OPTS.map(([l, s]) => {
            const v = l.toLowerCase() as Profile['visibility'];
            const on = p.visibility === v;
            return (
              <button key={l} type="button" aria-pressed={on} onClick={() => setP({ ...p, visibility: v })} className={`chip flex-1 flex-col items-start gap-0 py-1.5 ${on ? 'chip-selected' : ''}`}>
                <span>{l}</span>
                <span className="text-[10px] font-normal text-fg-4">{s}</span>
              </button>
            );
          })}
        </div>
        {(
          [
            ['blurPhotos', 'Blur photos until mutual', 'Yours and theirs'],
            ['verifiedOnly', 'Verified only', 'Hide unverified profiles'],
            ['strangerFilter', 'Stranger filter', 'Chats need a shared signal first'],
          ] as const
        ).map(([k, l, s]) => {
          const on = p.safetyPrefs[k];
          return (
            <div key={k} className="flex items-center justify-between border-t border-line-1 pt-3">
              <div>
                <p className="text-[14px] font-medium">{l}</p>
                <p className="text-[12px] text-fg-3">{s}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={l}
                onClick={() => setP({ ...p, safetyPrefs: { ...p.safetyPrefs, [k]: !on } })}
                className={`tap-hit h-7 w-12 shrink-0 rounded-chip border transition-colors ${on ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
              </button>
            </div>
          );
        })}
        <div className="border-t border-line-1 pt-3">
          <p className="mb-1.5 text-[14px] font-medium">Disguise icon</p>
          <div className="flex gap-1.5">
            {ICONS.map(([name, glyph, bg, fg]) => {
              const id = name === 'πroka' ? 'piroka' : name.toLowerCase();
              const on = p.disguiseIcon === id;
              return (
                <button key={id} type="button" aria-pressed={on} aria-label={name} onClick={() => setP({ ...p, disguiseIcon: id })} className={`tap flex h-12 w-12 items-center justify-center rounded-[14px] border text-[20px] font-bold ${bg} ${fg} ${on ? 'border-green ring-2 ring-green/40' : 'border-line-2'}`}>
                  {glyph}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      {saved && <p className="text-[12px] text-green">Saved.</p>}
      <div className="sticky bottom-[calc(74px+var(--safe-bottom))] flex gap-2 rail:bottom-4">
        <Link href="/app/me" className="btn-secondary h-12 flex-1">
          Back
        </Link>
        <button type="button" onClick={save} disabled={saving} className="btn-primary h-12 flex-[2] bg-green hover:bg-green-hover">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
