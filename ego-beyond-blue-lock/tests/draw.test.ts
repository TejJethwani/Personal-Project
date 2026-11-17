import { it, expect } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { autoPilot } from '../src/engine/sim';
it('draw', () => {
  const cfg = defaultConfig(5); cfg.skipNel = true;
  const g = newGame(cfg);
  autoPilot(g, (x) => x.world.phase === 'pro' && x.world.day > 20);
  const w = g.world; let same = 0, n = 0;
  for (const f of Object.values(w.fixtures)) if ((f.comp === 'ucl' || f.comp === 'uel') && f.stg === 'Group' && f.s === w.season) { n++; if (w.clubs[f.h]?.league === w.clubs[f.a]?.league) same++; }
  console.log('league phase fixtures', n, 'same league', same);
  expect(same).toBe(0);
}, 600000);
