import type { CarDevelopmentRules } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import type { Rng } from '../rng';
import type { Car, Circuit, ComponentKey, DivisionId, PaceComponentKey, RegulationNotice } from '../types';
import { clamp } from '../util';

export const COMPONENT_KEYS: ComponentKey[] = [
  'aerodynamics',
  'chassis',
  'powerUnit',
  'braking',
  'suspension',
  'cooling',
  'reliability',
  'tireEfficiency',
  'straightLine',
  'cornering',
];

export const PACE_COMPONENTS: PaceComponentKey[] = ['aerodynamics', 'chassis', 'powerUnit', 'braking', 'suspension', 'straightLine', 'cornering'];

export const COMPONENT_INFO: Record<ComponentKey, { label: string; short: string; effect: string }> = {
  aerodynamics: { label: 'Aerodynamics', short: 'AERO', effect: 'Downforce in medium and high-speed corners.' },
  chassis: { label: 'Chassis', short: 'CHS', effect: 'Overall platform stiffness and balance at every track.' },
  powerUnit: { label: 'Power Unit', short: 'PU', effect: 'Acceleration and top speed; key at power tracks.' },
  braking: { label: 'Braking', short: 'BRK', effect: 'Stopping power and stability at heavy-braking tracks.' },
  suspension: { label: 'Suspension', short: 'SUS', effect: 'Mechanical grip over kerbs and bumps; slow corners.' },
  cooling: { label: 'Cooling', short: 'COOL', effect: 'Protects the car in hot conditions; reduces failures.' },
  reliability: { label: 'Reliability', short: 'REL', effect: 'Probability of mechanical failure.' },
  tireEfficiency: { label: 'Tyre Efficiency', short: 'TYRE', effect: 'How gently the car treats its tyres.' },
  straightLine: { label: 'Straight-Line Speed', short: 'SPD', effect: 'Drag efficiency; rewards low-downforce circuits.' },
  cornering: { label: 'Cornering Performance', short: 'CRN', effect: 'Grip through slow and medium corners.' },
};

/** Generic weights used for a "typical" circuit when showing overall car pace. */
export const TYPICAL_WEIGHTS: Record<PaceComponentKey, number> = {
  aerodynamics: 0.18,
  chassis: 0.15,
  powerUnit: 0.15,
  braking: 0.11,
  suspension: 0.12,
  straightLine: 0.14,
  cornering: 0.15,
};

export function emptyDevLevels(): Record<ComponentKey, number> {
  return Object.fromEntries(COMPONENT_KEYS.map((k) => [k, 0])) as Record<ComponentKey, number>;
}

export function generateCar(rng: Rng, baseRating: number, spread = 5): Car {
  const components = {} as Record<ComponentKey, number>;
  for (const key of COMPONENT_KEYS) {
    components[key] = Math.round(clamp(baseRating + rng.normal(0, spread), 15, 92) * 10) / 10;
  }
  return { components, developmentLevel: emptyDevLevels() };
}

/** Component rating a division's field is built around (50 unless the ruleset rates tiers on one scale). */
export function divisionCarBase(division: DivisionId): number {
  return DIVISIONS[division].carBase ?? 50;
}

/**
 * A rating as the races of `division` see it: its field average reads as 50,
 * the frame the race model is tuned in. A car from a lower tier on the same
 * scale reads below that, one from a higher tier above it.
 */
export function inRaceFrame(rating: number, division: DivisionId): number {
  return rating - divisionCarBase(division) + 50;
}

/** Pace performance (0-100) of a car at a specific circuit. */
export function trackPerformance(car: Car, circuit: Circuit): number {
  let total = 0;
  for (const key of PACE_COMPONENTS) total += car.components[key] * circuit.weights[key];
  return total;
}

export function overallPace(car: Car): number {
  let total = 0;
  for (const key of PACE_COMPONENTS) total += car.components[key] * TYPICAL_WEIGHTS[key];
  return total;
}

/** Overall rating shown in the UI (pace with a nod to reliability and tyres). */
export function carRating(car: Car): number {
  return overallPace(car) * 0.8 + car.components.reliability * 0.1 + car.components.tireEfficiency * 0.06 + car.components.cooling * 0.04;
}

