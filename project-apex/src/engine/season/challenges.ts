import { applyDevelopmentBoost } from '../car/car';
import { divisionStandings } from '../championship/standings';
import { DIVISIONS } from '../config/divisions';
import { postTransaction } from '../finance/ledger';
import { projectedPosition } from '../finance/sponsors';
import { formatMoneyPlain } from '../market/negotiation';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import { playerTeam, teamsInDivision } from '../selectors';
import type { ChallengeKind, GameState, RaceResult, RaceResultEntry, SeasonChallenge, Team } from '../types';
import { clamp, roundMoney } from '../util';

/**
 * Season challenges: three optional goals drawn fresh every season, pitched at
 * the team's level, each with a reward (cash, reputation and a car development
 * boost). One is always to beat this season's rival team.
 */

type Tier = 'easy' | 'medium' | 'hard';

interface ChallengeSpec {
  kind: ChallengeKind;
  tier: Tier;
  target: number;
  title: string;
  description: string;
}

const REWARD: Record<Tier, { cash: number; reputation: number; devBoost: number }> = {
  easy: { cash: 0.04, reputation: 1, devBoost: 0.5 },
  medium: { cash: 0.06, reputation: 2, devBoost: 1 },
  hard: { cash: 0.09, reputation: 3, devBoost: 1.5 },
};

function poolFor(projected: number): ChallengeSpec[] {
  if (projected <= 3) {
    return [
      { kind: 'win', tier: 'medium', target: 1, title: 'Race winner', description: 'Win a race.' },
      { kind: 'frontRow', tier: 'medium', target: 1, title: 'Front row', description: 'Qualify on the front row.' },
      { kind: 'doublePoints', tier: 'easy', target: 1, title: 'Double score', description: 'Both cars finish in the points in the same race.' },
      { kind: 'fastestLap', tier: 'easy', target: 1, title: 'Fastest of all', description: 'Set the fastest lap of a race.' },
      { kind: 'charge', tier: 'hard', target: 8, title: 'Charge through the field', description: 'Gain 8 or more places in a race.' },
      { kind: 'pointsStreak', tier: 'hard', target: 5, title: 'Consistency is king', description: 'Score points in 5 races in a row.' },
    ];
  }
  if (projected <= 6) {
    return [
      { kind: 'podium', tier: 'medium', target: 1, title: 'Podium finish', description: 'Finish a race in the top three.' },
      { kind: 'pointsStreak', tier: 'medium', target: 3, title: 'On a roll', description: 'Score points in 3 races in a row.' },
      { kind: 'doublePoints', tier: 'medium', target: 1, title: 'Double score', description: 'Both cars finish in the points in the same race.' },
      { kind: 'wetPoints', tier: 'medium', target: 1, title: 'Rain master', description: 'Score points in a wet race.' },
      { kind: 'charge', tier: 'medium', target: 6, title: 'Overtaking spree', description: 'Gain 6 or more places in a race.' },
      { kind: 'win', tier: 'hard', target: 1, title: 'Giant killer', description: 'Win a race.' },
    ];
  }
  return [
    { kind: 'points', tier: 'easy', target: 1, title: 'Off the mark', description: 'Score points in a race.' },
    { kind: 'pointsStreak', tier: 'medium', target: 2, title: 'Back to back', description: 'Score points in 2 races in a row.' },
    { kind: 'reliable', tier: 'easy', target: 3, title: 'Bulletproof', description: 'Both cars finish 3 races in a row.' },
    { kind: 'charge', tier: 'medium', target: 5, title: 'Fight back', description: 'Gain 5 or more places in a race.' },
    { kind: 'wetPoints', tier: 'medium', target: 1, title: 'Rain master', description: 'Score points in a wet race.' },
    { kind: 'podium', tier: 'hard', target: 1, title: 'Shock podium', description: 'Finish a race in the top three.' },
  ];
}

/** The team just above the player on paper (or just below if the player is favourite). */
export function pickRival(state: GameState, team: Team): Team | null {
  const field = teamsInDivision(state, team.division);
  const ranked = [...field].sort((a, b) => projectedPosition(state, a) - projectedPosition(state, b));
  const idx = ranked.findIndex((t) => t.id === team.id);
  return ranked[idx - 1] ?? ranked[idx + 1] ?? null;
}

