import { ArrowDown, ArrowUp, Bot, Check, Timer } from 'lucide-react';
import { useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { driverName } from '@/engine/drivers/ratings';
import { feedbackAccuracy, SETUP_INFO, SETUP_KEYS } from '@/engine/race/setup';
import { autoPractice, finishPractice, runPractice, setPracticeSetup, weekendEvent } from '@/engine/race/weekend';
import { playerTeam } from '@/engine/selectors';
import { staffRating } from '@/engine/staff/staff';
import type { PracticeRun, Setup } from '@/engine/types';
import { DriverLink, TireIcon } from '@/components/common';
import { Badge, Button, cn, Panel, Progress } from '@/components/ui';
import { lapTime } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';

export function Practice() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const weekend = game.weekend!;
  const event = weekendEvent(game)!;
  const driverIds = Object.keys(weekend.practice.setups);
  const allDone = driverIds.every((id) => weekend.practice.runsRemaining[id] === 0);
  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="max-w-2xl text-sm text-apex-muted">
          Adjust each car's setup and send your drivers out. After every run they report where the car is wrong: a <ArrowUp size={12} className="inline text-emerald-400" /> means increase, <ArrowDown size={12} className="inline text-amber-400" /> means decrease. Feedback is not always correct: experienced drivers, a good race engineer and a better simulator make it more reliable. Long runs teach you about tyre wear for the strategy.
        </div>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <div className="label mb-1">Tyre knowledge</div>
            <Progress value={weekend.practice.tireKnowledge} color="#3b82f6" />
          </div>
          <Button variant="primary" size="lg" onClick={() => act((g) => finishPractice(g))}>
            {allDone ? 'Go to qualifying' : 'Skip to qualifying'}
          </Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {driverIds.map((id) => (
          <DriverPractice key={id} driverId={id} />
        ))}
      </div>
      <div className="text-xs text-apex-dim">{DIVISIONS[event.division].practiceRuns} runs per driver at this level. The best setup found is used for qualifying and the race.</div>
    </div>
  );
}

function DriverPractice({ driverId }: { driverId: string }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const weekend = game.weekend!;
  const team = playerTeam(game);
  const d = game.drivers[driverId];
  const setup = weekend.practice.setups[driverId];
  const runs = weekend.practice.runs[driverId];
  const remaining = weekend.practice.runsRemaining[driverId];
  const best = weekend.practice.bestSetupQuality[driverId] ?? 0;
  const last = runs[runs.length - 1];
  const [local, setLocal] = useState<Setup>(setup);
  const accuracy = feedbackAccuracy(d, staffRating(game, team, 'raceEngineer'), team.facilities.simulator.level);
  const commit = (s: Setup) => act((g) => setPracticeSetup(g, driverId, s), { silent: true });
  const run = (program: PracticeRun['program']) => {
    commit(local);
    act((g) => runPractice(g, driverId, program));
  };

  return (
    <Panel
      title={<DriverLink driver={d} className="font-display text-lg uppercase" />}
      actions={
        <>
          <Badge tone={best >= 85 ? 'green' : best >= 65 ? 'amber' : 'neutral'}>Best setup {Math.round(best)}%</Badge>
          <Badge>Runs left {remaining}</Badge>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {SETUP_KEYS.map((k) => {
            const fb = last?.feedback.find((f) => f.key === k);
            return (
              <div key={k}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{SETUP_INFO[k].label}</span>
                  <span className="flex items-center gap-1">
                    {fb && fb.direction !== 0 && (
                      <span className={cn('flex items-center gap-0.5 font-semibold', fb.direction > 0 ? 'text-emerald-400' : 'text-amber-400')}>
                        {fb.direction > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {fb.magnitude === 'large' ? (fb.direction > 0 ? 'much more' : 'much less') : fb.direction > 0 ? 'a bit more' : 'a bit less'}
                      </span>
                    )}
                    {fb && fb.direction === 0 && (
                      <span className="flex items-center gap-0.5 text-sky-300">
                        <Check size={12} /> feels right
                      </span>
                    )}
                    <span className="num ml-2 w-8 text-right text-sm">{local[k]}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local[k]}
                  disabled={remaining === 0}
                  onChange={(e) => setLocal({ ...local, [k]: Number(e.target.value) })}
                  onMouseUp={() => commit(local)}
                  onTouchEnd={() => commit(local)}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-apex-dim">
                  <span>{SETUP_INFO[k].low}</span>
                  <span>{SETUP_INFO[k].high}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <Button className="w-full" variant="primary" disabled={remaining === 0} onClick={() => run('setup')}>
            <Timer size={14} /> Setup run
          </Button>
          <Button className="w-full" disabled={remaining === 0} onClick={() => run('longRun')}>
            Long run (tyres)
          </Button>
          <Button className="w-full" disabled={remaining === 0} onClick={() => run('qualiSim')}>
            Qualifying sim
          </Button>
          <Button
            className="w-full"
            variant="ghost"
            disabled={remaining === 0}
            onClick={() => {
              commit(local);
              act((g) => autoPractice(g, driverId), { success: `${driverName(d)}: engineer completed the programme.` });
              const after = useStore.getState().game?.weekend?.practice.setups[driverId];
              if (after) setLocal(after);
            }}
          >
            <Bot size={14} /> Let engineer run it
          </Button>
          <div className="pt-2 text-[11px] text-apex-muted">Feedback reliability ≈ {Math.round(accuracy * 100)}%</div>
        </div>
      </div>
      {runs.length > 0 && (
        <table className="table-apex mt-4 text-xs">
          <thead>
            <tr>
              <th>Run</th>
              <th>Programme</th>
              <th>Lap</th>
              <th>Setup</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.run}>
                <td>{r.run}</td>
                <td className="capitalize">{r.program === 'qualiSim' ? 'Quali sim' : r.program === 'longRun' ? 'Long run' : 'Setup'}</td>
                <td className="mono">{lapTime(r.lapTime)}</td>
                <td>
                  <span className={r.setupQuality >= 85 ? 'text-emerald-300' : r.setupQuality >= 65 ? 'text-amber-300' : 'text-red-300'}>{Math.round(r.setupQuality)}%</span>
                </td>
                <td>
                  {r.tireNotes ? (
                    <span className="flex items-center gap-2">
                      {r.tireNotes.map((t) => (
                        <span key={t.compound} className="flex items-center gap-1">
                          <TireIcon compound={t.compound} size={14} /> {t.degPerLap.toFixed(1)}%/lap
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-apex-muted">{r.feedback.filter((f) => f.direction !== 0).length} areas flagged</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