/** Combined reliability index used by the failure model. */
export function reliabilityIndex(car: Car, trackTemp: number): number {
  const heat = clamp((trackTemp - 30) / 20, 0, 1);
  return car.components.reliability * (0.78 - heat * 0.12) + car.components.cooling * (0.22 + heat * 0.12);
}

export function bestComponent(car: Car): ComponentKey {
  return COMPONENT_KEYS.reduce((best, k) => (car.components[k] > car.components[best] ? k : best), COMPONENT_KEYS[0]);
}

export function weakestComponent(car: Car, keys: ComponentKey[] = COMPONENT_KEYS): ComponentKey {
  return keys.reduce((worst, k) => (car.components[k] < car.components[worst] ? k : worst), keys[0]);
}

/**
 * Season rollover. What survives the winter depends on the difficulty's
 * development rules, which apply to every team alike.
 *
 * When development is kept (Casual, Standard), no car ever loses rating: each
 * keeps everything its team has developed. New rules let teams behind the
 * field average close part of the gap (more under bigger rule changes, most
 * in the area the rules focus on), and strong engineering organisations find a
 * little extra.
 *
 * When development is not kept (Realistic, Hardcore), the series average is
 * pulled back toward the regulation baseline and each car keeps only part of
 * its advantage over the field, less under bigger rule changes.
 */
export function applyRegulationReset(car: Car, rng: Rng, notice: RegulationNotice, divisionMean: Record<ComponentKey, number>, engineeringStrength: number, rules: CarDevelopmentRules, baseline = REGULATION_BASELINE): void {
  const keepsDevelopment = rules.fieldKept >= 1 && rules.carry[notice.magnitude] >= 1;
  const catchUp = notice.magnitude === 'major' ? 0.22 : notice.magnitude === 'minor' ? 0.12 : 0;
  for (const key of COMPONENT_KEYS) {
    const current = car.components[key];
    const mean = divisionMean[key] ?? current;
    let next: number;
    if (keepsDevelopment) {
      const share = notice.focus === key ? Math.min(0.5, catchUp * 1.5) : catchUp;
      const catchGain = Math.max(0, mean - current) * share;
      const adapt = Math.max(0, (engineeringStrength - 0.5) * 1.0 + rng.normal(0, 0.3));
      next = current + catchGain + adapt;
    } else {
      const carry = rules.carry[notice.magnitude] * (notice.focus === key ? 0.6 : 1);
      const adapt = (engineeringStrength - 0.5) * 5 + rng.normal(0, 1.6);
      next = baseline + (mean - baseline) * rules.fieldKept + (current - mean) * carry + adapt;
    }
    car.components[key] = Math.round(clamp(next, 1, 99) * 100) / 100;
  }
  car.developmentLevel = emptyDevLevels();
}

/** Component rating a series' average returns toward when rules take development away (its car base). */
export const REGULATION_BASELINE = 50;

/**
 * Share of the gap between two tiers' fields a promoted car makes up over the
 * winter on a one-scale ruleset (more when development is kept), and the share
 * a relegated car gives away.
 */
export const TIER_STEP = { liftMin: 0.2, liftCarry: 0.1, relegationDrop: 0.45 } as const;

/**
 * Promotion/relegation: the car is rebuilt to the new division's regulations.
 * A promoted car keeps `carry` of its advantage over its old field as an
 * advantage over its new field (all of it on Casual and Standard); the rest is
 * a fresh start near the new field's average, set by the team's engineering
 * strength. A relegated car starts near its new field's average; with full
 * carry-over the player's relegated car keeps every rating it had.
 *
 * When the two divisions are rated on one scale (`tierGap`, the difference in
 * car base, is not 0), a car keeps its ratings instead: a promoted car makes
 * up only part of the gap to its new field (TIER_STEP), so it starts the
 * season in the lower half of a stronger league and has to develop its way
 * up; a relegated car gives some of its edge away but stays among the
 * stronger cars of the tier below (with full carry-over the player's keeps
 * every rating it had).
 */
