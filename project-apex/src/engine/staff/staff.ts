import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { STAFF_SPECIALIZATIONS } from '../data/names';
import { nextId, pickNationality, randomName, type GenContext } from '../drivers/generate';
import type { DivisionId, GameState, StaffMember, StaffRole, Team } from '../types';
import { clamp, roundMoney } from '../util';

export const STAFF_ROLES: StaffRole[] = [
  'technicalDirector',
  'raceEngineer',
  'headStrategist',
  'chiefMechanic',
  'driverCoach',
  'headScout',
  'academyDirector',
];

export const STAFF_ROLE_INFO: Record<StaffRole, { label: string; effect: string }> = {
  technicalDirector: { label: 'Technical Director', effect: 'R&D upgrade gains, success odds and engineering capacity.' },
  raceEngineer: { label: 'Race Engineer', effect: 'Practice feedback accuracy, automatic setups and driver confidence.' },
  headStrategist: { label: 'Head Strategist', effect: 'Strategy predictions, weather calls and autopilot pit timing.' },
  chiefMechanic: { label: 'Chief Mechanic', effect: 'Pit-stop speed, reliability and repair costs.' },
  driverCoach: { label: 'Driver Coach', effect: 'Driver development speed and morale.' },
  headScout: { label: 'Head Scout', effect: 'Scouting speed and accuracy of hidden attributes.' },
  academyDirector: { label: 'Academy Director', effect: 'Academy prospect quality and growth.' },
};

/** Rating used when a role is vacant. */
export const VACANT_RATING = 18;

export function staffExpectedSalary(rating: number, division: DivisionId): number {
  const t = ECONOMY_TUNING;
  return roundMoney(t.staffSalaryBase * Math.exp(t.staffSalaryRate * (rating - 30)) * DIVISIONS[division].salaryFactor);
}

export function generateStaff(ctx: GenContext, role: StaffRole, targetRating: number): StaffMember {
  const { rng } = ctx;
  const nationality = pickNationality(rng);
  const { firstName, lastName } = randomName(rng, nationality);
  const rating = Math.round(clamp(targetRating, 12, 97));
  const age = Math.round(clamp(28 + (rating - 30) * 0.25 + rng.normal(6, 7), 26, 68));
  return {
    id: nextId(ctx.ids, 's'),
    firstName,
    lastName,
    nationality,
    age,
    role,
    rating,
    experience: Math.round(clamp((age - 24) * 2.4 + rng.normal(0, 8), 5, 99)),
    specialization: rng.pick(STAFF_SPECIALIZATIONS[role]),
    contract: null,
    history: [],
    retired: false,
  };
}

export function staffOf(state: GameState, team: Team, role: StaffRole): StaffMember | null {
  const id = team.staff[role];
  return id ? state.staff[id] ?? null : null;
}

/** Effective rating of a role (experience gives a small bonus). */
export function staffRating(state: GameState, team: Team, role: StaffRole): number {
  const s = staffOf(state, team, role);
  if (!s) return VACANT_RATING;
  return clamp(s.rating + (s.experience - 50) * 0.04, 1, 100);
}

export function hasSpecialization(state: GameState, team: Team, role: StaffRole, spec: string): boolean {
  return staffOf(state, team, role)?.specialization === spec;
}

export function staffName(s: StaffMember | null | undefined): string {
  return s ? `${s.firstName} ${s.lastName}` : 'Vacant';
}

export function teamStaffSalaries(state: GameState, team: Team): number {
  let total = 0;
  for (const role of STAFF_ROLES) {
    const s = staffOf(state, team, role);
    if (s?.contract) total += s.contract.salary;
  }
  return total;
}

export function fullStaff(team: Team): boolean {
  return STAFF_ROLES.every((r) => team.staff[r] !== null);
}
