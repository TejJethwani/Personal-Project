import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CloudRain, Flag, Gauge, Lightbulb, Radio, Siren, Timer, Wrench, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { driverShortName } from '@/engine/drivers/ratings';
import { buildCommentary, lapAlerts, latestMoment, raceDirectorFeed, teamRadioFeed, type AlertKind, type CommentaryLine, type CommentaryTone, type FeedLine } from '@/engine/race/commentary';
import { degradationForecast, ersForecast, overcut, paceComparison, pitWindow, recommendations, rejoinEstimate, tyreLife, undercut, weatherRadar } from '@/engine/race/analysis';
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
  defend: 'text-orange-100',
  title: 'text-amber-300 font-bold',
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

const MOMENT_STYLE: Partial<Record<AlertKind, string>> = {
  finish: 'from-yellow-500/90 to-amber-700/90 text-black',
  safetyCar: 'from-yellow-400/95 to-yellow-600/90 text-black',
  crash: 'from-red-600/95 to-red-900/90 text-white',
  collision: 'from-red-600/95 to-red-900/90 text-white',
  failure: 'from-red-700/95 to-zinc-900/90 text-white',
  puncture: 'from-orange-600/95 to-red-900/90 text-white',
  lead: 'from-apex-red/95 to-red-900/90 text-white',
  titleLead: 'from-amber-400/95 to-amber-700/90 text-black',
  rain: 'from-sky-500/90 to-sky-800/90 text-white',
  finalLap: 'from-slate-100/95 to-slate-400/90 text-black',
  start: 'from-apex-red/95 to-black/90 text-white',
};