export function rebaseCarForDivision(
  car: Car,
  rng: Rng,
  oldFieldMean: Record<ComponentKey, number>,
  newFieldMean: Record<ComponentKey, number>,
  engineeringStrength: number,
  promoted: boolean,
  carry: number,
  keepRelegated = false,
  tierGap = 0,
): void {
  if (tierGap !== 0) {
    rebaseAcrossTiers(car, rng, oldFieldMean, newFieldMean, engineeringStrength, promoted, carry, keepRelegated);
    return;
  }
  const fieldAvg = COMPONENT_KEYS.reduce((s, k) => s + (newFieldMean[k] ?? 50), 0) / COMPONENT_KEYS.length;
  const carAvg = COMPONENT_KEYS.reduce((s, k) => s + car.components[k], 0) / COMPONENT_KEYS.length;
  for (const key of COMPONENT_KEYS) {
    const noise = rng.normal(0, 1.5);
    let next: number;
    if (promoted) {
      const advantage = car.components[key] - (oldFieldMean[key] ?? car.components[key]);
      const freshStart = -1 + engineeringStrength * 4 + noise;
      next = (newFieldMean[key] ?? fieldAvg) + advantage * carry + freshStart * (1 - carry);
      // Full carry-over (Casual, Standard) never makes a component worse.
      if (carry >= 1) next = Math.max(next, car.components[key]);
    } else {
      next = fieldAvg - 1 + engineeringStrength * 3 + (car.components[key] - carAvg) * 0.35 + noise;
      // Full carry-over (Casual, Standard) never makes a component worse, even after relegation.
      if (carry >= 1 && keepRelegated) next = Math.max(next, car.components[key]);
    }
    car.components[key] = Math.round(clamp(next, 1, 99) * 100) / 100;
  }
  car.developmentLevel = emptyDevLevels();
}

function rebaseAcrossTiers(car: Car, rng: Rng, oldFieldMean: Record<ComponentKey, number>, newFieldMean: Record<ComponentKey, number>, engineeringStrength: number, promoted: boolean, carry: number, keepRelegated: boolean): void {
  const lift = TIER_STEP.liftMin + TIER_STEP.liftCarry * Math.min(1, carry);
  for (const key of COMPONENT_KEYS) {
    const current = car.components[key];
    const gap = (newFieldMean[key] ?? current) - (oldFieldMean[key] ?? current);
    const fresh = (engineeringStrength - 0.5) * 2 + rng.normal(0, 1);
    let next: number;
    if (promoted) {
      next = current + Math.max(0, gap) * lift + fresh;
      // Full carry-over (Casual, Standard) never makes a component worse.
      if (carry >= 1) next = Math.max(next, current);
    } else {
      next = current - Math.max(0, -gap) * TIER_STEP.relegationDrop + fresh;
      // Full carry-over (Casual, Standard) never makes a component worse, even after relegation.
      if (carry >= 1 && keepRelegated) next = Math.max(next, current);
    }
    car.components[key] = Math.round(clamp(next, 1, 99) * 100) / 100;
  }
  car.developmentLevel = emptyDevLevels();
}

/**
 * Development boost at season end for a championship position (1-based), the
 * table spread over the whole field. Classic series reward the top and help the
 * bottom catch up; a European league rewards the top (prize money and
 * European football) with little catch-up help.
 */
export function finishDevelopmentBoost(position: number, fieldSize?: number, european = false): number {
  const table = european ? ECONOMY_TUNING.euroDevelopmentBoost : ECONOMY_TUNING.finishDevelopmentBoost;
  if (position < 1) return 0;
  const size = fieldSize ?? table.length;
  if (size <= table.length) return table[Math.min(table.length, position) - 1] ?? 0;
  const q = ((Math.min(position, size) - 1) / (size - 1)) * (table.length - 1);
  const lo = Math.floor(q);
  const hi = Math.min(table.length - 1, lo + 1);
  return Math.round((table[lo] + (table[hi] - table[lo]) * (q - lo)) * 100) / 100;
}

/** Add a season-end boost to every component. */
export function applyDevelopmentBoost(car: Car, boost: number): void {
  for (const key of COMPONENT_KEYS) car.components[key] = Math.round(clamp(car.components[key] + boost, 1, 99) * 100) / 100;
}
