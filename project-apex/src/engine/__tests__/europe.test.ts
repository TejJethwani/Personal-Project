import { describe, expect, it } from 'vitest';
import { computeStandingsFromResults, divisionStandings, seasonResults } from '../championship/standings';
import { DIVISIONS, POINTS_PRESETS } from '../config/divisions';
import { activeDivisions, applyRuleset, levelOfDivision } from '../config/ruleset';
import { ASSOCIATIONS, ASSOCIATION_BY_ID, leagueWeekends } from '../europe/data';
import { allocateEuropeanPlaces, CONTINENTAL_ORDER, leaguePhaseTable } from '../europe/continental';
import { createFixture, createTie, quickFixtureResult, recordFixture } from '../europe/fixtures';
import { buildCommentary } from '../race/commentary';
import { deserializeGame, serializeGame } from '../save/serialization';
import { advanceWeek } from '../season/advance';
import { playerTeam } from '../selectors';
import type { GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame, playOffseason, playSeason } from './helpers';
import { autoplayPlayerWeekend } from '../game';

const euro = (assocId: string, seed = 77) => makeGame(seed, { european: { assocId } });

describe('European League: world', () => {
  for (const assocId of ['ENG', 'TUR', 'MLT']) {
    it(`builds a valid ${assocId} world with full leagues and lite clubs elsewhere`, () => {
      const s = euro(assocId);
      expect(s.mode).toBe('european');
      expect(validateState(s)).toEqual([]);
      const assoc = ASSOCIATION_BY_ID[assocId];
      expect(activeDivisions(s)).toHaveLength(assoc.levels.length);
      for (const d of activeDivisions(s)) {
        const level = levelOfDivision(d);
        const teams = Object.values(s.teams).filter((t) => t.division === d && !t.guest);
        expect(teams).toHaveLength(assoc.levels[level - 1].teams);
        expect(teams.every((t) => !!t.clubId)).toBe(true);
        // One race per gameweek.
        expect(s.calendars[d]).toHaveLength(leagueWeekends(assoc.levels[level - 1].teams));
        expect(s.settings.pointsPreset[d]).toBe('modern');
      }
      // The player starts at the bottom of the pyramid.
      expect(levelOfDivision(playerTeam(s).division)).toBe(assoc.levels.length);
      // The team takes the league's nationality, whatever the config says.
      expect(playerTeam(s).nationality).toBe(assoc.nationality);
      // Every association has its leagues; every club a real home circuit.
      for (const a of ASSOCIATIONS) for (let l = 1; l <= a.levels.length; l++) expect(s.europe!.leagues[`${a.id}-${l}`].clubIds).toHaveLength(a.levels[l - 1].teams);
      for (const c of Object.values(s.europe!.clubs)) expect(s.circuits[c.homeCircuitId]).toBeTruthy();
    });
  }

  it('keeps Classic rules intact alongside European careers', () => {
    euro('ESP');
    const classic = makeGame(5);
    expect(classic.mode).not.toBe('european');
    expect(DIVISIONS.F1.name).toBe('Formula 1');
    expect(DIVISIONS.F5.teams).toBe(10);
    expect(validateState(classic)).toEqual([]);
  });
});

describe('European League: places in Europe', () => {
  it('allocates exactly 36 clubs per competition with no club twice', () => {
    for (const seed of [1, 2, 3]) {
      const s = euro('GER', seed);
      const alloc = allocateEuropeanPlaces(s);
      const seen = new Set<string>();
      for (const id of CONTINENTAL_ORDER) {
        const a = alloc[id];
        expect(a.direct.length).toBeLessThanOrEqual(36);
        expect(a.direct.length + a.pool.length).toBeGreaterThanOrEqual(36);
        for (const c of [...a.direct, ...a.pool]) {
          expect(seen.has(c)).toBe(false);
          seen.add(c);
        }
      }
      // Title holders are in.
      expect(alloc.CL.direct).toContain(s.europe!.titleHolders.CL);
    }
  });
});

