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
 * Season rollover: regulation changes pull every car back towards the new
 * baseline. Teams keep part of their advantage (carry-over) depending on the
 * magnitude of the rule change. A focused regulation (e.g. new aero rules)
 * resets that area harder.
 */
export function applyRegulationReset(car: Car, rng: Rng, notice: RegulationNotice, baseline: number, divisionMean: Record<ComponentKey, number>, engineeringStrength: number): void {
  const carry = notice.magnitude === 'major' ? 0.42 : notice.magnitude === 'minor' ? 0.7 : 0.82;
  for (const key of COMPONENT_KEYS) {
    let c = carry;
    if (notice.focus === key) c *= 0.6;
    const current = car.components[key];
    const mean = divisionMean[key] ?? baseline;
    // Strong engineering organisations understand new rules faster.
    const adapt = (engineeringStrength - 0.5) * 5 + rng.normal(0, 1.6);
    // The field's average is pulled back to the regulation baseline; each team keeps
    // part of its advantage relative to the field.
    const next = baseline + (mean - baseline) * 0.2 + (current - mean) * c + adapt;
    car.components[key] = Math.round(clamp(next, 15, 95) * 10) / 10;
  }
  car.developmentLevel = emptyDevLevels();
}

/**
 * Promotion/relegation: the car is rebuilt to the new division's regulations.
 * Its relative standing is derived from the team's engineering strength
 * (facilities and technical director), not its old car numbers, so an F5 car
 * never competes unchanged in F1.
 */
export function rebaseCarForDivision(car: Car, rng: Rng, baseline: number, engineeringStrength: number, promoted: boolean): void {
  // Newcomers start a few points behind the established field; relegated teams a little ahead.
  const offset = promoted ? -3 + engineeringStrength * 6 : 2 + engineeringStrength * 5;
  const oldMean = COMPONENT_KEYS.reduce((s, k) => s + car.components[k], 0) / COMPONENT_KEYS.length;
  for (const key of COMPONENT_KEYS) {
    const shape = (car.components[key] - oldMean) * 0.35;
    car.components[key] = Math.round(clamp(baseline + offset + shape + rng.normal(0, 1.5), 15, 92) * 10) / 10;
  }
  car.developmentLevel = emptyDevLevels();
}
