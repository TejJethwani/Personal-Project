import { test, expect } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { autoPilot, startUserMatch, finishUserMatch, userFixtureToday, skipNel } from '../src/engine/sim';
import { advance as adv, requestSub } from '../src/engine/match/engine';
import { S } from '../src/engine/match/model';
import { markersFor } from '../src/ui/LivePitch';
import { Rng } from '../src/engine/rng';

test('interactive matches keep a consistent state', () => {
  const issues: Record<string, number> = {};
  const note = (k: string) => { issues[k] = (issues[k] ?? 0) + 1; };
  let matches = 0, decisions = 0, kinds: Record<string, number> = {}, noMarker = 0, ultOffered = 0, ultMatches = 0, userGames = 0;
  for (const seed of [11, 22, 33]) {
    const cfg = defaultConfig(seed); cfg.name = 'Scan'; cfg.playAs = seed === 22 ? 'Yoichi Isagi' : undefined;
    if (seed === 33) { cfg.skipNel = true; }
    const g = newGame(cfg);
    if (seed === 33) skipNel(g, '');
    const r = Rng.seeded(seed * 7);
    for (let m = 0; m < 7; m++) {
      autoPilot(g, (x) => !!userFixtureToday(x) && x.world.stage === 1, 60);
      if (!userFixtureToday(g)) break;
      const ms = startUserMatch(g, m % 3 === 2 ? 'key' : 'full');
      if (!ms) break;
      matches++;
      if (!ms.uc) { adv(ms); finishUserMatch(g, ms); continue; }
      const me = ms.pl[ms.uc.idx];
      let guard = 0, sawUlt = false, lastScore = 0;
      while (!ms.done && guard++ < 6000) {
        if (!me.on && !me.used && guard % 40 === 0) { ms.uc.trust = 100; ms.uc.asked = 0; requestSub(ms); }
        const d = ms.pending;
        if (d) {
          decisions++; kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
          if (!d.options.length) note('empty decision');
          const ids = new Set(d.options.map((o) => o.id)); if (ids.size !== d.options.length) note('duplicate option ids: ' + d.kind);
          for (const o of d.options) { if (!(o.p >= 0 && o.p <= 1)) note('bad p ' + o.id); if (o.tgt >= 0 && (!ms.pl[o.tgt] || !ms.pl[o.tgt].on)) note('target off pitch ' + o.id); if (o.tgt === ms.uc.idx && d.kind === 'ball') note('pass to self ' + o.id); if (!o.label) note('no label ' + o.id); if (o.id.startsWith('ult:')) sawUlt = true; }
          if (d.kind !== 'flow' && d.kind !== 'penalty' && !me.on) note('decision while off pitch');
          if (d.kind === 'ball' && ms.car !== ms.uc.idx) note('ball decision without ball');
          if (d.kind === 'defend' && ms.poss === me.t) note('defend decision in possession');
          if (d.kind === 'offball' && (ms.poss !== me.t || ms.car === ms.uc.idx)) note('offball decision wrong state');
          const mk = markersFor(ms, d);
          if (d.kind === 'offball' && mk.filter((x) => x.kind === 'move').length === 0 && d.options.some((o) => o.id !== 'run:hold')) note('offball markers all on self');
          const covered = new Set(mk.flatMap((x) => x.opts.map((o) => o.id)));
          for (const o of d.options) if (!covered.has(o.id) && o.kind !== 'meta' && !o.id.startsWith('flow')) noMarker++;
          const ult = d.options.find((o) => o.id.startsWith('ult:'));
          adv(ms, (ult && r.chance(0.7) ? ult : d.options[r.int(d.options.length)]).id, 1);
        } else adv(ms, undefined, 1);
        // invariants after every step
        for (let t = 0; t < 2; t++) { const on = ms.teams[t].on; if (on.length > 11) note('more than 11'); if (on.length < 7) note('fewer than 7'); if (new Set(on).size !== on.length) note('duplicate on pitch'); for (const i of on) { const p = ms.pl[i]; if (!p.on) note('on-list player flagged off'); if (p.t !== t) note('wrong team in list'); if (!(p.x >= -6 && p.x <= 106 && p.y >= -6 && p.y <= 106)) note('player out of bounds'); } if (on.filter((i) => ms.pl[i].line === 0).length !== 1) note('goalkeeper count != 1'); }
        if (ms.car >= 0) { const c = ms.pl[ms.car]; if (!c.on) note('carrier off pitch'); else if (c.t !== ms.poss) note('carrier not on possessing team'); if (Math.abs(c.x - ms.bx) + Math.abs(c.y - ms.by) > 0.01) note('ball not at carrier'); }
        if (!(ms.bx >= -8 && ms.bx <= 108 && ms.by >= -8 && ms.by <= 108)) note('ball out of bounds');
        const sc = ms.score[0] + ms.score[1]; if (sc < lastScore) note('score decreased'); lastScore = sc;
        if (ms.goals.length !== sc) note('goal log != score');
        if (!(ms.press >= 0 && ms.press <= 1)) note('pressure out of range');
      }
      if (!ms.done) note('match did not finish');
      for (const p of ms.pl) { for (const v of p.s) if (!(v >= 0) || !Number.isFinite(v)) { note('negative / NaN stat'); break; } if (p.s[S.G] > p.s[S.SH]) note('goals > shots'); if (p.s[S.PC] > p.s[S.PA]) note('passes completed > attempted'); if (p.s[S.RATN] && !(p.s[S.RAT] >= 3 && p.s[S.RAT] <= 10)) note('rating out of range'); if (p.used && p.s[S.APP] !== 1) note('used without appearance'); }
      const gs = [0, 1].map((t) => ms.pl.filter((p) => p.t === t).reduce((x, p) => x + p.s[S.G], 0)); const og = ms.goals.filter((x) => x[4] === 2).length;
      if (gs[0] + gs[1] + og !== ms.score[0] + ms.score[1]) note('player goals != score');
      if (me.used) { userGames++; if (me.s[S.SEC] >= 30 * 60 && me.ab.some((a) => a.id.includes('zero') || a.id.includes('genesis') || a.id.includes('trance'))) { ultMatches++; if (sawUlt) ultOffered++; } }
      finishUserMatch(g, ms);
      if (g.live) note('live not cleared');
    }
  }
  void kinds; void userGames;
  expect(issues).toEqual({});
  expect(noMarker).toBe(0);
  expect(decisions).toBeGreaterThan(200);
  // a player who owns an ultimate is offered it in (almost) every match he plays; it only unlocks once the match has settled
  expect(ultOffered).toBeGreaterThanOrEqual(ultMatches - 1);
  expect(matches).toBeGreaterThan(10);
}, 600000);
