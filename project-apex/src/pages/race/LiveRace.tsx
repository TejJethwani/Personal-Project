import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CloudRain, FastForward, Pause, Play, SkipForward, Thermometer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { championshipPoints, divisionStandings } from '@/engine/championship/standings';
import { driverCode, driverName, driverShortName } from '@/engine/drivers/ratings';
import { applyRaceCommand, fuelPerLap, type RaceCommand } from '@/engine/race/engine';
import { allowedCompounds } from '@/engine/race/tires';
import { weatherLabel } from '@/engine/race/weather';
import { advanceRace, weekendEvent } from '@/engine/race/weekend';
import type { CarRaceState, ErsMode, FuelMode, PaceMode, RaceState, TeamOrder, TireMode } from '@/engine/types';
import { TeamDot, TireIcon } from '@/components/common';
import { Badge, Button, cn, Panel, Progress, Segmented, Toggle } from '@/components/ui';
import { lapTime } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { BroadcastMap, CAMERA_LABELS, type AnimState, type Camera } from './live/BroadcastMap';
import { Tower, type GapMode } from './live/Tower';
import { AlertTicker, CarStrip, CommentaryPanel, MomentOverlay, RaceDirectorPanel, StrategyPanel, TeamRadioPanel, useCommentary } from './live/Panels';
import { StartOverlay, useStartSequence } from './live/StartSequence';
import type { RaceAdvanceMode } from '@/engine/race/weekend';
import { H2HLiveScore } from '@/components/EuroCommon';
import { askConfirm } from '@/store/confirm';

const SPEEDS = [1, 5, 20, 60] as const;

type ViewMode = 'broadcast' | 'manager' | 'highlights' | 'fast';
const VIEW_KEY = 'apex-race-view';

function loadView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'broadcast' || v === 'manager' || v === 'highlights' || v === 'fast') return v;
  } catch {
    // Storage unavailable: default view.
  }
  return 'manager';
}

