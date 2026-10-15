import { DIFFICULTIES, PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { teamStaffSalaries } from '../staff/staff';
import { seasonFacilityUpkeep } from '../team/facilities';
import type { Driver, GameState, Team } from '../types';
import { postTransaction } from './ledger';
import { aiSponsorIncomePerRace, projectedPosition } from './sponsors';

const W = ECONOMY_TUNING.weeksPerSeason;

export function contractedDrivers(state: GameState, team: Team): Driver[] {
  return Object.values(state.drivers).filter((d) => !d.retired && d.contract?.teamId === team.id);
}

export function seasonDriverSalaries(state: GameState, team: Team): number {
  return contractedDrivers(state, team)
    .filter((d) => d.contract!.role !== 'academy')
    .reduce((s, d) => s + d.contract!.salary, 0);
}

export function seasonAcademyCost(_state: GameState, team: Team): number {
  return team.academyDriverIds.length * DIVISIONS[team.division].academyCostPerDriver;
}

/** Weekly running costs: salaries, facility upkeep, academy, overdraft interest. */
export function applyWeeklyFinances(state: GameState, team: Team): void {
  const driverSalaries = seasonDriverSalaries(state, team) / W;
  const staff = teamStaffSalaries(state, team) / W;
  const upkeep = seasonFacilityUpkeep(team, state) / W;
  const academy = seasonAcademyCost(state, team) / W;
  if (driverSalaries > 0) postTransaction(state, team, 'driverSalary', -driverSalaries, 'Driver salaries');
  if (staff > 0) postTransaction(state, team, 'staffSalary', -staff, 'Staff salaries');
  postTransaction(state, team, 'facilities', -upkeep, 'Facility upkeep');
  if (academy > 0) postTransaction(state, team, 'academy', -academy, 'Academy programme');
  if (team.cash < 0) postTransaction(state, team, 'interest', team.cash * ECONOMY_TUNING.overdraftInterest, 'Overdraft interest');
}

export function chargeEntryFee(state: GameState, team: Team): void {
  const fee = DIVISIONS[team.division].entryFee * (team.isPlayer ? PHILOSOPHIES[state.player.philosophy].operatingCosts : 1);
  postTransaction(state, team, 'entry', -fee, `${DIVISIONS[team.division].name} entry & licence`);
}

export interface FinanceForecast {
  weeksRemaining: number;
  racesRemaining: number;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedEndCash: number;
  weeklyBurn: number;
  breakdown: { label: string; amount: number }[];
  obligations: { season: number; drivers: number; staff: number }[];
}

/** Projection to the end of the season from current commitments. */
export function financialForecast(state: GameState, team: Team): FinanceForecast {
  const cfg = DIVISIONS[team.division];
  const inSeason = state.phase === 'season' || state.phase === 'weekend';
  const weeksRemaining = inSeason ? Math.max(0, W - state.week) : W;
  const racesRemaining = state.calendars[team.division].filter((e) => !e.completed).length;
  const drivers = seasonDriverSalaries(state, team);
  const staff = teamStaffSalaries(state, team);
  const upkeep = seasonFacilityUpkeep(team, state);
  const academy = seasonAcademyCost(state, team);
  const weeklyBurn = (drivers + staff + upkeep + academy) / W;
  const ops = cfg.raceOperationsCost * racesRemaining * (team.isPlayer ? PHILOSOPHIES[state.player.philosophy].operatingCosts : 1);
  let sponsor = 0;
  if (team.isPlayer) {
    for (const d of team.sponsors) if (d.startSeason <= state.season && d.endSeason >= state.season) sponsor += d.perRace * racesRemaining;
  } else sponsor = aiSponsorIncomePerRace(state, team) * racesRemaining;
  const pos = projectedPosition(state, team);
  const prize = cfg.prizeMoney[pos - 1] ?? 0;
  const racePrize = racesRemaining * (cfg.racePrize[Math.max(0, pos - 1)] ?? 0) * 1.5;
  const backing = contractedDrivers(state, team).filter((d) => team.raceDrivers.includes(d.id)).reduce((s, d) => s + (d.backing * racesRemaining) / cfg.races, 0);
  const entry = inSeason ? 0 : cfg.entryFee;
  const projectedExpenses = weeklyBurn * weeksRemaining + ops + entry;
  const projectedRevenue = sponsor + prize + racePrize + backing;
  const obligations: FinanceForecast['obligations'] = [];
  for (let s = state.season; s < state.season + 4; s++) {
    let dSum = 0;
    for (const d of contractedDrivers(state, team)) {
      const c = d.contract!;
      if (c.role !== 'academy' && c.startSeason <= s && c.endSeason >= s) dSum += c.salary;
    }
    for (const d of Object.values(state.drivers)) {
      const c = d.futureContract;
      if (c && c.teamId === team.id && c.startSeason <= s && c.endSeason >= s) dSum += c.salary;
    }
    let sSum = 0;
    for (const st of Object.values(state.staff)) {
      const c = st.contract;
      if (c && c.teamId === team.id && c.startSeason <= s && c.endSeason >= s) sSum += c.salary;
    }
    obligations.push({ season: s, drivers: dSum, staff: sSum });
  }
  return {
    weeksRemaining,
    racesRemaining,
    projectedRevenue,
    projectedExpenses,
    projectedEndCash: team.cash + projectedRevenue - projectedExpenses,
    weeklyBurn,
    breakdown: [
      { label: 'Sponsorship (contracted)', amount: sponsor },
      { label: 'Prize money (projected)', amount: prize + racePrize },
      { label: 'Driver backing', amount: backing },
      { label: 'Salaries & upkeep', amount: -weeklyBurn * weeksRemaining },
      { label: 'Race operations', amount: -ops },
      ...(entry ? [{ label: 'Entry fee', amount: -entry }] : []),
    ],
    obligations,
  };
}

/** Overdraft limit before a financial crisis triggers. */
export function overdraftLimit(state: GameState, team: Team): number {
  return -DIVISIONS[team.division].typicalBudget * DIFFICULTIES[state.settings.difficulty].overdraftLimit;
}
