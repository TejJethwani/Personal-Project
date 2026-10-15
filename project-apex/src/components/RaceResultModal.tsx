import { DIVISIONS } from '@/engine/config/divisions';
import { findEvent } from '@/engine/season/calendar';
import type { RaceResult } from '@/engine/types';
import { lapTime } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { DriverLink, TeamLink } from './common';
import { Badge, Modal } from './ui';

export function findResult(game: ReturnType<typeof useGame>, eventId: string): RaceResult | null {
  if (game.results[eventId]) return game.results[eventId];
  for (const h of game.history) for (const d of Object.values(h.divisions)) {
    const r = d.results.find((x) => x.eventId === eventId);
    if (r) return r;
  }
  return null;
}

export function RaceResultModal() {
  const id = useStore((s) => s.resultView);
  const open = useStore((s) => s.openResult);
  return (
    <Modal open={!!id} onClose={() => open(null)} title="Race Classification" width="max-w-4xl">
      {id && <ResultBody eventId={id} />}
    </Modal>
  );
}

export function ResultTable({ result, compact = false }: { result: RaceResult; compact?: boolean }) {
  const game = useGame();
  return (
    <table className="table-apex">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          {!compact && <th>Team</th>}
          <th>Grid</th>
          <th>Laps</th>
          <th>Time / gap</th>
          <th>Pits</th>
          {!compact && <th>Best lap</th>}
          <th className="text-right">Pts</th>
        </tr>
      </thead>
      <tbody>
        {result.entries.map((e) => {
          const mine = e.teamId === game.player.teamId;
          return (
            <tr key={e.driverId} className={mine ? 'bg-apex-red/[0.07]' : ''}>
              <td className="num font-bold">{e.status === 'finished' ? e.position : 'DNF'}</td>
              <td>
                <DriverLink driver={game.drivers[e.driverId]} />
                {e.driverId === result.poleDriverId && <Badge className="ml-1" tone="blue">Pole</Badge>}
                {e.fastestLap && <Badge className="ml-1" tone="purple">FL</Badge>}
              </td>
              {!compact && (
                <td>
                  <TeamLink team={game.teams[e.teamId]} />
                </td>
              )}
              <td className="text-apex-muted">
                {e.grid}
                {e.status === 'finished' && e.grid !== e.position && <span className={e.grid > e.position ? 'ml-1 text-emerald-400' : 'ml-1 text-red-400'}>{e.grid > e.position ? `+${e.grid - e.position}` : e.grid - e.position}</span>}
              </td>
              <td>{e.laps}</td>
              <td className="mono text-xs">{e.gap}{e.penaltySeconds > 0 ? <span className="ml-1 text-amber-300">(+{e.penaltySeconds}s pen)</span> : null}</td>
              <td>{e.pitStops}</td>
              {!compact && <td className="mono text-xs">{lapTime(e.bestLap)}</td>}
              <td className="num text-right font-bold">{e.points || ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ResultBody({ eventId }: { eventId: string }) {
  const game = useGame();
  const result = findResult(game, eventId);
  if (!result) return <div className="text-apex-muted">This race has not been run yet.</div>;
  const circuit = game.circuits[result.circuitId];
  const ev = findEvent(game, eventId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-2xl font-bold uppercase">{circuit.name}</div>
          <div className="text-sm text-apex-muted">
            {DIVISIONS[result.division].name} · Season {result.season} · Round {result.round} {ev ? `· Week ${ev.week}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          {result.wet && <Badge tone="blue">Wet race</Badge>}
          {result.safetyCars > 0 && <Badge tone="amber">{result.safetyCars} safety car{result.safetyCars > 1 ? 's' : ''}</Badge>}
        </div>
      </div>
      <ResultTable result={result} />
    </div>
  );
}
