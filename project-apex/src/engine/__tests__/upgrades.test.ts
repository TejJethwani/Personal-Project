import { describe, expect, it } from 'vitest';
import { COMPONENT_KEYS, finishDevelopmentBoost } from '../car/car';
import { canStartCustomUpgrade, canStartProject, capacityUsed, maxAffordableCustomAmount, progressProjects, quoteCustomUpgrade, quoteProject, startCustomUpgrade } from '../car/rnd';
import { previewTakeoverWorld, takeoverCandidates } from '../career/takeover';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { ATTRIBUTE_KEYS } from '../drivers/ratings';
import { beginOffseason } from '../season/seasonEnd';
import { playerTeam, raceDrivers } from '../selectors';
import { STAFF_ROLES } from '../staff/staff';
import { FACILITY_KEYS } from '../team/facilities';
import type { ComponentKey, GameState } from '../types';
import { makeGame, playSeason } from './helpers';

const all = (v: number) => Object.fromEntries(COMPONENT_KEYS.map((k) => [k, v])) as Record<ComponentKey, number>;

function ready(seed: number): GameState {
  const s = makeGame(seed);
  s.phase = 'season';
  playerTeam(s).cash = 50_000_000;
  return s;
}

describe('Custom upgrades', () => {
  it('quote any amount on any set of components, priced like the packages they replace', () => {
    const s = ready(8101);
    const me = playerTeam(s);
    const one = quoteCustomUpgrade(s, me, { aerodynamics: 4 });
    const minor = quoteProject(s, me, 'aerodynamics', 'minor');
    const perPoint = (x: number, pts: number) => x / pts;
    expect(perPoint(one.cost, 4) / perPoint(minor.cost, minor.expectedGain)).toBeGreaterThan(0.95);
    expect(perPoint(one.cost, 4) / perPoint(minor.cost, minor.expectedGain)).toBeLessThan(1.15);
    // Bigger asks cost more, and more than proportionally (diminishing returns).
    const five = quoteCustomUpgrade(s, me, all(5));
    const ten = quoteCustomUpgrade(s, me, all(10));
    expect(five.totalPoints).toBeCloseTo(50, 5);
    expect(ten.cost).toBeGreaterThan(five.cost * 2);
    expect(ten.ratingAfter).toBeGreaterThan(five.ratingAfter);
    // Nothing goes past 99 or past the per-project limit.
    me.car.components.braking = 97.5;
    const capped = quoteCustomUpgrade(s, me, { braking: 10, chassis: 100 });
    expect(capped.gains.braking).toBeCloseTo(1.5, 5);
    expect(capped.gains.chassis).toBe(ECONOMY_TUNING.rndCustom.maxGain);
  });

  it('deliver quickly: a week or two for a typical upgrade, one week on express', () => {
    const s = ready(8102);
    const me = playerTeam(s);
    expect(quoteCustomUpgrade(s, me, all(2)).weeks).toBeLessThanOrEqual(2);
    expect(quoteCustomUpgrade(s, me, all(5)).weeks).toBeLessThanOrEqual(3);
    expect(quoteCustomUpgrade(s, me, all(20)).weeks).toBeLessThanOrEqual(6);
    const express = quoteCustomUpgrade(s, me, all(20), 'express');
    expect(express.weeks).toBe(1);
    expect(express.cost).toBeGreaterThan(quoteCustomUpgrade(s, me, all(20)).cost * 1.3);
    // Packages are quicker too.
    expect(quoteProject(s, me, 'aerodynamics', 'quick').weeks).toBe(1);
    expect(quoteProject(s, me, 'aerodynamics', 'major').weeks).toBeLessThanOrEqual(4);
  });

  it('upgrade every chosen component by exactly the amount ordered, and nothing else', () => {
    const s = ready(8103);
    const me = playerTeam(s);
    const before = { ...me.car.components };
    const ask = { aerodynamics: 3, powerUnit: 3, chassis: 3, reliability: 1.5 };
    const q = quoteCustomUpgrade(s, me, ask);
    const cash = me.cash;
    const p = startCustomUpgrade(s, me.id, ask);
    expect(me.cash).toBeCloseTo(cash - q.cost, 2);
    expect(capacityUsed(me)).toBe(1);
    // The parts being built cannot be developed twice; the others can.
    expect(canStartProject(s, me, 'aerodynamics', 'minor').ok).toBe(false);
    expect(canStartCustomUpgrade(s, me, { chassis: 1 }).ok).toBe(false);
    expect(canStartProject(s, me, 'braking', 'minor').ok).toBe(true);
    for (let w = 0; w < p.weeksTotal; w++) progressProjects(s, me);
    expect(me.rnd).toHaveLength(0);
    for (const k of COMPONENT_KEYS) expect(me.car.components[k]).toBeCloseTo(before[k] + ((ask as Record<string, number>)[k] ?? 0), 5);
    const done = me.rndHistory.at(-1)!;
    expect(done.custom).toEqual(ask);
    expect(done.outcome).toBe('success');
    expect(s.news.some((n) => n.headline === 'CUSTOM UPGRADE FITTED')).toBe(true);
  });

  it('finds the most the team can afford', () => {
    const s = ready(8104);
    const me = playerTeam(s);
    me.cash = DIVISIONS.F5.typicalBudget * 0.3;
    const max = maxAffordableCustomAmount(s, me, COMPONENT_KEYS);
    expect(max).toBeGreaterThan(0);
    expect(quoteCustomUpgrade(s, me, all(max)).cost).toBeLessThanOrEqual(me.cash);
    expect(quoteCustomUpgrade(s, me, all(max + 0.5)).cost).toBeGreaterThan(me.cash);
  });

  it('refuse an empty or unaffordable order', () => {
    const s = ready(8105);
    const me = playerTeam(s);
    expect(canStartCustomUpgrade(s, me, {}).ok).toBe(false);
    me.cash = 1000;
    expect(canStartCustomUpgrade(s, me, all(5)).reason).toBe('Not enough cash.');
  });
});

