import { AnimatePresence, motion } from 'framer-motion';
import { CloudRain, Lightbulb, Radio } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { driverShortName } from '@/engine/drivers/ratings';
import { buildCommentary, latestMoment, type CommentaryLine, type CommentaryTone } from '@/engine/race/commentary';
import { recommendations, rejoinEstimate, tyreLife, undercut, weatherRadar } from '@/engine/race/analysis';
import { fuelPerLap, type RaceCommand } from '@/engine/race/engine';
import type { CarRaceState, Circuit, GameState, RaceState } from '@/engine/types';
import { TireIcon } from '@/components/common';
import { Badge, Button, cn, Panel, Progress, Segmented } from '@/components/ui';

const TONE_STYLE: Record<CommentaryTone, string> = {
  lead: 'text-yellow-200 font-semibold',
  overtake: 'text-white',
  incident: 'text-red-300 font-semibold',
  pit: 'text-amber-200',
  weather: 'text-sky-300 font-semibold',
  caution: 'text-yellow-300 font-semibold',
  info: 'text-apex-muted',
  battle: 'text-orange-200',
  radio: 'text-sky-200 italic',
  finish: 'text-yellow-300 font-bold',
  penalty: 'text-orange-300',
  fastest: 'text-fuchsia-300',
  start: 'text-white font-semibold',
};

export function useCommentary(game: GameState, race: RaceState): CommentaryLine[] {
  // Rebuilt when a lap is added; the commentary is a pure function of the race.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildCommentary(game, race), [race.id, race.lap, race.log.length, race.finished]);
}

