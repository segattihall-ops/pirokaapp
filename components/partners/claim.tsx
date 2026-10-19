'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Claim = { id: string; listingName: string; address: string; kind: string; status: string; createdAt: string };

/** Shown to members who manage no listing yet: explains verification and takes a claim. */
export function PartnerClaim() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<'venue' | 'clinic' | 'organizer'>('venue');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () =>
    fetch('/api/partners/claims', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { claims: [] }))
      .then((j) => setClaims(j.claims ?? []))
      .catch(() => setClaims([]));
  useEffect(() => {
    void load();
  }, []);

  const pending = claims?.find((c) => c.status === 'pending');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/partners/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingName: name, address, kind, contact }),
    }).catch(() => null);
    setBusy(false);
    if (!r) return setErr('Could not reach the server.');
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not send your claim.');
    setName('');
    setAddress('');
    setContact('');
    await load();
  };

  return (
    <main className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:py-10">
      <span className="eyebrow">For partners</span>
      <h1 className="text-h2 sm:text-h1">Claim your listing</h1>
      <p className="text-[14px] leading-[1.5] text-fg-2">
        Venues, clinics and organizers manage their hours, what they offer and their events here. We verify
        every claim by calling the business on a published number, usually within two business days.
      </p>
      <ul className="glass flex flex-col gap-2 rounded-card px-4 py-3.5 text-[13px] leading-[1.5] text-fg-2">
        <li>Stats are totals only — partners never see who checked in or RSVP&apos;d.</li>
        <li>Events are reviewed by a local ambassador before they appear on the map.</li>
        <li>No drug or sex-for-pay listings.</li>
      </ul>

      {pending ? (
        <div className="glass flex flex-col gap-1 rounded-card border-warning/50 px-4 py-3.5">
          <p className="text-[14px] font-semibold">Verification pending</p>
          <p className="text-[13px] text-fg-3">
            {pending.listingName} · {pending.address}. We&apos;ll email you once it&apos;s verified.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-card px-4 py-4">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Listing type">
            {(
              [
                ['venue', 'Venue'],
                ['clinic', 'Clinic'],
                ['organizer', 'Organizer'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={kind === v}
                onClick={() => setKind(v)}
                className={`chip ${kind === v ? 'chip-selected' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Listing name" aria-label="Listing name" className="input h-12" maxLength={120} required />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" aria-label="Address" className="input h-12" maxLength={200} required />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Business phone or email we can verify"
            aria-label="Contact"
            className="input h-12"
            maxLength={200}
            required
          />
          {err && (
            <p role="alert" className="text-[12px] text-danger">
              {err}
            </p>
          )}
          <button type="submit" disabled={busy || name.trim().length < 2 || address.trim().length < 4 || contact.trim().length < 5} className="btn-primary h-12 bg-green hover:bg-green-hover">
            {busy ? '…' : 'Send claim'}
          </button>
        </form>
      )}

      {claims && claims.some((c) => c.status !== 'pending') && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Past claims</p>
          {claims
            .filter((c) => c.status !== 'pending')
            .map((c) => (
              <div key={c.id} className="glass flex items-center justify-between rounded-card px-4 py-3 text-[13px]">
                <span className="truncate">{c.listingName}</span>
                <span className={c.status === 'approved' ? 'text-green' : 'text-fg-4'}>{c.status}</span>
              </div>
            ))}
        </div>
      )}

      <p className="text-[12px] text-fg-4">
        Already a partner on another account?{' '}
        <Link href="/help/support" className="text-green hover:text-green-hover">
          Partner support
        </Link>
      </p>
    </main>
  );
}