/** Icon and colour of every alert kind, for the ticker. */
const ALERT_STYLE: Record<AlertKind, { color: string; icon: typeof Zap; label: string }> = {
  start: { color: '#e10600', icon: Flag, label: 'Start' },
  lead: { color: '#e10600', icon: Zap, label: 'Lead' },
  overtake: { color: '#22c55e', icon: Zap, label: 'Overtake' },
  defend: { color: '#fb923c', icon: Gauge, label: 'Defended' },
  fastest: { color: '#a855f7', icon: Timer, label: 'Fastest lap' },
  lockup: { color: '#f59e0b', icon: AlertTriangle, label: 'Lock-up' },
  mistake: { color: '#f59e0b', icon: AlertTriangle, label: 'Mistake' },
  crash: { color: '#ef4444', icon: Siren, label: 'Crash' },
  collision: { color: '#ef4444', icon: Siren, label: 'Contact' },
  puncture: { color: '#f97316', icon: AlertTriangle, label: 'Puncture' },
  failure: { color: '#ef4444', icon: Wrench, label: 'Failure' },
  rain: { color: '#38bdf8', icon: CloudRain, label: 'Weather' },
  pitError: { color: '#f59e0b', icon: Wrench, label: 'Pit stop' },
  safetyCar: { color: '#facc15', icon: Siren, label: 'Safety car' },
  titleLead: { color: '#fbbf24', icon: Flag, label: 'Championship' },
  finalLap: { color: '#e5e7eb', icon: Flag, label: 'Final laps' },
  battle: { color: '#fb923c', icon: Gauge, label: 'Battle' },
  finish: { color: '#fbbf24', icon: Flag, label: 'Finish' },
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
        <motion.div key={shown.id} initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className={cn('pointer-events-none absolute inset-x-3 top-3 z-10 rounded-lg bg-gradient-to-r px-4 py-2 shadow-panel', MOMENT_STYLE[shown.alert] ?? MOMENT_STYLE.finalLap)}>
          <div className="font-display text-xl font-black uppercase tracking-[0.12em]">{shown.title}</div>
          <div className="text-sm font-semibold">{shown.text}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Smaller alerts of the latest lap (passes, fastest laps, lock-ups, pit errors...), stacked in a corner of the map. */
export function AlertTicker({ race, lines }: { race: RaceState; lines: CommentaryLine[] }) {
  const alerts = useMemo(() => lapAlerts(race, lines), [race, lines]);
  const [shown, setShown] = useState<CommentaryLine[]>([]);
  useEffect(() => {
    setShown(alerts);
    const t = setTimeout(() => setShown([]), 4200);
    return () => clearTimeout(t);
  }, [alerts.map((a) => a.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pointer-events-none absolute bottom-10 right-3 z-10 flex w-[min(340px,70%)] flex-col items-end gap-1">
      <AnimatePresence>
        {shown.map((a) => {
          const st = ALERT_STYLE[a.alert!];
          const Icon = st.icon;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} className="flex max-w-full items-center gap-2 rounded-md border bg-black/80 px-2 py-1 text-[11px] text-white shadow-panel" style={{ borderColor: `${st.color}99` }}>
              <Icon size={12} style={{ color: st.color }} className="shrink-0" />
              <span className="font-display font-bold uppercase tracking-wider" style={{ color: st.color }}>
                {st.label}
              </span>
              <span className="truncate">{a.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const FEED_STYLE: Record<FeedLine['level'], string> = {
  info: 'text-white/85',
  flag: 'text-yellow-300',
  penalty: 'text-orange-300',
  caution: 'text-yellow-300 font-semibold',
  green: 'text-emerald-300',
};

/** Official race control messages. */
export function RaceDirectorPanel({ game, race, height = 220 }: { game: GameState; race: RaceState; height?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const feed = useMemo(() => raceDirectorFeed(game, race), [race.id, race.lap, race.log.length]);
  return (
    <Panel title="Race director" icon={<Flag size={14} className="text-yellow-300" />} bodyClass="p-0">
      <div className="overflow-y-auto font-mono" style={{ maxHeight: height }}>
        {[...feed].reverse().map((l) => (
          <div key={l.id} className="flex gap-2 border-b border-apex-line/40 px-3 py-1.5 text-[11px]">
            <span className="w-7 shrink-0 text-apex-dim">L{l.lap}</span>
            <span className={FEED_STYLE[l.level]}>{l.text}</span>
          </div>
        ))}
        {feed.length === 0 && <div className="px-3 py-3 text-xs text-apex-muted">No messages.</div>}
      </div>
    </Panel>
  );
}

/** The radio between the pit wall and the player's drivers. */
export function TeamRadioPanel({ game, race, height = 220 }: { game: GameState; race: RaceState; height?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const feed = useMemo(() => teamRadioFeed(game, race), [race.id, race.lap, race.log.length]);
  return (
    <Panel title="Team radio" icon={<Radio size={14} className="text-sky-300" />} bodyClass="p-0">
      <div className="overflow-y-auto" style={{ maxHeight: height }}>
        {[...feed].reverse().map((l) => (
          <div key={l.id} className="flex gap-2 border-b border-apex-line/40 px-3 py-1.5 text-xs">
            <span className="mono w-7 shrink-0 text-apex-dim">L{l.lap}</span>
            <span className={cn('min-w-0', FEED_STYLE[l.level])}>
              <span className={cn('mr-1 font-semibold', l.speaker === 'Engineer' ? 'text-sky-300' : 'text-white')}>{l.speaker}:</span>
              <span className={l.speaker === 'Engineer' ? '' : 'italic'}>{l.text}</span>
            </span>
          </div>
        ))}
        {feed.length === 0 && <div className="px-3 py-3 text-xs text-apex-muted">Radio silence so far.</div>}
      </div>
    </Panel>
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
  const oc = overcut(race, car, circuit);
  const recs = recommendations(game, race, car, circuit);
  const fuelLaps = car.fuel / fuelPerLap(cfg, circuit);
  const nextStop = car.plan.stops[car.pitStops];
  const win = pitWindow(race, car);
  const deg = degradationForecast(race, car, 6);
  const pace = paceComparison(race, car);
  const ers = ersForecast(car);
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
          {deg.length > 0 && (
            <div>
              <span className="label">Degradation forecast</span>
              <div className="mt-1 flex h-8 items-end gap-0.5">
                {deg.map((d) => (
                  <div key={d.lap} className="flex-1 rounded-t bg-amber-500/70" style={{ height: `${Math.max(2, Math.min(32, d.loss * 16))}px` }} title={`Lap ${d.lap}: +${d.loss.toFixed(2)} s from tyre wear`} />
                ))}
              </div>
              <div className="text-apex-muted">+{deg[deg.length - 1].loss.toFixed(2)} s/lap by lap {deg[deg.length - 1].lap} from wear alone</div>
            </div>
          )}
          <div>
            <span className="label">Pit window</span>
            <div className="text-white/90">
              {win.toFlag ? 'These tyres can reach the flag.' : win.open >= win.close ? `Box by lap ${win.close}` : `Open laps ${win.open}–${win.close}`}
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
                {uc.gainPerLap > 0.05 ? `${Math.round(uc.chance * 100)}% chance · fresh tyres +${uc.gainPerLap.toFixed(2)} s/lap vs a ${uc.gap.toFixed(1)} s gap` : 'No tyre advantage to gain yet.'}
              </div>
            </div>
          )}
          {oc && (
            <div>
              <span className="label">Overcut on {name(oc.target)}</span>
              <div className={oc.chance > 0.5 ? 'text-emerald-300' : 'text-apex-muted'}>
                {oc.chance > 0 ? `${Math.round(oc.chance * 100)}% chance: ${oc.reason}` : `Unlikely: ${oc.reason}, and fresh tyres would be ${oc.tyreLoss.toFixed(2)} s/lap quicker.`}
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
              <div className={fuelLaps < remaining ? 'text-red-300' : 'text-apex-muted'}>
                {fuelLaps.toFixed(1)} laps of fuel for {remaining} to go · {car.instructions.fuel} mix{fuelLaps < remaining ? ': fuel warning' : ''}
              </div>
            </div>
          )}
          {cfg.ers && (
            <div>
              <span className="label">ERS</span>
              <Progress value={car.ers} color="#facc15" />
              <div className="text-apex-muted">
                {Math.round(car.ers)}% · {car.instructions.ers} mode ·{' '}
                {ers.lapsToEmpty !== null ? (ers.lapsToEmpty <= 2 ? <span className="text-amber-300">empty in {ers.lapsToEmpty} lap{ers.lapsToEmpty === 1 ? '' : 's'}</span> : `empty in ${ers.lapsToEmpty} laps`) : ers.lapsToFull !== null ? (ers.lapsToFull === 0 ? 'full' : `full in ${ers.lapsToFull} lap${ers.lapsToFull === 1 ? '' : 's'}`) : 'steady'}
              </div>
            </div>
          )}
          {pace.length > 0 && (
            <div>
              <span className="label">Pace (last 3 clean laps)</span>
              {pace.map((r) => (
                <div key={r.car.driverId} className="flex justify-between">
                  <span className="text-apex-muted">
                    {r.label} · {name(r.car)}
                  </span>
                  <span className={r.delta === null ? 'text-apex-dim' : r.delta > 0.05 ? 'text-emerald-300' : r.delta < -0.05 ? 'text-red-300' : 'text-white/80'}>
                    {r.delta === null ? '—' : r.delta > 0 ? `you +${r.delta.toFixed(2)} s/lap` : `you ${r.delta.toFixed(2)} s/lap`}
                  </span>
                </div>
              ))}
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
