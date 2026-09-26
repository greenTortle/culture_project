import { useEffect, useRef } from "react";
import { CATEGORIES } from "@/lib/culture/catalog";
import type { SimSnapshot } from "@/lib/culture/types";

function mean(row: number[]) {
  return row.reduce((a, b) => a + b, 0) / row.length;
}

function colorFor(score: number) {
  const t = Math.max(-1, Math.min(1, score / 8));
  if (t >= 0) {
    const a = t;
    return `rgba(${Math.round(143 + (154 - 143) * a)}, ${Math.round(173 + (171 - 173) * a)}, ${Math.round(122 + (138 - 122) * a)}, 0.95)`;
  }
  const a = -t;
  return `rgba(${Math.round(193)}, ${Math.round(122 - 20 * a)}, ${Math.round(98 - 10 * a)}, 0.95)`;
}

export function NetworkGraph({ snap }: { snap: SimSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const n = snap.names.length;
    const pos = Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2;
      return { x: Math.cos(ang), y: Math.sin(ang), vx: 0, vy: 0 };
    });

    let raf = 0;
    let ticks = 0;
    const maxW = Math.max(...snap.edges.map((e) => e.w), 0.2);

    const step = () => {
      ticks += 1;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 640;
      const h = Math.max(320, Math.min(520, w * 0.62));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (ticks < 90) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = pos[j]!.x - pos[i]!.x;
            const dy = pos[j]!.y - pos[i]!.y;
            const d2 = dx * dx + dy * dy + 0.01;
            const d = Math.sqrt(d2);
            const rep = 0.015 / d2;
            pos[i]!.vx -= (dx / d) * rep;
            pos[i]!.vy -= (dy / d) * rep;
            pos[j]!.vx += (dx / d) * rep;
            pos[j]!.vy += (dy / d) * rep;
          }
        }
        for (const e of snap.edges) {
          const dx = pos[e.j]!.x - pos[e.i]!.x;
          const dy = pos[e.j]!.y - pos[e.i]!.y;
          const pull = 0.01 * (e.w / maxW);
          pos[e.i]!.vx += dx * pull;
          pos[e.i]!.vy += dy * pull;
          pos[e.j]!.vx -= dx * pull;
          pos[e.j]!.vy -= dy * pull;
        }
        for (const p of pos) {
          p.vx += -p.x * 0.01;
          p.vy += -p.y * 0.01;
          p.vx *= 0.82;
          p.vy *= 0.82;
          p.x += p.vx;
          p.y += p.vy;
        }
      }

      const cx = w / 2;
      const cy = h / 2;
      const sc = Math.min(w, h) * 0.38;

      ctx.lineWidth = 1;
      for (const e of snap.edges) {
        const a = pos[e.i]!;
        const b = pos[e.j]!;
        ctx.strokeStyle = `rgba(236,234,227,${0.06 + 0.22 * (e.w / maxW)})`;
        ctx.beginPath();
        ctx.moveTo(cx + a.x * sc, cy + a.y * sc);
        ctx.lineTo(cx + b.x * sc, cy + b.y * sc);
        ctx.stroke();
      }

      for (let i = 0; i < n; i++) {
        const p = pos[i]!;
        const x = cx + p.x * sc;
        const y = cy + p.y * sc;
        const s = mean(snap.v[i]!);
        ctx.fillStyle = colorFor(s);
        ctx.beginPath();
        ctx.arc(x, y, snap.isUser[i] ? 7 : 4.2, 0, Math.PI * 2);
        ctx.fill();
        if (snap.isUser[i]) {
          ctx.strokeStyle = "#eceae3";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [snap]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-raised">
      <canvas ref={ref} className="block w-full" />
      <p className="px-4 py-3 text-xs text-muted">
        Nodes colored by mean inclination after the run. Sage is more Biblical;
        terracotta is more permissive. Ringed node is you, if you took the poll.
        {CATEGORIES.length ? "" : ""}
      </p>
    </div>
  );
}
