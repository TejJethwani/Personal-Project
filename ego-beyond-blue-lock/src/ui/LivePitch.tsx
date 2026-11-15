/**
 * Live top-down pitch. One requestAnimationFrame loop interpolates every player AND the ball
 * between consecutive engine states with the same clock, so they can never drift apart:
 *  - a carried ball is drawn at the carrier's interpolated feet;
 *  - a pass travels from where the ball was to where the receiver will be, arriving exactly
 *    when the receiver does;
 *  - a loose / dead ball simply interpolates.
 */
import { useEffect, useRef, useState } from 'react';
import type { Decision, MatchState, Option } from '../engine/match/model';
import { paintKit } from '../engine/data/kits';
import { msKits } from './Replay3D';

export interface Marker { x: number; y: number; opts: Option[]; label: string; kind: 'mate' | 'goal' | 'move' | 'self'; idx: number }
const SHORT: Record<string, string> = { behind: 'IN BEHIND', blind: 'BLINDSIDE', near: 'NEAR POST', far: 'FAR POST', short: 'COME SHORT', overlap: 'OVERLAP', hold: 'HOLD', cut: 'CUT LANE', tackle: 'TACKLE', press: 'PRESS', contain: 'CONTAIN', carry: 'CARRY', dribble: 'TAKE ON', shoot: 'SHOOT' };
/** Where on the pitch each option of a decision "lives", so it can be tapped or swiped towards. */
export function markersFor(ms: MatchState, d: Decision | null): Marker[] {
  const u = ms.uc?.idx ?? -1;
  if (!d || u < 0) return [];
  const me = ms.pl[u];
  const dir = me.t === 0 ? 1 : -1, goalX = me.t === 0 ? 100 : 0, ownX = 100 - goalX;
  const out: Marker[] = [];
  const add = (x: number, y: number, o: Option, label: string, kind: Marker['kind']) => {
    x = Math.max(2, Math.min(98, x)); y = Math.max(3, Math.min(97, y));
    const idx = kind === 'mate' ? o.tgt : kind === 'self' ? u : -1;
    const m = out.find((q) => (idx >= 0 ? q.idx === idx : Math.abs(q.x - x) + Math.abs(q.y - y) < 3) && q.kind === kind);
    if (m) m.opts.push(o); else out.push({ x, y, opts: [o], label, kind, idx });
  };
  for (const o of d.options) {
    const seg = o.id.split(':');
    if (o.id === 'run:call') { add(me.x, me.y, o, 'CALL FOR IT', 'self'); continue; }
    if (o.id === 'run:shoot' && ms.car >= 0) { add(goalX, 50, o, 'TELL HIM: SHOOT', 'goal'); continue; }
    const base = seg[0] === 'run' || seg[0] === 'def' ? seg[1] : o.id === 'ult:predator' ? 'behind' : o.id === 'ult:curtain' ? 'tackle' : seg[0];
    if (o.id.startsWith('flow') || o.kind === 'meta') continue;
    if (d.kind === 'keeper') { const y = o.id === 'gk:left' ? 40 : o.id === 'gk:right' ? 60 : 50, x = o.id === 'gk:rush' ? ownX + dir * 9 : ownX + dir * (o.id === 'gk:big' ? 4 : 1.5); add(x, o.id === 'gk:big' ? 53 : y, o, o.id === 'gk:left' ? 'DIVE LEFT' : o.id === 'gk:right' ? 'DIVE RIGHT' : o.id === 'gk:rush' ? 'RUSH OUT' : o.id === 'gk:big' ? 'STAY BIG' : 'SET', o.id === 'gk:set' ? 'self' : 'move'); continue; }
    if (d.kind === 'penalty') { add(goalX, o.id.includes('chip') ? 50 : o.id.includes('power') ? 44 : 56, o, o.id.includes('chip') ? 'CHIP' : o.id.includes('power') ? 'POWER' : 'PLACE', 'goal'); continue; }
    if (o.tgt >= 0 && ms.pl[o.tgt]?.on && o.tgt !== u) { add(ms.pl[o.tgt].x, ms.pl[o.tgt].y, o, ms.pl[o.tgt].nm, 'mate'); continue; }
    if (o.kind === 'shoot') { add(goalX, 50, o, 'SHOOT', 'goal'); continue; }
    if (d.kind === 'ball') {
      if (o.kind === 'dribble') add(me.x + dir * 9, me.y + (me.y < 50 ? 5 : -5), o, 'TAKE ON', 'move');
      else if (o.kind === 'carry') add(me.x + dir * 11, me.y, o, 'CARRY', 'move');
      else add(me.x, me.y, o, 'HOLD', 'self');
    } else if (d.kind === 'offball') {
      const side = ms.by < 50 ? -1 : 1;
      if (base === 'behind') add(me.x + dir * 16, me.y, o, SHORT.behind, 'move');
      else if (base === 'blind') add(me.x + dir * 9, me.y + (me.y < 50 ? 9 : -9), o, SHORT.blind, 'move');
      else if (base === 'near') add(goalX - dir * 7, 50 + side * 7, o, SHORT.near, 'move');
      else if (base === 'far') add(goalX - dir * 7, 50 - side * 9, o, SHORT.far, 'move');
      else if (base === 'short') add(me.x + (ms.bx - me.x) * 0.55, me.y + (ms.by - me.y) * 0.55, o, SHORT.short, 'move');
      else if (base === 'overlap') add(me.x + dir * 12, me.y < 50 ? me.y - 11 : me.y + 11, o, SHORT.overlap, 'move');
      else if (base === 'cut') add(me.x + dir * 6, me.y + (50 - me.y) * 0.5, o, 'CUT INSIDE', 'move');
      else add(me.x, me.y, o, 'HOLD', 'self');
    } else if (d.kind === 'defend') {
      if (base === 'tackle') add(ms.bx, ms.by, o, SHORT.tackle, 'goal');
      else if (base === 'press') add(me.x + (ms.bx - me.x) * 0.6, me.y + (ms.by - me.y) * 0.6, o, SHORT.press, 'move');
      else if (base === 'cut') add(ms.bx + (ownX - ms.bx) * 0.3, ms.by + (50 - ms.by) * 0.5, o, SHORT.cut, 'move');
      else if (base === 'contain') add(me.x + (ownX - me.x) * 0.12, me.y, o, SHORT.contain, 'move');
      else add(me.x, me.y, o, 'HOLD', 'self');
    } else add(me.x, me.y, o, (o.label || 'OPTION').toUpperCase().slice(0, 12), 'self');
  }
  return out;
}
const best = (m: Marker) => m.opts.reduce((a, b) => (b.p > a.p ? b : a));
const pcol = (p: number) => (p >= 0.7 ? '#2ee59d' : p >= 0.45 ? '#ffd166' : '#ff6b81');