describe('European League: a full season', () => {
  let s: GameState;
  it('plays every competition to a finish', () => {
    s = euro('ENG', 2031);
    playSeason(s, { validate: false });
    expect(s.phase).toBe('seasonReview');
    expect(validateState(s)).toEqual([]);
    const e = s.europe!;
    for (const id of CONTINENTAL_ORDER) {
      const comp = e.continental[id]!;
      expect(comp.stage).toBe('done');
      expect(comp.teams).toHaveLength(36);
      expect(new Set(comp.teams).size).toBe(36);
      expect(comp.fixtures).toHaveLength(id === 'ECL' ? 108 : 144);
      const opponents = id === 'ECL' ? 6 : 8;
      for (const club of comp.teams) {
        const fx = comp.fixtures.map((f) => e.fixtures[f]).filter((f) => f.home === club || f.away === club);
        expect(fx).toHaveLength(opponents);
        expect(fx.filter((f) => f.home === club)).toHaveLength(opponents / 2);
        expect(new Set(fx.map((f) => (f.home === club ? f.away : f.home))).size).toBe(opponents);
      }
      expect(comp.knockout.playoff).toHaveLength(8);
      expect(comp.knockout.r16).toHaveLength(8);
      expect(comp.knockout.qf).toHaveLength(4);
      expect(comp.knockout.sf).toHaveLength(2);
      expect(comp.knockout.final).toHaveLength(1);
      // Top eight go straight to the round of 16; 9-24 play off; 25-36 are out.
      const table = leaguePhaseTable(s, comp);
      const r16Clubs = new Set(comp.knockout.r16.flatMap((t) => [e.ties[t].home, e.ties[t].away]));
      for (const row of table.slice(0, 8)) expect(r16Clubs.has(row.clubId)).toBe(true);
      const playoffClubs = new Set(comp.knockout.playoff.flatMap((t) => [e.ties[t].home, e.ties[t].away]));
      for (const row of table.slice(8, 24)) expect(playoffClubs.has(row.clubId)).toBe(true);
      for (const row of table.slice(24)) expect(playoffClubs.has(row.clubId) || r16Clubs.has(row.clubId)).toBe(false);
      expect(comp.winner).toBeTruthy();
    }
    for (const t of Object.values(e.ties)) expect(t.winner).toBeTruthy();
    for (const c of Object.values(e.cups)) expect(c.winner).toBeTruthy();
    expect(e.cups[`ENG-cup`].entrants).toHaveLength(60);
  });

  it('scores each league race once, one race per gameweek', () => {
    const sys = POINTS_PRESETS.modern;
    for (const d of activeDivisions(s)) {
      const events = s.calendars[d];
      expect(new Set(events.map((e) => e.week)).size).toBe(events.length);
      const results = seasonResults(s, d);
      expect(results).toHaveLength(events.length);
      for (const r of results) {
        const finishers = r.entries.filter((x) => x.status === 'finished');
        finishers.forEach((x, i) => expect(x.points).toBe(sys.positions[i] ?? 0));
        expect(r.entries.filter((x) => x.status !== 'finished').every((x) => x.points === 0)).toBe(true);
      }
      // Standings are exactly the sum of the race results.
      const total = results.reduce((sum, r) => sum + r.entries.reduce((a, x) => a + x.points, 0), 0);
      const st = divisionStandings(s, d);
      expect(st.constructors.reduce((a, r) => a + r.points, 0)).toBe(total);
      expect(computeStandingsFromResults(results).drivers.reduce((a, r) => a + r.points, 0)).toBe(total);
    }
  });


  it('rolls over: coefficients, holders, promotion and relegation, no guests left', () => {
    const before = Object.fromEntries(Object.values(s.europe!.clubs).map((c) => [c.id, c.level]));
    const holders = { ...s.europe!.titleHolders };
    playOffseason(s, true, { validate: true });
    const e = s.europe!;
    expect(holders.CL).toBeTruthy();
    expect(Object.values(e.associations).every((a) => a.coef.length === 5)).toBe(true);
    expect(e.history).toHaveLength(1);
    expect(Object.values(s.teams).some((t) => t.guest)).toBe(false);
    expect(Object.values(s.drivers).some((d) => d.guest)).toBe(false);
    // Lite leagues swapped clubs between levels, keeping league sizes.
    const moved = Object.values(e.clubs).filter((c) => !c.teamId && before[c.id] !== c.level);
    expect(moved.length).toBeGreaterThan(20);
    for (const a of ASSOCIATIONS) for (let l = 1; l <= a.levels.length; l++) expect(e.leagues[`${a.id}-${l}`].clubIds).toHaveLength(a.levels[l - 1].teams);
    expect(validateState(s)).toEqual([]);
  });
});

