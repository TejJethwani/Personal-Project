import { divisionForLevel } from '../config/ruleset';
import { POINTS_PRESETS } from '../config/divisions';
import { Rng } from '../rng';
import type { EuroLeague, GameState, LiteStandingRow } from '../types';
import { CONTINENTAL, promotionPlaces } from './data';
import { LEVEL_PACE, levelMeanPower, quickRace, rollDriverSplit } from './power';

/**
 * Leagues outside the player's association: full grids of two-car clubs, two
 * races per weekend with modern points, raced on the quick model. Constructor
 * standings decide titles, promotion and relegation like everywhere else.
 */

const POINTS = POINTS_PRESETS.modern.positions;

export function liteTable(league: EuroLeague): LiteStandingRow[] {
  return league.clubIds
    .map((id) => league.standings[id] ?? { clubId: id, points: 0, wins: 0, podiums: 0, races: 0, best: null })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || (a.best ?? 99) - (b.best ?? 99) || a.clubId.localeCompare(b.clubId));
}

/** Race this week's weekends in every quick-model league. */
export function playLiteLeagueWeek(state: GameState, week: number): void {
  const europe = state.europe!;
  for (const league of Object.values(europe.leagues)) {
    if (league.division || !league.weeks.includes(week)) continue;
    const key = `lite:${league.id}:${state.season}:${week}`;
    if (state.processed[key]) continue;
    state.processed[key] = true;
    const field = league.clubIds.map((id) => ({ clubId: id, power: europe.clubs[id].power, drivers: europe.clubs[id].drivers }));
    for (const race of [1, 2]) {
      const rng = Rng.from(state.seed, 'liteRace', league.id, state.season, week, race);
      const order = quickRace(rng, field);
      order.forEach((car, i) => {
        const row = (league.standings[car.clubId] ??= { clubId: car.clubId, points: 0, wins: 0, podiums: 0, races: 0, best: null });
        if (car.index === 0) row.races += 1;
        if (car.dnf) return;
        row.points += POINTS[i] ?? 0;
        if (i === 0) row.wins += 1;
        if (i < 3) row.podiums += 1;
        row.best = row.best === null ? i + 1 : Math.min(row.best, i + 1);
      });
    }
  }
}

export interface LiteMove {
  clubId: string;
  from: number;
  to: number;
}

/** Promotions and relegations in every quick-model association. */
export function liteMoves(state: GameState): LiteMove[] {
  const europe = state.europe!;
  const moves: LiteMove[] = [];
  const byAssoc = new Map<string, EuroLeague[]>();
  for (const l of Object.values(europe.leagues)) if (!l.division) byAssoc.set(l.assocId, [...(byAssoc.get(l.assocId) ?? []), l]);
  for (const leagues of byAssoc.values()) {
    leagues.sort((a, b) => a.level - b.level);
    for (let i = 0; i + 1 < leagues.length; i++) {
      const upper = leagues[i];
      const lower = leagues[i + 1];
      const n = promotionPlaces(upper.clubIds.length);
      const down = liteTable(upper).slice(-n).map((r) => r.clubId);
      const up = liteTable(lower).slice(0, n).map((r) => r.clubId);
      for (const id of down) moves.push({ clubId: id, from: upper.level, to: lower.level });
      for (const id of up) moves.push({ clubId: id, from: lower.level, to: upper.level });
    }
  }
  return moves;
}

/** Season end for quick-model clubs: titles, moves, and how strong each club is next year. */
export function liteSeasonEnd(state: GameState): LiteMove[] {
  const europe = state.europe!;
  // Titles.
  for (const league of Object.values(europe.leagues)) {
    if (league.division) continue;
    const champ = liteTable(league)[0];
    if (!champ) continue;
    const club = europe.clubs[champ.clubId];
    const honour = league.level === 1 ? 'league' : 'lowerLeague';
    club.honours[honour] = (club.honours[honour] ?? 0) + 1;
  }
  // European runs feed investment.
  const euroBoost = new Map<string, number>();
  for (const comp of Object.values(europe.continental)) {
    if (!comp) continue;
    for (const id of comp.teams) euroBoost.set(id, (euroBoost.get(id) ?? 0) + 0.6 * CONTINENTAL[comp.id].prestige);
    if (comp.winner) euroBoost.set(comp.winner, (euroBoost.get(comp.winner) ?? 0) + 1);
  }
  const moves = liteMoves(state);
  const movedTo = new Map(moves.map((m) => [m.clubId, m]));
  for (const league of Object.values(europe.leagues)) {
    if (league.division) continue;
    const table = liteTable(league);
    table.forEach((row, i) => {
      const club = europe.clubs[row.clubId];
      const rng = Rng.from(state.seed, 'clubPower', club.id, state.season);
      const q = table.length > 1 ? i / (table.length - 1) : 0.5;
      let power = club.power + (0.5 - q) * 1.4 + (euroBoost.get(club.id) ?? 0) + rng.normal(0, 1.1);
      const move = movedTo.get(club.id);
      if (move) {
        // Promoted clubs invest for the step up; relegated clubs keep some of their budget.
        power += (LEVEL_PACE[divisionForLevel(move.to)] - LEVEL_PACE[divisionForLevel(move.from)]) * 0.45;
        club.level = move.to;
      }
      const mean = levelMeanPower(club.assocId, divisionForLevel(club.level));
      power += (mean - power) * 0.14;
      club.power = Math.round(power * 10) / 10;
      club.drivers = rollDriverSplit(rng);
    });
  }
  // Rebuild league membership and clear the tables.
  for (const league of Object.values(europe.leagues)) {
    if (league.division) continue;
    league.clubIds = Object.values(europe.clubs)
      .filter((c) => c.assocId === league.assocId && c.level === league.level && !c.teamId)
      .map((c) => c.id);
    league.standings = Object.fromEntries(league.clubIds.map((id) => [id, { clubId: id, points: 0, wins: 0, podiums: 0, races: 0, best: null }]));
  }
  return moves;
}
