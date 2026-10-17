import { describe, expect, it } from 'vitest';
import { divisionStandings, seasonResults } from '../championship/standings';
import { raceLapsFor } from '../config/divisions';
import { activeDivisions, levelOfDivision } from '../config/ruleset';
import { ASSOCIATION_BY_ID, leagueWeekends } from '../europe/data';
import { autoplayPlayerWeekend } from '../game';
import { applyRaceResult, autoPractice, finishPractice, participantsFor, runNextQualifyingSession, simulateEventAutomatically } from '../race/weekend';
import { Rng } from '../rng';
import { deserializeGame, serializeGame } from '../save/serialization';
import { advanceBlocker, advanceWeek, finishWeekendAndContinue } from '../season/advance';
import { findEvent } from '../season/calendar';
import { playerTeam } from '../selectors';
import type { CalendarEvent, GameState, RaceState } from '../types';
import { validateState } from '../validation';
import { makeGame } from './helpers';

const euro = (seed = 4100) => makeGame(seed, { european: { assocId: 'ENG' } });

/** Advance until the player's next race weekend opens. */
function toWeekend(s: GameState): CalendarEvent {
  let guard = 0;
  while (s.phase !== 'weekend' && guard++ < 60) advanceWeek(s);
  expect(s.phase).toBe('weekend');
  return findEvent(s, s.weekend!.eventId)!;
}

/** The next league race in the player's division (skipping midweek cup ties). */
function toLeagueWeekend(s: GameState): CalendarEvent {
  for (let i = 0; i < 10; i++) {
    const ev = toWeekend(s);
    if (ev.euro?.competition === 'league') return ev;
    autoplayPlayerWeekend(s);
    finishWeekendAndContinue(s);
  }
  throw new Error('No league weekend reached');
}

const pointsOf = (s: GameState, eventId: string) => s.results[eventId].entries.reduce((a, e) => a + e.points, 0);

describe('European League gameweeks: one race each', () => {
  it('schedules exactly one full-distance race per gameweek, each with its own id and seed', () => {
    const s = euro();
    for (const d of activeDivisions(s)) {
      const events = s.calendars[d];
      const teams = ASSOCIATION_BY_ID.ENG.levels[levelOfDivision(d) - 1].teams;
      expect(events).toHaveLength(leagueWeekends(teams));
      expect(new Set(events.map((e) => e.week)).size).toBe(events.length);
      expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
      expect(new Set(events.map((e) => Rng.from(s.seed, 'race', e.id).state)).size).toBe(events.length);
      events.forEach((e, i) => {
        expect(e.round).toBe(i + 1);
        expect(e.laps).toBe(raceLapsFor(d, s.circuits[e.circuitId].laps));
        expect(e.euro?.label).toContain(`Gameweek ${i + 1}`);
      });
    }
  });

  it('races the whole eligible grid, scores once and leaves the next gameweek untouched', () => {
    const s = euro();
    const ev = toLeagueWeekend(s);
    const division = playerTeam(s).division;
    const grid = participantsFor(s, ev);
    expect(grid).toHaveLength(2 * Object.values(s.teams).filter((t) => t.division === division && !t.guest).length);
    const next = s.calendars[division].find((e) => !e.completed && e.id !== ev.id)!;
    const before = divisionStandings(s, division).constructors.reduce((a, r) => a + r.points, 0);

    autoplayPlayerWeekend(s);
    const result = s.results[ev.id];
    expect(result.entries).toHaveLength(grid.length);
    expect(new Set(result.entries.map((e) => e.driverId)).size).toBe(grid.length);
    expect(divisionStandings(s, division).constructors.reduce((a, r) => a + r.points, 0)).toBe(before + pointsOf(s, ev.id));
    // The next gameweek has not been raced or scored.
    expect(next.completed).toBe(false);
    expect(s.results[next.id]).toBeUndefined();
    // The same result can never be applied twice.
    expect(() => applyRaceResult(s, result, {} as RaceState)).toThrow();
    expect(seasonResults(s, division).filter((r) => r.eventId === ev.id)).toHaveLength(1);
  });

  it('only advances to the next gameweek once the race is finished', () => {
    const s = euro(4200);
    const ev = toLeagueWeekend(s);
    expect(advanceBlocker(s)).toBeTruthy();
    expect(() => advanceWeek(s)).toThrow();
    autoplayPlayerWeekend(s);
    expect(() => advanceWeek(s)).toThrow();
    finishWeekendAndContinue(s);
    const week = s.week;
    expect(s.phase === 'season' || s.phase === 'weekend').toBe(true);
    if (s.phase === 'season') {
      advanceWeek(s);
      expect(s.week).toBe(week + 1);
    }
    expect(findEvent(s, ev.id)!.completed).toBe(true);
  });

  it('reloading mid-weekend continues exactly where it left off', () => {
    const s = euro(4300);
    const ev = toLeagueWeekend(s);
    // Practice and qualifying done, strategy chosen: save here.
    const w = s.weekend!;
    for (const id of Object.keys(w.practice.setups)) autoPractice(s, id);
    finishPractice(s);
    while (s.weekend!.phase === 'qualifying') runNextQualifyingSession(s);
    expect(s.weekend!.phase).toBe('raceSetup');
    const loaded = deserializeGame(serializeGame(s));
    expect(loaded.weekend!.eventId).toBe(w.eventId);
    expect(loaded.weekend!.qualifying.result).toEqual(s.weekend!.qualifying.result);
    autoplayPlayerWeekend(s);
    autoplayPlayerWeekend(loaded);
    expect(loaded.results[ev.id]).toEqual(s.results[ev.id]);
    expect(validateState(loaded)).toEqual([]);
  });
});

