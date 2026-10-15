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
 * Season rollover. A car keeps everything its team has developed and never
 * loses ground on its rivals over the winter. New rules let teams behind the
 * field average close part of the gap (more under bigger rule changes, most in
 * the area the rules focus on), and strong engineering organisations find a
 * little extra in the new rules.
 *
 * `seriesShift` is a speed limit for the whole series: once its average
 * passes the regulation ceiling, every car in the series is slowed by exactly
 * the same amount, so the order and the gaps between teams are unchanged.
 */
export function applyRegulationReset(car: Car, rng: Rng, notice: RegulationNotice, divisionMean: Record<ComponentKey, number>, engineeringStrength: number, seriesShift: Record<ComponentKey, number>): void {
  const catchUp = notice.magnitude === 'major' ? 0.28 : notice.magnitude === 'minor' ? 0.16 : 0.08;
  for (const key of COMPONENT_KEYS) {
    const current = car.components[key];
    const mean = divisionMean[key] ?? current;
    const share = notice.focus === key ? Math.min(0.5, catchUp * 1.5) : catchUp;
    const catchGain = Math.max(0, mean - current) * share;
    const adapt = Math.max(0, (engineeringStrength - 0.4) * 1.2 + rng.normal(0, 0.3));
    const next = current + catchGain + adapt - (seriesShift[key] ?? 0);
    car.components[key] = Math.round(clamp(next, 1, 99) * 100) / 100;
  }
  car.developmentLevel = emptyDevLevels();
}

/** Average component rating above which a series' regulations slow every car equally. */
export const REGULATION_CEILING = 66;

/** Uniform per-component slow-down for a series whose field average passed the ceiling. */
export function seriesShiftFor(divisionMean: Record<ComponentKey, number>): Record<ComponentKey, number> {
  return Object.fromEntries(COMPONENT_KEYS.map((k) => [k, Math.max(0, (divisionMean[k] ?? 0) - REGULATION_CEILING)])) as Record<ComponentKey, number>;
}

/**
 * Promotion/relegation: the car is rebuilt to the new division's regulations.
 * Its relative standing is derived from the team's engineering strength
 * (facilities and technical director), not its old car numbers, so an F5 car
 * never competes unchanged in F1.
 */
export function rebaseCarForDivision(car: Car, rng: Rng, baseline: number, engineeringStrength: number, promoted: boolean): void {
  // Newcomers start close to the established field's average; relegated teams a little ahead.
  const offset = promoted ? -1 + engineeringStrength * 4 : 2 + engineeringStrength * 5;
  const oldMean = COMPONENT_KEYS.reduce((s, k) => s + car.components[k], 0) / COMPONENT_KEYS.length;
  for (const key of COMPONENT_KEYS) {
    const shape = (car.components[key] - oldMean) * 0.35;
    car.components[key] = Math.round(clamp(baseline + offset + shape + rng.normal(0, 1.5), 15, 92) * 10) / 10;
  }
  car.developmentLevel = emptyDevLevels();
}
