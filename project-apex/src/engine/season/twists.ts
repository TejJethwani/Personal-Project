import { DIVISIONS } from '../config/divisions';
import { Rng } from '../rng';
import type { DivisionId, GameState } from '../types';

/**
 * Season twists: every season each series draws rule changes that alter how
 * it races, so no two seasons play the same. They are a pure function of the
 * world seed, season and series (no save data), and apply to every team alike.
 */
export type SeasonTwistId =
  | 'wetSeason'
  | 'tyreWar'
  | 'reliabilityCrisis'
  | 'overtakingRules'
  | 'doublePointsFinale'
  | 'reverseGridRound'
  | 'developmentRace'
  | 'tvDeal'
  | 'heatwave';

export interface SeasonTwistInfo {
  name: string;
  summary: string;
}

export const SEASON_TWISTS: Record<SeasonTwistId, SeasonTwistInfo> = {
  wetSeason: { name: 'Monsoon Season', summary: 'Rain is far more likely at every round. Wet-weather specialists and brave tyre calls shine.' },
  tyreWar: { name: 'Tyre War', summary: 'A new tyre supplier: wear is 30% higher, so tyre management and pit strategy matter more.' },
  reliabilityCrisis: { name: 'New Power Units', summary: 'Unproven engines: mechanical failures are 60% more likely. Reliability upgrades and careful driving pay off.' },
  overtakingRules: { name: 'Overtaking Package', summary: 'New aero rules let cars follow closely: overtaking is much easier and races are more chaotic.' },
  doublePointsFinale: { name: 'Double-Points Finale', summary: 'The last round pays double points. Nothing is settled until the final flag.' },
  reverseGridRound: { name: 'Reverse-Grid Round', summary: 'One mid-season round reverses the top ten of qualifying. The fast cars must fight through the pack.' },
  developmentRace: { name: 'Development Race', summary: 'Relaxed testing limits: R&D upgrades deliver 25% more and cost 15% less.' },
  tvDeal: { name: 'Bumper TV Deal', summary: 'A new broadcast contract: race prize money is 50% higher and season prize money 25% higher.' },
  heatwave: { name: 'Heatwave Summer', summary: 'Track temperatures are up 8°C: tyres wear faster and cooling failures are more common.' },
};

export const SEASON_TWIST_IDS = Object.keys(SEASON_TWISTS) as SeasonTwistId[];

export interface TwistEffects {
  /** Multiplier on rain chance. */
  rain: number;
  /** Added to track temperature (°C). */
  tempOffset: number;
  /** Multiplier on tyre wear. */
  wear: number;
  /** Multiplier on mechanical failure probability. */
  failure: number;
  /** Added to the overtaking logit. */
  overtake: number;
  rndGain: number;
  rndCost: number;
  racePrize: number;
  seasonPrize: number;
  /** Round that pays double points, if any. */
  doublePointsRound: number | null;
  /** Round with a reversed top-ten grid, if any. */
  reverseGridRound: number | null;
}

const cache = new Map<string, SeasonTwistId[]>();

/** The twists a series races under in a season (one in a career's first season, two after). */
export function seasonTwists(state: Pick<GameState, 'seed' | 'season'>, division: DivisionId, season = state.season): SeasonTwistId[] {
  const key = `${state.seed}:${season}:${division}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = Rng.from(state.seed, 'twists', season, division);
  const picked = rng.shuffle([...SEASON_TWIST_IDS]).slice(0, season <= 1 ? 1 : 2);
  cache.set(key, picked);
  return picked;
}

export function twistEffects(state: Pick<GameState, 'seed' | 'season'>, division: DivisionId, season = state.season): TwistEffects {
  const twists = seasonTwists(state, division, season);
  const has = (t: SeasonTwistId) => twists.includes(t);
  const races = DIVISIONS[division].races;
  return {
    rain: has('wetSeason') ? 1.9 : 1,
    tempOffset: has('heatwave') ? 8 : 0,
    wear: (has('tyreWar') ? 1.3 : 1) * (has('heatwave') ? 1.08 : 1),
    failure: (has('reliabilityCrisis') ? 1.6 : 1) * (has('heatwave') ? 1.15 : 1),
    overtake: has('overtakingRules') ? 0.7 : 0,
    rndGain: has('developmentRace') ? 1.25 : 1,
    rndCost: has('developmentRace') ? 0.85 : 1,
    racePrize: has('tvDeal') ? 1.5 : 1,
    seasonPrize: has('tvDeal') ? 1.25 : 1,
    doublePointsRound: has('doublePointsFinale') ? races : null,
    reverseGridRound: has('reverseGridRound') ? Math.max(2, Math.round(races / 2)) : null,
  };
}

/** Weather modifiers for an event in a series this season. */
export function weatherMods(state: Pick<GameState, 'seed' | 'season'>, division: DivisionId): { rain: number; temp: number } {
  const fx = twistEffects(state, division);
  return { rain: fx.rain, temp: fx.tempOffset };
}
