import { describe, expect, it } from 'vitest';
import { buildCommentary, latestMoment, raceDirectorFeed, teamRadioFeed } from '../race/commentary';
import { degradationForecast, ersForecast, overcut, paceComparison, pitWindow, undercut } from '../race/analysis';
import { advanceRace, autoPractice, finishPractice, runNextQualifyingSession, startRace } from '../race/weekend';
import { advanceWeek } from '../season/advance';
import type { GameState, RaceState } from '../types';
import { makeGame } from './helpers';

/** A player's league race ready to start. */
function grid(seed: number): GameState {
  const s = makeGame(seed, { european: { assocId: 'ENG' } });
  while (s.phase !== 'weekend') advanceWeek(s);
  for (const id of Object.keys(s.weekend!.practice.setups)) autoPractice(s, id);
  finishPractice(s);
  while (s.weekend!.phase === 'qualifying') runNextQualifyingSession(s);
  startRace(s);
  return s;
}

const race = (s: GameState): RaceState => s.weekend!.race!;

describe('Simulate to a checkpoint', () => {
  it('uses the same laps as watching: every way of running a race gives the same result', () => {
    const a = grid(5150);
    const b = grid(5150);
    const c = grid(5150);
    advanceRace(a, 'finish');
    while (!race(b).finished) advanceRace(b, 'lap');
    for (const mode of ['overtake', 'incident', 'pitWindow', 'final5', 'overtake', 'finish'] as const) if (!race(c).finished) advanceRace(c, mode);
    expect(b.results[race(b).eventId]).toEqual(a.results[race(a).eventId]);
    expect(c.results[race(c).eventId]).toEqual(a.results[race(a).eventId]);
  });

  it('stops at five laps to go (or earlier for something urgent), and at the flag when nothing else comes', () => {
    const s = grid(5151);
    advanceRace(s, 'final5');
    const r = race(s);
    const mine = new Set(r.cars.filter((c) => c.isPlayer).map((c) => c.driverId));
    const urgent = r.log.some((e) => e.lap === r.lap && ((['warning', 'failure', 'crash', 'collision'].includes(e.type) && e.driverIds.some((id) => mine.has(id))) || (e.type === 'weather' && e.key)));
    expect(r.finished || r.totalLaps - r.lap <= 5 || urgent).toBe(true);
    const t = grid(5152);
    advanceRace(t, 'incident');
    const rt = race(t);
    const stopLap = rt.lap;
    const hit = rt.log.some((e) => e.lap === stopLap && ['safetyCar', 'vsc', 'crash', 'collision', 'failure', 'warning', 'weather'].includes(e.type));
    expect(rt.finished || hit).toBe(true);
  });
});

describe('Commentary and feeds', () => {
  const s = grid(5160);
  advanceRace(s, 'finish');
  const r = race(s);
  const lines = buildCommentary(s, r);

  it('only describes laps and drivers that exist, without repeating a line back to back', () => {
    expect(lines.length).toBeGreaterThan(10);
    const ids = new Set(r.cars.map((c) => c.driverId));
    for (const l of lines) {
      expect(l.lap).toBeGreaterThanOrEqual(0);
      expect(l.lap).toBeLessThanOrEqual(r.totalLaps);
      for (const id of l.driverIds) expect(ids.has(id)).toBe(true);
    }
    for (let i = 1; i < lines.length; i++) expect(lines[i].text).not.toBe(lines[i - 1].text);
    // The winner's line names the real winner.
    const winner = s.results[r.eventId].entries[0].driverId;
    const finish = lines.find((l) => l.alert === 'finish');
    expect(finish?.driverIds).toContain(winner);
    expect(latestMoment(s, r, lines)?.alert).toBe('finish');
  });

  it('every pass and lead change in the commentary is in the race log', () => {
    const passes = new Set(r.log.filter((e) => e.type === 'overtake').map((e) => `${e.lap}:${e.driverIds.join('|')}`));
    for (const l of lines.filter((x) => x.alert === 'overtake' || (x.alert === 'lead' && x.driverIds.length === 2 && x.lap > 1))) expect(passes.has(`${l.lap}:${l.driverIds.join('|')}`)).toBe(true);
  });

  it('race control and team radio are separate feeds; the radio is the player’s cars only', () => {
    const rd = raceDirectorFeed(s, r);
    expect(rd[0].text).toMatch(/RACE START/);
    expect(rd[rd.length - 1].text).toBe('CHEQUERED FLAG.');
    const radio = teamRadioFeed(s, r);
    const mine = r.cars.filter((c) => c.isPlayer).map((c) => s.drivers[c.driverId].lastName);
    expect(radio.length).toBeGreaterThan(0);
    for (const l of radio) expect(l.speaker === 'Engineer' || mine.some((n) => l.speaker!.includes(n))).toBe(true);
  });
});

describe('Strategy tools', () => {
  it('read the live state for every running car', () => {
    const s = grid(5170);
    for (let i = 0; i < 8; i++) advanceRace(s, 'lap');
    const r = race(s);
    const circuit = s.circuits[r.circuitId];
    for (const car of r.cars.filter((c) => c.status === 'running')) {
      const w = pitWindow(r, car);
      expect(w.close).toBeGreaterThan(r.lap);
      expect(w.open).toBeLessThanOrEqual(Math.max(w.close, r.lap + 1));
      const deg = degradationForecast(r, car);
      deg.forEach((d, i) => i > 0 && expect(d.loss).toBeGreaterThanOrEqual(deg[i - 1].loss));
      const uc = undercut(r, car);
      if (uc) expect(uc.chance).toBeGreaterThanOrEqual(0);
      const oc = overcut(r, car, circuit);
      if (oc) expect(oc.chance).toBeLessThanOrEqual(1);
      for (const row of paceComparison(r, car)) expect(row.car.driverId).not.toBe(car.driverId);
      const e = ersForecast(car);
      expect(e.lapsToEmpty === null || e.lapsToEmpty >= 0).toBe(true);
    }
  });
});
