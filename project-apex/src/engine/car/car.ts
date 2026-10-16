import type { CarDevelopmentRules } from '../config/difficulty';
import { ECONOMY_TUNING } from '../config/tuning';
import type { Rng } from '../rng';
import type { Car, Circuit, ComponentKey, PaceComponentKey, RegulationNotice } from '../types';
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
export function applyRegulationReset(car: Car, rng: Rng, notice: RegulationNotice, divisionMean: Record<ComponentKey, number>, engineeringStrength: number, rules: CarDevelopmentRules): void {
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
      next = REGULATION_BASELINE + (mean - REGULATION_BASELINE) * rules.fieldKept + (current - mean) * carry + adapt;
    }
    car.components[key] = Math.round(clamp(next, 1, 99) * 100) / 100;
  }
  car.developmentLevel = emptyDevLevels();
}

/** Component rating a series' average returns toward when rules take development away. */
export const REGULATION_BASELINE = 50;

/**
 * Promotion/relegation: the car is rebuilt to the new division's regulations.
 * A promoted car keeps `carry` of its advantage over its old field as an
 * advantage over its new field (all of it on Casual and Standard); the rest is
 * a fresh start near the new field's average, set by the team's engineering
 * strength. A relegated car starts near its new field's average; with full
 * carry-over the player's relegated car keeps every rating it had.
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
): void {
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

/** Development boost at season end for a championship position (1-based). */
export function finishDevelopmentBoost(position: number): number {
  const table = ECONOMY_TUNING.finishDevelopmentBoost;
  return table[Math.min(table.length, Math.max(1, position)) - 1] ?? 0;
}

/** Add a season-end boost to every component. */
export function applyDevelopmentBoost(car: Car, boost: number): void {
  for (const key of COMPONENT_KEYS) car.components[key] = Math.round(clamp(car.components[key] + boost, 1, 99) * 100) / 100;
}
