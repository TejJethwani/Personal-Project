import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { hashString, Rng } from '@/engine/rng';
import type { Circuit } from '@/engine/types';

export const MAP_W = 420;
export const MAP_H = 270;

/**
 * Procedurally generated closed circuit outline, deterministic per circuit.
 * Control points around an ellipse with radius variation are joined with a
 * Catmull-Rom spline, giving every venue its own recognisable shape.
 */
export function circuitPath(circuit: Circuit): string {
  if (circuit.layout) return layoutPath(circuit);
  const rng = new Rng(hashString(`map:${circuit.id}`));
  const n = circuit.type === 'street' ? rng.int(11, 15) : rng.int(9, 13);
  const pts: [number, number][] = [];
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const rx = MAP_W * 0.42;
  const ry = MAP_H * 0.38;
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2 + rng.range(-0.18, 0.18);
    let r = rng.range(0.62, 1.0);
    if (rng.chance(circuit.type === 'street' ? 0.3 : 0.18)) r *= rng.range(0.45, 0.7); // hairpin / infield
    if (circuit.weights.straightLine > 0.16 && i % 3 === 0) r = Math.min(1, r * 1.15);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const tension = circuit.type === 'street' ? 0.12 : 0.18;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension * 2, p1[1] + (p2[1] - p0[1]) * tension * 2];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension * 2, p2[1] - (p3[1] - p1[1]) * tension * 2];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

// ---------------------------------------------------------------------------
// Category layouts. Each generator draws a closed loop in a unit box that is
// then fitted to the map, so every venue keeps a distinct, recognisable shape.
// ---------------------------------------------------------------------------

type Pt = [number, number];