describe('European League: knockout ties', () => {
  it('goes to an extra race on equal aggregate, then a shoot-out', () => {
    const s = euro('NED', 99);
    advanceWeek(s);
    const [a, b] = s.europe!.leagues['FRA-1'].clubIds;
    const tie = createTie(s, 'cup', 'r16', a, b, [30, 32]);
    const [l1, l2] = tie.fixtures.map((id) => s.europe!.fixtures[id]);
    recordFixture(s, l1, { home: 6, away: 4, cars: [] });
    expect(tie.winner).toBeNull();
    recordFixture(s, l2, { home: 6, away: 4, cars: [] }); // b hosts leg 2: 10-10 on aggregate
    expect(tie.aggregate).toEqual([10, 10]);
    expect(tie.decider).toBeTruthy();
    // The background decider has been raced already on the quick model.
    const decider = s.europe!.fixtures[tie.decider!];
    expect(decider.result).toBeTruthy();
    expect(tie.winner).toBeTruthy();
    if (decider.result!.home === decider.result!.away) expect(tie.shootout).toBeTruthy();
  });

  it('decides a level extra race with a qualifying shoot-out', () => {
    const s = euro('NED', 100);
    advanceWeek(s);
    const [a, b] = s.europe!.leagues['ESP-1'].clubIds;
    const tie = createTie(s, 'cup', 'qf', a, b, [30]);
    const only = s.europe!.fixtures[tie.fixtures[0]];
    // Hand-made level results: the single race and the extra race both 5-5.
    const decider = createFixture(s, { competition: 'cup', stage: 'qf', matchday: 2, week: 30, home: a, away: b, circuitId: only.circuitId, kind: 'decider', tieId: tie.id });
    tie.decider = decider.id;
    recordFixture(s, only, { home: 5, away: 5, cars: [] });
    recordFixture(s, decider, { home: 5, away: 5, cars: [] });
    expect(tie.shootout).toBeTruthy();
    expect([a, b]).toContain(tie.winner);
  });

  it('quick-model results always score 10 race points between two clubs unless cars retire', () => {
    const s = euro('ITA', 5);
    advanceWeek(s);
    const [a, b] = s.europe!.leagues['GER-1'].clubIds;
    for (let i = 0; i < 30; i++) {
      const fx = createFixture(s, { competition: 'ECL', stage: 'league', matchday: 1, week: 7, home: a, away: b, circuitId: s.europe!.clubs[a].homeCircuitId, kind: 'match' });
      const r = quickFixtureResult(s, fx);
      const dnfs = r.cars.filter((c) => c.dnf).length;
      expect(r.home + r.away).toBeLessThanOrEqual(10);
      if (dnfs === 0) expect(r.home + r.away).toBe(10);
    }
  });
});

describe('European League: saves and determinism', () => {
  it('round-trips a European career through the save format', () => {
    const s = euro('POR', 314);
    for (let i = 0; i < 6 && s.phase !== 'weekend'; i++) advanceWeek(s);
    const loaded = deserializeGame(serializeGame(s));
    expect(loaded.mode).toBe('european');
    expect(loaded.europe!.playerAssocId).toBe('POR');
    expect(Object.keys(loaded.europe!.fixtures).length).toBe(Object.keys(s.europe!.fixtures).length);
    applyRuleset(loaded);
    expect(DIVISIONS.F1.name).toBe(ASSOCIATION_BY_ID.POR.levels[0].name);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const s = euro('SCO', 4242);
      for (let i = 0; i < 12; i++) {
        if (s.phase === 'weekend') break;
        advanceWeek(s);
      }
      const e = s.europe!;
      return JSON.stringify({ fixtures: Object.values(e.fixtures).map((f) => [f.home, f.away, f.result?.home, f.result?.away]), lite: Object.values(e.leagues).map((l) => Object.values(l.standings).map((r) => r.points)), results: Object.values(s.results).map((r) => r.entries.map((x) => x.driverId)) });
    };
    expect(run()).toBe(run());
  });
});

describe('European League: multi-season stress', () => {
  it('stays valid over three seasons', () => {
    const s = euro('BEL', 8080);
    for (let season = 0; season < 3; season++) {
      playSeason(s, { validate: false });
      expect(s.phase).toBe('seasonReview');
      expect(validateState(s)).toEqual([]);
      for (const d of activeDivisions(s)) expect(s.calendars[d].every((ev) => ev.completed)).toBe(true);
      playOffseason(s, true, { validate: true });
      for (const t of Object.values(s.teams)) {
        expect(Number.isFinite(t.cash)).toBe(true);
        if (!t.isPlayer) expect(t.raceDrivers.every((x) => x !== null)).toBe(true);
      }
    }
    expect(s.europe!.history).toHaveLength(3);
    expect(s.history).toHaveLength(3);
    // Inactive divisions stay empty.
    for (const d of DIVISION_ORDER) if (!activeDivisions(s).includes(d)) expect(s.calendars[d]).toHaveLength(0);
  }, 240000);
});

describe('Race commentary', () => {
  it('never repeats a line back to back and only describes laps that happened', () => {
    const s2 = euro('ENG', 12);
    let guard = 0;
    while (s2.phase !== 'weekend' && guard++ < 10) advanceWeek(s2);
    autoplayPlayerWeekend(s2);
    const race = s2.weekend!.race!;
    const lines = buildCommentary(s2, race);
    expect(lines.length).toBeGreaterThan(5);
    for (let i = 1; i < lines.length; i++) expect(lines[i].text).not.toBe(lines[i - 1].text);
    expect(lines.every((l) => l.lap <= race.lap)).toBe(true);
  });
});
