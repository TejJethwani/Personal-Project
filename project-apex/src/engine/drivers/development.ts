import { PHILOSOPHIES } from '../config/difficulty';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import { staffRating } from '../staff/staff';
import type { AttributeKey, Driver, GameState, Team, TrainingFocus } from '../types';
import { clamp } from '../util';
import { ATTRIBUTE_KEYS, computeOverall, driverName } from './ratings';
import { allDrivers } from '../selectors';

/** Attribute weights for each training focus. */
export const FOCUS_WEIGHTS: Record<TrainingFocus, Partial<Record<AttributeKey, number>>> = {
  balanced: { pace: 1, qualifying: 1, racecraft: 1, consistency: 1, tireManagement: 1, wetWeather: 0.7, braking: 1, adaptability: 1, mentality: 0.8, fitness: 0.8 },
  speed: { pace: 3, qualifying: 3, braking: 2 },
  racecraft: { racecraft: 4, adaptability: 2, braking: 1.5 },
  tires: { tireManagement: 4, consistency: 2.5 },
  wet: { wetWeather: 4, adaptability: 2 },
  physical: { fitness: 4, consistency: 1.5, mentality: 0.5 },
  mental: { mentality: 4, consistency: 2.5 },
};

export const FOCUS_LABELS: Record<TrainingFocus, string> = {
  balanced: 'Balanced programme',
  speed: 'Raw speed & qualifying',
  racecraft: 'Racecraft & adaptability',
  tires: 'Tyre management',
  wet: 'Wet-weather driving',
  physical: 'Physical conditioning',
  mental: 'Mental performance',
};

const INTENSITY: Record<Driver['training']['intensity'], number> = { light: 0.7, normal: 1, intense: 1.35 };

export function ageGrowthFactor(age: number): number {
  if (age <= 17) return 1.15;
  if (age <= 19) return 1.0;
  if (age <= 22) return 0.8;
  if (age <= 25) return 0.52;
  if (age <= 28) return 0.28;
  if (age <= 31) return 0.1;
  return 0;
}

export function declineRate(age: number): number {
  if (age <= 31) return 0;
  return (age - 31) * 0.09;
}

function teamOf(state: GameState, d: Driver): Team | null {
  return d.contract ? state.teams[d.contract.teamId] ?? null : null;
}

/**
 * Monthly development tick. Growth depends on age, remaining potential,
 * coaching, facilities, morale, training intensity and focus, plus natural
 * variation; veterans slowly decline. Racing builds experience.
 */
