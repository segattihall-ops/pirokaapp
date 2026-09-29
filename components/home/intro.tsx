'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Launch intro — port of `runIntro()` in the Homepage prototype: a wave lights up particles that fly
 * into the π glyph, "roka" wipes in, the green dot and tagline appear, then an iris reveals the page.
 * ~4.3 s, skippable, skipped entirely under prefers-reduced-motion.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transparent, setTransparent] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const end = () => {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.insertBefore(cv, el.firstChild);
    const ctx = cv.getContext('2d');
    if (!ctx) return end();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const G = '52,211,153';
    const C = (v: number) => Math.max(0, Math.min(1, v));
    const E = (t: number) => 1 - Math.pow(1 - t, 3);
    const EI = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const go = async () => {
      try {
        await Promise.race([document.fonts.load('700 200px Geist'), new Promise((r) => setTimeout(r, 700))]);
      } catch {}
      if (dead) return;
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      if (!w || !h) return end();
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const S = Math.min(w * 0.24, h * 0.32);
      const font = `700 ${S}px Geist, sans-serif`;
      ctx.font = font;
      const Wd = ctx.measureText('πroka').width;
      const wp = ctx.measureText('π').width;
      const x0 = w / 2 - Wd / 2;
      const by = h / 2 + S * 0.28;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const o = off.getContext('2d')!;
      o.font = font;
      o.fillStyle = '#fff';
      o.fillText('π', x0, by);
      const data = o.getImageData(0, 0, w, h).data;
      const step = Math.max(2, Math.round(S / 70));
      const T: [number, number][] = [];
      for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > 140) T.push([x, y]);
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(w, h) / 2;
      const P = T.map(([tx, ty]) => {
        const a = Math.random() * 6.283;
        const r = 40 + Math.pow(Math.random(), 0.6) * maxR;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r * 0.85;
        return {
          sx,
          sy,
          tx,
          ty,
          d: Math.random() * 0.35,
          dist: Math.hypot(sx - cx, sy - cy),
          sw: (Math.random() - 0.5) * 180,
          ph: Math.random() * 50,
        };
      });
      const dotX = x0 + Wd + S * 0.07;
      const dotY = by - S * 0.66;
      const ps = Math.max(1.4, step * 0.75);
      const t0 = performance.now();

      const frame = () => {
        if (dead) return;
        const t = Math.max(0, (performance.now() - t0) / 1000);
        if (t > 4.3) return end();
        raf = requestAnimationFrame(safe);
        const iris = t > 3.3;
        const ik = C((t - 3.3) / 0.9);
        ctx.globalCompositeOperation = 'source-over';
        if (!iris) {
          ctx.fillStyle = 'rgba(7,7,7,0.3)';
          ctx.fillRect(0, 0, w, h);
        } else {
          setTransparent(true);
          ctx.clearRect(0, 0, w, h);
          const rr = EI(ik) * maxR * 1.12;
          ctx.fillStyle = '#070707';
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'destination-out';
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr + 1);
          g.addColorStop(0, 'rgba(0,0,0,1)');
          g.addColorStop(C((rr - 60) / (rr + 1)), 'rgba(0,0,0,1)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, rr - 24), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${G},${0.7 * (1 - ik)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        const wr = E(C((t - 0.3) / 1.1)) * maxR * 1.05;
        if (t > 0.3 && t < 1.5) {
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, wr), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${G},${0.55 * (1 - wr / (maxR * 1.05))})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        const ca = C(t / 0.4) * (1 - C((t - 1.6) / 0.5));
        if (ca > 0) {
          const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
          hg.addColorStop(0, `rgba(${G},${0.35 * ca})`);
          hg.addColorStop(1, `rgba(${G},0)`);
          ctx.fillStyle = hg;
          ctx.fillRect(cx - 34, cy - 34, 68, 68);
          ctx.beginPath();
          ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245,245,245,${ca})`;
          ctx.fill();
        }
        const formed = t > 2.3;
        const fade = iris ? 1 - ik : 1;
        ctx.fillStyle = formed ? `rgba(235,255,245,${fade})` : `rgb(${G})`;
        for (let i = 0; i < P.length; i++) {
          const p = P[i];
          const lit = C((wr - p.dist) / 50);
          if (lit <= 0) continue;
          const m = E(C((t - 1.25 - p.d) / 0.95));
          const dx = p.tx - p.sx;
          const dy = p.ty - p.sy;
          const L = Math.hypot(dx, dy) || 1;
          const sw = Math.sin(m * Math.PI) * p.sw;
          let x = p.sx + dx * m - (dy / L) * sw;
          let y = p.sy + dy * m + (dx / L) * sw;
          if (m >= 1) {
            x += Math.sin(t * 3 + p.ph) * 0.35;
            y += Math.cos(t * 2.6 + p.ph) * 0.35;
          }
          if (iris) {
            const q = ik * ik * 1.6;
            x += (x - cx) * q;
            y += (y - cy) * q;
          }
          if (!formed) ctx.globalAlpha = lit * (0.3 + 0.7 * m);
          ctx.fillRect(x - ps / 2, y - ps / 2, ps, ps);
        }
        ctx.globalAlpha = 1;
        if (t > 2.35) {
          const k = E(C((t - 2.35) / 0.6));
          ctx.globalCompositeOperation = 'source-over';
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0 + wp - 2, 0, (Wd - wp) * k + 6, h);
          ctx.clip();
          ctx.font = font;
          ctx.fillStyle = `rgba(245,245,245,${fade})`;
          ctx.fillText('roka', x0 + wp, by);
          ctx.restore();
          const dk = C((t - 2.8) / 0.3) * fade;
          if (dk > 0) {
            const dg = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, S * 0.16);
            dg.addColorStop(0, `rgba(${G},${0.5 * dk})`);
            dg.addColorStop(1, `rgba(${G},0)`);
            ctx.fillStyle = dg;
            ctx.fillRect(dotX - S * 0.16, dotY - S * 0.16, S * 0.32, S * 0.32);
            ctx.beginPath();
            ctx.arc(dotX, dotY, S * 0.045 * (0.6 + 0.4 * dk), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${G},${dk})`;
            ctx.fill();
          }
          const ta = C((t - 2.8) / 0.4) * fade;
          if (ta > 0) {
            ctx.font = `500 ${Math.max(12, S * 0.075)}px Geist, sans-serif`;
            ctx.textAlign = 'center';
            try {
              (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0.28em';
            } catch {}
            ctx.fillStyle = `rgba(153,153,153,${ta})`;
            ctx.fillText('Know who’s ready.', cx, by + S * 0.36);
            try {
              (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
            } catch {}
            ctx.textAlign = 'start';
          }
        }
      };
      const safe = () => {
        try {
          frame();
        } catch {
          end();
        }
      };
      timers.push(setTimeout(end, 4600));
      raf = requestAnimationFrame(safe);
    };
    timers.push(setTimeout(end, 7000));
    go().catch(end);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      cv.remove();
    };
  }, [onDone]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50"
      style={{
        background: transparent ? 'transparent' : '#070707',
        pointerEvents: transparent ? 'none' : 'auto',
      }}
      aria-hidden
    >
      <button
        type="button"
        onClick={() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }}
        className="tap absolute bottom-[calc(20px+var(--safe-bottom))] right-5 rounded-chip border border-line-2 bg-white/5 px-4 text-[12px] font-medium text-fg-3 hover:text-fg"
        style={{ pointerEvents: 'auto' }}
      >
        Skip
      </button>
    </div>
  );
}
