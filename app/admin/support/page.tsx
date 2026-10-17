'use client';

import { useMemo, useState } from 'react';
import {
  Action,
  ActionRow,
  ConsoleHeader,
  DetailBlock,
  DetailHead,
  Facts,
  FilterChips,
  NoSelection,
  NoteBox,
  QueueLayout,
  type QueueRow,
} from '@/components/admin/console/ui';
import { useToast } from '@/components/admin/console/shell';
import { agoLabel, seedTickets, type SeedTicket } from '@/lib/admin/ts-seed';

const CANNED: Record<string, string> = {
  PT: 'Obrigado por entrar em contato — já estou cuidando disso. Retorno aqui em até 24 horas, e antes se for uma questão de segurança.',
  ES: 'Gracias por escribir — ya me estoy ocupando de esto. Te respondo aquí en un máximo de 24 horas, y antes si es un tema de seguridad.',
  EN: 'Thanks for reaching out — I’m on it. I’ll update you here within 24 hours, and sooner if it’s a safety issue.',
};
const slaLimit = (t: SeedTicket) => (t.topic.toLowerCase().includes('harass') || t.prem ? 240 : 1440);

export default function SupportPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState(() => seedTickets());
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return tickets
      .filter(
        (t) =>
          (filt === 'all' || t.status === 'open') && (!ql || JSON.stringify(t).toLowerCase().includes(ql)),
      )
      .slice()
      .sort(
        (a, b) =>
          (b.topic.toLowerCase().includes('harass') ? 1 : 0) -
            (a.topic.toLowerCase().includes('harass') ? 1 : 0) || Number(b.prem) - Number(a.prem),
      )
      .map((t) => {
        const left = slaLimit(t) - t.age;
        return {
          id: t.id,
          dot: left < 60 ? '#f87171' : '#34d399',
          title: t.topic,
          meta: `${t.user} · ${t.lang} · ${agoLabel(t.age)}`,
          tag:
            t.status === 'open'
              ? left > 0
                ? `SLA ${Math.round(left / 60)}h left`
                : 'SLA breached'
              : t.status,
          tagCol: left < 60 ? '#f87171' : '#999',
        };
      });
  }, [tickets, filt, q]);

  const x = tickets.find((t) => t.id === sel && (filt === 'all' || t.status === 'open')) ?? null;

  const resolve = (status: string, msg: string) => {
    if (!x) return;
    setTickets((ts) => ts.map((t) => (t.id === x.id ? { ...t, status } : t)));
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Support"
        sub="Human replies · PT, EN, ES · Premium SLA 4h"
        search
        q={q}
        onQ={setQ}
        demo
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Open', n: tickets.filter((t) => t.status === 'open').length },
          { key: 'all', label: 'All', n: tickets.length },
        ]}
        active={filt}
        onPick={(k) => (setFilt(k as 'open' | 'all'), setSel(null))}
      />
      <QueueLayout
        rows={rows}
        selectedId={sel}
        onSelect={(id) => (setSel(id), setNote(''))}
        detail={
          !x ? (
            <NoSelection />
          ) : (
            <>
              <DetailHead title={x.topic} id={x.id} />
              <Facts
                items={[
                  { k: 'User', v: x.user },
                  { k: 'Language', v: x.lang },
                  { k: 'Plan', v: x.prem ? 'Premium · 4h SLA' : 'Standard · 24h SLA' },
                  { k: 'Opened', v: agoLabel(x.age) },
                ]}
              />
              <DetailBlock label="Message">
                <span className="text-[13px] leading-[1.5] text-fg-2">{x.msg}</span>
              </DetailBlock>
              <button
                type="button"
                onClick={() => setNote(CANNED[x.lang] ?? CANNED.EN)}
                className="self-start rounded-chip border border-sel-border px-3 py-1.5 text-[12px] font-medium text-green"
              >
                Draft reply with AI
              </button>
              <NoteBox value={note} onChange={setNote} placeholder="Reply to the user" />
              <ActionRow>
                <Action
                  label="Send reply"
                  kind="pri"
                  onClick={() =>
                    note.trim()
                      ? resolve('replied', `Reply sent to ${x.user}.`)
                      : toast('Write a reply first.')
                  }
                />
                <Action
                  label="Escalate to T&S"
                  onClick={() => resolve('escalated', `Escalated ${x.id} to Trust & Safety.`)}
                />
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
