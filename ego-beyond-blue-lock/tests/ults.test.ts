import { test, expect } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { autoPilot, startUserMatch, finishUserMatch, userFixtureToday, skipNel } from '../src/engine/sim';
import { advance as adv } from '../src/engine/match/engine';
import { S } from '../src/engine/match/model';

test('the new ultimates are offered, resolve cleanly and keep the match consistent', () => {
  const reps: Record<string, number> = { comet: 0, charge: 0, fk: 0 };
  const seen: Record<string, number> = { comet: 0, charge: 0, fk: 0 }, used: Record<string, number> = { comet: 0, charge: 0, fk: 0 };
  for (const [i, id] of ['comet_drive', 'bulldozer_charge', 'fk_sovereign'].entries()) {
    const cfg = defaultConfig(900 + i); cfg.name = 'Ult ' + id; cfg.skipNel = true;
    const g = newGame(cfg); skipNel(g, '');
    const key = ['comet', 'charge', 'fk'][i];
    const me = g.world.players[g.career.pid];
    me.ab = me.ab.filter((a) => !/genesis|zero|trance|puppet|sky|chain|sprint|curtain|dominion|predator|comet|bulldozer|sovereign/.test(a.id));
    me.ab.push({ ...(me.ab[0] ?? {}), id, lv: 3, xp: 0 } as never);
    for (let m = 0; m < 4; m++) {
      autoPilot(g, (x) => !!userFixtureToday(x) && x.world.stage === 1, 60);
      const ms = startUserMatch(g, 'full'); if (!ms) break;
      let guard = 0;
      while (!ms.done && guard++ < 6000) {
        const d = ms.pending;
        if (d) {
          const u = d.options.find((o) => o.id.startsWith('ult:'));
          if (u) { const k = u.id === 'ult:go' ? key : u.id.split(':')[1]; if (k in seen) { seen[k]++; used[k]++; } expect(u.p).toBeGreaterThanOrEqual(0); expect(u.p).toBeLessThanOrEqual(1); expect(u.label.length).toBeGreaterThan(3); }
          adv(ms, (u ?? d.options.find((o) => o.kind === 'shoot') ?? d.options[0]).id, 1);
        } else adv(ms, undefined, 1);
        if (ms.car >= 0) expect(ms.pl[ms.car].t).toBe(ms.poss);
      }
      expect(ms.done).toBe(true);
      for (const r of ms.replays ?? []) if (r.ult && r.ult in reps) reps[r.ult]++;
      const gs = ms.pl.reduce((x, p) => x + p.s[S.G], 0) + ms.goals.filter((x) => x[4] === 2).length;
      expect(gs).toBe(ms.score[0] + ms.score[1]);
      finishUserMatch(g, ms);
    }
  }
  console.log('ULTS', JSON.stringify(seen), JSON.stringify(reps));
  expect(seen.comet).toBeGreaterThan(0); expect(seen.charge).toBeGreaterThan(0); expect(seen.fk).toBeGreaterThan(0);
  expect(reps.comet + reps.charge + reps.fk).toBeGreaterThan(0);
}, 600000);
