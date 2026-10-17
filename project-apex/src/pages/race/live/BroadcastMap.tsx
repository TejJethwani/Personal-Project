import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { driverCode } from '@/engine/drivers/ratings';
import { liveBattles } from '@/engine/race/analysis';
import type { CarRaceState, Circuit, RaceState } from '@/engine/types';
import { circuitPath, MAP_H, MAP_W, useCircuitSampler } from '@/components/CircuitMap';
import { useGame } from '@/store/gameStore';

export interface AnimState {
  start: number;
  f: number;
  prevGaps: Map<string, number>;
  prevLap: number;
}

export type Camera = 'full' | 'follow' | 'battle';

const PIT_WINDOW = 0.045;

/** Sector status of a car's last lap: purple (overall best), green (personal best) or yellow. */
export function sectorColors(race: RaceState, car: CarRaceState | undefined): string[] {
  if (!car || car.lastLap <= 0) return ['#64748b', '#64748b', '#64748b'];
  const best = [0, 1, 2].map((k) => Math.min(...race.cars.map((c) => c.bestSectors[k])));
  return [0, 1, 2].map((k) => {
    const s = car.sectors[k];
    if (Math.abs(s - best[k]) < 0.0005) return '#a855f7';
    if (Math.abs(s - car.bestSectors[k]) < 0.0005) return '#22c55e';
    return '#facc15';
  });
}

/**
 * Broadcast track map. Cars glide between lap states (positions come from the
 * real gaps), battles glow, cars that pit cut through the pit lane, the
 * safety car leads the queue under caution, and the camera can follow a car
 * or the closest battle. Purely a view of the race state.
 */
