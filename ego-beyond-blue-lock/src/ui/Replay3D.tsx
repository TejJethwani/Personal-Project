/**
 * 3D replay of a goal or big chance, drawn on a canvas with a small hand-written perspective
 * renderer (no external 3D library, works offline). The engine stores a snapshot of every
 * player's position at the moment of the shot; this component re-enacts pass → strike → outcome.
 *
 * Shots from outside the box get a dedicated "long-range" treatment: a chase camera behind the
 * ball, slow motion, a glowing trail, speed lines and a letterboxed caption.
 */
import { useEffect, useRef, useState } from 'react';
import type { MatchState, Replay } from '../engine/match/model';
import { ULT_STYLE } from './UltCutIn';

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);

interface Cam { p: V3; r: V3; u: V3; f: V3; fl: number; cx: number; cy: number }
function mkCam(pos: V3, tgt: V3, fl: number, w: number, h: number): Cam {
  const f = norm(sub(tgt, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { p: pos, r, u, f, fl, cx: w / 2, cy: h / 2 };
}
const toCam = (c: Cam, P: V3): V3 => { const d = sub(P, c.p); return [dot(d, c.r), dot(d, c.u), dot(d, c.f)]; };
const NEAR = 0.4;
function proj(c: Cam, P: V3): { x: number; y: number; z: number } {
  const q = toCam(c, P);
  const z = Math.max(q[2], 0.01);
  return { x: c.cx + (q[0] / z) * c.fl, y: c.cy - (q[1] / z) * c.fl, z: q[2] };
}
function poly(ctx: CanvasRenderingContext2D, c: Cam, pts: V3[], fill: string | CanvasGradient, stroke?: string): void {
  // clip against the near plane in camera space (Sutherland–Hodgman)
  const cs = pts.map((p) => toCam(c, p));
  const out: V3[] = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    const ia = a[2] >= NEAR, ib = b[2] >= NEAR;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
  }
  if (out.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < out.length; i++) { const x = c.cx + (out[i][0] / out[i][2]) * c.fl, y = c.cy - (out[i][1] / out[i][2]) * c.fl; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx: CanvasRenderingContext2D, c: Cam, a: V3, b: V3): void {
  let A = toCam(c, a), B = toCam(c, b);
  if (A[2] < NEAR && B[2] < NEAR) return;
  if (A[2] < NEAR) { const t = (NEAR - A[2]) / (B[2] - A[2]); A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR]; }
  if (B[2] < NEAR) { const t = (NEAR - B[2]) / (A[2] - B[2]); B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, NEAR]; }
  ctx.beginPath();
  ctx.moveTo(c.cx + (A[0] / A[2]) * c.fl, c.cy - (A[1] / A[2]) * c.fl);
  ctx.lineTo(c.cx + (B[0] / B[2]) * c.fl, c.cy - (B[1] / B[2]) * c.fl);
  ctx.stroke();
}

