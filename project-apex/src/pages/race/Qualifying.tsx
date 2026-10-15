import { Play } from 'lucide-react';
import { DIVISIONS } from '@/engine/config/divisions';
import { qualifyingWetness, sessionSizes } from '@/engine/race/qualifying';
import { participantsFor, runNextQualifyingSession, setQualifyingRisk, weekendEvent } from '@/engine/race/weekend';
import type { QualifyingEntry } from '@/engine/types';
import { DriverLink, TeamLink } from '@/components/common';
import { Badge, Button, cn, Empty, Panel, Segmented } from '@/components/ui';
import { lapTime } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';

export function sessionName(sessions: number, idx: number): string {
  if (sessions === 1) return 'Qualifying';
  return `Q${idx + 1}`;
}

export function QualiTable({ entries, cutAfter, sessionIdx }: { entries: QualifyingEntry[]; cutAfter?: number; sessionIdx?: number }) {
  const game = useGame();
  const valid = entries.filter((e) => e.bestLap !== null);
  const pole = valid[0]?.bestLap ?? null;
  const bestSec = [0, 1, 2].map((k) => Math.min(...entries.filter((e) => e.sectors).map((e) => e.sectors![k])));
  return (
    <table className="table-apex">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Team</th>
          <th>Best lap</th>
          <th>Gap</th>
          <th>S1</th>
          <th>S2</th>
          <th>S3</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const mine = e.teamId === game.player.teamId;
          const lap = sessionIdx !== undefined ? (e.sessionTimes[sessionIdx] ?? e.bestLap) : e.bestLap;
          return (
            <tr key={e.driverId} className={cn(mine && 'bg-apex-red/[0.08]', cutAfter !== undefined && i === cutAfter - 1 && 'border-b-2 border-b-apex-red')}>
              <td className="num font-bold">{i + 1}</td>
              <td>
                <DriverLink driver={game.drivers[e.driverId]} />
              </td>
              <td>
                <TeamLink team={game.teams[e.teamId]} short />
              </td>
              <td className={cn('mono', i === 0 && 'text-apex-purple')}>{lapTime(lap)}</td>
              <td className="mono text-apex-muted">{lap !== null && pole !== null && i > 0 ? `+${(lap - pole).toFixed(3)}` : ''}</td>
              {[0, 1, 2].map((k) => (
                <td key={k} className={cn('mono text-xs', e.sectors && Math.abs(e.sectors[k] - bestSec[k]) < 1e-6 ? 'text-apex-purple' : 'text-apex-muted')}>
                  {e.sectors ? e.sectors[k].toFixed(3) : '—'}
                </td>
              ))}
              <td className="text-xs">
                {e.note && <Badge tone={e.note === 'Lap deleted' ? 'red' : 'amber'}>{e.note}</Badge>}
                {e.gridPenalty > 0 && <Badge tone="red">+{e.gridPenalty} grid</Badge>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Qualifying() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const weekend = game.weekend!;
  const event = weekendEvent(game)!;
  const cfg = DIVISIONS[event.division];
  const field = participantsFor(game, event).length;
  const sizes = sessionSizes(event.division, field);
  const idx = weekend.qualifying.sessionIndex;
  const lastSession = weekend.qualifying.sessionResults[idx - 1];
  const wet = qualifyingWetness(game, event);
  const driverIds = Object.keys(weekend.qualifying.riskMode);
  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-5">
          {driverIds.map((id) => (
            <div key={id} className="flex items-center gap-3">
              <DriverLink driver={game.drivers[id]} className="font-semibold" />
              <Segmented
                size="xs"
                value={weekend.qualifying.riskMode[id]}
                onChange={(v) => act((g) => setQualifyingRisk(g, id, v))}
                options={[
                  { value: 'safe', label: 'Banker', title: 'Fewer mistakes, slightly slower' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'maximum', label: 'Max attack', title: 'Faster, but more deleted laps' },
                ]}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {wet > 0.2 && <Badge tone="blue">Wet session</Badge>}
          <Button variant="primary" size="lg" onClick={() => act((g) => runNextQualifyingSession(g))}>
            <Play size={16} /> Run {sessionName(cfg.qualifyingSessions, idx)}
          </Button>
        </div>
      </div>
      <Panel title={lastSession ? `${sessionName(cfg.qualifyingSessions, idx - 1)} result` : 'Qualifying'}>
        {lastSession ? (
          <QualiTable entries={lastSession} cutAfter={sizes[idx]} />
        ) : (
          <Empty>
            {cfg.qualifyingSessions === 1
              ? 'A single qualifying session: each driver has three timed runs. The track gets faster as rubber goes down.'
              : `Knockout qualifying: ${sizes.join(' → ')} cars. The slowest are eliminated after each session.`}
          </Empty>
        )}
      </Panel>
    </div>
  );
}
