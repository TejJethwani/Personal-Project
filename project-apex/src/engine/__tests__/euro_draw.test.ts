import { describe, expect, it } from 'vitest';
import { leaguePhaseDraw, type DrawTeam } from '../europe/draw';
import { Rng } from '../rng';

/** Random seeding where no pot is so crowded by one association that the full rules are impossible. */
function feasibleField(seed: number, size: number, pots: number): DrawTeam[] {
  for (let k = 0; k < 500; k++) {
    const f = field(seed * 1000 + k, size);
    const per = size / pots;
    let ok = true;
    for (let p = 0; p < pots && ok; p++) {
      const counts = new Map<string, number>();
      for (const t of f.slice(p * per, (p + 1) * per)) counts.set(t.assoc, (counts.get(t.assoc) ?? 0) + 1);
      if (Math.max(...counts.values()) > Math.floor(per / 2)) ok = false;
    }
    if (ok) return f;
  }
  throw new Error('no feasible field');
}

function field(seed: number, size: number): DrawTeam[] {
  // Realistic mix: big associations send up to five clubs.
  const counts = [5, 4, 4, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1];
  const out: DrawTeam[] = [];
  let a = 0;
  const rng = Rng.from(seed, 'mix');
  while (out.length < size) {
    const n = counts[a] ?? 1;
    for (let i = 0; i < n && out.length < size; i++) out.push({ id: `t${out.length}`, assoc: `A${a}` });
    a++;
  }
  return rng.shuffle(out);
}

function check(teams: DrawTeam[], potsN: number, perPot: number, seed: number) {
  const size = teams.length / potsN;
  const pots = Array.from({ length: potsN }, (_, p) => teams.slice(p * size, (p + 1) * size));
  const potOf = new Map(pots.flatMap((pot, p) => pot.map((t) => [t.id, p])));
  const assocOf = new Map(teams.map((t) => [t.id, t.assoc]));
  const t0 = Date.now();
  const { matchdays } = leaguePhaseDraw(Rng.from(seed, 'draw'), pots, perPot);
  const ms = Date.now() - t0;
  const games = potsN * perPot;
  expect(matchdays.length).toBe(games);
  const opp = new Map<string, string[]>();
  const home = new Map<string, number>();
  for (const day of matchdays) {
    const seen = new Set<string>();
    for (const [h, a] of day) {
      expect(seen.has(h) || seen.has(a)).toBe(false);
      seen.add(h);
      seen.add(a);
      opp.set(h, [...(opp.get(h) ?? []), a]);
      opp.set(a, [...(opp.get(a) ?? []), h]);
      home.set(h, (home.get(h) ?? 0) + 1);
    }
    expect(seen.size).toBe(teams.length);
  }
  for (const t of teams) {
    const o = opp.get(t.id)!;
    expect(o.length).toBe(games);
    expect(new Set(o).size).toBe(games);
    expect(home.get(t.id)).toBe(games / 2);
    for (let p = 0; p < potsN; p++) expect(o.filter((x) => potOf.get(x) === p).length).toBe(perPot);
    expect(o.some((x) => assocOf.get(x) === t.assoc)).toBe(false);
    const byAssoc = new Map<string, number>();
    for (const x of o) byAssoc.set(assocOf.get(x)!, (byAssoc.get(assocOf.get(x)!) ?? 0) + 1);
    expect(Math.max(...byAssoc.values())).toBeLessThanOrEqual(2);
  }
  return { ms, fixtures: matchdays.flat().length };
}

describe('league phase draw', () => {
  it('Champions/Europa League format: 36 clubs, 4 pots, 8 opponents, 144 fixtures', () => {
    let worst = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const r = check(feasibleField(seed, 36, 4), 4, 2, seed);
      expect(r.fixtures).toBe(144);
      worst = Math.max(worst, r.ms);
    }
    console.log('CL worst ms', worst);
  });
  it('Conference League format: 36 clubs, 6 pots, 6 opponents, 108 fixtures', () => {
    let worst = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const r = check(feasibleField(seed + 100, 36, 6), 6, 1, seed);
      expect(r.fixtures).toBe(108);
      worst = Math.max(worst, r.ms);
    }
    console.log('ECL worst ms', worst);
  });
  it('still produces a complete draw when a crowded pot makes the association rule impossible', () => {
    const teams = Array.from({ length: 36 }, (_, i) => ({ id: `t${i}`, assoc: i < 5 ? 'BIG' : `A${i}` }));
    const pots = Array.from({ length: 6 }, (_, p) => teams.slice(p * 6, p * 6 + 6));
    const { matchdays } = leaguePhaseDraw(Rng.from(9, 'draw'), pots, 1);
    expect(matchdays.length).toBe(6);
    expect(matchdays.flat().length).toBe(108);
  });
});
