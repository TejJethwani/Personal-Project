import { motion } from 'framer-motion';
import { AlertTriangle, Swords } from 'lucide-react';
import { driverCode } from '@/engine/drivers/ratings';
import { liveBattles, livePoints, rejoinEstimate } from '@/engine/race/analysis';
import { championshipPoints } from '@/engine/championship/standings';
import { pointsTable } from '@/engine/config/divisions';
import type { CalendarEvent, CarRaceState, Circuit, RaceState } from '@/engine/types';
import { TireIcon } from '@/components/common';
import { Badge, cn, Segmented } from '@/components/ui';
import { useGame } from '@/store/gameStore';
import { sectorColors } from './BroadcastMap';

export type GapMode = 'interval' | 'leader';

function gapText(c: CarRaceState, race: RaceState, mode: GapMode, leaderLap: number): string {
  if (c.status !== 'running') return c.retireReason ?? 'Retired';
  if (race.lap === 0) return `Grid ${c.grid}`;
  if (c.position === 1) return race.finished ? 'Winner' : `Lap ${race.lap}`;
  if (mode === 'leader') {
    const laps = Math.floor(c.gapToLeader / Math.max(20, leaderLap));
    if (laps >= 1) return `+${laps} L${laps > 1 ? 'aps' : 'ap'}`;
    return `+${c.gapToLeader.toFixed(3)}`;
  }
  return c.interval > 60 ? `+${c.interval.toFixed(1)}` : `+${c.interval.toFixed(3)}`;
}

function pitStatus(c: CarRaceState, race: RaceState): { label: string; tone: 'amber' | 'blue' | 'red' } | null {
  if (c.status !== 'running') return { label: c.status === 'dsq' ? 'DSQ' : 'OUT', tone: 'red' };
  const last = c.stints[c.stints.length - 1];
  if (race.lap > 0 && last.fromLap === race.lap + 1) return { label: 'PIT', tone: 'amber' };
  if (race.lap > 1 && last.fromLap === race.lap) return { label: 'OUT LAP', tone: 'blue' };
  if (c.pitRequest) return { label: 'BOX', tone: 'amber' };
  return null;
}

/**
 * Timing tower: position changes, gap or interval, tyre and its age, stops,
 * last-lap sectors, battles, fastest lap, live points, and a ghost row
 * showing where the focused car would rejoin if it pitted now.
 */
