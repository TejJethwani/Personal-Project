/**
 * Live top-down pitch. One requestAnimationFrame loop interpolates every player AND the ball
 * between consecutive engine states with the same clock, so they can never drift apart:
 *  - a carried ball is drawn at the carrier's interpolated feet;
 *  - a pass travels from where the ball was to where the receiver will be, arriving exactly
 *    when the receiver does;
 *  - a loose / dead ball simply interpolates.
 */
import { useEffect, useRef } from 'react';
import type { MatchState } from '../engine/match/model';

interface Snap { step: number; pos: Float32Array; on: Uint8Array; ball: [number, number]; car: number; high: boolean; poss: number }
function snapOf(ms: MatchState): Snap {
  const n = ms.pl.length;
  const pos = new Float32Array(n * 2), on = new Uint8Array(n);
  for (let i = 0; i < n; i++) { pos[i * 2] = ms.pl[i].x; pos[i * 2 + 1] = ms.pl[i].y; on[i] = ms.pl[i].on ? 1 : 0; }
  return { step: ms.steps, pos, on, ball: [ms.bx, ms.by], car: ms.car, high: ms.bh > 0, poss: ms.poss };
}
const lum = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return 0.3; const v = parseInt(m[1], 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };

export function LivePitch({ ms, tick, hover, banner }: { ms: MatchState; tick: number; hover: number; banner: { x: string; i: number } | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef<{ from: Snap; to: Snap; t0: number; dur: number; shown: Snap; trail: { x1: number; y1: number; x2: number; y2: number; t: number } | null }>(null);
  const live = useRef({ ms, hover, tick });
  live.current = { ms, hover, tick };

  // a new engine state: start interpolating from what is on screen right now
  if (!st.current) { const s = snapOf(ms); st.current = { from: s, to: s, t0: 0, dur: 1, shown: s, trail: null }; }
  if (st.current.to.step !== ms.steps || st.current.to.car !== ms.car) {
    const S = st.current;
    const to = snapOf(ms);
    const jump = Math.abs(to.step - S.to.step) > 12;
    const from: Snap = { ...S.shown, pos: S.shown.pos.slice(), on: S.shown.on.slice(), ball: [S.shown.ball[0], S.shown.ball[1]] };
    // players who were not on the pitch (or a big time skip) appear in place instead of sliding
    for (let i = 0; i < ms.pl.length; i++) if (jump || !from.on[i] || Math.abs(from.pos[i * 2] - to.pos[i * 2]) + Math.abs(from.pos[i * 2 + 1] - to.pos[i * 2 + 1]) > 45) { from.pos[i * 2] = to.pos[i * 2]; from.pos[i * 2 + 1] = to.pos[i * 2 + 1]; }
    if (jump) from.ball = [to.ball[0], to.ball[1]];
    const moved = Math.abs(from.ball[0] - to.ball[0]) + Math.abs(from.ball[1] - to.ball[1]);
    S.trail = !jump && to.car !== S.to.car && moved > 5 ? { x1: from.ball[0], y1: from.ball[1], x2: to.ball[0], y2: to.ball[1], t: performance.now() } : S.trail;
    S.from = from; S.to = to; S.t0 = performance.now(); S.dur = Math.max(110, Math.min(620, tick * 0.96));
  }

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (now: number) => {
      const S = st.current!;
      const { ms: m, hover: hv } = live.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c.clientWidth, H = c.clientHeight;
      if (W < 60 || H < 40) { raf = requestAnimationFrame(draw); return; }
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = Math.max(8, W * 0.022);
      const sx = (W - pad * 2) / 100, sy = (H - pad * 2) / 100;
      const X = (x: number) => pad + x * sx, Y = (y: number) => pad + y * sy;
      const k = Math.min(1, (now - S.t0) / S.dur);
      // ── pitch
      ctx.fillStyle = '#082814'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#0c3a1d' : '#0e4322'; ctx.fillRect(X((i * 100) / 12), Y(0), (100 / 12) * sx + 0.6, 100 * sy); }
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
      vg.addColorStop(0, 'rgba(255,255,255,.05)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(232,246,236,.62)'; ctx.lineWidth = Math.max(1, W / 620);
      const mx = (v: number) => (v / 105) * 100, my = (v: number) => (v / 68) * 100;
      ctx.strokeRect(X(0), Y(0), 100 * sx, 100 * sy);
      ctx.beginPath(); ctx.moveTo(X(50), Y(0)); ctx.lineTo(X(50), Y(100)); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(X(50), Y(50), mx(9.15) * sx, my(9.15) * sy, 0, 0, 6.3); ctx.stroke();
      for (const side of [0, 1]) {
        const gx = side ? 100 : 0, d = side ? -1 : 1;
        ctx.strokeRect(X(gx), Y(50 - my(20.16)), d * mx(16.5) * sx, my(40.32) * sy);
        ctx.strokeRect(X(gx), Y(50 - my(9.16)), d * mx(5.5) * sx, my(18.32) * sy);
        ctx.beginPath(); ctx.arc(X(gx + d * mx(11)), Y(50), 1.6, 0, 6.3); ctx.fillStyle = 'rgba(232,246,236,.7)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(X(gx) - (side ? 0 : pad * 0.6), Y(50 - my(3.66)), pad * 0.6, my(7.32) * sy);
        ctx.strokeRect(X(gx) - (side ? 0 : pad * 0.6), Y(50 - my(3.66)), pad * 0.6, my(7.32) * sy);
      }
      // ── interpolated positions
      const n = m.pl.length;
      const px = new Float32Array(n), py = new Float32Array(n);
      for (let i = 0; i < n; i++) { px[i] = S.from.pos[i * 2] + (S.to.pos[i * 2] - S.from.pos[i * 2]) * k; py[i] = S.from.pos[i * 2 + 1] + (S.to.pos[i * 2 + 1] - S.from.pos[i * 2 + 1]) * k; }
      let bx: number, by: number, lift = 0;
      const car = S.to.car;
      if (car >= 0 && S.to.on[car]) {
        const dir = m.pl[car].t === 0 ? 1 : -1;
        const tx = px[car] + dir * 0.9, ty = py[car] + 0.5;
        if (S.from.car === car) { bx = tx + Math.sin(now / 90) * 0.25; by = ty; }
        else { const e = 1 - (1 - k) * (1 - k); bx = S.from.ball[0] + (tx - S.from.ball[0]) * e; by = S.from.ball[1] + (ty - S.from.ball[1]) * e; lift = S.to.high ? Math.sin(Math.PI * k) : 0; }
      } else { bx = S.from.ball[0] + (S.to.ball[0] - S.from.ball[0]) * k; by = S.from.ball[1] + (S.to.ball[1] - S.from.ball[1]) * k; lift = S.to.high ? Math.sin(Math.PI * k) * 0.8 : 0; }
      S.shown = { step: S.to.step, pos: (() => { const a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = px[i]; a[i * 2 + 1] = py[i]; } return a; })(), on: S.to.on, ball: [bx, by], car, high: S.to.high, poss: S.to.poss };
      // ── pass trail
      if (S.trail) {
        const age = (now - S.trail.t) / 900;
        if (age < 1) { ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - age)})`; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(S.trail.x1), Y(S.trail.y1)); ctx.lineTo(X(bx), Y(by)); ctx.stroke(); ctx.setLineDash([]); } else S.trail = null;
      }
      // ── hover target
      if (hv >= 0 && m.pl[hv]?.on) { ctx.strokeStyle = '#3df2ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(bx), Y(by)); ctx.lineTo(X(px[hv]), Y(py[hv])); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(X(px[hv]), Y(py[hv]), Math.max(12, W * 0.022), 0, 6.3); ctx.stroke(); }
      // ── players
      const R = Math.max(7, Math.min(13, W * 0.0135));
      const u = m.uc?.idx ?? -1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const order: number[] = [];
      for (let i = 0; i < n; i++) if (S.to.on[i]) order.push(i);
      order.sort((a, b) => py[a] - py[b]);
      for (const i of order) {
        const p = m.pl[i];
        const cx = X(px[i]), cy = Y(py[i]);
        const T = m.teams[p.t];
        const gk = p.line === 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx + 1.5, cy + R * 0.75, R * 0.95, R * 0.42, 0, 0, 6.3); ctx.fill();
        if (p.flEnd > m.play) { ctx.strokeStyle = 'rgba(180,123,255,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); }
        if (i === u) { const pulse = 1 + Math.sin(now / 260) * 0.12; ctx.strokeStyle = '#3df2ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, (R + 4.5) * pulse, 0, 6.3); ctx.stroke(); }
        const fill = gk ? (lum(T.col) > 0.55 ? '#14833b' : '#f5d90a') : T.col;
        const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.15, cx, cy, R);
        g.addColorStop(0, '#ffffff55'); g.addColorStop(0.25, fill); g.addColorStop(1, fill);
        ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill();
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = i === car ? 2.6 : 1.6; ctx.strokeStyle = p.star ? '#ffd166' : i === car ? '#ffffff' : gk ? '#111' : T.col2 || '#0b1020'; ctx.stroke();
        ctx.fillStyle = lum(fill) > 0.6 ? '#0a0f18' : '#fff'; ctx.font = `700 ${Math.round(R * 1.05)}px 'Barlow Condensed', sans-serif`;
        if (p.num) ctx.fillText(String(p.num), cx, cy + 0.5);
        if (i === u || i === car || i === hv) {
          ctx.font = `600 ${Math.max(11, Math.round(R * 1.05))}px 'Barlow Condensed', sans-serif`;
          const w = ctx.measureText(p.nm).width + 10;
          ctx.fillStyle = i === u ? 'rgba(6,40,52,.92)' : 'rgba(4,8,16,.82)'; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - R - 19, w, 15, 3); ctx.fill();
          ctx.fillStyle = i === u ? '#3df2ff' : '#fff'; ctx.fillText(p.nm, cx, cy - R - 11);
        }
      }
      // ── ball (always on top, shadow shows height)
      const bX = X(bx), bY = Y(by), br = Math.max(4, R * 0.5) * (1 + lift * 0.7);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(bX + lift * 6, bY + 3 + lift * 9, br * 0.9, br * 0.5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#10131a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bX, bY - lift * 10, br, 0, 6.3); ctx.fill(); ctx.stroke();
      // ── attack direction tags
      ctx.font = `600 12px 'Barlow Condensed', sans-serif`; ctx.textBaseline = 'top';
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(`${m.teams[0].abbr} ▶`, pad + 6, pad + 5);
      ctx.textAlign = 'right'; ctx.fillText(`◀ ${m.teams[1].abbr}`, W - pad - 6, pad + 5);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pitchwrap livepitch">
      <canvas ref={cv} role="img" aria-label={`Pitch view. ${ms.teams[0].name} attack right, ${ms.teams[1].name} attack left.`} />
      {banner && <div className={`pbanner i${banner.i}`} aria-live="polite">{banner.x}</div>}
    </div>
  );
}
