import { DIVISIONS } from '../config/divisions';
import { NATIONALITIES, NATIONALITY_BY_CODE } from '../data/names';
import type { Rng } from '../rng';
import type { Archetype, AttributeKey, Driver, DriverAttributes, DivisionId, Personality } from '../types';
import { clamp, roundMoney } from '../util';
import { ATTRIBUTE_KEYS, computeOverall } from './ratings';

export interface GenContext {
  rng: Rng;
  ids: { idCounter: number };
  season: number;
}

export function nextId(ids: { idCounter: number }, prefix: string): string {
  ids.idCounter += 1;
  return `${prefix}${ids.idCounter.toString(36)}`;
}

const ARCHETYPE_MODS: Record<Archetype, Partial<Record<AttributeKey, number>>> = {
  generational: { pace: 8, qualifying: 6, racecraft: 5, adaptability: 6, mentality: 4, consistency: 2 },
  qualifier: { qualifying: 13, pace: 4, racecraft: -5, tireManagement: -5 },
  tireWhisperer: { tireManagement: 15, consistency: 5, qualifying: -6, aggression: -6 },
  wetMaster: { wetWeather: 18, adaptability: 5, braking: 2 },
  veteranLeader: { experience: 16, mentality: 8, consistency: 6, pace: -3, fitness: -4 },
  overtaker: { racecraft: 12, aggression: 16, braking: 4, consistency: -6 },
  inconsistentProdigy: { pace: 10, qualifying: 7, consistency: -16, mentality: -7, aggression: 6 },
  allRounder: { pace: 1, qualifying: 1, racecraft: 1, consistency: 1, tireManagement: 1, braking: 1 },
  payDriver: { pace: -4, qualifying: -3, racecraft: -3, consistency: -2 },
  journeyman: { experience: 7, consistency: 4, pace: -2 },
};

const PERSONALITY_WEIGHTS: { item: Personality; weight: number }[] = [
  { item: 'loyal', weight: 12 },
  { item: 'mercenary', weight: 12 },
  { item: 'ambitious', weight: 18 },
  { item: 'teamPlayer', weight: 14 },
  { item: 'hotHeaded', weight: 10 },
  { item: 'calm', weight: 12 },
  { item: 'mediaDarling', weight: 8 },
  { item: 'perfectionist', weight: 10 },
];

export function pickNationality(rng: Rng): string {
  return rng.weighted(NATIONALITIES.filter((n) => n.weight > 0).map((n) => ({ item: n.code, weight: n.weight })));
}

export function randomName(rng: Rng, nationality: string): { firstName: string; lastName: string } {
  const pool = NATIONALITY_BY_CODE[nationality] ?? NATIONALITIES[0];
  return { firstName: rng.pick(pool.first), lastName: rng.pick(pool.last) };
}

function pickArchetype(rng: Rng, age: number, young: boolean): Archetype {
  const weights: { item: Archetype; weight: number }[] = [
    { item: 'generational', weight: young ? 1.6 : 0.4 },
    { item: 'qualifier', weight: 9 },
    { item: 'tireWhisperer', weight: 9 },
    { item: 'wetMaster', weight: 7 },
    { item: 'veteranLeader', weight: age >= 29 ? 14 : 0 },
    { item: 'overtaker', weight: 9 },
    { item: 'inconsistentProdigy', weight: age <= 24 ? 8 : 1 },
    { item: 'allRounder', weight: 16 },
    { item: 'payDriver', weight: 6 },
    { item: 'journeyman', weight: age >= 24 ? 12 : 2 },
  ];
  return rng.weighted(weights);
}

/** Build attributes around a target overall rating with archetype flavour. */
export function buildAttributes(rng: Rng, target: number, age: number, archetype: Archetype): DriverAttributes {
  const a = {} as DriverAttributes;
  for (const key of ATTRIBUTE_KEYS) a[key] = target + rng.normal(0, 6);
  a.experience = clamp(18 + (age - 16) * 4.2 + rng.normal(0, 7) + (target - 55) * 0.35, 5, 98);
  a.fitness = clamp(62 + rng.normal(0, 10) - Math.max(0, age - 32) * 2, 25, 98);
  a.aggression = clamp(55 + rng.normal(0, 14), 10, 98);
  const mods = ARCHETYPE_MODS[archetype];
  for (const [key, mod] of Object.entries(mods) as [AttributeKey, number][]) a[key] += mod;
  // Shift every skill so the computed overall lands on the target.
  for (let i = 0; i < 6; i++) {
    const diff = target - computeOverall(clampAll(a));
    if (Math.abs(diff) < 0.5) break;
    for (const key of ATTRIBUTE_KEYS) {
      if (key === 'aggression' || key === 'experience') continue;
      a[key] += diff * 1.05;
    }
  }
  return clampAll(a);
}

