'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Lang = 'pt' | 'en';
type Msg = { me: boolean; text: string };

// Copy from the prototype. The app has no assistant backend, so Ana's first reply is the honest auto-acknowledgement
// a human team would send; it never pretends a person has already read the message.
const REPLY: Record<
  Lang,
  {
    hi: string;
    ack: string;
    tag: string;
    ph: string;
    send: string;
    status: string;
    cta: string;
    topics: string[];
  }
> = {
  en: {
    hi: 'Hi, I’m Ana, πroka’s guided helper. Tell me what’s going on and I’ll point you the right way.',
    ack: 'Thanks. For anything that needs a person — safety, your account, or a removal — send it through Report content below so it reaches our Trust & Safety team. If anyone is in immediate danger, contact local emergency services first.',
    tag: 'Answers common questions · routes anything urgent to a person',
    ph: 'Write to Ana…',
    send: 'Send',
    status: 'Guided help',
    cta: 'Reach a person → Report content',
    topics: ['My account was hacked', 'Someone is harassing me', 'I was banned', 'Billing question'],
  },
  pt: {
    hi: 'Oi, eu sou a Ana, a ajudante guiada do πroka. Conta o que está acontecendo que eu te direciono.',
    ack: 'Obrigada. Para qualquer coisa que precise de uma pessoa — segurança, sua conta ou uma remoção — envie por Denunciar conteúdo abaixo, assim chega à nossa equipe de Confiança e Segurança. Se alguém estiver em perigo imediato, ligue primeiro para a emergência.',
    tag: 'Responde dúvidas comuns · encaminha o urgente para uma pessoa',
    ph: 'Escreva para a Ana…',
    send: 'Enviar',
    status: 'Ajuda guiada',
    cta: 'Falar com uma pessoa → Denunciar conteúdo',
    topics: ['Minha conta foi invadida', 'Estou sendo assediado(a)', 'Fui banido(a)', 'Dúvida de pagamento'],
  },
};

export function SupportChat() {
  const [lang, setLang] = useState<Lang>('pt');
  const [msgs, setMsgs] = useState<Msg[]>([{ me: false, text: REPLY.pt.hi }]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const L = REPLY[lang];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const say = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m, { me: true, text: t }]);
    setDraft('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { me: false, text: L.ack }]);
    }, 1200);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="flex flex-col gap-1">
          <h1 className="text-h1">Support</h1>
          <span className="text-[14px] text-fg-3">{L.tag}</span>
        </span>
        <div className="flex gap-1 rounded-input bg-ink-800 p-1" role="tablist" aria-label="Language">
          {(['pt', 'en'] as Lang[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={lang === k}
              onClick={() => setLang(k)}
              className={`h-8 rounded-input px-3 text-[12px] font-semibold text-fg ${lang === k ? 'bg-ink-750' : ''}`}
            >
              {k === 'pt' ? 'Português' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-card border border-line-1 bg-ink-900">
        <div className="flex items-center gap-3 border-b border-line-1 px-4 py-3.5">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-chip border border-sel-border bg-ink-750 text-[14px] font-bold text-green">
            A
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold">Ana · πroka Support</span>
            <span className="text-[12px] text-fg-3">{L.status}</span>
          </span>
        </div>
        <div
          ref={scrollRef}
          className="flex h-[340px] flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-4"
        >
          {msgs.map((m, i) =>
            m.me ? (
              <div
                key={i}
                className="max-w-[80%] self-end rounded-card rounded-br-input bg-green px-3.5 py-2.5 text-[14px] font-medium leading-[1.5] text-ink-950"
              >
                {m.text}
              </div>
            ) : (
              <div
                key={i}
                className="max-w-[80%] self-start rounded-card rounded-bl-input bg-ink-800 px-3.5 py-2.5 text-[14px] leading-[1.5]"
              >
                {m.text}
              </div>
            ),
          )}
          {typing && (
            <div
              className="flex gap-1.5 self-start rounded-card rounded-bl-input bg-ink-800 p-3.5"
              aria-label="Ana is typing"
            >
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-chip bg-fg"
                  style={{ animation: `piDot 1.2s ${d}s infinite` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 pb-2.5">
          {L.topics.map((t) => (
            <button key={t} type="button" onClick={() => say(t)} className="chip">
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 border-t border-line-1 px-4 pb-4 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && say(draft)}
            placeholder={L.ph}
            aria-label={L.ph}
            className="h-[46px] min-w-0 flex-1 rounded-btn border border-line-2 bg-ink-800 px-3.5 text-[14px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border"
          />
          <button
            type="button"
            onClick={() => say(draft)}
            className="tap h-[46px] rounded-btn bg-fg px-[18px] text-[14px] font-semibold text-ink-950"
          >
            {L.send}
          </button>
        </div>
      </div>
      <Link
        href="/help/report"
        className="tap-link flex items-center gap-1.5 text-[13px] font-medium text-green"
      >
        {L.cta}
      </Link>
      <span className="text-[12px] text-fg-4">
        Ana answers from πroka’s help articles. Messages here are not a live chat — anything that needs a
        person goes through Report content, which reaches our team.
      </span>
    </>
  );
}
