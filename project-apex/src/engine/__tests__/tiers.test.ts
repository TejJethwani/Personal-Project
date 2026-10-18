import { describe, expect, it } from 'vitest';
import { carRating, COMPONENT_KEYS, divisionCarBase, finishDevelopmentBoost, generateCar, inRaceFrame, overallPace, rebaseCarForDivision } from '../car/car';
import { applyRuleset } from '../config/ruleset';
import { clubPower, eventCarOffset, LEVEL_PACE, teamPower } from '../europe/power';
import { finishPractice, autoPractice, runNextQualifyingSession, startRace } from '../race/weekend';
import { Rng } from '../rng';
import { migrateState } from '../save/migrate';
import { advanceWeek } from '../season/advance';
import type { CalendarEvent, ComponentKey, DivisionId, GameState, Team } from '../types';
import { makeGame, playOffseason, playSeason } from './helpers';

const flat = (v: number) => Object.fromEntries(COMPONENT_KEYS.map((k) => [k, v])) as Record<ComponentKey, number>;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fullTeams = (s: GameState, d: DivisionId): Team[] => Object.values(s.teams).filter((t) => t.division === d && !t.guest);
const carMean = (s: GameState, d: DivisionId) => avg(fullTeams(s, d).map((t) => carRating(t.car)));

describe('One rating scale across the tiers of a European League', () => {
  const s = makeGame(9101, { european: { assocId: 'ENG' } });

  it('builds each tier around its own car base, the top flight far above the rest', () => {
    expect(divisionCarBase('F1') - divisionCarBase('F2')).toBe(-LEVEL_PACE.F2);
    for (const d of ['F1', 'F2', 'F3'] as const) expect(Math.abs(carMean(s, d) - divisionCarBase(d))).toBeLessThan(3);
    expect(carMean(s, 'F1') - carMean(s, 'F2')).toBeGreaterThan(12);
    expect(carMean(s, 'F2') - carMean(s, 'F3')).toBeGreaterThan(9);
    // The best second-tier car is no better than an average top-flight car.
    expect(Math.max(...fullTeams(s, 'F2').map((t) => carRating(t.car)))).toBeLessThan(carMean(s, 'F1'));
  });

  it('gives the top flight an elite well clear of mid-table, wider than any gap lower down', () => {
    const spread = (d: DivisionId) => {
      const p = fullTeams(s, d).map((t) => teamPower(s, t)).sort((a, b) => b - a);
      return avg(p.slice(0, 4)) - avg(p.slice(8, 13));
    };
    expect(spread('F1')).toBeGreaterThan(12);
    expect(spread('F1') - spread('F2')).toBeGreaterThan(2.5);
    // Quick-model top flights abroad have their elite too.
    const esp = Object.values(s.europe!.clubs).filter((c) => c.assocId === 'ESP');
    const lite = (level: number) => esp.filter((c) => c.level === level).map((c) => clubPower(s, c)).sort((a, b) => b - a);
    expect(avg(lite(1).slice(0, 3)) - avg(lite(1).slice(8, 13))).toBeGreaterThan(9);
    // A second-tier champion-elect is a top-flight backmarker.
    expect(lite(2)[0]).toBeLessThan(avg(lite(1).slice(8, 13)));
  });

  it('races every league in its own frame, and a cup tie gives away the full level gap', () => {
    applyRuleset(s);
    for (const d of ['F1', 'F2', 'F3'] as const) expect(inRaceFrame(divisionCarBase(d), d)).toBe(50);
    const event = { id: 'x', division: 'F1', euro: { competition: 'cup', label: 'Cup' } } as unknown as CalendarEvent;
    const inF1 = (t: Team) => inRaceFrame(overallPace(t.car), 'F1') + eventCarOffset(s, t, event);
    expect(avg(fullTeams(s, 'F2').map(inF1)) - avg(fullTeams(s, 'F1').map(inF1))).toBeCloseTo(LEVEL_PACE.F2, 6);
  });

  it('the player’s league race runs in the frame the race model is tuned in', () => {
    const g = makeGame(9102, { european: { assocId: 'ENG' } });
    while (g.phase !== 'weekend') advanceWeek(g);
    for (const id of Object.keys(g.weekend!.practice.setups)) autoPractice(g, id);
    finishPractice(g);
    while (g.weekend!.phase === 'qualifying') runNextQualifyingSession(g);
    startRace(g);
    const race = g.weekend!.race!;
    expect(divisionCarBase(race.division)).toBeLessThan(45);
    expect(Math.abs(avg(race.cars.map((c) => c.carPerf)) - 50)).toBeLessThan(4);
  });
});

