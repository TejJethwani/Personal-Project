import { divisionStandings } from '../championship/standings';
import { activeDivisions, isEuropean, levelOfDivision } from '../config/ruleset';
import { playerTeam, teamsInDivision } from '../selectors';
import type { CalendarEvent, ContinentalCompetition, EuroCompetition, EuroSeasonHistory, GameState, RaceResult } from '../types';
import { associationRanking, updateCoefficients } from './coefficients';
import { allocateEuropeanPlaces, CONTINENTAL_ORDER, payParticipation, playerReached, progressContinental, startContinental } from './continental';
import { progressCups, startCups } from './cups';
import { clearGuests, competitionName, onPlayerFixtureRace, playBackgroundFixtures, playerClubId, stageLabel } from './fixtures';
import { liteSeasonEnd, liteTable, playLiteLeagueWeek } from './leagues';

/**
 * European League season orchestration: what happens at the start of the
 * season, every week, when the player's race finishes, and at the end.
 */

/** The player's next race of any competition, in running order within a week. */
export function nextPlayerEvent(state: GameState): CalendarEvent | undefined {
  const team = playerTeam(state);
  const league = state.calendars[team.division].filter((e) => !e.completed);
  if (!isEuropean(state) || !state.europe) return league[0];
  const euro = state.europe.events.filter((e) => !e.completed && e.teamIds?.includes(team.id));
  const order = (e: CalendarEvent) => (e.euro?.competition === 'league' || !e.euro ? 1 + (e.euro?.raceNo ?? 1) : state.europe!.events.indexOf(e) / 100000);
  return [...league, ...euro].sort((a, b) => a.week - b.week || order(a) - order(b))[0];
}

/** Every race the player's team has in the given week, in running order. */
export function playerEventsInWeek(state: GameState, week: number): CalendarEvent[] {
  const team = playerTeam(state);
  const all = [...state.calendars[team.division], ...(state.europe?.events ?? []).filter((e) => e.teamIds?.includes(team.id))];
  return all.filter((e) => e.week === week);
}

export function euroSeasonStart(state: GameState): void {
  const key = `euroStart:${state.season}`;
  if (state.processed[key]) return;
  state.processed[key] = true;
  startContinental(state);
  startCups(state);
}

/** Start of a week: draws and stage changes, before anything is raced. */
export function euroWeekStart(state: GameState): void {
  const europe = state.europe!;
  for (const id of CONTINENTAL_ORDER) {
    const comp = europe.continental[id];
    if (!comp) continue;
    // A stage can complete and the next be drawn in the same week.
    for (let i = 0; i < 3; i++) {
      const before = `${comp.stage}:${comp.fixtures.length}:${comp.qualifyingRounds.length}`;
      progressContinental(state, comp);
      if (`${comp.stage}:${comp.fixtures.length}:${comp.qualifyingRounds.length}` === before) break;
    }
  }
  payParticipation(state);
  progressCups(state);
}

/** The week's background racing: quick-model leagues and every fixture not involving the player. */
export function euroWeekRacing(state: GameState): void {
  playLiteLeagueWeek(state, state.week);
  playBackgroundFixtures(state, state.week);
  // Cups and competitions settled by these results draw their next round straight away when due.
  euroWeekStart(state);
}

/** The player's head-to-head race has been classified. */
export function onEuroRaceResult(state: GameState, event: CalendarEvent, result: RaceResult): void {
  if (!event.euro || event.euro.competition === 'league') return;
  onPlayerFixtureRace(state, event, result);
}

/** Every cup and continental race of the season has been run. */
export function euroCompetitionsDone(state: GameState): boolean {
  const europe = state.europe;
  if (!europe) return true;
  if (europe.events.some((e) => !e.completed)) return false;
  if (Object.values(europe.fixtures).some((f) => !f.result)) return false;
  if (Object.values(europe.cups).some((c) => !c.winner)) return false;
  return CONTINENTAL_ORDER.every((id) => !europe.continental[id] || europe.continental[id]!.stage === 'done');
}

export interface EuroReview {
  reached: { competition: EuroCompetition; name: string; reached: string }[];
  nextSeason: { competition: ContinentalCompetition; name: string; direct: boolean }[];
}

