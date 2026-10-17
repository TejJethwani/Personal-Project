import { DIVISIONS } from './config/divisions';
import { teamStrength } from './finance/sponsors';
import { createNewGame } from './game';
import { startPlayerWeekend } from './race/weekend';
import { Rng } from './rng';
import { playerTeam, raceDrivers, teamsInDivision } from './selectors';
import type { DivisionId, GameState } from './types';

/**
 * Daily challenge: one race weekend a day, the same for everyone on that
 * date. A world is generated from the date, the player takes over a midfield
 * team in a random series at a random circuit, and must beat the team's
 * expected result. It is a throwaway world (mode 'daily'), never a career.
 */

/** Local calendar date as YYYY-MM-DD. */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(key: string): number {
  let h = 2166136261;
  for (const ch of `apex-daily-${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stars for a result: 1 for meeting the goal, 2 for beating it, 3 for a win or beating it by three places. */
export function dailyStars(bestFinish: number | null, goal: number): number {
  if (bestFinish === null || bestFinish > goal) return 0;
  if (bestFinish === 1 || bestFinish <= goal - 3) return 3;
  if (bestFinish < goal) return 2;
  return 1;
}

export function createDailyChallenge(key: string): GameState {
  const seed = dailySeed(key);
  const state = createNewGame({
    teamName: 'Daily Challenge',
    shortName: 'DLY',
    nationality: 'GBR',
    primaryColor: '#e10600',
    secondaryColor: '#ffffff',
    livery: 'arrow',
    principalName: 'You',
    philosophy: 'balanced',
    difficulty: 'standard',
    financialStart: 'modest',
    seed,
  });
  const rng = Rng.from(seed, 'daily');
  const division = rng.weighted<DivisionId>([
    { item: 'F3', weight: 3 },
    { item: 'F2', weight: 3 },
    { item: 'F1', weight: 4 },
  ]);
  const ranked = [...teamsInDivision(state, division)].sort((a, b) => teamStrength(state, b) - teamStrength(state, a));
  const rank = rng.int(4, 8);
  const target = ranked[rank - 1];
  const event = rng.pick(state.calendars[division]);

  // Hand the chosen team to the player for the day.
  const own = playerTeam(state);
  own.isPlayer = false;
  own.aiPersonality = 'conservative';
  target.isPlayer = true;
  target.aiPersonality = null;
  state.player.teamId = target.id;
  for (const d of raceDrivers(state, target)) state.player.scouting[d.id] = 100;

  state.phase = 'season';
  state.week = event.week;
  state.mode = 'daily';
  const circuit = state.circuits[event.circuitId];
  const goal = Math.max(1, rank - 1);
  state.daily = {
    date: key,
    eventId: event.id,
    division,
    goalPosition: goal,
    title: `${target.name} at ${circuit.name}`,
    description: `You run ${target.name}, rated ${rank}th of ${ranked.length} in ${DIVISIONS[division].name}. Goal: get a car home in P${goal} or better.`,
    bestFinish: null,
  };
  startPlayerWeekend(state, event.id);
  return state;
}
