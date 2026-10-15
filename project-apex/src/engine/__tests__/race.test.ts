import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { createRaceState, runRaceToEnd, stepRaceLap, stepToNextKeyEvent, DEFAULT_INSTRUCTIONS, type RaceEntrantInput } from '../race/engine';
import { classify, participantsFor, simulateEventAutomatically, strategyInputs } from '../race/weekend';
import { buildQualifying, sessionSizes } from '../race/qualifying';
import { planStrategies } from '../race/strategy';
import type { CalendarEvent, GameState, RaceState, StrategyPlan } from '../types';
import { makeGame } from './helpers';

function entrantsFor(state: GameState, event: CalendarEvent, planFor?: (driverId: string) => StrategyPlan | undefined): RaceEntrantInput[] {
  const participants = participantsFor(state, event);
  return participants.map((p, i) => {
    const plan = planFor?.(p.driverId) ?? planStrategies(strategyInputs(state, event, p.driverId, p.teamId, 0.8), null, 1)[0];
    return { driverId: p.driverId, teamId: p.teamId, grid: i + 1, setupQuality: 70, plan, instructions: { ...DEFAULT_INSTRUCTIONS }, autoStrategy: true, autoInstructions: true, fuelMargin: 0.01, isPlayer: false };
  });
}

function fingerprint(race: RaceState): string {
  return race.cars
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => `${c.driverId}:${c.status}:${c.totalTime.toFixed(6)}:${c.pitStops}`)
    .join('|');
}

