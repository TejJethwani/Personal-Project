/**
 * Public game API. The UI calls these functions; every one validates its
 * inputs and mutates the GameState in place.
 */
import { setSeasonObjectives } from './board';
import { refreshSponsorOffers } from './finance/sponsors';
import { addNews } from './news/news';
import { advanceToNextEvent, advanceWeek, finishWeekendAndContinue, holidayToSeasonEnd } from './season/advance';
import { beginOffseason } from './season/seasonEnd';
import { playerTeam } from './selectors';
import { DIVISIONS } from './config/divisions';
import { advanceRace, autoPractice, finishPractice, runNextQualifyingSession, startRace } from './race/weekend';
import type { GameState, NewCareerConfig } from './types';
import { createWorld } from './world/generate';
import { createEuroWorld } from './europe/world';
import { ASSOCIATION_BY_ID } from './europe/data';
import { ensureSeasonChallenges } from './season/challenges';

export function createNewGame(config: NewCareerConfig): GameState {
  const state = config.european ? createEuroWorld(config) : createWorld(config);
  const team = playerTeam(state);
  setSeasonObjectives(state);
  ensureSeasonChallenges(state);
  refreshSponsorOffers(state, true);
  if (state.europe) {
    const assoc = ASSOCIATION_BY_ID[state.europe.playerAssocId];
    addNews(state, {
      category: 'board',
      headline: `${team.name.toUpperCase()} JOIN THE ${DIVISIONS[team.division].name.toUpperCase()}`,
      body: `A new club enters ${assoc.name}'s league pyramid. Team Principal ${team.principal} starts in the ${DIVISIONS[team.division].name} with a modest budget, two drivers and a basic car. The road leads up through the divisions, into the ${assoc.cupName}, and one day to the Apex Champions League.`,
      teamIds: [team.id],
      importance: 3,
    });
    return state;
  }
  addNews(state, {
    category: 'board',
    headline: `${team.name.toUpperCase()} ENTERS ${DIVISIONS.F5.name.toUpperCase()}`,
    body: `A new name joins the grid. Team Principal ${team.principal} has a modest budget, two drivers and a basic car. The target: start the long road from Formula 5 to Formula 1.`,
    teamIds: [team.id],
    importance: 3,
  });
  return state;
}

/** The assistant runs the player's race weekend (holiday mode / tests). */
export function autoplayPlayerWeekend(state: GameState): void {
  const weekend = state.weekend;
  if (!weekend) return;
  if (weekend.phase === 'practice') {
    for (const id of Object.keys(weekend.practice.setups)) autoPractice(state, id);
    finishPractice(state);
  }
  let guard = 0;
  while (state.weekend?.phase === 'qualifying' && guard++ < 5) runNextQualifyingSession(state);
  if (state.weekend?.phase === 'raceSetup') startRace(state);
  if (state.weekend?.phase === 'race') advanceRace(state, 'finish');
}

export function simulateSeasonForPlayer(state: GameState): void {
  holidayToSeasonEnd(state, autoplayPlayerWeekend);
}

export { advanceWeek, advanceToNextEvent, finishWeekendAndContinue, beginOffseason };
