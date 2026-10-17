import { DIVISIONS } from './config/divisions';
import { addNews } from './news/news';
import { twistEffects } from './season/twists';
import { playerTeam } from './selectors';
import { fullStaff } from './staff/staff';
import type { GameState, RaceResult, RaceResultEntry, Team } from './types';

/**
 * Career achievements: long-term goals that unlock as the player makes
 * history. Checks are idempotent and cheap, so they run after every race,
 * every week and at season end.
 */
export type AchievementTier = 'bronze' | 'silver' | 'gold';

interface CheckContext {
  state: GameState;
  team: Team;
  result: RaceResult | null;
  mine: RaceResultEntry[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  /** Only in this career mode (absent = both). */
  mode?: 'classic' | 'european';
  check: (c: CheckContext) => boolean;
}

const finished = (e: RaceResultEntry) => e.status === 'finished';

/** Share of this season's races in the team's series that it won. */
function seasonWinShare(state: GameState, team: Team): number {
  const events = state.calendars[team.division].filter((e) => e.completed);
  if (!events.length) return 0;
  const wins = events.filter((e) => state.results[e.id]?.entries.some((x) => x.teamId === team.id && x.position === 1 && finished(x))).length;
  return wins / events.length;
}
const won = (c: CheckContext) => c.mine.some((e) => finished(e) && e.position === 1);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstPoints', title: 'Off the Mark', description: 'Score your first championship points.', tier: 'bronze', check: (c) => c.team.stats.points > 0 },
  { id: 'firstPodium', title: 'Champagne Moment', description: 'Finish on the podium.', tier: 'bronze', check: (c) => c.team.stats.podiums > 0 },
  { id: 'firstPole', title: 'Pole Sitter', description: 'Take pole position.', tier: 'bronze', check: (c) => c.team.stats.poles > 0 },
  { id: 'firstWin', title: 'Winner', description: 'Win a race.', tier: 'silver', check: (c) => c.team.stats.wins > 0 },
  { id: 'doublePodium', title: 'Double Podium', description: 'Both cars on the podium in the same race.', tier: 'silver', check: (c) => c.mine.length >= 2 && c.mine.every((e) => finished(e) && e.position <= 3) },
  { id: 'oneTwo', title: 'One-Two', description: 'Finish first and second in the same race.', tier: 'gold', check: (c) => c.mine.length >= 2 && c.mine.every((e) => finished(e) && e.position <= 2) },
  { id: 'wetWin', title: 'Singing in the Rain', description: 'Win a wet race.', tier: 'silver', check: (c) => !!c.result?.wet && won(c) },
  { id: 'fromTheBack', title: 'From the Back', description: 'Win a race from 8th or lower on the grid.', tier: 'gold', check: (c) => c.mine.some((e) => finished(e) && e.position === 1 && e.grid >= 8) },
  { id: 'comeback', title: 'Comeback Kid', description: 'Reach the podium from 12th or lower on the grid.', tier: 'silver', check: (c) => c.mine.some((e) => finished(e) && e.position <= 3 && e.grid >= 12) },
  { id: 'hatTrick', title: 'Hat-Trick', description: 'Pole, win and fastest lap with the same driver.', tier: 'gold', check: (c) => c.mine.some((e) => finished(e) && e.position === 1 && e.fastestLap && c.result?.poleDriverId === e.driverId) },
  { id: 'survivor', title: 'Survivor', description: 'Score points in a race with five or more retirements.', tier: 'bronze', check: (c) => !!c.result && c.result.entries.filter((e) => !finished(e)).length >= 5 && c.mine.some((e) => e.points > 0) },
  { id: 'finaleHero', title: 'Finale Hero', description: 'Win a double-points finale.', tier: 'silver', check: (c) => !!c.result && twistEffects(c.state, c.result.division).doublePointsRound === c.result.round && won(c) },
  { id: 'reverseGridWin', title: 'Upside Down', description: 'Win a reverse-grid round.', tier: 'silver', check: (c) => !!c.result && twistEffects(c.state, c.result.division).reverseGridRound === c.result.round && won(c) },
  { id: 'f1Win', mode: 'classic', title: 'Grand Prix Winner', description: 'Win a Formula 1 race.', tier: 'gold', check: (c) => c.result?.division === 'F1' && won(c) },
  { id: 'tenWins', title: 'Serial Winner', description: 'Win 10 races.', tier: 'silver', check: (c) => c.team.stats.wins >= 10 },
  { id: 'fiftyWins', title: 'Legend', description: 'Win 50 races.', tier: 'gold', check: (c) => c.team.stats.wins >= 50 },
  { id: 'fiftyRaces', title: 'Seasoned', description: 'Start 50 races.', tier: 'bronze', check: (c) => c.team.stats.races >= 50 },
  { id: 'centurion', title: 'Centurion', description: 'Start 100 races.', tier: 'silver', check: (c) => c.team.stats.races >= 100 },
  { id: 'promoted', title: 'Moving Up', description: 'Win promotion.', tier: 'bronze', check: (c) => c.team.stats.promotions >= 1 },
  { id: 'reachF3', mode: 'classic', title: 'Formula 3', description: 'Reach Formula 3.', tier: 'bronze', check: (c) => DIVISIONS[c.team.division].tier >= 2 },
  { id: 'reachF2', mode: 'classic', title: 'Formula 2', description: 'Reach Formula 2.', tier: 'silver', check: (c) => DIVISIONS[c.team.division].tier >= 3 },
  { id: 'reachF1', mode: 'classic', title: 'The Big Time', description: 'Reach Formula 1.', tier: 'gold', check: (c) => c.team.division === 'F1' },
  { id: 'champion', title: 'Champions', description: 'Win a teams\' championship.', tier: 'silver', check: (c) => c.team.stats.constructorTitles >= 1 },
  { id: 'dynasty', title: 'Dynasty', description: 'Win three teams\' championships.', tier: 'gold', check: (c) => c.team.stats.constructorTitles >= 3 },
  { id: 'f1Champion', mode: 'classic', title: 'World Champions', description: 'Win the Formula 1 teams\' championship.', tier: 'gold', check: (c) => (c.team.stats.constructorTitlesByDivision.F1 ?? 0) >= 1 },
  { id: 'dominant', title: 'Dominant', description: 'Win at least half the races of a season.', tier: 'gold', check: (c) => c.state.phase === 'seasonReview' && seasonWinShare(c.state, c.team) >= 0.5 },
  { id: 'challengeMaster', title: 'Challenge Master', description: 'Complete all of a season\'s challenges.', tier: 'gold', check: (c) => !!c.state.lastSeasonReview?.challenges && c.state.lastSeasonReview.challenges.total >= 3 && c.state.lastSeasonReview.challenges.completed >= c.state.lastSeasonReview.challenges.total },
  { id: 'rivalSlayer', title: 'Rival Slayer', description: 'Beat your season rival in the championship.', tier: 'silver', check: (c) => (c.state.player.challenges ?? []).some((ch) => ch.kind === 'beatRival' && ch.completed) },
  { id: 'breakthrough', title: 'Eureka', description: 'Score an R&D breakthrough.', tier: 'bronze', check: (c) => c.team.rndHistory.some((r) => r.outcome === 'breakthrough') },
  { id: 'fullHouse', title: 'Full House', description: 'Fill all seven senior staff roles.', tier: 'bronze', check: (c) => fullStaff(c.team) },
  { id: 'millionaire', title: 'Deep Pockets', description: 'Have $10M in the bank.', tier: 'silver', check: (c) => c.team.cash >= 10_000_000 },
  // European League careers.
  { id: 'euroTopFlight', mode: 'european', title: 'Top Flight', description: "Reach your association's top division.", tier: 'silver', check: (c) => c.team.division === 'F1' },
  { id: 'euroLeagueTitle', mode: 'european', title: 'National Champions', description: 'Win the top-flight league.', tier: 'gold', check: (c) => (c.team.stats.constructorTitlesByDivision.F1 ?? 0) >= 1 },
  { id: 'euroCup', mode: 'european', title: 'Cup Winners', description: 'Win the domestic cup.', tier: 'silver', check: (c) => (honours(c).cup ?? 0) >= 1 },
  { id: 'euroLeagueCup', mode: 'european', title: 'League Cup Glory', description: 'Win the league cup.', tier: 'bronze', check: (c) => (honours(c).leagueCup ?? 0) >= 1 },
  { id: 'euroDouble', mode: 'european', title: 'The Double', description: 'Win the league and the domestic cup in the same season.', tier: 'gold', check: (c) => (c.state.europe?.history ?? []).some((h) => { const d = h.domestic[c.state.europe!.playerAssocId]; return !!d && d.champion === c.team.clubId && d.cup === c.team.clubId; }) },
  { id: 'euroNights', mode: 'european', title: 'European Nights', description: 'Race in a continental competition.', tier: 'bronze', check: (c) => Object.values(c.state.europe?.fixtures ?? {}).some((f) => (f.competition === 'CL' || f.competition === 'EL' || f.competition === 'ECL') && !!f.result && (f.home === c.team.clubId || f.away === c.team.clubId)) },
  { id: 'euroLast16', mode: 'european', title: 'Last Sixteen', description: 'Reach a continental Round of 16.', tier: 'silver', check: (c) => Object.values(c.state.europe?.ties ?? {}).some((t) => t.stage === 'r16' && (t.home === c.team.clubId || t.away === c.team.clubId)) },
  { id: 'euroSilverware', mode: 'european', title: 'Silverware Abroad', description: 'Win the Europa or Conference League.', tier: 'gold', check: (c) => (honours(c).EL ?? 0) + (honours(c).ECL ?? 0) >= 1 },
  { id: 'euroKings', mode: 'european', title: 'Kings of Europe', description: 'Win the Apex Champions League.', tier: 'gold', check: (c) => (honours(c).CL ?? 0) >= 1 },
  { id: 'euroTreble', mode: 'european', title: 'The Treble', description: 'League, domestic cup and Champions League in one season.', tier: 'gold', check: (c) => (c.state.europe?.history ?? []).some((h) => { const d = h.domestic[c.state.europe!.playerAssocId]; return !!d && d.champion === c.team.clubId && d.cup === c.team.clubId && h.winners.CL?.winner === c.team.clubId; }) },
];