/** Draw this season's challenges and rival (idempotent per season). */
export function ensureSeasonChallenges(state: GameState): void {
  const team = playerTeam(state);
  if (state.player.challenges?.some((c) => c.season === state.season)) return;
  const rng = Rng.from(state.seed, 'challenges', state.season, team.id);
  const projected = projectedPosition(state, team);
  const B = DIVISIONS[team.division].typicalBudget;
  const reward = (tier: Tier) => ({ cash: roundMoney(B * REWARD[tier].cash), reputation: REWARD[tier].reputation, devBoost: REWARD[tier].devBoost });
  const picks = rng.shuffle(poolFor(projected)).slice(0, 2);
  const challenges: SeasonChallenge[] = picks.map((p, i) => ({
    id: `ch-${state.season}-${i}`,
    season: state.season,
    kind: p.kind,
    title: p.title,
    description: p.description,
    target: p.target,
    progress: 0,
    completed: false,
    failed: false,
    reward: reward(p.tier),
  }));
  const rival = pickRival(state, team);
  state.player.rival = rival ? { teamId: rival.id, season: state.season, ahead: 0, behind: 0 } : null;
  if (rival) {
    challenges.push({
      id: `ch-${state.season}-rival`,
      season: state.season,
      kind: 'beatRival',
      title: `Beat ${rival.name}`,
      description: `Finish ahead of this season's rival, ${rival.name}, in the teams' championship.`,
      target: 1,
      progress: 0,
      completed: false,
      failed: false,
      reward: reward('hard'),
    });
    addNews(state, { category: 'championship', headline: `RIVALRY: ${team.name.toUpperCase()} VS ${rival.name.toUpperCase()}`, body: `The paddock has picked its grudge match of the season: ${team.name} against ${rival.name}. Beat them in the championship for a big reward.`, teamIds: [team.id, rival.id], importance: 2 });
  }
  state.player.challenges = challenges;
}

function complete(state: GameState, team: Team, c: SeasonChallenge): void {
  c.completed = true;
  c.progress = Math.max(c.progress, c.target);
  if (c.reward.cash > 0) postTransaction(state, team, 'prize', c.reward.cash, `Challenge: ${c.title}`);
  team.reputation = clamp(team.reputation + c.reward.reputation, 1, 99);
  if (c.reward.devBoost > 0) applyDevelopmentBoost(team.car, c.reward.devBoost);
  addNews(state, {
    category: 'milestone',
    headline: `CHALLENGE COMPLETE: ${c.title.toUpperCase()}`,
    body: `${c.description} Reward: ${formatMoneyPlain(c.reward.cash)}, +${c.reward.reputation} reputation${c.reward.devBoost > 0 ? ` and +${c.reward.devBoost.toFixed(1)} to every area of the car` : ''}.`,
    teamIds: [team.id],
    importance: 3,
  });
}

/** Update challenge progress and the rivalry after a race in the player's series. */
export function updateChallenges(state: GameState, result: RaceResult): void {
  if (state.mode === 'daily') return;
  const team = playerTeam(state);
  if (result.division !== team.division) return;
  ensureSeasonChallenges(state);
  const mine = result.entries.filter((e) => e.teamId === team.id);
  if (!mine.length) return;
  const finished = (e: RaceResultEntry) => e.status === 'finished';
  const scored = mine.some((e) => e.points > 0);
  for (const c of state.player.challenges ?? []) {
    if (c.season !== state.season || c.completed || c.failed) continue;
    switch (c.kind) {
      case 'win':
        if (mine.some((e) => finished(e) && e.position === 1)) complete(state, team, c);
        break;
      case 'podium':
        if (mine.some((e) => finished(e) && e.position <= 3)) complete(state, team, c);
        break;
      case 'points':
        if (scored) complete(state, team, c);
        break;
      case 'pointsStreak':
        c.progress = scored ? c.progress + 1 : 0;
        if (c.progress >= c.target) complete(state, team, c);
        break;
      case 'doublePoints':
        if (mine.length >= 2 && mine.every((e) => e.points > 0)) complete(state, team, c);
        break;
      case 'wetPoints':
        if (result.wet && scored) complete(state, team, c);
        break;
      case 'charge': {
        const best = Math.max(0, ...mine.filter(finished).map((e) => e.grid - e.position));
        c.progress = Math.max(c.progress, best);
        if (best >= c.target) complete(state, team, c);
        break;
      }
      case 'frontRow':
        if (mine.some((e) => e.grid > 0 && e.grid <= 2)) complete(state, team, c);
        break;
      case 'reliable':
        c.progress = mine.length >= 2 && mine.every(finished) ? c.progress + 1 : 0;
        if (c.progress >= c.target) complete(state, team, c);
        break;
      case 'fastestLap':
        if (mine.some((e) => e.fastestLap)) complete(state, team, c);
        break;
      case 'beatRival':
        break;
    }
  }
  const rival = state.player.rival;
  if (rival && rival.season === state.season) {
    const best = (teamId: string) => Math.min(99, ...result.entries.filter((e) => e.teamId === teamId).map((e) => (finished(e) ? e.position : 50 + e.position)));
    const mineBest = best(team.id);
    const theirs = best(rival.teamId);
    if (mineBest < theirs) rival.ahead += 1;
    else if (theirs < mineBest) rival.behind += 1;
  }
}

/** Season end: settle the rivalry, close the rest. Returns how many challenges were completed. */
export function settleSeasonChallenges(state: GameState): number {
  const team = playerTeam(state);
  const list = (state.player.challenges ?? []).filter((c) => c.season === state.season);
  const standings = divisionStandings(state, team.division).constructors;
  const pos = (id: string) => standings.findIndex((r) => r.id === id) + 1;
  for (const c of list) {
    if (c.completed || c.failed) continue;
    if (c.kind === 'beatRival' && state.player.rival && pos(team.id) > 0 && pos(team.id) < pos(state.player.rival.teamId)) complete(state, team, c);
    else c.failed = true;
  }
  return list.filter((c) => c.completed).length;
}
