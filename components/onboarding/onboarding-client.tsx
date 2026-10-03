'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { fetchSession, recordConsent } from '@/lib/auth/client';
import { getPosition } from '@/lib/geo/client';
import { COMM, GENDER, ICONS, ORIENT, PRONOUNS, SHOW_ME, VIS_OPTS } from '@/lib/profile/options';

type Step = 1 | 2 | 3 | 4 | 5;

export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<'named' | 'anon'>('named');
  const [name, setName] = useState('');
  const [pronouns, setPronouns] = useState<string[]>([]);
  const [customPronoun, setCustomPronoun] = useState('');
  const [gender, setGender] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [community, setCommunity] = useState<string[]>([]);
  const [idQ, setIdQ] = useState('');
  const [showMe, setShowMe] = useState<string[]>([]);
  const [safety, setSafety] = useState({ blurPhotos: true, verifiedOnly: false, strangerFilter: true });
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<'idle' | 'asking' | 'ok' | 'denied'>('idle');
  const [visibility, setVisibility] = useState('Neighborhood');
  const [icon, setIcon] = useState('πroka');
  const [idQ_val, setIdQ_val] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Anonymous members skip the identity and photo steps: show-up → who to see → location & privacy.
  // Everything skipped can be filled in later from ME → Edit profile.
  const STEPS: Step[] = mode === 'anon' ? [1, 3, 5] : [1, 2, 3, 4, 5];
  const stepIndex = Math.max(0, STEPS.indexOf(step));
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    fetchSession().then((s) => {
      if (!s?.ageVerified) router.push('/?gate=1');
    });
  }, [router]);

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const toggleShowMe = (val: string) => {
    if (val === 'Everyone') {
      setShowMe(showMe.includes('Everyone') ? [] : ['Everyone']);
    } else {
      setShowMe((prev) =>
        prev.includes(val) ? prev.filter((x) => x !== val) : [...prev.filter((x) => x !== 'Everyone'), val],
      );
    }
  };

  const filteredGender = GENDER.filter((g) => !idQ_val || g.toLowerCase().includes(idQ_val.toLowerCase()));
  const filteredOrient = ORIENT.filter((o) => !idQ_val || o.toLowerCase().includes(idQ_val.toLowerCase()));
  const filteredComm = COMM.filter((c) => !idQ_val || c.toLowerCase().includes(idQ_val.toLowerCase()));

  const isStep1Ready = mode === 'anon' || name.trim().length >= 2;
  const isStep3Ready = showMe.length > 0;

  const finish = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      const allPronouns = customPronoun.trim() ? [...pronouns, customPronoun.trim()] : pronouns;
      const r = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymous: mode === 'anon',
          displayName: name.trim(),
          pronouns: allPronouns,
          gender,
          orientation,
          communities: community,
          showMe,
          ...safety,
          visibility: visibility.toLowerCase(),
          disguiseIcon: icon === 'πroka' ? 'piroka' : icon.toLowerCase(),
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Could not save your profile');

      for (let slot = 0; slot < photos.length; slot++) {
        const blob = await (await fetch(photos[slot])).blob();
        const fd = new FormData();
        fd.append('file', blob, `photo-${slot}.jpg`);
        fd.append('slot', String(slot));
        const u = await fetch('/api/onboarding/photos/upload', { method: 'POST', body: fd });
        if (!u.ok) throw new Error((await u.json().catch(() => ({}))).error ?? 'Photo upload failed');
      }

      if (coords) {
        await fetch('/api/me/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coords),
        });
      }

      await recordConsent().catch(() => {});
      router.push('/app/map');
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
    else await finish();
  };

  const askLocation = async () => {
    setLocation('asking');
    const p = await getPosition({ ask: true });
    setCoords({ lat: p.lat, lng: p.lon });
    setLocation(p.precise ? 'ok' : 'denied');
  };

  const addFiles = (files: FileList | null) => {
    Array.from(files || [])
      .slice(0, 3 - photos.length)
      .forEach((f) => {
        const r = new FileReader();
        r.onload = () => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            const k = 360 / Math.max(img.width, img.height);
            c.width = img.width * k;
            c.height = img.height * k;
            c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
            setPhotos((prev) => [...prev, c.toDataURL('image/jpeg', 0.8)].slice(0, 3));
          };
          img.src = r.result as string;
        };
        r.readAsDataURL(f);
      });
  };

  const stepTitles: Record<Step, [string, string]> = {
    1: [
      'How do you want to show up?',
      mode === 'anon'
        ? 'Anonymous keeps it to three quick steps. Add a name, identities or photos later in ME.'
        : 'Stay anonymous or pick a name. You can switch any time.',
    ],
    2: [
      'Who are you?',
      'Gender, orientation and communities. Pick everything that fits — or nothing at all.',
    ],
    3: [
      'Who do you want to see?',
      'This shapes your map and your Pulse. Safety defaults apply from day one.',
    ],
    4: ['Add photos', 'One main photo and up to two in your private album.'],
    5: [
      'Location & privacy',
      "We use your location to show who's nearby. Others only ever see an approximate area.",
    ],
  };

  const [title, subtitle] = stepTitles[step];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-5 px-4 py-[calc(28px+var(--safe-top))] pb-[calc(40px+var(--safe-bottom))]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-line-2 bg-gradient-to-br from-[#262626] to-ink-950 text-base font-bold text-fg">
            π
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#34d399]" />
          </div>
          <span className="text-base font-semibold tracking-[-0.02em]">πroka</span>
        </div>
        <span className="text-xs text-fg-3">
          Step {stepIndex + 1} of {STEPS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}
      >
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 rounded-full ${i <= stepIndex ? 'bg-green' : 'bg-white/10'}`} />
        ))}
      </div>

      {/* Card */}
      <section className="glass border-line flex flex-col gap-5 rounded-[28px] border px-6 py-7 shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-3">{subtitle}</p>
        </div>

        {/* Step 1: Name & Pronouns */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: 'named', l: 'Display name', s: 'Pick a handle. Never your legal name.' },
                { k: 'anon', l: 'Anonymous', s: 'No name. Shown as "Anonymous".' },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setMode(opt.k as 'named' | 'anon')}
                  className={`relative space-y-1 rounded-[16px] border p-3.5 text-left text-sm transition-all ${
                    mode === opt.k
                      ? 'border-green/75 bg-green/10'
                      : 'hover:border-line border-line-2 bg-transparent'
                  }`}
                >
                  <div className="font-semibold">{opt.l}</div>
                  <div className="text-xs text-fg-3">{opt.s}</div>
                </button>
              ))}
            </div>

            {mode === 'named' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-fg-3">Display name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder="Anything but your legal name"
                  className="input"
                />
              </label>
            )}

            <div className="space-y-2">
              <span className="text-sm font-semibold">Pronouns</span>
              <div className="flex flex-wrap gap-1.5">
                {PRONOUNS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPronouns(toggleArray(pronouns, p))}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                      pronouns.includes(p)
                        ? 'bg-green/14 border-green/75 text-fg'
                        : 'hover:border-line border-line-2 text-fg'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customPronoun}
                onChange={(e) => setCustomPronoun(e.target.value)}
                placeholder="Or write your own"
                className="input mt-2"
              />
            </div>

            <div className="bg-green/8 flex gap-2 rounded-[12px] px-3 py-2.5 text-xs text-green">
              <span>✓</span>
              <span>Age verified 18+ — your birthday is never shown.</span>
            </div>
          </div>
        )}

        {/* Step 2: Identities */}
        {step === 2 && (
          <div className="space-y-4">
            <input
              type="text"
              value={idQ_val}
              onChange={(e) => setIdQ_val(e.target.value)}
              placeholder={`Search ${GENDER.length + ORIENT.length + COMM.length} identities…`}
              className="input"
            />

            {filteredGender.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Gender identity</span>
                  {gender.length > 0 && <span className="text-fg-3">{gender.length} selected</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filteredGender.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(toggleArray(gender, g))}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                        gender.includes(g) ? 'bg-green/14 border-green/75' : 'hover:border-line border-line-2'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredOrient.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Orientation</span>
                  {orientation.length > 0 && <span className="text-fg-3">{orientation.length} selected</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filteredOrient.map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(toggleArray(orientation, o))}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                        orientation.includes(o)
                          ? 'bg-green/14 border-green/75'
                          : 'hover:border-line border-line-2'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredComm.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Communities</span>
                  {community.length > 0 && <span className="text-fg-3">{community.length} selected</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filteredComm.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCommunity(toggleArray(community, c))}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                        community.includes(c)
                          ? 'bg-green/14 border-green/75'
                          : 'hover:border-line border-line-2'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-fg-3">
              Choose as many as fit. You can hide any of them from your public profile later.
            </p>
          </div>
        )}

        {/* Step 3: Show Me & Safety */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-semibold">Who do you want to see?</span>
              <div className="grid grid-cols-3 gap-2">
                {SHOW_ME.map(([l, s]) => (
                  <button
                    key={l}
                    onClick={() => toggleShowMe(l)}
                    className={`space-y-1 rounded-[16px] border p-3 text-left text-xs transition-all ${
                      showMe.includes(l) ? 'border-green/75 bg-green/10' : 'border-line-2'
                    }`}
                  >
                    <div className="font-semibold">{l}</div>
                    <div className="text-fg-3">{s}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold">Safety defaults</span>
              <div className="space-y-2">
                {[
                  { k: 'blurPhotos', l: 'Blur photos until mutual', s: 'Yours and theirs' },
                  {
                    k: 'verifiedOnly',
                    l: 'Only verified humans can message me',
                    s: 'Cuts spam and fake accounts',
                  },
                  { k: 'strangerFilter', l: 'Filter explicit first messages', s: 'You can still open them' },
                ].map(({ k, l, s }) => (
                  <button
                    key={k}
                    onClick={() => setSafety((prev) => ({ ...prev, [k]: !prev[k as keyof typeof prev] }))}
                    className="border-white/8 bg-white/2 hover:border-white/12 flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3 transition-colors"
                  >
                    <div className="space-y-0.5 text-left">
                      <div className="text-xs font-semibold">{l}</div>
                      <div className="text-xs text-fg-3">{s}</div>
                    </div>
                    <div
                      className={`h-6 w-10 flex-shrink-0 rounded-full p-1 transition-all ${
                        safety[k as keyof typeof safety]
                          ? 'justify-end bg-green'
                          : 'bg-white/14 justify-start'
                      } flex`}
                    >
                      <div className="h-4 w-4 rounded-full bg-fg" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Photos */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white/3 relative aspect-[3/4] overflow-hidden rounded-[16px] border-2 border-dashed border-white/20"
                >
                  {photos[i] ? (
                    <>
                      <img src={photos[i]} alt="uploaded" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-lg font-bold text-fg"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-fg-3 hover:text-fg"
                    >
                      <span className="text-2xl text-green">+</span>
                      <span className="text-xs font-medium">{i === 0 ? 'Main photo' : 'Album'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-fg-3">
              Your main photo stays blurred for others until it&apos;s mutual. The other two form your private
              album.
            </p>
            <button onClick={() => setStep(5)} className="text-xs font-medium text-fg-3 hover:text-fg">
              Stay faceless for now
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.currentTarget.files)}
              className="hidden"
            />
          </div>
        )}

        {/* Step 5: Location & Privacy */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="border-white/8 bg-white/3 flex items-center justify-between gap-3 rounded-[16px] border px-3.5 py-3.5">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold">Location</span>
                <span className="text-xs text-fg-3">
                  {location === 'idle' && 'Needed to show people and places near you.'}
                  {location === 'asking' && 'Waiting for permission…'}
                  {location === 'ok' && 'Using your approximate location.'}
                  {location === 'denied' && "Blocked — we'll use your city from your network instead."}
                </span>
              </div>
              {location === 'idle' && (
                <button onClick={askLocation} className="btn-secondary shrink-0 px-3.5 py-1.5 text-xs">
                  Allow
                </button>
              )}
              {location === 'ok' && <span className="shrink-0 text-xs font-semibold text-green">On ✓</span>}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold">Others see you as</span>
              <div className="grid grid-cols-3 gap-2">
                {VIS_OPTS.map(([l, s]) => (
                  <button
                    key={l}
                    onClick={() => setVisibility(l)}
                    className={`space-y-0.5 rounded-[14px] border p-3 text-left text-xs transition-all ${
                      visibility === l ? 'border-green/75 bg-green/10' : 'border-line-2'
                    }`}
                  >
                    <div className="font-semibold">{l}</div>
                    <div className="text-fg-3">{s}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold">App icon on your phone</span>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map(([l, g, bg, fg]) => (
                  <button
                    key={l}
                    onClick={() => setIcon(l)}
                    className={`space-y-1.5 rounded-[14px] border p-3 text-center text-xs transition-all ${
                      icon === l ? 'border-green/75 bg-green/10' : 'border-line-2'
                    }`}
                  >
                    <div
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-[11px] ${bg} font-bold ${fg}`}
                    >
                      {g}
                    </div>
                    <div className="text-xs font-medium">{l}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-fg-3">
                Disguised icons change the name and icon on your home screen. Add a PIN in ME → Privacy.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Footer buttons */}
      <div className="flex gap-2">
        {stepIndex > 0 && (
          <button onClick={() => setStep(STEPS[stepIndex - 1])} className="btn-secondary">
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={saving || (step === 1 && !isStep1Ready) || (step === 3 && !isStep3Ready)}
          className="btn-primary h-[50px] flex-1 rounded-[16px] bg-green text-ink-950 hover:bg-green-hover disabled:bg-white/10 disabled:text-fg-4"
        >
          {saving ? 'Saving…' : isLast ? 'Enter πroka' : 'Continue'}
        </button>
      </div>
      {saveErr && (
        <p role="alert" className="text-center text-xs text-danger">
          {saveErr}
        </p>
      )}

      <p className="text-center text-xs text-fg-4">Everything here can be changed later in ME.</p>
    </div>
  );
}