export function BroadcastMap({ race, circuit, anim, leaderLapRef, camera, followId, sectorCar }: { race: RaceState; circuit: Circuit; anim: MutableRefObject<AnimState>; leaderLapRef: MutableRefObject<number>; camera: Camera; followId: string | null; sectorCar: string | null }) {
  const game = useGame();
  const d = useMemo(() => circuitPath(circuit), [circuit]);
  const { ref, sampler } = useCircuitSampler(d);
  const svgRef = useRef<SVGSVGElement>(null);
  const markers = useRef<Record<string, SVGGElement | null>>({});
  const scRef = useRef<SVGGElement>(null);
  const battleRefs = useRef<(SVGLineElement | null)[]>([]);
  const hazardRef = useRef<SVGGElement>(null);
  const raceRef = useRef(race);
  raceRef.current = race;
  const camRef = useRef({ camera, followId });
  camRef.current = { camera, followId };
  const vb = useRef([0, 0, MAP_W, MAP_H]);
  const s1 = circuit.sectors[0];
  const s2 = circuit.sectors[0] + circuit.sectors[1];
  const battles = liveBattles(race, 0.9).slice(0, 6);
  const battlesRef = useRef(battles);
  battlesRef.current = battles;

  // Sector overlays and pit lane, sampled from the track path.
  const geo = useMemo(() => {
    if (!sampler) return null;
    const seg = (from: number, to: number) => {
      const pts: string[] = [];
      for (let f = from; f <= to + 1e-9; f += 0.004) {
        const p = sampler.at(f);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      return `M ${pts.join(' L ')}`;
    };
    const pit = () => {
      const pts: string[] = [];
      for (let f = -PIT_WINDOW; f <= PIT_WINDOW + 1e-9; f += 0.003) {
        const p = sampler.at(f);
        const q = sampler.at(f + 0.002);
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        // Offset towards the inside of the track (left of the direction of travel).
        const nx = -(q.y - p.y) / len;
        const ny = (q.x - p.x) / len;
        pts.push(`${(p.x + nx * 11).toFixed(1)},${(p.y + ny * 11).toFixed(1)}`);
      }
      return `M ${pts.join(' L ')}`;
    };
    return { sectors: [seg(0, s1), seg(s1, s2), seg(s2, 1)], pit: pit() };
  }, [sampler, s1, s2]);

  useEffect(() => {
    if (!sampler) return;
    let raf = 0;
    const pitOffset = (frac: number) => {
      const t = ((frac % 1) + 1) % 1;
      const inWindow = t > 1 - PIT_WINDOW || t < PIT_WINDOW;
      if (!inWindow) return null;
      const p = sampler.at(frac);
      const q = sampler.at(frac + 0.002);
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: p.x - ((q.y - p.y) / len) * 11, y: p.y + ((q.x - p.x) / len) * 11 };
    };
    const loop = () => {
      const r = raceRef.current;
      const f = Math.max(0, Math.min(1, anim.current.f));
      const lapLen = leaderLapRef.current;
      const pos = new Map<string, { x: number; y: number; frac: number }>();
      for (const car of r.cars) {
        const el = markers.current[car.driverId];
        if (!el) continue;
        if (car.status !== 'running') {
          el.setAttribute('opacity', '0');
          continue;
        }
        const prev = anim.current.prevGaps.get(car.driverId) ?? car.gapToLeader;
        const gap = r.finished ? car.gapToLeader : prev + (car.gapToLeader - prev) * f;
        const frac = (r.lap === 0 ? 0 : f) - gap / lapLen;
        let p = sampler.at(frac);
        const last = car.stints[car.stints.length - 1];
        const pitting = r.lap > 0 && last.fromLap === r.lap + 1 && !r.finished;
        if (pitting) p = pitOffset(frac) ?? p;
        pos.set(car.driverId, { x: p.x, y: p.y, frac });
        el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        el.setAttribute('opacity', '1');
      }
      // Safety car just ahead of the leader.
      const leader = r.cars.find((c) => c.position === 1 && c.status === 'running');
      if (scRef.current) {
        const lp = leader ? pos.get(leader.driverId) : null;
        if (r.safetyCar.type === 'sc' && lp && !r.finished) {
          const p = sampler.at(lp.frac + 0.018);
          scRef.current.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
          scRef.current.setAttribute('opacity', '1');
        } else scRef.current.setAttribute('opacity', '0');
      }
      // Battles.
      battlesRef.current.forEach((b, i) => {
        const line = battleRefs.current[i];
        const a = pos.get(b.ahead.driverId);
        const c = pos.get(b.behind.driverId);
        if (!line) return;
        if (!a || !c) {
          line.setAttribute('opacity', '0');
          return;
        }
        line.setAttribute('x1', a.x.toFixed(1));
        line.setAttribute('y1', a.y.toFixed(1));
        line.setAttribute('x2', c.x.toFixed(1));
        line.setAttribute('y2', c.y.toFixed(1));
        line.removeAttribute('opacity');
      });
      for (let i = battlesRef.current.length; i < battleRefs.current.length; i++) battleRefs.current[i]?.setAttribute('opacity', '0');
      // A car that retired this lap leaves a hazard where it was last timed.
      if (hazardRef.current) {
        const out = r.cars.find((c) => c.status !== 'running' && c.retiredLap === r.lap && r.lap > 0);
        if (out && !r.finished) {
          const p = sampler.at(-out.gapToLeader / lapLen);
          hazardRef.current.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
          hazardRef.current.setAttribute('opacity', '1');
        } else hazardRef.current.setAttribute('opacity', '0');
      }
      // Camera.
      const cam = camRef.current;
      let target = [0, 0, MAP_W, MAP_H];
      let focus: { x: number; y: number } | null = null;
      if (cam.camera === 'follow' && cam.followId) focus = pos.get(cam.followId) ?? null;
      if (cam.camera === 'battle') {
        const b = battlesRef.current[0];
        const a = b ? pos.get(b.ahead.driverId) : null;
        const c = b ? pos.get(b.behind.driverId) : null;
        if (a && c) focus = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
        else if (cam.followId) focus = pos.get(cam.followId) ?? null;
      }
      if (focus) {
        const z = 2.4;
        const w = MAP_W / z;
        const h = MAP_H / z;
        target = [Math.max(-20, Math.min(MAP_W - w + 20, focus.x - w / 2)), Math.max(-20, Math.min(MAP_H - h + 20, focus.y - h / 2)), w, h];
      }
      const cur = vb.current;
      for (let k = 0; k < 4; k++) cur[k] += (target[k] - cur[k]) * 0.12;
      svgRef.current?.setAttribute('viewBox', cur.map((v) => v.toFixed(1)).join(' '));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sampler, anim, leaderLapRef]);

  const caution = race.safetyCar.type !== 'none' && !race.finished;
  const wx = race.weather[Math.max(0, race.lap - 1)] ?? race.weather[0];
  const sectorStatus = sectorColors(race, race.cars.find((c) => c.driverId === sectorCar));
  const ordered = [...race.cars].sort((a, b) => b.position - a.position);
  const labelled = new Set([...race.cars.filter((c) => c.isPlayer || c.position <= 3).map((c) => c.driverId), ...(followId ? [followId] : [])]);
  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-[300px] w-full xl:h-[380px]" role="img" aria-label={`${circuit.name} live map`}>
        <path d={d} fill="none" stroke="#000" strokeWidth={15} strokeLinejoin="round" opacity={0.6} />
        <path ref={ref} d={d} fill="none" stroke={caution ? '#3f3a1c' : wx.wetness > 0.3 ? '#253446' : '#2b303a'} strokeWidth={10} strokeLinejoin="round" />
        {geo && (
          <>
            <path d={geo.pit} fill="none" stroke="#475569" strokeWidth={3} strokeDasharray="3 3" />
            {geo.sectors.map((sd, k) => (
              <path key={k} d={sd} fill="none" stroke={caution ? '#facc15' : sectorStatus[k]} strokeWidth={2} opacity={caution ? 0.8 : 0.55} strokeLinejoin="round" />
            ))}
          </>
        )}
        {sampler &&
          [0, s1, s2].map((f, i) => {
            const p = sampler.at(f);
            const q = sampler.at(f + 0.003);
            const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
            return (
              <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${ang})`}>
                <rect x={-1.5} y={-9} width={3} height={18} fill={i === 0 ? '#fff' : '#94a3b8'} />
              </g>
            );
          })}
        {sampler && (
          <text x={sampler.at(0).x + 8} y={sampler.at(0).y - 12} fill="#8b93a3" fontSize={9} fontFamily="Barlow Condensed" letterSpacing={1}>
            PIT · START / FINISH
          </text>
        )}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} ref={(el) => (battleRefs.current[i] = el)} stroke="#ef4444" strokeWidth={5} strokeLinecap="round" className="battle-glow" opacity={0} />
        ))}
        <g ref={hazardRef} opacity={0}>
          <polygon points="0,-8 7,5 -7,5" fill="#facc15" stroke="#000" strokeWidth={1} />
          <text y={3.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#000">
            !
          </text>
        </g>
        {ordered.map((c) => {
          const team = game.teams[c.teamId];
          const dr = game.drivers[c.driverId];
          const big = c.isPlayer || c.driverId === followId;
          return (
            <g key={c.driverId} ref={(el) => (markers.current[c.driverId] = el)} opacity={0}>
              <circle r={big ? 7.5 : 5.5} fill={team?.colors.primary ?? '#999'} stroke={big ? '#fff' : team?.colors.secondary ?? '#000'} strokeWidth={big ? 2.2 : 1.4} />
              {labelled.has(c.driverId) && (
                <text y={-11} textAnchor="middle" fontSize={big ? 10 : 8.5} fontWeight={700} fill={big ? '#fff' : '#cbd5e1'} fontFamily="Barlow Condensed" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>
                  {c.position} {dr ? driverCode(dr) : ''}
                </text>
              )}
            </g>
          );
        })}
        <g ref={scRef} opacity={0}>
          <rect x={-10} y={-6} width={20} height={12} rx={3} fill="#f59e0b" stroke="#000" />
          <text y={3.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#000" fontFamily="Barlow Condensed">
            SC
          </text>
        </g>
      </svg>
      {wx.rain > 0.1 && <div className="rain-overlay pointer-events-none absolute inset-0 rounded" style={{ opacity: Math.min(0.9, 0.3 + wx.rain) }} />}
    </div>
  );
}
