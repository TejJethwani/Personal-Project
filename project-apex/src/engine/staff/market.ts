import { DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { postTransaction } from '../finance/ledger';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import { currentAbsWeek } from '../season/calendar';
import type { GameState, StaffMember, Team } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { STAFF_ROLE_INFO, staffExpectedSalary, staffName } from './staff';

export interface StaffOfferResult {
  accepted: boolean;
  message: string;
  askingSalary?: number;
  fee: number;
}

export function staffBuyoutFee(state: GameState, s: StaffMember): number {
  if (!s.contract) return 0;
  const seasonsLeft = Math.max(0, s.contract.endSeason - state.season) + (state.phase === 'season' ? Math.max(0, 1 - state.week / 44) : 1);
  return roundMoney(s.contract.salary * seasonsLeft * 0.9);
}

function staffUtility(state: GameState, team: Team, s: StaffMember, salary: number): number {
  const expected = staffExpectedSalary(s.rating, team.division) * (team.isPlayer ? DIFFICULTIES[state.settings.difficulty].salaryDemand : 1);
  let u = Math.log(Math.max(1, salary) / expected) * 1.4;
  const current = s.contract ? state.teams[s.contract.teamId] : null;
  if (current && current.id !== team.id) {
    u -= 0.15 + (current.reputation - team.reputation) / 45;
    u -= (DIVISIONS[current.division].tier - DIVISIONS[team.division].tier) * 0.35;
  } else {
    // Ambitious staff look for a step up in level.
    const levelFor = s.rating >= 80 ? 4 : s.rating >= 68 ? 3 : s.rating >= 56 ? 2 : s.rating >= 44 ? 1 : 0;
    u -= Math.max(0, levelFor - DIVISIONS[team.division].tier) * 0.35;
    u += (team.reputation - DIVISIONS[team.division].typicalReputation) / 80;
  }
  return u;
}

export function hireStaffMember(state: GameState, teamId: string, staffId: string, salary: number, years: number): StaffOfferResult {
  const team = state.teams[teamId];
  const s = state.staff[staffId];
  assertRule(team && s && !s.retired, 'Unknown staff member.');
  assertRule(years >= 1 && years <= 4 && Number.isInteger(years), 'Staff contracts run 1-4 seasons.');
  assertRule(salary > 0, 'Salary must be positive.');
  assertRule(s.contract?.teamId !== team.id, `${staffName(s)} already works for you.`);
  assertRule(state.phase !== 'seasonReview' && state.phase !== 'gameOver', 'The staff market is closed right now.');
  const fee = staffBuyoutFee(state, s);
  if (fee > 0) assertRule(team.cash >= fee, 'Not enough cash for the release fee.');
  const rng = Rng.from(state.seed, 'staffMood', s.id, team.id, currentAbsWeek(state));
  const u = staffUtility(state, team, s, salary) + rng.normal(0, 0.04);
  if (u < 0) {
    const ask = roundMoney(salary * Math.exp((-u + 0.03) / 1.4));
    const expected = staffExpectedSalary(s.rating, team.division);
    if (ask > expected * 3) return { accepted: false, message: `${staffName(s)} is not interested in joining ${team.name}.`, fee };
    return { accepted: false, message: `${staffName(s)} would join for ${ask.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per season.`, askingSalary: ask, fee };
  }
  // Execute: pay release fee, replace current holder of the role.
  const old = s.contract ? state.teams[s.contract.teamId] : null;
  if (old && fee > 0) {
    postTransaction(state, team, 'buyout', -fee, `Release fee: ${staffName(s)}`);
    postTransaction(state, old, 'transferIncome', fee, `Staff sold: ${staffName(s)}`);
  }
  if (old) old.staff[s.role] = null;
  const incumbentId = team.staff[s.role];
  if (incumbentId) fireStaff(state, teamId, incumbentId, true);
  s.contract = { teamId: team.id, salary: roundMoney(salary), startSeason: state.season, endSeason: state.season + years - 1 };
  s.history.push({ season: state.season, teamId: team.id, division: team.division });
  team.staff[s.role] = s.id;
  if (team.isPlayer) {
    addNews(state, { category: 'transfer', headline: `${team.name.toUpperCase()} APPOINT ${staffName(s).toUpperCase()}`, body: `${staffName(s)} (rating ${s.rating}, ${s.specialization}) joins as ${STAFF_ROLE_INFO[s.role].label}${old ? ` from ${old.name}` : ''}.`, teamIds: [team.id], importance: 2 });
  }
  return { accepted: true, message: `${staffName(s)} joins ${team.name} as ${STAFF_ROLE_INFO[s.role].label}.`, fee };
}

export function fireStaff(state: GameState, teamId: string, staffId: string, replaced = false): number {
  const team = state.teams[teamId];
  const s = state.staff[staffId];
  assertRule(team && s && s.contract?.teamId === team.id, 'That person does not work for this team.');
  const seasonsLeft = Math.max(0, s.contract.endSeason - state.season) + (state.phase === 'season' ? Math.max(0, 1 - state.week / 44) : 1);
  const factor = team.isPlayer ? DIFFICULTIES[state.settings.difficulty].severance : 0.5;
  const cost = roundMoney(s.contract.salary * seasonsLeft * factor);
  if (cost > 0) postTransaction(state, team, 'severance', -cost, `Severance: ${staffName(s)}`);
  team.staff[s.role] = null;
  s.contract = null;
  if (team.isPlayer && !replaced) addNews(state, { category: 'transfer', headline: `${staffName(s).toUpperCase()} LEAVES ${team.name.toUpperCase()}`, body: `${STAFF_ROLE_INFO[s.role].label} ${staffName(s)} has left the team.`, teamIds: [team.id], importance: 1 });
  return cost;
}

export function extendStaff(state: GameState, teamId: string, staffId: string, salary: number, years: number): StaffOfferResult {
  const team = state.teams[teamId];
  const s = state.staff[staffId];
  assertRule(team && s && s.contract?.teamId === team.id, 'That person does not work for this team.');
  assertRule(years >= 1 && years <= 4, 'Staff contracts run 1-4 seasons.');
  const expected = staffExpectedSalary(s.rating, team.division) * (team.isPlayer ? DIFFICULTIES[state.settings.difficulty].salaryDemand : 1);
  const u = Math.log(salary / expected) * 1.4 + 0.25;
  if (u < 0) {
    const ask = roundMoney(salary * Math.exp((-u + 0.03) / 1.4));
    return { accepted: false, message: `${staffName(s)} asks for ${ask.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per season.`, askingSalary: ask, fee: 0 };
  }
  s.contract = { teamId, salary: roundMoney(salary), startSeason: s.contract.startSeason, endSeason: Math.max(s.contract.endSeason, state.season) + years };
  return { accepted: true, message: `${staffName(s)} extends until the end of season ${s.contract.endSeason}.`, fee: 0 };
}

/** Season-end staff ageing, small rating drift and retirements. */
export function ageStaff(state: GameState): void {
  for (const s of Object.values(state.staff)) {
    if (s.retired) continue;
    s.age += 1;
    const rng = Rng.from(state.seed, 'staffAge', s.id, state.season);
    s.experience = clamp(s.experience + rng.range(1, 3), 1, 99);
    if (s.age < 45) s.rating = clamp(s.rating + rng.range(-0.5, 2), 10, 97);
    else if (s.age > 60) s.rating = clamp(s.rating - rng.range(0, 2), 10, 97);
    s.rating = Math.round(s.rating);
    if (s.age >= 66 || (s.age >= 60 && rng.chance(0.25)) || (!s.contract && s.age >= 55 && rng.chance(0.3))) {
      s.retired = true;
      if (s.contract) {
        const team = state.teams[s.contract.teamId];
        if (team) team.staff[s.role] = null;
        if (team?.isPlayer) addNews(state, { category: 'transfer', headline: `${staffName(s).toUpperCase()} RETIRES`, body: `${STAFF_ROLE_INFO[s.role].label} ${staffName(s)} has retired at ${s.age}. The role is now vacant.`, teamIds: [team.id], importance: 2 });
        s.contract = null;
      }
    }
  }
}
