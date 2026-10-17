import { Flag } from 'lucide-react';
import { DIVISIONS, eventLaps } from '@/engine/config/divisions';
import { chooseStrategy, setFuelMargin, setStartInstructions, startRace, weekendEvent } from '@/engine/race/weekend';
import type { PaceMode, StrategyPlan, TireCompound, TireMode } from '@/engine/types';
import { DriverLink, TireIcon } from '@/components/common';
import { Badge, Button, cn, Panel, Segmented } from '@/components/ui';
import { useGame, useStore } from '@/store/gameStore';
import { QualiTable } from './Qualifying';

export function RaceSetup() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const weekend = game.weekend!;
  const event = weekendEvent(game)!;
  const cfg = DIVISIONS[event.division];
  const circuit = game.circuits[event.circuitId];
  const laps = eventLaps(event, circuit.laps);
  const quali = weekend.qualifying.result!;
  const grid = [...quali.entries].sort((a, b) => a.grid - b.grid);
  const derivedGrid = quali.sessions === 0;
  const driverIds = Object.keys(weekend.strategies);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {driverIds.map((id) => {
          const options = weekend.strategyOptions[id] ?? [];
          const chosen = weekend.strategies[id];
          const ins = weekend.startInstructions[id];
          const q = quali.entries.find((e) => e.driverId === id);
          const best = options[0]?.predictedTime ?? 0;
          return (
            <Panel key={id} title={<DriverLink driver={game.drivers[id]} className="font-display text-lg uppercase" />} actions={<Badge tone="solid">Grid P{q?.grid}</Badge>}>
              <div className="label mb-2">Strategist's options ({laps} laps)</div>
              <div className="space-y-2">
                {options.map((o, i) => {
                  const active = chosen.label === o.label;
                  return (
                    <button key={o.label} onClick={() => act((g) => chooseStrategy(g, id, i))} className={cn('flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left', active ? 'border-apex-red bg-apex-red/10' : 'border-apex-line hover:border-apex-line2')}>
                      <span className="flex items-center gap-1">
                        <TireIcon compound={o.startCompound} />
                        {o.stops.map((s, k) => (
                          <span key={k} className="flex items-center gap-1 text-apex-dim">
                            →<TireIcon compound={s.compound} />
                          </span>
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{o.label}</span>
                        <StintBar plan={o} laps={laps} />
                      </span>
                      <span className="mono text-xs text-apex-muted">{o.predictedTime !== undefined ? (i === 0 ? 'fastest' : `+${(o.predictedTime - best).toFixed(1)}s`) : ''}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="label mb-1">Opening pace</div>
                  <Segmented<PaceMode>
                    size="xs"
                    value={ins.pace}
                    onChange={(v) => act((g) => setStartInstructions(g, id, { pace: v }))}
                    options={[
                      { value: 'conserve', label: 'Conserve' },
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'push', label: 'Push' },
                      { value: 'attack', label: 'Attack' },
                    ]}
                  />
                </div>
                <div>
                  <div className="label mb-1">Tyre usage</div>
                  <Segmented<TireMode>
                    size="xs"
                    value={ins.tires}
                    onChange={(v) => act((g) => setStartInstructions(g, id, { tires: v }))}
                    options={[
                      { value: 'preserve', label: 'Preserve' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'aggressive', label: 'Aggressive' },
                    ]}
                  />
                </div>
                {cfg.fuelManagement && (
                  <div className="sm:col-span-2">
                    <div className="label mb-1">Fuel load: {weekend.startFuelMargin[id] >= 0 ? '+' : ''}{Math.round(weekend.startFuelMargin[id] * 100)}% margin</div>
                    <input type="range" min={-4} max={5} step={1} value={Math.round(weekend.startFuelMargin[id] * 100)} onChange={(e) => act((g) => setFuelMargin(g, id, Number(e.target.value) / 100), { silent: true })} className="w-full" />
                    <div className="text-[11px] text-apex-muted">Less fuel = lighter and faster early, but the driver will have to lift-and-coast later. Run dry and the car stops.</div>
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={() => act((g) => startRace(g))}>
          <Flag size={16} /> Start the race
        </Button>
      </div>
      <Panel title={derivedGrid ? `Starting grid · ${grid[0]?.note ?? ''}` : 'Starting grid'}>
        <QualiTable entries={grid} gridOnly={derivedGrid} />
      </Panel>
    </div>
  );
}

const COMPOUND_COLOR: Record<TireCompound, string> = { soft: '#ef4444', medium: '#facc15', hard: '#e5e7eb', intermediate: '#22c55e', wet: '#3b82f6' };

/** Stints of a strategy drawn to scale across the race distance. */
function StintBar({ plan, laps }: { plan: StrategyPlan; laps: number }) {
  const stints: { compound: TireCompound; from: number; to: number }[] = [];
  let from = 1;
  let compound = plan.startCompound;
  for (const stop of plan.stops) {
    stints.push({ compound, from, to: stop.lap });
    from = stop.lap + 1;
    compound = stop.compound;
  }
  stints.push({ compound, from, to: laps });
  return (
    <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded bg-white/[0.05]" title={stints.map((st) => `${st.compound} L${st.from}-${st.to}`).join(' · ')}>
      {stints.map((st, i) => (
        <span key={i} className="h-full border-r border-apex-bg last:border-0" style={{ width: `${((st.to - st.from + 1) / laps) * 100}%`, background: COMPOUND_COLOR[st.compound] }} />
      ))}
    </span>
  );
}
