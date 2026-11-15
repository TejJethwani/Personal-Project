/**
 * 3D dialogue scenes drawn with the match view's figure renderer: the tunnel face-off with a
 * rival before kick-off, and the post-match interview in the press room. The camera cuts to
 * whoever is speaking; the player answers with one of three tones.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game, Player } from '../engine/types';
import { lookOf, hasLook } from '../engine/data/looks';
import { teamInfo } from '../engine/match/setup';
import { lookColours } from './kit';
import { drawPlayer, mkCam, proj, poly, line, teamKit, type Face, type Pose, type V3, type Cam } from './Replay3D';

export interface Beat { who: 'me' | 'other' | 'reporter'; name: string; text: string }
export interface Choice { id: string; label: string; text: string }
function faceFor(g: Game, p: Player): Face {
  const mine = p.id === g.career.pid;
  const own = mine && !g.career.flags.playAs;
  const f: Face = lookColours(own ? g.career.look : lookOf(p), own || hasLook(p.name) ? undefined : p.hair);
  try { if (f.cap) f.capP = new Path2D(f.cap); if (f.top) f.topP = new Path2D(f.top); } catch { /* hair cap only */ }
  return f;
}
const kitOf = (g: Game, p: Player): [string, string] => { const id = p.club ?? p.nat; const t = teamInfo(g.world, id); const k = teamKit(id, t.col, t.col2 || '#111827'); return [k.c1, k.c2]; };

