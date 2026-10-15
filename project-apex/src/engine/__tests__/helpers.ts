import { assistantManage } from '../ai/assistant';
import { autoplayPlayerWeekend, createNewGame } from '../game';
import { advanceWeek, finishWeekendAndContinue } from '../season/advance';
import { beginOffseason } from '../season/seasonEnd';
import type { Difficulty, GameState, NewCareerConfig } from '../types';
import { validateState } from '../validation';

export function makeGame(seed = 1234, overrides: Partial<NewCareerConfig> = {}): GameState {
  return createNewGame({
    teamName: 'Project Apex',
    shortName: 'APX',
    nationality: 'GBR',
    primaryColor: '#e10600',
    secondaryColor: '#ffffff',
    livery: 'arrow',
    principalName: 'Test Principal',
    philosophy: 'balanced',
    difficulty: 'standard' as Difficulty,
    financialStart: 'modest',
    seed,
    ...overrides,
  });
}

/** Run the current season to the season review with the assistant managing the player. */
export function playSeason(state: GameState, opts: { validate?: boolean; manage?: boolean; onWeek?: (s: GameState) => void } = {}): void {
  let guard = 0;
  while (state.phase !== 'seasonReview' && state.phase !== 'gameOver' && guard++ < 400) {
    if (opts.manage !== false) assistantManage(state);
    if (state.phase === 'weekend') {
      autoplayPlayerWeekend(state);
      finishWeekendAndContinue(state);
    } else advanceWeek(state);
    opts.onWeek?.(state);
    if (opts.validate) {
      const problems = validateState(state);
      if (problems.length) throw new Error(`Invalid state S${state.season} W${state.week}: ${problems.slice(0, 3).join(' | ')}`);
    }
  }
  if (guard >= 400) throw new Error('Season did not finish');
}

/** From season review through the off-season to the start of the next season (pre-season). */
export function playOffseason(state: GameState, acceptPromotion = true, opts: { validate?: boolean } = {}): void {
  beginOffseason(state, acceptPromotion);
  let guard = 0;
  while (state.phase === 'offseason' && guard++ < 20) {
    assistantManage(state);
    advanceWeek(state);
    if (opts.validate) {
      const problems = validateState(state);
      if (problems.length) throw new Error(`Invalid off-season state: ${problems.slice(0, 3).join(' | ')}`);
    }
  }
  assistantManage(state);
}
