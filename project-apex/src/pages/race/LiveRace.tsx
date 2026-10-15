import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CloudRain, FastForward, Pause, Play, Radio, SkipForward, Thermometer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { pointsSystemFor } from '@/engine/config/divisions';
import { DIVISIONS } from '@/engine/config/divisions';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { divisionStandings } from '@/engine/championship/standings';
import { driverCode, driverName, driverShortName } from '@/engine/drivers/ratings';
import { applyRaceCommand, type RaceCommand } from '@/engine/race/engine';
import { allowedCompounds } from '@/engine/race/tires';
import { weatherLabel } from '@/engine/race/weather';
import { advanceRace, weekendEvent } from '@/engine/race/weekend';
import type { CarRaceState, Circuit, ErsMode, FuelMode, PaceMode, RaceLogEntry, RaceState, TeamOrder, TireMode } from '@/engine/types';
import { CircuitOutline, type PathSampler } from '@/components/CircuitMap';
import { TeamDot, TireIcon } from '@/components/common';
import { Badge, Button, cn, Panel, Progress, Segmented, Toggle } from '@/components/ui';
import { lapTime } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';

interface AnimState {
  start: number;
  f: number;
  prevGaps: Map<string, number>;
  prevLap: number;
}

const SPEEDS = [1, 5, 20, 60] as const;

