import { test, expect } from 'vitest';
import { roundRobin } from '../src/engine/competitions';
import { Rng } from '../src/engine/rng';
test('home and away alternate', () => {
  for (const n of [18, 20, 24, 7]) {
    const teams = Array.from({ length: n }, (_, i) => 't' + i);
    const rounds = roundRobin(teams, n !== 7, Rng.seeded(n));
    let worst = 0;
    for (const t of teams) { let run = 0, prev = 0, h = 0; for (const rd of rounds) { const m = rd.find((p) => p.includes(t)); if (!m) continue; const v = m[0] === t ? 1 : -1; if (v === 1) h++; run = v === prev ? run + 1 : 1; prev = v; worst = Math.max(worst, run); } }
    console.log(n, 'longest home/away run', worst);
    expect(worst).toBeLessThanOrEqual(3);
    const seen = new Set<string>(); for (const rd of rounds) for (const [a, b] of rd) { expect(seen.has(a + b)).toBe(false); seen.add(a + b); }
  }
});