function honours(c: CheckContext): Partial<Record<string, number>> {
  return (c.team.clubId && c.state.europe?.clubs[c.team.clubId]?.honours) || {};
}

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Unlock any achievements now earned. Returns the newly unlocked ids. */
export function checkAchievements(state: GameState, result: RaceResult | null = null): string[] {
  // Daily challenges and sandbox careers (unlimited money) do not unlock achievements.
  if (state.mode === 'daily' || state.settings.sandboxUsed) return [];
  const team = playerTeam(state);
  if (!team) return [];
  const unlocked = (state.player.achievements ??= {});
  const mine = result && result.division === team.division ? result.entries.filter((e) => e.teamId === team.id) : [];
  const ctx: CheckContext = { state, team, result: mine.length ? result : null, mine };
  const fresh: string[] = [];
  const mode = state.mode === 'european' ? 'european' : 'classic';
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    if (a.mode && a.mode !== mode) continue;
    if (!a.check(ctx)) continue;
    unlocked[a.id] = { season: state.season, week: state.week };
    fresh.push(a.id);
    addNews(state, { category: 'milestone', headline: `ACHIEVEMENT UNLOCKED: ${a.title.toUpperCase()}`, body: `${a.description} (${a.tier})`, teamIds: [team.id], importance: 3 });
  }
  return fresh;
}
