import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import type { AttributeKey, Circuit, Driver, DriverAttributes, DivisionId } from '../types';
import { clamp, roundMoney } from '../util';

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  'pace',
  'qualifying',
  'racecraft',
  'consistency',
  'tireManagement',
  'wetWeather',
  'braking',
  'adaptability',
  'aggression',
  'experience',
  'mentality',
  'fitness',
];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  pace: 'Pace',
  qualifying: 'Qualifying',
  racecraft: 'Racecraft',
  consistency: 'Consistency',
  tireManagement: 'Tyre Management',
  wetWeather: 'Wet Weather',
  braking: 'Braking',
  adaptability: 'Adaptability',
  aggression: 'Aggression',
  experience: 'Experience',
  mentality: 'Mentality',
  fitness: 'Fitness',
};

/**
 * Weights used to compute the Overall rating. Aggression is not linear: a
 * moderate level (around 65) is ideal; too passive or too wild both cost.
 */
export const OVERALL_WEIGHTS: Record<AttributeKey, number> = {
  pace: 0.22,
  qualifying: 0.1,
  racecraft: 0.12,
  consistency: 0.12,
  tireManagement: 0.08,
  wetWeather: 0.05,
  braking: 0.07,
  adaptability: 0.06,
  aggression: 0.02,
  experience: 0.06,
  mentality: 0.06,
  fitness: 0.04,
};

export function aggressionScore(aggression: number): number {
  return clamp(100 - Math.abs(aggression - 65) * 1.6, 1, 100);
}

export function computeOverall(a: DriverAttributes): number {
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const value = key === 'aggression' ? aggressionScore(a.aggression) : a[key];
    total += value * OVERALL_WEIGHTS[key];
  }
  return Math.round(clamp(total, 1, 99));
}

export const overall = (d: Driver): number => computeOverall(d.attributes);

/** Division whose level matches this rating; drivers aspire to race there. */
export function targetDivisionFor(rating: number): DivisionId {
  if (rating >= 71) return 'F1';
  if (rating >= 63) return 'F2';
  if (rating >= 57) return 'F3';
  if (rating >= 50.5) return 'F4';
  return 'F5';
}

/** Ambition: young drivers aspire to where their potential leads. */
export function aspirationTier(d: Driver): number {
  const ovr = overall(d);
  const lookAhead = d.age <= 21 ? Math.min(d.potential, ovr + 3) : ovr;
  return DIVISIONS[targetDivisionFor(lookAhead)].tier;
}

/** Division-neutral salary curve (Formula 3 money). */
export function baseSalary(rating: number): number {
  const t = ECONOMY_TUNING;
  const lower = Math.min(rating, t.salaryEliteThreshold) - 40;
  const upper = Math.max(0, rating - t.salaryEliteThreshold);
  return t.salaryBase * Math.exp(t.salaryRate * lower + t.salaryEliteRate * upper);
}

/** Salary a driver expects to be paid by a team in `division`. */
export function expectedSalary(d: Driver, division: DivisionId, demandMultiplier = 1): number {
  const ovr = overall(d);
  let s = baseSalary(ovr) * DIVISIONS[division].salaryFactor;
  if (d.personality === 'mercenary') s *= 1.18;
  if (d.personality === 'loyal') s *= 0.95;
  if (d.age <= 21 && d.potential - ovr > 12) s *= 1.1;
  if (d.age >= 34) s *= 0.85;
  return roundMoney(Math.max(5_000, s * demandMultiplier));
}

export function ageValueFactor(age: number, potentialGap: number): number {
  if (age <= 19) return 1.5 + potentialGap / 25;
  if (age <= 23) return 1.3 + potentialGap / 40;
  if (age <= 28) return 1.0;
  if (age <= 32) return 0.72;
  if (age <= 35) return 0.45;
  return 0.25;
}

/** Transfer market value in money. */
export function marketValue(d: Driver, division?: DivisionId): number {
  const ovr = overall(d);
  const div = division ?? d.career.seasons.at(-1)?.division ?? targetDivisionFor(ovr);
  const salary = baseSalary(ovr) * Math.max(DIVISIONS[div].salaryFactor, DIVISIONS[targetDivisionFor(ovr)].salaryFactor);
  return roundMoney(salary * 2.4 * ageValueFactor(d.age, Math.max(0, d.potential - ovr)));
}