export function Tower({ race, event, circuit, mode, setMode, selected, onSelect, rejoinFor }: { race: RaceState; event: CalendarEvent; circuit: Circuit; mode: GapMode; setMode: (m: GapMode) => void; selected: string | null; onSelect: (id: string) => void; rejoinFor: string | null }) {
  const game = useGame();
  const order = [...race.cars].sort((a, b) => a.position - b.position);
  const prevOrder = race.lapOrders[race.lapOrders.length - 2] ?? race.lapOrders[0];
  const leader = order[0];
  const leaderLap = race.lap > 0 && leader ? leader.lastLap : race.baseLapTime;
  const battling = new Set(liveBattles(race).flatMap((b) => [b.ahead.driverId, b.behind.driverId]));
  const sys = event.pointsPreset ? pointsTable(event.pointsPreset, race.cars.length) : championshipPoints(game, event.division);
  const points = livePoints(race, sys);
  const h2h = event.pointsPreset === 'h2h';
  const rejoinCar = rejoinFor ? race.cars.find((c) => c.driverId === rejoinFor && c.status === 'running') : null;
  const rejoin = rejoinCar && race.lap > 0 && !race.finished ? rejoinEstimate(race, rejoinCar, circuit) : null;
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-apex-line bg-gradient-to-r from-apex-red/30 to-transparent px-3 py-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.14em]">Timing</span>
        <Segmented
          size="xs"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'interval', label: 'Interval' },
            { value: 'leader', label: 'Leader' },
          ]}
        />
      </div>
      <div className="max-h-[720px] divide-y divide-apex-line/50 overflow-y-auto">
        {order.map((c) => {
          const d = game.drivers[c.driverId];
          const team = game.teams[c.teamId];
          const before = prevOrder.indexOf(c.driverId) + 1;
          const change = c.status === 'running' && before > 0 ? before - c.position : 0;
          const sinceStart = c.status === 'running' && race.lap > 0 ? c.grid - c.position : 0;
          const ps = pitStatus(c, race);
          const sectors = sectorColors(race, c);
          const pts = points.get(c.driverId) ?? 0;
          const ghost = rejoin && rejoinCar && c.status === 'running' && c.driverId !== rejoinCar.driverId && rejoin.aheadOf?.driverId === c.driverId;
          return (
            <div key={c.driverId}>
              {ghost && <RejoinRow code={driverCode(game.drivers[rejoinCar!.driverId])} position={rejoin!.position} />}
              <motion.button
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                onClick={() => onSelect(c.driverId)}
                className={cn('grid w-full grid-cols-[24px_16px_5px_40px_1fr_auto_30px_20px] items-center gap-1.5 px-2 py-[5px] text-left text-sm', c.isPlayer && 'bg-apex-red/[0.12]', selected === c.driverId && 'ring-1 ring-inset ring-white/30', c.status !== 'running' && 'opacity-50')}
                title={`${d?.firstName ?? ''} ${d?.lastName ?? ''} · grid P${c.grid}${sinceStart ? ` · ${sinceStart > 0 ? '+' : ''}${sinceStart} since the start` : ''} · ${c.pitStops} stop${c.pitStops === 1 ? '' : 's'}`}
              >
                <span className="num text-center font-bold">{c.status === 'running' ? c.position : '—'}</span>
                <span className={cn('text-center text-[10px]', change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-apex-dim')}>{change > 0 ? `▲${change}` : change < 0 ? `▼${-change}` : '·'}</span>
                <span className="h-4 w-1 rounded" style={{ background: team?.colors.primary }} />
                <span className={cn('font-display font-bold tracking-wide', c.isPlayer && 'text-white')}>{d ? driverCode(d) : '?'}</span>
                <span className={cn('mono flex items-center justify-end gap-1 truncate text-right text-xs', c.status !== 'running' ? 'text-red-300' : battling.has(c.driverId) && mode === 'interval' ? 'text-red-300' : 'text-apex-muted')}>
                  {battling.has(c.driverId) && <Swords size={10} className="shrink-0" />}
                  {gapText(c, race, mode, leaderLap)}
                  {c.penaltySeconds > 0 && <span className="text-amber-300">+{c.penaltySeconds}s</span>}
                </span>
                <span className="flex items-center gap-1">
                  {ps && (
                    <Badge tone={ps.tone} className="px-1 py-0 text-[9px]">
                      {ps.label}
                    </Badge>
                  )}
                  {race.fastestLap?.driverId === c.driverId && <span className="h-2 w-2 rounded-full bg-apex-purple" title="Fastest lap" />}
                  {c.isPlayer && c.warning && <AlertTriangle size={12} className="animate-pulseRed text-red-400" />}
                  <span className="flex gap-[2px]" title="Last lap sectors">
                    {sectors.map((col, k) => (
                      <span key={k} className="h-2.5 w-1 rounded-sm" style={{ background: c.status === 'running' ? col : '#334155' }} />
                    ))}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-0.5 text-[10px] text-apex-muted" title={`${c.tire.compound}, ${c.tire.age} laps, ${Math.round(c.tire.wear)}% worn`}>
                  <TireIcon compound={c.tire.compound} size={15} wear={c.tire.wear} />
                  <span className="num">{c.tire.age}</span>
                </span>
                <span className={cn('num text-right text-[10px]', pts > 0 ? 'text-emerald-300' : 'text-apex-dim')} title={h2h ? 'Race points (4-3-2-1)' : `Points if the race ended now (${sys.label})`}>
                  {c.status === 'running' && pts > 0 ? `+${pts}` : ''}
                </span>
              </motion.button>
            </div>
          );
        })}
        {rejoin && rejoinCar && !rejoin.aheadOf && <RejoinRow code={driverCode(game.drivers[rejoinCar.driverId])} position={rejoin.position} />}
      </div>
    </div>
  );
}

function RejoinRow({ code, position }: { code: string; position: number }) {
  return (
    <div className="mx-2 my-0.5 rounded border border-dashed border-amber-400/50 px-2 py-0.5 text-center text-[10px] text-amber-200">
      If {code} pits now, rejoins P{position}
    </div>
  );
}
