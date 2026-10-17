import { overallPace } from '../car/car';
import { DIVISIONS } from '../config/divisions';
import { overall } from '../drivers/ratings';
import type { Rng } from '../rng';
import type { CalendarEvent, DivisionId, EuroClub, GameState, Team } from '../types';
import { ASSOCIATION_BY_ID } from './data';

/**
 * Continental strength scale, in car-rating points. Car ratings are relative
 * to a team's own league, so racing between leagues needs a common yardstick:
 *
 *   power = car pace + level pace + league pace + 0.65 x (driver overall - 76)
 *
 * Level pace separates the tiers of one association; league pace separates the
 * associations. Clubs outside the player's association are run by a quick
 * model straight from their power.
 */

export const LEVEL_PACE: Record<DivisionId, number> = { F1: 0, F2: -6, F3: -12, F4: -18, F5: -24 };
/** Car-rating points one point of driver overall is worth (0.03 s against 0.046 s per point). */
export const DRIVER_WEIGHT = 0.65;
export const DRIVER_REFERENCE = 76;

export function associationPace(assocId: string): number {
  return ASSOCIATION_BY_ID[assocId]?.pace ?? 0;
}

/**
 * Spread of club power across a league, matching how full teams are built:
 * car spread plus the drivers a stronger team can afford (x0.65).
 */
export function levelPowerSpread(division: DivisionId): number {
  return DIVISIONS[division].carSpread * 1.15 + DRIVER_WEIGHT * 4.5;
}

/** Expected power of an average club at this level of this association. */
export function levelMeanPower(assocId: string, division: DivisionId): number {
  return 50 + LEVEL_PACE[division] + associationPace(assocId) + DRIVER_WEIGHT * (DIVISIONS[division].driverRatingMean - DRIVER_REFERENCE);
}

/**
 * Mean car pace of a division's field. Cars develop through the season, so a
 * team's strength is its car relative to its own league, like every quick-model
 * club's.
 */
export function fieldPaceMean(state: GameState, division: DivisionId): number {
  const teams = Object.values(state.teams).filter((t) => t.division === division && !t.guest);
  return teams.length ? teams.reduce((s, t) => s + overallPace(t.car), 0) / teams.length : 50;
}

/** Power of a fully simulated team, from its car and race drivers. */
export function teamPower(state: GameState, team: Team): number {
  const drivers = team.raceDrivers.map((id) => (id ? state.drivers[id] : null)).filter((d) => !!d);
  const avg = drivers.length ? drivers.reduce((s, d) => s + overall(d!), 0) / drivers.length : DIVISIONS[team.division].driverRatingMean - 4;
  const assoc = state.europe?.playerAssocId ?? '';
  return 50 + overallPace(team.car) - fieldPaceMean(state, team.division) + LEVEL_PACE[team.division] + associationPace(assoc) + DRIVER_WEIGHT * (avg - DRIVER_REFERENCE);
}

/** Power of any club: live for full teams, stored for quick-model clubs. */
export function clubPower(state: GameState, club: EuroClub): number {
  if (club.teamId && state.teams[club.teamId] && !state.teams[club.teamId].guest) return teamPower(state, state.teams[club.teamId]);
  return club.power;
}

/** A club's two cars for the quick model: overall power and each driver's share. */
export function clubField(state: GameState, club: EuroClub): { clubId: string; power: number; drivers: [number, number] } {
  const team = club.teamId ? state.teams[club.teamId] : null;
  if (team && !team.guest) {
    const ratings = team.raceDrivers.map((id) => (id && state.drivers[id] ? overall(state.drivers[id]) : DIVISIONS[team.division].driverRatingMean - 4));
    const avg = (ratings[0] + ratings[1]) / 2;
    return { clubId: club.id, power: teamPower(state, team), drivers: [DRIVER_WEIGHT * (ratings[0] - avg), DRIVER_WEIGHT * (ratings[1] - avg)] };
  }
  return { clubId: club.id, power: club.power, drivers: club.drivers };
}

/**
 * Pace offset (car-rating points) for a team racing an event of another level:
 * a second-tier team in a cup tie against the top flight gives away the
 * difference in car performance. Guest teams are built for the event's level.
 */
export function eventCarOffset(state: GameState, team: Team, event: CalendarEvent): number {
  if (!event.euro || event.euro.competition === 'league' || team.guest || team.division === event.division) return 0;
  return LEVEL_PACE[team.division] - LEVEL_PACE[event.division] - (fieldPaceMean(state, team.division) - fieldPaceMean(state, event.division));
}

// ---------------------------------------------------------------------------
// Quick model
// ---------------------------------------------------------------------------

/** Race-to-race spread of a car's performance (car-rating points). */
const RACE_SD = 3.2;
const DNF_CHANCE = 0.055;

export interface QuickCar {
  key: string;
  clubId: string;
  index: 0 | 1;
  perf: number;
  dnf: boolean;
}

/** One race of the quick model: each club's two cars, ordered by result (retirements last). */
export function quickRace(rng: Rng, field: { clubId: string; power: number; drivers: [number, number] }[], dnfChance = DNF_CHANCE): QuickCar[] {
  const cars: QuickCar[] = [];
  for (const c of field) {
    for (const index of [0, 1] as const) {
      const dnf = rng.chance(dnfChance);
      cars.push({ key: `${c.clubId}:${index}`, clubId: c.clubId, index, perf: c.power + c.drivers[index] + rng.normal(0, RACE_SD), dnf });
    }
  }
  return cars.sort((a, b) => (a.dnf === b.dnf ? b.perf - a.perf : a.dnf ? 1 : -1));
}

/** Single flying lap of the quick model, for qualifying shoot-outs. */
export function quickLap(rng: Rng, power: number, driver: number): number {
  return power + driver + rng.normal(0, 1.6);
}

/** Fresh pace split between a club's two cars for the season. */
export function rollDriverSplit(rng: Rng): [number, number] {
  const gap = Math.abs(rng.normal(0, 1.4));
  const lead = rng.normal(0, 0.8);
  return [Math.round((lead + gap / 2) * 10) / 10, Math.round((lead - gap / 2) * 10) / 10];
}