/** A dominant, licensed player team (test-only state manipulation). */
function dominate(state: GameState): void {
  const team = playerTeam(state);
  for (const k of COMPONENT_KEYS) team.car.components[k] = 80 + COMPONENT_KEYS.indexOf(k) * 0.37;
  for (const d of raceDrivers(state, team)) for (const k of ATTRIBUTE_KEYS) d.attributes[k] = k === 'aggression' ? 65 : 95;
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

describe('The player’s car stays exactly as built', () => {
  it('through promotion on Hardcore: only the season-end boost is added', () => {
    const s = makeGame(8201, { difficulty: 'hardcore' });
    dominate(s);
    playSeason(s);
    const me = playerTeam(s);
    const before = { ...me.car.components };
    const pos = s.lastSeasonReview!.position;
    beginOffseason(s, true);
    expect(me.division).toBe('F4');
    for (const k of COMPONENT_KEYS) expect(me.car.components[k]).toBeCloseTo(before[k] + finishDevelopmentBoost(pos), 2);
    expect(Object.values(me.car.developmentLevel).every((v) => v === 0)).toBe(true);
  });

  it('through relegation from a European top flight: only the season-end boost is added', () => {
    const config = { european: { assocId: 'ENG' }, difficulty: 'casual' as const, seed: 8202 };
    const preview = previewTakeoverWorld({ ...makeGameConfig(), ...config });
    const pick = takeoverCandidates(preview).filter((c) => c.level === 1).sort((a, b) => b.projected - a.projected)[0];
    const s = makeGame(8202, { ...config, takeover: { teamId: pick.teamId } });
    const me = playerTeam(s);
    for (const k of COMPONENT_KEYS) me.car.components[k] = 30;
    playSeason(s, { manage: false });
    const before = { ...me.car.components };
    const pos = s.lastSeasonReview!.position;
    beginOffseason(s, true);
    expect(me.division).toBe('F2');
    for (const k of COMPONENT_KEYS) expect(me.car.components[k]).toBeCloseTo(before[k] + finishDevelopmentBoost(pos, 20, true), 2);
  });
});

function makeGameConfig() {
  return { teamName: 'Unused', shortName: 'UNU', nationality: 'GBR', primaryColor: '#e10600', secondaryColor: '#ffffff', livery: 'arrow' as const, principalName: 'Boss', philosophy: 'balanced' as const, difficulty: 'standard' as const, financialStart: 'modest' as const };
}
