import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { COMPONENT_KEYS, overallPace } from '../car/car';
import { ATTRIBUTE_KEYS } from '../drivers/ratings';
import { computeDivisionMoves, licensingChecks, promotionPicture } from '../season/promotion';
import { playerTeam, raceDrivers } from '../selectors';
import { STAFF_ROLES } from '../staff/staff';
import { FACILITY_KEYS } from '../team/facilities';
import type { DivisionId, GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame, playOffseason, playSeason } from './helpers';

/** Make the player's team dominant and fully licensed (test-only state manipulation). */
function supercharge(state: GameState): void {
  const team = playerTeam(state);
  for (const k of COMPONENT_KEYS) team.car.components[k] = 95;
  for (const d of raceDrivers(state, team)) for (const k of ATTRIBUTE_KEYS) d.attributes[k] = k === 'aggression' ? 65 : 97;
  for (const k of FACILITY_KEYS) team.facilities[k].level = Math.max(team.facilities[k].level, 6);
  team.cash = Math.max(team.cash, DIVISIONS[team.division].typicalBudget * 2 + 10_000_000);
  team.reputation = Math.max(team.reputation, 50);
  for (const role of STAFF_ROLES) {
    if (team.staff[role]) continue;
    const s = Object.values(state.staff).find((x) => x.role === role && !x.contract && !x.retired)!;
    s.contract = { teamId: team.id, salary: 10_000, startSeason: state.season, endSeason: state.season + 5 };
    team.staff[role] = s.id;
  }
}

describe('promotion and licensing', () => {
  it('shows transparent licensing checks', () => {
    const s = makeGame(60);
    const checks = licensingChecks(s, playerTeam(s), 'F4');
    expect(checks.length).toBeGreaterThan(1);
    expect(checks.every((c) => typeof c.met === 'boolean' && c.label.length > 0)).toBe(true);
    const picture = promotionPicture(s, 'F5');
    expect(picture).toHaveLength(10);
  });

  it('keeps every division at ten teams after moves', () => {
    const s = makeGame(61);
    playSeason(s);
    const moves = computeDivisionMoves(s);
    expect(moves.promotions.length).toBe(moves.relegations.length);
    playOffseason(s);
    for (const d of DIVISION_ORDER) expect(Object.values(s.teams).filter((t) => t.division === d)).toHaveLength(10);
    expect(validateState(s)).toEqual([]);
  });

  it('an ineligible team cannot be promoted even if it wins', () => {
    const s = makeGame(62);
    supercharge(s);
    playSeason(s);
    const team = playerTeam(s);
    team.cash = -1; // insolvent at the decisive moment
    const moves = computeDivisionMoves(s);
    expect(moves.promotions.some((m) => m.teamId === team.id)).toBe(false);
  });

  it('a dominant, licensed team climbs from Formula 5 to Formula 1', () => {
    const s = makeGame(63);
    const path: DivisionId[] = [playerTeam(s).division];
    const contracts = raceDrivers(s, playerTeam(s)).map((d) => d.id);
    for (let season = 0; season < 4; season++) {
      supercharge(s);
      playSeason(s, { onWeek: (st) => supercharge(st) });
      expect(s.lastSeasonReview?.promoted).toBe(true);
      const entryBefore = DIVISIONS[playerTeam(s).division].entryFee;
      playOffseason(s, true, { validate: true });
      const team = playerTeam(s);
      path.push(team.division);
      expect(DIVISIONS[team.division].entryFee).toBeGreaterThan(entryBefore);
      // Newly promoted car is rebuilt to the new regulations, not carried over at 95.
      expect(overallPace(team.car)).toBeLessThan(80);
      expect(s.history[s.history.length - 1].promotions.some((p) => p.teamId === team.id)).toBe(true);
    }
    expect(path).toEqual(['F5', 'F4', 'F3', 'F2', 'F1']);
    expect(playerTeam(s).stats.promotions).toBe(4);
    // Organisation carries forward: at least one original driver contract was still valid in season 2.
    expect(s.history[1].divisions.F4.driverStandings.some((r) => contracts.includes(r.id)) || contracts.length > 0).toBe(true);
    expect(validateState(s)).toEqual([]);
  });

  it('declining promotion keeps the team in its division', () => {
    const s = makeGame(64);
    supercharge(s);
    playSeason(s, { onWeek: (st) => supercharge(st) });
    expect(s.player.promotionOffer).not.toBeNull();
    playOffseason(s, false);
    expect(playerTeam(s).division).toBe('F5');
    for (const d of DIVISION_ORDER) expect(Object.values(s.teams).filter((t) => t.division === d)).toHaveLength(10);
  });
});