/** Smooth closed curve through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(pts: Pt[], tension: number): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Polygon with rounded corners: straight lines between corners, arcs of radius r at each. */
function roundedPolygon(pts: Pt[], r: number): string {
  const n = pts.length;
  const corner = (i: number) => {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2.2);
    const rb = Math.min(r, lb / 2.2);
    const s: Pt = [p[0] + ((a[0] - p[0]) / la) * ra, p[1] + ((a[1] - p[1]) / la) * ra];
    const e: Pt = [p[0] + ((b[0] - p[0]) / lb) * rb, p[1] + ((b[1] - p[1]) / lb) * rb];
    return { s, e, p };
  };
  const cs = pts.map((_, i) => corner(i));
  let d = `M ${cs[0].e[0].toFixed(1)} ${cs[0].e[1].toFixed(1)}`;
  for (let k = 1; k <= n; k++) {
    const c = cs[k % n];
    d += ` L ${c.s[0].toFixed(1)} ${c.s[1].toFixed(1)} Q ${c.p[0].toFixed(1)} ${c.p[1].toFixed(1)} ${c.e[0].toFixed(1)} ${c.e[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Fit unit-box points into the map with margins, keeping the aspect ratio. */
function fit(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(1e-6, x1 - x0);
  const h = Math.max(1e-6, y1 - y0);
  const k = Math.min((MAP_W - 50) / w, (MAP_H - 46) / h);
  const ox = (MAP_W - w * k) / 2;
  const oy = (MAP_H - h * k) / 2;
  return pts.map(([x, y]) => [ox + (x - x0) * k, oy + (y - y0) * k]);
}

/** Street circuits: the outline of a few overlapping city blocks, all right angles. Null if the blocks do not form one clean loop. */
function streetLoop(rng: Rng): Pt[] | null {
  const W = 12;
  const H = 8;
  const grid: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const blocks = rng.int(3, 5);
  let cx = rng.int(2, 4);
  let cy = rng.int(2, 3);
  for (let b = 0; b < blocks; b++) {
    const w = rng.int(3, 6);
    const h = rng.int(2, 4);
    const x = Math.max(0, Math.min(W - w, cx + rng.int(-2, 2)));
    const y = Math.max(0, Math.min(H - h, cy + rng.int(-2, 2)));
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = true;
    cx = Math.max(0, Math.min(W - 2, x + rng.int(1, w)));
    cy = Math.max(0, Math.min(H - 2, y + rng.int(0, h)));
  }
  // Fill holes so the outline is a single loop.
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) if (!grid[j][i] && grid[j - 1][i] && grid[j + 1][i] && grid[j][i - 1] && grid[j][i + 1]) grid[j][i] = true;
  // Trace the boundary of the first connected shape (edges with filled cell on the left).
  const filled = (i: number, j: number) => j >= 0 && j < H && i >= 0 && i < W && grid[j][i];
  const edges = new Map<string, Pt>();
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!grid[j][i]) continue;
      if (!filled(i, j - 1)) edges.set(`${i},${j}`, [i + 1, j]);
      if (!filled(i + 1, j)) edges.set(`${i + 1},${j}`, [i + 1, j + 1]);
      if (!filled(i, j + 1)) edges.set(`${i + 1},${j + 1}`, [i, j + 1]);
      if (!filled(i - 1, j)) edges.set(`${i},${j + 1}`, [i, j]);
    }
  const start = edges.keys().next().value as string;
  const loop: Pt[] = [];
  let key = start;
  let closed = false;
  for (let guard = 0; guard < 400; guard++) {
    const [x, y] = key.split(',').map(Number);
    loop.push([x, y]);
    const next = edges.get(key);
    if (!next) break;
    key = `${next[0]},${next[1]}`;
    if (key === start) {
      closed = true;
      break;
    }
  }
  // Every boundary edge must belong to this one loop (no islands, no pinch points).
  if (!closed || loop.length !== edges.size) return null;
  // Keep only the corners.
  const corners = loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length];
    const b = loop[(i + 1) % loop.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
  return corners.length >= 6 ? corners : null;
}

/** Speed bowls: a long rounded triangle or D-shape with a chicane or two. */
function speedwayLoop(rng: Rng): Pt[] {
  const sides = rng.int(3, 4);
  const pts: Pt[] = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2;
    const r = rng.range(0.85, 1.05);
    pts.push([Math.cos(a) * r * 1.6, Math.sin(a) * r]);
    if (rng.chance(0.55)) {
      // Chicane on the following straight.
      const b = phase + ((i + 0.5) / sides) * Math.PI * 2;
      const r2 = r * rng.range(0.55, 0.7);
      pts.push([Math.cos(b) * r2 * 1.6 * 1.02, Math.sin(b) * r2 * 1.02]);
      pts.push([Math.cos(b + 0.06) * r2 * 1.6 * 0.94, Math.sin(b + 0.06) * r2 * 0.94]);
    }
  }
  return pts;
}

/** Mountain roads: a long climb of switchbacks and a fast descent. */
function mountainLoop(rng: Rng): Pt[] {
  const pts: Pt[] = [];
  const bends = rng.int(4, 6);
  const width = rng.range(0.5, 0.8);
  // Zig-zag climb up the left side.
  for (let i = 0; i <= bends; i++) {
    const y = 1 - i / bends;
    pts.push([i % 2 === 0 ? 0 : width, y * 1.6]);
  }
  // Summit plateau and a sweeping descent on the right.
  pts.push([width + rng.range(0.5, 0.8), -0.15]);
  const down = rng.int(3, 4);
  for (let i = 1; i <= down; i++) pts.push([width + 1 + Math.sin(i * 1.7) * 0.35, (i / down) * 1.6 + rng.range(-0.08, 0.08)]);
  pts.push([width * 0.6, 1.85]);
  return pts;
}

/** Club / kart tracks: compact and full of tight corners. */
function kartLoop(rng: Rng): Pt[] {
  const n = rng.int(12, 16);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.18, 0.18);
    const r = rng.chance(0.55) ? rng.range(0.75, 1) : rng.range(0.38, 0.7);
    pts.push([Math.cos(a) * r * 1.3, Math.sin(a) * r]);
  }
  return pts;
}

/** Mirror or turn a layout so venues of one category do not all face the same way. */
function orient(rng: Rng, pts: Pt[]): Pt[] {
  const flipX = rng.chance(0.5);
  const flipY = rng.chance(0.5);
  const turn = rng.chance(0.3);
  return pts.map(([x, y]) => {
    let p: Pt = [flipX ? -x : x, flipY ? -y : y];
    if (turn) p = [p[1] * 1.5, p[0] / 1.5];
    return p;
  });
}

/** Endurance loops: very long, irregular, with fast sweeps and slow villages. */
function enduranceLoop(rng: Rng): Pt[] {
  const n = rng.int(18, 24);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.75 + Math.sin(a * 3 + rng.range(0, 1)) * 0.12 + rng.range(-0.12, 0.12);
    pts.push([Math.cos(a) * r * 2.1, Math.sin(a) * r * 0.9 + Math.sin(a * 2) * 0.15]);
  }
  return pts;
}

/** Stop-and-go: straights joined by hairpins, a star of long and short radii. */
function stopGoLoop(rng: Rng): Pt[] {
  const n = rng.int(5, 7) * 2;
  const pts: Pt[] = [];
  const phase = rng.range(0, Math.PI);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? rng.range(0.95, 1.1) : rng.range(0.3, 0.5);
    pts.push([Math.cos(a) * r * 1.5, Math.sin(a) * r]);
  }
  return pts;
}

/** Technical / high-downforce: many medium corners in esses. */
function technicalLoop(rng: Rng): Pt[] {
  const n = rng.int(13, 17);
  const pts: Pt[] = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const r = 0.72 + Math.sin(i * 1.9) * 0.18 + rng.range(-0.08, 0.08);
    pts.push([Math.cos(a) * r * 1.5, Math.sin(a) * r]);
  }
  return pts;
}

/** Flowing permanent circuits: open sweeps and one or two slower complexes. */
function flowingLoop(rng: Rng): Pt[] {
  const n = rng.int(8, 11);
  const pts: Pt[] = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
    let r = rng.range(0.75, 1);
    if (rng.chance(0.2)) r *= rng.range(0.55, 0.75);
    pts.push([Math.cos(a) * r * 1.55, Math.sin(a) * r]);
  }
  return pts;
}

function layoutPath(circuit: Circuit): string {
  const rng = new Rng(hashString(`layout:${circuit.id}`));
  switch (circuit.layout) {
    case 'street': {
      for (let i = 0; i < 40; i++) {
        const loop = streetLoop(rng);
        if (loop) return roundedPolygon(fit(loop), 9);
      }
      return roundedPolygon(fit([[0, 0], [5, 0], [5, 2], [3, 2], [3, 4], [0, 4]]), 9);
    }
    case 'speedway':
      return smoothPath(fit(speedwayLoop(rng)), 0.2);
    case 'mountain':
      return roundedPolygon(fit(orient(rng, mountainLoop(rng))), 11);
    case 'kart':
      return smoothPath(fit(kartLoop(rng)), 0.16);
    case 'endurance':
      return smoothPath(fit(orient(rng, enduranceLoop(rng))), 0.15);
    case 'stopgo':
      return roundedPolygon(fit(orient(rng, stopGoLoop(rng))), 7);
    case 'technical':
      return smoothPath(fit(technicalLoop(rng)), 0.17);
    default:
      return smoothPath(fit(flowingLoop(rng)), 0.19);
  }
}

export interface PathSampler {
  at: (fraction: number) => { x: number; y: number };
  length: number;
}

/** Sample the path into a lookup table for fast marker placement. */
export function useCircuitSampler(d: string): { ref: RefObject<SVGPathElement>; sampler: PathSampler | null } {
  const ref = useRef<SVGPathElement>(null);
  const [sampler, setSampler] = useState<PathSampler | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.getTotalLength !== 'function') return;
    const length = el.getTotalLength();
    const N = 500;
    const table: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const p = el.getPointAtLength((i / N) * length);
      table.push({ x: p.x, y: p.y });
    }
    setSampler({
      length,
      at: (f) => {
        const t = ((f % 1) + 1) % 1;
        const idx = t * N;
        const i = Math.floor(idx);
        const frac = idx - i;
        const a = table[i];
        const b = table[Math.min(N, i + 1)];
        return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
      },
    });
  }, [d]);
  return { ref, sampler };
}

export function CircuitOutline({ circuit, children, className, highlightSectors = true }: { circuit: Circuit; children?: (sampler: PathSampler) => ReactNode; className?: string; highlightSectors?: boolean }) {
  const d = useMemo(() => circuitPath(circuit), [circuit]);
  const { ref, sampler } = useCircuitSampler(d);
  const s1 = circuit.sectors[0];
  const s2 = circuit.sectors[0] + circuit.sectors[1];
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className={className} role="img" aria-label={`${circuit.name} map`}>
      <defs>
        <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={d} fill="none" stroke="#000" strokeWidth={15} strokeLinejoin="round" opacity={0.6} />
      <path ref={ref} d={d} fill="none" stroke="#2b303a" strokeWidth={10} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#3a404c" strokeWidth={1} strokeDasharray="2 6" />
      {sampler && highlightSectors && (
        <>
          {[0, s1, s2].map((f, i) => {
            const p = sampler.at(f);
            const q = sampler.at(f + 0.003);
            const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
            return (
              <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${ang})`}>
                <rect x={-1.5} y={-9} width={3} height={18} fill={i === 0 ? '#fff' : i === 1 ? '#facc15' : '#a855f7'} opacity={i === 0 ? 1 : 0.7} />
              </g>
            );
          })}
          <text x={sampler.at(0).x + 8} y={sampler.at(0).y - 10} fill="#8b93a3" fontSize={9} fontFamily="Barlow Condensed" letterSpacing={1}>
            START / FINISH
          </text>
        </>
      )}
      {sampler && children?.(sampler)}
    </svg>
  );
}