interface Snap { sig: number; step: number; pos: Float32Array; on: Uint8Array; ball: [number, number]; car: number; high: boolean; poss: number }
function snapOf(ms: MatchState): Snap {
  const n = ms.pl.length;
  const pos = new Float32Array(n * 2), on = new Uint8Array(n);
  for (let i = 0; i < n; i++) { pos[i * 2] = ms.pl[i].x; pos[i * 2 + 1] = ms.pl[i].y; on[i] = ms.pl[i].on ? 1 : 0; }
  let sig = ms.steps * 31 + ms.car + ms.bx * 3 + ms.by;
  for (let i = 0; i < n; i++) if (on[i]) sig += pos[i * 2] * (i + 1) + pos[i * 2 + 1] * 1.7;
  return { sig: Math.round(sig * 10), step: ms.steps, pos, on, ball: [ms.bx, ms.by], car: ms.car, high: ms.bh > 0, poss: ms.poss };
}
const lum = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return 0.3; const v = parseInt(m[1], 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };

export function LivePitch({ ms, tick, hover, banner, touch, onPick, outcome }: { ms: MatchState; tick: number; hover: number; banner: { x: string; i: number } | null; touch?: boolean; onPick?: (id: string) => void; outcome?: { ok: boolean | null; title: string; text: string } | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef<{ from: Snap; to: Snap; t0: number; dur: number; shown: Snap; trail: { x1: number; y1: number; x2: number; y2: number; t: number } | null }>(null);
  const marks = touch ? markersFor(ms, ms.pending) : [];
  const live = useRef({ ms, hover, tick, marks, drag: null as null | { x: number; y: number; sx: number; sy: number } });
  live.current = { ...live.current, ms, hover, tick, marks };
  const [menu, setMenu] = useState<{ x: number; y: number; opts: Option[]; label: string } | null>(null);
  const geo = useRef({ pad: 8, sx: 1, sy: 1 });
  if (!ms.pending && menu) setMenu(null);
  const toPitch = (e: { clientX: number; clientY: number }) => { const r = cv.current!.getBoundingClientRect(); const G = geo.current; return { x: (e.clientX - r.left - G.pad) / G.sx, y: (e.clientY - r.top - G.pad) / G.sy, px: e.clientX - r.left, py: e.clientY - r.top }; };
  /** Where a marker is on screen right now: markers on players follow the drawn (interpolated) player. */
  const shownOf = (m: Marker): [number, number] => { const P = st.current?.shown.pos; return m.idx >= 0 && P ? [P[m.idx * 2], P[m.idx * 2 + 1]] : [m.x, m.y]; };
  const choose = (m: Marker, px: number, py: number) => {
    if (!onPick) return;
    if (m.opts.length === 1) { setMenu(null); onPick(m.opts[0].id); }
    else setMenu({ x: px, y: py, opts: [...m.opts].sort((a, b) => b.p - a.p), label: m.label });
  };
  const down = (e: React.PointerEvent) => { if (!touch || !ms.pending) return; const q = toPitch(e); live.current.drag = { x: q.x, y: q.y, sx: q.x, sy: q.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { const d = live.current.drag; if (!d) return; const q = toPitch(e); d.x = q.x; d.y = q.y; };
  const up = (e: React.PointerEvent) => {
    const d = live.current.drag; live.current.drag = null;
    if (!d || !touch || !ms.pending) return;
    const q = toPitch(e);
    const M = live.current.marks;
    const len = Math.hypot((q.x - d.sx) * 1.05, (q.y - d.sy) * 0.68);
    if (len < 4) { // a tap: nearest marker
      let bm: Marker | null = null, bd = 9;
      for (const m of M) { const [sx2, sy2] = shownOf(m); const dd = Math.hypot((sx2 - q.x) * 1.05, (sy2 - q.y) * 0.68); if (dd < bd) { bd = dd; bm = m; } }
      if (bm) choose(bm, q.px, q.py); else setMenu(null);
      return;
    }
    // a swipe: the marker whose direction from your player best matches the gesture
    const me = { x: st.current!.shown.pos[ms.uc!.idx * 2] ?? ms.pl[ms.uc!.idx].x, y: st.current!.shown.pos[ms.uc!.idx * 2 + 1] ?? ms.pl[ms.uc!.idx].y };
    const vx = (q.x - d.sx) * 1.05, vy = (q.y - d.sy) * 0.68;
    let bm: Marker | null = null, bs = 0.55;
    for (const m of M) { if (m.kind === 'self') continue; const [sx2, sy2] = shownOf(m); const mx = (sx2 - me.x) * 1.05, my = (sy2 - me.y) * 0.68; const ml = Math.hypot(mx, my); if (ml < 1) continue; const cs = (mx * vx + my * vy) / (ml * len); if (cs > bs) { bs = cs; bm = m; } }
    if (bm) choose(bm, q.px, q.py);
  };

  // a new engine state: start interpolating from what is on screen right now
  if (!st.current) { const s = snapOf(ms); st.current = { from: s, to: s, t0: 0, dur: 1, shown: s, trail: null }; }
  const now0 = snapOf(ms);
  if (st.current.to.sig !== now0.sig) {
    const S = st.current;
    const to = now0;
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
      geo.current = { pad, sx, sy };
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
      S.shown = { sig: -1, step: S.to.step, pos: (() => { const a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = px[i]; a[i * 2 + 1] = py[i]; } return a; })(), on: S.to.on, ball: [bx, by], car, high: S.to.high, poss: S.to.poss };
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
      const KITS = msKits(m);
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
        g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
        const kt = gk ? null : KITS[p.t];
        ctx.fillStyle = gk ? fill : kt!.c1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill();
        if (kt && kt.pat !== 'plain') { ctx.save(); ctx.clip(); if (kt.pat === 'sleeves') { ctx.fillStyle = kt.c2; ctx.fillRect(cx - R, cy - R * 0.2, R * 0.45, R * 1.2); ctx.fillRect(cx + R * 0.55, cy - R * 0.2, R * 0.45, R * 1.2); } else paintKit(ctx, kt, cx - R, cy - R, R * 2, R * 2); ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); }
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = i === car ? 2.6 : 1.6; ctx.strokeStyle = p.star ? '#ffd166' : i === car ? '#ffffff' : gk ? '#111' : T.col2 || '#0b1020'; ctx.stroke();
        const numBg = gk ? fill : kt!.pat === 'plain' || kt!.pat === 'sleeves' ? kt!.c1 : kt!.c1;
        ctx.fillStyle = lum(numBg) > 0.6 ? '#0a0f18' : '#fff'; ctx.strokeStyle = lum(numBg) > 0.6 ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.7)'; ctx.lineWidth = 2.4; ctx.font = `700 ${Math.round(R * 1.05)}px 'Barlow Condensed', sans-serif`;
        if (p.num) { ctx.strokeText(String(p.num), cx, cy + 0.5); ctx.fillText(String(p.num), cx, cy + 0.5); }
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
      // ── touch markers: tap a ring or swipe from your player towards it
      const MK = live.current.marks;
      if (MK.length && u >= 0) {
        const mx0 = X(px[u]), my0 = Y(py[u]);
        const dg = live.current.drag;
        for (const mk of MK) {
          const o = best(mk), col = pcol(o.p);
          const x = mk.idx >= 0 ? X(px[mk.idx]) : X(mk.x), y = mk.idx >= 0 ? Y(py[mk.idx]) : Y(mk.y);
          const rr = Math.max(15, W * 0.024);
          if (mk.kind === 'move' || mk.kind === 'goal') {
            ctx.strokeStyle = col; ctx.globalAlpha = 0.75; ctx.lineWidth = 2.5; ctx.setLineDash(mk.kind === 'goal' ? [] : [7, 5]); ctx.lineDashOffset = -now / 50;
            ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
            const a = Math.atan2(y - my0, x - mx0); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a - 0.4) * 12, y - Math.sin(a - 0.4) * 12); ctx.lineTo(x - Math.cos(a + 0.4) * 12, y - Math.sin(a + 0.4) * 12); ctx.fill(); ctx.globalAlpha = 1;
          }
          const pulse = 1 + Math.sin(now / 220 + mk.x) * 0.08;
          ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, rr * pulse, 0, 6.3); ctx.stroke();
          ctx.fillStyle = 'rgba(4,8,16,.72)'; ctx.beginPath(); ctx.arc(x, y, rr * pulse - 1.5, 0, 6.3); if (mk.kind !== 'mate') ctx.fill();
          const txt = `${Math.round(o.p * 100)}%`;
          ctx.font = `700 ${Math.max(12, Math.round(rr * 0.7))}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (mk.kind === 'mate') { const w = ctx.measureText(txt).width + 8; ctx.fillStyle = 'rgba(4,8,16,.88)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y + rr + 2, w, 15, 3); ctx.fill(); ctx.fillStyle = col; ctx.fillText(txt, x, y + rr + 10); }
          else { ctx.fillStyle = col; ctx.fillText(txt, x, y - 3); ctx.font = `600 9px 'Barlow Condensed', sans-serif`; ctx.fillStyle = '#dfe7f7'; ctx.fillText(mk.label.slice(0, 11), x, y + rr * 0.48); }
          if (o.hot) { ctx.strokeStyle = '#ff2d75'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr * pulse + 4, 0, 6.3); ctx.stroke(); }
        }
        if (dg) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(dg.sx), Y(dg.sy)); ctx.lineTo(X(dg.x), Y(dg.y)); ctx.stroke(); }
      }
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
      <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={touch && ms.pending ? { touchAction: 'none', cursor: 'pointer' } : undefined} role="img" aria-label={`Pitch view. ${ms.teams[0].name} attack right, ${ms.teams[1].name} attack left.`} />
      {outcome && <div className={`poutcome ${outcome.ok === true ? 'ok' : outcome.ok === false ? 'bad' : ''}`} role="status"><b>{outcome.title}</b>{outcome.text && <span>{outcome.text}</span>}</div>}
      {touch && ms.pending && !menu && <div className="ptouchhint">Tap a ring — or swipe from your player — to choose</div>}
      {menu && <div className="ptouchmenu" style={{ left: Math.min(Math.max(8, menu.x - 90), (cv.current?.clientWidth ?? 300) - 190), top: Math.max(8, menu.y - 20) }}>
        <div className="h">{menu.label}</div>
        {menu.opts.map((o) => <button key={o.id} className={o.hot ? 'hot' : ''} onClick={() => { setMenu(null); onPick?.(o.id); }}><span>{o.label || o.id}</span><b style={{ color: pcol(o.p) }}>{Math.round(o.p * 100)}%</b></button>)}
        <button className="x" onClick={() => setMenu(null)}>Cancel</button>
      </div>}
      {banner && !outcome && <div className={`pbanner i${banner.i}`} aria-live="polite">{banner.x}</div>}
    </div>
  );
}
