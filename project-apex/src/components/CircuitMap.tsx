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
