import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { DIVISIONS } from '@/engine/config/divisions';
import { divisionStandings } from '@/engine/championship/standings';
import { driverName } from '@/engine/drivers/ratings';
import { finishWeekendAndContinue } from '@/engine/season/advance';
import { weekendEvent } from '@/engine/race/weekend';
import { playerTeam } from '@/engine/selectors';
import { DriverLink, TeamDot, TeamLink } from '@/components/common';
import { ResultTable } from '@/components/RaceResultModal';
import { Badge, Button, Panel } from '@/components/ui';
import { money, ordinal } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';

export function RaceComplete() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const setPage = useStore((s) => s.setPage);
  const event = weekendEvent(game)!;
  const result = game.results[event.id];
  const team = playerTeam(game);
  const race = game.weekend!.race!;
  if (!result) return null;
  const podium = result.entries.slice(0, 3);
  const mine = result.entries.filter((e) => e.teamId === team.id);
  const st = divisionStandings(game, event.division);
  const raceTx = team.ledger.filter((t) => t.season === game.season && t.week === game.week && (t.category === 'sponsor' || t.category === 'raceBonus' || t.category === 'repairs' || t.category === 'operations' || t.category === 'driverFunding'));
  const net = raceTx.reduce((s, t) => s + t.amount, 0);
  const cont = () => {
    act((g) => finishWeekendAndContinue(g));
    const phase = useStore.getState().game?.phase;
    setPage(phase === 'seasonReview' ? 'seasonReview' : 'hq');
  };
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-apex-line bg-apex-panel p-6">
        <div className="pointer-events-none absolute inset-0 bg-apex-grad" />
        <div className="relative flex flex-wrap items-end justify-center gap-4">
          {[1, 0, 2].map((i) => {
            const e = podium[i];
            if (!e) return null;
            const t = game.teams[e.teamId];
            const h = i === 0 ? 150 : i === 1 ? 115 : 95;
            return (
              <motion.div key={e.driverId} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 * (3 - i) }} className="flex w-48 flex-col items-center">
                <DriverLink driver={game.drivers[e.driverId]} className="font-display text-lg font-bold uppercase" flag={false} />
                <div className="mb-2 text-xs text-apex-muted">{t.name}</div>
                <div className="flex w-full items-start justify-center rounded-t-lg pt-3 font-display text-4xl font-black" style={{ height: h, background: `linear-gradient(180deg, ${t.colors.primary}, ${t.colors.primary}55)` }}>
                  {i + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="relative mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
          {mine.map((e) => (
            <Badge key={e.driverId} tone={e.status !== 'finished' ? 'red' : e.position <= 3 ? 'gold' : e.points > 0 ? 'green' : 'neutral'} className="px-3 py-1 text-xs">
              {driverName(game.drivers[e.driverId])}: {e.status === 'finished' ? ordinal(e.position) : `DNF (${e.reason})`} {e.points > 0 && `· +${e.points} pts`}
            </Badge>
          ))}
          {result.safetyCars > 0 && <Badge tone="amber">{result.safetyCars}× safety car</Badge>}
          {result.wet && <Badge tone="blue">Wet race</Badge>}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Weekend finances">
          <div className="space-y-1.5 text-sm">
            {raceTx.map((t, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-apex-muted">{t.label}</span>
                <span className={t.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}>{money(t.amount, { sign: true })}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-apex-line pt-2 font-semibold">
              <span>Net</span>
              <span className={net >= 0 ? 'text-emerald-300' : 'text-red-300'}>{money(net, { sign: true })}</span>
            </div>
          </div>
        </Panel>
        <Panel title="Drivers' championship">
          {st.drivers.slice(0, 6).map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="num w-6 font-bold">{i + 1}</span>
              <TeamDot team={game.teams[r.teamId ?? '']} />
              <span className="flex-1 truncate">{driverName(game.drivers[r.id])}</span>
              <span className="num font-semibold">{r.points}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Teams' championship">
          {st.constructors.slice(0, 6).map((r, i) => (
            <div key={r.id} className={`flex items-center gap-2 py-0.5 text-sm ${r.id === team.id ? 'text-white' : ''}`}>
              <span className="num w-6 font-bold">{i + 1}</span>
              <TeamLink team={game.teams[r.id]} className="flex-1" />
              <span className="num font-semibold">{r.points}</span>
            </div>
          ))}
          {st.constructors.findIndex((r) => r.id === team.id) >= 6 && (
            <div className="mt-1 text-xs text-apex-muted">
              You: P{st.constructors.findIndex((r) => r.id === team.id) + 1} with {st.constructors.find((r) => r.id === team.id)!.points} pts
            </div>
          )}
        </Panel>
      </div>
      <Panel title={`Classification · ${DIVISIONS[event.division].name} round ${event.round}`} actions={<span className="text-xs text-apex-muted">{race.totalLaps} laps</span>}>
        <ResultTable result={result} />
      </Panel>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={cont}>
          <Trophy size={16} /> Continue
        </Button>
      </div>
    </div>
  );
}