describe('Moving between tiers', () => {
  it('a promoted car makes up only part of the gap, and never loses rating when development is kept', () => {
    const car = generateCar(new Rng(1), 57, 0);
    rebaseCarForDivision(car, new Rng(2), flat(50), flat(64), 0.5, true, 1, true, 14);
    for (const k of COMPONENT_KEYS) {
      expect(car.components[k]).toBeGreaterThanOrEqual(57);
      expect(car.components[k]).toBeLessThan(64);
    }
  });

  it('a relegated car gives some of its edge away but stays above its new field; the player’s keeps its ratings when development is kept', () => {
    const ai = generateCar(new Rng(1), 58, 0);
    const mine = generateCar(new Rng(1), 58, 0);
    rebaseCarForDivision(ai, new Rng(3), flat(64), flat(50), 0.5, false, 1, false, -14);
    rebaseCarForDivision(mine, new Rng(3), flat(64), flat(50), 0.5, false, 1, true, -14);
    expect(carRating(ai)).toBeLessThan(58);
    expect(carRating(ai)).toBeGreaterThan(50);
    for (const k of COMPONENT_KEYS) expect(mine.components[k]).toBeGreaterThanOrEqual(58);
  });

  it('after a real season, every club promoted into the top flight starts in its bottom half', () => {
    const g = makeGame(9103, { european: { assocId: 'ENG' } });
    playSeason(g);
    playOffseason(g);
    const up = g.history.at(-1)!.promotions.filter((m) => m.to === 'F1').map((m) => g.teams[m.teamId]);
    expect(up.length).toBeGreaterThan(0);
    const ranked = fullTeams(g, 'F1').sort((a, b) => teamPower(g, b) - teamPower(g, a));
    for (const t of up) {
      expect(ranked.indexOf(t)).toBeGreaterThanOrEqual(ranked.length / 2);
      expect(carRating(t.car)).toBeLessThan(carMean(g, 'F1'));
    }
  });

  it('season-end development spreads over the whole field: the top of a European table earns the most', () => {
    // Ten-team series are unchanged.
    expect(finishDevelopmentBoost(10, 10)).toBe(finishDevelopmentBoost(10));
    // A 20-team field no longer gives places 11-20 the full catch-up boost.
    expect(finishDevelopmentBoost(11, 20)).toBeLessThan(finishDevelopmentBoost(20, 20));
    const euro = Array.from({ length: 20 }, (_, i) => finishDevelopmentBoost(i + 1, 20, true));
    expect(Math.max(...euro)).toBe(euro[0]);
    expect(euro[0] - euro[19]).toBeGreaterThan(0.8);
    expect(euro[9]).toBeLessThan(euro[0]);
  });
});

describe('Version 3 saves', () => {
  const LEGACY: Record<DivisionId, number> = { F1: 0, F2: -6, F3: -12, F4: -18, F5: -24 };

  it('moves an older European career onto the one scale and gives its top flights an elite', () => {
    const now = makeGame(9104, { european: { assocId: 'ENG' } });
    const old = structuredClone(now);
    applyRuleset(old);
    for (const t of Object.values(old.teams)) for (const k of COMPONENT_KEYS) t.car.components[k] -= divisionCarBase(t.division) - 50;
    for (const c of Object.values(old.europe!.clubs)) {
      if (c.teamId) continue;
      const d = (['F1', 'F2', 'F3'] as const)[c.level - 1];
      c.power -= LEVEL_PACE[d] - LEGACY[d];
    }
    old.version = 2;
    migrateState(old, 2);
    expect(old.version).toBe(3);
    // Lower tiers: exactly the cars and clubs a fresh career has.
    for (const t of fullTeams(now, 'F2')) for (const k of COMPONENT_KEYS) expect(old.teams[t.id].car.components[k]).toBeCloseTo(t.car.components[k], 1);
    for (const c of Object.values(now.europe!.clubs).filter((x) => x.level === 2 && !x.teamId)) expect(old.europe!.clubs[c.id].power).toBeCloseTo(c.power, 0);
    // Top flight: the strongest clubs pull further clear, the rest are unchanged.
    const before = fullTeams(now, 'F1').sort((a, b) => teamPower(now, b) - teamPower(now, a));
    expect(carRating(old.teams[before[0].id].car)).toBeGreaterThan(carRating(before[0].car) + 4);
    const last = before.at(-1)!;
    expect(carRating(old.teams[last.id].car)).toBeCloseTo(carRating(last.car), 1);
    expect(old.news.some((n) => n.headline === 'ONE RATING SCALE FOR EVERY TIER')).toBe(true);
  });

  it('leaves a Classic career’s cars alone', () => {
    const c = makeGame(9105);
    const cars = structuredClone(Object.fromEntries(Object.values(c.teams).map((t) => [t.id, t.car.components])));
    migrateState(c, 2);
    for (const t of Object.values(c.teams)) expect(t.car.components).toEqual(cars[t.id]);
    expect(c.news.some((n) => n.headline === 'ONE RATING SCALE FOR EVERY TIER')).toBe(false);
  });
});
