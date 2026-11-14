/**
 * 3D replay of a goal or big chance, drawn on a canvas with a small hand-written perspective
 * renderer (no external 3D library, works offline). The engine stores a snapshot of every
 * player's position at the moment of the shot; this component re-enacts pass → strike → outcome.
 *
 * Shots from outside the box get a dedicated "long-range" treatment: a chase camera behind the
 * ball, slow motion, a glowing trail, speed lines and a letterboxed caption.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchState, Replay } from '../engine/match/model';
import type { Game } from '../engine/types';
import { lookFor } from '../engine/career';
import { lookColours } from './kit';
import { ULT_STYLE, ULT_NAME } from './UltCutIn';

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


interface Face { skin: string; hair: string; style: number; beard: boolean }
interface Pose { rot?: number; lift?: number; kick?: number; arms?: number; crouch?: number; front?: boolean; happy?: boolean; ring?: string; num?: number; alpha?: number }
const ARM: [number, number][] = [[0.14, 0.14], [2.75, 2.75], [1.75, 1.75], [0.35, 2.95], [2.2, 2.2]]; // down, up, wide, point, half-up

function drawPlayer(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, col: string, col2: string, f: Face, o: Pose): void {
  const foot = proj(c, [X, o.lift ?? 0, Z]);
  const g = proj(c, [X, 0, Z]);
  if (g.z < 0.8) return;
  const s = c.fl / g.z;
  ctx.globalAlpha = (o.alpha ?? 1) * 0.38; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.5 * s, 0.17 * s, 0, 0, 6.3); ctx.fill();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(1.2, 0.06 * s); ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.75 * s, 0.26 * s, 0, 0, 6.3); ctx.stroke(); }
  ctx.save();
  ctx.translate(foot.x, foot.y);
  if (o.rot) ctx.rotate(o.rot);
  const k = o.kick ?? 0, cr = 1 - (o.crouch ?? 0) * 0.55;
  const leg = 0.84 * cr, hip = -leg * s;
  // legs
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 0.09 * s, hip); ctx.rotate(sd < 0 ? -k * 0.5 : k * 0.9);
    ctx.fillStyle = f.skin; ctx.fillRect(-0.06 * s, 0, 0.12 * s, leg * s);
    ctx.fillStyle = col2; ctx.fillRect(-0.065 * s, leg * s * 0.55, 0.13 * s, leg * s * 0.36);
    ctx.fillStyle = '#f2f4f8'; ctx.fillRect(-0.075 * s, leg * s * 0.9, 0.17 * s, leg * s * 0.1);
    ctx.restore();
  }
  ctx.fillStyle = col2; ctx.fillRect(-0.2 * s, hip - 0.18 * s, 0.4 * s, 0.26 * s);
  // arms behind the torso
  const [aL, aR] = ARM[o.arms ?? 0];
  const sh = hip - 0.64 * s;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 0.27 * s, sh); ctx.rotate(sd * (sd < 0 ? aL : aR) * -1);
    ctx.fillStyle = shade(col, -0.14); ctx.fillRect(-0.05 * s, 0, 0.1 * s, 0.2 * s);
    ctx.fillStyle = f.skin; ctx.fillRect(-0.042 * s, 0.2 * s, 0.084 * s, 0.24 * s);
    ctx.restore();
  }
  const gr = ctx.createLinearGradient(-0.24 * s, 0, 0.24 * s, 0);
  gr.addColorStop(0, col); gr.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.roundRect(-0.24 * s, hip - 0.7 * s, 0.48 * s, 0.56 * s, 0.08 * s); ctx.fill();
  if (o.num && s > 15) { ctx.fillStyle = lum(col) > 0.6 ? '#111' : '#fff'; ctx.font = `700 ${Math.round(0.3 * s)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(o.num), 0, hip - 0.3 * s); }
  // head with a face
  const hy = hip - 0.86 * s, r = 0.16 * s;
  const front = o.front !== false;
  if (f.style === 2) { ctx.fillStyle = f.hair; ctx.fillRect(-r * 1.1, hy - r * 0.3, r * 2.2, r * 1.9); }
  if (f.style === 4) { ctx.fillStyle = f.hair; ctx.beginPath(); ctx.arc(0, hy - r * 0.15, r * 1.42, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = f.skin; ctx.fillRect(-r * 0.35, hy + r * 0.6, r * 0.7, r * 0.7);
  ctx.fillStyle = front || f.style === 3 ? f.skin : f.hair;
  ctx.beginPath(); ctx.arc(0, hy, r, 0, 6.3); ctx.fill();
  if (f.style !== 3) {
    ctx.fillStyle = f.hair;
    if (front) { ctx.beginPath(); ctx.arc(0, hy - r * 0.08, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0, hy - r * 0.62, -r * 1.02, hy - r * 0.14); ctx.fill(); }
    if (f.style === 1) { ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * r * 0.42 - r * 0.3, hy - r * 0.72); ctx.lineTo(i * r * 0.5, hy - r * (1.55 - Math.abs(i) * 0.14)); ctx.lineTo(i * r * 0.42 + r * 0.3, hy - r * 0.72); } ctx.fill(); }
    if (f.style === 5) ctx.fillRect(-r * 0.24, hy - r * 1.5, r * 0.48, r * 0.75);
  }
  if (front && r > 2.4) {
    if (f.beard) { ctx.fillStyle = f.hair; ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.arc(0, hy + r * 0.1, r * 0.98, 0.15, Math.PI - 0.15); ctx.quadraticCurveTo(0, hy + r * 0.25, r * 0.95, hy + r * 0.25); ctx.fill(); ctx.globalAlpha = o.alpha ?? 1; }
    if (r > 4.2) {
      for (const sd of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(sd * r * 0.38, hy + r * 0.02, r * 0.2, r * (o.happy ? 0.1 : 0.15), 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#16181d'; ctx.beginPath(); ctx.arc(sd * r * 0.38, hy + r * 0.03, r * 0.09, 0, 6.3); ctx.fill();
        ctx.strokeStyle = shade(f.hair === '#e8e8ee' ? '#888888' : f.hair, -0.2); ctx.lineWidth = Math.max(1, r * 0.11); ctx.beginPath(); ctx.moveTo(sd * r * 0.16, hy - r * (o.happy ? 0.3 : 0.2)); ctx.lineTo(sd * r * 0.6, hy - r * (o.happy ? 0.36 : 0.3)); ctx.stroke();
      }
      ctx.strokeStyle = '#7a2f2f'; ctx.fillStyle = '#4a1414'; ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.beginPath();
      if (o.happy) { ctx.arc(0, hy + r * 0.36, r * 0.34, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill(); }
      else { ctx.moveTo(-r * 0.24, hy + r * 0.5); ctx.quadraticCurveTo(0, hy + r * 0.58, r * 0.24, hy + r * 0.5); ctx.stroke(); }
    } else { ctx.fillStyle = '#16181d'; ctx.fillRect(-r * 0.5, hy - r * 0.05, r * 0.3, r * 0.26); ctx.fillRect(r * 0.2, hy - r * 0.05, r * 0.3, r * 0.26); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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

// ── finish types: each has its own trajectory, body shape, keeper reaction and camera ──
type PoseK = 'std' | 'bicycle' | 'scissor' | 'dive' | 'slide' | 'heel' | 'leap' | 'chip';
interface Flair { name: string; arc: number; curl: number; wob: number; speed: number; pose: PoseK; gk: 'dive' | 'rush' | 'early' | 'stand'; cam: 'side' | 'net' | 'low' | 'chase' | 'orbit'; postIn?: boolean; fire?: boolean; chipH?: number }
const FL = (name: string, o: Partial<Flair> = {}): Flair => ({ name, arc: 0.35, curl: 0.5, wob: 0, speed: 1, pose: 'std', gk: 'dive', cam: 'side', ...o });
export function pickFlair(rp: Replay): Flair {
  const f = pickFlair0(rp);
  // ultimates are shown from the side so their effects stay in view
  if (rp.ult && f.cam === 'net') f.cam = 'side';
  return f;
}
function pickFlair0(rp: Replay): Flair {
  const h = ((rp.id * 2654435761) ^ Math.round(rp.d * 97) ^ (rp.min * 131)) >>> 0;
  const r = rp.fr ?? (h >>> 7) % 100;
  const d = rp.d, ag = Math.abs(rp.gy), goal = rp.res === 'goal';
  if (rp.v === 'pen') return ag < 0.3 && rp.gz > 0.45 && goal ? FL('Panenka', { arc: 2.4, speed: 0.5, gk: 'early', cam: 'net', chipH: 1.3 }) : FL('Penalty', { cam: 'net', speed: 1.2 });
  if (rp.v.startsWith('dag')) return FL('Dead Angle Genesis', { pose: 'bicycle', cam: 'orbit', curl: 1.6, arc: 0.9 });
  if (rp.v === 'fk') return FL('Free-kick curler', { curl: d * 0.1, arc: d * 0.09, cam: 'chase' });
  if (rp.v === 'header') return d < 8 && r < 55 ? FL('Diving header', { pose: 'dive', cam: 'low', arc: 0.1 }) : FL('Towering header', { pose: 'leap', arc: 0.2, cam: r < 50 ? 'side' : 'net' });
  if (rp.v === 'volley') return r < 36 && d < 17 ? FL('Bicycle kick', { pose: 'bicycle', cam: 'orbit', arc: 0.8 }) : r < 68 ? FL('Scissor volley', { pose: 'scissor', cam: 'low', arc: 0.5 }) : FL('Volley', { arc: 0.6, speed: 1.2 });
  if (d > 18) return r < 26 ? FL('Knuckleball', { wob: 1, arc: d * 0.03, curl: 0, cam: 'chase' }) : r < 52 ? FL('Rocket', { speed: 1.5, arc: 0.3, curl: 0.2, fire: true, cam: 'chase' }) : r < 78 ? FL('Curler', { curl: d * 0.12, arc: d * 0.06, cam: 'chase' }) : FL('Dipping strike', { arc: d * 0.13, curl: d * 0.03, cam: 'chase' });
  if (rp.gz > 0.68 && ag > 0.58) return FL('Top bins', { cam: 'net', curl: 0.9, arc: 0.5 });
  if (ag > 0.8 && goal && r < 65) return FL('In off the post', { postIn: true, cam: 'net', curl: 1.1 });
  if (ag < 0.24 && rp.gz < 0.32 && d < 15) return FL('Through the keeper\'s legs', { gk: 'stand', cam: 'low', arc: 0.02, curl: 0 });
  if (d > 8 && d < 17 && r < 24) return FL('Chip over the keeper', { arc: 2.6, speed: 0.62, gk: 'rush', pose: 'chip', chipH: 1.7 });
  if (d < 6.5 && r < 42) return FL('Sliding finish', { pose: 'slide', cam: 'low', arc: 0.05 });
  if (d < 9 && r < 62) return FL('Back-heel flick', { pose: 'heel', arc: 0.1, speed: 0.8, cam: 'low' });
  if (rp.v === 'power') return FL('Power drive', { fire: true, speed: 1.35, arc: 0.2, curl: 0.1 });
  if (rp.v === 'first') return FL('First-time finish', { speed: 1.1, cam: r % 2 ? 'side' : 'net' });
  return FL('Placed finish', { curl: 0.9, cam: r % 3 === 0 ? 'net' : 'side' });
}
const CELE = ['Knee slide', 'Arms-wide run', 'Backflip', 'Point to the sky', 'Jump and punch', 'Ice cold', 'Aeroplane'];

interface Scene {
  rp: Replay; long: boolean; dir: number; goalX: number; shot: V3; passFrom: V3 | null; end: V3; after: V3; h0: number; fl: Flair;
  tP0: number; tPass: number; tStrike: number; tFlight: number; tCele: number; tEnd: number; side: number; cele: number; celeDir: V3; quick: boolean;
}
function buildScene(rp: Replay, quick = false): Scene {
  const fl = pickFlair(rp);
  const dir = rp.t === 0 ? 1 : -1;
  const goalX = rp.t === 0 ? 105 : 0;
  const sx = rp.v === 'pen' ? goalX - dir * 11 : rp.bx * 1.05, sz = rp.v === 'pen' ? 34 : rp.by * 0.68;
  const long = rp.d > 18 && rp.v !== 'pen';
  const h0 = rp.v === 'header' ? 1.95 : rp.v === 'volley' || rp.v.startsWith('dag') ? 0.9 : 0.11;
  const sg = rp.gy >= 0 ? 1 : -1;
  let end: V3, after: V3;
  const gz = fl.chipH ?? 0.15 + rp.gz * 2.1;
  if (rp.res === 'goal' && fl.postIn) { end = [goalX, Math.min(2.2, gz), 34 + sg * 3.58]; after = [goalX + dir * 1.7, 0.12, 34 + sg * 1.2]; }
  else if (rp.res === 'goal') { end = [goalX, gz, 34 + rp.gy * 3.3]; after = [goalX + dir * 1.7, 0.12, 34 + rp.gy * 3.4]; }
  else if (rp.res === 'save') { end = [goalX - dir * 0.9, gz * 0.9, 34 + rp.gy * 2.9]; after = [goalX - dir * 3.5, 1.2, 34 + rp.gy * 2.9 + sg * 6]; }
  else if (rp.res === 'post') { end = [goalX, Math.min(2.3, gz), 34 + sg * 3.66]; after = [goalX - dir * 5, 0.11, 34 + sg * 6]; }
  else if (rp.res === 'block') { const m: V3 = [lerp(sx, goalX, 0.3), 0.7, lerp(sz, 34, 0.3)]; end = m; after = [m[0] - dir * 3, 0.11, m[2] + sg * 5]; }
  else { const over = rp.gz > 0.55; end = over ? [goalX, 2.44 + 0.5 + rp.gz * 1.6, 34 + rp.gy * 3] : [goalX, gz, 34 + sg * (3.66 + 0.7 + Math.abs(rp.gy) * 2.6)]; after = add(end, [dir * 7, over ? 0.6 : -gz * 0.8, sg * 1]); }
  const passFrom: V3 | null = rp.fx >= 0 ? [rp.fx * 1.05, 0.11, rp.fy * 0.68] : null;
  const tPass = passFrom ? (quick ? 0.7 : 0.95) : 0;
  const tP0 = quick ? 0.25 : 0.45;
  const tStrike = tP0 + tPass + 0.2 + (rp.ult ? 0.85 : 0);
  const tFlight = (Math.max(0.42, Math.min(1.5, rp.d / 24)) * (long ? 2.1 : 1.45) * (rp.ult === 'zero' ? 0.4 : quick && !long ? 0.85 : 1)) / fl.speed;
  const hasCele = rp.res === 'goal' && !quick;
  const tCele = tStrike + tFlight + 1.0;
  const side = sz < 34 ? -1 : 1;
  const celeDir = norm([dir * 0.25, 0, side * 1]);
  return { rp, long, dir, goalX, shot: [sx, h0, sz], passFrom, end, after, h0, fl, tP0, tPass, tStrike, tFlight, tCele, tEnd: hasCele ? tCele + 3.0 : tStrike + tFlight + (quick ? 1.0 : 1.7), side, cele: ((((rp.id + 1) * 2654435761 + rp.min * 40503 + rp.sh * 97) >>> 9) >>> 0) % CELE.length, celeDir, quick };
}
function ballAt(sc: Scene, t: number): { p: V3; u: number; phase: 0 | 1 | 2 | 3 } {
  const { rp, fl } = sc;
  if (t < sc.tStrike) {
    if (sc.passFrom && t > sc.tP0) {
      const u = c01((t - sc.tP0) / sc.tPass);
      const p = lerp3(sc.passFrom, [sc.shot[0], sc.h0, sc.shot[2]], u);
      p[1] = lerp(0.11, sc.h0, u) + (rp.high ? 3.2 : 0.05) * 4 * u * (1 - u);
      return { p, u, phase: 1 };
    }
    return { p: sc.passFrom ? sc.passFrom : sc.shot, u: 0, phase: 0 };
  }
  const u = (t - sc.tStrike) / sc.tFlight;
  if (u <= 1) {
    const p = lerp3(sc.shot, sc.end, u);
    p[1] = lerp(sc.h0, sc.end[1], u) + fl.arc * 4 * u * (1 - u);
    const dv = norm(sub([sc.end[0], 0, sc.end[2]], [sc.shot[0], 0, sc.shot[2]]));
    const perp: V3 = [-dv[2], 0, dv[0]];
    const k = Math.sin(Math.PI * u) * fl.curl * (rp.gy >= 0 ? -1 : 1) + Math.sin(u * 19) * fl.wob * 0.3 * (1 - u * 0.4);
    p[1] = Math.max(0.11, p[1] + Math.sin(u * 27) * fl.wob * 0.14);
    return { p: add(p, mul(perp, k)), u, phase: 2 };
  }
  const v = c01((t - sc.tStrike - sc.tFlight) / 0.9);
  const p = lerp3(sc.end, sc.after, ease(v));
  if (rp.res !== 'goal') p[1] = Math.max(0.11, lerp(sc.end[1], sc.after[1], v) + 0.8 * 4 * v * (1 - v) * (rp.res === 'off' ? 0 : 1));
  else p[1] = Math.max(0.11, sc.end[1] * (1 - v) * (1 - v));
  return { p, u: 1 + v, phase: 3 };
}
/** Where the scorer is during the celebration and what his body does. */
function celeState(sc: Scene, tc: number): { pos: V3; pose: Pose } {
  const run = Math.min(13, 6 + sc.cele);
  const start: V3 = [sc.shot[0], 0, sc.shot[2]];
  const at = (e: number): V3 => add(start, mul(sc.celeDir, run * e));
  const e = ease(c01(tc / 1.5));
  switch (sc.cele) {
    case 0: { const sl = c01((tc - 1.1) / 1.4); return { pos: at(Math.min(1, c01(tc / 1.1) * 0.75 + (1 - (1 - sl) * (1 - sl)) * 0.25)), pose: { crouch: tc > 1.1 ? 1 : 0, arms: tc > 1.1 ? 2 : 4, kick: tc < 1.1 ? Math.sin(tc * 16) * 0.5 : 0 } }; }
    case 2: { const f = c01((tc - 1.2) / 0.75); return { pos: at(Math.min(e, 0.8) + f * 0.12), pose: { rot: f > 0 && f < 1 ? -f * 6.283 : 0, lift: Math.sin(f * Math.PI) * 1.25, arms: f > 0 && f < 1 ? 1 : tc > 1.95 ? 2 : 4, kick: tc < 1.2 ? Math.sin(tc * 16) * 0.5 : 0 } }; }
    case 3: return { pos: at(e * 0.55), pose: { arms: tc > 1.1 ? 3 : 4, kick: tc < 1.1 ? Math.sin(tc * 16) * 0.5 : 0 } };
    case 4: { const j = c01((tc - 1.2) / 0.7); return { pos: at(e * 0.7), pose: { lift: Math.sin(j * Math.PI) * 0.95, arms: j > 0 && j < 1 ? 3 : tc > 1.9 ? 2 : 4, rot: j > 0 && j < 1 ? Math.sin(j * Math.PI) * 0.25 : 0, kick: tc < 1.2 ? Math.sin(tc * 16) * 0.5 : 0 } }; }
    case 5: return { pos: at(c01(tc / 2.8) * 0.3), pose: { arms: tc > 1.3 ? 2 : 0, kick: Math.sin(tc * 6) * 0.15 } };
    case 6: return { pos: add(at(e), [0, 0, Math.sin(tc * 2.4) * 2.2 * e]), pose: { arms: 2, rot: Math.sin(tc * 2.4) * 0.3, kick: Math.sin(tc * 16) * 0.5 } };
    default: return { pos: at(e), pose: { arms: 2, kick: Math.sin(tc * 16) * 0.5 } };
  }
}

