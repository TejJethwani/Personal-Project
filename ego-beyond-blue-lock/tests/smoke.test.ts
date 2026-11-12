import { test } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { autoPilot } from '../src/engine/sim';
import { tableOf } from '../src/engine/competitions';
import { ovr } from '../src/engine/attributes';

test('smoke', () => {
  const cfg = defaultConfig(777); cfg.name = 'Test Egoist';
  let t = Date.now();
  const g = newGame(cfg);
  console.log('newGame ms', Date.now() - t, 'players', Object.keys(g.world.players).length);
  t = Date.now();
  autoPilot(g, (x) => x.world.phase === 'pro');
  const w = g.world;
  console.log('NEL done ms', Date.now() - t, w.nel.summary?.table.map(r => `${r.name} ${r.w}-${r.l}`).join(', '));
  console.log(w.nel.summary?.evalLines.join(' | '));
  console.log('top5', w.nel.summary?.ranking.slice(0, 5).map(r => `${r.name} ${r.amt / 1e6}M ${r.club}`).join('; '));
  const me = w.players[g.career.pid];
  console.log('me', me.club, me.con?.role, ovr(me), 'u20', g.career.flags.u20, w.comps.u20wc?.champion);
  t = Date.now();
  autoPilot(g, (x) => x.world.season === 2026);
  console.log('season ms', Date.now() - t, 'fixtures', Object.keys(w.fixtures).length);
  for (const id of ['eng1', 'esp1']) { const h = w.comps[id].hist[0]; console.log(id, h?.table?.slice(0, 4).map(r => `${r.name} ${r.pts}`).join(', '), '| scorer', h?.topScorer?.name, h?.topScorer?.v, '| rel', h?.relegated?.map(x => w.clubs[x].sn).join(',')); }
  console.log('ucl', w.clubs[w.comps.ucl.hist[0]?.champion ?? '']?.name, 'wc', w.comps.wc?.hist[0]?.championName);
  console.log('timeline', g.career.timeline.map(m => m.txt).join(' || '));
  console.log('awards', w.awardIds.length, 'news', w.news.length, 'transfers', w.transfers.length, 'json MB', (JSON.stringify(g).length / 1e6).toFixed(1));
  console.log(tableOf(w, 'eng1').length);
});
