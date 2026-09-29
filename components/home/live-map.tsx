'use client';

import { useEffect, useRef } from 'react';
import type { Geo } from './use-geo';

/**
 * Homepage background — a faithful port of `initGlobe()` in design/Piroka Homepage.dc.html:
 * a local map (Esri Dark Gray tiles around the visitor, or a procedural street grid until they load),
 * distance rings with labels, a pulse wave, 46 wandering "people" dots and occasional connection arcs.
 * Pauses when the tab is hidden and slows to 15% under prefers-reduced-motion.
 */
export function LiveMap({ geo }: { geo: Geo | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const geoRef = useRef<Geo | null>(geo);
  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    geoRef.current = geo;
    rebuildRef.current?.();
  }, [geo]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cv.style.cssText = 'display:block;width:100%;height:100%;opacity:0;transition:opacity 2.4s ease-out';
    el.appendChild(cv);
    requestAnimationFrame(() => requestAnimationFrame(() => (cv.style.opacity = '0.7')));

    const G = '52,211,153';
    const SP = 64;
    const ANG = -0.2;
    const cA = Math.cos(ANG);
    const sA = Math.sin(ANG);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    type Node = { x: number; y: number; a: number; b: number; e: Node[] };
    type Person = {
      a: Node;
      b: Node | null;
      prev: Node | null;
      t: number;
      x: number;
      y: number;
      moving: boolean;
      sp: number;
      ph: number;
      bs: number;
      flare: number;
      size: number;
      hot: boolean;
    };

    let w = 0,
      h = 0,
      dpr = 1,
      cx = 0,
      cy = 0,
      sc = 1,
      R = 0;
    let map: HTMLCanvasElement | null = null;
    let people: Person[] = [];
    let rings: number[] = [];
    const labels = ['100 m', '500 m', '1 km', '2 km'];
    let labelsCur = labels.slice();
    let tileGen = 0;
    const fmt = (m: number) =>
      m < 950
        ? Math.round(m / 50) * 50 + ' m'
        : (m / 1000).toFixed(m < 9500 ? 1 : 0).replace('.0', '') + ' km';

    const mask = (g: CanvasRenderingContext2D, width: number, height: number) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      const mg = g.createRadialGradient(cx * dpr, cy * dpr, 0, cx * dpr, cy * dpr, R * 0.62 * dpr);
      mg.addColorStop(0, 'rgba(0,0,0,1)');
      mg.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mg;
      g.fillRect(0, 0, width, height);
    };

    const loadTiles = () => {
      const geo = geoRef.current;
      if (!geo || !w) return;
      const gen = ++tileGen;
      const z = w < 900 ? 14 : 15;
      const n = Math.pow(2, z);
      const lat = (geo.lat * Math.PI) / 180;
      const xt = ((geo.lon + 180) / 360) * n;
      const yt = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n;
      const mpp = (156543.03 * Math.cos(lat)) / n;
      labelsCur = rings.map((r) => fmt(r * mpp));
      const x0 = Math.floor(xt - cx / 256) - 1;
      const x1 = Math.floor(xt + (w - cx) / 256) + 1;
      const y0 = Math.floor(yt - cy / 256) - 1;
      const y1 = Math.floor(yt + (h - cy) / 256) + 1;
      const imgs: { im: HTMLImageElement; tx: number; ty: number }[] = [];
      let pending = false;
      const paint = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          if (gen !== tileGen) return;
          const mc = document.createElement('canvas');
          mc.width = w * dpr;
          mc.height = h * dpr;
          const g = mc.getContext('2d');
          if (!g) return;
          g.scale(dpr, dpr);
          g.filter = 'grayscale(1) brightness(1.7) contrast(1.35)';
          imgs.forEach(({ im, tx, ty }) =>
            g.drawImage(im, cx + (tx - xt) * 256, cy + (ty - yt) * 256, 256, 256),
          );
          g.filter = 'none';
          g.globalCompositeOperation = 'multiply';
          g.fillStyle = 'rgb(190,255,228)';
          g.fillRect(0, 0, w, h);
          mask(g, mc.width, mc.height);
          map = mc;
        });
      };
      for (let tx = x0; tx <= x1; tx++)
        for (let ty = y0; ty <= y1; ty++) {
          if (ty < 0 || ty >= n) continue;
          const im = new Image();
          im.crossOrigin = 'anonymous';
          const wx = ((tx % n) + n) % n;
          im.onload = () => {
            imgs.push({ im, tx, ty });
            paint();
          };
          im.src = `https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${ty}/${wx}`;
        }
    };

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      if (!w || !h) return;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const narrow = w < 900;
      cx = narrow ? w * 0.5 : w * 0.68;
      cy = narrow ? h * 0.25 : h * 0.5;
      sc = narrow ? 0.72 : 1;
      R = Math.max(w, h) * 0.75;
      rings = [110, 220, 360, 520].map((r) => r * sc);
      const N = Math.ceil(R / SP) + 2;
      const nodes: Record<string, Node> = {};
      const edges: { n: Node; m: Node; major: boolean }[] = [];
      const k = (a: number, b: number) => a + ',' + b;
      for (let a = -N; a <= N; a++)
        for (let b = -N; b <= N; b++) {
          const gx = a * SP + rnd(-7, 7);
          const gy = b * SP + rnd(-7, 7);
          nodes[k(a, b)] = { x: (gx * cA - gy * sA) * sc, y: (gx * sA + gy * cA) * sc, a, b, e: [] };
        }
      Object.values(nodes).forEach((n) => {
        (
          [
            [1, 0],
            [0, 1],
          ] as const
        ).forEach(([da, db]) => {
          const m = nodes[k(n.a + da, n.b + db)];
          if (m && Math.random() > 0.13) {
            n.e.push(m);
            m.e.push(n);
            edges.push({ n, m, major: da ? n.b % 5 === 0 : n.a % 5 === 0 });
          }
        });
      });
      const mc = document.createElement('canvas');
      mc.width = w * dpr;
      mc.height = h * dpr;
      const g = mc.getContext('2d');
      if (!g) return;
      g.scale(dpr, dpr);
      g.translate(cx, cy);
      for (let p = 0; p < 7; p++) {
        const a = Math.round(rnd(-6, 6));
        const b = Math.round(rnd(-5, 5));
        const q = [nodes[k(a, b)], nodes[k(a + 1, b)], nodes[k(a + 1, b + 1)], nodes[k(a, b + 1)]];
        if (q.every(Boolean)) {
          g.beginPath();
          q.forEach((n, i) => (i ? g.lineTo(n.x, n.y) : g.moveTo(n.x, n.y)));
          g.closePath();
          g.fillStyle = `rgba(${G},0.04)`;
          g.fill();
        }
      }
      g.lineCap = 'round';
      [false, true].forEach((maj) => {
        g.beginPath();
        edges.forEach((e) => {
          if (e.major === maj) {
            g.moveTo(e.n.x, e.n.y);
            g.lineTo(e.m.x, e.m.y);
          }
        });
        g.strokeStyle = maj ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.055)';
        g.lineWidth = maj ? 1.4 : 1;
        g.stroke();
      });
      g.beginPath();
      g.moveTo(-R, -R * 0.4);
      g.quadraticCurveTo(-R * 0.1, R * 0.05, R, R * 0.55);
      g.moveTo(-R * 0.5, R);
      g.quadraticCurveTo(R * 0.05, R * 0.1, R * 0.35, -R);
      g.strokeStyle = 'rgba(255,255,255,0.09)';
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.moveTo(-R, R * 0.42);
      g.bezierCurveTo(-R * 0.3, R * 0.08, R * 0.2, R * 0.72, R, R * 0.28);
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.lineWidth = 30 * sc;
      g.stroke();
      g.strokeStyle = '#070707';
      g.lineWidth = 27 * sc;
      g.stroke();
      mask(g, mc.width, mc.height);
      map = mc;
      const list = Object.values(nodes).filter((n) => n.e.length);
      people = [];
      for (let p = 0; p < 46; p++) {
        let n: Node;
        const lim = rnd(50, R * 0.5);
        let t = 0;
        do {
          n = list[(Math.random() * list.length) | 0];
        } while (Math.hypot(n.x, n.y) > lim && t++ < 60);
        people.push({
          a: n,
          b: null,
          prev: null,
          t: 0,
          x: n.x,
          y: n.y,
          moving: Math.random() < 0.3,
          sp: rnd(0.08, 0.2),
          ph: rnd(0, 6.28),
          bs: rnd(0.25, 0.6),
          flare: 0,
          size: rnd(2, 3.2) * (sc < 1 ? 0.9 : 1),
          hot: Math.random() < 0.2,
        });
      }
      loadTiles();
    };
    const nextNode = (p: Person) => {
      const o = p.a.e.filter((n) => n !== p.prev);
      const arr = o.length ? o : p.a.e;
      return arr[(Math.random() * arr.length) | 0];
    };
    build();
    rebuildRef.current = loadTiles;
    const ro = new ResizeObserver(build);
    ro.observe(el);

    let mx = 0,
      my = 0,
      px = 0,
      py = 0;
    let conn: { p: Person; k: number; hit: boolean } | null = null;
    let connT = 2.5;
    let last = performance.now();
    let T = 0;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove);

    let dead = false;
    const tick = () => {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (document.hidden) {
        last = now;
        return;
      }
      if (!map || !rings.length) return;
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      const m = reduce ? 0.15 : 1;
      last = now;
      T += dt * m;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      px += (mx - px) * 0.04;
      py += (my - py) * 0.04;
      const ox = -px * 16;
      const oy = -py * 12;
      ctx.drawImage(map, ox, oy, w, h);
      ctx.save();
      try {
        ctx.translate(cx + ox * 1.3, cy + oy * 1.3);
        ctx.font = '500 10px Geist, sans-serif';
        rings.forEach((r, i) => {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.setLineDash(i ? [2, 7] : []);
          ctx.strokeStyle = `rgba(${G},${0.16 - i * 0.03})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.32 - i * 0.05})`;
          ctx.fillText(labelsCur[i], Math.cos(-0.85) * r + 6, Math.sin(-0.85) * r);
        });
        ctx.setLineDash([]);

        const maxW = rings[3] * 1.15;
        const wr = ((T % 5.5) / 5.5) * maxW;
        const wa = Math.pow(1 - wr / maxW, 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0, wr), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${G},${wa * 0.1})`;
        ctx.lineWidth = 16;
        ctx.stroke();
        ctx.strokeStyle = `rgba(${G},${wa * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        connT -= dt * m;
        if (!conn && connT <= 0) {
          const c = people.filter((p) => {
            const d = Math.hypot(p.x, p.y);
            return d > 90 && d < 380 * sc;
          });
          if (c.length) conn = { p: c[(Math.random() * c.length) | 0], k: 0, hit: false };
          connT = rnd(4, 7);
        }
        if (conn) {
          conn.k += dt * 0.55 * m;
          const p = conn.p;
          const L = Math.hypot(p.x, p.y);
          const nx = -p.y / L;
          const ny = p.x / L;
          const qx = p.x / 2 + nx * L * 0.28;
          const qy = p.y / 2 + ny * L * 0.28;
          const head = Math.min(conn.k, 1);
          const a = conn.k < 1 ? 0.6 : Math.max(0, 0.6 * (1 - (conn.k - 1) / 0.8));
          ctx.beginPath();
          for (let s = 0; s <= 40; s++) {
            const u = (s / 40) * head;
            const x = 2 * (1 - u) * u * qx + u * u * p.x;
            const y = 2 * (1 - u) * u * qy + u * u * p.y;
            s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          const lg = ctx.createLinearGradient(0, 0, p.x, p.y);
          lg.addColorStop(0, `rgba(${G},0)`);
          lg.addColorStop(1, `rgba(${G},${a})`);
          ctx.strokeStyle = lg;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          if (conn.k >= 1 && !conn.hit) {
            p.flare = 1.4;
            conn.hit = true;
          }
          if (conn.k > 1.8) conn = null;
        }

        people.forEach((p) => {
          if (p.moving) {
            if (!p.b) p.b = nextNode(p);
            p.t += dt * m * p.sp;
            if (p.t >= 1) {
              p.prev = p.a;
              p.a = p.b!;
              p.b = nextNode(p);
              p.t = 0;
            }
            p.x = p.a.x + (p.b!.x - p.a.x) * p.t;
            p.y = p.a.y + (p.b!.y - p.a.y) * p.t;
          }
          const d = Math.hypot(p.x, p.y);
          if (Math.abs(d - wr) < 5) p.flare = Math.max(p.flare, 1);
          p.flare = Math.max(0, p.flare - dt * 0.9);
          const fade = Math.max(0, Math.min(1, 1.15 - d / (R * 0.55)));
          const b = Math.min(
            1,
            (p.bs + 0.35 * Math.pow(Math.max(0, Math.sin(T * 0.7 + p.ph)), 6) + p.flare * 0.7) * fade,
          );
          if (p.hot || p.flare > 0.05) {
            const hr = p.size * (4 + p.flare * 3);
            const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0.01, hr));
            hg.addColorStop(0, `rgba(${G},${b * 0.35})`);
            hg.addColorStop(1, `rgba(${G},0)`);
            ctx.fillStyle = hg;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, hr), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.flare > 0.3 ? `rgba(220,255,240,${b})` : `rgba(${G},${b})`;
          ctx.fill();
        });

        const yg = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
        yg.addColorStop(0, `rgba(${G},0.28)`);
        yg.addColorStop(1, `rgba(${G},0)`);
        ctx.fillStyle = yg;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        const f = (T % 2.6) / 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, 6 + f * 20, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - f)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f5f5f5';
        ctx.fill();
      } finally {
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      rebuildRef.current = null;
      cv.remove();
    };
  }, []);

  return <div ref={ref} aria-hidden className="fixed inset-0 z-0 animate-[piFade_1.6s_ease-out_both]" />;
}