export function developDrivers(state: GameState, racesThisMonth: Record<string, number>): void {
  for (const d of allDrivers(state)) {
    if (d.retired) continue;
    const rng = Rng.from(state.seed, 'develop', d.id, state.season, state.week);
    const team = teamOf(state, d);
    const coach = team ? staffRating(state, team, 'driverCoach') : 25;
    const isAcademy = d.contract?.role === 'academy';
    const academyDirector = team && isAcademy ? staffRating(state, team, 'academyDirector') : 30;
    const sim = team?.facilities.simulator.level ?? 1;
    const fitness = team?.facilities.fitness.level ?? 1;
    const academy = team?.facilities.trainingAcademy.level ?? 1;
    const philosophy = team?.isPlayer ? PHILOSOPHIES[state.player.philosophy] : null;
    const ovr = computeOverall(d.attributes);
    const gap = Math.max(0, d.potential - ovr);
    const races = racesThisMonth[d.id] ?? 0;
    const intensity = INTENSITY[d.training.intensity];
    const morale = 0.8 + d.morale / 250;
    let coaching = 0.72 + coach / 210 + (sim + fitness) / 50;
    if (isAcademy) coaching = 0.7 + academyDirector / 220 + academy / 18;
    let youth = 1;
    if (philosophy && d.age <= 22) youth = philosophy.youthDevelopment;
    if (philosophy && philosophy.id === 'engineering') youth *= 0.9;
    const archetypeBoost = d.archetype === 'generational' ? 1.35 : d.archetype === 'inconsistentProdigy' ? 1.15 : 1;
    const racingBoost = races > 0 ? 1.12 : isAcademy ? 1 : 0.85;
    const variation = rng.range(0.55, 1.45);
    const points = gap * ageGrowthFactor(d.age) * 0.03 * coaching * intensity * morale * youth * archetypeBoost * racingBoost * variation;
    const weights = FOCUS_WEIGHTS[d.training.focus];
    const totalW = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    if (points > 0 && ovr < d.potential) {
      for (const key of ATTRIBUTE_KEYS) {
        const w = (weights[key] ?? 0) / totalW;
        if (w <= 0) continue;
        // Each attribute weight of 1/12 (balanced) receives the full point budget * share * 12 /~ spread.
        d.attributes[key] = clamp(d.attributes[key] + points * w * 9.5 * rng.range(0.6, 1.4), 1, 99);
      }
      // Never exceed the ceiling.
      while (computeOverall(d.attributes) > d.potential) {
        for (const key of ATTRIBUTE_KEYS) if (key !== 'experience' && key !== 'aggression') d.attributes[key] = clamp(d.attributes[key] - 0.3, 1, 99);
      }
    }
    // Decline for veterans: speed and fitness fade first, experience keeps growing.
    const decline = declineRate(d.age) * rng.range(0.6, 1.4) * (1.1 - fitness / 40);
    if (decline > 0) {
      for (const key of ['pace', 'qualifying', 'fitness', 'braking', 'wetWeather'] as AttributeKey[]) d.attributes[key] = clamp(d.attributes[key] - decline * rng.range(0.6, 1.3), 1, 99);
    }
    // Racing experience.
    if (races > 0) d.attributes.experience = clamp(d.attributes.experience + races * rng.range(0.25, 0.55), 1, 99);
    // Training risks.
    if (d.training.intensity === 'intense') {
      d.morale = clamp(d.morale - 1.5, 5, 100);
      if (!d.injury && rng.chance(0.012 * (1.4 - fitness / 15))) {
        const weeks = rng.int(1, 3);
        d.injury = { weeksRemaining: weeks, description: 'Training injury' };
        d.injuries.push({ season: state.season, week: state.week, description: 'Training injury', weeksOut: weeks });
        if (team?.isPlayer) addNews(state, { category: 'injury', headline: `TRAINING INJURY FOR ${driverName(d).toUpperCase()}`, body: `${driverName(d)} picked up a knock during an intense training block and will be out for ${weeks} week${weeks > 1 ? 's' : ''}.`, driverIds: [d.id], teamIds: [team.id], importance: 2 });
      }
    } else if (d.training.intensity === 'light') {
      d.morale = clamp(d.morale + 0.8, 5, 100);
    }
    // Rare late bloomers: an unexpected leap in potential for a young driver.
    if (d.age <= 21 && rng.chance(0.0035)) {
      const jump = rng.int(5, 11);
      d.potential = clamp(d.potential + jump, 1, 99);
      if (d.potential >= 85 && (team?.isPlayer || (state.player.scouting[d.id] ?? 0) > 40)) {
        addNews(state, { category: 'academy', headline: `HIDDEN GEM? ${driverName(d).toUpperCase()} IS MAKING WAVES`, body: `Coaches report a dramatic improvement from ${driverName(d)}, aged ${d.age}. Scouts are taking notice.`, driverIds: [d.id], importance: 1 });
      }
    }
    for (const key of ATTRIBUTE_KEYS) d.attributes[key] = Math.round(d.attributes[key] * 10) / 10;
  }
}

/** End-of-season ageing and morale reset. */
export function ageDrivers(state: GameState): void {
  for (const d of allDrivers(state)) {
    if (d.retired) continue;
    d.age += 1;
    d.seasonStartOverall = computeOverall(d.attributes);
    d.ratingHistory.push({ season: state.season, overall: d.seasonStartOverall });
    if (d.ratingHistory.length > 40) d.ratingHistory.shift();
    d.penaltyPoints = Math.max(0, d.penaltyPoints - 6);
    d.morale = clamp(d.morale * 0.7 + 60 * 0.3, 5, 100);
    d.confidence = 50;
    // Ceilings drift for veterans.
    if (d.age >= 30) d.potential = Math.max(computeOverall(d.attributes), d.potential - 1);
  }
}
