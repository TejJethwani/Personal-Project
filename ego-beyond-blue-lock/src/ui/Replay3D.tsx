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
import { lookOf, hasLook } from '../engine/data/looks';
import { lookColours, type FaceSpec } from './kit';
import { ULT_STYLE, ULT_NAME } from './UltCutIn';
import { clubKit, nationKit, paintKit, matchKits, type Kit } from '../engine/data/kits';
import { NATIONS } from '../engine/data/nations';
/** The kit a team wears (patterns for clubs, traditional colours for nations). */
export function teamKit(id: string, col: string, col2: string): Kit { return NATIONS[id] ? nationKit(id) : clubKit(id, [col, col2]); }
/** Both teams' kits for a match, with an away kit when they clash. */
export function msKits(ms: { teams: { id: string; col: string; col2: string }[] }): [Kit, Kit] { return matchKits(teamKit(ms.teams[0].id, ms.teams[0].col, ms.teams[0].col2), teamKit(ms.teams[1].id, ms.teams[1].col, ms.teams[1].col2)); }

export type V3 = [number, number, number];
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

export interface Cam { p: V3; r: V3; u: V3; f: V3; fl: number; cx: number; cy: number }
export function mkCam(pos: V3, tgt: V3, fl: number, w: number, h: number): Cam {
  const f = norm(sub(tgt, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { p: pos, r, u, f, fl, cx: w / 2, cy: h / 2 };
}
const toCam = (c: Cam, P: V3): V3 => { const d = sub(P, c.p); return [dot(d, c.r), dot(d, c.u), dot(d, c.f)]; };
const NEAR = 0.4;
export function proj(c: Cam, P: V3): { x: number; y: number; z: number } {
  const q = toCam(c, P);
  const z = Math.max(q[2], 0.01);
  return { x: c.cx + (q[0] / z) * c.fl, y: c.cy - (q[1] / z) * c.fl, z: q[2] };
}
export function poly(ctx: CanvasRenderingContext2D, c: Cam, pts: V3[], fill: string | CanvasGradient, stroke?: string): void {
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
export function line(ctx: CanvasRenderingContext2D, c: Cam, a: V3, b: V3): void {
  let A = toCam(c, a), B = toCam(c, b);
  if (A[2] < NEAR && B[2] < NEAR) return;
  if (A[2] < NEAR) { const t = (NEAR - A[2]) / (B[2] - A[2]); A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR]; }
  if (B[2] < NEAR) { const t = (NEAR - B[2]) / (A[2] - B[2]); B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, NEAR]; }
  ctx.beginPath();
  ctx.moveTo(c.cx + (A[0] / A[2]) * c.fl, c.cy - (A[1] / A[2]) * c.fl);
  ctx.lineTo(c.cx + (B[0] / B[2]) * c.fl, c.cy - (B[1] / B[2]) * c.fl);
  ctx.stroke();
}


export interface Face extends FaceSpec { capP?: Path2D; topP?: Path2D }
export interface Pose { rot?: number; lift?: number; kick?: number; arms?: number; crouch?: number; front?: boolean; happy?: boolean; ring?: string; num?: number; alpha?: number;
  /** lean in world space: unit direction on the ground and angle from vertical (drawn correctly from any camera) */
  lean?: { dx: number; dz: number; a: number };
  /** facing direction on the ground: decides which way legs and arms swing on screen */
  fx?: number; fz?: number;
  runPh?: number; // running cycle phase
  strike?: number; // 0..1 through a kicking motion (back-swing → contact at 0.45 → follow-through)
  heel?: boolean; // the kick is a back-heel
  glow?: string; // eye glow colour (ultimates)
  kit?: Kit; // shirt pattern
}
const ARM: [number, number, number][] = [[0.14, 0.14, 0.25], [2.85, 2.85, 0.2], [1.7, 1.7, 0.1], [0.35, 2.95, 0.2], [2.2, 2.2, 0.9]]; // down, up, wide, point, half-up (left, right, elbow)

export function drawPlayer(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, col: string, col2: string, f: Face, o: Pose): void {
  const foot = proj(c, [X, o.lift ?? 0, Z]);
  const g = proj(c, [X, 0, Z]);
  if (g.z < 0.8) return;
  const s = c.fl / g.z;
  ctx.globalAlpha = (o.alpha ?? 1) * 0.38; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.5 * s, 0.17 * s, 0, 0, 6.3); ctx.fill();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(1.2, 0.06 * s); ctx.beginPath(); ctx.ellipse(g.x, g.y, 0.75 * s, 0.26 * s, 0, 0, 6.3); ctx.stroke(); }
  let rot = o.rot ?? 0;
  if (o.lean && o.lean.a) { const h = proj(c, [X + o.lean.dx * Math.sin(o.lean.a) * 1.7, (o.lift ?? 0) + Math.cos(o.lean.a) * 1.7, Z + o.lean.dz * Math.sin(o.lean.a) * 1.7]); rot += Math.atan2(h.x - foot.x, -(h.y - foot.y)); }
  // which way is "forwards" on screen
  let fw = 1;
  if (o.fx != null && o.fz != null) { const q = proj(c, [X + o.fx, 0, Z + o.fz]); fw = q.x >= g.x ? 1 : -1; }
  ctx.save();
  ctx.translate(foot.x, foot.y);
  if (rot) ctx.rotate(rot);
  const cr = 1 - (o.crouch ?? 0) * 0.5;
  const TH = 0.44 * cr * s, SHN = 0.42 * cr * s;
  // ── leg angles: [hip, knee] for the standing and the kicking leg
  let hL = 0.06, kL = 0.08 + (o.crouch ?? 0) * 1.2, hR = -0.06, kR = 0.08 + (o.crouch ?? 0) * 1.2;
  if (o.crouch) { hL = 0.75 * o.crouch; hR = 0.55 * o.crouch; }
  if (o.runPh != null) { const p = o.runPh; hL = Math.sin(p) * 0.75; kL = Math.max(0, -Math.cos(p)) * 1.15 + 0.15; hR = -Math.sin(p) * 0.75; kR = Math.max(0, Math.cos(p)) * 1.15 + 0.15; }
  if (o.strike != null) {
    const w = o.strike;
    if (o.heel) { const u = Math.min(1, w / 0.6); hR = 0.35 - 1.25 * u; kR = 0.25 + 1.35 * u; hL = 0.12; kL = 0.2; }
    else if (w < 0.45) { const u = w / 0.45; hR = -0.95 * u; kR = 1.55 * u; hL = 0.2 * u; kL = 0.25 * u; }
    else { const u = (w - 0.45) / 0.55, e = u * u * (3 - 2 * u); hR = -0.95 + 2.25 * e; kR = 1.55 * (1 - u) * (1 - u); hL = 0.2 - 0.35 * e; kL = 0.25; }
  } else if (o.kick) { hR = o.kick * 0.9; kR = Math.max(0, -o.kick) * 1.2 + 0.1; hL = -o.kick * 0.4; }
  const hipY = -(Math.cos(hL) * TH + SHN * Math.cos(hL - kL) + Math.cos(hR) * TH + SHN * Math.cos(hR - kR)) / 2;
  const hip = Math.min(-0.35 * s, hipY);
  const limb = (x0: number, y0: number, a1: number, l1: number, a2: number, l2: number, w: number, c1: string, c2: string, tip?: string) => {
    const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1, x2 = x1 + Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
    ctx.lineCap = 'round'; ctx.lineWidth = w;
    ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (tip) { ctx.fillStyle = tip; ctx.beginPath(); ctx.ellipse(x2 + fw * w * 0.35, y2, w * 0.75, w * 0.5, 0, 0, 6.3); ctx.fill(); }
  };
  const legW = Math.max(1.5, 0.125 * s);
  // far leg first, then the near (kicking) leg
  limb(-fw * 0.07 * s, hip, fw * hL, TH, fw * (hL - kL), SHN, legW, f.skin, col2, '#f2f4f8');
  limb(fw * 0.07 * s, hip, fw * hR, TH, fw * (hR - kR), SHN, legW, f.skin, col2, '#f2f4f8');
  ctx.lineCap = 'butt';
  ctx.fillStyle = col2; ctx.beginPath(); ctx.roundRect(-0.2 * s, hip - 0.2 * s, 0.4 * s, 0.3 * s, 0.05 * s); ctx.fill();
  // ── arms
  const sh = hip - 0.66 * s;
  const armW = Math.max(1.3, 0.09 * s);
  const [aL, aR, el] = ARM[o.arms ?? 0];
  for (const sd of [-1, 1]) {
    const sleeve = o.kit?.pat === 'sleeves' ? o.kit.c2 : shade(col, -0.14);
    if (o.runPh != null && !o.arms) { const th = (sd < 0 ? -1 : 1) * Math.sin(o.runPh) * 0.8; limb(sd * 0.27 * s, sh, fw * th, 0.27 * s, fw * (th + 1.25), 0.24 * s, armW, sleeve, f.skin); }
    else { const A = sd < 0 ? aL : aR; limb(sd * 0.27 * s, sh, sd * A, 0.27 * s, sd * (A + (A > 1.5 ? -el : el)), 0.25 * s, armW, sleeve, f.skin); }
  }
  ctx.lineCap = 'butt';
  const gr = ctx.createLinearGradient(-0.24 * s, 0, 0.24 * s, 0);
  gr.addColorStop(0, col); gr.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.roundRect(-0.24 * s, hip - 0.72 * s, 0.48 * s, 0.58 * s, 0.08 * s); ctx.fill();
  if (o.kit && o.kit.pat !== 'plain' && o.kit.pat !== 'sleeves' && s > 6) { ctx.save(); ctx.clip(); paintKit(ctx, o.kit, -0.24 * s, hip - 0.72 * s, 0.48 * s, 0.58 * s); const sg = ctx.createLinearGradient(-0.24 * s, 0, 0.24 * s, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = sg; ctx.fillRect(-0.24 * s, hip - 0.72 * s, 0.48 * s, 0.58 * s); ctx.restore(); }
  if (o.num && s > 15) { ctx.fillStyle = lum(col) > 0.6 ? '#111' : '#fff'; ctx.font = `700 ${Math.round(0.3 * s)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(o.num), 0, hip - 0.32 * s); }
  // ── head: the same face as the player's portrait (portrait geometry scaled onto the head)
  const hy = hip - 0.9 * s, r = 0.17 * s;
  const front = o.front !== false;
  ctx.fillStyle = f.skin; ctx.fillRect(-r * 0.32, hy + r * 0.55, r * 0.64, r * 0.75);
  ctx.save();
  ctx.translate(0, hy); ctx.scale(r / 28, r / 28); ctx.translate(-50, -48);
  const hs = shade(f.hair, -0.25);
  if (!f.bald && f.long) { ctx.fillStyle = hs; ctx.fillRect(50 - f.fw - 5, 44, 2 * f.fw + 10, 44); }
  if (!f.bald && f.big) { ctx.fillStyle = hs; ctx.beginPath(); ctx.ellipse(50, 40, f.fw + 14, 31, 0, 0, 6.3); ctx.fill(); }
  if (f.knot) { ctx.fillStyle = hs; ctx.beginPath(); ctx.arc(50, 12, 8, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = f.skin;
  ctx.beginPath(); ctx.ellipse(50 - f.fw, 50, 4, 7, 0, 0, 6.3); ctx.ellipse(50 + f.fw, 50, 4, 7, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = front || f.bald ? f.skin : f.hair;
  ctx.beginPath(); ctx.ellipse(50, 48, f.fw, 30, 0, 0, 6.3); ctx.fill();
  if (front && r > 2.2) {
    if (f.beard === 1 || f.beard === 3 || f.beard === 5) { ctx.fillStyle = f.hair; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (f.beard === 1 ? 0.28 : 0.92); ctx.beginPath(); ctx.ellipse(50, 48, f.fw - 0.5, 29.5, 0, 0.18, Math.PI - 0.18); ctx.quadraticCurveTo(50, f.beard === 5 ? 76 : 60, 50 + (f.fw - 0.5) * Math.cos(0.18), 48 + 29.5 * Math.sin(0.18)); ctx.fill(); ctx.globalAlpha = ga; }
    if (f.beard === 2 || f.beard === 6) { ctx.fillStyle = f.hair; ctx.beginPath(); ctx.moveTo(43, 70); ctx.quadraticCurveTo(50, f.beard === 2 ? 84 : 78, 57, 70); ctx.fill(); }
    if (f.beard === 4) { ctx.fillStyle = f.hair; ctx.fillRect(41, 61, 18, 3.4); }
    if (r > 3.6) {
      for (const sd of [-1, 1]) {
        const ex = 50 + sd * 11;
        if (o.glow) { const gg = ctx.createRadialGradient(ex, 49, 0, ex, 49, 16); gg.addColorStop(0, o.glow); gg.addColorStop(1, o.glow + '00'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ex, 49, 16, 0, 6.3); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 49, 6.4, o.happy ? 3 : o.glow ? 3.2 : 4.4, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = o.glow ?? f.eye; ctx.beginPath(); ctx.arc(ex, 49, 3.3, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, 49, 1.4, 0, 6.3); ctx.fill();
        ctx.strokeStyle = lum(f.hair) > 0.7 ? '#9aa0ad' : f.hair; ctx.lineWidth = f.brows === 3 ? 4.2 : f.brows === 4 ? 1.8 : 2.8; ctx.lineCap = 'round'; ctx.beginPath();
        const ang = o.glow || f.brows === 1 ? -3.4 : f.brows === 2 ? 2.4 : o.happy ? 1.2 : 0;
        ctx.moveTo(ex - sd * 6.5, 41 - ang * 0.9 * -1 * 0 + (ang < 0 ? 2.6 : ang > 0 ? -1.5 : 0)); ctx.lineTo(ex + sd * 6.5, 41 + (ang < 0 ? -2.6 : ang > 0 ? 1 : 0)); ctx.stroke(); ctx.lineCap = 'butt';
      }
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(48, 58); ctx.quadraticCurveTo(50, 61, 52, 58); ctx.stroke();
      ctx.strokeStyle = '#7a2f2f'; ctx.fillStyle = '#4a1414'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (o.happy) { ctx.moveTo(43, 65); ctx.quadraticCurveTo(50, 77, 57, 65); ctx.closePath(); ctx.fill(); }
      else if (o.glow) { ctx.moveTo(43, 67); ctx.quadraticCurveTo(51, 70, 58, 64); ctx.stroke(); }
      else if (f.mouth === 2) { ctx.moveTo(43, 68); ctx.quadraticCurveTo(50, 65, 57, 68); ctx.stroke(); }
      else { ctx.moveTo(43, 66); ctx.quadraticCurveTo(50, f.mouth === 1 ? 66 : 70, 57, 66); ctx.stroke(); }
      if (f.acc === 2) { ctx.strokeStyle = '#dfe7ff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(39, 49, 8.5, 0, 6.3); ctx.moveTo(69.5, 49); ctx.arc(61, 49, 8.5, 0, 6.3); ctx.moveTo(47.5, 49); ctx.lineTo(52.5, 49); ctx.stroke(); }
      if (f.acc === 9) { ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(200,225,255,.12)'; for (const x0 of [31, 54]) { ctx.beginPath(); ctx.roundRect(x0, 44, 15, 10, 3); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(46, 48.5); ctx.quadraticCurveTo(50, 46, 54, 48.5); ctx.moveTo(31, 47); ctx.lineTo(26, 45.5); ctx.moveTo(69, 47); ctx.lineTo(74, 45.5); ctx.stroke(); }
      if (f.acc === 7) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(61, 49, 8, 6.5, 0, 0, 6.3); ctx.fill(); }
      if (f.acc === 8) { ctx.fillStyle = '#e8edf5'; ctx.beginPath(); ctx.ellipse(50, 62, f.fw - 4, 13, 0, 0, Math.PI); ctx.fill(); }
    } else { ctx.fillStyle = o.glow ?? '#16181d'; ctx.fillRect(36, 46, 7, 6); ctx.fillRect(57, 46, 7, 6); }
  }
  if (!f.bald) {
    ctx.fillStyle = f.hair;
    if (f.capP && front) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * f.capOp; ctx.fill(f.capP); ctx.globalAlpha = ga; }
    if (f.topP) ctx.fill(f.topP);
  }
  if (f.acc === 1 || f.acc === 3) { ctx.fillStyle = f.acc === 1 ? '#fff' : col; ctx.fillRect(50 - f.fw - 1, 34, 2 * f.fw + 2, 5); }
  if (f.acc === 5) { ctx.fillStyle = '#c1272d'; ctx.beginPath(); ctx.moveTo(50 - f.fw - 2, 38); ctx.quadraticCurveTo(50, 26, 50 + f.fw + 2, 38); ctx.lineTo(50 + f.fw + 2, 30); ctx.quadraticCurveTo(50, 18, 50 - f.fw - 2, 30); ctx.fill(); }
  ctx.restore();
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

const FALLBACK_FACE: Face = { skin: '#e0ac86', hair: '#16181d', fw: 26, cap: null, top: null, capOp: 1, long: false, big: false, knot: false, bald: false, eye: '#2b2b2b', brows: 0, beard: 0, acc: 0, mouth: 0 };
const RES_LABEL: Record<Replay['res'], string> = { goal: 'GOAL', save: 'SAVED', off: 'OFF TARGET', post: 'OFF THE WOODWORK', block: 'BLOCKED' };

// ── finish types: each has its own trajectory, body shape, keeper reaction and camera ──
type PoseK = 'std' | 'bicycle' | 'scissor' | 'dive' | 'slide' | 'heel' | 'leap' | 'chip';
interface Flair { top?: boolean; name: string; arc: number; curl: number; wob: number; speed: number; pose: PoseK; gk: 'dive' | 'rush' | 'early' | 'stand'; cam: 'side' | 'net' | 'low' | 'chase' | 'orbit'; postIn?: boolean; fire?: boolean; chipH?: number; curlOut?: boolean }
const FL = (name: string, o: Partial<Flair> = {}): Flair => ({ name, arc: 0.35, curl: 0.5, wob: 0, speed: 1, pose: 'std', gk: 'dive', cam: 'side', ...o });
export function pickFlair(rp: Replay): Flair {
  const f = pickFlair0(rp);
  // ultimates are shown from the side so their effects stay in view
  if (rp.ult && f.cam === 'net') f.cam = 'side';
  // a keeper who has come out or stands still can only be beaten, never "save" from where he is not
  if (rp.res === 'save' || rp.res === 'block') { f.gk = 'dive'; f.chipH = undefined; if (f.arc > 1.5) f.arc = 0.6; if (f.speed < 0.9) f.speed = 1; }
  if (rp.res !== 'goal') { f.top = false; f.postIn = false; }
  return f;
}
function pickFlair0(rp: Replay): Flair {
  const h = ((rp.id * 2654435761) ^ Math.round(rp.d * 97) ^ (rp.min * 131)) >>> 0;
  const r = rp.fr ?? (h >>> 7) % 100;
  const d = rp.d, ag = Math.abs(rp.gy), goal = rp.res === 'goal';
  if (rp.v === 'pen') return ag < 0.3 && rp.gz > 0.45 && goal ? FL('Panenka', { arc: 2.4, speed: 0.5, gk: 'early', cam: 'net', chipH: 1.3 }) : FL('Penalty', { cam: 'net', speed: 1.2 });
  if (rp.v.startsWith('dag')) return FL('Dead Angle Genesis', { pose: 'bicycle', cam: 'orbit', curl: 1.6, arc: 0.9 });
  if (rp.ult === 'crescent') return FL('Crescent Strike', { curlOut: true, curl: 5.5 + d * 0.22, arc: 0.9, cam: 'chase', speed: 0.85, top: r % 2 === 0 });
  if (d > 14 && goal && r >= 96) return FL('Impossible bend', { curlOut: true, curl: 4 + d * 0.18, arc: 0.8, cam: 'chase', speed: 0.88 });
  if (rp.v === 'fk') return r % 2 ? FL('Free-kick curler', { curl: d * 0.1, arc: d * 0.09, cam: 'chase' }) : FL('Free kick round the wall', { curl: d * 0.13, arc: d * 0.08, cam: 'chase', curlOut: true });
  if (rp.v === 'header') return d < 8 && r < 55 ? FL('Diving header', { pose: 'dive', cam: 'low', arc: 0.1 }) : FL('Towering header', { pose: 'leap', arc: 0.2, cam: r < 50 ? 'side' : 'net' });
  if (rp.v === 'volley') return r < 36 && d < 17 ? FL('Bicycle kick', { pose: 'bicycle', cam: 'orbit', arc: 0.8 }) : r < 68 ? FL('Scissor volley', { pose: 'scissor', cam: 'low', arc: 0.5 }) : FL('Volley', { arc: 0.6, speed: 1.2 });
  if (d > 18 && r < 20) return FL('Banana shot', { curl: d * 0.26, arc: d * 0.085, cam: 'chase', top: true, speed: 0.9, curlOut: r % 2 === 0 });
  if (d > 18) return r < 36 ? FL('Knuckleball', { wob: 1, arc: d * 0.03, curl: 0, cam: 'chase' }) : r < 56 ? FL('Rocket', { speed: 1.5, arc: 0.3, curl: 0.2, fire: true, cam: 'chase' }) : r < 82 ? FL('Curler', { curl: d * 0.15, arc: d * 0.07, cam: 'chase', top: true }) : FL('Dipping strike', { arc: d * 0.13, curl: d * 0.03, cam: 'chase' });
  if (d > 9 && ag > 0.45 && goal && r >= 54 && r < 70) return FL('Wrapped round the post', { curlOut: true, curl: 2.4 + d * 0.13, arc: 0.6, cam: r % 2 ? 'net' : 'side', speed: 0.92 });
  if (rp.gz > 0.68 && ag > 0.58) return FL('Top bins', { cam: 'net', curl: 0.9, arc: 0.5, curlOut: r % 3 === 0 });
  if (ag > 0.8 && goal && r < 65) return FL('In off the post', { postIn: true, cam: 'net', curl: 1.1 });
  if (ag < 0.24 && rp.gz < 0.32 && d < 15) return FL('Through the keeper\'s legs', { gk: 'stand', cam: 'low', arc: 0.02, curl: 0 });
  if (d > 8 && d < 17 && r < 24) return FL('Chip over the keeper', { arc: 2.6, speed: 0.62, gk: 'rush', pose: 'chip', chipH: 1.7 });
  if (d > 9 && r >= 24 && r < 44) return FL('Curled into the top corner', { curl: 2.4 + d * 0.14, arc: 1.0, top: true, cam: r % 2 ? 'side' : 'net', speed: 0.9 });
  if (d > 7 && r >= 44 && r < 54) return FL('Outside of the boot', { curl: -(2 + d * 0.12), arc: 0.7, top: r % 2 === 0, cam: 'side' });
  if (d < 6.5 && r < 42) return FL('Sliding finish', { pose: 'slide', cam: 'low', arc: 0.05 });
  if (d < 9 && r < 62) return FL('Back-heel flick', { pose: 'heel', arc: 0.1, speed: 0.8, cam: 'low' });
  if (rp.v === 'power') return FL('Power drive', { fire: true, speed: 1.35, arc: 0.2, curl: 0.1 });
  if (rp.v === 'first') return FL('First-time finish', { speed: 1.1, cam: r % 2 ? 'side' : 'net' });
  return FL('Placed finish', { curl: 0.9, cam: r % 3 === 0 ? 'net' : 'side' });
}
/** Dialogue for the ultimate cutscenes: the striker before, the commentator after, the striker's last word. */
const ULT_LINES: Record<string, [string, string, string]> = {
  dag: ['There is no angle. So I will make one.', 'From THERE?! That goal should not exist!', 'The goal was always open. You just could not see it.'],
  zero: ['You blinked.', 'Nobody saw him swing! The net moved before the defence did!', 'Zero frames. Zero chance.'],
  trance: ['Stop thinking. Devour.', 'He has gone through all of them as if they were not there!', 'More. Give me more.'],
  puppet: ['Move. Exactly where I pull you.', 'Every runner on a string — and the finish to match!', 'I wrote that goal three passes ago.'],
  sky: ['The sky is mine.', 'He hung in the air for an eternity!', 'Come up here and stop me.'],
  chain: ['One touch. Keep up.', 'One touch, one touch, one touch — GOAL! Unplayable football!', 'That is what happens when we think at the same speed.'],
  sprint: ['Catch me.', 'Blink and he is gone! Nobody on this pitch can live with that pace!', 'You were chasing my shadow.'],
  curtain: ['Nothing gets past me.', 'The door is shut — nobody is getting through that!', 'My goal stays shut.'],
  dominion: ['I can see all of it.', 'He knew where everyone would be before they did!', 'The whole pitch moves the way I read it.'],
  comet: ['Thirty metres? Close enough.', 'He has set the ball on fire! The keeper never had a chance!', 'Distance is just a number.'],
  charge: ['Get out of my way.', 'He went straight THROUGH them! Two defenders on the floor!', 'I do not go round. I go through.'],
  fk: ['Build your wall. It will not matter.', 'Over the wall, into the top corner — the keeper did not even move!', 'Dead balls are mine.'],
  crescent: ['Watch it leave. Then watch it come back.', 'That was going wide by a mile — and it has curled back INTO THE NET!', 'The moon always comes back round.'],
  predator: ['Found it. The kill spot.', 'He smelled that chance before anyone else in the stadium!', 'I only need one opening.'],
};
const LONG_LINES = ['{n} looks up… {d} metres out. Surely not?', 'There is space in front of {n} — {d} metres. He is thinking about it!', '{n}, {d} metres from goal. He is going to hit this!', 'Nobody closes {n} down. {d} metres. Have a go!'];
const CELE = ['Knee slide', 'Arms-wide run', 'Backflip', 'Point to the sky', 'Jump and punch', 'Ice cold', 'Aeroplane'];

interface Scene {
  rp: Replay; long: boolean; dir: number; goalX: number; shot: V3; passFrom: V3 | null; end: V3; after: V3; h0: number; fl: Flair;
  tP0: number; tPass: number; tStrike: number; tFlight: number; tCele: number; tEnd: number; side: number; cele: number; celeDir: V3; quick: boolean; tIntro: number; tDrib: number; blk: number; drib: number[]; dribL: number; dribA: number; carry?: boolean; trick?: boolean; giveFrom?: V3 | null;
}
function buildScene(rp: Replay, quick = false, ms?: MatchState): Scene {
  const foe = (i: number) => (ms?.pl[i] ? ms.pl[i].t !== rp.t : (i < 11) !== (rp.sh < 11));
  const fl = pickFlair(rp);
  const dir = rp.t === 0 ? 1 : -1;
  const goalX = rp.t === 0 ? 105 : 0;
  const sx = rp.v === 'pen' ? goalX - dir * 11 : rp.bx * 1.05, sz = rp.v === 'pen' ? 34 : rp.by * 0.68;
  const long = rp.d > 18 && rp.v !== 'pen';
  const h0 = rp.v === 'header' ? 1.95 : rp.v === 'volley' || rp.v.startsWith('dag') ? 0.9 : 0.11;
  const sg = rp.gy >= 0 ? 1 : -1;
  let end: V3, after: V3, blk = -1;
  const gz = fl.chipH ?? 0.15 + rp.gz * 2.1;
  if (rp.res === 'goal' && fl.postIn) { end = [goalX, Math.min(2.2, gz), 34 + sg * 3.58]; after = [goalX + dir * 1.7, 0.12, 34 + sg * 1.2]; }
  else if (rp.res === 'goal' && fl.top) { end = [goalX, 2.16, 34 + sg * 3.32]; after = [goalX + dir * 1.7, 0.4, 34 + sg * 2.6]; }
  else if (rp.res === 'goal') { end = [goalX, gz, 34 + rp.gy * 3.3]; after = [goalX + dir * 1.7, 0.12, 34 + rp.gy * 3.4]; }
  else if (rp.res === 'save') { end = [goalX - dir * 0.95, Math.max(0.25, gz * 0.95), 34 + rp.gy * 3.2]; after = Math.abs(rp.gy) < 0.3 ? [goalX - dir * 2.2, 0.3, 34 + rp.gy * 3.2] : [goalX - dir * 2.5, rp.gz > 0.6 ? 3.4 : 0.6, 34 + sg * (5.5 + Math.abs(rp.gy) * 3)]; }
  else if (rp.res === 'post') { end = [goalX, Math.min(2.3, gz), 34 + sg * 3.66]; after = [goalX - dir * 5, 0.11, 34 + sg * 6]; }
  else if (rp.res === 'block') {
    // the blocker: the recorded one, else the nearest outfield opponent between the ball and the goal
    let bi = rp.blk != null && rp.blk >= 0 && rp.pl.some((x) => x[0] === rp.blk) ? rp.blk : -1;
    if (bi < 0) { let bd = 1e9; for (const x of rp.pl) { if (x[0] === rp.gk || x[0] === rp.sh || !foe(x[0])) continue; const dd = Math.hypot(x[1] * 1.05 - sx, x[2] * 0.68 - sz); if ((goalX - x[1] * 1.05) * dir < (goalX - sx) * dir + 2 && dd < bd) { bd = dd; bi = x[0]; } } }
    blk = bi;
    const bp = rp.pl.find((x) => x[0] === bi);
    const L = Math.hypot(goalX - sx, 34 - sz) || 1;
    const tp = bp ? Math.max(0.12, Math.min(0.55, (((bp[1] * 1.05 - sx) * (goalX - sx) + (bp[2] * 0.68 - sz) * (34 - sz)) / (L * L)))) : 0.3;
    const m: V3 = [lerp(sx, goalX, tp), 0.75, lerp(sz, 34, tp)]; end = m; after = [m[0] - dir * 2.5, 0.11, m[2] + sg * 6];
  }
  else { const over = rp.gz > 0.55; end = over ? [goalX, 2.44 + 0.5 + rp.gz * 1.6, 34 + rp.gy * 3] : [goalX, gz, 34 + sg * (3.66 + 0.7 + Math.abs(rp.gy) * 2.6)]; after = add(end, [dir * 7, over ? 0.6 : -gz * 0.8, sg * 1]); }
  // a header always comes from a delivery: if nobody is recorded, the cross comes in from the nearest wing
  const passFrom: V3 | null = rp.fx >= 0 ? [rp.fx * 1.05, 0.11, rp.fy * 0.68] : (rp.v === 'header' || rp.ult === 'sky') && rp.v !== 'pen' ? [goalX - dir * 17, 0.11, sz < 34 ? 64 : 4] : null;
  const tPass = passFrom ? (quick ? 0.7 : 0.95) : 0;
  const tP0 = quick ? 0.25 : 0.45;
  const tStrike = tP0 + tPass + 0.2 + (rp.ult ? 0.85 : 0);
  // with an ultimate, the delivery is timed to arrive as he strikes: nothing hangs in the air waiting for him
  const tP0x = rp.ult && passFrom ? tStrike - tPass - 0.04 : tP0;
  const tFlight = (Math.max(0.42, Math.min(1.5, rp.d / 24)) * (long ? 2.1 : 1.45) * (rp.ult === 'zero' ? 0.4 : quick && !long ? 0.85 : 1)) / fl.speed;
  const hasCele = rp.res === 'goal' && !quick;
  const tCele = tStrike + tFlight + 1.0;
  const side = sz < 34 ? -1 : 1;
  const celeDir = norm([dir * 0.25, 0, side * 1]);
  const sd = norm(sub([goalX, 0, 34], [sx, 0, sz]));
  // Chain Reaction is a one-two: he plays it into his partner from deeper, runs past, and gets it back first time
  const giveFrom: V3 | null = rp.ult === 'chain' && passFrom ? [sx - sd[0] * 11 + sd[2] * 2.5, 0.11, sz - sd[2] * 11 - sd[0] * 2.5] : null;
  return { giveFrom, rp, long, dir, goalX, shot: [sx, h0, sz], passFrom, end, after, h0, fl, tP0: tP0x, tPass, tStrike, tFlight, tCele, tEnd: hasCele ? tCele + 3.0 : tStrike + tFlight + (quick ? 1.0 : 1.7), side, tIntro: quick ? 0 : rp.ult ? 1.9 : long || fl.cam === 'chase' ? 1.1 : 0, blk, ...dribSetup(rp, quick, sx, sz, foe, !!passFrom), cele: ((((rp.id + 1) * 2654435761 + rp.min * 40503 + rp.sh * 97) >>> 9) >>> 0) % CELE.length, celeDir, quick };
}
/** Dribbling ultimates open with the run itself: who gets beaten, how far the run is, how wide the weave. */
function dribSetup(rp: Replay, quick: boolean, sx: number, sz: number, foe: (i: number) => boolean, passed = false): { tDrib: number; drib: number[]; dribL: number; dribA: number; carry?: boolean; trick?: boolean } {
  if (rp.skill && !rp.ult && rp.beat != null && rp.beat >= 0 && rp.pl.some((x) => x[0] === rp.beat)) return { tDrib: quick ? 1.0 : 1.5, drib: [rp.beat], dribL: 8, dribA: rp.skill === 2 ? 1.3 : 0.9 };
  if (!quick && !passed && rp.v !== 'fk' && rp.v !== 'pen' && rp.v !== 'header' && rp.v !== 'volley' && (!rp.ult || rp.ult === 'zero' || rp.ult === 'comet' || rp.ult === 'dag')) {
    // no pass: he carries it into the shot, sometimes with a trick, instead of running up to a ball that sits still
    const h = (rp.id * 2654435761 + Math.round(rp.d * 31)) >>> 0;
    return { tDrib: rp.ult ? 1.1 : 0.85, drib: [], dribL: rp.ult === 'comet' ? 7 : 5, dribA: h % 3 === 0 ? 0.9 : 0.3, carry: true, trick: h % 3 === 0 };
  }
  if (quick || (rp.ult !== 'trance' && rp.ult !== 'sprint' && rp.ult !== 'charge')) return { tDrib: 0, drib: [], dribL: 0, dribA: 0 };
  const opp = rp.pl.filter((x) => x[0] !== rp.gk && x[0] !== rp.sh && foe(x[0])).map((x) => ({ i: x[0], d: Math.hypot(x[1] * 1.05 - sx, x[2] * 0.68 - sz) })).sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.i);
  return rp.ult === 'charge' ? { tDrib: 2.2, drib: opp.slice(0, 2), dribL: 16, dribA: 0.35 } : rp.ult === 'sprint' ? { tDrib: 2.0, drib: opp, dribL: 30, dribA: 0.7 } : { tDrib: 3.0, drib: opp, dribL: 21, dribA: 2.3 };
}
function ballAt(sc: Scene, t: number): { p: V3; u: number; phase: 0 | 1 | 2 | 3 } {
  const { rp, fl } = sc;
  if (t < sc.tStrike) {
    if (sc.giveFrom && sc.passFrom && t <= sc.tP0) {
      const u = c01((t - (sc.tP0 - 0.8)) / 0.8);
      const p = lerp3(sc.giveFrom, sc.passFrom, ease(u)); p[1] = 0.11;
      return { p, u, phase: u > 0 ? 1 : 0 };
    }
    if (sc.passFrom && t > sc.tP0) {
      const u = c01((t - sc.tP0) / sc.tPass);
      const p = lerp3(sc.passFrom, [sc.shot[0], sc.h0, sc.shot[2]], u);
      p[1] = lerp(0.11, sc.h0, u) + (rp.high ? 3.2 : 0.05) * 4 * u * (1 - u);
      return { p, u, phase: 1 };
    }
    if (sc.carry && !sc.passFrom) { const u = c01(t / Math.max(0.2, sc.tStrike - 0.05)); const dv = norm(sub([sc.goalX, 0, 34], [sc.shot[0], 0, sc.shot[2]])); return { p: [sc.shot[0] - dv[0] * 3.0 * (1 - u), 0.11, sc.shot[2] - dv[2] * 3.0 * (1 - u)], u: 0, phase: 0 }; }
    return { p: sc.passFrom ? sc.passFrom : sc.shot, u: 0, phase: 0 };
  }
  const u = (t - sc.tStrike) / sc.tFlight;
  if (u <= 1) {
    const p = lerp3(sc.shot, sc.end, u);
    p[1] = lerp(sc.h0, sc.end[1], u) + fl.arc * 4 * u * (1 - u);
    const dv = norm(sub([sc.end[0], 0, sc.end[2]], [sc.shot[0], 0, sc.shot[2]]));
    const perp: V3 = [-dv[2], 0, dv[0]];
    const k = Math.sin(Math.PI * u) * fl.curl * (rp.gy >= 0 ? -1 : 1) * (fl.curlOut ? -1 : 1) + Math.sin(u * 19) * fl.wob * 0.3 * (1 - u * 0.4);
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

/** The monster of Monster Trance: a hunched, horned shadow-beast with burning eyes, clawing after the dribbler. */
function drawMonster(ctx: CanvasRenderingContext2D, cam: Cam, base: V3, fwd: V3, t: number, st: { col: string; col2: string }): void {
  const q0 = proj(cam, base), q1 = proj(cam, [base[0], 3.8, base[2]]);
  if (q0.z < NEAR || q1.z < NEAR) return;
  const H = q0.y - q1.y, Wd = H * 0.62, cx = q0.x, top = q1.y;
  const qf = proj(cam, add(base, mul(fwd, 1.5))), face = Math.sign(qf.x - q0.x) || 1; // which way he lunges on screen
  const br = Math.sin(t * 5) * 0.03, lunge = Math.sin(t * 7) * 0.08;
  ctx.save();
  // smoke aura
  const g = ctx.createRadialGradient(cx, top + H * 0.5, H * 0.05, cx, top + H * 0.5, H * 0.75);
  g.addColorStop(0, st.col + '66'); g.addColorStop(1, st.col + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, top + H * 0.55, Wd * 1.1, H * 0.7, 0, 0, 6.3); ctx.fill();
  // body: a hunched mass leaning towards the dribbler
  ctx.fillStyle = 'rgba(14,6,22,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx - Wd * 0.5, q0.y);
  ctx.quadraticCurveTo(cx - Wd * 0.7, top + H * (0.35 + br), cx - Wd * 0.1 * face, top + H * 0.12);
  ctx.quadraticCurveTo(cx + Wd * 0.45 * face, top + H * (0.02 - br), cx + Wd * (0.62 + lunge) * face, top + H * 0.3);
  ctx.quadraticCurveTo(cx + Wd * 0.4 * face, top + H * 0.75, cx + Wd * 0.45, q0.y);
  ctx.closePath(); ctx.fill();
  // spikes along the spine
  ctx.fillStyle = st.col;
  for (let i = 0; i < 6; i++) { const u = i / 5, x = lerp(cx - Wd * 0.55, cx + Wd * 0.3 * face, u), y = top + H * (0.3 - Math.sin(u * Math.PI) * 0.22); ctx.beginPath(); ctx.moveTo(x - Wd * 0.05, y + H * 0.04); ctx.lineTo(x - Wd * 0.03 * face, y - H * (0.1 + 0.03 * Math.sin(t * 9 + i))); ctx.lineTo(x + Wd * 0.05, y + H * 0.04); ctx.fill(); }
  // horns
  const hx = cx + Wd * 0.42 * face, hy = top + H * 0.2;
  ctx.strokeStyle = st.col2; ctx.lineWidth = Math.max(2, H * 0.025); ctx.lineCap = 'round';
  for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s2 * Wd * 0.08, hy); ctx.quadraticCurveTo(hx + s2 * Wd * 0.25, hy - H * 0.18, hx + s2 * Wd * 0.05 + face * Wd * 0.12, hy - H * 0.27); ctx.stroke(); }
  // burning eyes
  for (const s2 of [-1, 1]) { const ex = hx + s2 * Wd * 0.09 + face * Wd * 0.06, ey = hy + H * 0.05; const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, H * 0.06); eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.3, st.col2); eg.addColorStop(1, st.col2 + '00'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, H * 0.06, 0, 6.3); ctx.fill(); }
  // open maw with teeth
  const mx = hx + face * Wd * 0.1, my = hy + H * 0.14, open = 0.04 + Math.abs(Math.sin(t * 6)) * 0.05;
  ctx.fillStyle = '#2a0010'; ctx.beginPath(); ctx.ellipse(mx, my, Wd * 0.14, H * open, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#f4f1ea'; for (let i = 0; i < 5; i++) { const tx = mx - Wd * 0.12 + i * Wd * 0.06; ctx.beginPath(); ctx.moveTo(tx, my - H * open); ctx.lineTo(tx + Wd * 0.025, my - H * open + H * 0.04); ctx.lineTo(tx + Wd * 0.05, my - H * open); ctx.fill(); }
  // clawed arms reaching for him
  ctx.strokeStyle = 'rgba(14,6,22,0.95)'; ctx.lineWidth = Math.max(3, H * 0.07);
  for (const s2 of [0, 1]) { const ax0 = cx + Wd * 0.2 * face, ay0 = top + H * (0.45 + s2 * 0.12), ax1 = cx + Wd * (0.95 + lunge * 2 + s2 * 0.1) * face, ay1 = top + H * (0.55 + s2 * 0.15); ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.quadraticCurveTo((ax0 + ax1) / 2, ay0 - H * 0.08, ax1, ay1); ctx.stroke();
    ctx.strokeStyle = st.col2; ctx.lineWidth = Math.max(1.5, H * 0.015); for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax1 + face * Wd * 0.12, ay1 + c * H * 0.04 + H * 0.03); ctx.stroke(); } ctx.strokeStyle = 'rgba(14,6,22,0.95)'; ctx.lineWidth = Math.max(3, H * 0.07); }
  ctx.restore();
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
    } else if (key === 'charge' && sc.tDrib > 0) { // dust clouds where he hit them
      for (let i = 0; i < 2; i++) { const back = mul(norm(sub([sc.goalX, 0, 34], sp)), -1); const c0 = add(sp, mul(back, 3.65 + sc.dribL * (1 - (i * 2 + 1) / 4))); const q = proj(cam, c0); if (q.z < NEAR) continue; const s2 = cam.fl / q.z; for (let j = 0; j < 7; j++) { ctx.fillStyle = 'rgba(190,170,120,0.35)'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(q.x + Math.cos(j * 0.9) * s2 * (0.6 + j * 0.12), q.y - s2 * (0.2 + (j % 3) * 0.2), s2 * (0.35 + (j % 2) * 0.2), 0, 6.3); ctx.fill(); } }
      const back = mul(norm(sub([sc.goalX, 0, 34], sp)), -1), perp: V3 = [-back[2], 0, back[0]];
      ctx.strokeStyle = us.col; ctx.lineWidth = 3; ctx.globalAlpha = 0.85 * Math.min(1, k * 2);
      for (let i = 0; i < 7; i++) { let p0: V3 = add(sp, mul(back, i * 2.2)); for (let j = 1; j < 4; j++) { const p1: V3 = add(add(p0, mul(perp, ((i + j) % 2 ? 1 : -1) * 0.7)), mul(back, 0.6)); L([p0[0], 0.04, p0[2]], [p1[0], 0.04, p1[2]]); p0 = p1; } }
    } else if (key === 'charge') { // cracks in the turf along his path and a shockwave where he arrives
      const back = mul(norm(sub([sc.goalX, 0, 34], sp)), -1), perp: V3 = [-back[2], 0, back[0]];
      ctx.strokeStyle = us.col; ctx.lineWidth = 3; ctx.globalAlpha = 0.85 * Math.min(1, k * 2);
      for (let i = 0; i < 7; i++) { let p0: V3 = add(sp, mul(back, i * 2.2)); for (let j = 1; j < 4; j++) { const p1: V3 = add(add(p0, mul(perp, ((i + j) % 2 ? 1 : -1) * 0.7)), mul(back, 0.6)); L([p0[0], 0.04, p0[2]], [p1[0], 0.04, p1[2]]); p0 = p1; } }
      for (let r = 0; r < 3; r++) { const rr = ((t * 1.1 + r / 3) % 1) * 9; ctx.strokeStyle = us.col2; ctx.globalAlpha = 0.7 * (1 - rr / 9); ctx.lineWidth = 3; for (let a = 0; a < 24; a++) L([sp[0] + Math.cos(a * 0.262) * rr, 0.05, sp[2] + Math.sin(a * 0.262) * rr], [sp[0] + Math.cos((a + 1) * 0.262) * rr, 0.05, sp[2] + Math.sin((a + 1) * 0.262) * rr]); }
    } else if (key === 'crescent') { // a ghost of the crescent before he strikes: the whole impossible path, drawn on the night sky
      ctx.strokeStyle = us.col; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.75 * Math.min(1, k * 2) * (fl > 0 ? 0.35 : 1);
      let p0 = ballAt(sc, sc.tStrike).p; for (let i = 1; i <= 24; i++) { const p1 = ballAt(sc, sc.tStrike + (i / 24) * sc.tFlight).p; if (i % 2) L(p0, p1); p0 = p1; }
    } else if (key === 'fk') { // the curl drawn in gold over the wall before he strikes
      ctx.strokeStyle = us.col; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8 * Math.min(1, k * 2) * (fl > 0 ? 0.4 : 1);
      let p0 = ballAt(sc, sc.tStrike).p; for (let i = 1; i <= 16; i++) { const p1 = ballAt(sc, sc.tStrike + (i / 16) * sc.tFlight).p; if (i % 2) L(p0, p1); p0 = p1; }
    } else if (key === 'dag') { // the wedge of goal he should not be able to see
      ctx.strokeStyle = us.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8 * Math.min(1, k * 2);
      L([sp[0], 0.03, sp[2]], [sc.goalX, 0.03, 34 - 3.66]); L([sp[0], 0.03, sp[2]], [sc.goalX, 0.03, 34 + 3.66]);
      poly(ctx, cam, [[sp[0], 0.02, sp[2]], [sc.goalX, 0.02, 34 - 3.66], [sc.goalX, 0.02, 34 + 3.66]], us.col + '33');
    }
    ctx.globalAlpha = 1;
    return;
  }
  { // every ultimate: rising motes of its colour while he charges, a shockwave at the moment of the strike, a glowing ball trail
    const sq = proj(cam, [sp[0], 0, sp[2]]);
    if (sq.z > NEAR && k > 0 && fl === 0) { const s2 = cam.fl / sq.z; for (let i = 0; i < 26; i++) { const a = i * 2.39 + t * 2.2, rr = (0.5 + (i % 5) * 0.18) * s2, yy = ((t * 0.9 + i * 0.137) % 1) * 2.6 * s2; ctx.fillStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = 0.85 * k * (1 - yy / (2.6 * s2)); ctx.beginPath(); ctx.arc(sq.x + Math.cos(a) * rr, sq.y - yy, Math.max(1.5, s2 * 0.045), 0, 6.3); ctx.fill(); } }
    const kk = t - sc.tStrike;
    if (sq.z > NEAR && kk > 0 && kk < 0.45) { const s2 = cam.fl / sq.z, rr = kk / 0.45; ctx.strokeStyle = us.col2; ctx.lineWidth = Math.max(2, s2 * 0.12 * (1 - rr)); ctx.globalAlpha = 1 - rr; ctx.beginPath(); ctx.ellipse(sq.x, sq.y, rr * 4.5 * s2, rr * 1.4 * s2, 0, 0, 6.3); ctx.stroke(); }
    if (fl > 0 && fl < 1 && key !== 'comet' && key !== 'zero') for (let i = 1; i <= 8; i++) { const u = fl - i * 0.03; if (u <= 0) break; const q = proj(cam, ballAt(sc, sc.tStrike + u * sc.tFlight).p); if (q.z < NEAR) continue; ctx.fillStyle = us.col; ctx.globalAlpha = 0.6 * (1 - i / 9); ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, 0.12 * (cam.fl / q.z) * (1 - i / 10)), 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
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
  } else if (key === 'comet' && fl > 0) { // a burning tail behind the ball
    for (let i = 1; i <= 14; i++) { const u = fl - i * 0.035; if (u <= 0) break; const p = ballAt(sc, sc.tStrike + u * sc.tFlight).p; const q = proj(cam, p); if (q.z < NEAR) continue; const r = Math.max(2, 0.2 * (cam.fl / q.z) * (1 - i / 16)); ctx.fillStyle = i % 3 ? us.col : us.col2; ctx.globalAlpha = 0.85 * (1 - i / 15); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 6.3); ctx.fill(); }
    if (fl < 1) { const q = proj(cam, bp); if (q.z > NEAR) { const r = Math.max(4, 0.35 * (cam.fl / q.z)); const gr = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, us.col2 + 'aa'); gr.addColorStop(1, us.col + '00'); ctx.fillStyle = gr; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 6.3); ctx.fill(); } }
  } else if (key === 'fk' && fl > 0 && fl < 1) { // golden sparkle on the ball as it bends
    const q = proj(cam, bp); if (q.z > NEAR) { const s = cam.fl / q.z; for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 8; ctx.strokeStyle = us.col; ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * 0.12 * s, q.y + Math.sin(a) * 0.12 * s); ctx.lineTo(q.x + Math.cos(a) * 0.3 * s, q.y + Math.sin(a) * 0.3 * s); ctx.stroke(); } }
  } else if (key === 'zero' && fl > 0) { // frozen frames of the ball along its path
    for (let i = 1; i <= 6; i++) { const u = i / 7; if (u > fl) break; const p = ballAt(sc, sc.tStrike + u * sc.tFlight).p; const q = proj(cam, p); if (q.z < NEAR) continue; const r = Math.max(2.5, 0.115 * (cam.fl / q.z)); ctx.strokeStyle = us.col2; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.strokeRect(q.x - r * 1.8, q.y - r * 1.8, r * 3.6, r * 3.6); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 6.3); ctx.fill(); }
  } else if (key === 'dag' && fl > 0 && fl < 1) { // shards breaking off the ball
    const q = proj(cam, bp); if (q.z > NEAR) { const s = cam.fl / q.z; for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 6, rr = (0.3 + ((i * 37) % 10) / 14) * s; ctx.fillStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr); ctx.lineTo(q.x + Math.cos(a + 0.25) * rr * 1.5, q.y + Math.sin(a + 0.25) * rr * 1.5); ctx.lineTo(q.x + Math.cos(a + 0.5) * rr, q.y + Math.sin(a + 0.5) * rr); ctx.fill(); } }
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, W: number, H: number, ms: MatchState, sc: Scene, tRaw: number, trail: V3[], faces: Face[]): void {
  const { rp, dir, goalX, fl } = sc;
  const intro = tRaw < sc.tIntro ? tRaw / sc.tIntro : -1; // 0..1 during the close-up that opens ultimates and long-range strikes
  const dribU = intro < 0 && sc.tDrib > 0 && tRaw < sc.tIntro + sc.tDrib ? (tRaw - sc.tIntro) / sc.tDrib : -1; // 0..1 through the dribble of a dribbling ultimate
  const t = Math.max(0, tRaw - sc.tIntro - sc.tDrib);
  const b = ballAt(sc, t);
  const goalC: V3 = [goalX, 1.1, 34];
  const sdir = norm(sub([goalX, 0, 34], [sc.shot[0], 0, sc.shot[2]]));
  const perpD: V3 = [-sdir[2], 0, sdir[0]];
  const start0: V3 = [sc.shot[0] - sdir[0] * (rp.v === 'pen' ? 0.5 : 3.65), 0, sc.shot[2] - sdir[2] * (rp.v === 'pen' ? 0 : 3.65)];
  /** where the dribbler is at progress u of the run, and where each beaten defender waits */
  const waves = Math.max(1, sc.drib.length);
  const dribAt = (u: number): V3 => add(add(start0, mul(sdir, -sc.dribL * (1 - u))), mul(perpD, sc.dribA * Math.sin(u * waves * Math.PI) * (1 - u * 0.25)));
  const dribDef = (k: number): { u: number; p: V3 } => { const u = (k * 2 + 1) / (2 * Math.max(1, sc.drib.length)); return { u, p: add(add(start0, mul(sdir, -sc.dribL * (1 - u))), mul(perpD, rp.ult === 'sprint' ? (k % 2 ? 1.6 : -1.6) : 0)) }; };
  const pre = sc.tDrib > 0 && (intro >= 0 || dribU >= 0);
  const dPos = pre ? dribAt(Math.max(0, dribU)) : start0;
  if (pre) { b.p = [dPos[0] + sdir[0] * 0.65 + perpD[0] * Math.sin(tRaw * 11) * 0.12, 0.11, dPos[2] + sdir[2] * 0.65 + perpD[2] * Math.sin(tRaw * 11) * 0.12]; b.phase = 0; }
  const impact = t - sc.tStrike - sc.tFlight;
  const tc = rp.res === 'goal' && !sc.quick ? t - sc.tCele : -1;
  const cele = tc >= 0 ? celeState(sc, tc) : null;
  const shake = rp.res === 'goal' && impact > 0 && impact < 0.35 ? (0.35 - impact) * 0.5 : 0;
  // ── camera
  let cam: Cam;
  const fu = c01((t - sc.tStrike) / sc.tFlight);
  const usC = rp.ult ? ULT_STYLE[rp.ult] : null;
  if (intro >= 0) {
    // close on the striker's face, pushing in
    const st: V3 = dPos;
    const sway = Math.sin(intro * 2.2) * 0.5;
    const pos: V3 = [st[0] + sdir[0] * lerp(3.3, 2.1, ease(intro)) - sdir[2] * sway, lerp(1.9, 1.62, intro), st[2] + sdir[2] * lerp(3.3, 2.1, ease(intro)) + sdir[0] * sway];
    cam = mkCam(pos, [st[0], 1.55, st[2]], H * lerp(1.5, 2.1, ease(intro)), W, H);
  } else if (dribU >= 0) {
    // tracking shot from in front of the dribbler: his face, the ball and every defender he leaves behind
    const side = sc.side || 1;
    const pos = add(add(dPos, mul(sdir, lerp(8.5, 6.5, dribU))), [perpD[0] * -4.2 * side, lerp(2.6, 1.7, dribU), perpD[2] * -4.2 * side]);
    cam = mkCam(pos, add(dPos, [0, 1.0, 0]), H * 1.12, W, H);
  } else if (cele) {
    const z = ease(c01(tc / 2.6));
    const pos = add(add(cele.pos, mul(sc.celeDir, lerp(8.5, 5.2, z))), [dir * -1.6, lerp(2.1, 1.5, z), 0]);
    cam = mkCam(pos, add(cele.pos, [0, 1.25, 0]), H * lerp(1.15, 1.5, z), W, H);
  } else if (usC && fu <= 0 && t > sc.tStrike - 0.85) {
    // ultimate charge: a low orbit around the striker
    const ch = c01((t - (sc.tStrike - 0.85)) / 0.85);
    const a = Math.atan2(-sdir[2], -sdir[0]) + sc.side * lerp(1.5, 0.5, ease(ch));
    cam = mkCam([sc.shot[0] + Math.cos(a) * 5.2, 0.9, sc.shot[2] + Math.sin(a) * 5.2], [sc.shot[0], 1.25, sc.shot[2]], H * 1.25, W, H);
  } else if ((usC || sc.long || fl.cam === 'chase') && fu > 0.5 && rp.res !== 'block') {
    // cut: behind the net as the ball arrives, held until the celebration so the goal is always seen going in
    const pos: V3 = [goalX + dir * 5.4, 2.2 + shake * Math.sin(tRaw * 90), 34 - Math.sign(sc.end[2] - 34 || 1) * 1.6 + shake * Math.cos(tRaw * 70)];
    cam = mkCam(pos, lerp3([sc.shot[0], 1, sc.shot[2]], [b.p[0], Math.min(2.2, b.p[1]), b.p[2]], impact > 0 ? 0.92 : 0.75), H * 1.05, W, H);
  } else if (usC && fu > 0) {
    // ultimate strike: a wide side-on frame that holds both the striker and the whole goal
    const mid = lerp3([sc.shot[0], 0, sc.shot[2]], goalC, 0.5);
    const dist = Math.max(15, rp.d * 0.95 + 6);
    cam = mkCam([mid[0] - perpD[0] * dist * sc.side * -1 - sdir[0] * 3, 4.2, mid[2] - perpD[2] * dist * sc.side * -1 - sdir[2] * 3], [mid[0], 1.2, mid[2]], H * 1.05, W, H);
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
      if (cele) { X = cele.pos[0]; Z = cele.pos[2]; Object.assign(pose, cele.pose); pose.happy = true; fdx = sc.celeDir[0]; fdz = sc.celeDir[2]; if (cele.pose.kick) { pose.runPh = t * 15; pose.kick = 0; } }
      else if (pre) {
        X = dPos[0]; Z = dPos[2]; fdx = sdir[0]; fdz = sdir[2];
        if (usC) pose.glow = usC.col;
        if (dribU >= 0 && (rp.skill === 2 || sc.trick) && Math.abs(dribU - 0.42) < 0.12) { pose.strike = 0.25 + Math.sin(tRaw * 24) * 0.2; pose.lean = { dx: perpD[0], dz: perpD[2], a: Math.sin(tRaw * 12) * 0.3 }; pose.arms = 2; } // step-over
        else if (dribU >= 0 && rp.ult === 'charge') { pose.runPh = tRaw * 15; pose.lean = { dx: sdir[0], dz: sdir[2], a: 0.5 }; pose.arms = 2; pose.crouch = 0.15; pose.glow = usC?.col; }
        else if (dribU >= 0) { pose.runPh = tRaw * 17; const lean = Math.cos(dribU * waves * Math.PI); pose.lean = { dx: perpD[0] * Math.sign(lean || 1), dz: perpD[2] * Math.sign(lean || 1), a: Math.abs(lean) * (rp.ult === 'sprint' ? 0.12 : 0.34) + (rp.ult === 'sprint' ? 0 : 0) }; if (rp.ult === 'sprint') pose.lean = { dx: sdir[0], dz: sdir[2], a: 0.3 }; }
      }
      else {
        if (rp.v === 'pen') { X = sc.shot[0] - dir * 0.5; Z = 34; } else { X = sc.shot[0] - sdir[0] * 0.45; Z = sc.shot[2] - sdir[2] * 0.45; }
        const run = c01((sc.tStrike - 0.22 - t) / 0.9);
        X -= sdir[0] * run * 3.2; Z -= sdir[2] * run * 3.2;
        if (sc.giveFrom && t < sc.tStrike - 0.22) { // the one-two: plays it in, then sprints into the space for the return
          const t0 = sc.tP0 - 0.8, u = c01((t - t0) / Math.max(0.3, sc.tStrike - 0.22 - t0));
          X = lerp(sc.giveFrom[0] - sdir[0] * 0.4, sc.shot[0] - sdir[0] * 0.45, ease(u)); Z = lerp(sc.giveFrom[2] - sdir[2] * 0.4, sc.shot[2] - sdir[2] * 0.45, ease(u));
          if (Math.abs(t - t0) < 0.3) pose.strike = c01((t - t0 + 0.3) / 0.6); else if (u > 0 && u < 1) pose.runPh = t * 16;
        }
        const w = c01((k0 + 0.3) / 0.75), sw = Math.sin(w * Math.PI);
        const sWin = k0 > -0.3 && k0 < 0.42; // the kicking motion: back-swing, contact at k0 = 0, follow-through
        if (intro >= 0) { pose.glow = usC?.col; pose.arms = 0; }
        else if (sWin) pose.strike = c01((k0 + 0.3) / 0.66);
        else if (run > 0 && run < 1) pose.runPh = t * 15;
        if (usC && t < sc.tStrike) pose.glow = usC.col;
        fdx = sdir[0]; fdz = sdir[2];
        if (fl.pose === 'bicycle') { pose.lean = { dx: -sdir[0], dz: -sdir[2], a: sw * 1.75 }; pose.lift = sw * 1.2; pose.arms = 2; }
        else if (fl.pose === 'scissor') { pose.lean = { dx: -sdir[2] * sc.side, dz: sdir[0] * sc.side, a: sw * 1.15 }; pose.lift = sw * 0.8; pose.arms = 2; }
        else if (fl.pose === 'dive') { const dv = c01((k0 + 0.28) / 0.8); pose.lean = { dx: sdir[0], dz: sdir[2], a: Math.min(1, dv * 2.2) * 1.42 }; pose.lift = 0.45 + Math.sin(dv * Math.PI) * 0.45 - dv * 0.5; pose.arms = 2; pose.strike = undefined; X += sdir[0] * (dv * 2.6 - 1.2); Z += sdir[2] * (dv * 2.6 - 1.2); }
        else if (fl.pose === 'slide') { const dv = c01((k0 + 0.32) / 0.9); pose.lean = { dx: -sdir[0], dz: -sdir[2], a: Math.min(1, dv * 2.5) * 1.22 }; pose.arms = 2; pose.strike = 0.45 + Math.min(0.55, dv * 0.9); X += sdir[0] * (dv * 2.8 - 1.4); Z += sdir[2] * (dv * 2.8 - 1.4); }
        else if (fl.pose === 'heel') { fdx = -sdir[0]; fdz = -sdir[2]; pose.heel = true; X += sdir[0] * 0.75; Z += sdir[2] * 0.75; if (sWin) pose.strike = c01((k0 + 0.3) / 0.6); }
        else if (fl.pose === 'leap') { pose.lift = sw * (rp.ult === 'sky' ? 1.7 : 0.95); pose.arms = 4; pose.strike = undefined; pose.lean = { dx: sdir[0], dz: sdir[2], a: sw * 0.25 }; }
        else if (fl.pose === 'chip') { pose.lean = { dx: -sdir[0], dz: -sdir[2], a: sw * 0.22 }; }
        else if (rp.v === 'header') { pose.lift = sw * 0.6; pose.strike = undefined; pose.arms = 4; pose.lean = { dx: sdir[0], dz: sdir[2], a: sw * 0.3 }; }
        else if (rp.v === 'volley') { pose.lift = sw * 0.35; pose.lean = { dx: -sdir[2] * sc.side, dz: sdir[0] * sc.side, a: sw * 0.4 }; pose.arms = 2; }
        else if (sWin) { pose.lean = { dx: -sdir[0], dz: -sdir[2], a: sw * (rp.v === 'power' || sc.long ? 0.22 : 0.12) }; pose.arms = 4; }
        if (rp.res === 'goal' && impact > 0.2 && fl.pose !== 'dive' && fl.pose !== 'slide') { pose.arms = 1; pose.happy = true; pose.lean = undefined; pose.lift = Math.abs(Math.sin((impact - 0.2) * 7)) * 0.3; }
        else if (rp.res !== 'goal' && impact > 0.35) { pose.arms = 4; pose.crouch = 0.15; }
      }
    } else if (isGk) {
      const kx = goalX - dir * 0.95;
      X = kx;
      const z0 = 34 + Math.max(-2.2, Math.min(2.2, (py * 0.68 - 34) * 0.4));
      Z = z0;
      fdx = -sdir[0]; fdz = -sdir[2];
      const REACH = 2.15; // feet to fingertips with the arms stretched
      if (intro >= 0) { pose.crouch = 0.25; pose.arms = 2; }
      else if (fl.gk === 'rush') { const ru = ease(c01((t - sc.tP0) / Math.max(0.4, sc.tStrike - sc.tP0))); X -= dir * ru * Math.min(6, rp.d * 0.45); pose.arms = 2; pose.crouch = ru * 0.45; if (fu > 0.15) { pose.arms = 1; pose.crouch = 0; pose.lift = Math.sin(c01(fu * 1.6) * Math.PI) * 0.4; } }
      else if (fl.gk === 'stand') { pose.arms = 2; pose.crouch = 0.35 * c01(fu * 3 + (t > sc.tStrike - 0.3 ? 0.4 : 0)); }
      else {
        // where the dive has to get the hands: the ball itself for a save, short of it for a goal, the wrong way if sent early
        const early = fl.gk === 'early';
        const miss = rp.res === 'goal' ? 0.95 : rp.res === 'save' ? 0 : 0.5;
        let hz = sc.end[2], hyy = Math.min(2.6, sc.end[1]);
        const sgn = (hz - z0 >= 0 ? 1 : -1) * (early ? -1 : 1);
        if (early) hz = z0 + sgn * 2.4;
        hz -= sgn * miss; if (rp.res === 'goal') hyy = Math.max(0.3, hyy - 0.25);
        const lat = Math.abs(hz - z0);
        let a = lat < 0.7 ? 0.12 : Math.min(1.38, 0.45 + lat * 0.33);
        if (hyy < Math.cos(a) * REACH) a = Math.min(1.46, Math.acos(Math.max(0.1, Math.min(1, hyy / REACH))));
        const fz2 = hz - sgn * Math.sin(a) * REACH, lift2 = Math.max(0, hyy - Math.cos(a) * REACH);
        const dd = ease(c01(((early ? fu + 0.4 : fu) - 0.18) / 0.82));
        const set = c01((t - (sc.tStrike - 0.5)) / 0.5);
        pose.crouch = fu <= 0 ? 0.3 * set : 0.3 * (1 - dd);
        pose.arms = fu <= 0 ? 2 : 1;
        if (dd > 0) { Z = lerp(z0, fz2, dd); pose.lean = { dx: 0, dz: sgn, a: a * dd }; pose.lift = lift2 * dd + Math.sin(dd * Math.PI) * (lat > 0.7 ? 0.25 : 0.1); }
        if (impact > 0.15 && dd >= 1 && lat > 0.7) { const fall = c01((impact - 0.15) / 0.35); pose.lean = { dx: 0, dz: sgn, a: lerp(a, 1.5, fall) }; pose.lift = (pose.lift ?? 0) * (1 - fall); }
      }
      if (rp.res === 'goal' && impact > 0.9 && !cele && fl.gk !== 'dive' && fl.gk !== 'early') pose.crouch = 0.5;
    } else if (sc.tDrib > 0 && sc.drib.includes(idx)) {
      // a defender in the path of the dribbling ultimate: set, lunge, beaten
      const k = sc.drib.indexOf(idx), dd = dribDef(k), u = pre ? Math.max(0, dribU) : 1;
      X = dd.p[0]; Z = dd.p[2];
      const side = Math.sign(Math.sin(dd.u * waves * Math.PI)) || 1; // the side the dribbler goes past on
      fdx = -sdir[0]; fdz = -sdir[2];
      const rel = u - dd.u;
      if (rp.ult === 'charge' && rel >= 0) { // shoulder-charged: thrown back and up, spinning, then flat on the turf
        const w = c01(rel / 0.35), fly = Math.sin(Math.min(1, w) * Math.PI);
        X += perpD[0] * -side * w * 3.2 + sdir[0] * w * 1.4; Z += perpD[2] * -side * w * 3.2 + sdir[2] * w * 1.4;
        pose.lift = fly * 1.3; pose.lean = { dx: perpD[0] * -side, dz: perpD[2] * -side, a: lerp(0.3, 1.55, w) }; pose.arms = 2; pose.rot = w * 2.4;
      } else if (rp.ult === 'charge') { pose.crouch = 0.25; pose.arms = 2; pose.strike = c01((rel + 0.12) / 0.12) * 0.5; }
      else if (rp.ult === 'sprint') { if (rel > -0.06) { fdx = sdir[0]; fdz = sdir[2]; pose.runPh = tRaw * 12 + k; pose.lean = { dx: sdir[0], dz: sdir[2], a: 0.3 }; const ch = Math.min(1, Math.max(0, rel) * 1.2); X += sdir[0] * ch * 4; Z += sdir[2] * ch * 4; pose.arms = 4; } else { pose.crouch = 0.3; pose.arms = 2; } }
      else if (rel < -0.09) { pose.crouch = 0.32; pose.arms = 2; }
      else if (rel < 0.03) { const w = c01((rel + 0.09) / 0.12); pose.strike = w * 0.8; pose.lean = { dx: perpD[0] * -side, dz: perpD[2] * -side, a: w * 0.55 }; pose.arms = 2; X += perpD[0] * -side * w * 0.9; Z += perpD[2] * -side * w * 0.9; }
      else { const w = c01((rel - 0.03) / 0.1); X += perpD[0] * -side * 0.9; Z += perpD[2] * -side * 0.9; pose.lean = { dx: perpD[0] * -side, dz: perpD[2] * -side, a: lerp(0.55, 1.45, w) }; pose.arms = 2; }
    } else if (rp.res === 'block' && idx === sc.blk) {
      // the blocker throws himself into the line of the shot — the ball stops on him
      const w = ease(c01((t - (sc.tStrike - 0.7)) / (0.7 + sc.tFlight * 0.8)));
      const tx = sc.end[0] + sdir[0] * 0.3, tz = sc.end[2] + sdir[2] * 0.3;
      X = lerp(X, tx, w); Z = lerp(Z, tz, w);
      fdx = -sdir[0]; fdz = -sdir[2];
      if (w < 1 && w > 0.02) pose.runPh = t * 15;
      if (fu > 0.35) { pose.runPh = undefined; pose.arms = 2; pose.strike = c01((fu - 0.35) / 0.65) * 0.8; pose.lean = { dx: -sdir[2] * sc.side, dz: sdir[0] * sc.side, a: Math.sin(c01((fu - 0.35) / 0.9) * Math.PI) * 0.55 }; }
      if (impact > 0) { pose.lean = { dx: sdir[0], dz: sdir[2], a: Math.min(0.5, impact * 1.2) }; pose.arms = 4; }
      pose.ring = 'rgba(255,209,102,.9)';
    } else if (p.t !== rp.t) {
      const k = ease(c01(t / sc.tStrike)) * 0.9;
      const dx = sc.shot[0] - X, dz = sc.shot[2] - Z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
      const mv = Math.min(2.2, dd * 0.25) * k;
      X += (dx / dd) * mv; Z += (dz / dd) * mv;
      fdx = dx / dd; fdz = dz / dd;
      if (t < sc.tStrike && k > 0.05 && k < 0.88 && intro < 0) pose.runPh = t * 13 + idx;
      if (dd < 4.5 && k0 > -0.25 && k0 < 0.45) { pose.strike = c01((k0 + 0.25) / 0.7) * 0.75; pose.lean = { dx: dx / dd, dz: dz / dd, a: 0.5 * Math.sin(c01((k0 + 0.25) / 0.7) * Math.PI) }; pose.arms = 2; } // the block attempt
      if (rp.res === 'goal' && impact > 0.6) { pose.crouch = 0.2; pose.arms = 0; }
    } else {
      if (idx === rp.as && !cele && intro < 0) { const wa = c01((t - sc.tP0 + 0.25) / 0.6); if (wa > 0 && wa < 1) pose.strike = wa; if (sc.passFrom) { fdx = sc.shot[0] - X; fdz = sc.shot[2] - Z; } }
      if (cele && mates.includes(idx)) {
        const mi = mates.indexOf(idx), lat = (mi - 2) * 1.25, bk = 1.5 + (mi % 2) * 0.9 + Math.abs(mi - 2) * 0.25;
        const tx = cele.pos[0] - sc.celeDir[0] * bk - sc.celeDir[2] * lat, tz = cele.pos[2] - sc.celeDir[2] * bk + sc.celeDir[0] * lat;
        const e = ease(c01((tc - 0.3 - mi * 0.12) / 1.9));
        X = lerp(X, tx, e); Z = lerp(Z, tz, e);
        fdx = cele.pos[0] - X; fdz = cele.pos[2] - Z;
        pose.arms = e > 0.85 ? 1 : 0; pose.happy = true; if (e < 0.95) pose.runPh = t * 15 + mi; pose.lift = e > 0.9 ? Math.abs(Math.sin(t * 8 + mi)) * 0.25 : 0;
      } else if (rp.res === 'goal' && impact > 0.3) { pose.arms = 1; pose.happy = true; pose.lift = Math.abs(Math.sin((impact - 0.3) * 6 + idx)) * 0.25; }
    }
    pose.fx = fdx; pose.fz = fdz;
    pose.front = frontOf(fdx, fdz);
    pose.num = p.num;
    pose.ring = p.user ? '#3df2ff' : isSh && !cele ? 'rgba(255,255,255,.75)' : pose.ring;
    const q = proj(cam, [X, 0, Z]);
    const kit = isGk ? undefined : msKits(ms)[p.t];
    if (kit) pose.kit = kit;
    const col = isGk ? (lum(ms.teams[p.t].col) > 0.5 ? '#16a34a' : '#f5d90a') : kit!.c1;
    const col2 = isGk ? '#1b1b1b' : (kit!.pat === 'plain' || kit!.pat === 'sleeves' ? kit!.c2 : ms.teams[p.t].col2) || '#111827';
    const face = faces[idx] ?? FALLBACK_FACE;
    // afterimages for the dribbling ultimates
    if (isSh && !cele && (rp.ult === 'trance' || rp.ult === 'sprint') && dribU >= 0) for (let gi = 1; gi <= 4; gi++) { const gp = dribAt(Math.max(0, dribU - gi * 0.035)); items.push({ z: proj(cam, gp).z, draw: () => drawPlayer(ctx, cam, gp[0], gp[2], ULT_STYLE[rp.ult!]?.col ?? col, col2, face, { ...pose, ring: undefined, glow: undefined, alpha: 0.4 - gi * 0.08 }) }); }
    else if (isSh && !cele && (rp.ult === 'trance' || rp.ult === 'sprint') && t < sc.tStrike + 0.2) for (let gi = 1; gi <= 3; gi++) { const gx = X - sdir[0] * gi * 1.1, gz2 = Z - sdir[2] * gi * 1.1 + (rp.ult === 'trance' ? (gi % 2 ? 0.7 : -0.7) : 0); items.push({ z: proj(cam, [gx, 0, gz2]).z, draw: () => drawPlayer(ctx, cam, gx, gz2, ULT_STYLE[rp.ult!]?.col ?? col, col2, face, { ...pose, ring: undefined, alpha: 0.34 - gi * 0.08 }) }); }
    if (intro >= 0 && !isSh && q.z < 6.5) continue; // nobody walks through the close-up
    if (intro >= 0 && !isSh) pose.alpha = 0.55;
    if (dribU >= 0 && !isSh && !sc.drib.includes(idx) && q.z < 5) continue;
    items.push({ z: q.z, draw: () => drawPlayer(ctx, cam, X, Z, col, col2, face, pose) });
  }
  // the free-kick wall: four defenders 9.15 m from the ball, jumping as he strikes
  if (rp.v === 'fk' && !cele) {
    const opp = 1 - rp.t, kit = msKits(ms)[opp], col2 = (kit.pat === 'plain' || kit.pat === 'sleeves' ? kit.c2 : ms.teams[opp].col2) || '#111827';
    const near = Math.sign(34 - sc.shot[2]) || 1;
    const c0: V3 = add([sc.shot[0], 0, sc.shot[2]], mul(sdir, 9.15));
    const jump = Math.sin(c01((t - sc.tStrike + 0.12) / 0.55) * Math.PI);
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 0.62 + near * 0.9, wp = add(c0, mul(perpD, off));
      const pose: Pose = { fx: -sdir[0], fz: -sdir[2], arms: 0, lift: jump * 0.55, kit, num: 2 + i * 3 };
      pose.front = frontOf(-sdir[0], -sdir[2]);
      items.push({ z: proj(cam, wp).z, draw: () => drawPlayer(ctx, cam, wp[0], wp[2], kit.c1, col2, FALLBACK_FACE, pose) });
    }
  }
  // Monster Trance: the monster itself hunts behind him
  if (rp.ult === 'trance' && !cele && (pre || t < sc.tStrike + 0.3)) {
    const mp = pre ? dribAt(Math.max(0, dribU - 0.09)) : add([sc.shot[0], 0, sc.shot[2]], mul(sdir, -2.6));
    items.push({ z: proj(cam, mp).z + 0.05, draw: () => drawMonster(ctx, cam, mp, sdir, tRaw, ULT_STYLE.trance) });
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
    for (let k = 0; k < 26 && fu <= 0.55; k++) { const a = (k / 26) * 6.283 + Math.floor(t * 30) * 0.37; const r0 = H * 0.42 + ((k * 37) % 50), r1 = r0 + 60 + ((k * 91) % 90); ctx.beginPath(); ctx.moveTo(bq.x + Math.cos(a) * r0, bq.y + Math.sin(a) * r0); ctx.lineTo(bq.x + Math.cos(a) * r1, bq.y + Math.sin(a) * r1); ctx.stroke(); }
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
  if (intro >= 0 && us) { ctx.fillStyle = us.col + '22'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 18; i++) { const y = ((i * 61) % 100) / 100 * H, sp = 0.6 + ((i * 37) % 10) / 8; const x = ((tRaw * sp + i * 0.13) % 1) * W * 1.4 - W * 0.2; ctx.strokeStyle = i % 2 ? us.col : us.col2; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * 0.18, y); ctx.stroke(); } ctx.globalAlpha = 1; }
  if (sc.long || us || cele || intro >= 0) { const bar = H * 0.085 * ease(c01(tRaw / 0.4)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
}

export function Replay3D({ ms, rp, onClose, auto, quick, g }: { ms: MatchState; rp: Replay; onClose?: () => void; auto?: boolean; quick?: boolean; g?: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0); // 0 playing, 1 result shown, 2 celebration, 3 finished
  const sc = buildScene(rp, quick, ms);
  const faces = useMemo<Face[]>(() => ms.pl.map((p) => { const wp = g?.world.players[p.id]; const mine = !!g && p.id === g.career.pid && !g.career.flags.playAs; const named = hasLook(wp?.name ?? p.nm); const f: Face = lookColours(mine ? g!.career.look : lookOf({ id: p.id, name: wp?.name ?? p.nm }), mine || named ? undefined : wp?.hair); try { if (f.cap) f.capP = new Path2D(f.cap); if (f.top) f.topP = new Path2D(f.top); } catch { /* no Path2D: hair is drawn as a cap only */ } return f; }), [ms, g]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0, t0 = 0, last = -1, st = sc.tIntro > 0 ? -1 : 0, closed = false;
    const trail: V3[] = [];
    setStage(st);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w < 40 || h < 30) { raf = requestAnimationFrame(frame); return; }
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const total = sc.tEnd + sc.tIntro + sc.tDrib;
      const tr = Math.min(total, (now - t0) / 1000), t = tr - sc.tIntro - sc.tDrib;
      if (tr !== last) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render(ctx, w, h, ms, sc, tr, trail, faces); last = tr; }
      const ns = tr >= total ? 3 : tr < sc.tIntro ? -1 : t < 0 ? 0 : rp.res === 'goal' && !sc.quick && t >= sc.tCele ? (t >= sc.tCele + 1.5 ? 2.5 : 2) : t >= sc.tStrike + sc.tFlight ? 1 : 0;
      if (ns !== st) { st = ns; setStage(ns); }
      if (tr < total) raf = requestAnimationFrame(frame);
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
      <div className="rp-top"><span className="rp-live"><i />{auto ? 'LIVE · 3D' : 'REPLAY'}</span><span className="rp-min">{rp.min}'</span><span className="rp-tag" style={us ? { background: us.col } : undefined}>{sc.fl.name.toUpperCase()}{sc.long ? ` · ${Math.round(rp.d)} M` : ''}</span>{us && <span className="rp-tag ult" style={{ background: us.col2 }}>{(ULT_NAME[rp.ult!] ?? 'ULTIMATE').toUpperCase()}</span>}{rp.ab && !us && <span className="rp-min">{rp.ab}</span>}{rp.skill && !us ? <span className="rp-min">{rp.skill === 2 ? 'SKILL MOVE' : 'TAKE-ON'}</span> : null}</div>
      <div className="rp-info">
        <div><b>{sh?.nm}</b>{as ? <span className="muted"> · assist {as.nm}</span> : null}</div>
        <div className="small">{stage >= 2 && stage < 3 ? `Celebration — ${CELE[sc.cele]}` : `${sc.fl.name} · ${Math.round(rp.d)} m · xG ${rp.xg.toFixed(2)} · chance ${Math.round(rp.p * 100)}%`}</div>
      </div>
      {stage === 1 && <div className={`rp-res ${rp.res}`} key={run}>{rp.res === 'block' && sc.blk >= 0 && ms.pl[sc.blk] ? `BLOCKED BY ${ms.pl[sc.blk].nm.toUpperCase()}` : RES_LABEL[rp.res]}{rp.res === 'goal' ? <small>{ms.teams[0].abbr} {rp.sc[0]}–{rp.sc[1]} {ms.teams[1].abbr}</small> : null}</div>}
      {stage === -1 && <div className="rp-say" key={'i' + run} style={us ? { borderColor: us.col } : undefined}><i>{us ? sh?.nm : 'Commentary'}</i><b>{us ? `“${ULT_LINES[rp.ult!]?.[0] ?? 'Watch.'}”` : LONG_LINES[rp.id % LONG_LINES.length].replace('{n}', sh?.nm ?? 'He').replace('{d}', String(Math.round(rp.d)))}</b></div>}
      {us && stage >= 2 && stage < 3 && <div className="rp-say low" key={'p' + stage + run} style={{ borderColor: us.col }}><i>{stage === 2 ? 'Commentary' : sh?.nm}</i><b>{stage === 2 ? ULT_LINES[rp.ult!]?.[1] : `“${ULT_LINES[rp.ult!]?.[2] ?? ''}”`}</b></div>}
      {stage >= 2 && stage < 3 && <div className="rp-cele" key={'c' + run}><b>{sh?.nm}</b><span>{ms.teams[0].abbr} {rp.sc[0]}–{rp.sc[1]} {ms.teams[1].abbr} · {rp.min}'</span></div>}
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
