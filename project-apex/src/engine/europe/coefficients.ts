import type { ContinentalCompetition, EuroClub, GameState } from '../types';

/**
 * Coefficients rank associations (European places) and clubs (seeding).
 * A club earns points for every continental race weekend: 2 for a win, 1 for
 * a draw in the league phase, half a point per qualifying tie won, a bonus
 * for each knockout round reached, more for the title. Competitions are
 * weighted by prestige. An association's season coefficient is the average
 * over its entrants; rankings use the sum of the last five seasons.
 */

const WEIGHT: Record<ContinentalCompetition, number> = { CL: 1, EL: 0.75, ECL: 0.5 };
const PARTICIPATION: Record<ContinentalCompetition, number> = { CL: 4, EL: 1.5, ECL: 0.75 };
const STAGE_BONUS: Record<string, number> = { r16: 2, qf: 1.5, sf: 1.5, final: 1.5 };
const TITLE_BONUS = 2.5;

export const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

export function associationScore(state: GameState, assocId: string): number {
  return sum(state.europe!.associations[assocId]?.coef ?? []);
}

/** Associations by five-year coefficient, best first. */
export function associationRanking(state: GameState): string[] {
  const assocs = Object.values(state.europe!.associations);
  return assocs.sort((a, b) => sum(b.coef) - sum(a.coef) || a.id.localeCompare(b.id)).map((a) => a.id);
}

/** Club coefficient: five-season points, with a floor of a fifth of its association's. */
export function clubCoefficient(state: GameState, club: EuroClub): number {
  return Math.max(sum(club.coef), associationScore(state, club.assocId) * 0.2);
}

/** Coefficient points each club earned in Europe this season. */
export function seasonClubPoints(state: GameState): Record<string, { points: number; competition: ContinentalCompetition }> {
  const europe = state.europe!;
  const out: Record<string, { points: number; competition: ContinentalCompetition }> = {};
  const add = (clubId: string, comp: ContinentalCompetition, pts: number) => {
    const row = (out[clubId] ??= { points: 0, competition: comp });
    // A club's season counts in its strongest competition.
    if (WEIGHT[comp] > WEIGHT[row.competition]) row.competition = comp;
    row.points += pts * WEIGHT[comp];
  };
  for (const comp of Object.values(europe.continental)) {
    if (!comp) continue;
    for (const id of [...comp.direct, ...comp.qualifyingPool]) add(id, comp.id, 0);
    for (const id of comp.teams) add(id, comp.id, PARTICIPATION[comp.id]);
    for (const round of comp.qualifyingRounds) {
      for (const tieId of round) {
        const tie = europe.ties[tieId];
        if (tie?.winner) add(tie.winner, comp.id, 0.5);
      }
    }
    for (const fxId of comp.fixtures) {
      const fx = europe.fixtures[fxId];
      if (!fx?.result) continue;
      if (fx.result.home > fx.result.away) add(fx.home, comp.id, 2);
      else if (fx.result.away > fx.result.home) add(fx.away, comp.id, 2);
      else {
        add(fx.home, comp.id, 1);
        add(fx.away, comp.id, 1);
      }
    }
    for (const stage of ['r16', 'qf', 'sf', 'final'] as const) {
      for (const tieId of comp.knockout[stage]) {
        const tie = europe.ties[tieId];
        if (!tie) continue;
        add(tie.home, comp.id, STAGE_BONUS[stage]);
        add(tie.away, comp.id, STAGE_BONUS[stage]);
      }
    }
    for (const stage of ['playoff', 'r16', 'qf', 'sf', 'final'] as const) {
      for (const tieId of comp.knockout[stage]) {
        const tie = europe.ties[tieId];
        if (tie?.winner) add(tie.winner, comp.id, 1);
      }
    }
    if (comp.winner) add(comp.winner, comp.id, TITLE_BONUS);
  }
  return out;
}

/** Season end: roll the five-season windows for clubs and associations. */
export function updateCoefficients(state: GameState): void {
  const europe = state.europe!;
  const pts = seasonClubPoints(state);
  for (const club of Object.values(europe.clubs)) {
    club.coef.push(Math.round((pts[club.id]?.points ?? 0) * 10) / 10);
    while (club.coef.length > 5) club.coef.shift();
  }
  const byAssoc = new Map<string, number[]>();
  for (const [clubId, row] of Object.entries(pts)) {
    const assoc = europe.clubs[clubId]?.assocId;
    if (!assoc) continue;
    byAssoc.set(assoc, [...(byAssoc.get(assoc) ?? []), row.points]);
  }
  for (const a of Object.values(europe.associations)) {
    const list = byAssoc.get(a.id) ?? [];
    a.coef.push(list.length ? Math.round((sum(list) / list.length) * 100) / 100 : 0);
    while (a.coef.length > 5) a.coef.shift();
  }
  const ranking = associationRanking(state);
  ranking.forEach((id, i) => europe.associations[id].rankHistory.push(i + 1));
}
