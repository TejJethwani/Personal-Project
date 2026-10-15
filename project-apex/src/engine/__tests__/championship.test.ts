import { describe, expect, it } from 'vitest';
import { assignPoints, compareRows, computeStandingsFromResults, divisionStandings } from '../championship/standings';
import { simulateEventAutomatically } from '../race/weekend';
import type { RaceResult, RaceResultEntry } from '../types';
import { makeGame } from './helpers';

function entry(driverId: string, teamId: string, position: number, status: RaceResultEntry['status'] = 'finished'): RaceResultEntry {
  return { driverId, teamId, position, grid: position, points: 0, status, laps: 10, time: 100 + position, gap: '', bestLap: 90, fastestLap: false, pitStops: 1, penaltySeconds: 0, reason: null, lapsLed: 0 };
}

describe('points allocation', () => {
  it('awards modern points to finishers only', () => {
    const entries = [entry('a', 'T1', 1), entry('b', 'T2', 2), entry('c', 'T1', 3), entry('d', 'T2', 4, 'dnf')];
    assignPoints(entries, 'modern', null, null);
    expect(entries.map((e) => e.points)).toEqual([25, 18, 15, 0]);
  });

  it('gives the fastest-lap point only inside the top N and pole points when configured', () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry(`d${i}`, `t${i % 6}`, i + 1));
    assignPoints(entries, 'feeder', 'd3', 'd11');
    expect(entries[11].points).toBe(0); // P12 fastest lap: no point
    expect(entries[3].points).toBe(12 + 2); // P4 + pole
    const again = Array.from({ length: 12 }, (_, i) => entry(`d${i}`, `t${i % 6}`, i + 1));
    assignPoints(again, 'feeder', null, 'd1');
    expect(again[1].points).toBe(18 + 1);
  });

  it('uses division-specific presets', () => {
    const club = [entry('a', 'T', 1)];
    assignPoints(club, 'club', null, null);
    expect(club[0].points).toBe(10);
    const junior = [entry('a', 'T', 1)];
    assignPoints(junior, 'junior', null, null);
    expect(junior[0].points).toBe(15);
  });
});

describe('standings', () => {
  it('sums race points and breaks ties by count-back', () => {
    const r1: RaceResult = { eventId: 'e1', division: 'F5', season: 1, round: 1, circuitId: 'x', wet: false, safetyCars: 0, entries: [entry('a', 'T1', 1), entry('b', 'T2', 2)], poleDriverId: 'a', fastestLapDriverId: null, qualifying: [] };
    const r2: RaceResult = { ...r1, eventId: 'e2', round: 2, entries: [entry('b', 'T2', 1), entry('a', 'T1', 2)], poleDriverId: 'b' };
    for (const r of [r1, r2]) assignPoints(r.entries, 'modern', null, null);
    const st = computeStandingsFromResults([r1, r2]);
    expect(st.drivers[0].points).toBe(43);
    expect(st.drivers[1].points).toBe(43);
    expect(compareRows(st.drivers[0], st.drivers[1])).toBe(st.drivers[0].id.localeCompare(st.drivers[1].id));
    expect(st.constructors.find((c) => c.id === 'T1')!.points).toBe(43);
    expect(st.drivers.find((d) => d.id === 'a')!.poles).toBe(1);
  });

  it('season standings equal the sum of individual race results', () => {
    const s = makeGame(31);
    for (const ev of s.calendars.F4.slice(0, 4)) {
      s.week = ev.week;
      simulateEventAutomatically(s, ev);
    }
    const st = divisionStandings(s, 'F4');
    const total = Object.values(s.results).reduce((sum, r) => sum + r.entries.reduce((a, e) => a + e.points, 0), 0);
    expect(st.drivers.reduce((a, r) => a + r.points, 0)).toBe(total);
    expect(st.constructors.reduce((a, r) => a + r.points, 0)).toBe(total);
    expect(st.constructors).toHaveLength(10);
    for (let i = 1; i < st.drivers.length; i++) expect(st.drivers[i - 1].points).toBeGreaterThanOrEqual(st.drivers[i].points);
  });
});