const SKIN = ['#f1c9a5', '#e0ac86', '#c68a62', '#9c6a45', '#6f4a30'];
function drawPlayer(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, col: string, col2: string, o: { rot?: number; lift?: number; ring?: string; num?: number; skin: number; kick?: number }): void {
  const foot = proj(c, [X, o.lift ?? 0, Z]);
  const g = proj(c, [X, 0, Z]);
  if (g.z < 0.8) return;
  const s = c.fl / g.z;
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.5 * s, 0.17 * s, 0, 0, 6.3); ctx.fill();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(1.2, 0.06 * s); ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.75 * s, 0.26 * s, 0, 0, 6.3); ctx.stroke(); }
  ctx.save();
  ctx.translate(foot.x, foot.y);
  if (o.rot) ctx.rotate(o.rot);
  const k = o.kick ?? 0;
  // legs
  ctx.fillStyle = '#e8edf5';
  ctx.save(); ctx.translate(-0.09 * s, -0.84 * s); ctx.rotate(-k * 0.5); ctx.fillRect(-0.06 * s, 0, 0.12 * s, 0.84 * s); ctx.fillStyle = col2; ctx.fillRect(-0.06 * s, 0.5 * s, 0.12 * s, 0.3 * s); ctx.restore();
  ctx.fillStyle = '#e8edf5';
  ctx.save(); ctx.translate(0.09 * s, -0.84 * s); ctx.rotate(k * 0.9); ctx.fillRect(-0.06 * s, 0, 0.12 * s, 0.84 * s); ctx.fillStyle = col2; ctx.fillRect(-0.06 * s, 0.5 * s, 0.12 * s, 0.3 * s); ctx.restore();
  // shorts
  ctx.fillStyle = col2; ctx.fillRect(-0.2 * s, -1.02 * s, 0.4 * s, 0.26 * s);
  // torso with a soft light from the floodlights
  const gr = ctx.createLinearGradient(-0.24 * s, 0, 0.24 * s, 0);
  gr.addColorStop(0, col); gr.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.roundRect(-0.24 * s, -1.52 * s, 0.48 * s, 0.56 * s, 0.08 * s); ctx.fill();
  ctx.fillStyle = shade(col, -0.12);
  ctx.fillRect(-0.33 * s, -1.48 * s, 0.09 * s, 0.42 * s); ctx.fillRect(0.24 * s, -1.48 * s, 0.09 * s, 0.42 * s);
  if (o.num && s > 15) { ctx.fillStyle = lum(col) > 0.6 ? '#111' : '#fff'; ctx.font = `700 ${Math.round(0.3 * s)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(o.num), 0, -1.14 * s); }
  // head
  ctx.fillStyle = SKIN[o.skin % SKIN.length];
  ctx.beginPath(); ctx.arc(0, -1.67 * s, 0.135 * s, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#16181d';
  ctx.beginPath(); ctx.arc(0, -1.7 * s, 0.14 * s, Math.PI, 0); ctx.fill();
  ctx.restore();
}
function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function lum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.3;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const RES_LABEL: Record<Replay['res'], string> = { goal: 'GOAL', save: 'SAVED', off: 'OFF TARGET', post: 'OFF THE WOODWORK', block: 'BLOCKED' };
const SHOT_NAME: Record<string, string> = { first: 'First-time finish', placed: 'Placed finish', power: 'Power shot', long: 'Long-range strike', header: 'Header', volley: 'Volley', fk: 'Free kick', pen: 'Penalty' };

interface Scene {
  rp: Replay; long: boolean; dir: number; goalX: number; shot: V3; passFrom: V3 | null; end: V3; after: V3; h0: number; arc: number; curl: number;
  tPass: number; tStrike: number; tFlight: number; tEnd: number; side: number;
}
function buildScene(rp: Replay, quick = false): Scene {
  const dir = rp.t === 0 ? 1 : -1;
  const goalX = rp.t === 0 ? 105 : 0;
  const sx = rp.v === 'pen' ? goalX - dir * 11 : rp.bx * 1.05, sz = rp.v === 'pen' ? 34 : rp.by * 0.68;
  const long = rp.d > 18 && rp.v !== 'pen';
  const h0 = rp.v === 'header' ? 1.95 : rp.v === 'volley' || rp.v.startsWith('dag') ? 0.9 : 0.11;
  const sg = rp.gy >= 0 ? 1 : -1;
  let end: V3, after: V3;
  const gz = 0.15 + rp.gz * 2.1;
  if (rp.res === 'goal') { end = [goalX, gz, 34 + rp.gy * 3.3]; after = [goalX + dir * 1.7, 0.12, 34 + rp.gy * 3.4]; }
  else if (rp.res === 'save') { end = [goalX - dir * 0.9, gz * 0.9, 34 + rp.gy * 2.9]; after = [goalX - dir * 3.5, 1.2, 34 + rp.gy * 2.9 + sg * 6]; }
  else if (rp.res === 'post') { end = [goalX, Math.min(2.3, gz), 34 + sg * 3.66]; after = [goalX - dir * 5, 0.11, 34 + sg * 6]; }
  else if (rp.res === 'block') { const m: V3 = [lerp(sx, goalX, 0.3), 0.7, lerp(sz, 34, 0.3)]; end = m; after = [m[0] - dir * 3, 0.11, m[2] + sg * 5]; }
  else { const over = rp.gz > 0.55; end = over ? [goalX, 2.44 + 0.5 + rp.gz * 1.6, 34 + rp.gy * 3] : [goalX, gz, 34 + sg * (3.66 + 0.7 + Math.abs(rp.gy) * 2.6)]; after = add(end, [dir * 7, over ? 0.6 : -gz * 0.8, sg * 1]); }
  const passFrom: V3 | null = rp.fx >= 0 ? [rp.fx * 1.05, 0.11, rp.fy * 0.68] : null;
  const tPass = passFrom ? (quick ? 0.7 : 0.95) : 0;
  const tStrike = (quick ? 0.25 : 0.45) + tPass + 0.2 + (rp.ult ? 0.85 : 0);
  const tFlight = Math.max(0.42, Math.min(1.5, rp.d / 24)) * (long ? 2.1 : 1.45) * (rp.ult === 'zero' ? 0.4 : quick && !long ? 0.85 : 1);
  return { rp, long, dir, goalX, shot: [sx, h0, sz], passFrom, end, after, h0, arc: long ? rp.d * 0.07 : rp.v === 'header' ? 0.25 : 0.35, curl: (long ? rp.d * 0.06 : 0.5) * (rp.gy >= 0 ? -1 : 1) * (rp.v === 'power' ? 0.3 : 1), tPass, tStrike, tFlight, tEnd: tStrike + tFlight + (quick && rp.res !== 'goal' ? 1.0 : 1.9), side: sz < 34 ? -1 : 1 };
}
function ballAt(sc: Scene, t: number): { p: V3; u: number; phase: 0 | 1 | 2 | 3 } {
  const { rp } = sc;
  if (t < sc.tStrike) {
    const p0 = sc.tStrike - 0.2 - sc.tPass - (rp.ult ? 0.85 : 0);
    if (sc.passFrom && t > p0) {
      const u = c01((t - p0) / sc.tPass);
      const p = lerp3(sc.passFrom, [sc.shot[0], sc.h0, sc.shot[2]], u);
      p[1] = lerp(0.11, sc.h0, u) + (rp.high ? 3.2 : 0.05) * 4 * u * (1 - u);
      return { p, u, phase: 1 };
    }
    return { p: sc.passFrom ? sc.passFrom : sc.shot, u: 0, phase: 0 };
  }
  const u = (t - sc.tStrike) / sc.tFlight;
  if (u <= 1) {
    const p = lerp3(sc.shot, sc.end, u);
    p[1] = lerp(sc.h0, sc.end[1], u) + sc.arc * 4 * u * (1 - u);
    // curl: sideways bend perpendicular to the shot line
    const dv = norm(sub([sc.end[0], 0, sc.end[2]], [sc.shot[0], 0, sc.shot[2]]));
    const perp: V3 = [-dv[2], 0, dv[0]];
    const k = Math.sin(Math.PI * u) * sc.curl;
    return { p: add(p, mul(perp, k)), u, phase: 2 };
  }
  const v = c01((t - sc.tStrike - sc.tFlight) / 0.9);
  const p = lerp3(sc.end, sc.after, ease(v));
  if (rp.res !== 'goal') p[1] = Math.max(0.11, lerp(sc.end[1], sc.after[1], v) + 0.8 * 4 * v * (1 - v) * (rp.res === 'off' ? 0 : 1));
  else p[1] = Math.max(0.11, sc.end[1] * (1 - v) * (1 - v));
  return { p, u: 1 + v, phase: 3 };
}

function render(ctx: CanvasRenderingContext2D, W: number, H: number, ms: MatchState, sc: Scene, t: number, trail: V3[]): void {
  const { rp, dir, goalX } = sc;
  const b = ballAt(sc, t);
  const goalC: V3 = [goalX, 1.1, 34];
  const sdir = norm(sub([goalX, 0, 34], [sc.shot[0], 0, sc.shot[2]]));
  // ── camera
  let cam: Cam;
  const impact = t - sc.tStrike - sc.tFlight;
  const shake = rp.res === 'goal' && impact > 0 && impact < 0.35 ? (0.35 - impact) * 0.5 : 0;
  if (sc.long) {
    const u = c01((t - sc.tStrike) / sc.tFlight);
    const back = lerp(10, 6, ease(u));
    const anchor: V3 = b.phase >= 2 ? [b.p[0], 0, b.p[2]] : [sc.shot[0], 0, sc.shot[2]];
    const pos = add(add(anchor, mul(sdir, -back)), [0, lerp(3.4, 2.3, ease(u)) + shake * Math.sin(t * 90), sc.side * -1.2 + shake * Math.cos(t * 70)]);
    cam = mkCam(pos, lerp3(goalC, b.p, 0.25), H * lerp(1.0, 1.35, ease(u)), W, H);
  } else {
    const prog = c01(t / sc.tEnd);
    const mid = lerp3([sc.shot[0], 0, sc.shot[2]], goalC, 0.55);
    const ang = lerp(0.95, 0.7, ease(prog));
    const dist = Math.max(12, rp.d * 1.05 + 7);
    const pos: V3 = [mid[0] - dir * Math.cos(ang) * dist, 5.6 - prog * 1.4 + shake * Math.sin(t * 90), mid[2] + sc.side * Math.sin(ang) * dist * -1 + shake * Math.cos(t * 70)];
    cam = mkCam(pos, lerp3(mid, b.p, 0.35), H * 1.25, W, H);
  }
  // ── sky + floodlights
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#04060c'); sky.addColorStop(0.55, '#0a1424'); sky.addColorStop(1, '#0c1a14');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const fx of [0.12, 0.88]) { const g = ctx.createRadialGradient(W * fx, H * 0.02, 2, W * fx, H * 0.02, H * 0.6); g.addColorStop(0, 'rgba(190,225,255,.34)'); g.addColorStop(1, 'rgba(190,225,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // ── stand behind the goal
  const sx0 = goalX + dir * 9, sx1 = goalX + dir * 24;
  poly(ctx, cam, [[sx0, 0, -14], [sx0, 0, 82], [sx1, 15, 82], [sx1, 15, -14]], '#0b1020');
  for (let r = 0; r < 9; r++) {
    const f = (r + 0.5) / 9;
    const X = lerp(sx0, sx1, f), Y = f * 15 + 0.8;
    for (let k = 0; k < 64; k++) {
      const Z = -13 + (k / 63) * 94;
      const q = proj(cam, [X, Y, Z]);
      if (q.z < 1 || q.x < -4 || q.x > W + 4) continue;
      const hsh = ((r * 73 + k * 151) * 2654435761) >>> 0;
      const jump = rp.res === 'goal' && impact > 0 ? Math.abs(Math.sin(t * 9 + (hsh % 7))) * 0.5 * (cam.fl / q.z) : 0;
      ctx.fillStyle = ['#2a3a5c', '#3c4f7a', '#55698f', '#7c8db0', '#1d2740', ms.teams[rp.t].col][hsh % 6];
      const sz = Math.max(1.2, (cam.fl / q.z) * 0.42);
      ctx.fillRect(q.x - sz / 2, q.y - sz - jump, sz, sz);
    }
  }
  // LED board
  poly(ctx, cam, [[goalX + dir * 5, 0, -6], [goalX + dir * 5, 0, 74], [goalX + dir * 5, 1, 74], [goalX + dir * 5, 1, -6]], rp.res === 'goal' && impact > 0 && Math.floor(t * 8) % 2 === 0 ? '#3df2ff' : '#123a6b');
  // ── pitch
  poly(ctx, cam, [[-12, 0, -12], [117, 0, -12], [117, 0, 80], [-12, 0, 80]], '#0a2f18');
  for (let i = 0; i < 20; i++) poly(ctx, cam, [[i * 5.25, 0, 0], [(i + 1) * 5.25, 0, 0], [(i + 1) * 5.25, 0, 68], [i * 5.25, 0, 68]], i % 2 ? '#0f4a24' : '#0c3f1e');
  ctx.strokeStyle = 'rgba(225,245,232,.7)'; ctx.lineWidth = Math.max(1, W / 620);
  const L = (a: V3, c2: V3) => line(ctx, cam, a, c2);
  const rect = (x0: number, z0: number, x1: number, z1: number) => { L([x0, 0, z0], [x1, 0, z0]); L([x1, 0, z0], [x1, 0, z1]); L([x1, 0, z1], [x0, 0, z1]); L([x0, 0, z1], [x0, 0, z0]); };
  rect(0, 0, 105, 68); L([52.5, 0, 0], [52.5, 0, 68]);
  rect(goalX, 13.84, goalX - dir * 16.5, 54.16); rect(goalX, 24.84, goalX - dir * 5.5, 43.16);
  for (let k = 0; k < 14; k++) { const a0 = -0.93 + (k / 14) * 1.86, a1 = -0.93 + ((k + 1) / 14) * 1.86; const cx = goalX - dir * 11; L([cx - dir * Math.cos(a0) * 9.15, 0, 34 + Math.sin(a0) * 9.15], [cx - dir * Math.cos(a1) * 9.15, 0, 34 + Math.sin(a1) * 9.15]); }
  for (let k = 0; k < 24; k++) { const a0 = (k / 24) * 6.283, a1 = ((k + 1) / 24) * 6.283; L([52.5 + Math.cos(a0) * 9.15, 0, 34 + Math.sin(a0) * 9.15], [52.5 + Math.cos(a1) * 9.15, 0, 34 + Math.sin(a1) * 9.15]); }
  // ── goal net (behind everything on the goal line)
  const bulge = rp.res === 'goal' && impact > 0 ? Math.exp(-impact * 2.6) * Math.cos(impact * 13) * 0.9 + (impact < 1.5 ? 0.25 : 0) : 0;
  const netPt = (zz: number, yy: number): V3 => { const dz = zz - sc.end[2], dy = yy - sc.end[1]; return [goalX + dir * (1.9 + bulge * Math.exp(-(dz * dz + dy * dy) / 2.2)), yy, zz]; };
  ctx.strokeStyle = 'rgba(235,240,255,.26)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) { const zz = 34 - 3.66 + (i / 12) * 7.32; for (let j = 0; j < 5; j++) L(netPt(zz, (j / 5) * 2.44), netPt(zz, ((j + 1) / 5) * 2.44)); L([goalX, 2.44, zz], netPt(zz, 2.44)); }
  for (let j = 0; j <= 5; j++) { const yy = (j / 5) * 2.44; for (let i = 0; i < 12; i++) L(netPt(34 - 3.66 + (i / 12) * 7.32, yy), netPt(34 - 3.66 + ((i + 1) / 12) * 7.32, yy)); L([goalX, yy, 34 - 3.66], netPt(34 - 3.66, yy)); L([goalX, yy, 34 + 3.66], netPt(34 + 3.66, yy)); }
  // ── actors (depth sorted)
  type Item = { z: number; draw: () => void };
  const items: Item[] = [];
  const flightU = c01((t - sc.tStrike) / sc.tFlight);
  for (const [idx, px, py] of rp.pl) {
    const p = ms.pl[idx];
    if (!p) continue;
    let X = px * 1.05, Z = py * 0.68;
    const isGk = idx === rp.gk, isSh = idx === rp.sh;
    let rot = 0, lift = 0, kick = 0;
    if (isSh) {
      if (rp.v === 'pen') { X = sc.shot[0] - dir * 0.5; Z = 34; }
      else { X = sc.shot[0] - sdir[0] * 0.45; Z = sc.shot[2] - sdir[2] * 0.45; }
      const run = c01((sc.tStrike - t) / 0.9);
      X -= sdir[0] * run * 3.2; Z -= sdir[2] * run * 3.2;
      const k = t - sc.tStrike;
      kick = k > -0.18 && k < 0.3 ? Math.sin(c01((k + 0.18) / 0.48) * Math.PI) : 0;
      if (rp.v === 'header' || rp.v === 'volley' || rp.v.startsWith('dag')) lift = Math.sin(c01((t - sc.tStrike + 0.35) / 0.7) * Math.PI) * (rp.ult === 'sky' ? 1.5 : rp.v === 'header' ? 0.55 : 0.35);
      if (rp.v.startsWith('dag')) rot = -dir * Math.sin(c01((t - sc.tStrike + 0.3) / 0.6) * Math.PI) * 1.2;
      if (rp.res === 'goal' && impact > 0.25) { X += -sdir[0] * 0 + sc.side * 0; lift = Math.abs(Math.sin((impact - 0.25) * 7)) * 0.35; }
    } else if (isGk) {
      X = goalX - dir * 1.1;
      Z = 34 + Math.max(-3, Math.min(3, (py * 0.68 - 34) * 0.5));
      if (rp.v !== 'pen' || true) {
        const want = rp.res === 'goal' ? rp.gy * 2.0 - Math.sign(rp.gy || 1) * 0.6 : rp.res === 'save' ? rp.gy * 2.9 : rp.gy * 1.6;
        const d = ease(c01((flightU - 0.25) / 0.75));
        Z = lerp(Z, 34 + want, d);
        if (flightU > 0.3) { rot = Math.sign(rp.gy || 1) * cam.r[2] * dir * d * 1.15 * (rp.res === 'block' ? 0.2 : 1); lift = Math.sin(d * Math.PI) * 0.45 + (rp.res === 'save' ? d * rp.gz * 0.9 : 0); }
      }
    } else if (p.t !== rp.t) {
      // defenders close on the ball as the shot is taken
      const k = ease(c01(t / sc.tStrike)) * 0.9;
      const dx = sc.shot[0] - X, dz = sc.shot[2] - Z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
      const mv = Math.min(2.2, dd * 0.25) * k;
      X += (dx / dd) * mv; Z += (dz / dd) * mv;
    } else if (idx === rp.as) {
      kick = t > 0.3 && t < 0.75 ? Math.sin(c01((t - 0.3) / 0.45) * Math.PI) * 0.7 : 0;
    } else if (rp.res === 'goal' && impact > 0.3) lift = Math.abs(Math.sin((impact - 0.3) * 6 + idx)) * 0.25;
    const q = proj(cam, [X, 0, Z]);
    const col = isGk ? (lum(ms.teams[p.t].col) > 0.5 ? '#16a34a' : '#f5d90a') : ms.teams[p.t].col;
    const col2 = isGk ? '#1b1b1b' : ms.teams[p.t].col2 || '#111827';
    items.push({ z: q.z, draw: () => drawPlayer(ctx, cam, X, Z, col, col2, { rot, lift, kick, num: p.num, skin: (idx * 7 + p.num) % 5, ring: p.user ? '#3df2ff' : isSh ? 'rgba(255,255,255,.75)' : undefined }) });
  }
  // goal frame
  const frameCol = '#f4f6fb';
  items.push({ z: proj(cam, [goalX, 1.2, 34]).z + 0.2, draw: () => {
    ctx.strokeStyle = frameCol; ctx.lineWidth = Math.max(2, (cam.fl / Math.max(2, proj(cam, [goalX, 1.2, 34]).z)) * 0.12); ctx.lineCap = 'round';
    L([goalX, 0, 34 - 3.66], [goalX, 2.44, 34 - 3.66]); L([goalX, 0, 34 + 3.66], [goalX, 2.44, 34 + 3.66]); L([goalX, 2.44, 34 - 3.66], [goalX, 2.44, 34 + 3.66]);
    ctx.lineCap = 'butt';
  } });
  // ball + trail
  if (b.phase >= 2 && (trail.length === 0 || Math.abs(trail[trail.length - 1][0] - b.p[0]) + Math.abs(trail[trail.length - 1][2] - b.p[2]) + Math.abs(trail[trail.length - 1][1] - b.p[1]) > 0.05)) { trail.push([b.p[0], b.p[1], b.p[2]]); if (trail.length > (sc.long ? 60 : 26)) trail.shift(); }
  const bq = proj(cam, b.p);
  items.push({ z: bq.z, draw: () => {
    const sh = proj(cam, [b.p[0], 0, b.p[2]]);
    const s = cam.fl / Math.max(0.6, bq.z);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, Math.max(2, 0.2 * s), Math.max(1, 0.07 * s), 0, 0, 6.3); ctx.fill();
    for (let i = 1; i < trail.length; i++) {
      const a = proj(cam, trail[i - 1]), c2 = proj(cam, trail[i]);
      if (a.z < NEAR || c2.z < NEAR) continue;
      const al = (i / trail.length);
      ctx.strokeStyle = sc.long ? `rgba(61,242,255,${al * 0.75})` : `rgba(255,255,255,${al * 0.45})`;
      ctx.lineWidth = Math.max(1, al * (sc.long ? 0.2 : 0.12) * (cam.fl / c2.z));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    }
    const r = Math.max(2.4, 0.115 * s);
    if (sc.long && b.phase === 2) { const g = ctx.createRadialGradient(bq.x, bq.y, r * 0.5, bq.x, bq.y, r * 4.5); g.addColorStop(0, 'rgba(61,242,255,.55)'); g.addColorStop(1, 'rgba(61,242,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bq.x, bq.y, r * 4.5, 0, 6.3); ctx.fill(); }
    const g2 = ctx.createRadialGradient(bq.x - r * 0.3, bq.y - r * 0.35, r * 0.1, bq.x, bq.y, r);
    g2.addColorStop(0, '#fff'); g2.addColorStop(1, '#aab3c2');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(bq.x, bq.y, r, 0, 6.3); ctx.fill();
    if (r > 4) { ctx.fillStyle = '#1c1f26'; const a = t * 14; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(bq.x + Math.cos(a + k * 2.1) * r * 0.5, bq.y + Math.sin(a + k * 2.1) * r * 0.5, r * 0.2, 0, 6.3); ctx.fill(); } }
  } });
  items.sort((a, c2) => c2.z - a.z);
  for (const it of items) if (it.z > NEAR) it.draw();
  // ── ultimate effects: charge-up aura, shockwave and a coloured trail
  if (rp.ult) {
    const us = ULT_STYLE[rp.ult] ?? { col: '#3df2ff', col2: '#fff', tag: '' };
    const ch = c01((t - (sc.tStrike - 0.85)) / 0.85);
    const shp = rp.pl.find((x) => x[0] === rp.sh);
    const fq = proj(cam, [sc.shot[0] - sdir[0] * 0.45, 0.9, sc.shot[2] - sdir[2] * 0.45]);
    if (shp && t < sc.tStrike && ch > 0) {
      ctx.fillStyle = `rgba(2,3,10,${0.5 * ch})`; ctx.fillRect(0, 0, W, H);
      const s = cam.fl / Math.max(1, fq.z);
      for (let r = 0; r < 4; r++) { const k = (ch * 2.2 + r / 4) % 1; ctx.strokeStyle = r % 2 ? us.col : us.col2; ctx.globalAlpha = (1 - k) * 0.9; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fq.x, fq.y + 0.9 * s, (0.4 + 2.6 * (1 - k)) * s, (0.14 + 0.9 * (1 - k)) * s, 0, 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(fq.x, fq.y, 2, fq.x, fq.y, 2.4 * s); g.addColorStop(0, us.col + 'cc'); g.addColorStop(1, us.col + '00'); ctx.fillStyle = g; ctx.globalAlpha = ch * 0.7; ctx.beginPath(); ctx.arc(fq.x, fq.y, 2.4 * s, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 14; i++) { const a = i * 0.449 + t * 3, yy = ((t * 1.6 + i * 0.13) % 1); ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.lineWidth = 2; ctx.globalAlpha = 1 - yy; ctx.beginPath(); ctx.moveTo(fq.x + Math.cos(a) * 0.9 * s, fq.y + 0.9 * s - yy * 2.6 * s); ctx.lineTo(fq.x + Math.cos(a) * 0.9 * s, fq.y + 0.9 * s - yy * 2.6 * s - 0.35 * s); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (rp.ult === 'predator') { const gq = proj(cam, sc.end); const rr = (0.6 + (1 - ch) * 3) * (cam.fl / Math.max(1, gq.z)); ctx.strokeStyle = us.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(gq.x, gq.y, rr, 0, 6.3); ctx.moveTo(gq.x - rr * 1.4, gq.y); ctx.lineTo(gq.x + rr * 1.4, gq.y); ctx.moveTo(gq.x, gq.y - rr * 1.4); ctx.lineTo(gq.x, gq.y + rr * 1.4); ctx.stroke(); }
    }
    const sk = t - sc.tStrike;
    if (sk > 0 && sk < 0.5) { const s = cam.fl / Math.max(1, fq.z); ctx.strokeStyle = us.col2; ctx.globalAlpha = 1 - sk / 0.5; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(fq.x, fq.y + 0.8 * s, sk * 9 * s, sk * 3.2 * s, 0, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; if (sk < 0.12) { ctx.fillStyle = `rgba(255,255,255,${(0.12 - sk) * (rp.ult === 'zero' ? 8 : 4)})`; ctx.fillRect(0, 0, W, H); } }
    if (b.phase === 2) { for (let i = 1; i < trail.length; i++) { const a = proj(cam, trail[i - 1]), c2 = proj(cam, trail[i]); if (a.z < NEAR || c2.z < NEAR) continue; const al = i / trail.length; ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = al * 0.85; ctx.lineWidth = Math.max(2, al * 0.34 * (cam.fl / c2.z)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); } ctx.globalAlpha = 1; }
  }
  // ── post effects
  if (sc.long && b.phase === 2) {
    // speed lines converging on the ball
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.283 + Math.floor(t * 30) * 0.37; const r0 = H * 0.42 + ((k * 37) % 50), r1 = r0 + 60 + ((k * 91) % 90); ctx.beginPath(); ctx.moveTo(bq.x + Math.cos(a) * r0, bq.y + Math.sin(a) * r0); ctx.lineTo(bq.x + Math.cos(a) * r1, bq.y + Math.sin(a) * r1); ctx.stroke(); }
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (rp.res === 'goal' && impact > 0 && impact < 0.3) { ctx.fillStyle = `rgba(255,255,255,${(0.3 - impact) * 1.6})`; ctx.fillRect(0, 0, W, H); }
  if (sc.long) { const bar = H * 0.085 * ease(c01(t / 0.4)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
}

export function Replay3D({ ms, rp, onClose, auto, quick }: { ms: MatchState; rp: Replay; onClose?: () => void; auto?: boolean; quick?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0); // 0 playing, 1 result shown, 2 finished
  const sc = buildScene(rp, quick);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0, t0 = 0, last = -1, st = 0;
    const trail: V3[] = [];
    setStage(0);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const t = Math.min(sc.tEnd, (now - t0) / 1000);
      if (t !== last) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render(ctx, w, h, ms, sc, t, trail); last = t; }
      const ns = t >= sc.tEnd ? 2 : t >= sc.tStrike + sc.tFlight ? 1 : 0;
      if (ns !== st) { st = ns; setStage(ns); }
      if (t < sc.tEnd) raf = requestAnimationFrame(frame);
      else if (auto && onClose) setTimeout(onClose, quick ? 250 : 700);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.id, run, ms]);
  const sh = ms.pl[rp.sh], as = rp.as >= 0 ? ms.pl[rp.as] : null;
  return (
    <div className={`replay3d ${sc.long ? 'long' : ''}`}>
      <canvas ref={ref} aria-label={`3D replay: ${sh?.nm} ${RES_LABEL[rp.res].toLowerCase()} in minute ${rp.min}`} />
      <div className="rp-top"><span className="rp-live"><i />{auto ? 'LIVE · 3D' : 'REPLAY'}</span><span className="rp-min">{rp.min}'</span>{sc.long && <span className="rp-tag">LONG RANGE · {Math.round(rp.d)} M</span>}{rp.ult && <span className="rp-tag ult" style={{ background: ULT_STYLE[rp.ult]?.col }}>ULTIMATE</span>}{rp.ab && !rp.ult && <span className="rp-min">{rp.ab}</span>}</div>
      <div className="rp-info">
        <div><b>{sh?.nm}</b>{as ? <span className="muted"> · assist {as.nm}</span> : null}</div>
        <div className="small">{SHOT_NAME[rp.v] ?? (rp.v.startsWith('dag') ? 'Dead Angle Genesis' : 'Shot')} · {Math.round(rp.d)} m · xG {rp.xg.toFixed(2)} · chance {Math.round(rp.p * 100)}%</div>
      </div>
      {stage >= 1 && <div className={`rp-res ${rp.res}`} key={run}>{RES_LABEL[rp.res]}{rp.res === 'goal' ? <small>{ms.teams[0].abbr} {rp.sc[0]}–{rp.sc[1]} {ms.teams[1].abbr}</small> : null}</div>}
      <div className="rp-btns">
        <button className="btn sm" onClick={() => setRun((x) => x + 1)}>⟲ Again</button>
        {onClose && <button className="btn sm pri" onClick={onClose}>{stage >= 2 ? 'Continue ▶' : 'Skip ▶'}</button>}
      </div>
    </div>
  );
}

/** A compact list of the replays stored for a match with an inline 3D player. */
export function ReplayList({ ms }: { ms: MatchState }) {
  const [sel, setSel] = useState<number | null>(null);
  const list = ms.replays ?? [];
  if (!list.length) return <p className="small muted">No replays were recorded for this match (replays are captured in interactive and highlights modes).</p>;
  const cur = list.find((r) => r.id === sel) ?? null;
  return (
    <div>
      {cur && <div className="mb"><Replay3D ms={ms} rp={cur} onClose={() => setSel(null)} /></div>}
      <div className="row wrap gap6">{list.map((r) => <button key={r.id} className={`btn sm ${sel === r.id ? 'pri' : ''}`} onClick={() => setSel(r.id)}>{r.min}' {r.res === 'goal' ? '⚽' : r.res === 'save' ? '🧤' : r.res === 'post' ? '🥅' : '✕'} {ms.pl[r.sh]?.nm}{r.d > 18 ? ` · ${Math.round(r.d)} m` : ''}</button>)}</div>
    </div>
  );
}
