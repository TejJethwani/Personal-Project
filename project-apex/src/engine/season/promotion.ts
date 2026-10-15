import { divisionAbove, divisionBelow, DIVISIONS } from '../config/divisions';
import { divisionStandings } from '../championship/standings';
import { fullStaff } from '../staff/staff';
import { FACILITY_INFO } from '../team/facilities';
import type { DivisionId, FacilityKey, GameState, Team } from '../types';
import { DIVISION_ORDER } from '../types';

export interface LicenceCheck {
  label: string;
  met: boolean;
  detail: string;
}

/** Transparent licensing requirements for entering `target`. */
export function licensingChecks(_state: GameState, team: Team, target: DivisionId): LicenceCheck[] {
  const lic = DIVISIONS[target].licensing;
  const checks: LicenceCheck[] = [];
  checks.push({ label: 'Solvent (no debt)', met: team.cash >= 0, detail: `Bank balance must not be negative` });
  if (lic.minCash > 0) checks.push({ label: `Cash reserve of $${(lic.minCash / 1_000_000).toFixed(lic.minCash >= 1_000_000 ? 1 : 2)}M`, met: team.cash >= lic.minCash, detail: 'Proof of funds for the higher series' });
  for (const [k, lvl] of Object.entries(lic.facilities) as [FacilityKey, number][]) {
    checks.push({ label: `${FACILITY_INFO[k].label} level ${lvl}`, met: team.facilities[k].level >= lvl, detail: `Currently level ${team.facilities[k].level}` });
  }
  if (lic.fullStaff) checks.push({ label: 'Full senior staff', met: fullStaff(team), detail: 'All seven key roles filled' });
  if (lic.minReputation > 0) checks.push({ label: `Reputation ${lic.minReputation}+`, met: team.reputation >= lic.minReputation, detail: `Currently ${Math.round(team.reputation)}` });
  return checks;
}

export function isEligible(state: GameState, team: Team, target: DivisionId): boolean {
  return licensingChecks(state, team, target).every((c) => c.met);
}

export interface PromotionRow {
  teamId: string;
  position: number;
  points: number;
  eligible: boolean;
  checks: LicenceCheck[];
  status: 'promotion' | 'contender' | 'relegation' | 'safe';
}

/** Live promotion/relegation picture for a division. */
export function promotionPicture(state: GameState, division: DivisionId, excludeTeamId?: string): PromotionRow[] {
  const { constructors } = divisionStandings(state, division);
  const up = divisionAbove(division);
  const down = divisionBelow(division);
  const rows: PromotionRow[] = constructors.map((r, i) => {
    const team = state.teams[r.id];
    const checks = up ? licensingChecks(state, team, up) : [];
    return { teamId: r.id, position: i + 1, points: r.points, eligible: up ? checks.every((c) => c.met) : false, checks, status: 'safe' };
  });
  if (up) {
    let slots = DIVISIONS[division].promotionSlots;
    for (const row of rows.slice(0, 4)) {
      if (slots <= 0) break;
      if (row.eligible && row.teamId !== excludeTeamId) {
        row.status = 'promotion';
        slots--;
      } else row.status = 'contender';
    }
  }
  if (down) {
    const promotedFromBelow = projectedPromotionsFrom(state, down);
    const n = Math.min(DIVISIONS[division].relegationSlots, promotedFromBelow);
    for (const row of rows.slice(rows.length - n)) row.status = 'relegation';
  }
  return rows;
}

function projectedPromotionsFrom(state: GameState, division: DivisionId): number {
  const { constructors } = divisionStandings(state, division);
  const up = divisionAbove(division)!;
  let count = 0;
  for (const r of constructors.slice(0, 4)) {
    if (count >= DIVISIONS[division].promotionSlots) break;
    if (isEligible(state, state.teams[r.id], up)) count++;
  }
  return count;
}

export interface DivisionMove {
  teamId: string;
  from: DivisionId;
  to: DivisionId;
}

/**
 * Decide promotions and relegations from final standings. Promoted counts
 * equal relegated counts between each pair of divisions, keeping every
 * championship at ten teams. A team that declines promotion is skipped.
 * `licensed` teams count as eligible: a licence granted at season end stands
 * through the review, whatever the team spends afterwards.
 */
export function computeDivisionMoves(state: GameState, declined: string[] = [], licensed: string[] = []): { promotions: DivisionMove[]; relegations: DivisionMove[] } {
  const promotions: DivisionMove[] = [];
  const relegations: DivisionMove[] = [];
  for (const division of DIVISION_ORDER) {
    const up = divisionAbove(division);
    if (!up) continue;
    const { constructors } = divisionStandings(state, division);
    const promoted: string[] = [];
    for (const r of constructors.slice(0, 4)) {
      if (promoted.length >= DIVISIONS[division].promotionSlots) break;
      if (declined.includes(r.id)) continue;
      if (licensed.includes(r.id) || isEligible(state, state.teams[r.id], up)) promoted.push(r.id);
    }
    const above = divisionStandings(state, up).constructors;
    const n = Math.min(promoted.length, DIVISIONS[up].relegationSlots);
    const relegated = above.slice(above.length - n).map((r) => r.id);
    for (const id of promoted.slice(0, n)) promotions.push({ teamId: id, from: division, to: up });
    for (const id of relegated) relegations.push({ teamId: id, from: up, to: division });
  }
  return { promotions, relegations };
}
