/**
 * Cut-in animation played when an ultimate ability is unleashed. Every ultimate has its own
 * hand-drawn canvas motif (no assets): colour, geometry and motion are specific to the ability.
 */
import { useEffect, useRef } from 'react';
import type { MatchState, UltEvent } from '../engine/match/model';

export const ULT_STYLE: Record<string, { col: string; col2: string; tag: string }> = {
  dag: { col: '#b47bff', col2: '#3df2ff', tag: 'The angle that should not exist' },
  zero: { col: '#ffffff', col2: '#3df2ff', tag: 'No back-lift. No warning.' },
  trance: { col: '#ff2d75', col2: '#7b2bff', tag: 'The monster takes over' },
  puppet: { col: '#ffd166', col2: '#ff8a3d', tag: 'Every runner on a string' },
  sky: { col: '#7ad7ff', col2: '#ffffff', tag: 'The air belongs to one man' },
  chain: { col: '#2ee59d', col2: '#3df2ff', tag: 'One touch. Then another. Then another.' },
  sprint: { col: '#ffe14d', col2: '#ff8a3d', tag: 'Gone before the turn' },
  curtain: { col: '#aab6cc', col2: '#ff4d6d', tag: 'Nothing gets through' },
  dominion: { col: '#3df2ff', col2: '#1ea7ff', tag: 'The whole pitch, read in advance' },
  predator: { col: '#ff4d4d', col2: '#ffd166', tag: 'Locked on' },
  comet: { col: '#ff7a1a', col2: '#ffe14d', tag: 'A trail of fire from thirty metres' },
  charge: { col: '#c9a227', col2: '#ff4d4d', tag: 'Through them. Not round them.' },
  fk: { col: '#f6d77a', col2: '#ffffff', tag: 'The dead ball obeys one man' },
  crescent: { col: '#c9b8ff', col2: '#7ad7ff', tag: 'Out past the post — and back in' },
};
export const ULT_NAME: Record<string, string> = { crescent: 'Crescent Strike', comet: 'Comet Drive', charge: 'Bulldozer Charge', fk: 'Free-Kick Sovereign', dag: 'Dead Angle Genesis', zero: 'Zero-Frame Strike', trance: 'Monster Trance', puppet: 'Puppet-Master Pass', sky: 'Sky Tyrant', chain: 'Chain Reaction', sprint: 'God Sprint', curtain: 'Iron Curtain', dominion: 'Field Dominion', predator: "Predator's Eye" };
const DUR = 2300;
const e3 = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function motif(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, key: string, col: string, col2: string): void {
  const cx = W / 2, cy = H / 2, m = Math.min(W, H);
  ctx.lineCap = 'round';
  switch (key) {
    case 'dag': { // shards of a broken angle converging on the far corner
      const tx = W * 0.82, ty = H * 0.24;
      for (let i = 0; i < 26; i++) {
        const a = rnd(i) * 6.283, r0 = m * (0.9 + rnd(i + 9)), k = e3(t * 1.6 - rnd(i + 3) * 0.5);
        const x0 = tx + Math.cos(a) * r0, y0 = ty + Math.sin(a) * r0;
        const x1 = x0 + (tx - x0) * k, y1 = y0 + (ty - y0) * k;
        ctx.strokeStyle = i % 3 ? col : col2; ctx.globalAlpha = 0.25 + 0.6 * k; ctx.lineWidth = 1 + rnd(i + 5) * 4;
        ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      const k = e3(t * 2 - 0.6);
      ctx.beginPath(); ctx.moveTo(tx - m * 0.22 * k, ty); ctx.lineTo(tx, ty); ctx.lineTo(tx, ty + m * 0.22 * k); ctx.stroke();
      ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(tx - 14 * k, ty + 14 * k, 6 + 10 * Math.max(0, Math.sin(t * 20)) * (t > 0.6 ? 1 : 0), 0, 6.3); ctx.fill();
      break;
    }
    case 'zero': { // film frames collapsing to a single white frame
      for (let i = 0; i < 9; i++) {
        const k = e3(t * 2.2 - i * 0.06), w = W * 0.2, x = cx + (i - 4) * w * 1.08 * (1 - k);
        ctx.globalAlpha = 0.18 + 0.1 * i * (1 - k); ctx.strokeStyle = col2; ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2, cy - H * 0.27, w, H * 0.54);
      }
      ctx.globalAlpha = 1;
      const f = t > 0.45 && t < 0.62 ? 1 - Math.abs(t - 0.53) / 0.09 : 0;
      if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(0, 0, W, H); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W * e3(t * 3 - 1.2), cy); ctx.stroke();
      break;
    }
    case 'trance': { // jagged, feral zig-zag with two eyes
      ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.beginPath();
      const n = 16, k = e3(t * 1.5);
      for (let i = 0; i <= n * k; i++) { const x = (i / n) * W, y = cy + (i % 2 ? -1 : 1) * H * (0.1 + rnd(i) * 0.22); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      for (const s of [-1, 1]) { const ex = cx + s * m * 0.16, ey = H * 0.3, o = e3(t * 3 - 0.5); ctx.fillStyle = col2; ctx.beginPath(); ctx.ellipse(ex, ey, m * 0.07, m * 0.035 * o, s * -0.25, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, m * 0.012, m * 0.03 * o, 0, 0, 6.3); ctx.fill(); }
      for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.5; ctx.strokeStyle = i % 2 ? col : col2; ctx.lineWidth = 1.5; const a = rnd(i) * 6.3, r = m * (0.2 + rnd(i + 4) * 0.6) * (0.6 + t); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a + 0.2) * r * 1.12, cy + Math.sin(a + 0.2) * r * 1.12); ctx.stroke(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'puppet': { // strings dropping from above to moving runners, then the pass
      const pts = [0.18, 0.36, 0.55, 0.74, 0.88].map((x, i) => ({ x: W * x + Math.sin(t * 6 + i) * 10, y: H * (0.55 + 0.18 * Math.sin(i * 2.1)) - e3(t * 2 - 0.4) * H * 0.08 * (i % 2 ? 1 : -1) }));
      for (let i = 0; i < pts.length; i++) {
        const k = e3(t * 2.4 - i * 0.12);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pts[i].x - 30 + i * 12, 0); ctx.lineTo(pts[i].x, pts[i].y * k); ctx.stroke();
        ctx.globalAlpha = k; ctx.fillStyle = i === 3 ? '#fff' : col2; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y * k, m * 0.022, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1; const k = e3(t * 2.5 - 1.1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.quadraticCurveTo(cx, H * 0.95, pts[0].x + (pts[3].x - pts[0].x) * k, pts[0].y + (pts[3].y - pts[0].y) * k); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    case 'sky': { // rising streaks and a figure above the clouds
      for (let i = 0; i < 34; i++) { const x = rnd(i) * W, sp = 0.6 + rnd(i + 2) * 1.6, y = ((1 - ((t * sp + rnd(i + 7)) % 1)) * H * 1.3) - H * 0.15; ctx.strokeStyle = i % 4 ? col : col2; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + H * 0.12 * sp); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const y = H * (0.86 - e3(t * 1.7) * 0.5);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,255,255,${0.12 + i * 0.03})`; ctx.beginPath(); ctx.ellipse(W * (0.15 + i * 0.18), H * 0.82 + Math.sin(i) * 12, W * 0.16, H * 0.06, 0, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, y - m * 0.09, m * 0.028, 0, 6.3); ctx.fill(); ctx.fillRect(cx - m * 0.02, y - m * 0.06, m * 0.04, m * 0.09);
      ctx.strokeStyle = col2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, y - m * 0.03, m * (0.1 + 0.12 * ((t * 2) % 1)), 0, 6.3); ctx.globalAlpha = 1 - ((t * 2) % 1); ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'chain': { // nodes lighting up one after another
      const n = 6;
      const pt = (i: number) => ({ x: W * (0.1 + (i / (n - 1)) * 0.8), y: cy + (i % 2 ? -1 : 1) * H * 0.2 });
      for (let i = 0; i < n; i++) {
        const k = e3(t * 3.2 - i * 0.38), p = pt(i);
        if (i) { const q = pt(i - 1); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + (p.x - q.x) * k, q.y + (p.y - q.y) * k); ctx.stroke(); }
        ctx.fillStyle = k > 0.9 ? '#fff' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(p.x, p.y, m * 0.03, 0, 6.3); ctx.fill();
        if (k > 0.1 && k < 1) { ctx.strokeStyle = col2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, m * (0.03 + 0.08 * k), 0, 6.3); ctx.stroke(); }
      }
      break;
    }
    case 'sprint': { // horizontal speed lines and a lightning bolt
      for (let i = 0; i < 46; i++) { const y = rnd(i) * H, sp = 1 + rnd(i + 3) * 3, x = ((t * sp + rnd(i + 5)) % 1) * W * 1.4 - W * 0.2; ctx.strokeStyle = i % 3 ? col : col2; ctx.globalAlpha = 0.6; ctx.lineWidth = 1 + rnd(i + 8) * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * 0.14 * sp, y); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineJoin = 'miter'; ctx.beginPath();
      const k = e3(t * 3 - 0.3); const pts = [[0.05, 0.62], [0.32, 0.4], [0.3, 0.56], [0.6, 0.36], [0.57, 0.52], [0.96, 0.3]];
      for (let i = 0; i < pts.length * k; i++) { if (i) ctx.lineTo(pts[i][0] * W, pts[i][1] * H); else ctx.moveTo(pts[i][0] * W, pts[i][1] * H); }
      ctx.stroke();
      break;
    }
    case 'curtain': { // iron bars slamming down
      const n = 11;
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, Math.max(0, t * 3.4 - i * 0.07)), b = k >= 1 ? Math.max(0, 1 - (t * 3.4 - i * 0.07 - 1) * 4) * 10 : 0;
        const x = W * (0.06 + (i / (n - 1)) * 0.88), w = W * 0.05;
        const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#39414f'); g.addColorStop(0.5, col); g.addColorStop(1, '#2a303b');
        ctx.fillStyle = g; ctx.fillRect(x - w / 2, -H + H * 1.0 * k * k - b, w, H);
      }
      if (t > 0.5) { ctx.strokeStyle = col2; ctx.lineWidth = 6; ctx.globalAlpha = Math.min(1, (t - 0.5) * 4); ctx.beginPath(); ctx.moveTo(W * 0.3, H * 0.3); ctx.lineTo(W * 0.7, H * 0.7); ctx.moveTo(W * 0.7, H * 0.3); ctx.lineTo(W * 0.3, H * 0.7); ctx.stroke(); ctx.globalAlpha = 1; }
      break;
    }
    case 'dominion': { // a radar sweep over a grid
      ctx.strokeStyle = col2; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
      for (let i = 0; i <= 16; i++) { ctx.beginPath(); ctx.moveTo((i / 16) * W, 0); ctx.lineTo((i / 16) * W, H); ctx.stroke(); }
      for (let i = 0; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(0, (i / 9) * H); ctx.lineTo(W, (i / 9) * H); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let r = 0; r < 3; r++) { const k = (t * 1.3 + r / 3) % 1; ctx.strokeStyle = col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, k * W * 0.6, 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 20; i++) { const x = rnd(i) * W, y = rnd(i + 20) * H, d = Math.hypot(x - cx, y - cy) / (W * 0.6); if (d < t * 1.3) { ctx.fillStyle = i % 2 ? '#fff' : col; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd(i + 40) - 0.5) * 70, y + (rnd(i + 60) - 0.5) * 50); ctx.stroke(); } }
      break;
    }
    case 'predator': { // an eye opening and a reticle locking on
      const o = e3(t * 2.5);
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - m * 0.42, cy); ctx.quadraticCurveTo(cx, cy - m * 0.3 * o, cx + m * 0.42, cy); ctx.quadraticCurveTo(cx, cy + m * 0.3 * o, cx - m * 0.42, cy); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, m * 0.1 * o, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, cy, m * 0.022, m * 0.09 * o, 0, 0, 6.3); ctx.fill();
      const k = e3(t * 2.2 - 0.7), r = m * (0.5 - 0.3 * k);
      ctx.strokeStyle = col2; ctx.lineWidth = 2.5; ctx.save(); ctx.translate(cx, cy); ctx.rotate((1 - k) * 2.2);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * 1.25, 0); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'comet': { // a fireball streaking corner to corner, sparks peeling off its tail, then an impact flash
      const k = e3(t * 1.6 - 0.1), x0 = -W * 0.1, y0 = H * 0.92, x1 = W * 0.86, y1 = H * 0.2;
      const hx = x0 + (x1 - x0) * k, hy = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * H * 0.12;
      for (let i = 0; i < 28; i++) { const u = Math.max(0, k - i * 0.018); const tx = x0 + (x1 - x0) * u, ty = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * H * 0.12; ctx.globalAlpha = (1 - i / 28) * 0.8; ctx.fillStyle = i % 3 ? col : col2; ctx.beginPath(); ctx.arc(tx + (rnd(i) - 0.5) * 14, ty + (rnd(i + 3) - 0.5) * 14, m * (0.05 - i * 0.0014), 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1; const gr = ctx.createRadialGradient(hx, hy, 2, hx, hy, m * 0.09); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, col2); gr.addColorStop(1, col + '00'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, m * 0.09, 0, 6.3); ctx.fill();
      for (let i = 0; i < 18; i++) { const a = rnd(i + 30) * 6.3, r = m * 0.05 + ((t * 3 + rnd(i)) % 1) * m * 0.12; ctx.strokeStyle = col2; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r * 0.6, hy + Math.sin(a) * r * 0.6); ctx.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r); ctx.stroke(); }
      const f = t > 0.72 ? Math.max(0, 1 - (t - 0.72) * 4) : 0; if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = '#fff4d6'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'charge': { // the ground cracks, two shields shatter, a shockwave rolls outwards
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      const k = e3(t * 2);
      for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.05 - rnd(i) * Math.PI * 0.9; let x = cx, y = H * 0.8; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 1; j <= 5 * k; j++) { x += Math.cos(a + (rnd(i * 7 + j) - 0.5) * 0.9) * m * 0.07; y += Math.sin(a + (rnd(i * 5 + j) - 0.5) * 0.9) * m * 0.05; ctx.lineTo(x, y); } ctx.stroke(); }
      for (const s2 of [-1, 1]) { const sx = cx + s2 * m * 0.24, sy = H * 0.45, br = e3(t * 2.6 - 0.6); ctx.globalAlpha = 1; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.3; ctx.fillStyle = i % 2 ? '#8892a6' : '#aab6cc'; ctx.save(); ctx.translate(sx + Math.cos(a) * br * m * 0.22 * s2, sy + Math.sin(a) * br * m * 0.18); ctx.rotate(a + br * 3); ctx.fillRect(-m * 0.035, -m * 0.05, m * 0.07, m * 0.1); ctx.restore(); } }
      for (let r = 0; r < 3; r++) { const kk = (t * 1.4 + r / 3) % 1; ctx.strokeStyle = col2; ctx.globalAlpha = 1 - kk; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(cx, H * 0.8, kk * W * 0.6, kk * H * 0.16, 0, 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'crescent': { // a goal frame, a crescent moon, and the ball sweeping far outside the post and back in
      const gx = W * 0.6, gy = H * 0.3, gw = W * 0.26, gh = H * 0.22;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.strokeRect(gx, gy, gw, gh);
      ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(W * 0.2, H * 0.22, m * 0.09, 0, 6.3); ctx.fill(); ctx.fillStyle = '#05070d'; ctx.beginPath(); ctx.arc(W * 0.2 + m * 0.04, H * 0.2, m * 0.08, 0, 6.3); ctx.fill();
      const k = e3(t * 1.6 - 0.15); ctx.globalAlpha = 1; ctx.strokeStyle = col2; ctx.lineWidth = 5; ctx.beginPath();
      const P = (u: number) => [W * 0.1 + (gx + gw * 0.85 - W * 0.1) * u + Math.sin(u * Math.PI) * W * 0.32, H * 0.85 + (gy + gh * 0.5 - H * 0.85) * u - Math.sin(u * Math.PI) * H * 0.1] as const;
      for (let i = 0; i <= 50 * k; i++) { const [x, y] = P(i / 50); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); const [bx, by] = P(k); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, m * 0.022, 0, 6.3); ctx.fill();
      for (let i = 0; i < 14; i++) { const u = Math.max(0, k - i * 0.025); const [x, y] = P(u); ctx.fillStyle = col; ctx.globalAlpha = 0.5 * (1 - i / 14); ctx.beginPath(); ctx.arc(x, y, m * 0.02 * (1 - i / 16), 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'fk': { // a wall of four, a golden curl over it into the top corner, a crown above the goal
      const gx = W * 0.62, gy = H * 0.24, gw = W * 0.3, gh = H * 0.2;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.strokeRect(gx, gy, gw, gh);
      for (let i = 0; i < 4; i++) { const x = W * (0.36 + i * 0.045), y = H * 0.56, j = Math.sin(t * 14) * (t > 0.4 && t < 0.6 ? 4 : 0); ctx.fillStyle = '#d0d6e0'; ctx.beginPath(); ctx.arc(x, y - m * 0.07 - j, m * 0.018, 0, 6.3); ctx.fill(); ctx.fillRect(x - m * 0.014, y - m * 0.055 - j, m * 0.028, m * 0.08); }
      const k = e3(t * 1.7 - 0.25); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([2, 10]); ctx.globalAlpha = 1; ctx.beginPath();
      const P = (u: number) => [W * 0.12 + (gx + gw * 0.9 - W * 0.12) * u, H * 0.78 - Math.sin(u * Math.PI) * H * 0.55 + (gy + gh * 0.15 - H * 0.78) * u] as const;
      for (let i = 0; i <= 40 * k; i++) { const [x, y] = P(i / 40); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
      const [bx, by] = P(k); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, m * 0.02, 0, 6.3); ctx.fill();
      if (t > 0.7) { const c2 = e3((t - 0.7) * 4); ctx.fillStyle = col; ctx.globalAlpha = c2; const cx2 = gx + gw / 2, cy2 = gy - m * 0.08; ctx.beginPath(); ctx.moveTo(cx2 - m * 0.08, cy2 + m * 0.04); ctx.lineTo(cx2 - m * 0.08, cy2 - m * 0.03); ctx.lineTo(cx2 - m * 0.04, cy2); ctx.lineTo(cx2, cy2 - m * 0.05); ctx.lineTo(cx2 + m * 0.04, cy2); ctx.lineTo(cx2 + m * 0.08, cy2 - m * 0.03); ctx.lineTo(cx2 + m * 0.08, cy2 + m * 0.04); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
      break;
    }
    default: {
      for (let r = 0; r < 4; r++) { const k = (t * 1.5 + r / 4) % 1; ctx.strokeStyle = r % 2 ? col : col2; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, k * m * 0.7, 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
}

export function UltCutIn({ ms, ev, onDone }: { ms: MatchState; ev: UltEvent; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = ULT_STYLE[ev.key] ?? { col: '#3df2ff', col2: '#ffffff', tag: 'Ultimate' };
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) { onDone(); return; }
    let raf = 0, t0 = 0, fin = false;
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / DUR);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#04050b'); bg.addColorStop(1, '#0b0f1e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // slanted colour band behind the name
      const k = e3(t * 3);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.12);
      ctx.fillStyle = st.col; ctx.globalAlpha = 0.16; ctx.fillRect(-W, -H * 0.2, W * 2 * k, H * 0.4);
      ctx.globalAlpha = 1; ctx.restore();
      ctx.save(); motif(ctx, W, H, t, ev.key, st.col, st.col2); ctx.restore();
      ctx.globalAlpha = 1; ctx.setLineDash([]);
      if (t < 0.12) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.12})`; ctx.fillRect(0, 0, W, H); }
      if (t > 0.9) { ctx.fillStyle = `rgba(4,5,11,${(t - 0.9) / 0.1})`; ctx.fillRect(0, 0, W, H); }
      if (t < 1) raf = requestAnimationFrame(frame); else if (!fin) { fin = true; onDone(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.n]);
  const p = ms.pl[ev.idx];
  return (
    <div className="ultcut" style={{ ['--uc' as string]: st.col, ['--uc2' as string]: st.col2 }}>
      <canvas ref={ref} aria-hidden="true" />
      <div className="ultcut-txt" role="status">
        <span className="k">Ultimate · {ev.min}'</span>
        <b>{ev.name}</b>
        <i>{p?.nm} — {st.tag}</i>
      </div>
      <button className="btn sm ultcut-skip" onClick={onDone}>Skip ▶</button>
    </div>
  );
}
