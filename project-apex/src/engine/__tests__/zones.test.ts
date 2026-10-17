import { describe, expect, it } from 'vitest';
import { divisionStandings, seasonResults } from '../championship/standings';
import { associationPlaces, liveAssociationRanking, positionBounds, tableZones } from '../championship/zones';
import { DIVISIONS } from '../config/divisions';
import { activeDivisions, divisionForLevel } from '../config/ruleset';
import { berthsForRank, CONTINENTAL_ORDER } from '../europe/continental';
import { simulateEventAutomatically } from '../race/weekend';
import { advanceWeek } from '../season/advance';
import { makeGame, playOffseason, playSeason } from './helpers';

const clubs = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe('Table mathematics', () => {
  it('bounds each final position from the points still available', () => {
    const rows = [{ points: 100 }, { points: 90 }, { points: 50 }, { points: 10 }];
    const b = positionBounds(rows, 20);
    expect(b[0]).toEqual({ best: 1, worst: 2 });
    expect(b[1]).toEqual({ best: 1, worst: 2 });
    expect(b[3]).toEqual({ best: 4, worst: 4 });
    // Level on points counts against the team: nothing is secured on a tie.
    expect(positionBounds([{ points: 40 }, { points: 20 }], 20)[0].worst).toBe(2);
    // With nothing left to race, the table is final.
    expect(positionBounds(rows, 0).map((x) => x.worst)).toEqual([1, 2, 3, 4]);
  });
});

describe('European places of an association', () => {
  it('follows the berths of the coefficient rank, passing taken places down', () => {
    const order = clubs(20);
    // Rank 1, cup won by a club already in the Champions League places: its berth passes to P6.
    let p = associationPlaces(1, order, 'c3', {});
    expect(['c1', 'c2', 'c3', 'c4'].map((c) => p.get(c)?.comp)).toEqual(['CL', 'CL', 'CL', 'CL']);
    expect(p.get('c5')).toMatchObject({ comp: 'EL', direct: true, via: 'league' });
    expect(p.get('c6')).toMatchObject({ comp: 'EL', via: 'league' });
    expect(p.get('c7')).toMatchObject({ comp: 'ECL' });
    expect(p.has('c8')).toBe(false);
    // Cup won by a mid-table club: it takes the cup berth and P6 drops to the Conference League.
    p = associationPlaces(1, order, 'c12', {});
    expect(p.get('c12')).toMatchObject({ comp: 'EL', via: 'cup' });
    expect(p.get('c6')?.comp).toBe('ECL');
    // Cup still to be decided: its berth is left open.
    p = associationPlaces(1, order, null, {}, false);
    expect(p.get('c6')?.comp).toBe('ECL');
    expect([...p.values()].filter((x) => x.via === 'cup')).toHaveLength(0);
    // A title holder qualifies on top; the league places pass down.
    p = associationPlaces(1, order, 'c3', { CL: 'c2' });
    expect(p.get('c2')).toMatchObject({ comp: 'CL', via: 'holder' });
    expect(p.get('c5')?.comp).toBe('CL');
  });

  it('gives lower-ranked associations fewer places, some through qualifying', () => {
    const order = clubs(12);
    for (const rank of [1, 5, 9, 14, 20, 30]) {
      const p = associationPlaces(rank, order, 'c1', {});
      const league = berthsForRank(rank).filter((b) => b.route === 'league');
      // The cup winner (P1) is already qualified, so every berth goes to a league position.
      expect(p.size).toBe(berthsForRank(rank).length);
      for (const comp of CONTINENTAL_ORDER) expect([...p.values()].filter((x) => x.comp === comp).length).toBe(berthsForRank(rank).filter((b) => b.comp === comp).length);
      expect(league.some((b) => !b.direct)).toBe(rank > 8);
    }
  });
});