function clampAll(a: DriverAttributes): DriverAttributes {
  const out = {} as DriverAttributes;
  for (const key of ATTRIBUTE_KEYS) out[key] = Math.round(clamp(a[key], 1, 99));
  return out;
}

export interface DriverGenOptions {
  targetOverall: number;
  age: number;
  division: DivisionId;
  archetype?: Archetype;
  nationality?: string;
  potentialBoost?: number;
}

export function generateDriver(ctx: GenContext, opts: DriverGenOptions): Driver {
  const { rng } = ctx;
  const nationality = opts.nationality ?? pickNationality(rng);
  const { firstName, lastName } = randomName(rng, nationality);
  const age = opts.age;
  const archetype = opts.archetype ?? pickArchetype(rng, age, age <= 21);
  const target = clamp(opts.targetOverall, 20, 96);
  const attributes = buildAttributes(rng, target, age, archetype);
  const ovr = computeOverall(attributes);

  // Potential: young drivers have headroom, older drivers are close to their ceiling.
  let headroom: number;
  if (age <= 17) headroom = rng.range(10, 30);
  else if (age <= 20) headroom = rng.range(6, 24);
  else if (age <= 23) headroom = rng.range(3, 15);
  else if (age <= 27) headroom = rng.range(1, 7);
  else headroom = rng.range(0, 3);
  headroom += opts.potentialBoost ?? 0;
  if (archetype === 'generational') headroom = Math.max(headroom, 95 - ovr + rng.range(0, 4));
  if (archetype === 'inconsistentProdigy') headroom += 5;
  if (archetype === 'payDriver' || archetype === 'journeyman') headroom *= 0.5;
  const potential = Math.round(clamp(ovr + headroom, ovr, 99));

  const budget = DIVISIONS[opts.division].typicalBudget;
  let backing = rng.chance(0.25) ? rng.range(0, 0.03) * budget : 0;
  if (archetype === 'payDriver') backing = rng.range(0.1, 0.28) * budget;
  const personality = rng.weighted(PERSONALITY_WEIGHTS);
  if (personality === 'mediaDarling') backing += rng.range(0.01, 0.04) * budget;

  return {
    id: nextId(ctx.ids, 'd'),
    firstName,
    lastName,
    nationality,
    age,
    attributes,
    potential,
    archetype,
    personality,
    morale: Math.round(rng.range(55, 80)),
    confidence: 50,
    contract: null,
    futureContract: null,
    backing: roundMoney(backing),
    training: { intensity: 'normal', focus: 'balanced' },
    injury: null,
    penaltyPoints: 0,
    raceBan: 0,
    pendingGridPenalty: 0,
    career: { starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, dnfs: 0, lapsLed: 0, championships: {}, seasons: [], bestFinish: null },
    injuries: [],
    discipline: [],
    transfers: [],
    ratingHistory: [{ season: ctx.season, overall: ovr }],
    seasonStartOverall: ovr,
    form: [],
    retired: false,
    retiredSeason: null,
    debutSeason: ctx.season,
  };
}

/** Typical race-seat age for a division. */
export function raceAgeFor(rng: Rng, division: DivisionId): number {
  switch (division) {
    case 'F5':
      return rng.chance(0.15) ? rng.int(25, 38) : rng.int(16, 22);
    case 'F4':
      return rng.chance(0.1) ? rng.int(24, 32) : rng.int(16, 21);
    case 'F3':
      return rng.int(17, 24);
    case 'F2':
      return rng.int(19, 27);
    case 'F1':
      return rng.chance(0.25) ? rng.int(31, 38) : rng.int(20, 31);
  }
}

/** A young prospect for the academy / youth market. */
export function generateProspect(ctx: GenContext, quality = 0): Driver {
  const { rng } = ctx;
  const age = rng.int(14, 17);
  const target = clamp(rng.normal(36 + (age - 14) * 2.5 + quality * 4, 5), 22, 56);
  const boost = rng.chance(0.06 + quality * 0.02) ? rng.range(10, 18) : rng.range(0, 6);
  return generateDriver(ctx, { targetOverall: target, age, division: 'F5', potentialBoost: boost + quality * 2 });
}
