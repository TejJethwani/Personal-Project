import { describe, expect, it } from 'vitest';
import { applyPointsChoice, setCustomPoints, setPointsPreset } from '../actions';
import { championshipPoints, divisionStandings, seasonResults, teamPointsRemaining } from '../championship/standings';
import { customPointsProblem, expandedTable, pointsTable, POINTS_PRESETS } from '../config/divisions';
import { activeDivisions } from '../config/ruleset';
import { simulateEventAutomatically } from '../race/weekend';
import { twistEffects } from '../season/twists';
import { deserializeGame, serializeGame } from '../save/serialization';
import { playerTeam } from '../selectors';
import type { DivisionId, GameState } from '../types';
import { makeGame, playOffseason, playSeason } from './helpers';

const SPEC_40 = [50, 45, 41, 38, 35, 32, 29, 27, 25, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** Race the first event of a non-player division and check every car scored from the table. */
function raceAndCheck(s: GameState, table: number[]): { division: DivisionId; eventId: string } {
  const division = activeDivisions(s).find((d) => d !== playerTeam(s).division)!;
  const ev = s.calendars[division][0];
  const result = simulateEventAutomatically(s, ev);
  for (const e of result.entries) expect(e.points).toBe(e.status === 'finished' ? table[e.position - 1] ?? 0 : 0);
  return { division, eventId: ev.id };
}

describe('Expanded points', () => {
  it('pays the top 30 of a 40-car grid exactly as specified', () => {
    expect(expandedTable(40)).toEqual(SPEC_40);
    expect(pointsTable('expanded', 40).positions).toEqual(SPEC_40);
    // P31-P40 score nothing.
    expect(pointsTable('expanded', 40).positions[30]).toBeUndefined();
  });

  it('fits smaller grids: same top ten, a shorter tail, never more places than cars', () => {
    for (const cars of [20, 24, 28, 32, 36]) {
      const t = expandedTable(cars);
      expect(t).toHaveLength(Math.floor(cars * 0.75));
      expect(t.slice(0, 10)).toEqual(SPEC_40.slice(0, 10));
      expect(t[t.length - 1]).toBe(1);
      t.forEach((p, i) => i > 0 && expect(p).toBeLessThanOrEqual(t[i - 1]));
    }
    expect(pointsTable('expanded', 6).positions.length).toBeLessThanOrEqual(6);
    expect(pointsTable('modern', 8).positions).toHaveLength(8);
  });

  it('is the European League default and scores every race from the table', () => {
    const s = makeGame(510, { european: { assocId: 'ENG' } });
    for (const d of activeDivisions(s)) expect(s.settings.pointsPreset[d]).toBe('expanded');
    const { division } = raceAndCheck(s, SPEC_40);
    const results = seasonResults(s, division);
    const total = results.reduce((a, r) => a + r.entries.reduce((b, e) => b + e.points, 0), 0);
    expect(divisionStandings(s, division).constructors.reduce((a, r) => a + r.points, 0)).toBe(total);
    // Projections use the same table: a team can take at most P1 + P2 per race.
    const left = s.calendars[division].filter((e) => !e.completed).length;
    expect(teamPointsRemaining(s, division)).toBe(left * (50 + 45));
  });

  it('leaves Classic careers on their series defaults unless another system is chosen', () => {
    const s = makeGame(511);
    expect(s.settings.pointsPreset.F5).toBe('club');
    expect(s.settings.pointsPreset.F1).toBe('modernFL');
    const f1 = makeGame(511, { points: { system: 'modern' } });
    for (const d of Object.keys(f1.settings.pointsPreset) as DivisionId[]) expect(f1.settings.pointsPreset[d]).toBe('modern');
    raceAndCheck(f1, POINTS_PRESETS.modern.positions);
    const expanded = makeGame(511, { points: { system: 'expanded' } });
    raceAndCheck(expanded, expandedTable(20));
  });
});

describe('Custom points', () => {
  it('rejects tables that make no sense', () => {
    expect(customPointsProblem([])).toBeTruthy();
    expect(customPointsProblem([10, 12])).toBeTruthy();
    expect(customPointsProblem([10, -1])).toBeTruthy();
    expect(customPointsProblem([10.5])).toBeTruthy();
    expect(customPointsProblem(Array.from({ length: 41 }, () => 1))).toBeTruthy();
    expect(customPointsProblem([0])).toBeTruthy();
    expect(customPointsProblem([12, 9, 9, 5, 0])).toBeNull();
    expect(() => makeGame(512, { points: { system: 'custom', custom: [3, 5] } })).toThrow();
  });

  it('scores with the custom table and survives a save and reload', () => {
    const table = [100, 60, 40, 30, 20, 10, 5, 1];
    const s = makeGame(513, { european: { assocId: 'NED' }, points: { system: 'custom', custom: table } });
    expect(championshipPoints(s, playerTeam(s).division).positions).toEqual(table);
    raceAndCheck(s, table);
    const loaded = deserializeGame(serializeGame(s));
    expect(loaded.settings.customPoints).toEqual(table);
    expect(championshipPoints(loaded, playerTeam(loaded).division).positions).toEqual(table);
  });

  it('applies an edited table and a new system only from the next season', () => {
    const s = makeGame(514, { points: { system: 'custom', custom: [10, 5, 1] } });
    const d = playerTeam(s).division;
    setCustomPoints(s, [20, 10, 5, 1]);
    expect(() => setCustomPoints(s, [1, 2])).toThrow();
    expect(championshipPoints(s, d).positions).toEqual([10, 5, 1]);
    playSeason(s);
    // The whole season ran on the table it started with (a double-points finale pays twice).
    for (const r of seasonResults(s, d)) {
      const factor = twistEffects(s, d).doublePointsRound === r.round ? 2 : 1;
      for (const e of r.entries) expect(e.points).toBe(e.status === 'finished' ? ([10, 5, 1][e.position - 1] ?? 0) * factor : 0);
    }
    playOffseason(s);
    const nd = playerTeam(s).division;
    expect(championshipPoints(s, nd).positions).toEqual([20, 10, 5, 1]);
    // Switching system is queued the same way.
    setPointsPreset(s, nd, 'expanded');
    expect(s.settings.pointsPreset[nd]).toBe('custom');
    expect(s.settings.pendingPointsPreset?.[nd]).toBe('expanded');
  });

  it('a career choice of Custom needs a table', () => {
    const s = makeGame(515);
    expect(() => applyPointsChoice(s, { system: 'custom' })).toThrow();
  });
});

describe('Loading a version 1 European save', () => {
  it('keeps this season on its system and moves to Expanded next season', () => {
    const s = makeGame(516, { european: { assocId: 'ENG' } });
    for (const d of activeDivisions(s)) s.settings.pointsPreset[d] = 'modern';
    const envelope = JSON.parse(serializeGame(s));
    envelope.version = 1;
    const loaded = deserializeGame(JSON.stringify(envelope));
    for (const d of activeDivisions(loaded)) {
      expect(loaded.settings.pointsPreset[d]).toBe('modern');
      expect(loaded.settings.pendingPointsPreset?.[d]).toBe('expanded');
    }
    // A current save is not touched.
    const again = deserializeGame(serializeGame(loaded));
    expect(again.settings).toEqual(loaded.settings);
  });
});
