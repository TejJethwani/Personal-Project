import { ASSOCIATION_BY_ID, leagueWeekends, promotionPlaces } from '../europe/data';
import type { DivisionId, GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { DIVISIONS, type DivisionConfig } from './divisions';

/**
 * Game-mode rules. Classic careers race the five Formula series as defined in
 * DIVISIONS. A European League career races the player's national association
 * instead: its leagues take over the division slots from the top (level 1 is
 * F1, level 2 is F2...) with full grids, one full race per gameweek and Expanded
 * points. The active rules are swapped in place so every system and page reads
 * the right values from DIVISIONS; switch with applyRuleset whenever a
 * different career becomes active.
 */

const CLASSIC: Record<DivisionId, DivisionConfig> = structuredClone(DIVISIONS);
let activeKey = 'classic';

export const isEuropean = (state: Pick<GameState, 'mode'> | null | undefined): boolean => state?.mode === 'european';

/** Division used for a level of the player's association (level 1 = top flight). */
export const divisionForLevel = (level: number): DivisionId => DIVISION_ORDER[DIVISION_ORDER.length - level];
export const levelOfDivision = (division: DivisionId): number => DIVISION_ORDER.length - DIVISION_ORDER.indexOf(division);

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const out = parts.map((p) => (/^\d/.test(p) ? p.replace(/\D/g, '') : p[0])).join('');
  return out.toUpperCase().slice(0, 4);
}

/** Championship prize share by finishing position, spread over any field size. */
function prizeShares(teams: number): number[] {
  const table = [0.42, 0.36, 0.31, 0.27, 0.24, 0.21, 0.18, 0.15, 0.12, 0.1];
  return Array.from({ length: teams }, (_, i) => {
    const q = teams === 1 ? 0 : (i / (teams - 1)) * (table.length - 1);
    const lo = Math.floor(q);
    const hi = Math.min(table.length - 1, lo + 1);
    return table[lo] + (table[hi] - table[lo]) * (q - lo);
  });
}

/** Knockout qualifying for a full grid: the top ten reach the final session. */
export function qualifyingFormat(cars: number): { sessions: 1 | 2 | 3; eliminations: number[] } {
  if (cars >= 30) {
    const out = cars - 10;
    return { sessions: 3, eliminations: [Math.ceil(out / 2), Math.floor(out / 2)] };
  }
  if (cars >= 18) return { sessions: 2, eliminations: [cars - 10] };
  return { sessions: 1, eliminations: [] };
}

export function europeanDivisionConfigs(assocId: string): Record<DivisionId, DivisionConfig> {
  const assoc = ASSOCIATION_BY_ID[assocId];
  const out = structuredClone(CLASSIC);
  if (!assoc) return out;
  const levels = assoc.levels.length;
  assoc.levels.forEach((league, i) => {
    const level = i + 1;
    const d = divisionForLevel(level);
    const base = out[d];
    const races = leagueWeekends(league.teams);
    const budget = base.typicalBudget;
    const quali = qualifyingFormat(league.teams * 2);
    const upper = i > 0 ? assoc.levels[i - 1] : null;
    out[d] = {
      ...base,
      name: league.name,
      short: initials(league.name),
      tagline: `${assoc.name} · ${level === 1 ? 'top flight' : `level ${level}`}`,
      status: level === 1 ? 'Top flight' : `Level ${level}`,
      races,
      teams: league.teams,
      raceOperationsCost: Math.round((budget * 0.13) / races),
      prizeMoney: prizeShares(league.teams).map((f) => Math.round(f * budget)),
      racePrize: [0.012, 0.0085, 0.0065, 0.005, 0.004, 0.003, 0.0024, 0.0018, 0.0012, 0.0008].map((f) => Math.round((f * budget * 8 * (league.teams / 10)) / races)),
      qualifyingSessions: quali.sessions,
      knockoutEliminations: quali.eliminations,
      defaultPoints: 'expanded',
      promotionSlots: upper ? promotionPlaces(upper.teams) : 0,
      relegationSlots: level < levels ? promotionPlaces(league.teams) : 0,
    };
  });
  return out;
}

/** Make DIVISIONS describe the rules of this career (Classic when null). */
export function applyRuleset(state: Pick<GameState, 'mode' | 'europe'> | null | undefined): void {
  const key = isEuropean(state) && state?.europe ? `eu:${state.europe.playerAssocId}` : 'classic';
  if (key === activeKey) return;
  const target = key === 'classic' ? CLASSIC : europeanDivisionConfigs(state!.europe!.playerAssocId);
  for (const d of DIVISION_ORDER) {
    const cfg = DIVISIONS[d] as DivisionConfig & { short?: string };
    for (const k of Object.keys(cfg)) delete (cfg as unknown as Record<string, unknown>)[k];
    Object.assign(cfg, structuredClone(target[d]));
  }
  activeKey = key;
}

/** The divisions this career actually races, lowest first. */
export function activeDivisions(state: Pick<GameState, 'mode' | 'europe'>): DivisionId[] {
  if (!isEuropean(state) || !state.europe) return DIVISION_ORDER;
  const levels = ASSOCIATION_BY_ID[state.europe.playerAssocId]?.levels.length ?? 0;
  return DIVISION_ORDER.slice(DIVISION_ORDER.length - levels);
}

/** Short label for a division: league initials in European League mode, the series code otherwise. */
export const divisionShort = (division: DivisionId): string => DIVISIONS[division].short ?? division;