export function CommentaryPanel({ game, race, lines, height = 340 }: { game: GameState; race: RaceState; lines: CommentaryLine[]; height?: number }) {
  const [filter, setFilter] = useState<'all' | 'key' | 'mine'>('all');
  const mine = new Set(race.cars.filter((c) => c.teamId === game.player.teamId).map((c) => c.driverId));
  const shown = lines.filter((l) => (filter === 'key' ? l.key : filter === 'mine' ? l.driverIds.some((id) => mine.has(id)) : true)).slice(-80).reverse();
  return (
    <Panel
      title="Commentary"
      icon={<Radio size={14} className="text-apex-red" />}
      bodyClass="p-0"
      actions={
        <Segmented
          size="xs"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'key', label: 'Key' },
            { value: 'mine', label: 'My team' },
          ]}
        />
      }
    >
      <div className="overflow-y-auto" style={{ maxHeight: height }}>
        <AnimatePresence initial={false}>
          {shown.map((l) => (
            <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={cn('flex gap-2 border-b border-apex-line/40 px-3 py-1.5 text-xs', l.key && 'bg-white/[0.03]')}>
              <span className="mono w-7 shrink-0 text-apex-dim">L{l.lap}</span>
              <span className={TONE_STYLE[l.tone]}>{l.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {shown.length === 0 && <div className="px-3 py-3 text-xs text-apex-muted">Nothing yet.</div>}
      </div>
    </Panel>
  );
}

const MOMENT_STYLE: Partial<Record<CommentaryTone, string>> = {
  finish: 'from-yellow-500/90 to-amber-700/90 text-black',
  caution: 'from-yellow-400/95 to-yellow-600/90 text-black',
  incident: 'from-red-600/95 to-red-900/90 text-white',
  lead: 'from-apex-red/95 to-red-900/90 text-white',
  weather: 'from-sky-500/90 to-sky-800/90 text-white',
  overtake: 'from-emerald-500/90 to-emerald-800/90 text-white',
  info: 'from-slate-200/95 to-slate-400/90 text-black',
};

/** Full-width banner for the big moments of the latest lap; fades out after a few seconds. */
export function MomentOverlay({ game, race, lines }: { game: GameState; race: RaceState; lines: CommentaryLine[] }) {
  const moment = useMemo(() => latestMoment(game, race, lines), [game, race, lines]);
  const [shown, setShown] = useState<typeof moment>(null);
  useEffect(() => {
    if (!moment) return;
    setShown(moment);
    const t = setTimeout(() => setShown((m) => (m?.id === moment.id ? null : m)), 3200);
    return () => clearTimeout(t);
  }, [moment?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={shown.id} initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className={cn('pointer-events-none absolute inset-x-3 top-3 z-10 rounded-lg bg-gradient-to-r px-4 py-2 shadow-panel', MOMENT_STYLE[shown.tone] ?? MOMENT_STYLE.info)}>
          <div className="font-display text-xl font-black uppercase tracking-[0.12em]">{shown.title}</div>
          <div className="text-sm font-semibold">{shown.text}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RadarStrip({ race }: { race: RaceState }) {
  const radar = weatherRadar(race, 10);
  if (!radar.length) return <div className="text-xs text-apex-muted">Race over.</div>;
  return (
    <div>
      <div className="flex h-12 items-end gap-0.5">
        {radar.map((r) => (
          <div key={r.lap} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`Lap ${r.lap}: rain ${Math.round(r.rain * 100)}%, track ${Math.round(r.wetness * 100)}% wet`}>
            <div className="w-full rounded-t bg-sky-500/80" style={{ height: `${Math.max(2, r.rain * 40)}px` }} />
            <div className="h-1 w-full rounded" style={{ background: r.wetness > 0.75 ? '#1d4ed8' : r.wetness > 0.22 ? '#3b82f6' : r.wetness > 0.08 ? '#93c5fd' : '#334155' }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-apex-dim">
        <span>L{radar[0].lap}</span>
        <span>L{radar[radar.length - 1].lap}</span>
      </div>
    </div>
  );
}

/** Pit window, tyre life, undercut, weather radar, fuel and the strategist's calls for one car. */
export function StrategyPanel({ game, race, car, circuit, onCommand }: { game: GameState; race: RaceState; car: CarRaceState; circuit: Circuit; onCommand: (driverId: string, cmd: RaceCommand) => void }) {
  const cfg = DIVISIONS[race.division];
  const remaining = race.totalLaps - race.lap;
  const life = tyreLife(car);
  const rejoin = rejoinEstimate(race, car, circuit);
  const uc = undercut(race, car);
  const recs = recommendations(game, race, car, circuit);
  const fuelLaps = car.fuel / fuelPerLap(cfg, circuit);
  const nextStop = car.plan.stops[car.pitStops];
  const windowLap = race.lap + Math.max(1, Math.floor(life.lapsToCliff));
  const name = (c: CarRaceState | null) => (c ? driverShortName(game.drivers[c.driverId]) : '—');
  if (car.status !== 'running') return null;
  return (
    <Panel title={`Strategy · ${driverShortName(game.drivers[car.driverId])}`} icon={<Lightbulb size={14} className="text-amber-300" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="label flex items-center gap-1">
              Tyres <TireIcon compound={car.tire.compound} size={14} />
            </span>
            <span className="text-apex-muted">
              {car.tire.age} laps · {Math.round(car.tire.wear)}%
            </span>
          </div>
          <Progress value={(car.tire.wear / life.cliff) * 100} color={car.tire.wear > life.cliff - 5 ? '#ef4444' : car.tire.wear > life.cliff - 20 ? '#f59e0b' : '#22c55e'} />
          <div className="text-apex-muted">
            {life.perLap.toFixed(1)}%/lap · cliff in ~{life.lapsToCliff >= 50 ? '50+' : Math.round(life.lapsToCliff)} laps · {remaining} laps to go
          </div>
          <div>
            <span className="label">Pit window</span>
            <div className="text-white/90">
              {life.lapsToCliff >= remaining ? 'These tyres can reach the flag.' : `Box by lap ${Math.min(race.totalLaps - 1, windowLap)}`}
              {nextStop && <span className="text-apex-muted"> · plan: L{nextStop.lap} → {TIRE_TUNING.compounds[nextStop.compound].label}</span>}
            </div>
          </div>
          <div>
            <span className="label">Pit now</span>
            <div className="text-white/90">
              Rejoins P{rejoin.position}
              {rejoin.behindOf && <span className="text-apex-muted"> behind {name(rejoin.behindOf)}</span>}
              {rejoin.aheadOf && <span className="text-apex-muted">, ahead of {name(rejoin.aheadOf)}</span>}
            </div>
          </div>
          {uc && (
            <div>
              <span className="label">Undercut on {name(uc.target)}</span>
              <div className={uc.viable ? 'text-emerald-300' : 'text-apex-muted'}>
                {uc.gainPerLap > 0.05 ? `Fresh tyres +${uc.gainPerLap.toFixed(2)} s/lap vs gap ${uc.gap.toFixed(1)} s: ${uc.viable ? 'on' : 'not enough yet'}` : 'No tyre advantage to gain yet.'}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <span className="label flex items-center gap-1">
              <CloudRain size={12} /> Weather radar
            </span>
            <RadarStrip race={race} />
          </div>
          {cfg.fuelManagement && (
            <div>
              <span className="label">Fuel</span>
              <Progress value={Math.min(100, (fuelLaps / Math.max(1, remaining)) * 100)} color={fuelLaps < remaining ? '#ef4444' : '#3b82f6'} />
              <div className="text-apex-muted">
                {fuelLaps.toFixed(1)} laps of fuel · {car.instructions.fuel} mix
              </div>
            </div>
          )}
          {cfg.ers && (
            <div>
              <span className="label">ERS</span>
              <Progress value={car.ers} color="#facc15" />
              <div className="text-apex-muted">
                {Math.round(car.ers)}% · {car.instructions.ers}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-apex-line pt-3">
        <div className="label">Strategist</div>
        {recs.length === 0 ? (
          <div className="text-xs text-apex-muted">All under control. Keep going.</div>
        ) : (
          recs.map((r) => (
            <div key={r.id} className={cn('flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs', r.severity === 'urgent' ? 'border-red-700/60 bg-red-950/40' : r.severity === 'warn' ? 'border-amber-600/50 bg-amber-950/30' : 'border-apex-line')}>
              <span className="min-w-0">{r.text}</span>
              {r.command && (
                <Button size="xs" variant={r.severity === 'urgent' ? 'primary' : 'secondary'} onClick={() => onCommand(car.driverId, r.command!)}>
                  {r.action}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/** One-line status of a player car for the broadcast and highlights views. */
export function CarStrip({ game, race, car }: { game: GameState; race: RaceState; car: CarRaceState }) {
  const team = game.teams[car.teamId];
  return (
    <div className="flex items-center gap-3 rounded-md border border-apex-line px-3 py-2 text-sm" style={{ background: `linear-gradient(90deg, ${team?.colors.primary}33, transparent 70%)` }}>
      <span className="num w-10 text-lg font-black">{car.status === 'running' ? `P${car.position}` : 'OUT'}</span>
      <span className="flex-1 truncate font-semibold">{driverShortName(game.drivers[car.driverId])}</span>
      <TireIcon compound={car.tire.compound} size={16} wear={car.tire.wear} />
      <span className="num text-xs text-apex-muted">{car.tire.age}L</span>
      {car.status === 'running' && race.lap > 0 && <Badge tone={car.grid - car.position > 0 ? 'green' : car.grid - car.position < 0 ? 'red' : 'neutral'}>{car.grid - car.position > 0 ? `+${car.grid - car.position}` : car.grid - car.position}</Badge>}
    </div>
  );
}