describe('Loading a two-race save from version 1', () => {
  it('keeps raced results, drops unraced second races and runs full distance', () => {
    const s = euro(4400);
    const division = activeDivisions(s).find((d) => d !== playerTeam(s).division)!;
    // Rebuild that division's calendar the way version 1 did: two shortened races per weekend.
    const legacy: CalendarEvent[] = [];
    s.calendars[division].forEach((ev, i) => {
      for (const raceNo of [1, 2] as const) {
        const weekendId = `s1-${division}-w${i + 1}`;
        legacy.push({
          ...ev,
          id: `${weekendId}-r${raceNo}`,
          round: i * 2 + raceNo,
          laps: 9,
          euro: { competition: 'league', label: `Round ${i + 1}, Race ${raceNo}`, raceNo, weekendId, pairedEventId: `${weekendId}-r${raceNo === 1 ? 2 : 1}`, gridRule: 'qualifying' } as CalendarEvent['euro'],
        });
      }
    });
    s.calendars[division] = legacy;
    (s.europe as unknown as Record<string, unknown>).race2Grid = 'qualifying';
    // The first weekend was raced in full.
    simulateEventAutomatically(s, legacy[0]);
    simulateEventAutomatically(s, legacy[1]);
    const raced = [legacy[0].id, legacy[1].id].map((id) => structuredClone(s.results[id]));

    const envelope = JSON.parse(serializeGame(s));
    envelope.version = 1;
    const loaded = deserializeGame(JSON.stringify(envelope));
    const cal = loaded.calendars[division];
    expect(cal).toHaveLength(legacy.length / 2 + 1);
    expect(loaded.results[legacy[0].id]).toEqual(raced[0]);
    expect(loaded.results[legacy[1].id]).toEqual(raced[1]);
    const upcoming = cal.filter((e) => !e.completed);
    expect(new Set(upcoming.map((e) => e.week)).size).toBe(upcoming.length);
    upcoming.forEach((e, i) => {
      expect(e.laps).toBe(raceLapsFor(division, loaded.circuits[e.circuitId].laps));
      expect(e.round).toBe(3 + i);
      expect(e.euro?.label).toContain(`Gameweek ${2 + i}`);
    });
    expect((loaded.europe as unknown as Record<string, unknown>).race2Grid).toBeUndefined();
    expect(validateState(loaded)).toEqual([]);
    // The standings still count both raced results.
    const total = raced.reduce((a, r) => a + r.entries.reduce((b, e) => b + e.points, 0), 0);
    expect(divisionStandings(loaded, division).constructors.reduce((a, r) => a + r.points, 0)).toBe(total);
  });
});
