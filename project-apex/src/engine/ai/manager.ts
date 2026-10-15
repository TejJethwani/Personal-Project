import { AI_PERSONALITIES, type AIPersonalityConfig } from '../config/difficulty';
import { divisionAbove, DIVISIONS } from '../config/divisions';
import { COMPONENT_KEYS, PACE_COMPONENTS } from '../car/car';
import { canStartProject, capacityUsed, engineeringCapacity, quoteProject, RND_SCALES, startProject } from '../car/rnd';
import { teamPosition } from '../championship/standings';
import { postTransaction } from '../finance/ledger';
import { seasonDriverSalaries } from '../finance/weekly';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { Rng } from '../rng';
import { hireStaffMember } from '../staff/market';
import { STAFF_ROLES, staffExpectedSalary, staffRating, teamStaffSalaries } from '../staff/staff';
import { canUpgradeFacility, FACILITY_KEYS, facilityUpgradeCost, seasonFacilityUpkeep, startFacilityUpgrade } from '../team/facilities';
import type { AIPersonality, ComponentKey, FacilityKey, GameState, RnDScale, Team } from '../types';
import { clamp, roundMoney } from '../util';
import { eventLineup } from '../race/weekend';
import { aiEnsureSubstitute, aiFillSeats, aiInSeasonMarket } from './market';

function cfgOf(team: Team): AIPersonalityConfig {
  return AI_PERSONALITIES[team.aiPersonality ?? 'conservative'];
}

/** Cash the team must keep for the rest of the season's fixed costs plus its reserve. */
export function aiCommittedCash(state: GameState, team: Team): number {
  const div = DIVISIONS[team.division];
  const weeksLeft = state.phase === 'season' ? Math.max(0, 44 - state.week) : 44;
  const fixed = ((seasonDriverSalaries(state, team) + teamStaffSalaries(state, team) + seasonFacilityUpkeep(team)) * weeksLeft) / 44;
  const ops = state.calendars[team.division].filter((e) => !e.completed).length * div.raceOperationsCost;
  return fixed * 0.55 + ops * 0.4 + div.typicalBudget * cfgOf(team).reserve;
}

function componentPriority(state: GameState, team: Team, rng: Rng): ComponentKey[] {
  const remaining = state.calendars[team.division].filter((e) => !e.completed).map((e) => state.circuits[e.circuitId]);
  const scores: { key: ComponentKey; score: number }[] = COMPONENT_KEYS.map((key) => {
    const q = quoteProject(state, team, key, 'minor');
    let weight: number;
    if ((PACE_COMPONENTS as string[]).includes(key)) {
      weight = remaining.length ? remaining.reduce((s, c) => s + c.weights[key as keyof typeof c.weights], 0) / remaining.length : 0.14;
      weight *= 7;
    } else if (key === 'reliability') weight = team.car.components.reliability < 50 ? 1.1 : 0.55;
    else if (key === 'cooling') weight = 0.35;
    else weight = 0.6;
    return { key, score: weight * q.expectedGain * rng.range(0.8, 1.2) };
  });
  return scores.sort((a, b) => b.score - a.score).map((s) => s.key);
}

function pickScale(cfg: AIPersonalityConfig, rng: Rng): RnDScale {
  return rng.weighted(RND_SCALES.map((s) => ({ item: s, weight: cfg.rndScale[s] })));
}

export function aiRnD(state: GameState, team: Team, rng: Rng): void {
  const cfg = cfgOf(team);
  if (state.phase !== 'season' || state.week > 40) return;
  let guard = 0;
  while (capacityUsed(team) < engineeringCapacity(state, team) && guard++ < 4) {
    const spare = team.cash - aiCommittedCash(state, team);
    if (spare <= 0) return;
    const order = componentPriority(state, team, rng);
    let scale = pickScale(cfg, rng);
    let target: ComponentKey | null = null;
    for (const key of order) {
      for (const s of [scale, 'major', 'minor'] as RnDScale[]) {
        const check = canStartProject(state, team, key, s);
        if (check.ok && check.quote.cost <= spare * cfg.rndAppetite) {
          target = key;
          scale = s;
          break;
        }
      }
      if (target) break;
    }
    if (!target) return;
    startProject(state, team.id, target, scale);
  }
}