/** Morale/confidence modifier in performance points (roughly -3..+3). */
export function formModifier(d: Driver): number {
  return ((d.confidence - 50) / 50) * 1.6 + ((d.morale - 50) / 50) * 1.0;
}

/**
 * Race pace index of a driver (~1-100) at a circuit for a track wetness.
 * Weighted towards raw pace, with braking and adaptability mattering more at
 * high driver-demand tracks; in the wet, wet-weather skill takes over.
 */
export function racePaceIndex(d: Driver, circuit: Circuit, wetness: number): number {
  const a = d.attributes;
  const adaptW = 0.06 + 0.1 * circuit.driverDemand;
  const brakeW = 0.1 + 0.06 * (circuit.brakeStress - 0.6);
  const dry =
    a.pace * (0.5 - adaptW * 0.4) +
    a.braking * brakeW +
    a.adaptability * adaptW +
    a.experience * 0.08 +
    a.consistency * 0.06 +
    a.mentality * 0.04;
  const dryWeight = 0.5 - adaptW * 0.4 + brakeW + adaptW + 0.08 + 0.06 + 0.04;
  const dryIdx = dry / dryWeight;
  const wetIdx = dryIdx * 0.45 + a.wetWeather * 0.45 + a.adaptability * 0.1;
  const w = clamp(wetness * 1.2, 0, 1);
  return dryIdx * (1 - w) + wetIdx * w + formModifier(d);
}

export function qualiPaceIndex(d: Driver, circuit: Circuit, wetness: number): number {
  const a = d.attributes;
  const dryIdx = a.qualifying * 0.48 + a.pace * 0.3 + a.braking * 0.1 + a.adaptability * (0.06 + 0.06 * circuit.driverDemand) + a.mentality * 0.06;
  const total = 0.48 + 0.3 + 0.1 + 0.06 + 0.06 * circuit.driverDemand + 0.06;
  const base = dryIdx / total;
  const wetIdx = base * 0.45 + a.wetWeather * 0.45 + a.adaptability * 0.1;
  const w = clamp(wetness * 1.2, 0, 1);
  return base * (1 - w) + wetIdx * w + formModifier(d);
}

/** Defensive skill used when another car attempts a pass. */
export function defenceIndex(d: Driver): number {
  const a = d.attributes;
  return a.racecraft * 0.55 + a.experience * 0.2 + a.mentality * 0.1 + a.aggression * 0.15;
}

/** Attacking skill used when attempting a pass. */
export function attackIndex(d: Driver): number {
  const a = d.attributes;
  return a.racecraft * 0.6 + a.aggression * 0.2 + a.braking * 0.1 + a.mentality * 0.1;
}

export function driverName(d: Driver | undefined | null): string {
  if (!d) return '—';
  return `${d.firstName} ${d.lastName}`;
}

export function driverShortName(d: Driver | undefined | null): string {
  if (!d) return '—';
  return `${d.firstName[0]}. ${d.lastName}`;
}

export function driverCode(d: Driver | undefined | null): string {
  if (!d) return '---';
  const clean = d.lastName.replace(/^(van der |van |de |O')/i, '').normalize('NFD').replace(/[^A-Za-z]/g, '');
  return clean.slice(0, 3).toUpperCase().padEnd(3, 'X');
}

export const ARCHETYPE_LABELS: Record<Driver['archetype'], string> = {
  generational: 'Generational Talent',
  qualifier: 'Qualifying Specialist',
  tireWhisperer: 'Tyre Whisperer',
  wetMaster: 'Wet Weather Master',
  veteranLeader: 'Veteran Leader',
  overtaker: 'Aggressive Overtaker',
  inconsistentProdigy: 'Inconsistent Prodigy',
  allRounder: 'All-Rounder',
  payDriver: 'Pay Driver',
  journeyman: 'Journeyman',
};

export const PERSONALITY_LABELS: Record<Driver['personality'], string> = {
  loyal: 'Loyal',
  mercenary: 'Mercenary',
  ambitious: 'Ambitious',
  teamPlayer: 'Team Player',
  hotHeaded: 'Hot-Headed',
  calm: 'Ice Cool',
  mediaDarling: 'Media Darling',
  perfectionist: 'Perfectionist',
};