export function Cutscene3D({ g, kind, me, other, beats, choices, onChoose, onClose, title }: { g: Game; kind: 'tunnel' | 'press'; me: Player; other?: Player | null; beats: Beat[]; choices?: Choice[]; onChoose?: (id: string) => string[]; onClose: () => void; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<{ c: Choice; fx: string[] } | null>(null);
  const beat = picked ? { who: 'me' as const, name: me.sn, text: picked.c.text } : beats[Math.min(i, beats.length - 1)];
  const atChoice = !picked && i >= beats.length - 1 && !!choices?.length;
  const st = useRef({ who: beat.who, at: 0 });
  if (st.current.who !== beat.who) st.current = { who: beat.who, at: performance.now() };
  const faces = useMemo(() => ({ me: faceFor(g, me), other: other ? faceFor(g, other) : null, kitMe: kitOf(g, me), kitO: other ? kitOf(g, other) : (['#444c5c', '#20242c'] as [string, string]) }), [g, me, other]);
  useEffect(() => {
    const cv = ref.current; const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let raf = 0;
    const GREY: Face = { ...faces.me, skin: '#2a2f3a', hair: '#15181f', eye: '#15181f', capP: undefined, topP: undefined, cap: null, top: null, bald: true, beard: 0, acc: 0 };
    const draw = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (W < 40) { raf = requestAnimationFrame(draw); return; }
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now / 1000, who = st.current.who, since = (now - st.current.at) / 1000;
      const push = 1 - Math.exp(-since * 1.2);
      const talk = (w2: string): Pose => (who === w2 ? { arms: Math.sin(t * 5) > 0.2 ? 4 : 0, lean: { dx: 1, dz: 0, a: 0 } } : {});
      let cam: Cam;
      const actors: { z: number; d: () => void }[] = [];
      const A = (X: number, Z: number, col: string, col2: string, f: Face, p: Pose) => { const q = proj(cam, [X, 0, Z]); actors.push({ z: q.z, d: () => drawPlayer(ctx, cam, X, Z, col, col2, f, p) }); };
      if (kind === 'tunnel') {
        // two lines of players in a tunnel; the pitch glows at the far end
        const mp: V3 = [0, 0, -0.85], op: V3 = [0, 0, 0.85];
        cam = who === 'other' ? mkCam([-1.7 - push * 0.3, 1.62, -2.3], [0.1, 1.5, 0.85], H * (1.5 + push * 0.25), W, H)
          : who === 'me' ? mkCam([-1.7 - push * 0.3, 1.62, 2.3], [0.1, 1.5, -0.85], H * (1.5 + push * 0.25), W, H)
            : mkCam([-4.6, 1.7, 0], [0, 1.3, 0], H * 1.25, W, H);
        ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
        poly(ctx, cam, [[-8, 0, -2.6], [26, 0, -2.6], [26, 0, 2.6], [-8, 0, 2.6]], '#1b212c');
        poly(ctx, cam, [[-8, 0, -2.6], [26, 0, -2.6], [26, 3.2, -2.6], [-8, 3.2, -2.6]], '#10151d');
        poly(ctx, cam, [[-8, 0, 2.6], [26, 0, 2.6], [26, 3.2, 2.6], [-8, 3.2, 2.6]], '#131924');
        poly(ctx, cam, [[-8, 3.2, -2.6], [26, 3.2, -2.6], [26, 3.2, 2.6], [-8, 3.2, 2.6]], '#0a0d13');
        poly(ctx, cam, [[26, 0, -2.6], [26, 0, 2.6], [26, 3.2, 2.6], [26, 3.2, -2.6]], '#bfe9ff');
        poly(ctx, cam, [[20, 0, -2.6], [26, 0, -2.6], [26, 0, 2.6], [20, 0, 2.6]], '#2b6a45');
        for (let k = 0; k < 9; k++) for (const zs of [-2.58, 2.58]) poly(ctx, cam, [[-6 + k * 3.4, 2.5, zs], [-4.4 + k * 3.4, 2.5, zs], [-4.4 + k * 3.4, 2.72, zs], [-6 + k * 3.4, 2.72, zs]], k % 2 ? '#1ea7ff' : '#3df2ff');
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; line(ctx, cam, [-8, 0, 0], [26, 0, 0]);
        A(mp[0], mp[2], faces.kitMe[0], faces.kitMe[1], faces.me, { fx: 0, fz: 1, front: who !== 'other', glow: picked?.c.id === 'fire' ? '#ff2d75' : undefined, ...talk('me') });
        if (faces.other) A(op[0], op[2], faces.kitO[0], faces.kitO[1], faces.other, { fx: 0, fz: -1, front: who !== 'me', ...talk('other') });
        for (let k = 1; k <= 3; k++) { A(-k * 1.25, -0.85, faces.kitMe[0], faces.kitMe[1], { ...GREY, skin: '#c68a62', hair: '#1b1b1b', bald: false }, { fx: 1, fz: 0, front: false, alpha: 0.9 }); A(-k * 1.25, 0.85, faces.kitO[0], faces.kitO[1], { ...GREY, skin: '#e0ac86', hair: '#3b2a1e', bald: false }, { fx: 1, fz: 0, front: false, alpha: 0.9 }); }
      } else {
        // press room: backdrop, desk, microphones, reporters in the foreground, camera flashes
        cam = who === 'reporter' ? mkCam([0.6, 1.75, 6.4], [0, 1.2, 0], H * 1.15, W, H) : mkCam([Math.sin(t * 0.3) * 0.25, 1.5, 3.5 - push * 0.7], [0, 1.42, 0], H * (1.6 + push * 0.3), W, H);
        ctx.fillStyle = '#06080d'; ctx.fillRect(0, 0, W, H);
        poly(ctx, cam, [[-7, 0, -1.4], [7, 0, -1.4], [7, 4, -1.4], [-7, 4, -1.4]], '#0d1a33');
        for (let r = 0; r < 5; r++) for (let k = 0; k < 11; k++) { const x = -5.5 + k * 1.1, y = 0.7 + r * 0.6; poly(ctx, cam, [[x, y, -1.38], [x + 0.8, y, -1.38], [x + 0.8, y + 0.36, -1.38], [x, y + 0.36, -1.38]], (r + k) % 2 ? '#14305c' : faces.kitMe[0] + '55'); }
        poly(ctx, cam, [[-7, 0, -1.4], [7, 0, -1.4], [7, 0, 9], [-7, 0, 9]], '#141922');
        A(0, 0, faces.kitMe[0], faces.kitMe[1], faces.me, { fx: 0, fz: 1, front: true, ...talk('me') });
        actors.push({ z: proj(cam, [0, 0, 0.6]).z, d: () => { poly(ctx, cam, [[-2.2, 0, 0.55], [2.2, 0, 0.55], [2.2, 1.0, 0.55], [-2.2, 1.0, 0.55]], '#1b2233'); poly(ctx, cam, [[-2.2, 1.0, 0.55], [2.2, 1.0, 0.55], [2.2, 1.0, 0.1], [-2.2, 1.0, 0.1]], '#2a3348'); ctx.strokeStyle = '#0b0d12'; ctx.lineWidth = 3; for (const mx of [-0.35, 0, 0.35]) { line(ctx, cam, [mx, 1.0, 0.4], [mx * 0.6, 1.28, 0.25]); const q = proj(cam, [mx * 0.6, 1.3, 0.25]); ctx.fillStyle = '#0b0d12'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, (cam.fl / q.z) * 0.04), 0, 6.3); ctx.fill(); } } });
        for (let k = 0; k < 7; k++) A(-3 + k * 1.0 + (k % 2) * 0.2, 2.4 + (k % 3) * 0.7, '#1c212b', '#0e1116', GREY, { fx: 0, fz: -1, front: false, arms: who === 'reporter' && k === 3 ? 3 : 0 });
      }
      actors.sort((a, b) => b.z - a.z);
      for (const a of actors) if (a.z > 0.5) a.d();
      if (kind === 'press') for (let k = 0; k < 3; k++) { const ph = (t * 1.3 + k * 0.37) % 1; if (ph < 0.08) { const x = ((k * 97 + Math.floor(t * 1.3 + k * 0.37) * 53) % 100) / 100 * W, y = H * (0.55 + ((k * 31) % 30) / 100); const g2 = ctx.createRadialGradient(x, y, 0, x, y, H * 0.3); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); } }
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const bar = H * 0.09; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind, faces, picked]);
  return (
    <div className="cut3d">
      <canvas ref={ref} aria-label={title} />
      <div className="cut-top"><span className="rp-live"><i />{title}</span></div>
      <div className={`cut-say ${beat.who}`} key={(picked ? 'p' : 'b') + i} role="status"><i>{beat.name}</i><b>{beat.who === 'reporter' ? beat.text : `“${beat.text}”`}</b></div>
      <div className="cut-ui">
        {picked ? <><div className="row wrap gap4">{picked.fx.map((e, k) => <span key={k} className={`chip ${e.includes('−') || e.includes('-') ? 'r' : 'g'}`}>{e}</span>)}</div><button className="btn pri" onClick={onClose}>Continue ▶</button></>
          : atChoice ? <div className="cut-choices">{choices!.map((c) => <button key={c.id} className="opt" onClick={() => setPicked({ c, fx: onChoose?.(c.id) ?? [] })}><b style={{ fontSize: 15 }}>{c.label}</b><span className="small muted">“{c.text}”</span></button>)}</div>
            : <button className="btn pri" onClick={() => setI(i + 1)}>Next ▶</button>}
        {!picked && <button className="btn sm ghost" onClick={onClose}>Skip</button>}
      </div>
    </div>
  );
}
