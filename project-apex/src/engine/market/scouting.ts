import { DIVISIONS } from '../config/divisions';
import { postTransaction } from '../finance/ledger';
import { addNews } from '../news/news';
import { stableNoise } from '../rng';
import { playerTeam } from '../selectors';
import { staffRating } from '../staff/staff';
import { scoutingCapacity } from '../team/facilities';
import type { AttributeKey, Driver, GameState } from '../types';
import { assertRule, clamp } from '../util';
import { ATTRIBUTE_KEYS, computeOverall, driverName } from '../drivers/ratings';

/** How well the player knows a driver's true attributes (0-100). */
export function scoutKnowledge(state: GameState, d: Driver): number {
  const team = playerTeam(state);
  if (d.contract?.teamId === team.id || d.futureContract?.teamId === team.id) return 100;
  const known = state.player.scouting[d.id] ?? 0;
  let passive = 10;
  const driverTeam = d.contract ? state.teams[d.contract.teamId] : null;
  if (driverTeam && driverTeam.division === team.division) passive = 40;
  else if (driverTeam) passive = 22;
  else if (d.age <= 17) passive = 5;
  // Racing data accumulates: more starts, better read.
  passive += Math.min(15, d.career.starts * 0.5);
  return clamp(Math.max(known, passive), 0, 100);
}

export interface AttributeEstimate {
  value: number;
  low: number;
  high: number;
  exact: boolean;
}

export function estimateAttribute(state: GameState, d: Driver, key: AttributeKey): AttributeEstimate {
  const knowledge = scoutKnowledge(state, d);
  const truth = d.attributes[key];
  if (knowledge >= 100) return { value: Math.round(truth), low: Math.round(truth), high: Math.round(truth), exact: true };
  const unc = ((100 - knowledge) / 100) * 18;
  const center = truth + stableNoise(state.seed, 'scout', d.id, key) * unc * 0.55;
  return { value: Math.round(clamp(center, 1, 99)), low: Math.round(clamp(center - unc, 1, 99)), high: Math.round(clamp(center + unc, 1, 99)), exact: false };
}

export function estimateOverall(state: GameState, d: Driver): AttributeEstimate {
  const knowledge = scoutKnowledge(state, d);
  const truth = computeOverall(d.attributes);
  if (knowledge >= 100) return { value: truth, low: truth, high: truth, exact: true };
  const unc = ((100 - knowledge) / 100) * 9;
  const center = truth + stableNoise(state.seed, 'scoutOvr', d.id) * unc * 0.5;
  return { value: Math.round(center), low: Math.round(center - unc), high: Math.round(center + unc), exact: false };
}

export function estimatePotential(state: GameState, d: Driver): AttributeEstimate {
  const knowledge = scoutKnowledge(state, d);
  const truth = d.potential;
  if (knowledge >= 90) return { value: truth, low: truth, high: truth, exact: true };
  const unc = ((100 - knowledge) / 100) * 24;
  const center = truth + stableNoise(state.seed, 'scoutPot', d.id) * unc * 0.6;
  const ovr = computeOverall(d.attributes);
  return { value: Math.round(clamp(center, ovr, 99)), low: Math.round(clamp(center - unc, ovr, 99)), high: Math.round(clamp(center + unc, ovr, 99)), exact: false };
}

export function estimateAll(state: GameState, d: Driver): Record<AttributeKey, AttributeEstimate> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, estimateAttribute(state, d, k)])) as Record<AttributeKey, AttributeEstimate>;
}

export function scoutingWeeks(state: GameState): number {
  const team = playerTeam(state);
  const scout = staffRating(state, team, 'headScout');
  return Math.round(clamp(4.2 - scout / 40 - team.facilities.scouting.level / 5, 1, 4));
}

export function scoutingWeeklyCost(state: GameState): number {
  return DIVISIONS[playerTeam(state).division].scoutingCostPerWeek;
}

export function startScouting(state: GameState, driverId: string): void {
  const team = playerTeam(state);
  const d = state.drivers[driverId];
  assertRule(d && !d.retired, 'Unknown driver.');
  assertRule(scoutKnowledge(state, d) < 100, `${driverName(d)} is already fully scouted.`);
  assertRule(!state.player.scoutAssignments.some((a) => a.targetId === driverId), 'Already scouting this driver.');
  assertRule(state.player.scoutAssignments.length < scoutingCapacity(team), `Your scouting department can only run ${scoutingCapacity(team)} assignment(s) at once.`);
  const weeks = scoutingWeeks(state);
  state.player.scoutAssignments.push({ targetId: driverId, targetType: 'driver', weeksRemaining: weeks, weeksTotal: weeks });
}

export function cancelScouting(state: GameState, driverId: string): void {
  state.player.scoutAssignments = state.player.scoutAssignments.filter((a) => a.targetId !== driverId);
}

/** Weekly scouting progress for the player. */
export function progressScouting(state: GameState): void {
  const team = playerTeam(state);
  if (state.player.scoutAssignments.length === 0) return;
  postTransaction(state, team, 'scouting', -scoutingWeeklyCost(state) * state.player.scoutAssignments.length, 'Scouting assignments');
  const scout = staffRating(state, team, 'headScout');
  const finished: string[] = [];
  for (const a of state.player.scoutAssignments) {
    a.weeksRemaining -= 1;
    if (a.weeksRemaining > 0) continue;
    const d = state.drivers[a.targetId];
    if (!d) continue;
    const gain = 35 + scout / 2 + team.facilities.scouting.level * 3;
    state.player.scouting[d.id] = clamp(scoutKnowledge(state, d) + gain, 0, 100);
    finished.push(d.id);
    const pot = estimatePotential(state, d);
    addNews(state, {
      category: 'academy',
      headline: `SCOUTING REPORT: ${driverName(d).toUpperCase()}`,
      body: `Our scouts have completed their assessment of ${driverName(d)} (${d.age}). Estimated rating ${estimateOverall(state, d).value}, potential ${pot.exact ? pot.value : `${pot.low}–${pot.high}`}.`,
      driverIds: [d.id],
      teamIds: [team.id],
      importance: 2,
    });
  }
  state.player.scoutAssignments = state.player.scoutAssignments.filter((a) => !finished.includes(a.targetId));
}