/** Season end: league outcomes become next season's European places; coefficients roll on. */
export function euroFinalize(state: GameState): EuroReview {
  const europe = state.europe!;
  const pa = europe.playerAssocId;
  const pc = playerClubId(state);
  const history: EuroSeasonHistory = { season: state.season, year: state.year, winners: {}, domestic: {}, player: [], ranking: [] };

  // Player's association: final league tables decide titles and places.
  for (const division of activeDivisions(state)) {
    const level = levelOfDivision(division);
    const order = divisionStandings(state, division).constructors.map((r) => state.teams[r.id]?.clubId).filter((x): x is string => !!x);
    const champ = order[0];
    if (champ) {
      const club = europe.clubs[champ];
      const honour = level === 1 ? 'league' : 'lowerLeague';
      club.honours[honour] = (club.honours[honour] ?? 0) + 1;
    }
    if (level === 1) europe.associations[pa].last.order = order;
  }
  for (const a of Object.values(europe.associations)) {
    if (a.id !== pa) {
      const top = europe.leagues[`${a.id}-1`];
      if (top) a.last.order = liteTable(top).map((r) => r.clubId);
    }
    a.last.cupWinner = europe.cups[`${a.id}-cup`]?.winner ?? null;
    a.last.leagueCupWinner = europe.cups[`${a.id}-leagueCup`]?.winner ?? null;
    history.domestic[a.id] = {
      champion: a.last.order[0] ?? null,
      cup: a.last.cupWinner,
      ...(a.id === pa ? { leagueCup: a.last.leagueCupWinner, superCup: europe.cups[`${a.id}-superCup`]?.winner ?? null } : {}),
    };
  }

  // Continental winners become next season's holders.
  for (const id of CONTINENTAL_ORDER) {
    const comp = europe.continental[id];
    if (!comp) continue;
    if (comp.winner) history.winners[id] = { winner: comp.winner, runnerUp: comp.runnerUp };
    europe.titleHolders[id] = comp.winner;
    const reached = playerReached(state, comp);
    if (reached) history.player.push({ competition: id, reached });
  }
  const esc = europe.cups.ESC;
  if (esc?.winner) history.winners.ESC = { winner: esc.winner, runnerUp: esc.runnerUp };
  if (pc) {
    for (const cup of Object.values(europe.cups)) {
      if (cup.assocId !== pa && cup.kind !== 'ESC') continue;
      if (!cup.entrants.includes(pc)) continue;
      const kind = cup.kind === 'ESC' ? 'ESC' : cup.kind;
      let lastStage: string | null = null;
      for (const round of cup.rounds) for (const id of round) if ([europe.ties[id].home, europe.ties[id].away].includes(pc)) lastStage = europe.ties[id].stage;
      const reached = cup.winner === pc ? 'Winners' : cup.runnerUp === pc ? 'Final' : lastStage ? stageLabel(lastStage) : 'Did not race';
      history.player.push({ competition: kind, reached });
    }
  }

  updateCoefficients(state);
  history.ranking = associationRanking(state);
  europe.history.push(history);

  const review: EuroReview = {
    reached: history.player.map((p) => ({ competition: p.competition, name: competitionName(state, p.competition), reached: p.reached })),
    nextSeason: [],
  };
  if (pc) {
    const alloc = allocateEuropeanPlaces(state);
    for (const id of CONTINENTAL_ORDER) {
      if (alloc[id].direct.includes(pc)) review.nextSeason.push({ competition: id, name: competitionName(state, id), direct: true });
      else if (alloc[id].pool.includes(pc)) review.nextSeason.push({ competition: id, name: competitionName(state, id), direct: false });
    }
  }
  return review;
}

/** Off-season: clubs change leagues, guests leave, competitions reset. Runs after the division moves. */
export function euroOffseason(state: GameState): void {
  const europe = state.europe!;
  liteSeasonEnd(state);
  const pa = europe.playerAssocId;
  for (const division of activeDivisions(state)) {
    const level = levelOfDivision(division);
    const league = europe.leagues[`${pa}-${level}`];
    league.clubIds = teamsInDivision(state, division).map((t) => t.clubId!).filter(Boolean);
    for (const id of league.clubIds) europe.clubs[id].level = level;
  }
  for (const team of Object.values(state.teams)) {
    if (team.clubId && !team.guest) {
      const club = europe.clubs[team.clubId];
      club.name = team.name;
      club.short = team.shortName;
      club.colors = { ...team.colors };
    }
  }
  clearGuests(state);
  europe.fixtures = {};
  europe.ties = {};
  europe.continental = {};
  europe.cups = {};
  europe.events = [];
  europe.carry = null;
}