function facilityPriority(state: GameState, team: Team, personality: AIPersonality | null): FacilityKey[] {
  const pos = teamPosition(state, team.id);
  const next = divisionAbove(team.division);
  const priorities: FacilityKey[] = [];
  // Contenders prepare for the next division's licence.
  if (next && pos <= 4) {
    for (const [k, lvl] of Object.entries(DIVISIONS[next].licensing.facilities) as [FacilityKey, number][]) {
      if (team.facilities[k].level < lvl) priorities.push(k);
    }
  }
  const byPersonality: Record<AIPersonality, FacilityKey[]> = {
    conservative: ['manufacturing', 'engineering', 'strategy', 'fitness'],
    recruiter: ['simulator', 'fitness', 'engineering', 'scouting'],
    engineering: ['engineering', 'aeroCenter', 'manufacturing', 'simulator'],
    youth: ['trainingAcademy', 'simulator', 'fitness', 'engineering'],
    gambler: ['aeroCenter', 'engineering', 'simulator', 'strategy'],
    obsessive: ['aeroCenter', 'engineering', 'simulator', 'manufacturing'],
  };
  priorities.push(...byPersonality[personality ?? 'conservative']);
  // Then whichever facility is lowest.
  priorities.push(...[...FACILITY_KEYS].sort((a, b) => team.facilities[a].level - team.facilities[b].level));
  return [...new Set(priorities)];
}

export function aiFacilities(state: GameState, team: Team, rng: Rng): void {
  const cfg = cfgOf(team);
  if (!rng.chance(0.18 * cfg.facilityAppetite + 0.04)) return;
  const spare = team.cash - aiCommittedCash(state, team);
  for (const key of facilityPriority(state, team, team.aiPersonality)) {
    const level = team.facilities[key].level;
    if (level >= 10) continue;
    const cost = facilityUpgradeCost(level + 1);
    // Upkeep must remain sustainable for the division.
    const upkeepShare = seasonFacilityUpkeep(team) / DIVISIONS[team.division].typicalBudget;
    if (upkeepShare > 0.1) return;
    if (cost > spare * 0.7) continue;
    if (!canUpgradeFacility(team, key).ok) continue;
    startFacilityUpgrade(state, team.id, key);
    return;
  }
}

export function aiStaff(state: GameState, team: Team, rng: Rng): void {
  for (const role of STAFF_ROLES) {
    const current = team.staff[role];
    const currentRating = staffRating(state, team, role);
    if (current && !rng.chance(0.02)) continue;
    if (!current && !rng.chance(0.35)) continue;
    const budget = DIVISIONS[team.division].typicalBudget * 0.035;
    const options = Object.values(state.staff)
      .filter((s) => !s.retired && s.role === role && !s.contract && s.rating > currentRating + (current ? 6 : -100))
      .filter((s) => staffExpectedSalary(s.rating, team.division) <= budget)
      .sort((a, b) => b.rating - a.rating);
    for (const s of options.slice(0, 3)) {
      const res = hireStaffMember(state, team.id, s.id, roundMoney(staffExpectedSalary(s.rating, team.division) * 1.05), rng.int(1, 3));
      if (res.accepted) break;
      if (res.askingSalary && res.askingSalary <= budget) {
        if (hireStaffMember(state, team.id, s.id, res.askingSalary, 2).accepted) break;
      }
    }
  }
}

/** Financial rescue so AI teams never collapse into a broken state. */
export function aiFinancialSafety(state: GameState, team: Team): void {
  const B = DIVISIONS[team.division].typicalBudget;
  if (team.cash > -B * 0.25) return;
  const key = `rescue:${team.id}:${state.season}`;
  if (state.processed[key]) return;
  state.processed[key] = true;
  const injection = roundMoney(B * 0.35 - team.cash * 0.5);
  postTransaction(state, team, 'investor', injection, 'Rescue investment');
  team.reputation = clamp(team.reputation - 4, 1, 100);
  const rng = Rng.from(state.seed, 'rescue', team.id, state.season);
  team.aiPersonality = rng.pick(['conservative', 'conservative', 'engineering', 'youth'] as AIPersonality[]);
  addNews(state, { category: 'finance', headline: fill(pickTemplate(state, 'rescue', TEMPLATES.rescue), { team: team.name.toUpperCase() }), body: `${team.name} were close to collapse with debts of ${Math.round(-team.cash / 1000)}k before a takeover. The new owners promise a more prudent approach.`, division: team.division, teamIds: [team.id], importance: 1 });
}

/** One week of AI management for one team. */
export function aiWeekly(state: GameState, team: Team): void {
  if (team.isPlayer) return;
  const rng = Rng.from(state.seed, 'ai', team.id, state.season, state.week);
  aiFinancialSafety(state, team);
  if (team.raceDrivers.includes(null)) aiFillSeats(state, team, 3, true);
  if (eventLineup(state, team).some((s) => !s.driverId)) aiEnsureSubstitute(state, team);
  aiRnD(state, team, rng);
  aiFacilities(state, team, rng);
  if (state.week % 3 === 0) aiStaff(state, team, rng);
  aiInSeasonMarket(state, team);
}