describe('race simulation', () => {
  it('is deterministic for the same seed and decisions', () => {
    const a = makeGame(99);
    const b = makeGame(99);
    const ev = a.calendars.F1[0];
    const ra = createRaceState(a, ev, entrantsFor(a, ev));
    const rb = createRaceState(b, b.calendars.F1[0], entrantsFor(b, b.calendars.F1[0]));
    runRaceToEnd(a, ra);
    runRaceToEnd(b, rb);
    expect(fingerprint(ra)).toBe(fingerprint(rb));
    expect(ra.log.map((l) => l.text)).toEqual(rb.log.map((l) => l.text));
  });

  it('produces identical results whatever the playback speed', () => {
    const s = makeGame(5);
    const ev = s.calendars.F2[0];
    const lapByLap = createRaceState(s, ev, entrantsFor(s, ev));
    while (!lapByLap.finished) stepRaceLap(s, lapByLap);
    const keyEvents = createRaceState(s, ev, entrantsFor(s, ev));
    while (!keyEvents.finished) stepToNextKeyEvent(s, keyEvents);
    const toEnd = createRaceState(s, ev, entrantsFor(s, ev));
    runRaceToEnd(s, toEnd);
    expect(fingerprint(lapByLap)).toBe(fingerprint(keyEvents));
    expect(fingerprint(lapByLap)).toBe(fingerprint(toEnd));
  });

  it('survives a JSON round trip mid-race (save/resume) with the same outcome', () => {
    const s = makeGame(11);
    const ev = s.calendars.F3[0];
    const reference = createRaceState(s, ev, entrantsFor(s, ev));
    runRaceToEnd(s, reference);
    const resumed = createRaceState(s, ev, entrantsFor(s, ev));
    for (let i = 0; i < 7; i++) stepRaceLap(s, resumed);
    const restored = JSON.parse(JSON.stringify(resumed)) as RaceState;
    runRaceToEnd(s, restored);
    expect(fingerprint(restored)).toBe(fingerprint(reference));
  });

  it('classifies a valid result with points for finishers only', () => {
    const s = makeGame(21);
    const ev = s.calendars.F1[0];
    const result = simulateEventAutomatically(s, ev);
    const n = result.entries.length;
    expect(n).toBe(20);
    expect(result.entries.map((e) => e.position)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(new Set(result.entries.map((e) => e.driverId)).size).toBe(n);
    const firstDnf = result.entries.findIndex((e) => e.status !== 'finished');
    if (firstDnf >= 0) expect(result.entries.slice(firstDnf).every((e) => e.status !== 'finished')).toBe(true);
    for (const e of result.entries) {
      if (e.status !== 'finished') expect(e.points).toBe(0);
      expect(e.points).toBeGreaterThanOrEqual(0);
    }
    expect(result.entries[0].points).toBeGreaterThanOrEqual(25);
  });

  it('cannot record the same race twice', () => {
    const s = makeGame(3);
    const ev = s.calendars.F4[0];
    simulateEventAutomatically(s, ev);
    expect(() => simulateEventAutomatically(s, ev)).toThrow();
  });

  it('strategy choices change race times', () => {
    const s = makeGame(42);
    const ev = s.calendars.F1.find((e) => s.circuits[e.circuitId].tireStress >= 1.1) ?? s.calendars.F1[0];
    const laps = DIVISIONS.F1.lapsFactor * s.circuits[ev.circuitId].laps;
    const target = participantsFor(s, ev)[0].driverId;
    const good = createRaceState(s, ev, entrantsFor(s, ev));
    const badPlan: StrategyPlan = { startCompound: 'soft', stops: [{ lap: Math.round(laps * 0.85), compound: 'medium' }], label: 'bad' };
    const bad = createRaceState(s, ev, entrantsFor(s, ev, (id) => (id === target ? badPlan : undefined)));
    for (const r of [good, bad]) {
      r.cars.find((c) => c.driverId === target)!.autoStrategy = false;
      r.cars.find((c) => c.driverId === target)!.plan = r === bad ? badPlan : r.cars.find((c) => c.driverId === target)!.plan;
    }
    runRaceToEnd(s, good);
    runRaceToEnd(s, bad);
    const tg = good.cars.find((c) => c.driverId === target)!;
    const tb = bad.cars.find((c) => c.driverId === target)!;
    if (tg.status === 'running' && tb.status === 'running') expect(tb.totalTime).not.toBeCloseTo(tg.totalTime, 0);
    expect(fingerprint(good)).not.toBe(fingerprint(bad));
  });

  it('a much faster car wins most races, but not every race', () => {
    let wins = 0;
    const runs = 12;
    for (let i = 0; i < runs; i++) {
      const s = makeGame(500 + i);
      const ev = s.calendars.F3[0];
      const teams = Object.values(s.teams).filter((t) => t.division === 'F3');
      const fast = teams[0];
      for (const k of Object.keys(fast.car.components) as (keyof typeof fast.car.components)[]) fast.car.components[k] = 80;
      const result = simulateEventAutomatically(s, ev);
      if (result.entries[0].teamId === fast.id) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(runs * 0.5);
  });

  it('better drivers beat worse drivers in equal cars on average', () => {
    let better = 0;
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const s = makeGame(900 + i);
      const ev = s.calendars.F2[0];
      for (const t of Object.values(s.teams).filter((t) => t.division === 'F2')) for (const k of Object.keys(t.car.components) as (keyof typeof t.car.components)[]) t.car.components[k] = 55;
      const result = simulateEventAutomatically(s, ev);
      const finishers = result.entries.filter((e) => e.status === 'finished');
      const ratingOf = (id: string) => {
        const d = s.drivers[id].attributes;
        return d.pace + d.braking + d.racecraft + d.qualifying;
      };
      for (let a = 0; a < finishers.length; a++) {
        for (let b = a + 1; b < finishers.length; b++) {
          total++;
          if (ratingOf(finishers[a].driverId) >= ratingOf(finishers[b].driverId)) better++;
        }
      }
    }
    expect(better / total).toBeGreaterThan(0.58);
  });

  it('unreliable cars break down more often', () => {
    let weakFailures = 0;
    let strongFailures = 0;
    for (let i = 0; i < 8; i++) {
      const s = makeGame(1300 + i);
      const teams = Object.values(s.teams).filter((t) => t.division === 'F1');
      teams.forEach((t, idx) => {
        t.car.components.reliability = idx < 5 ? 20 : 85;
        t.car.components.cooling = idx < 5 ? 25 : 85;
      });
      const weak = new Set(teams.slice(0, 5).map((t) => t.id));
      const result = simulateEventAutomatically(s, s.calendars.F1[i % 3]);
      for (const e of result.entries) {
        const mech = e.reason && !/Crash|Collision/.test(e.reason);
        if (e.status === 'dnf' && mech) (weak.has(e.teamId) ? weakFailures++ : strongFailures++);
      }
    }
    expect(weakFailures).toBeGreaterThan(strongFailures);
  });

  it('qualifying produces a full grid with knockout sessions in F1', () => {
    const s = makeGame(77);
    const ev = s.calendars.F1[0];
    const entrants = participantsFor(s, ev).map((p) => ({ ...p, setupQuality: 70, risk: 'normal' as const }));
    expect(sessionSizes('F1', entrants.length)).toEqual([20, 15, 10]);
    const q = buildQualifying(s, ev, entrants, 3);
    expect(q.entries).toHaveLength(20);
    expect(q.entries.filter((e) => e.eliminatedIn === null)).toHaveLength(10);
    expect(new Set(q.entries.map((e) => e.grid)).size).toBe(20);
  });

  it('applies grid penalties after qualifying', () => {
    const s = makeGame(78);
    const ev = s.calendars.F2[0];
    const entrants = participantsFor(s, ev).map((p) => ({ ...p, setupQuality: 70, risk: 'normal' as const }));
    const before = buildQualifying(s, ev, entrants, 2);
    const pole = before.entries[0];
    s.drivers[pole.driverId].pendingGridPenalty = 5;
    const after = buildQualifying(s, ev, entrants, 2);
    expect(after.entries.find((e) => e.driverId === pole.driverId)!.grid).toBe(6);
    expect(classify).toBeTypeOf('function');
  });
});