describe('Live qualification zones', () => {
  const topFlight = () => divisionForLevel(1);

  it('update as teams move and never mark a place secured too early', () => {
    const s = makeGame(601, { european: { assocId: 'ENG' } });
    const d = topFlight();
    const ev = s.calendars[d][0];
    simulateEventAutomatically(s, ev);
    const zones = tableZones(s, d);
    expect([...zones.byTeam.values()].some((z) => z.clinched)).toBe(false);
    const rank = liveAssociationRanking(s).indexOf('ENG') + 1;
    const clCount = berthsForRank(rank).filter((b) => b.comp === 'CL' && b.route === 'league').length;
    const rows = divisionStandings(s, d).constructors;
    const zoneAt = (i: number) => tableZones(s, d).byTeam.get(divisionStandings(s, d).constructors[i].id);
    for (let i = 0; i < clCount; i++) expect(zoneAt(i)?.kind).toBe('CL');
    // Move the team in P7 up to P4: it picks up the Champions League place.
    const climber = rows[6].id;
    const entry = s.results[ev.id].entries.find((e) => e.teamId === climber)!;
    entry.points += rows[3].points - rows[6].points + 1;
    const after = divisionStandings(s, d).constructors;
    expect(after.findIndex((r) => r.id === climber)).toBeLessThan(4);
    expect(tableZones(s, d).byTeam.get(climber)?.kind).toBe('CL');
    // Relegation zone at the bottom of the top flight.
    const bottom = after[after.length - 1].id;
    expect(tableZones(s, d).byTeam.get(bottom)?.kind).toBe('relegation');
  });

  it('shows promotion in lower divisions', () => {
    const s = makeGame(602, { european: { assocId: 'ENG' } });
    const d = divisionForLevel(2);
    simulateEventAutomatically(s, s.calendars[d][0]);
    const kinds = new Set([...tableZones(s, d).byTeam.values()].map((z) => z.kind));
    expect(kinds.has('promotion')).toBe(true);
    expect(kinds.has('CL')).toBe(false);
  });

  it('at the season end, the secured places are exactly the places allocated next season', () => {
    const s = makeGame(603, { european: { assocId: 'ESP' } });
    playSeason(s, { validate: false });
    expect(s.phase).toBe('seasonReview');
    const d = topFlight();
    const zones = tableZones(s, d);
    const projected = new Map<string, { comp: string; direct: boolean | undefined }>();
    for (const [teamId, z] of zones.byTeam) {
      if (z.kind === 'CL' || z.kind === 'EL' || z.kind === 'ECL') {
        expect(z.clinched).toBe(true);
        projected.set(s.teams[teamId].clubId!, { comp: z.kind, direct: z.direct });
      }
    }
    expect(projected.size).toBeGreaterThan(0);
    playOffseason(s);
    advanceWeek(s); // the season starts: places are allocated
    const actual = new Map<string, { comp: string; direct: boolean }>();
    for (const id of CONTINENTAL_ORDER) {
      const comp = s.europe!.continental[id]!;
      for (const c of comp.direct) if (s.europe!.clubs[c]?.assocId === 'ESP') actual.set(c, { comp: id, direct: true });
      for (const c of comp.qualifyingPool) if (s.europe!.clubs[c]?.assocId === 'ESP') actual.set(c, { comp: id, direct: false });
    }
    // Every place projected from the final table was handed out as projected.
    for (const [club, p] of projected) expect(actual.get(club)).toEqual(p);
    // And the finished season remembers who qualified.
    const last = s.europe!.history[s.europe!.history.length - 1];
    for (const [club, p] of projected) expect(last.qualified?.[club]).toEqual(p);
  }, 60000);

  it('Classic careers show promotion and relegation only', () => {
    const s = makeGame(604);
    const d = activeDivisions(s).find((x) => x === 'F3')!;
    simulateEventAutomatically(s, s.calendars[d][0]);
    const kinds = new Set([...tableZones(s, d).byTeam.values()].map((z) => z.kind));
    expect([...kinds].every((k) => k === 'promotion' || k === 'relegation')).toBe(true);
    expect(seasonResults(s, d)).toHaveLength(1);
    expect(DIVISIONS[d].promotionSlots).toBeGreaterThan(0);
  });
});
