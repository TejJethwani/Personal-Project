import { Cloud, CloudRain, FastForward, Sun } from 'lucide-react';
import { autoplayPlayerWeekend } from '@/engine/game';
import { askConfirm } from '@/store/confirm';
import { DIVISIONS, eventLaps } from '@/engine/config/divisions';
import { nextPlayerEvent } from '@/engine/europe/season';
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
import { EventTwistNotes } from '@/components/SeasonFeatures';
import { H2HBanner } from '@/components/EuroCommon';

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
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const weekend = game.weekend;
  const event = weekendEvent(game);

  if (!weekend || !event) {
    const next = nextPlayerEvent(game);
    const last = [...game.calendars[team.division]].reverse().find((e) => e.completed);
    return (
      <div className="space-y-6">
        <SectionTitle sub="Practice, qualifying and live race management.">Race Center</SectionTitle>
        {next ? (
          <Panel title={next.euro && next.euro.competition !== 'league' ? 'Next race' : 'Next race weekend'}>
            <div className="grid items-center gap-6 md:grid-cols-[1fr_360px]">
              <div>
                {next.euro && next.euro.competition !== 'league' ? <H2HBanner game={game} event={next} /> : <DivisionBadge division={next.division} />}
                {next.euro?.competition === 'league' && <div className="label mt-1">{next.euro.label}</div>}
                <div className="mt-1 font-display text-3xl font-black uppercase">{game.circuits[next.circuitId].name}</div>
                <div className="text-sm text-apex-muted">
                  Round {next.round} · Week {next.week} · {eventLaps(next, game.circuits[next.circuitId].laps)} laps
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
            <span className="label">{event.euro ? `${event.euro.label} · Week ${event.week}` : `Round ${event.round} · Week ${event.week}`}</span>
            {weekend.phase === 'race' && <Badge tone="solid">Live</Badge>}
          </div>
          <h1 className="font-display text-3xl font-black uppercase">{circuit.name}</h1>
          <div className="text-sm text-apex-muted">
            {circuit.location} · {circuit.lengthKm.toFixed(2)} km · {eventLaps(event, circuit.laps)} laps
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Forecast forecast={weekend.forecast} />
          {(weekend.phase === 'practice' || weekend.phase === 'qualifying' || weekend.phase === 'raceSetup') && (
            <Button
              variant="secondary"
              title="Your engineers run practice and qualifying, the strategist picks the plan and the race is simulated to the flag."
              onClick={async () => (await askConfirm('Simulate the rest of this weekend? Your team runs every session automatically and you go straight to the result.', 'Simulate')) && act((g) => autoplayPlayerWeekend(g))}
            >
              <FastForward size={15} /> Simulate weekend
            </Button>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        {PHASES.map((p, i) => (
          <div key={p.id} className={cn('flex-1 rounded-sm py-1.5 text-center font-display text-xs font-bold uppercase tracking-[0.12em]', i < phaseIdx ? 'bg-apex-red/30 text-white/80' : i === phaseIdx ? 'bg-apex-red text-white' : 'bg-white/[0.04] text-apex-dim')}>
            {p.label}
          </div>
        ))}
      </div>
      {game.mode === 'daily' && game.daily && weekend.phase !== 'complete' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-sm">
          <Badge tone="amber">Daily challenge</Badge>
          <span className="text-white/90">{game.daily.description}</span>
        </div>
      )}
      {event.euro && event.euro.competition !== 'league' && weekend.phase !== 'race' && <H2HBanner game={game} event={event} />}
      {weekend.phase !== 'race' && (!event.euro || event.euro.competition === 'league') && <EventTwistNotes game={game} event={event} />}
      {weekend.phase === 'practice' && <Practice />}
      {weekend.phase === 'qualifying' && <Qualifying />}
      {weekend.phase === 'raceSetup' && <RaceSetup />}
      {weekend.phase === 'race' && <LiveRace />}
      {weekend.phase === 'complete' && <RaceComplete />}
    </div>
  );
}
