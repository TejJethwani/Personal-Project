/**
 * League coefficients, UEFA-style: every European season each top league earns points from its clubs' results
 * (2 a win, 1 a draw, 1 for each knockout round reached, 4 for playing in the Champions League), divided by the
 * number of clubs it sent. The last five seasons are added up and the ranking decides how many Champions League
 * and Europa League places each league gets, and how much its football counts in the Ballon d'Or.
 */
import type { World } from './types';
import { LEAGUES } from './data/clubs';

const TOP = LEAGUES.filter((l) => l.tier === 1).map((l) => l.id);
/** Places by ranking position (totals stay 36 and 24). */
export const UCL_BY_RANK = [6, 6, 5, 5, 5, 5, 4];
export const UEL_BY_RANK = [4, 4, 4, 4, 3, 3, 2];
/** A plausible history so the first ranking looks like today's. */
const SEED: Record<string, number> = { eng1: 20, esp1: 17.2, ita1: 16.3, ger1: 15.8, fra1: 13.4, por1: 11.6, ned1: 10.6 };

export interface CoefState { hist: Record<string, { s: number; pts: number }[]> }
export function coefState(w: World): CoefState {
  if (!w.coef) {
    const hist: CoefState['hist'] = {};
    for (const id of TOP) hist[id] = Array.from({ length: 5 }, (_, i) => ({ s: w.season - 5 + i, pts: Math.round((SEED[id] ?? 12) * (0.9 + ((i * 7 + id.length) % 5) * 0.05) * 1000) / 1000 }));
    w.coef = { hist };
  }
  return w.coef;
}
/** The five-season total for a league. */
export function coefOf(w: World, lg: string): number { return Math.round((coefState(w).hist[lg] ?? []).slice(-5).reduce((x, e) => x + e.pts, 0) * 1000) / 1000; }
/** Leagues best first. */
export function coefRanking(w: World): { lg: string; total: number; last: number; rank: number; ucl: number; uel: number }[] {
  const st = coefState(w);
  return TOP.map((lg) => ({ lg, total: coefOf(w, lg), last: st.hist[lg]?.[st.hist[lg].length - 1]?.pts ?? 0 })).sort((a, b) => b.total - a.total)
    .map((x, i) => ({ ...x, rank: i + 1, ucl: UCL_BY_RANK[i] ?? 4, uel: UEL_BY_RANK[i] ?? 2 }));
}
export const uclSlots = (w: World, lg: string) => coefRanking(w).find((x) => x.lg === lg)?.ucl ?? 0;
export const uelSlots = (w: World, lg: string) => coefRanking(w).find((x) => x.lg === lg)?.uel ?? 0;
/** How much a league's football counts (1 for the best league, about 0.6 for the weakest of the top flights). */
export function leagueWeight(w: World, lg: string): number {
  if (!TOP.includes(lg)) return lg === 'eng2' ? 0.5 : lg === 'eng3' ? 0.35 : 0.5;
  const r = coefRanking(w), best = r[0]?.total || 1;
  return Math.round((0.55 + 0.45 * Math.pow(coefOf(w, lg) / best, 1.3)) * 1000) / 1000;
}
/** The five strongest leagues by coefficient (for "top five" weightings). */
export function topFive(w: World): string[] { return coefRanking(w).slice(0, 5).map((x) => x.lg); }

/** At the end of the European season: add this season's points. */
export function updateCoefficients(w: World): void {
  const st = coefState(w);
  if (TOP.some((lg) => st.hist[lg]?.some((e) => e.s === w.season))) return;
  const pts: Record<string, number> = {}, clubs: Record<string, Set<string>> = {};
  const rounds: Record<string, Set<string>> = {};
  for (const id in w.fixtures) {
    const f = w.fixtures[id];
    if ((f.comp !== 'ucl' && f.comp !== 'uel') || f.s !== w.season || !f.played || !f.sc) continue;
    for (const [me, gf, ga] of [[f.h, f.sc[0], f.sc[1]], [f.a, f.sc[1], f.sc[0]]] as const) {
      const lg = w.clubs[me]?.league;
      if (!lg || !TOP.includes(lg)) continue;
      (clubs[lg] ??= new Set()).add(me);
      pts[lg] = (pts[lg] ?? 0) + (gf > ga ? 2 : gf === ga ? 1 : 0);
      if (f.stg && f.stg !== 'Group') (rounds[me] ??= new Set()).add(f.comp + ':' + f.stg);
    }
  }
  for (const me in rounds) { const lg = w.clubs[me]?.league; if (lg) pts[lg] = (pts[lg] ?? 0) + rounds[me].size; }
  for (const id of w.comps.ucl?.teams ?? []) { const lg = w.clubs[id]?.league; if (lg && TOP.includes(lg)) pts[lg] = (pts[lg] ?? 0) + 4; }
  for (const lg of TOP) {
    const n = clubs[lg]?.size ?? 0;
    (st.hist[lg] ??= []).push({ s: w.season, pts: n ? Math.round((pts[lg] ?? 0) / n * 1000) / 1000 : 0 });
    if (st.hist[lg].length > 10) st.hist[lg].shift();
  }
}