/** World-space effects that are specific to each ultimate. `over` = drawn above the actors. */
function ultFx(ctx: CanvasRenderingContext2D, cam: Cam, sc: Scene, ms: MatchState, t: number, over: boolean, bp: V3): void {
  const key = sc.rp.ult;
  if (!key) return;
  const us = ULT_STYLE[key] ?? { col: '#3df2ff', col2: '#ffffff', tag: '' };
  const k = c01((t - (sc.tStrike - 0.85)) / 0.85); // charge
  const fl = c01((t - sc.tStrike) / sc.tFlight);
  const sp: V3 = [sc.shot[0], 0, sc.shot[2]];
  const L = (a: V3, b: V3) => line(ctx, cam, a, b);
  ctx.lineCap = 'round';
  if (!over) {
    if (key === 'dominion') { // a tactical grid lights up across the final third, rings expand from the scorer
      ctx.strokeStyle = us.col; ctx.lineWidth = 1; ctx.globalAlpha = 0.35 * Math.min(1, k * 2);
      for (let i = 0; i <= 12; i++) { const x = sc.goalX - sc.dir * i * 3.5; L([x, 0.02, 0], [x, 0.02, 68]); }
      for (let j = 0; j <= 12; j++) L([sc.goalX, 0.02, j * 5.67], [sc.goalX - sc.dir * 42, 0.02, j * 5.67]);
      for (let r = 0; r < 3; r++) { const rr = ((t * 0.8 + r / 3) % 1) * 22; ctx.globalAlpha = 0.8 * (1 - rr / 22); ctx.lineWidth = 2.5; for (let a = 0; a < 24; a++) L([sp[0] + Math.cos(a * 0.262) * rr, 0.03, sp[2] + Math.sin(a * 0.262) * rr], [sp[0] + Math.cos((a + 1) * 0.262) * rr, 0.03, sp[2] + Math.sin((a + 1) * 0.262) * rr]); }
    } else if (key === 'sprint') { // a scorched speed lane behind the runner
      const back = mul(norm(sub([sc.goalX, 0, 34], sp)), -1);
      const perp: V3 = [-back[2], 0, back[0]];
      for (let i = 0; i < 5; i++) { const o = (i - 2) * 0.35; ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.lineWidth = 3; ctx.globalAlpha = 0.75 * Math.min(1, k * 2); L(add(sp, mul(perp, o)), add(add(sp, mul(perp, o)), mul(back, 16 + i * 2))); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9; let p0 = sp; for (let i = 1; i < 9; i++) { const p1 = add(add(sp, mul(back, i * 2)), mul(perp, (i % 2 ? 1 : -1) * 0.8)); L(p0, [p1[0], 0.05, p1[2]]); p0 = p1; }
    } else if (key === 'trance') { // the jagged path he tore through the defence
      const back = mul(norm(sub([sc.goalX, 0, 34], sp)), -1);
      const perp: V3 = [-back[2], 0, back[0]];
      let p0 = sp; ctx.lineWidth = 4;
      for (let i = 1; i < 10; i++) { const p1 = add(add(sp, mul(back, i * 1.7)), mul(perp, (i % 2 ? 1 : -1) * (1.2 + (i % 3) * 0.6))); ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = 0.85 * Math.min(1, k * 2) * (1 - i / 12); L([p0[0], 0.05, p0[2]], [p1[0], 0.05, p1[2]]); p0 = p1; }
    } else if (key === 'chain') { // links between the players who built the move
      const mates = sc.rp.pl.filter((x) => ms.pl[x[0]]?.t === sc.rp.t && x[0] !== sc.rp.gk).sort((a, b) => (a[1] - b[1]) * sc.dir).slice(-5);
      ctx.lineWidth = 3;
      for (let i = 1; i < mates.length; i++) { const a: V3 = [mates[i - 1][1] * 1.05, 0.05, mates[i - 1][2] * 0.68], b: V3 = [mates[i][1] * 1.05, 0.05, mates[i][2] * 0.68]; const on = c01(k * mates.length - i + 1); ctx.strokeStyle = us.col; ctx.globalAlpha = 0.25 + 0.7 * on; L(a, lerp3(a, b, on)); const pu = lerp3(a, b, (t * 1.5 + i * 0.2) % 1); const q = proj(cam, pu); if (q.z > NEAR) { ctx.fillStyle = '#fff'; ctx.globalAlpha = on; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, 6.3); ctx.fill(); } }
    } else if (key === 'curtain') { // an iron wall rises behind the play, then drops as he strikes
      const up = t < sc.tStrike ? k : Math.max(0, 1 - (t - sc.tStrike) * 2.2);
      const x = sp[0] - sc.dir * 5;
      for (let i = 0; i < 15; i++) { const z = sp[2] - 14 + i * 2; poly(ctx, cam, [[x, 0, z - 0.35], [x, 0, z + 0.35], [x, 4.2 * up, z + 0.35], [x, 4.2 * up, z - 0.35]], i % 2 ? '#8892a6' : '#aab6cc'); }
    } else if (key === 'dag') { // the wedge of goal he should not be able to see
      ctx.strokeStyle = us.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8 * Math.min(1, k * 2);
      L([sp[0], 0.03, sp[2]], [sc.goalX, 0.03, 34 - 3.66]); L([sp[0], 0.03, sp[2]], [sc.goalX, 0.03, 34 + 3.66]);
      poly(ctx, cam, [[sp[0], 0.02, sp[2]], [sc.goalX, 0.02, 34 - 3.66], [sc.goalX, 0.02, 34 + 3.66]], us.col + '33');
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (key === 'puppet') { // golden strings from above to every attacker
    ctx.strokeStyle = us.col; ctx.lineWidth = 1.4;
    for (const x of sc.rp.pl) { if (ms.pl[x[0]]?.t !== sc.rp.t || x[0] === sc.rp.gk) continue; const a: V3 = [x[1] * 1.05, 1.75, x[2] * 0.68]; ctx.globalAlpha = 0.75 * Math.min(1, k * 2 + fl); L(a, [a[0] + 0.6, 26, a[2] - 0.8]); L([a[0] - 0.3, 1.2, a[2]], [a[0] - 0.9, 26, a[2] + 0.5]); }
  } else if (key === 'sky') { // a column of light on the leap
    const a = proj(cam, [sp[0], 0, sp[2]]), b = proj(cam, [sp[0], 26, sp[2]]);
    if (a.z > NEAR) { const w = (cam.fl / a.z) * 1.1; const g = ctx.createLinearGradient(a.x - w, 0, a.x + w, 0); g.addColorStop(0, us.col + '00'); g.addColorStop(0.5, us.col2 + 'aa'); g.addColorStop(1, us.col + '00'); ctx.fillStyle = g; ctx.globalAlpha = 0.8 * Math.sin(Math.min(1, k * 1.2 + fl * 0.5) * Math.PI * 0.9); ctx.fillRect(a.x - w, b.y, w * 2, a.y - b.y); }
    for (let r = 0; r < 4; r++) { const y = ((t * 0.9 + r / 4) % 1) * 5; const q = proj(cam, [sp[0], y, sp[2]]); if (q.z > NEAR) { const s = cam.fl / q.z; ctx.strokeStyle = us.col; ctx.lineWidth = 2; ctx.globalAlpha = 1 - y / 5; ctx.beginPath(); ctx.ellipse(q.x, q.y, 1.2 * s, 0.4 * s, 0, 0, 6.3); ctx.stroke(); } }
  } else if (key === 'predator') { // a laser sight from his eyes to the exact spot
    ctx.strokeStyle = us.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.9 * Math.min(1, k * 1.5) * (fl < 1 ? 1 : 0.3);
    L([sp[0], 1.65, sp[2]], sc.end);
    const q = proj(cam, sc.end); if (q.z > NEAR) { const rr = (0.5 + (1 - k) * 2.6) * (cam.fl / q.z); ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, 6.3); ctx.moveTo(q.x - rr * 1.5, q.y); ctx.lineTo(q.x + rr * 1.5, q.y); ctx.moveTo(q.x, q.y - rr * 1.5); ctx.lineTo(q.x, q.y + rr * 1.5); ctx.stroke(); }
  } else if (key === 'zero' && fl > 0) { // frozen frames of the ball along its path
    for (let i = 1; i <= 6; i++) { const u = i / 7; if (u > fl) break; const p = ballAt(sc, sc.tStrike + u * sc.tFlight).p; const q = proj(cam, p); if (q.z < NEAR) continue; const r = Math.max(2.5, 0.115 * (cam.fl / q.z)); ctx.strokeStyle = us.col2; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.strokeRect(q.x - r * 1.8, q.y - r * 1.8, r * 3.6, r * 3.6); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 6.3); ctx.fill(); }
  } else if (key === 'dag' && fl > 0 && fl < 1) { // shards breaking off the ball
    const q = proj(cam, bp); if (q.z > NEAR) { const s = cam.fl / q.z; for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 6, rr = (0.3 + ((i * 37) % 10) / 14) * s; ctx.fillStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr); ctx.lineTo(q.x + Math.cos(a + 0.25) * rr * 1.5, q.y + Math.sin(a + 0.25) * rr * 1.5); ctx.lineTo(q.x + Math.cos(a + 0.5) * rr, q.y + Math.sin(a + 0.5) * rr); ctx.fill(); } }
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, W: number, H: number, ms: MatchState, sc: Scene, t: number, trail: V3[], faces: Face[]): void {
  const { rp, dir, goalX, fl } = sc;
  const b = ballAt(sc, t);
  const goalC: V3 = [goalX, 1.1, 34];
  const sdir = norm(sub([goalX, 0, 34], [sc.shot[0], 0, sc.shot[2]]));
  const impact = t - sc.tStrike - sc.tFlight;
  const tc = rp.res === 'goal' && !sc.quick ? t - sc.tCele : -1;
  const cele = tc >= 0 ? celeState(sc, tc) : null;
  const shake = rp.res === 'goal' && impact > 0 && impact < 0.35 ? (0.35 - impact) * 0.5 : 0;
  // ── camera
  let cam: Cam;
  const fu = c01((t - sc.tStrike) / sc.tFlight);
  if (cele) {
    const z = ease(c01(tc / 2.6));
    const pos = add(add(cele.pos, mul(sc.celeDir, lerp(8.5, 5.2, z))), [dir * -1.6, lerp(2.1, 1.5, z), 0]);
    cam = mkCam(pos, add(cele.pos, [0, 1.25, 0]), H * lerp(1.15, 1.5, z), W, H);
  } else if (fl.cam === 'chase' || sc.long) {
    const back = lerp(10, 6, ease(fu));
    const anchor: V3 = b.phase >= 2 ? [b.p[0], 0, b.p[2]] : [sc.shot[0], 0, sc.shot[2]];
    const pos = add(add(anchor, mul(sdir, -back)), [0, lerp(3.4, 2.3, ease(fu)) + shake * Math.sin(t * 90), sc.side * -1.2 + shake * Math.cos(t * 70)]);
    cam = mkCam(pos, lerp3(goalC, b.p, 0.25), H * lerp(1.0, 1.35, ease(fu)), W, H);
  } else if (fl.cam === 'net') {
    const pos: V3 = [goalX + dir * (5.2 - fu * 1.2), 2.4 + shake * Math.sin(t * 90), 34 - rp.gy * 2.6 + shake * Math.cos(t * 70)];
    cam = mkCam(pos, lerp3([sc.shot[0], 1, sc.shot[2]], b.p, 0.45), H * lerp(1.0, 1.25, ease(fu)), W, H);
  } else if (fl.cam === 'orbit') {
    const a = Math.atan2(-sdir[2], -sdir[0]) + sc.side * lerp(-0.9, 0.5, ease(c01(t / (sc.tStrike + sc.tFlight))));
    const rad = Math.max(8, rp.d * 0.55 + 5);
    const mid = lerp3([sc.shot[0], 0, sc.shot[2]], goalC, 0.3);
    cam = mkCam([mid[0] + Math.cos(a) * rad, 2.2 + shake * Math.sin(t * 90), mid[2] + Math.sin(a) * rad], lerp3([sc.shot[0], 1.2, sc.shot[2]], b.p, 0.5), H * 1.2, W, H);
  } else {
    const low = fl.cam === 'low';
    const prog = c01(t / (sc.tStrike + sc.tFlight + 1.5));
    const mid = lerp3([sc.shot[0], 0, sc.shot[2]], goalC, 0.55);
    const ang = lerp(low ? 1.25 : 0.95, low ? 1.05 : 0.7, ease(prog));
    const dist = Math.max(low ? 9 : 12, rp.d * (low ? 0.8 : 1.05) + (low ? 5 : 7));
    const pos: V3 = [mid[0] - dir * Math.cos(ang) * dist, (low ? 1.3 : 5.6 - prog * 1.4) + shake * Math.sin(t * 90), mid[2] - sc.side * Math.sin(ang) * dist + shake * Math.cos(t * 70)];
    cam = mkCam(pos, lerp3(mid, b.p, low ? 0.5 : 0.35), H * (low ? 1.05 : 1.25), W, H);
  }
  // ── sky + floodlights
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#04060c'); sky.addColorStop(0.55, '#0a1424'); sky.addColorStop(1, '#0c1a14');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const fx of [0.12, 0.88]) { const g = ctx.createRadialGradient(W * fx, H * 0.02, 2, W * fx, H * 0.02, H * 0.6); g.addColorStop(0, 'rgba(190,225,255,.34)'); g.addColorStop(1, 'rgba(190,225,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // ── stands on three sides
  const stand = (pts: (f: number, k: number) => V3, rows: number, cols: number, quad: V3[]) => {
    poly(ctx, cam, quad, '#0b1020');
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const q = proj(cam, pts((r + 0.5) / rows, k / (cols - 1)));
      if (q.z < 1 || q.x < -4 || q.x > W + 4 || q.y < -4 || q.y > H) continue;
      const hsh = ((r * 73 + k * 151 + cols) * 2654435761) >>> 0;
      const sz = Math.max(1.2, (cam.fl / q.z) * 0.42);
      const jump = rp.res === 'goal' && impact > 0 ? Math.abs(Math.sin(t * 9 + (hsh % 7))) * 0.5 * (cam.fl / q.z) : 0;
      ctx.fillStyle = ['#2a3a5c', '#3c4f7a', '#55698f', '#7c8db0', '#1d2740', ms.teams[rp.t].col][hsh % 6];
      ctx.fillRect(q.x - sz / 2, q.y - sz - jump, sz, sz);
    }
  };
  const sx0 = goalX + dir * 9, sx1 = goalX + dir * 24;
  stand((f, k) => [lerp(sx0, sx1, f), f * 15 + 0.8, -13 + k * 94], 9, 64, [[sx0, 0, -14], [sx0, 0, 82], [sx1, 15, 82], [sx1, 15, -14]]);
  for (const zs of [-1, 1]) { const z0 = zs < 0 ? -8 : 76, z1 = zs < 0 ? -22 : 90; stand((f, k) => [lerp(goalX - dir * 62, goalX + dir * 8, k), f * 14 + 0.8, lerp(z0, z1, f)], 8, 60, [[goalX - dir * 64, 0, z0], [goalX + dir * 9, 0, z0], [goalX + dir * 9, 14, z1], [goalX - dir * 64, 14, z1]]); }
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
  // corner flags
  for (const z of [0, 68]) { ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 2; L([goalX, 0, z], [goalX, 1.6, z]); poly(ctx, cam, [[goalX, 1.6, z], [goalX, 1.2, z], [goalX - dir * 0.6, 1.4, z]], ms.teams[rp.t].col); }
  ultFx(ctx, cam, sc, ms, t, false, b.p);
  // ── goal net
  const bulge = rp.res === 'goal' && impact > 0 ? Math.exp(-impact * 2.6) * Math.cos(impact * 13) * 0.9 + (impact < 1.5 ? 0.25 : 0) : 0;
  const netAt = sc.after;
  const netPt = (zz: number, yy: number): V3 => { const dz = zz - netAt[2], dy = yy - sc.end[1]; return [goalX + dir * (1.9 + bulge * Math.exp(-(dz * dz + dy * dy) / 2.2)), yy, zz]; };
  ctx.strokeStyle = 'rgba(235,240,255,.26)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) { const zz = 34 - 3.66 + (i / 12) * 7.32; for (let j = 0; j < 5; j++) L(netPt(zz, (j / 5) * 2.44), netPt(zz, ((j + 1) / 5) * 2.44)); L([goalX, 2.44, zz], netPt(zz, 2.44)); }
  for (let j = 0; j <= 5; j++) { const yy = (j / 5) * 2.44; for (let i = 0; i < 12; i++) L(netPt(34 - 3.66 + (i / 12) * 7.32, yy), netPt(34 - 3.66 + ((i + 1) / 12) * 7.32, yy)); L([goalX, yy, 34 - 3.66], netPt(34 - 3.66, yy)); L([goalX, yy, 34 + 3.66], netPt(34 + 3.66, yy)); }
  // ── actors (depth sorted)
  type Item = { z: number; draw: () => void };
  const items: Item[] = [];
  const sgn = Math.sign(dot(cam.r, sdir)) || 1; // which way "forwards" leans on screen
  const frontOf = (fx: number, fz: number) => fx * cam.f[0] + fz * cam.f[2] < 0.12;
  const k0 = t - sc.tStrike;
  const mates = cele ? rp.pl.filter((x) => ms.pl[x[0]]?.t === rp.t && x[0] !== rp.sh && x[0] !== rp.gk && ms.pl[x[0]].line > 0).map((x) => ({ x, d: Math.hypot(x[1] * 1.05 - sc.shot[0], x[2] * 0.68 - sc.shot[2]) })).sort((a, c2) => a.d - c2.d).slice(0, 5).map((m) => m.x[0]) : [];
  for (const [idx, px, py] of rp.pl) {
    const p = ms.pl[idx];
    if (!p) continue;
    let X = px * 1.05, Z = py * 0.68;
    const isGk = idx === rp.gk, isSh = idx === rp.sh;
    const pose: Pose = {};
    let fdx = p.t === 0 ? 1 : -1, fdz = 0;
    if (isSh) {
      if (cele) { X = cele.pos[0]; Z = cele.pos[2]; Object.assign(pose, cele.pose); pose.happy = true; fdx = sc.celeDir[0]; fdz = sc.celeDir[2]; }
      else {
        if (rp.v === 'pen') { X = sc.shot[0] - dir * 0.5; Z = 34; } else { X = sc.shot[0] - sdir[0] * 0.45; Z = sc.shot[2] - sdir[2] * 0.45; }
        const run = c01((sc.tStrike - t) / 0.9);
        X -= sdir[0] * run * 3.2; Z -= sdir[2] * run * 3.2;
        const w = c01((k0 + 0.3) / 0.75), sw = Math.sin(w * Math.PI);
        pose.kick = k0 > -0.18 && k0 < 0.3 ? Math.sin(c01((k0 + 0.18) / 0.48) * Math.PI) : run > 0 ? Math.sin(t * 16) * 0.45 : 0;
        fdx = sdir[0]; fdz = sdir[2];
        const after = c01(k0 / 0.5);
        if (fl.pose === 'bicycle') { pose.rot = -sgn * sw * 1.9; pose.lift = sw * 1.15; pose.kick = sw; pose.arms = 2; fdx = -sdir[0]; fdz = -sdir[2]; }
        else if (fl.pose === 'scissor') { pose.rot = sgn * sw * 1.15; pose.lift = sw * 0.75; pose.kick = sw; pose.arms = 2; }
        else if (fl.pose === 'dive') { const dv = c01((k0 + 0.25) / 0.8); pose.rot = sgn * Math.min(1, dv * 2.2) * 1.4; pose.lift = 0.5 + Math.sin(dv * Math.PI) * 0.45 - dv * 0.45; pose.arms = 1; X += sdir[0] * dv * 2.4; Z += sdir[2] * dv * 2.4; }
        else if (fl.pose === 'slide') { const dv = c01((k0 + 0.3) / 0.9); pose.rot = -sgn * Math.min(1, dv * 2.5) * 1.25; pose.kick = 0.8; pose.arms = 2; X += sdir[0] * dv * 2.6; Z += sdir[2] * dv * 2.6; }
        else if (fl.pose === 'heel') { fdx = -sdir[0]; fdz = -sdir[2]; pose.kick = -(pose.kick ?? 0); }
        else if (fl.pose === 'leap') { pose.lift = sw * (rp.ult === 'sky' ? 1.6 : 0.9); pose.arms = 4; }
        else if (fl.pose === 'chip') { pose.rot = -sgn * sw * 0.2; }
        else if (rp.v === 'header') { pose.lift = sw * 0.55; }
        else if (rp.v === 'volley') { pose.lift = sw * 0.35; pose.rot = sgn * sw * 0.35; }
        if (rp.res === 'goal' && impact > 0.2 && fl.pose !== 'dive' && fl.pose !== 'slide') { pose.arms = 1; pose.happy = true; pose.lift = (pose.lift ?? 0) + Math.abs(Math.sin((impact - 0.2) * 7)) * 0.3; }
        if (rp.res !== 'goal' && impact > 0.3) pose.arms = after > 0 ? 4 : 0;
      }
    } else if (isGk) {
      X = goalX - dir * 1.1;
      Z = 34 + Math.max(-3, Math.min(3, (py * 0.68 - 34) * 0.5));
      fdx = -sdir[0]; fdz = -sdir[2];
      const sgy = Math.sign(rp.gy || 1);
      if (fl.gk === 'rush') { const ru = ease(c01((t - sc.tP0) / Math.max(0.4, sc.tStrike - sc.tP0))); X -= dir * ru * Math.min(6, rp.d * 0.45); pose.arms = 2; pose.crouch = ru * 0.5; if (fu > 0.2) pose.arms = 1; }
      else if (fl.gk === 'stand') { pose.arms = 2; pose.crouch = 0.3 * c01(fu * 3); }
      else {
        const early = fl.gk === 'early';
        const want = early ? -sgy * 2.6 : rp.res === 'goal' ? rp.gy * 2.0 - sgy * 0.6 : rp.res === 'save' ? rp.gy * 2.9 : rp.gy * 1.6;
        const dd = ease(c01(((early ? fu + 0.35 : fu) - 0.25) / 0.75));
        Z = lerp(Z, 34 + want, dd);
        if (dd > 0) { pose.rot = (early ? -sgy : sgy) * cam.r[2] * dir * dd * 1.2 * (rp.res === 'block' ? 0.2 : 1); pose.lift = Math.sin(dd * Math.PI) * 0.45 + (rp.res === 'save' ? dd * rp.gz * 0.9 : 0); pose.arms = 1; }
      }
      if (rp.res === 'goal' && impact > 0.5 && !cele) pose.crouch = 0.6;
    } else if (p.t !== rp.t) {
      const k = ease(c01(t / sc.tStrike)) * 0.9;
      const dx = sc.shot[0] - X, dz = sc.shot[2] - Z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
      const mv = Math.min(2.2, dd * 0.25) * k;
      X += (dx / dd) * mv; Z += (dz / dd) * mv;
      fdx = dx / dd; fdz = dz / dd;
      if (dd < 4 && k0 > -0.2 && k0 < 0.4 && rp.res === 'block') { pose.kick = 0.8; pose.rot = sgn * 0.5; }
      if (rp.res === 'goal' && impact > 0.6) pose.crouch = 0.25;
    } else {
      if (idx === rp.as && !cele) pose.kick = t > sc.tP0 - 0.15 && t < sc.tP0 + 0.3 ? Math.sin(c01((t - sc.tP0 + 0.15) / 0.45) * Math.PI) * 0.7 : 0;
      if (cele && mates.includes(idx)) {
        const mi = mates.indexOf(idx), lat = (mi - 2) * 1.25, bk = 1.5 + (mi % 2) * 0.9 + Math.abs(mi - 2) * 0.25;
        const tx = cele.pos[0] - sc.celeDir[0] * bk - sc.celeDir[2] * lat, tz = cele.pos[2] - sc.celeDir[2] * bk + sc.celeDir[0] * lat;
        const e = ease(c01((tc - 0.3 - mi * 0.12) / 1.9));
        X = lerp(X, tx, e); Z = lerp(Z, tz, e);
        fdx = cele.pos[0] - X; fdz = cele.pos[2] - Z;
        pose.arms = e > 0.85 ? 1 : 4; pose.happy = true; pose.kick = e < 0.95 ? Math.sin(t * 15 + mi) * 0.45 : 0; pose.lift = e > 0.9 ? Math.abs(Math.sin(t * 8 + mi)) * 0.25 : 0;
      } else if (rp.res === 'goal' && impact > 0.3) { pose.arms = 1; pose.happy = true; pose.lift = Math.abs(Math.sin((impact - 0.3) * 6 + idx)) * 0.25; }
    }
    pose.front = frontOf(fdx, fdz);
    pose.num = p.num;
    pose.ring = p.user ? '#3df2ff' : isSh && !cele ? 'rgba(255,255,255,.75)' : undefined;
    const q = proj(cam, [X, 0, Z]);
    const col = isGk ? (lum(ms.teams[p.t].col) > 0.5 ? '#16a34a' : '#f5d90a') : ms.teams[p.t].col;
    const col2 = isGk ? '#1b1b1b' : ms.teams[p.t].col2 || '#111827';
    const face = faces[idx] ?? { skin: '#e0ac86', hair: '#16181d', style: 0, beard: false };
    // afterimages for the dribbling ultimates
    if (isSh && !cele && (rp.ult === 'trance' || rp.ult === 'sprint') && t < sc.tStrike + 0.2) for (let gi = 1; gi <= 3; gi++) { const gx = X - sdir[0] * gi * 1.1, gz2 = Z - sdir[2] * gi * 1.1 + (rp.ult === 'trance' ? (gi % 2 ? 0.7 : -0.7) : 0); items.push({ z: proj(cam, [gx, 0, gz2]).z, draw: () => drawPlayer(ctx, cam, gx, gz2, ULT_STYLE[rp.ult!]?.col ?? col, col2, face, { ...pose, ring: undefined, alpha: 0.34 - gi * 0.08 }) }); }
    items.push({ z: q.z, draw: () => drawPlayer(ctx, cam, X, Z, col, col2, face, pose) });
  }
  items.push({ z: proj(cam, [goalX, 1.2, 34]).z + 0.2, draw: () => {
    ctx.strokeStyle = '#f4f6fb'; ctx.lineWidth = Math.max(2, (cam.fl / Math.max(2, proj(cam, [goalX, 1.2, 34]).z)) * 0.12); ctx.lineCap = 'round';
    L([goalX, 0, 34 - 3.66], [goalX, 2.44, 34 - 3.66]); L([goalX, 0, 34 + 3.66], [goalX, 2.44, 34 + 3.66]); L([goalX, 2.44, 34 - 3.66], [goalX, 2.44, 34 + 3.66]);
    ctx.lineCap = 'butt';
  } });
  // ball + trail
  if (b.phase >= 2 && (trail.length === 0 || Math.abs(trail[trail.length - 1][0] - b.p[0]) + Math.abs(trail[trail.length - 1][2] - b.p[2]) + Math.abs(trail[trail.length - 1][1] - b.p[1]) > 0.05)) { trail.push([b.p[0], b.p[1], b.p[2]]); if (trail.length > (sc.long ? 60 : 26)) trail.shift(); }
  const bq = proj(cam, b.p);
  const us = rp.ult ? ULT_STYLE[rp.ult] : null;
  if (!cele || tc < 0.4) items.push({ z: bq.z, draw: () => {
    const sh = proj(cam, [b.p[0], 0, b.p[2]]);
    const s = cam.fl / Math.max(0.6, bq.z);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, Math.max(2, 0.2 * s), Math.max(1, 0.07 * s), 0, 0, 6.3); ctx.fill();
    for (let i = 1; i < trail.length; i++) {
      const a = proj(cam, trail[i - 1]), c2 = proj(cam, trail[i]);
      if (a.z < NEAR || c2.z < NEAR) continue;
      const al = i / trail.length;
      ctx.strokeStyle = us ? (i % 2 ? us.col : us.col2) : fl.fire ? `rgba(255,${Math.round(120 + al * 110)},40,${al * 0.9})` : sc.long ? `rgba(61,242,255,${al * 0.75})` : `rgba(255,255,255,${al * 0.45})`;
      ctx.globalAlpha = us ? al * 0.85 : 1;
      ctx.lineWidth = Math.max(1, al * (us ? 0.34 : fl.fire ? 0.3 : sc.long ? 0.2 : 0.12) * (cam.fl / c2.z));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const r = Math.max(2.4, 0.115 * s);
    if ((sc.long || fl.fire || us) && b.phase === 2) { const gc = us ? us.col : fl.fire ? '#ff8a3d' : '#3df2ff'; const g = ctx.createRadialGradient(bq.x, bq.y, r * 0.5, bq.x, bq.y, r * 4.5); g.addColorStop(0, gc + '99'); g.addColorStop(1, gc + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bq.x, bq.y, r * 4.5, 0, 6.3); ctx.fill(); }
    const g2 = ctx.createRadialGradient(bq.x - r * 0.3, bq.y - r * 0.35, r * 0.1, bq.x, bq.y, r);
    g2.addColorStop(0, '#fff'); g2.addColorStop(1, '#aab3c2');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(bq.x, bq.y, r, 0, 6.3); ctx.fill();
    if (r > 4) { ctx.fillStyle = '#1c1f26'; const a = fl.wob ? 0.4 : t * 14; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(bq.x + Math.cos(a + k * 2.1) * r * 0.5, bq.y + Math.sin(a + k * 2.1) * r * 0.5, r * 0.2, 0, 6.3); ctx.fill(); } }
  } });
  items.sort((a, c2) => c2.z - a.z);
  for (const it of items) if (it.z > NEAR) it.draw();
  ultFx(ctx, cam, sc, ms, t, true, b.p);
  // ── ultimate charge-up aura and shockwave
  if (us && !cele) {
    const ch = c01((t - (sc.tStrike - 0.85)) / 0.85);
    const fq = proj(cam, [sc.shot[0] - sdir[0] * 0.45, 0.9, sc.shot[2] - sdir[2] * 0.45]);
    const s = cam.fl / Math.max(1, fq.z);
    if (t < sc.tStrike && ch > 0 && fq.z > NEAR) {
      ctx.fillStyle = `rgba(2,3,10,${0.42 * ch})`; ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < 4; r++) { const k = (ch * 2.2 + r / 4) % 1; ctx.strokeStyle = r % 2 ? us.col : us.col2; ctx.globalAlpha = (1 - k) * 0.9; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fq.x, fq.y + 0.9 * s, (0.4 + 2.6 * (1 - k)) * s, (0.14 + 0.9 * (1 - k)) * s, 0, 0, 6.3); ctx.stroke(); }
      const g = ctx.createRadialGradient(fq.x, fq.y, 2, fq.x, fq.y, 2.4 * s); g.addColorStop(0, us.col + 'cc'); g.addColorStop(1, us.col + '00'); ctx.fillStyle = g; ctx.globalAlpha = ch * 0.7; ctx.beginPath(); ctx.arc(fq.x, fq.y, 2.4 * s, 0, 6.3); ctx.fill();
      for (let i = 0; i < 14; i++) { const a = i * 0.449 + t * 3, yy = (t * 1.6 + i * 0.13) % 1; ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.lineWidth = 2; ctx.globalAlpha = 1 - yy; ctx.beginPath(); ctx.moveTo(fq.x + Math.cos(a) * 0.9 * s, fq.y + 0.9 * s - yy * 2.6 * s); ctx.lineTo(fq.x + Math.cos(a) * 0.9 * s, fq.y + 0.9 * s - yy * 2.6 * s - 0.35 * s); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (k0 > 0 && k0 < 0.5 && fq.z > NEAR) { ctx.strokeStyle = us.col2; ctx.globalAlpha = 1 - k0 / 0.5; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(fq.x, fq.y + 0.8 * s, k0 * 9 * s, k0 * 3.2 * s, 0, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; if (k0 < 0.12) { ctx.fillStyle = `rgba(255,255,255,${(0.12 - k0) * (rp.ult === 'zero' ? 8 : 4)})`; ctx.fillRect(0, 0, W, H); } }
  }
  // ── post effects
  if ((sc.long || fl.fire) && b.phase === 2) {
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.283 + Math.floor(t * 30) * 0.37; const r0 = H * 0.42 + ((k * 37) % 50), r1 = r0 + 60 + ((k * 91) % 90); ctx.beginPath(); ctx.moveTo(bq.x + Math.cos(a) * r0, bq.y + Math.sin(a) * r0); ctx.lineTo(bq.x + Math.cos(a) * r1, bq.y + Math.sin(a) * r1); ctx.stroke(); }
  }
  if (rp.res === 'goal' && impact > 0.1) { // ticker tape in the scoring team's colours
    const cols = [ms.teams[rp.t].col, '#ffffff', ms.teams[rp.t].col2 || '#3df2ff', us?.col ?? '#ffd166'];
    for (let i = 0; i < 70; i++) { const sp = 0.25 + ((i * 53) % 40) / 80; const y = (((impact - 0.1) * sp + ((i * 97) % 100) / 100) % 1.15) * H; const x = ((i * 137.5) % 100) / 100 * W + Math.sin(impact * 3 + i) * 14; ctx.fillStyle = cols[i % 4]; ctx.globalAlpha = Math.min(0.9, (impact - 0.1) * 2); ctx.save(); ctx.translate(x, y); ctx.rotate(impact * 5 + i); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (rp.res === 'goal' && impact > 0 && impact < 0.3) { ctx.fillStyle = `rgba(255,255,255,${(0.3 - impact) * 1.6})`; ctx.fillRect(0, 0, W, H); }
  if (cele && tc < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - tc / 0.25})`; ctx.fillRect(0, 0, W, H); }
  if (sc.long || us || cele) { const bar = H * 0.085 * ease(c01(t / 0.4)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
}

export function Replay3D({ ms, rp, onClose, auto, quick, g }: { ms: MatchState; rp: Replay; onClose?: () => void; auto?: boolean; quick?: boolean; g?: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0); // 0 playing, 1 result shown, 2 celebration, 3 finished
  const sc = buildScene(rp, quick);
  const faces = useMemo<Face[]>(() => ms.pl.map((p) => { const wp = g?.world.players[p.id]; const mine = !!g && p.id === g.career.pid; return lookColours(mine ? g!.career.look : lookFor(p.id), mine && !g!.career.flags.playAs ? undefined : wp?.hair); }), [ms, g]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0, t0 = 0, last = -1, st = 0, closed = false;
    const trail: V3[] = [];
    setStage(0);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w < 40 || h < 30) { raf = requestAnimationFrame(frame); return; }
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const t = Math.min(sc.tEnd, (now - t0) / 1000);
      if (t !== last) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render(ctx, w, h, ms, sc, t, trail, faces); last = t; }
      const ns = t >= sc.tEnd ? 3 : rp.res === 'goal' && !sc.quick && t >= sc.tCele ? 2 : t >= sc.tStrike + sc.tFlight ? 1 : 0;
      if (ns !== st) { st = ns; setStage(ns); }
      if (t < sc.tEnd) raf = requestAnimationFrame(frame);
      else if (auto && onClose && !closed) { closed = true; setTimeout(onClose, quick ? 250 : 700); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.id, run, ms]);
  const sh = ms.pl[rp.sh], as = rp.as >= 0 ? ms.pl[rp.as] : null;
  const us = rp.ult ? ULT_STYLE[rp.ult] : null;
  return (
    <div className={`replay3d ${sc.long || us ? 'long' : ''}`}>
      <canvas ref={ref} aria-label={`3D view: ${sh?.nm} ${RES_LABEL[rp.res].toLowerCase()} in minute ${rp.min}`} />
      <div className="rp-top"><span className="rp-live"><i />{auto ? 'LIVE · 3D' : 'REPLAY'}</span><span className="rp-min">{rp.min}'</span><span className="rp-tag" style={us ? { background: us.col } : undefined}>{sc.fl.name.toUpperCase()}{sc.long ? ` · ${Math.round(rp.d)} M` : ''}</span>{us && <span className="rp-tag ult" style={{ background: us.col2 }}>{(ULT_NAME[rp.ult!] ?? 'ULTIMATE').toUpperCase()}</span>}{rp.ab && !us && <span className="rp-min">{rp.ab}</span>}</div>
      <div className="rp-info">
        <div><b>{sh?.nm}</b>{as ? <span className="muted"> · assist {as.nm}</span> : null}</div>
        <div className="small">{stage === 2 ? `Celebration — ${CELE[sc.cele]}` : `${sc.fl.name} · ${Math.round(rp.d)} m · xG ${rp.xg.toFixed(2)} · chance ${Math.round(rp.p * 100)}%`}</div>
      </div>
      {stage === 1 && <div className={`rp-res ${rp.res}`} key={run}>{RES_LABEL[rp.res]}{rp.res === 'goal' ? <small>{ms.teams[0].abbr} {rp.sc[0]}–{rp.sc[1]} {ms.teams[1].abbr}</small> : null}</div>}
      {stage === 2 && <div className="rp-cele" key={'c' + run}><b>{sh?.nm}</b><span>{ms.teams[0].abbr} {rp.sc[0]}–{rp.sc[1]} {ms.teams[1].abbr} · {rp.min}'</span></div>}
      <div className="rp-btns">
        <button className="btn sm" onClick={() => setRun((x) => x + 1)}>⟲ Again</button>
        {onClose && <button className="btn sm pri" onClick={onClose}>{stage >= 3 ? 'Continue ▶' : 'Skip ▶'}</button>}
      </div>
    </div>
  );
}

/** A compact list of the replays stored for a match with an inline 3D player. */
export function ReplayList({ ms, g }: { ms: MatchState; g?: Game }) {
  const [sel, setSel] = useState<number | null>(null);
  const list = ms.replays ?? [];
  if (!list.length) return <p className="small muted">No replays were recorded for this match (replays are captured in interactive and highlights modes).</p>;
  const cur = list.find((r) => r.id === sel) ?? null;
  return (
    <div>
      {cur && <div className="mb" style={{ maxWidth: 900 }}><Replay3D ms={ms} rp={cur} g={g} onClose={() => setSel(null)} /></div>}
      <div className="row wrap gap6">{list.map((r) => <button key={r.id} className={`btn sm ${sel === r.id ? 'pri' : ''}`} onClick={() => setSel(r.id)}>{r.min}' {r.res === 'goal' ? '⚽' : r.res === 'save' ? '🧤' : r.res === 'post' ? '🥅' : '✕'} {ms.pl[r.sh]?.nm} · {pickFlair(r).name}</button>)}</div>
    </div>
  );
}