export function LiveRace() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const race = game.weekend!.race!;
  const event = weekendEvent(game)!;
  const circuit = game.circuits[race.circuitId];
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(game.settings.defaultRaceSpeed ?? 20);
  const [gapMode, setGapMode] = useState<'interval' | 'leader'>('interval');
  const [selected, setSelected] = useState<string | null>(null);
  const anim = useRef<AnimState>({ start: performance.now(), f: 1, prevGaps: new Map(), prevLap: race.lap });
  const leader = race.cars.find((c) => c.position === 1);
  const leaderLap = race.lap > 0 && leader ? Math.max(20, leader.lastLap) : race.baseLapTime;
  const leaderLapRef = useRef(leaderLap);
  leaderLapRef.current = leaderLap;

  const snapshotGaps = () => {
    const m = new Map<string, number>();
    for (const c of race.cars) m.set(c.driverId, c.gapToLeader);
    anim.current.prevGaps = m;
    anim.current.prevLap = race.lap;
  };

  const step = useCallback(
    (mode: 'lap' | 'key' | 'finish') => {
      snapshotGaps();
      act((g) => advanceRace(g, mode));
      anim.current.start = performance.now();
      anim.current.f = mode === 'lap' ? 0 : 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [act, race],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const dur = () => (leaderLapRef.current / speed) * 1000;
    // Resume from the current fraction.
    anim.current.start = performance.now() - Math.min(1, anim.current.f) * dur();
    const loop = (t: number) => {
      const a = anim.current;
      a.f = (t - a.start) / dur();
      if (a.f >= 1) {
        if (useStore.getState().game?.weekend?.race?.finished) {
          setPlaying(false);
          return;
        }
        step('lap');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, step]);

  const command = (driverId: string, cmd: RaceCommand) => act((g) => applyRaceCommand(g, g.weekend!.race!, driverId, cmd));
  const order = [...race.cars].sort((a, b) => a.position - b.position);
  const playerCars = order.filter((c) => c.isPlayer);
  const wx = race.weather[Math.max(0, race.lap - 1)] ?? race.weather[0];
  const nextWx = race.weather[Math.min(race.weather.length - 1, race.lap)] ?? wx;
  const sc = race.safetyCar.type;

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="panel flex flex-wrap items-center gap-4 p-3">
        <div className="flex items-baseline gap-2 pl-1">
          <span className="label">Lap</span>
          <span className="num text-3xl font-black">{race.lap}</span>
          <span className="num text-lg text-apex-muted">/ {race.totalLaps}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={playing ? 'secondary' : 'primary'} size="md" onClick={() => setPlaying(!playing)} disabled={race.finished}>
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : race.lap === 0 ? 'Lights out' : 'Resume'}
          </Button>
          <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, title: s === 1 ? 'Real time' : `${s}× speed` }))} />
          <Button size="md" onClick={() => step('lap')} disabled={race.finished} title="Simulate one lap">
            <SkipForward size={15} /> Lap
          </Button>
          <Button size="md" onClick={() => step('key')} disabled={race.finished} title="Simulate to the next key event">
            <FastForward size={15} /> Next event
          </Button>
          <Button size="md" variant="outline" onClick={() => confirm('Simulate to the chequered flag?') && step('finish')} disabled={race.finished}>
            Finish race
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            {wx.rain > 0.1 ? <CloudRain size={16} className="text-sky-400" /> : <Thermometer size={16} className="text-apex-muted" />}
            {weatherLabel(wx.rain, wx.wetness)}
          </span>
          <span className="text-apex-muted">Track {Math.round(wx.trackTemp)}°C</span>
          <span className="w-24">
            <span className="label">Wetness</span>
            <Progress value={wx.wetness * 100} color="#3b82f6" />
          </span>
          {nextWx.rain > wx.rain + 0.1 && <Badge tone="blue">Rain approaching</Badge>}
        </div>
      </div>

      <AnimatePresence>
        {sc !== 'none' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 rounded-lg bg-yellow-400 py-2 font-display text-lg font-black uppercase tracking-[0.2em] text-black">
            <AlertTriangle size={18} /> {sc === 'sc' ? 'Safety Car' : 'Virtual Safety Car'} · pit stops are cheaper now
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 2xl:grid-cols-[minmax(320px,380px)_1fr_360px] xl:grid-cols-[340px_1fr]">
        <TimingTower race={race} gapMode={gapMode} setGapMode={setGapMode} selected={selected} onSelect={setSelected} />
        <div className="space-y-4">
          <div className="panel relative overflow-hidden p-2">
            <TrackMap race={race} anim={anim} leaderLapRef={leaderLapRef} circuit={circuit} />
            <div className="pointer-events-none absolute left-4 top-3 font-display text-sm uppercase tracking-[0.14em] text-apex-muted">{circuit.location}</div>
            {race.fastestLap && (
              <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded bg-black/50 px-2 py-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-apex-purple" /> Fastest lap {driverShortName(game.drivers[race.fastestLap.driverId])} {lapTime(race.fastestLap.time)} (L{race.fastestLap.lap})
              </div>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {playerCars.map((c) => (
              <DriverControl key={c.driverId} car={c} race={race} onCommand={(cmd) => command(c.driverId, cmd)} />
            ))}
          </div>
        </div>
        <div className="space-y-4 xl:col-span-2 2xl:col-span-1">
          <Commentary log={race.log} />
          <LiveChampionship race={race} division={event.division} />
          <SectorPanel race={race} driverId={selected ?? playerCars[0]?.driverId ?? order[0]?.driverId} />
        </div>
      </div>
    </div>
  );
}

function TrackMap({ race, anim, leaderLapRef, circuit }: { race: RaceState; anim: MutableRefObject<AnimState>; leaderLapRef: MutableRefObject<number>; circuit: Circuit }) {
  const game = useGame();
  const markers = useRef<Record<string, SVGGElement | null>>({});
  const samplerRef = useRef<PathSampler | null>(null);
  const raceRef = useRef(race);
  raceRef.current = race;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = samplerRef.current;
      const r = raceRef.current;
      if (s) {
        const f = Math.max(0, Math.min(1, anim.current.f));
        const lapLen = leaderLapRef.current;
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
          const p = s.at(frac);
          el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
          el.setAttribute('opacity', '1');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anim, leaderLapRef]);

  const ordered = [...race.cars].sort((a, b) => b.position - a.position);
  return (
    <CircuitOutline circuit={circuit} className="h-[300px] w-full xl:h-[360px]">
      {(sampler) => {
        samplerRef.current = sampler;
        return (
          <g>
            {ordered.map((c) => {
              const team = game.teams[c.teamId];
              const d = game.drivers[c.driverId];
              return (
                <g key={c.driverId} ref={(el) => (markers.current[c.driverId] = el)} opacity={0}>
                  <circle r={c.isPlayer ? 7.5 : 5.5} fill={team.colors.primary} stroke={c.isPlayer ? '#fff' : team.colors.secondary} strokeWidth={c.isPlayer ? 2.2 : 1.4} />
                  {(c.isPlayer || c.position <= 3) && (
                    <text y={-11} textAnchor="middle" fontSize={c.isPlayer ? 10 : 8.5} fontWeight={700} fill={c.isPlayer ? '#fff' : '#cbd5e1'} fontFamily="Barlow Condensed" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>
                      {c.position} {driverCode(d)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      }}
    </CircuitOutline>
  );
}

function statusBadge(c: CarRaceState, race: RaceState) {
  if (c.status !== 'running') return <Badge tone="red">{c.status === 'dsq' ? 'DSQ' : 'OUT'}</Badge>;
  const lastStint = c.stints[c.stints.length - 1];
  if (lastStint.fromLap === race.lap + 1 && race.lap > 0) return <Badge tone="amber">PIT</Badge>;
  if (lastStint.fromLap === race.lap && race.lap > 1) return <Badge tone="blue">OUT</Badge>;
  return null;
}

function TimingTower({ race, gapMode, setGapMode, selected, onSelect }: { race: RaceState; gapMode: 'interval' | 'leader'; setGapMode: (m: 'interval' | 'leader') => void; selected: string | null; onSelect: (id: string) => void }) {
  const game = useGame();
  const order = [...race.cars].sort((a, b) => a.position - b.position);
  const prevOrder = race.lapOrders[race.lapOrders.length - 2] ?? race.lapOrders[0];
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-apex-line bg-gradient-to-r from-apex-red/30 to-transparent px-3 py-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.14em]">Timing</span>
        <Segmented
          size="xs"
          value={gapMode}
          onChange={setGapMode}
          options={[
            { value: 'interval', label: 'Interval' },
            { value: 'leader', label: 'Leader' },
          ]}
        />
      </div>
      <div className="divide-y divide-apex-line/50">
        {order.map((c) => {
          const d = game.drivers[c.driverId];
          const team = game.teams[c.teamId];
          const before = prevOrder.indexOf(c.driverId) + 1;
          const change = c.status === 'running' && before > 0 ? before - c.position : 0;
          const gap = c.position === 1 ? 'Leader' : c.status !== 'running' ? (c.retireReason ?? 'Retired') : `+${(gapMode === 'interval' ? c.interval : c.gapToLeader).toFixed(c.gapToLeader > 99 ? 1 : 3)}`;
          return (
            <motion.button
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              key={c.driverId}
              onClick={() => onSelect(c.driverId)}
              className={cn('grid w-full grid-cols-[26px_14px_6px_44px_1fr_auto_22px] items-center gap-1.5 px-2 py-[5px] text-left text-sm', c.isPlayer && 'bg-apex-red/[0.12]', selected === c.driverId && 'ring-1 ring-inset ring-white/30', c.status !== 'running' && 'opacity-50')}
            >
              <span className="num text-center font-bold">{c.status === 'running' ? c.position : '—'}</span>
              <span className={cn('text-[10px]', change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-transparent')}>{change > 0 ? '▲' : change < 0 ? '▼' : '·'}</span>
              <span className="h-4 w-1 rounded" style={{ background: team.colors.primary }} />
              <span className={cn('font-display font-bold tracking-wide', c.isPlayer && 'text-white')}>{driverCode(d)}</span>
              <span className={cn('mono truncate text-right text-xs', c.status !== 'running' ? 'text-red-300' : 'text-apex-muted')}>
                {gap}
                {c.penaltySeconds > 0 && <span className="ml-1 text-amber-300">+{c.penaltySeconds}s</span>}
              </span>
              <span className="flex items-center gap-1">
                {statusBadge(c, race)}
                {race.fastestLap?.driverId === c.driverId && <span className="h-2 w-2 rounded-full bg-apex-purple" title="Fastest lap" />}
                {c.isPlayer && c.warning && <AlertTriangle size={12} className="animate-pulseRed text-red-400" />}
              </span>
              <TireIcon compound={c.tire.compound} size={18} wear={c.tire.wear} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function DriverControl({ car, race, onCommand }: { car: CarRaceState; race: RaceState; onCommand: (cmd: RaceCommand) => void }) {
  const game = useGame();
  const cfg = DIVISIONS[race.division];
  const d = game.drivers[car.driverId];
  const team = game.teams[car.teamId];
  const order = [...race.cars].filter((c) => c.status === 'running').sort((a, b) => a.position - b.position);
  const idx = order.indexOf(car);
  const ahead = idx > 0 ? order[idx - 1] : null;
  const behind = order[idx + 1] ?? null;
  const running = car.status === 'running';
  const cliff = TIRE_TUNING.compounds[car.tire.compound].cliff;
  const nextStop = car.plan.stops[car.pitStops];
  const lapsOfFuel = car.fuel / cfg.fuelBurnPerLap;
  const remaining = race.totalLaps - race.lap;
  const mate = order.find((c) => c.teamId === car.teamId && c.driverId !== car.driverId);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-apex-line px-3 py-2" style={{ background: `linear-gradient(90deg, ${team.colors.primary}40, transparent 70%)` }}>
        <span className="num text-2xl font-black">{running ? `P${car.position}` : 'OUT'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-bold uppercase">{driverName(d)}</div>
          <div className="text-[11px] text-apex-muted">
            Grid P{car.grid} · {car.pitStops} stop{car.pitStops === 1 ? '' : 's'} · last {lapTime(car.lastLap || null)} · best {lapTime(car.bestLap)}
          </div>
        </div>
        <div className="text-right text-[11px] leading-tight">
          <div className="text-red-300">{ahead ? `▲ ${driverCode(game.drivers[ahead.driverId])} +${car.interval.toFixed(1)}` : 'Leading'}</div>
          <div className="text-emerald-300">{behind ? `▼ ${driverCode(game.drivers[behind.driverId])} −${behind.interval.toFixed(1)}` : ''}</div>
        </div>
      </div>
      {!running ? (
        <div className="p-4 text-sm text-red-300">Retired on lap {car.retiredLap}: {car.retireReason}</div>
      ) : (
        <div className="space-y-3 p-3">
          {car.warning && (
            <div className="flex items-center gap-2 rounded-md border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-100">
              <AlertTriangle size={14} className="animate-pulseRed" /> {car.warning.type} issue: switch to Conserve to nurse the car home.
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="label mb-1 flex items-center gap-1">
                Tyres <TireIcon compound={car.tire.compound} size={14} />
              </div>
              <Progress value={car.tire.wear} color={car.tire.wear > cliff - 5 ? '#ef4444' : car.tire.wear > cliff - 25 ? '#f59e0b' : '#22c55e'} />
              <div className="mt-0.5 text-apex-muted">
                {Math.round(car.tire.wear)}% · {car.tire.age} laps
              </div>
            </div>
            {cfg.fuelManagement ? (
              <div>
                <div className="label mb-1">Fuel</div>
                <Progress value={Math.min(100, (lapsOfFuel / Math.max(1, remaining)) * 100)} color={lapsOfFuel < remaining ? '#ef4444' : '#3b82f6'} />
                <div className="mt-0.5 text-apex-muted">{lapsOfFuel.toFixed(1)} laps of fuel</div>
              </div>
            ) : (
              <div>
                <div className="label mb-1">Fatigue</div>
                <Progress value={car.fatigue} color="#a855f7" />
              </div>
            )}
            {cfg.ers ? (
              <div>
                <div className="label mb-1">ERS</div>
                <Progress value={car.ers} color="#facc15" />
                <div className="mt-0.5 text-apex-muted">{Math.round(car.ers)}%</div>
              </div>
            ) : (
              <div>
                <div className="label mb-1">Plan</div>
                <div className="text-apex-muted">{nextStop ? `Stop ~L${nextStop.lap} → ${TIRE_TUNING.compounds[nextStop.compound].label}` : 'No more stops'}</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="label">Pace</span>
            {car.autoInstructions && <Badge tone="blue">Strategist</Badge>}
          </div>
          <Segmented<PaceMode>
            className="w-full justify-between"
            value={car.instructions.pace}
            onChange={(v) => onCommand({ type: 'pace', value: v })}
            options={[
              { value: 'conserve', label: 'Conserve' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'push', label: 'Push' },
              { value: 'attack', label: 'Attack', title: 'Maximum attack: fastest, but wears tyres and risks mistakes' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="label mb-1">Tyres</div>
              <Segmented<TireMode>
                size="xs"
                value={car.instructions.tires}
                onChange={(v) => onCommand({ type: 'tires', value: v })}
                options={[
                  { value: 'preserve', label: 'Preserve' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'aggressive', label: 'Aggr.' },
                ]}
              />
            </div>
            {cfg.fuelManagement && (
              <div>
                <div className="label mb-1">Fuel mix</div>
                <Segmented<FuelMode>
                  size="xs"
                  value={car.instructions.fuel}
                  onChange={(v) => onCommand({ type: 'fuel', value: v })}
                  options={[
                    { value: 'lean', label: 'Lean' },
                    { value: 'standard', label: 'Std' },
                    { value: 'rich', label: 'Rich' },
                  ]}
                />
              </div>
            )}
            {cfg.ers && (
              <div className="col-span-2">
                <div className="label mb-1">Energy (ERS)</div>
                <Segmented<ErsMode>
                  size="xs"
                  value={car.instructions.ers}
                  onChange={(v) => onCommand({ type: 'ers', value: v })}
                  options={[
                    { value: 'harvest', label: 'Harvest' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'deploy', label: 'Deploy' },
                    { value: 'overtake', label: 'Overtake' },
                  ]}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Toggle checked={car.instructions.defend} onChange={(v) => onCommand({ type: 'defend', value: v })} label={<span className="text-xs">Defend</span>} />
            {mate && (
              <Segmented<TeamOrder>
                size="xs"
                value={car.instructions.teamOrder}
                onChange={(v) => onCommand({ type: 'teamOrder', value: v })}
                options={[
                  { value: 'free', label: 'Free to race', title: 'No team orders' },
                  { value: 'hold', label: 'Hold position', title: 'Do not attack your team-mate' },
                  { value: 'letPass', label: 'Let mate by', title: 'Yield to your team-mate when he is behind' },
                ]}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-apex-line pt-3">
            <Toggle checked={car.autoStrategy} onChange={(v) => onCommand({ type: 'autoStrategy', value: v })} label={<span className="text-xs">Auto pit calls</span>} />
            <Toggle checked={car.autoInstructions} onChange={(v) => onCommand({ type: 'autoInstructions', value: v })} label={<span className="text-xs">Strategist pace</span>} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">Box</span>
            {allowedCompounds(race.division).map((c) => (
              <button key={c} onClick={() => onCommand({ type: 'pit', compound: c })} disabled={remaining <= 0} className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition hover:border-white/40', car.pitRequest === c ? 'border-apex-red bg-apex-red/20' : 'border-apex-line2')}>
                <TireIcon compound={c} size={16} />
              </button>
            ))}
            {car.pitRequest && (
              <Button size="xs" variant="ghost" onClick={() => onCommand({ type: 'cancelPit' })}>
                Cancel pit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const LOG_STYLE: Partial<Record<RaceLogEntry['type'], string>> = {
  overtake: 'text-white',
  pit: 'text-amber-200',
  crash: 'text-red-300 font-semibold',
  collision: 'text-red-300 font-semibold',
  failure: 'text-red-300',
  warning: 'text-orange-300',
  safetyCar: 'text-yellow-300 font-semibold',
  vsc: 'text-yellow-300',
  safetyCarEnd: 'text-emerald-300',
  penalty: 'text-orange-300',
  weather: 'text-sky-300 font-semibold',
  radio: 'text-sky-200 italic',
  fastestLap: 'text-fuchsia-300',
  finish: 'text-yellow-300 font-bold',
  start: 'text-white font-semibold',
};

function Commentary({ log }: { log: RaceLogEntry[] }) {
  const items = log.slice(-60).reverse();
  return (
    <Panel title="Race control & radio" icon={<Radio size={14} className="text-apex-red" />} bodyClass="p-0">
      <div className="max-h-[320px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((l, i) => (
            <motion.div key={`${log.length - i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={cn('flex gap-2 border-b border-apex-line/40 px-3 py-1.5 text-xs', l.key && 'bg-white/[0.03]')}>
              <span className="mono w-7 shrink-0 text-apex-dim">L{l.lap}</span>
              <span className={LOG_STYLE[l.type] ?? 'text-apex-muted'}>{l.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function LiveChampionship({ race, division }: { race: RaceState; division: RaceState['division'] }) {
  const game = useGame();
  const preset = game.settings.pointsPreset[division];
  const sys = pointsSystemFor(preset);
  const projected = useMemo(() => {
    const st = divisionStandings(game, division).drivers.map((r) => ({ id: r.id, teamId: r.teamId, points: r.points }));
    const map = new Map(st.map((r) => [r.id, r]));
    const running = [...race.cars].filter((c) => c.status === 'running').sort((a, b) => a.position - b.position);
    running.forEach((c, i) => {
      const r = map.get(c.driverId) ?? { id: c.driverId, teamId: c.teamId, points: 0 };
      r.points += sys.positions[i] ?? 0;
      map.set(c.driverId, r);
    });
    return [...map.values()].sort((a, b) => b.points - a.points);
  }, [game, race.lap, division, sys, race.cars]);
  const before = divisionStandings(game, division).drivers.map((r) => r.id);
  const show = projected.filter((r, i) => i < 5 || game.drivers[r.id]?.contract?.teamId === game.player.teamId);
  return (
    <Panel title="Championship if it ended now">
      <div className="space-y-1">
        {show.map((r) => {
          const pos = projected.indexOf(r) + 1;
          const was = before.indexOf(r.id) + 1;
          const mine = game.drivers[r.id]?.contract?.teamId === game.player.teamId;
          return (
            <div key={r.id} className={cn('flex items-center gap-2 rounded px-2 py-1 text-sm', mine && 'bg-apex-red/[0.1]')}>
              <span className="num w-6 font-bold">{pos}</span>
              <TeamDot team={game.teams[r.teamId ?? '']} />
              <span className="flex-1 truncate">{driverShortName(game.drivers[r.id])}</span>
              {was > 0 && was !== pos && <span className={was > pos ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{was > pos ? `▲${was - pos}` : `▼${pos - was}`}</span>}
              <span className="num font-semibold">{r.points}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SectorPanel({ race, driverId }: { race: RaceState; driverId: string | undefined }) {
  const game = useGame();
  const car = race.cars.find((c) => c.driverId === driverId);
  if (!car) return null;
  const overallBest = [0, 1, 2].map((k) => Math.min(...race.cars.map((c) => c.bestSectors[k])));
  return (
    <Panel title={`Sectors · ${driverShortName(game.drivers[car.driverId])}`}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[0, 1, 2].map((k) => {
          const s = car.sectors[k];
          const purple = s > 0 && Math.abs(s - overallBest[k]) < 0.0005;
          const green = s > 0 && !purple && Math.abs(s - car.bestSectors[k]) < 0.0005;
          return (
            <div key={k} className={cn('rounded-md border py-2', purple ? 'border-apex-purple bg-fuchsia-500/10' : green ? 'border-emerald-500 bg-emerald-500/10' : 'border-apex-line')}>
              <div className="label">S{k + 1}</div>
              <div className="mono text-sm font-semibold">{s > 0 ? s.toFixed(3) : '—'}</div>
              <div className="mono text-[10px] text-apex-muted">PB {car.bestSectors[k] < 99999 ? car.bestSectors[k].toFixed(3) : '—'}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-apex-muted">
        <span>Last lap {lapTime(car.lastLap || null)}</span>
        <span>Best {lapTime(car.bestLap)}</span>
      </div>
    </Panel>
  );
}
