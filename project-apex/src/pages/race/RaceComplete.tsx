import { motion } from 'framer-motion';
import { Star, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createDailyChallenge, dailyStars } from '@/engine/daily';
import { loadProfile, recordDaily, type Profile } from '@/lib/profile';
import { DIVISIONS } from '@/engine/config/divisions';
import { driverName } from '@/engine/drivers/ratings';
import { finishWeekendAndContinue } from '@/engine/season/advance';
import { weekendEvent } from '@/engine/race/weekend';
import { playerTeam } from '@/engine/selectors';
import { DriverLink } from '@/components/common';
import { ResultTable } from '@/components/RaceResultModal';
import { Badge, Button, Panel } from '@/components/ui';
import { money, ordinal } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { nextPlayerEvent } from '@/engine/europe/season';
import { H2HBanner } from '@/components/EuroCommon';
import { PostRaceReport } from './PostRace';
import { stageLabel } from '@/engine/europe/fixtures';
import type { CalendarEvent, GameState } from '@/engine/types';

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
  const raceTx = team.ledger.filter((t) => t.season === game.season && t.week === game.week && (t.category === 'sponsor' || t.category === 'raceBonus' || t.category === 'repairs' || t.category === 'operations' || t.category === 'driverFunding'));
  const net = raceTx.reduce((s, t) => s + t.amount, 0);
  const h2h = !!event.euro && event.euro.competition !== 'league';
  // The next race this week (race 2, an extra race, a cup tie...) starts straight after this one.
  const nextUp = (() => {
    if (!game.europe) return null;
    const after = nextPlayerEvent(game);
    if (!after || after.id === event.id || after.week > game.week) return null;
    if (after.euro?.raceNo === 2 && after.euro.pairedEventId === event.id) return 'Race 2';
    return after.euro?.label ?? 'next race';
  })();
  const cont = () => {
    act((g) => finishWeekendAndContinue(g));
    const phase = useStore.getState().game?.phase;
    setPage(phase === 'seasonReview' ? 'seasonReview' : phase === 'weekend' ? 'race' : 'hq');
  };
  return (
    <div className="space-y-5">
      {game.mode === 'daily' && <DailyResultCard />}
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
      {h2h && <H2HBanner game={game} event={event} />}
      {h2h && <TieStatus game={game} event={event} />}
      <div className={game.mode === 'daily' ? 'hidden' : 'grid gap-5 xl:grid-cols-3'}>
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
      </div>
      {game.mode !== 'daily' && <PostRaceReport game={game} event={event} result={result} race={race} />}
      <Panel title={`Classification · ${event.euro?.label ?? `${DIVISIONS[event.division].name} round ${event.round}`}`} actions={<span className="text-xs text-apex-muted">{race.totalLaps} laps</span>}>
        <ResultTable result={result} />
      </Panel>
      {game.mode !== 'daily' && (
        <div className="flex justify-end">
          <Button variant="primary" size="lg" onClick={cont}>
            <Trophy size={16} /> {nextUp ? `Continue to ${nextUp}` : 'Continue'}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Daily challenge outcome: stars, goal, streak; recorded once in the browser profile. */
function DailyResultCard() {
  const game = useGame();
  const loadDaily = useStore((s) => s.loadDaily);
  const quit = useStore((s) => s.quitToTitle);
  const daily = game.daily!;
  const stars = dailyStars(daily.bestFinish, daily.goalPosition);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  useEffect(() => {
    if (game.processed['daily:recorded']) return;
    game.processed['daily:recorded'] = true;
    setProfile(recordDaily(daily.date, { bestFinish: daily.bestFinish, stars, goal: daily.goalPosition, title: daily.title }));
  }, [game, daily, stars]);
  const best = profile.daily.results[daily.date];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-500/50 bg-amber-500/[0.07] p-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="label text-amber-300">Daily challenge · {daily.date}</div>
          <div className="mt-1 font-display text-3xl font-black uppercase">{stars > 0 ? (stars === 3 ? 'Perfect drive!' : 'Goal achieved!') : 'Goal missed'}</div>
          <p className="mt-1 text-sm text-white/80">
            Best finish: {daily.bestFinish ? ordinal(daily.bestFinish) : 'no classified finish'} · goal P{daily.goalPosition} or better.
          </p>
          <p className="mt-1 text-xs text-apex-muted">
            Streak: {profile.daily.streak} day{profile.daily.streak === 1 ? '' : 's'} (best {profile.daily.bestStreak}) · Today's best: {best ? `${best.stars} star${best.stars === 1 ? '' : 's'}` : '—'} after {best?.attempts ?? 1} attempt{(best?.attempts ?? 1) === 1 ? '' : 's'}. A new challenge unlocks tomorrow.
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <Star key={i} size={40} className={i <= stars ? 'fill-amber-400 text-amber-400' : 'text-white/20'} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => loadDaily(createDailyChallenge(daily.date))}>
          Try again
        </Button>
        <Button variant="secondary" onClick={quit}>
          Back to title
        </Button>
      </div>
    </motion.div>
  );
}

/** After a head-to-head race: where the tie or the league phase stands now. */
function TieStatus({ game, event }: { game: GameState; event: CalendarEvent }) {
  const europe = game.europe!;
  const fx = event.euro?.fixtureId ? europe.fixtures[event.euro.fixtureId] : null;
  if (!fx?.result) return null;
  const pc = game.teams[game.player.teamId].clubId!;
  const mine = fx.home === pc ? fx.result.home : fx.result.away;
  const theirs = fx.home === pc ? fx.result.away : fx.result.home;
  const tie = fx.tieId ? europe.ties[fx.tieId] : null;
  let text = mine > theirs ? 'Race won on race points.' : mine === theirs ? 'Level on race points.' : 'Race lost on race points.';
  if (tie) {
    const side = tie.home === pc ? 0 : 1;
    if (tie.winner) {
      const how = tie.shootout ? ' after a qualifying shoot-out' : tie.decider ? ' after an extra race' : tie.fixtures.length > 1 ? ` on aggregate (${tie.aggregate[side]}–${tie.aggregate[1 - side]})` : '';
      text = tie.winner === pc ? `Through! ${stageLabel(tie.stage)} won${how}.` : `Knocked out in the ${stageLabel(tie.stage).toLowerCase()}${how}.`;
      if (tie.stage === 'final' && tie.winner === pc) text = `Champions! ${europe.clubs[pc].name} win the final${how}.`;
    } else if (tie.decider && !europe.fixtures[tie.decider].result) text = `Level on aggregate at ${tie.aggregate[side]}–${tie.aggregate[1 - side]}: an extra race decides the tie, straight after this one.`;
    else if (fx.kind === 'leg1') text = `${text} The second leg follows in week ${europe.fixtures[tie.fixtures[1]].week}.`;
  }
  const won = tie?.winner === pc || (!tie && mine > theirs);
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${won ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : tie?.winner && tie.winner !== pc ? 'border-red-500/40 bg-red-500/[0.07]' : 'border-apex-line bg-apex-panel'}`}>
      <span className="font-semibold text-white">{text}</span>
    </div>
  );
}
