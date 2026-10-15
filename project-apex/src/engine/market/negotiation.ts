import { DIFFICULTIES, PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { aspirationTier, expectedSalary, overall } from '../drivers/ratings';
import { projectedPosition } from '../finance/sponsors';
import { Rng } from '../rng';
import { currentAbsWeek } from '../season/calendar';
import { staffRating } from '../staff/staff';
import type { Driver, DriverOffer, GameState, NegotiationMemory, Team } from '../types';
import { clamp, roundMoney } from '../util';

export interface UtilityFactor {
  label: string;
  value: number;
}

export interface OfferEvaluation {
  response: 'accept' | 'counter' | 'reject' | 'refuseTalks';
  utility: number;
  required: number;
  message: string;
  factors: UtilityFactor[];
  counter?: { salary: number; years: number; status?: DriverOffer['status'] };
}

function salaryWeight(d: Driver): number {
  switch (d.personality) {
    case 'mercenary':
      return 1.6;
    case 'ambitious':
      return 0.95;
    case 'loyal':
      return 1.0;
    default:
      return 1.2;
  }
}

function preferredYears(d: Driver): number {
  const ovr = overall(d);
  if (d.age <= 22 && d.potential - ovr > 8) return 2;
  if (d.age >= 32) return 3;
  return 2.5;
}

/** Expected salary for a role (reserves earn less, academy drivers are funded by the team). */
export function roleExpectedSalary(state: GameState, d: Driver, team: Team, role: DriverOffer['role']): number {
  const mult = team.isPlayer ? DIFFICULTIES[state.settings.difficulty].salaryDemand : 1;
  const base = expectedSalary(d, team.division, mult);
  if (role === 'reserve') return roundMoney(base * 0.42);
  if (role === 'academy') return 0;
  return base;
}

/** Utility a driver gets from an offer by a team (higher is better). */
export function offerUtility(state: GameState, team: Team, d: Driver, offer: DriverOffer): { utility: number; factors: UtilityFactor[] } {
  const factors: UtilityFactor[] = [];
  const cfg = DIVISIONS[team.division];
  const ovr = overall(d);
  const isCurrent = d.contract?.teamId === team.id;

  if (offer.role === 'academy') {
    // Prospects care about the pathway and the facilities more than money.
    const pathway = (team.facilities.trainingAcademy.level - 3) * 0.18 + (team.reputation - 20) / 60;
    factors.push({ label: 'Academy programme', value: pathway });
    const tierLure = cfg.tier * 0.12;
    factors.push({ label: 'Team status', value: tierLure });
    return { utility: pathway + tierLure + 0.3, factors };
  }

  const expected = roleExpectedSalary(state, d, team, offer.role);
  const projected = projectedPosition(state, team);
  const expWins = Math.max(0, (4 - projected) / 3) * cfg.races * 0.15;
  const expPodiums = Math.max(0, (7 - projected) / 6) * cfg.races * 0.25;
  const comp = offer.salary + offer.signingBonus / Math.max(1, offer.years) + offer.winBonus * expWins * 0.7 + offer.podiumBonus * expPodiums * 0.7;
  const salaryScore = salaryWeight(d) * Math.log(Math.max(1, comp) / Math.max(1, expected));
  factors.push({ label: 'Salary package', value: salaryScore });

  const gap = aspirationTier(d) - cfg.tier;
  let divisionScore = 0;
  if (gap > 0) {
    let mult = 1.15;
    if (d.personality === 'ambitious') mult *= 1.4;
    if (d.age <= 21) mult *= 0.6; // young drivers expect to climb the ladder step by step
    if (d.age >= 32) mult *= 0.6;
    // One level below their ambition is a compromise; several levels is unthinkable.
    divisionScore = -gap * (0.5 + 0.28 * gap) * mult;
  } else if (gap < 0) {
    divisionScore = Math.min(1.2, -gap * 0.45);
  }
  factors.push({ label: `Racing in ${cfg.name}`, value: divisionScore });

  const competitiveness = (5.5 - projected) * 0.12;
  factors.push({ label: 'Team competitiveness', value: competitiveness });
  const reputation = clamp(((team.reputation - cfg.typicalReputation) / cfg.typicalReputation) * 0.3, -0.4, 0.4);
  factors.push({ label: 'Team reputation', value: reputation });

  let role = 0;
  if (offer.role === 'race') {
    const statusMult = d.personality === 'ambitious' ? 1.5 : d.personality === 'teamPlayer' ? 0.5 : 1;
    role = offer.status === 'number1' ? 0.35 : offer.status === 'number2' ? -0.3 * statusMult : 0;
  } else if (offer.role === 'reserve') {
    const weak = ovr < cfg.driverRatingMean - 5 || d.age >= 33;
    role = weak ? -0.35 : -0.85;
    // Without a drive, a paid reserve role keeps a career alive.
    if (!d.contract) role *= 0.6;
  }
  factors.push({ label: offer.role === 'reserve' ? 'Reserve role' : 'Driver status', value: role });

  let length = -Math.abs(offer.years - preferredYears(d)) * 0.1;
  if (gap > 0 && offer.years > 1) length -= (offer.years - 1) * 0.15;
  factors.push({ label: 'Contract length', value: length });

  let development = 0;
  if (d.age <= 24) {
    development = ((team.facilities.simulator.level + team.facilities.fitness.level) / 2 - 4) / 10 * 0.4 + (staffRating(state, team, 'driverCoach') - 50) / 100 * 0.3;
  }
  factors.push({ label: 'Development opportunities', value: development });

  let loyalty = 0;
  if (isCurrent) {
    loyalty = (d.personality === 'loyal' ? 0.6 : d.personality === 'teamPlayer' ? 0.3 : 0.15) + ((d.morale - 50) / 50) * 0.5;
    if (d.contract?.role === 'academy' || d.transfers.some((t) => t.type === 'academy' && t.toTeamId === team.id)) loyalty += 0.6;
  }
  factors.push({ label: 'Loyalty', value: loyalty });

  let philosophy = 0;
  if (team.isPlayer) {
    const p = PHILOSOPHIES[state.player.philosophy];
    if (d.age <= 23) philosophy += p.youngDriverAppeal;
    if (d.age >= 30) philosophy += p.veteranAppeal;
    if (d.attributes.aggression >= 70) philosophy += p.aggressiveAppeal;
  }
  if (philosophy !== 0) factors.push({ label: 'Team philosophy', value: philosophy });

  const utility = factors.reduce((s, f) => s + f.value, 0);
  return { utility, factors };
}

/** What a driver would need to beat to move. */
export function reservationUtility(state: GameState, team: Team, d: Driver, offer: DriverOffer): number {
  const ownTeam = d.contract ? state.teams[d.contract.teamId] : null;
  const expiringNow = !d.contract || (d.contract.endSeason <= state.season && (offer.startNextSeason || state.phase === 'offseason'));
  if (ownTeam && ownTeam.id !== team.id && !expiringNow) {
    // Under contract elsewhere: compare with staying put.
    const stay: DriverOffer = { driverId: d.id, role: d.contract!.role, salary: d.contract!.salary, years: Math.max(1, d.contract!.endSeason - state.season + 1), signingBonus: 0, winBonus: d.contract!.winBonus, podiumBonus: d.contract!.podiumBonus, status: d.contract!.status, startNextSeason: false };
    return offerUtility(state, ownTeam, d, stay).utility + 0.15;
  }
  let base = -0.15;
  if (!d.contract) base = state.phase === 'season' ? -0.45 : -0.3;
  if (state.phase === 'preseason' && !d.contract) base = -0.6;
  const alt = bestAlternativeUtility(state, team, d);
  return Math.max(base, alt);
}

/**
 * Estimate the best offer the driver could get elsewhere: AI teams with an open
 * or expiring seat that rate the driver highly enough.
 */
export function bestAlternativeUtility(state: GameState, excluding: Team, d: Driver): number {
  if (d.contract?.role === 'academy') return -1;
  const ovr = overall(d);
  let best = -Infinity;
  const nextSeason = state.phase === 'season' ? state.season + 1 : state.season;
  for (const team of Object.values(state.teams)) {
    if (team.id === excluding.id || team.isPlayer) continue;
    const seats = team.raceDrivers.map((id) => (id ? state.drivers[id] : null));
    const openSeat = seats.some((s) => !s || (s.contract && s.contract.endSeason < nextSeason && !s.futureContract));
    if (!openSeat) continue;
    const weakest = Math.min(...seats.map((s) => (s ? overall(s) : 0)));
    if (ovr < weakest - 1 && seats.every((s) => !!s)) continue;
    const salary = expectedSalary(d, team.division);
    if (salary > Math.max(team.cash, 0) * 0.3 + DIVISIONS[team.division].typicalBudget * 0.04) continue;
    const u = offerUtility(state, team, d, { driverId: d.id, role: 'race', salary, years: 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: state.phase === 'season' }).utility;
    if (u > best) best = u;
  }
  return best === -Infinity ? -Infinity : best * 0.85;
}

function memoryKey(teamId: string, driverId: string): string {
  return `${teamId}:${driverId}`;
}

export function negotiationMemory(state: GameState, teamId: string, driverId: string): NegotiationMemory {
  return state.player.negotiations[memoryKey(teamId, driverId)] ?? { attempts: 0, blockedUntil: -1e9, lastResponse: null, askingSalary: null, lastAbsWeek: -1e9 };
}

function mainObjection(factors: UtilityFactor[], d: Driver, team: Team): string {
  const worst = [...factors].sort((a, b) => a.value - b.value)[0];
  if (!worst || worst.value > -0.2) return `${d.firstName} ${d.lastName} feels the overall package is not right.`;
  if (worst.label.startsWith('Racing in')) return `${d.lastName} has no interest in racing in ${DIVISIONS[team.division].name} at this stage of their career.`;
  if (worst.label === 'Salary package') return `${d.lastName}'s agent says the salary is far below their client's market value.`;
  if (worst.label === 'Driver status') return `${d.lastName} will not accept number-two status.`;
  if (worst.label === 'Reserve role') return `${d.lastName} wants a race seat, not a reserve role.`;
  if (worst.label === 'Team competitiveness') return `${d.lastName} does not believe ${team.name} can compete.`;
  if (worst.label === 'Contract length') return `${d.lastName} is unhappy with the contract length.`;
  return `${d.lastName} is not convinced by the project.`;
}

/**
 * Evaluate an offer. Deterministic for the same state and offer, so repeatedly
 * clicking "sign" cannot reroll a refusal.
 */
export function evaluateDriverOffer(state: GameState, team: Team, d: Driver, offer: DriverOffer, recordMemory = true): OfferEvaluation {
  const now = currentAbsWeek(state);
  const mem = negotiationMemory(state, team.id, d.id);
  if (team.isPlayer && mem.blockedUntil > now) {
    return { response: 'refuseTalks', utility: 0, required: 0, factors: [], message: `${d.firstName} ${d.lastName}'s agent refuses to reopen talks for another ${mem.blockedUntil - now} week(s).` };
  }
  const { utility, factors } = offerUtility(state, team, d, offer);
  let required = reservationUtility(state, team, d, offer);
  // Small deterministic mood swing per week so talks are not perfectly mechanical.
  required += Rng.from(state.seed, 'mood', d.id, team.id, now).normal(0, 0.05);
  const eval0: OfferEvaluation = { response: 'reject', utility, required, factors, message: '' };
  if (utility >= required) {
    eval0.response = 'accept';
    eval0.message = `${d.firstName} ${d.lastName} accepts the offer!`;
  } else {
    const gap = required - utility;
    const w = salaryWeight(d);
    const neededSalary = roundMoney(offer.salary * Math.exp((gap + 0.05) / w));
    const expected = roleExpectedSalary(state, d, team, offer.role);
    const statusFixable = offer.role === 'race' && offer.status === 'number2' && gap < 0.45;
    if (gap < 2 && neededSalary < Math.max(expected * 4.5, offer.salary * 1.8)) {
      eval0.response = 'counter';
      eval0.counter = statusFixable ? { salary: offer.salary, years: offer.years, status: 'equal' } : { salary: neededSalary, years: offer.years };
      eval0.message = statusFixable
        ? `${d.lastName} would sign with equal status in the team.`
        : `${d.lastName}'s agent asks for ${formatMoneyPlain(neededSalary)} per season.`;
    } else {
      eval0.response = 'reject';
      eval0.message = mainObjection(factors, d, team);
    }
  }
  if (team.isPlayer && recordMemory) {
    const key = memoryKey(team.id, d.id);
    const next: NegotiationMemory = { ...mem };
    if (now - mem.lastAbsWeek > 8) next.attempts = 0;
    if (eval0.response !== 'accept') {
      next.attempts += required - utility > 1.2 ? 2 : 1;
      if (next.attempts >= 4) {
        next.blockedUntil = now + 6;
        next.attempts = 0;
        eval0.message += ' Talks have broken down: no further negotiation for 6 weeks.';
      }
    } else next.attempts = 0;
    next.lastResponse = eval0.message;
    next.askingSalary = eval0.counter?.salary ?? null;
    next.lastAbsWeek = now;
    state.player.negotiations[key] = next;
  }
  return eval0;
}

export function formatMoneyPlain(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}