export function LiveRace() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const race = game.weekend!.race!;
  const event = weekendEvent(game)!;
  const circuit = game.circuits[race.circuitId];
  const [view, setView] = useState<ViewMode>(() => loadView());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(game.settings.defaultRaceSpeed ?? 20);
  const [gapMode, setGapMode] = useState<GapMode>('interval');
  const [selected, setSelected] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>('full');
  const anim = useRef<AnimState>({ start: performance.now(), f: 1, prevGaps: new Map(), prevLap: race.lap });
  const leader = race.cars.find((c) => c.position === 1);
  const leaderLap = race.lap > 0 && leader ? Math.max(20, leader.lastLap) : race.baseLapTime;
  const leaderLapRef = useRef(leaderLap);
  leaderLapRef.current = leaderLap;
  const lines = useCommentary(game, race);
  const order = [...race.cars].sort((a, b) => a.position - b.position);
  const playerCars = order.filter((c) => c.isPlayer);
  const focusId = selected ?? playerCars[0]?.driverId ?? order[0]?.driverId ?? null;
  const rejoinFor = selected && race.cars.find((c) => c.driverId === selected)?.isPlayer ? selected : playerCars.find((c) => c.status === 'running')?.driverId ?? null;

  const changeView = (v: ViewMode) => {
    setView(v);
    setPlaying(false);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Preference not kept without storage.
    }
  };

  const snapshotGaps = () => {
    const m = new Map<string, number>();
    for (const c of race.cars) m.set(c.driverId, c.gapToLeader);
    anim.current.prevGaps = m;
    anim.current.prevLap = race.lap;
  };

  const step = useCallback(
    (mode: RaceAdvanceMode, animate = true) => {
      snapshotGaps();
      act((g) => advanceRace(g, mode));
      anim.current.start = performance.now();
      anim.current.f = mode === 'lap' && animate ? 0 : 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [act, race],
  );

  // Broadcast and manager views: one animated lap at a time.
  useEffect(() => {
    if (!playing || (view !== 'broadcast' && view !== 'manager')) return;
    let raf = 0;
    const dur = () => (leaderLapRef.current / speed) * 1000;
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
  }, [playing, speed, step, view]);

  // Highlights: jump from one key moment to the next, pausing on each.
  useEffect(() => {
    if (!playing || view !== 'highlights') return;
    const t = setTimeout(() => {
      if (useStore.getState().game?.weekend?.race?.finished) {
        setPlaying(false);
        return;
      }
      step('key');
    }, race.lap === 0 ? 300 : 2600);
    return () => clearTimeout(t);
  }, [playing, view, step, race.lap]);

  // Fast simulation: laps as quickly as the screen can show them.
  useEffect(() => {
    if (!playing || view !== 'fast') return;
    const t = setTimeout(() => {
      if (useStore.getState().game?.weekend?.race?.finished) {
        setPlaying(false);
        return;
      }
      step('lap', false);
    }, 30);
    return () => clearTimeout(t);
  }, [playing, view, step, race.lap]);

  // Lights out: a formation lap and the start lights before the first lap, in the watched views.
  const start = useStartSequence(() => setPlaying(true));
  const play = () => {
    if (playing) return setPlaying(false);
    if (race.lap === 0 && (view === 'broadcast' || view === 'manager') && !start.active) return start.begin();
    setPlaying(true);
  };
  const command = (driverId: string, cmd: RaceCommand) => act((g) => applyRaceCommand(g, g.weekend!.race!, driverId, cmd));
  const wx = race.weather[Math.max(0, race.lap - 1)] ?? race.weather[0];
  const nextWx = race.weather[Math.min(race.weather.length - 1, race.lap)] ?? wx;
  const sc = race.safetyCar.type;
  const playLabel = playing ? 'Pause' : race.lap === 0 ? (view === 'highlights' ? 'Play highlights' : view === 'fast' ? 'Simulate' : 'Lights out') : 'Resume';

  const map = (
    <div className="panel relative overflow-hidden p-2">
      <BroadcastMap race={race} circuit={circuit} anim={anim} leaderLapRef={leaderLapRef} camera={camera} followId={focusId} sectorCar={focusId} />
      <MomentOverlay game={game} race={race} lines={lines} />
      <AlertTicker race={race} lines={lines} />
      <StartOverlay game={game} race={race} seq={start} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
        <span className="font-display text-sm uppercase tracking-[0.14em] text-apex-muted">{circuit.location}</span>
        {race.fastestLap && (
          <span className="flex items-center gap-2 rounded bg-black/40 px-2 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-apex-purple" /> Fastest lap {driverShortName(game.drivers[race.fastestLap.driverId])} {lapTime(race.fastestLap.time)} (L{race.fastestLap.lap})
          </span>
        )}
        <Segmented size="xs" value={camera} onChange={setCamera} options={(Object.keys(CAMERA_LABELS) as Camera[]).map((c) => ({ value: c, label: CAMERA_LABELS[c].label, title: CAMERA_LABELS[c].title }))} />
      </div>
    </div>
  );
  const tower = <Tower race={race} event={event} circuit={circuit} mode={gapMode} setMode={setGapMode} selected={selected} onSelect={setSelected} rejoinFor={rejoinFor} />;

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="panel flex flex-wrap items-center gap-4 p-3">
        <div className="flex items-baseline gap-2 pl-1">
          <span className="label">Lap</span>
          <span className="num text-3xl font-black">{race.lap}</span>
          <span className="num text-lg text-apex-muted">/ {race.totalLaps}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant={playing ? 'secondary' : 'primary'} size="md" onClick={play} disabled={race.finished || start.active}>
            {playing ? <Pause size={16} /> : <Play size={16} />} {playLabel}
          </Button>
          {(view === 'broadcast' || view === 'manager') && <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, title: s === 1 ? 'Real time' : `${s}× speed` }))} />}
          <Button size="md" onClick={() => step('lap')} disabled={race.finished || playing} title="Simulate one lap">
            <SkipForward size={15} /> Lap
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="label mr-1 flex items-center gap-1">
            <FastForward size={13} /> Simulate to
          </span>
          {(
            [
              ['overtake', 'Next overtake', 'The next pass at the front or involving your cars'],
              ['pitWindow', 'Pit window', 'Until one of your cars should pit'],
              ['incident', 'Safety car / incident', 'Until a safety car, crash, collision or failure'],
              ['final5', 'Final 5 laps', 'Until five laps to go'],
            ] as const
          ).map(([mode, label, title]) => (
            <Button key={mode} size="sm" variant="secondary" onClick={() => step(mode, false)} disabled={race.finished || playing || start.active} title={`${title}. Stops early for anything urgent for your cars; if it never happens, runs to the flag.`}>
              {label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={async () => (await askConfirm('Simulate to the chequered flag?')) && step('finish')} disabled={race.finished || start.active}>
            Finish
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <Segmented<ViewMode>
            value={view}
            onChange={changeView}
            options={[
              { value: 'broadcast', label: 'Broadcast', title: 'TV-style: big map, timing and commentary' },
              { value: 'manager', label: 'Manager', title: 'Full race control for your cars' },
              { value: 'highlights', label: 'Highlights', title: 'Jump from one key moment to the next' },
              { value: 'fast', label: 'Fast sim', title: 'Run the race at full speed' },
            ]}
          />
          <span className="flex items-center gap-1.5">
            {wx.rain > 0.1 ? <CloudRain size={16} className="text-sky-400" /> : <Thermometer size={16} className="text-apex-muted" />}
            {weatherLabel(wx.rain, wx.wetness)}
          </span>
          <span className="text-apex-muted">Track {Math.round(wx.trackTemp)}°C</span>
          <span className="w-20">
            <span className="label">Wetness</span>
            <Progress value={wx.wetness * 100} color="#3b82f6" />
          </span>
          {nextWx.rain > wx.rain + 0.1 && <Badge tone="blue">Rain approaching</Badge>}
        </div>
      </div>
      <p className="text-[11px] text-apex-muted">Every view runs the same simulation: switching views never changes the result. Your orders and pit calls do.</p>

      <H2HLiveScore game={game} event={event} race={race} />

      <AnimatePresence>
        {sc !== 'none' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 rounded-lg bg-yellow-400 py-2 font-display text-lg font-black uppercase tracking-[0.2em] text-black">
            <AlertTriangle size={18} /> {sc === 'sc' ? 'Safety Car' : 'Virtual Safety Car'} · pit stops are cheaper now
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'broadcast' && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[380px_1fr_360px]">
          {tower}
          <div className="space-y-3">
            {map}
            <div className="grid gap-2 sm:grid-cols-2">
              {playerCars.map((c) => (
                <CarStrip key={c.driverId} game={game} race={race} car={c} />
              ))}
            </div>
            {camera === 'strategy' && (
              <div className="grid gap-4 lg:grid-cols-2">
                {playerCars
                  .filter((c) => c.status === 'running')
                  .map((c) => (
                    <StrategyPanel key={c.driverId} game={game} race={race} car={c} circuit={circuit} onCommand={command} />
                  ))}
              </div>
            )}
            <div className="space-y-4 2xl:hidden">
              <CommentaryPanel game={game} race={race} lines={lines} height={280} />
              <div className="grid gap-4 lg:grid-cols-2">
                <TeamRadioPanel game={game} race={race} />
                <RaceDirectorPanel game={game} race={race} />
              </div>
            </div>
          </div>
          <div className="hidden space-y-4 2xl:block">
            <CommentaryPanel game={game} race={race} lines={lines} height={360} />
            <TeamRadioPanel game={game} race={race} height={200} />
            <RaceDirectorPanel game={game} race={race} height={180} />
            {!event.pointsPreset && <LiveChampionship race={race} division={event.division} />}
          </div>
        </div>
      )}

      {view === 'manager' && (
        <div className="grid gap-4 2xl:grid-cols-[minmax(320px,380px)_1fr_400px] xl:grid-cols-[360px_1fr]">
          {tower}
          <div className="space-y-4">
            {map}
            <div className="grid gap-4 lg:grid-cols-2">
              {playerCars.map((c) => (
                <DriverControl key={c.driverId} car={c} race={race} onCommand={(cmd) => command(c.driverId, cmd)} />
              ))}
            </div>
          </div>
          <div className="space-y-4 xl:col-span-2 2xl:col-span-1">
            {playerCars
              .filter((c) => c.status === 'running')
              .map((c) => (
                <StrategyPanel key={c.driverId} game={game} race={race} car={c} circuit={circuit} onCommand={command} />
              ))}
            <TeamRadioPanel game={game} race={race} height={200} />
            <CommentaryPanel game={game} race={race} lines={lines} height={260} />
            <RaceDirectorPanel game={game} race={race} height={180} />
            {!event.pointsPreset && <LiveChampionship race={race} division={event.division} />}
            <SectorPanel race={race} driverId={focusId ?? undefined} />
          </div>
        </div>
      )}

      {view === 'highlights' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            {map}
            <div className="grid gap-2 sm:grid-cols-2">
              {playerCars.map((c) => (
                <CarStrip key={c.driverId} game={game} race={race} car={c} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Panel title="Key moments">
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto">
                {lines
                  .filter((l) => l.key)
                  .slice(-30)
                  .reverse()
                  .map((l) => (
                    <div key={l.id} className="flex gap-2 text-xs">
                      <span className="mono w-7 shrink-0 text-apex-dim">L{l.lap}</span>
                      <span className="text-white/90">{l.text}</span>
                    </div>
                  ))}
              </div>
            </Panel>
            {!event.pointsPreset && <LiveChampionship race={race} division={event.division} />}
          </div>
        </div>
      )}

      {view === 'fast' && (
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          {tower}
          <div className="space-y-4">
            <Panel title="Fast simulation">
              <Progress value={(race.lap / race.totalLaps) * 100} />
              <div className="mt-2 flex justify-between text-xs text-apex-muted">
                <span>
                  Lap {race.lap} of {race.totalLaps}
                </span>
                <span>{race.finished ? 'Finished' : playing ? 'Simulating…' : 'Paused'}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {playerCars.map((c) => (
                  <CarStrip key={c.driverId} game={game} race={race} car={c} />
                ))}
              </div>
            </Panel>
            <CommentaryPanel game={game} race={race} lines={lines} height={360} />
          </div>
        </div>
      )}
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
  const lapsOfFuel = car.fuel / fuelPerLap(cfg, game.circuits[race.circuitId]);
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
            fill
            value={car.instructions.pace}
            onChange={(v) => onCommand({ type: 'pace', value: v })}
            options={[
              { value: 'conserve', label: 'Conserve' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'push', label: 'Push' },
              { value: 'attack', label: 'Attack', title: 'Maximum attack: fastest, but wears tyres and risks mistakes' },
            ]}
          />
          <div className="space-y-2">
            <div>
              <div className="label mb-1">Tyres</div>
              <Segmented<TireMode>
                size="xs"
                fill
                value={car.instructions.tires}
                onChange={(v) => onCommand({ type: 'tires', value: v })}
                options={[
                  { value: 'preserve', label: 'Preserve' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'aggressive', label: 'Aggressive' },
                ]}
              />
            </div>
            {cfg.fuelManagement && (
              <div>
                <div className="label mb-1">Fuel mix</div>
                <Segmented<FuelMode>
                  size="xs"
                  fill
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
              <div>
                <div className="label mb-1">Energy (ERS)</div>
                <Segmented<ErsMode>
                  size="xs"
                  fill
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
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-apex-muted">
            <span className="label mr-1">Stints</span>
            {car.stints.map((s, i) => (
              <span key={i} className="flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5">
                <TireIcon compound={s.compound} size={13} /> L{s.fromLap}–{s.toLap ?? race.lap}
              </span>
            ))}
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

function LiveChampionship({ race, division }: { race: RaceState; division: RaceState['division'] }) {
  const game = useGame();
  const sys = championshipPoints(game, division);
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
