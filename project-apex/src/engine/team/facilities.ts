import { PHILOSOPHIES } from '../config/difficulty';
import { ECONOMY_TUNING } from '../config/tuning';
import { postTransaction } from '../finance/ledger';
import type { FacilityKey, GameState, Team } from '../types';
import { assertRule, roundMoney } from '../util';

export const FACILITY_KEYS: FacilityKey[] = ['aeroCenter', 'simulator', 'trainingAcademy', 'engineering', 'manufacturing', 'fitness', 'scouting', 'strategy'];

export const MAX_FACILITY_LEVEL = 10;

export const FACILITY_INFO: Record<FacilityKey, { label: string; description: string; benefit: string }> = {
  aeroCenter: {
    label: 'Aerodynamic Development Center',
    description: 'Wind tunnel and CFD cluster.',
    benefit: 'Boosts gains and success rate of aerodynamics, cornering and straight-line projects.',
  },
  simulator: {
    label: 'Simulator',
    description: 'Driver-in-the-loop simulator.',
    benefit: 'Better practice feedback, setup quality and driver adaptability growth.',
  },
  trainingAcademy: {
    label: 'Driver Training Academy',
    description: 'Junior programme and karting base.',
    benefit: 'More academy places, better intake quality and faster prospect growth.',
  },
  engineering: {
    label: 'Engineering Department',
    description: 'Design office and engineering staff.',
    benefit: 'Engineering capacity for concurrent R&D projects and mechanical upgrades.',
  },
  manufacturing: {
    label: 'Manufacturing Facility',
    description: 'Composite shop, machining and assembly.',
    benefit: 'Cheaper, faster parts and fewer reliability compromises.',
  },
  fitness: {
    label: 'Fitness Center',
    description: 'Human performance lab.',
    benefit: 'Driver fitness growth, lower fatigue and faster injury recovery.',
  },
  scouting: {
    label: 'Scouting Department',
    description: 'Data analysts and talent spotters.',
    benefit: 'More simultaneous scouting assignments with better accuracy.',
  },
  strategy: {
    label: 'Race Strategy Department',
    description: 'Mission control and race-modelling tools.',
    benefit: 'Better strategy predictions, weather forecasts and pit-stop decisions.',
  },
};

export function facilityUpgradeCost(targetLevel: number): number {
  const t = ECONOMY_TUNING;
  return roundMoney(t.facilityCostBase * t.facilityCostGrowth ** (targetLevel - 2));
}

export function facilityUpkeep(level: number): number {
  const t = ECONOMY_TUNING;
  return roundMoney(t.facilityUpkeepBase * t.facilityUpkeepGrowth ** (level - 1));
}

export function facilityUpgradeWeeks(targetLevel: number): number {
  return Math.round(3 + targetLevel * 1.4);
}

export function facilityLevel(team: Team, key: FacilityKey): number {
  return team.facilities[key].level;
}

/** Normalised facility effect 0..1 (level 1 => 0, level 10 => 1). */
export function facilityFactor(team: Team, key: FacilityKey): number {
  return (team.facilities[key].level - 1) / (MAX_FACILITY_LEVEL - 1);
}

export function seasonFacilityUpkeep(team: Team, state?: GameState): number {
  let total = 0;
  for (const key of FACILITY_KEYS) total += facilityUpkeep(team.facilities[key].level);
  if (state && team.isPlayer) total *= PHILOSOPHIES[state.player.philosophy].operatingCosts;
  return total;
}

export function canUpgradeFacility(team: Team, key: FacilityKey): { ok: boolean; reason?: string; cost: number } {
  const f = team.facilities[key];
  const cost = facilityUpgradeCost(f.level + 1);
  if (f.upgrade) return { ok: false, reason: 'Upgrade already under construction', cost };
  if (f.level >= MAX_FACILITY_LEVEL) return { ok: false, reason: 'Already at maximum level', cost };
  const building = FACILITY_KEYS.filter((k) => team.facilities[k].upgrade).length;
  if (building >= 2) return { ok: false, reason: 'At most two construction projects at once', cost };
  if (team.cash < cost) return { ok: false, reason: 'Not enough cash', cost };
  return { ok: true, cost };
}

export function startFacilityUpgrade(state: GameState, teamId: string, key: FacilityKey): void {
  const team = state.teams[teamId];
  assertRule(team, 'Unknown team');
  const check = canUpgradeFacility(team, key);
  assertRule(check.ok, check.reason ?? 'Cannot upgrade');
  const f = team.facilities[key];
  const target = f.level + 1;
  f.upgrade = { targetLevel: target, weeksRemaining: facilityUpgradeWeeks(target), cost: check.cost };
  postTransaction(state, team, 'facilities', -check.cost, `${FACILITY_INFO[key].label} upgrade to level ${target}`);
}

/** Advance construction by one week; returns facilities that completed. */
export function progressFacilities(team: Team): FacilityKey[] {
  const done: FacilityKey[] = [];
  for (const key of FACILITY_KEYS) {
    const f = team.facilities[key];
    if (!f.upgrade) continue;
    f.upgrade.weeksRemaining -= 1;
    if (f.upgrade.weeksRemaining <= 0) {
      f.level = f.upgrade.targetLevel;
      f.upgrade = null;
      done.push(key);
    }
  }
  return done;
}

/** Academy capacity based on the training academy level and philosophy. */
export function academyCapacity(state: GameState, team: Team): number {
  const extra = team.isPlayer ? PHILOSOPHIES[state.player.philosophy].academySlots : 0;
  return Math.min(8, 1 + Math.floor(team.facilities.trainingAcademy.level / 2) + extra);
}

export function scoutingCapacity(team: Team): number {
  return 1 + Math.floor(team.facilities.scouting.level / 2);
}
