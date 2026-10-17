import { objectivesFor } from '../board';
import { carRating } from '../car/car';
import { divisionAbove, DIVISIONS } from '../config/divisions';
import { activeDivisions, levelOfDivision } from '../config/ruleset';
import { overall } from '../drivers/ratings';
import { createEuroWorld } from '../europe/world';
import { projectedPosition } from '../finance/sponsors';
import { teamsInDivision } from '../selectors';
import { STAFF_ROLES } from '../staff/staff';
import { FACILITY_KEYS } from '../team/facilities';
import type { DivisionId, GameState, NewCareerConfig, Philosophy, Team, TeamHeritage } from '../types';
import { createWorld } from '../world/generate';

/**
 * Taking over an existing team: the world is generated exactly as it will be
 * when the career starts (same seed, every seat an established team), and each
 * team is summarised from its real generated data. The challenge categories
 * read that data; they never change how a team races.
 */

export type ChallengeId = 'roadToGlory' | 'rebuildGiant' | 'midfield' | 'contender' | 'dynasty';

export const CHALLENGES: Record<ChallengeId, { label: string; description: string }> = {
  roadToGlory: { label: 'Road to Glory', description: 'A struggling team in the bottom division. Everything is still ahead of you.' },
  rebuildGiant: { label: 'Rebuild a Giant', description: 'A famous name with a trophy cabinet to prove it, fallen on hard times.' },
  midfield: { label: 'Midfield Project', description: 'An average team. Turn it into a championship contender.' },
  contender: { label: 'Championship Contender', description: 'A strong team expected to fight for the title.' },
  dynasty: { label: 'Dynasty Mode', description: 'An established elite team at the very top. Anything less than winning fails.' },
};

export interface TakeoverCandidate {
  teamId: string;
  name: string;
  shortName: string;
  colors: Team['colors'];
  nationality: string;
  division: DivisionId;
  divisionName: string;
  /** 1 = top flight. */
  level: number;
  /** Car class (the series the cars are built to). */
  formulaClass: string;
  fieldSize: number;
  rating: number;
  carRating: number;
  driverAvg: number;
  drivers: { id: string; name: string; overall: number; age: number }[];
  cash: number;
  /** Cash against a typical budget for the division (1 = typical). */
  budgetRatio: number;
  reputation: number;
  facilityAvg: number;
  staffAvg: number;
  projected: number;
  heritage: TeamHeritage | undefined;
  objectives: string[];
  challenges: ChallengeId[];
}

/** The world a takeover career will start in, before a team is chosen. */
export function previewTakeoverWorld(config: NewCareerConfig): GameState {
  const cfg = { ...config, takeover: { teamId: '' } };
  return cfg.european ? createEuroWorld(cfg) : createWorld(cfg);
}

/** Overall team rating 0-100: car, drivers, staff and facilities. */
export function teamOverall(state: GameState, team: Team): number {
  const drivers = team.raceDrivers.map((id) => (id ? state.drivers[id] : null)).filter(Boolean);
  const driverAvg = drivers.length ? drivers.reduce((s, d) => s + overall(d!), 0) / drivers.length : 30;
  const staff = STAFF_ROLES.map((r) => (team.staff[r] ? state.staff[team.staff[r]!]?.rating ?? 30 : 25));
  const staffAvg = staff.reduce((s, x) => s + x, 0) / staff.length;
  const facilityAvg = FACILITY_KEYS.reduce((s, k) => s + team.facilities[k].level, 0) / FACILITY_KEYS.length;
  return Math.round(carRating(team.car) * 0.45 + driverAvg * 0.35 + staffAvg * 0.1 + facilityAvg * 10 * 0.1);
}

export function takeoverCandidates(state: GameState, philosophy: Philosophy = 'balanced'): TakeoverCandidate[] {
  const divisions = activeDivisions(state);
  const bottom = divisions[0];
  const top = divisions[divisions.length - 1];
  const out: TakeoverCandidate[] = [];
  for (const division of divisions) {
    const cfg = DIVISIONS[division];
    const teams = teamsInDivision(state, division).filter((t) => !t.guest);
    for (const team of teams) {
      const drivers = team.raceDrivers.map((id) => (id ? state.drivers[id] : null)).filter((d): d is NonNullable<typeof d> => !!d);
      const driverAvg = drivers.length ? drivers.reduce((s, d) => s + overall(d), 0) / drivers.length : 0;
      const staff = STAFF_ROLES.map((r) => team.staff[r]).filter(Boolean).map((id) => state.staff[id!]?.rating ?? 0);
      const projected = projectedPosition(state, team);
      const n = teams.length;
      const h = team.heritage;
      const challenges: ChallengeId[] = [];
      if (division === bottom && projected > n / 2) challenges.push('roadToGlory');
      if (h && h.titles >= 2 && (projected > n / 2 || (divisionAbove(division) && h.titlesIn !== cfg.name))) challenges.push('rebuildGiant');
      const dynasty = division === top && projected <= 2 && (team.reputation >= cfg.typicalReputation || (h?.titles ?? 0) >= 1);
      if (dynasty) challenges.push('dynasty');
      else if (projected <= 3) challenges.push('contender');
      if (projected > n * 0.3 && projected <= n * 0.7) challenges.push('midfield');
      out.push({
        teamId: team.id,
        name: team.name,
        shortName: team.shortName,
        colors: team.colors,
        nationality: team.nationality,
        division,
        divisionName: cfg.name,
        level: levelOfDivision(division),
        formulaClass: division === 'F1' ? 'Formula 1' : `Formula ${division.slice(1)}`,
        fieldSize: n,
        rating: teamOverall(state, team),
        carRating: Math.round(carRating(team.car)),
        driverAvg: Math.round(driverAvg),
        drivers: drivers.map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}`, overall: Math.round(overall(d)), age: d.age })),
        cash: team.cash,
        budgetRatio: team.cash / cfg.typicalBudget,
        reputation: Math.round(team.reputation),
        facilityAvg: Math.round((FACILITY_KEYS.reduce((s, k) => s + team.facilities[k].level, 0) / FACILITY_KEYS.length) * 10) / 10,
        staffAvg: staff.length ? Math.round(staff.reduce((s, x) => s + x, 0) / staff.length) : 0,
        projected,
        heritage: h,
        objectives: objectivesFor(state, team, philosophy).map((o) => o.description),
        challenges,
      });
    }
  }
  return out;
}
