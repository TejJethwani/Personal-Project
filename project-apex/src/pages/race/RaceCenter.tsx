import { Cloud, CloudRain, Sun } from 'lucide-react';
import { DIVISIONS, raceLapsFor } from '@/engine/config/divisions';
import { nextEventFor } from '@/engine/season/calendar';
import { playerTeam } from '@/engine/selectors';
import { weekendEvent } from '@/engine/race/weekend';
import type { WeatherForecastEntry } from '@/engine/types';
import { CircuitOutline } from '@/components/CircuitMap';
import { DivisionBadge } from '@/components/common';
import { Badge, Button, cn, Panel, SectionTitle } from '@/components/ui';
import { useGame, useStore } from '@/store/gameStore';
import { Practice } from './Practice';
import { Qualifying } from './Qualifying';
import { RaceSetup } from './RaceSetup';
import { LiveRace } from './LiveRace';
import { RaceComplete } from './RaceComplete';
import { ResultTable } from '@/components/RaceResultModal';

const PHASES = [
  { id: 'practice', label: 'Practice' },
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'raceSetup', label: 'Strategy' },
  { id: 'race', label: 'Race' },
  { id: 'complete', label: 'Result' },
] as const;

export function Forecast({ forecast }: { forecast: WeatherForecastEntry[] }) {
  return (
    <div className="flex gap-2">
      {forecast.map((f, i) => (
        <div key={i} className="flex min-w-[64px] flex-col items-center rounded-md border border-apex-line bg-apex-bg/60 px-2 py-1.5 text-[11px]">
          <span className="text-apex-muted">{i === 0 ? 'Start' : i === 1 ? 'Middle' : 'End'}</span>
          {f.rainProbability > 0.6 ? <CloudRain size={18} className="my-0.5 text-sky-400" /> : f.rainProbability > 0.3 ? <Cloud size={18} className="my-0.5 text-apex-muted" /> : <Sun size={18} className="my-0.5 text-yellow-300" />}
          <span className="num font-semibold">{Math.round(f.rainProbability * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export function RaceCenter() {
  const game = useGame();
  const setPage = useStore((s) => s.setPage);
  const team = playerTeam(game);
  const weekend = game.weekend;
  const event = weekendEvent(game);

  if (!weekend || !event) {
    const next = nextEventFor(game, team.division);
    const last = [...game.calendars[team.division]].reverse().find((e) => e.completed);
    return (
      <div className="space-y-6">
        <SectionTitle sub="Practice, qualifying and live race management.">Race Center</SectionTitle>
        {next ? (
          <Panel title="Next race weekend">
            <div className="grid items-center gap-6 md:grid-cols-[1fr_360px]">
              <div>
                <DivisionBadge division={next.division} />
                <div className="mt-1 font-display text-3xl font-black uppercase">{game.circuits[next.circuitId].name}</div>
                <div className="text-sm text-apex-muted">
                  Round {next.round} · Week {next.week} · {raceLapsFor(next.division, game.circuits[next.circuitId].laps)} laps
                </div>
                <p className="mt-3 text-sm">{game.circuits[next.circuitId].character}</p>
                <p className="mt-3 text-sm text-apex-muted">The weekend opens when you advance to week {next.week} (use the Continue button in the top bar).</p>
              </div>
              <CircuitOutline circuit={game.circuits[next.circuitId]} className="w-full" />
            </div>
          </Panel>
        ) : (
          <Panel title="No race scheduled">
            <p className="text-sm text-apex-muted">The {DIVISIONS[team.division].name} season has no more races. {game.phase === 'seasonReview' && <Button size="sm" className="ml-2" onClick={() => setPage('seasonReview')}>Open season review</Button>}</p>
          </Panel>
        )}
        {last && game.results[last.id] && (
          <Panel title={`Last result: ${game.circuits[last.circuitId].name}`}>
            <ResultTable result={game.results[last.id]} compact />
          </Panel>
        )}
      </div>
    );
  }

  const circuit = game.circuits[event.circuitId];
  const phaseIdx = PHASES.findIndex((p) => p.id === weekend.phase);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DivisionBadge division={event.division} />
            <span className="label">
              Round {event.round} · Week {event.week}
            </span>
            {weekend.phase === 'race' && <Badge tone="solid">Live</Badge>}
          </div>
          <h1 className="font-display text-3xl font-black uppercase">{circuit.name}</h1>
          <div className="text-sm text-apex-muted">
            {circuit.location} · {circuit.lengthKm.toFixed(2)} km · {raceLapsFor(event.division, circuit.laps)} laps
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Forecast forecast={weekend.forecast} />
        </div>
      </div>
      <div className="flex gap-1">
        {PHASES.map((p, i) => (
          <div key={p.id} className={cn('flex-1 rounded-sm py-1.5 text-center font-display text-xs font-bold uppercase tracking-[0.12em]', i < phaseIdx ? 'bg-apex-red/30 text-white/80' : i === phaseIdx ? 'bg-apex-red text-white' : 'bg-white/[0.04] text-apex-dim')}>
            {p.label}
          </div>
        ))}
      </div>
      {weekend.phase === 'practice' && <Practice />}
      {weekend.phase === 'qualifying' && <Qualifying />}
      {weekend.phase === 'raceSetup' && <RaceSetup />}
      {weekend.phase === 'race' && <LiveRace />}
      {weekend.phase === 'complete' && <RaceComplete />}
    </div>
  );
}
