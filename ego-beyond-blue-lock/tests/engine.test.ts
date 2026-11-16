import { describe, it, expect, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { defaultConfig, newGame, balancedAttrs, rebalance } from '../src/engine/career';
import { calcOvr, OUTFIELD, ovr, stylesFor } from '../src/engine/attributes';
import { compFixtures, tableOf } from '../src/engine/competitions';
import { createMatch, applyResult, simFixture } from '../src/engine/match/setup';
import { advance as advMatch } from '../src/engine/match/engine';
import { S, NSTAT, newLine, addLine, type MatchState } from '../src/engine/match/model';
import { shotGeo, xgLogit, logistic, PENALTY_XG } from '../src/engine/match/xg';
import { step, advance, autoPilot, startUserMatch, finishUserMatch, userFixtureToday, nextUserFixture, skipNel } from '../src/engine/sim';
import { weaponSlots, ultimateStatus, tryLearn, startDeveloping } from '../src/engine/development';
import { abilityDef, SLOTS } from '../src/engine/abilities';
import { payWages } from '../src/engine/development';
import { doTransfer } from '../src/engine/transfers';
import { cloneGame, exportSave, importSave, validate, migrate } from '../src/engine/save';
import { saveGame, loadGame, listSaves, deleteSave } from '../src/storage/idb';
import { SCHEMA_VERSION, type Game } from '../src/engine/types';
import { WEAPONS, PASSIVES, ULTIMATES, validateCustom, makeHybrid } from '../src/engine/abilities';

function mk(seed: number, over?: (c: ReturnType<typeof defaultConfig>) => void): Game {
  const cfg = defaultConfig(seed); cfg.name = 'Test Egoist';
  over?.(cfg);
  return newGame(cfg);
}

describe('ratings', () => {
  it('balanced creation hits the chosen OVR exactly for every position and style', () => {
    for (const pos of OUTFIELD) for (const target of [1, 20, 45, 62, 78, 86, 93, 99]) for (const style of stylesFor(pos)) {
      const a = balancedAttrs(pos, target, style, target * 31 + pos.length);
      expect(calcOvr(a, pos), `${pos} ${style} ${target}`).toBe(target);
      expect(a.every((v) => Number.isInteger(v) && v >= 1 && v <= 99)).toBe(true);
    }
  });
  it('rebalance keeps the target while honouring locked attributes', () => {
    const a = balancedAttrs('ST', 80, 'poacher', 5);
    a[0] = 99; a[14] = 40;
    const b = rebalance(a, 'ST', 80, [0, 14]);
    expect(b[0]).toBe(99); expect(b[14]).toBe(40); expect(calcOvr(b, 'ST')).toBe(80);
  });
  it('the created player has exactly the configured attributes and OVR', () => {
    for (const target of [55, 78, 95]) {
      const g = mk(target, (c) => { c.attrs = balancedAttrs('LW', target, 'dribbler', 9); c.pos = 'LW'; c.pot = 99; });
      const me = g.world.players[g.career.pid];
      expect(ovr(me)).toBe(target);
    }
  });
  it('ability catalogue meets the minimum sizes and every ability is fully described', () => {
    expect(WEAPONS.length).toBeGreaterThanOrEqual(15); expect(PASSIVES.length).toBeGreaterThanOrEqual(10); expect(ULTIMATES.length).toBeGreaterThanOrEqual(8);
    for (const d of [...WEAPONS, ...PASSIVES, ...ULTIMATES]) { for (const k of ['desc', 'req', 'cost', 'counter', 'limits'] as const) expect(d[k].length, `${d.id}.${k}`).toBeGreaterThan(3); expect(d.lines.length).toBeGreaterThan(0); }
    expect(ULTIMATES.some((u) => u.name === 'Dead Angle Genesis')).toBe(true);
    const h = makeHybrid(WEAPONS[0], WEAPONS[1], 'h1');
    expect(validateCustom(h, true)).toEqual([]);
    expect(validateCustom({ id: 'x', kind: 'weapon', name: 'Too Much', desc: '', fx: [{ k: 'SH_FIRST', v: 0.65 }, { k: 'SH_LONG', v: 0.6 }, { k: 'DR_TIGHT', v: 0.7 }] }, false).length).toBeGreaterThan(0);
  });
});

describe('xG model', () => {
  it('matches its documented calibration and behaves monotonically', () => {
    const at = (m: number) => logistic(xgLogit(shotGeo(100 - m / 1.05, 50), { pressure: 0 }));
    // inside the box chances sit between roughly 0.15 and 0.6; outside it they start near 0.2 at the edge and fade with distance
    expect(at(6)).toBeGreaterThan(0.4); expect(at(6)).toBeLessThan(0.66);
    expect(at(11)).toBeGreaterThan(0.2); expect(at(11)).toBeLessThan(0.4);
    expect(at(17.5)).toBeGreaterThan(0.17); expect(at(17.5)).toBeLessThan(0.21);
    expect(at(22)).toBeGreaterThan(0.09); expect(at(22)).toBeLessThan(0.14); expect(at(30)).toBeLessThan(0.07);
    expect(at(8)).toBeGreaterThan(at(14)); expect(at(14)).toBeGreaterThan(at(22)); expect(at(22)).toBeGreaterThan(at(32));
    const g = shotGeo(90, 50);
    expect(logistic(xgLogit(g, { pressure: 0.8 }))).toBeLessThan(logistic(xgLogit(g, { pressure: 0 })));
    expect(logistic(xgLogit(g, { pressure: 0, header: true }))).toBeLessThan(logistic(xgLogit(g, { pressure: 0 })));
    expect(PENALTY_XG).toBe(0.76);
  });
});

describe('Neo Egoist League', () => {
  let g: Game;
  beforeAll(() => { g = mk(4242); g.world.keepLines = true; autoPilot(g, (x) => x.world.nel.round >= 5); });
  it('has exactly ten fixtures, four per club, two matches and one resting team per round', () => {
    const fs = compFixtures(g.world, 'nel');
    expect(fs.length).toBe(10);
    for (const t of g.world.nel.teams) expect(fs.filter((f) => f.h === t || f.a === t).length).toBe(4);
    for (let rd = 1; rd <= 5; rd++) { const r = fs.filter((f) => f.rd === rd); expect(r.length).toBe(2); expect(new Set(r.flatMap((f) => [f.h, f.a])).size).toBe(4); }
    const pairs = new Set(fs.map((f) => [f.h, f.a].sort().join('|'))); expect(pairs.size).toBe(10);
  });
  it('every match ends exactly when a team reaches three goals — never on the clock', () => {
    for (const f of compFixtures(g.world, 'nel')) {
      expect(f.played).toBe(true);
      expect(Math.max(...f.sc!)).toBe(3); expect(Math.min(...f.sc!)).toBeLessThan(3);
      expect(f.goals!.length).toBe(f.sc![0] + f.sc![1]);
      const last = f.goals![f.goals!.length - 1];
      expect(f.sc![last[1]]).toBe(3);
    }
  });
  it('scores equal recorded goal events and player stats reconcile with match lines', () => {
    const w = g.world;
    const sum: Record<string, number[]> = {};
    for (const f of compFixtures(w, 'nel')) {
      let h = 0, a = 0;
      for (const gl of f.goals!) { if (gl[1] === 0) h++; else a++; }
      expect([h, a]).toEqual(f.sc);
      let goals = 0, og = 0;
      for (const pid in f.lines!) { addLine((sum[pid] ??= newLine()), f.lines![pid]); goals += f.lines![pid][S.G]; og += f.lines![pid][S.OG]; }
      expect(goals + og).toBe(f.sc![0] + f.sc![1]);
    }
    for (const pid in sum) { const ss = w.players[pid].ss.nel; for (let i = 0; i < NSTAT; i++) expect(ss[i]).toBeCloseTo(sum[pid][i], 6); }
  });
  it('the table reconciles with results', () => {
    const tab = tableOf(g.world, 'nel');
    expect(tab.reduce((s, r) => s + r.w, 0)).toBe(10); expect(tab.reduce((s, r) => s + r.l, 0)).toBe(10);
    expect(tab.reduce((s, r) => s + r.gf, 0)).toBe(tab.reduce((s, r) => s + r.ga, 0));
    for (const r of tab) { expect(r.p).toBe(4); expect(r.pts).toBe(r.w * 3); expect(r.d).toBe(0); }
  });
  it('bids exist per player/club/round and round awards use players who actually played that round', () => {
    const w = g.world;
    const bids = Object.values(w.nel.bids).filter((b) => b.top > 0);
    expect(bids.length).toBeGreaterThan(30);
    for (const b of bids) { expect(b.hist.length).toBeGreaterThan(0); expect(b.bids[0].amt).toBe(b.top); expect(b.bids[0].why.length).toBeGreaterThan(0); }
    const deltas = new Set(bids.flatMap((b) => b.hist.map((h) => h.delta)));
    expect(deltas.size).toBeGreaterThan(20); // not a fixed increment per goal
    expect(bids.some((b) => b.hist.some((h) => h.delta < 0))).toBe(true); // bids can fall
    for (let rd = 1; rd <= 5; rd++) {
      const a = w.awards[`potr:nel:${w.season}:${rd}`];
      expect(a).toBeTruthy();
      const played = compFixtures(w, 'nel').filter((f) => f.rd === rd).some((f) => f.lines![a.winner!.pid]?.[S.RATN] > 0);
      expect(played).toBe(true);
      const xi = w.awards[`totr:nel:${w.season}:${rd}`];
      expect(xi.xi!.length).toBe(11); expect(xi.xi!.filter((x) => x.pos === 'GK').length).toBe(1);
      expect(new Set(xi.xi!.map((x) => x.pid)).size).toBe(11);
    }
  });
});

describe('match rules', () => {
  const g = mk(99);
  it('Star Change ends after the permitted playing time', () => {
    let seen = 0;
    for (const f of compFixtures(g.world, 'nel')) {
      const ms = createMatch(g, f, 'sim'); ms.verb = 0; advMatch(ms);
      for (const T of ms.teams) if (T.starState >= 1) {
        const star = ms.pl[T.star];
        seen++;
        expect(star.s[S.PLAY]).toBeLessThanOrEqual(g.settings.nel.starSec + 12);
        if (T.starState === 2) expect(star.on).toBe(false);
      }
      for (const p of ms.pl) if (p.star && !ms.teams[p.t].starState) expect(p.s[S.PLAY]).toBe(0);
    }
    expect(seen).toBeGreaterThan(3);
  });
  it('regulation matches run the full ninety minutes plus stoppage and never stop on a goal count', () => {
    const w = g.world;
    const clubs = Object.values(w.clubs).filter((c) => c.league === 'eng1').map((c) => c.id);
    let draws = 0, big = 0;
    for (let i = 0; i < 60; i++) {
      const fx = { id: 'r' + i, comp: 'eng1', s: w.season, rd: 1, day: 0, h: clubs[i % 20], a: clubs[(i + 7) % 20], played: false } as any;
      const ms = createMatch(g, fx, 'sim'); advMatch(ms);
      expect(ms.done).toBe(true); expect(ms.clock).toBeGreaterThanOrEqual(5400 + 60); expect(ms.period).toBe(2);
      expect(ms.goals.length).toBe(ms.score[0] + ms.score[1]);
      if (ms.winner === -1) draws++;
      if (ms.score[0] + ms.score[1] > 3) big++;
    }
    expect(draws).toBeGreaterThan(3); expect(big).toBeGreaterThan(3);
  });
  it('knockout ties always produce a winner (extra time / penalties)', () => {
    const w = g.world;
    const clubs = Object.values(w.clubs).filter((c) => c.league === 'eng2').map((c) => c.id);
    let et = 0;
    for (let i = 0; i < 40; i++) {
      const fx = { id: 'k' + i, comp: 'eng2', s: w.season, rd: 1, day: 0, h: clubs[i % 24], a: clubs[(i + 5) % 24], played: false, ko: true } as any;
      const ms = createMatch(g, fx, 'sim'); advMatch(ms);
      expect(ms.winner).toBeGreaterThanOrEqual(0);
      if (ms.period >= 3) { et++; expect(ms.clock).toBeGreaterThanOrEqual(7200); }
      if (ms.pens) expect(ms.score[0]).toBe(ms.score[1]);
    }
    expect(et).toBeGreaterThan(2);
  });
  it('interactive matches are deterministic and resume identically from a saved decision point', () => {
    const g1 = mk(31337, (c) => { c.attrs = balancedAttrs('ST', 90, 'poacher', 1); c.pot = 96; });
    autoPilot(g1, () => !!userFixtureToday(g1) && g1.world.stage === 1);
    const g2 = cloneGame(g1);
    const play = (g: Game, saveAt: number): MatchState => {
      let ms = startUserMatch(g, 'full')!;
      advMatch(ms);
      let n = 0;
      while (!ms.done) {
        expect(ms.pending).toBeTruthy();
        if (++n === saveAt) ms = JSON.parse(JSON.stringify(ms));
        advMatch(ms, ms.pending!.options[n % ms.pending!.options.length].id);
      }
      return ms;
    };
    const a = play(g1, -1), b = play(g2, 5);
    expect(a.uc!.decisions).toBeGreaterThan(5);
    expect(b.score).toEqual(a.score); expect(b.goals).toEqual(a.goals); expect(b.pl[b.uc!.idx].s).toEqual(a.pl[a.uc!.idx].s);
  });
  it('a high starting OVR genuinely makes the player stronger', () => {
    const run = (o: number) => { let r = 0, n = 0, gl = 0; for (const seed of [1, 2, 3]) { const g = mk(seed, (c) => { c.attrs = balancedAttrs('ST', o, 'poacher', 3); c.pot = 99; }); autoPilot(g, (x) => x.world.nel.round >= 5); const l = g.world.players[g.career.pid].ss.nel; if (l) { r += l[S.RAT]; n += l[S.RATN]; gl += l[S.G]; } } return { avg: n ? r / n : 0, n, gl }; };
    const hi = run(96), lo = run(58);
    expect(hi.n).toBeGreaterThan(lo.n); // the star plays, the raw prospect mostly watches
    expect(hi.avg).toBeGreaterThan(6.6); expect(hi.gl).toBeGreaterThan(lo.gl + 3);
  });
});

describe('idempotency and persistence', () => {
  it('processing a match or a day twice never duplicates anything', () => {
    const g = mk(555);
    autoPilot(g, () => !!userFixtureToday(g) && g.world.stage === 1);
    const before = JSON.stringify({ n: g.world.newsId, w: g.career.wages, a: g.world.awardIds.length, t: g.world.transfers.length, abs: g.world.abs });
    for (let i = 0; i < 5; i++) expect(step(g)).toBe('match');
    payWages(g); payWages(g);
    expect(JSON.stringify({ n: g.world.newsId, w: g.career.wages, a: g.world.awardIds.length, t: g.world.transfers.length, abs: g.world.abs })).toBe(before);
    const ms = startUserMatch(g, 'sim')!; advMatch(ms);
    const fx = g.world.fixtures[ms.fid];
    finishUserMatch(g, ms);
    const goals = g.world.players[g.career.pid].ss.nel?.[S.G] ?? 0, apps = g.career.matches.length;
    expect(applyResult(g, fx, ms)).toBe(false);
    expect(finishUserMatch(g, ms)).toEqual([]);
    expect(simFixture(g, fx)).toBeNull();
    expect(g.world.players[g.career.pid].ss.nel?.[S.G] ?? 0).toBe(goals); expect(g.career.matches.length).toBe(apps);
  });
  it('a reloaded save continues exactly like the original (no rerolls)', () => {
    const g = mk(808);
    autoPilot(g, (x) => x.world.day >= 9);
    const copy = importSave(exportSave(g));
    autoPilot(g, (x) => x.world.day >= 30); autoPilot(copy, (x) => x.world.day >= 30);
    expect(copy.world.rng).toEqual(g.world.rng);
    expect(compFixtures(copy.world, 'nel').map((f) => f.sc)).toEqual(compFixtures(g.world, 'nel').map((f) => f.sc));
    expect(copy.world.news.map((n) => n.title)).toEqual(g.world.news.map((n) => n.title));
    expect(copy.world.nel.bids).toEqual(g.world.nel.bids);
  });
  it('saves, lists, loads and deletes through IndexedDB', async () => {
    const g = mk(909);
    autoPilot(g, (x) => x.world.day >= 6);
    const meta = await saveGame(g, 'manual', 'slot A');
    expect((await listSaves()).some((s) => s.slot === meta.slot && s.summary.name === 'Test Egoist')).toBe(true);
    const back = await loadGame(meta.slot);
    expect(JSON.stringify(back)).toBe(JSON.stringify(g));
    await deleteSave(meta.slot);
    await expect(loadGame(meta.slot)).rejects.toThrow();
  });
  it('rejects corrupt or foreign files and migrates older schemas', () => {
    const g = mk(1010);
    expect(validate(g)).toEqual([]);
    expect(() => importSave('{not json')).toThrow(/not valid JSON/);
    expect(() => importSave('{"hello":1}')).toThrow(/not an EGO/);
    const bad = JSON.parse(exportSave(g)); delete bad.game.world.players[g.career.pid];
    expect(() => importSave(JSON.stringify(bad))).toThrow(/damaged/);
    const bad2 = JSON.parse(exportSave(g)); bad2.game.world.rng = [1, 2];
    expect(() => importSave(JSON.stringify(bad2))).toThrow(/damaged/);
    const old = JSON.parse(JSON.stringify(g)); old.schema = 1; delete old.career.custom; delete old.world.events;
    const m = migrate(old);
    expect(m.schema).toBe(SCHEMA_VERSION); expect(m.career.custom).toEqual([]); expect(m.world.events).toEqual([]);
    const future = JSON.parse(JSON.stringify(g)); future.schema = 999;
    expect(() => migrate(future)).toThrow(/newer version/);
  });
  it('transfers keep the same player identity, history and relationships', () => {
    const g = mk(1111);
    const w = g.world;
    const p = Object.values(w.players).find((x) => x.club === 'eng1_ars' && x.origin === 'real')!;
    p.hist.push({ s: 2024, club: 'x', clubName: 'X', comp: 'c', compName: 'C', ap: 1, st: 1, min: 90, g: 1, a: 0, rt: 700, mom: 0, cs: 0, yc: 0, rc: 0, ovr: 80 });
    const id = p.id, attrs = p.a.slice();
    const t = doTransfer(g, p, w.clubs.esp1_rma, 50e6, 'transfer');
    expect(w.players[id]).toBe(p); expect(p.a).toEqual(attrs); expect(p.hist.length).toBe(1);
    expect(p.club).toBe('esp1_rma'); expect(w.clubs.esp1_rma.squad).toContain(id); expect(w.clubs.eng1_ars.squad).not.toContain(id);
    expect(t.pid).toBe(id); expect(t.from).toBe('eng1_ars'); expect(p.con!.club).toBe('esp1_rma');
  });
});

describe('weapons, ultimate and career start', () => {
  it('starts with one weapon, a dormant ultimate, and unlocks further weapons through progression (max four)', () => {
    const g = mk(4040, (c) => { c.weapons = ['direct_shot', 'blindside']; c.ultimate = 'dead_angle_genesis'; c.attrs = balancedAttrs('ST', 90, 'poacher', 2); c.pot = 96; });
    const me = g.world.players[g.career.pid];
    const kinds = (k: string) => me.ab.filter((r) => abilityDef(r.id)?.kind === k);
    expect(kinds('weapon').length).toBe(1); expect(kinds('ultimate').length).toBe(0);
    expect(SLOTS.weapon).toBe(4); expect(weaponSlots(g).open).toBe(1);
    expect(ultimateStatus(g)).toMatchObject({ id: 'dead_angle_genesis', awake: false, ready: false });
    // cannot learn without an open slot, even with full practice
    startDeveloping(g, 'blindside'); g.career.learning.blindside.practice = 100;
    expect(tryLearn(g, 'blindside')).toBe(false);
    kinds('weapon')[0].lv = 2;
    expect(weaponSlots(g).open).toBe(2); expect(tryLearn(g, 'blindside')).toBe(true); expect(kinds('weapon').length).toBe(2);
    // ultimates can never be copied from another player
    g.career.learning.zero_frame = { exposure: 100, practice: 100 };
    expect(tryLearn(g, 'zero_frame')).toBe(false);
    // the ultimate awakens only once every requirement is met, after a match
    kinds('weapon')[0].lv = 3; g.career.flags.flowCount = 5;
    autoPilot(g, () => g.career.matches.filter((m) => m.line).length >= 3);
    expect(ultimateStatus(g).awake).toBe(false);
    for (let i = 0; i < 12; i++) g.career.matches.push({ ...g.career.matches[0], fid: 'x' + i, line: g.career.matches.find((m) => m.line)!.line });
    autoPilot(g, () => kinds('ultimate').length > 0 || g.world.phase === 'pro');
    expect(kinds('ultimate').map((r) => r.id)).toEqual(['dead_angle_genesis']);
  });
  it('can skip the NEL and start directly in regulation football at a chosen club', () => {
    const g = mk(5050, (c) => { c.skipNel = true; c.proClub = 'eng2_cov'; });
    skipNel(g, 'eng2_cov');
    const w = g.world, me = w.players[g.career.pid];
    expect(w.phase).toBe('pro'); expect(me.club).toBe('eng2_cov'); expect(me.con).toBeTruthy();
    expect(w.nel.done).toBe(true); expect(Object.keys(w.nel.bids).includes(me.id)).toBe(false);
    expect(g.career.matches.length).toBe(0);
    const fx = nextUserFixture(g)!; expect(w.comps[fx.comp].rules).toBe('reg');
    expect(validate(g)).toEqual([]);
  });
  it('bids follow performance as well as ability', () => {
    const g = mk(6060); autoPilot(g, (x) => x.world.nel.round >= 5);
    const w = g.world;
    const rows = Object.values(w.nel.bids).filter((b) => b.top > 0).map((b) => { const p = w.players[b.pid]; const r = b.perf.filter((x) => x > 0); return { o: ovr(p), avg: r.reduce((s, x) => s + x, 0) / r.length, top: b.top }; });
    // among players of similar ability, the better performers are valued higher
    let better = 0, pairs = 0;
    for (const a of rows) for (const b of rows) if (Math.abs(a.o - b.o) <= 1 && a.avg > b.avg + 0.7) { pairs++; if (a.top > b.top) better++; }
    expect(pairs).toBeGreaterThan(10); expect(better / pairs).toBeGreaterThan(0.8);
    // and a lower-rated player in form can out-value a higher-rated one out of form
    expect(rows.some((a) => rows.some((b) => a.o <= b.o - 3 && a.top > b.top))).toBe(true);
  });
  it('offers lofted and driven passes as well as ground passes', () => {
    const g = mk(7070, (c) => { c.attrs = balancedAttrs('CM', 92, 'playmaker', 2); c.pos = 'CM'; c.pot = 96; c.settings.freq = 2; });
    autoPilot(g, () => !!userFixtureToday(g) && g.world.stage === 1);
    const ms = startUserMatch(g, 'full')!; advMatch(ms);
    const seen = new Set<string>(); let n = 0, lobDone = false;
    while (!ms.done && n++ < 400) { const o = ms.pending!.options; for (const x of o) { if (x.id.endsWith(':lob')) seen.add('lob'); if (x.id.endsWith(':driven')) seen.add('driven'); expect(x.p).toBeGreaterThan(0); expect(x.p).toBeLessThanOrEqual(1); } const lob = o.find((x) => x.id.endsWith(':lob')); if (lob && !lobDone) { lobDone = true; advMatch(ms, lob.id); } else advMatch(ms, o[0].id); }
    expect(seen.has('lob')).toBe(true); expect(seen.has('driven')).toBe(true); expect(lobDone).toBe(true);
  });
});

import { tournamentsFor } from '../src/engine/international';
import { requestSub, subChance } from '../src/engine/match/engine';
import { xgLogit as xgL2, shotGeo as geo2, logistic as lg2 } from '../src/engine/match/xg';
import { doAction as doAct2, canAct as canAct2 } from '../src/engine/interactions';
import { newGame as ng2, defaultConfig as dc2 } from '../src/engine/career';
import { startUserMatch as sum2, userFixtureToday as uft2, autoPilot as ap2 } from '../src/engine/sim';
import { advance as adv2 } from '../src/engine/match/engine';

describe('later additions', () => {
  it('schedules every international tournament on its cycle', () => {
    const ids = (y: number) => tournamentsFor(y).map((t) => t.id).sort();
    expect(ids(2026)).toEqual(['u20asian', 'u21euro', 'wc']);
    expect(ids(2027)).toEqual(['afcon', 'asian', 'gold', 'u20wc']);
    expect(ids(2028)).toEqual(['copa', 'euro', 'u20asian', 'u21euro']);
    expect(ids(2029)).toEqual(['u20wc']);
  });
  it('xG is realistic for clear chances', () => {
    const x = (ax: number, y: number, o: object = {}) => lg2(xgL2(geo2(ax, y), { pressure: 0, ...o }));
    expect(x(96.5, 50)).toBeGreaterThan(0.5); // tap-in from four metres
    expect(x(89.5, 50, { oneOnOne: true })).toBeGreaterThan(x(89.5, 50)); // clean through from the penalty spot
    expect(x(89.5, 50)).toBeGreaterThan(0.2); expect(x(89.5, 50)).toBeLessThan(0.4);
    expect(x(89.5, 50, { pressure: 1 })).toBeGreaterThan(0.15); // even fully pressured, a shot from the spot is a real chance
    expect(x(83.5, 50)).toBeGreaterThan(0.17); // edge of the box: about 0.2, as requested
    expect(x(89.5, 50, { pressure: 1 })).toBeLessThan(x(89.5, 50));
  });
  it('a benched player can ask to come on, and replays are captured for interactive matches', () => {
    const cfg = dc2(991); cfg.name = 'Bench Test';
    const g = ng2(cfg);
    ap2(g, (x) => !!uft2(x) && x.world.stage === 1);
    const ms = sum2(g, 'full')!;
    const me = ms.pl[ms.uc!.idx];
    adv2(ms, undefined, 50);
    if (!me.on && !me.used) {
      expect(subChance(ms)).toBeGreaterThan(0);
      ms.uc!.trust = 100;
      let ok = false;
      for (let i = 0; i < 12 && !ok; i++) { ms.uc!.asked = 0; ok = requestSub(ms).ok; }
      expect(ok).toBe(true); expect(me.on).toBe(true); expect(me.used).toBe(true);
      expect(subChance(ms)).toBe(0);
    }
    let n = 0;
    while (!ms.done && n++ < 3000) adv2(ms, ms.pending ? ms.pending.options[0].id : undefined, 400);
    expect(ms.done).toBe(true);
    expect((ms.replays ?? []).some((r) => r.res === 'goal')).toBe(true);
    for (const r of ms.replays ?? []) { expect(r.pl.length).toBeGreaterThan(14); expect(r.xg).toBeGreaterThan(0); }
  });
  it('friendships can be kept alive at a distance without using social time', () => {
    const cfg = dc2(993); cfg.name = 'Far Friend';
    const g = ng2(cfg);
    const me = g.world.players[g.career.pid];
    const other = Object.values(g.world.players).find((p) => p.club && p.club !== me.club && !p.retired)!;
    expect(canAct2(g, other.id, 'catchup')).toBeNull();
    const used = g.career.social.used;
    const r = doAct2(g, other.id, 'catchup');
    expect(r.effects.length).toBeGreaterThan(0);
    expect(g.career.social.used).toBe(used);
    expect(g.career.rel[other.id].friend).toBeGreaterThan(0);
    expect(canAct2(g, other.id, 'catchup')).toBeTruthy(); // once a week
  });
  it('a career can be started as an existing NEL player', () => {
    const cfg = dc2(995); cfg.playAs = 'Yoichi Isagi';
    const g = ng2(cfg);
    const me = g.world.players[g.career.pid];
    expect(me.name).toBe('Yoichi Isagi'); expect(me.nelTeam).toBe('nel_bastard'); expect(me.club).toBe('nel_bastard');
    expect(Object.values(g.world.players).filter((p) => p.name === 'Yoichi Isagi').length).toBe(1);
    expect(me.ab.some((a) => a.id === 'zero_frame')).toBe(true);
    expect(Object.keys(g.career.rel).length).toBeGreaterThan(10);
    ap2(g, (x) => x.world.phase === 'pro');
    expect(g.world.players[g.career.pid].club).toBeTruthy();
  });
  it('accounts: sign up, wrong password, sign in, admin', async () => {
    const acc = await import('../src/storage/accounts');
    expect(acc._sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(acc._sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await acc.signUp('ab', 'pw')).toBeTruthy();
    expect(await acc.signUp('Tej_1', 'secret')).toBeNull();
    expect(acc.currentUser()).toBe('tej_1');
    expect(await acc.signUp('tej_1', 'other')).toMatch(/taken/);
    acc.signOut(); expect(acc.currentUser()).toBeNull();
    expect(await acc.signIn('tej_1', 'nope')).toMatch(/Wrong/);
    expect(await acc.signIn('TEJ_1', 'secret')).toBeNull();
    expect(acc.isAdmin()).toBe(false);
    expect(await acc.signIn('Adm!n', '000000')).toMatch(/Wrong/);
    expect(await acc.signIn('Adm!n', '670912')).toBeNull();
    expect(acc.isAdmin()).toBe(true);
    acc.signOut(); expect(acc.isAdmin()).toBe(false);
  });
  it('saves are scoped to the signed-in account', async () => {
    const acc = await import('../src/storage/accounts');
    const idb = await import('../src/storage/idb');
    acc.signOut();
    await acc.signUp('owner_a', 'pass1');
    const g = ng2(dc2(4471));
    await idb.saveGame(g, 'auto');
    expect((await idb.listSaves()).some((s) => s.careerId === g.id)).toBe(true);
    acc.signOut();
    expect((await idb.listSaves()).some((s) => s.careerId === g.id)).toBe(false);
    await acc.signUp('owner_b', 'pass2');
    expect((await idb.listSaves()).some((s) => s.careerId === g.id)).toBe(false);
    await acc.signIn('Adm!n', '670912');
    expect((await idb.listSaves()).some((s) => s.careerId === g.id)).toBe(true);
    acc.signOut();
  });
  it('a goalkeeper career: the user decides how to face every shot', () => {
    const cfg = dc2(881); cfg.name = 'Keeper'; cfg.pos = 'GK'; cfg.pos2 = []; cfg.attrs = balancedAttrs('GK', 86, 'balanced', 3); cfg.skipNel = true;
    const g = ng2(cfg); skipNel(g, '');
    const me = g.world.players[g.career.pid];
    expect(me.pos).toBe('GK'); expect(ovr(me)).toBeGreaterThan(80);
    let keeper = 0, saves = 0, played = 0;
    for (let m = 0; m < 6 && keeper < 6; m++) {
      ap2(g, (x) => !!uft2(x) && x.world.stage === 1, 60);
      const ms = sum2(g, 'full'); if (!ms) break;
      if (!ms.uc) { adv2(ms); finishUserMatch(g, ms); continue; }
      const mp = ms.pl[ms.uc.idx];
      let n = 0;
      while (!ms.done && n++ < 4000) {
        const d = ms.pending;
        if (d) { if (d.kind === 'keeper') { keeper++; expect(d.options.length).toBeGreaterThanOrEqual(3); for (const o of d.options) expect(o.p).toBeGreaterThan(0); expect(mp.line).toBe(0); } adv2(ms, d.options[n % d.options.length].id, 1); }
        else adv2(ms, undefined, 1);
      }
      if (mp.used) { played++; saves += mp.s[S.SV]; expect(d2k(ms)).toBe(true); }
      finishUserMatch(g, ms);
    }
    if (played) { expect(keeper).toBeGreaterThan(0); expect(saves).toBeGreaterThan(0); }
  });
  it('match simulator: custom team sheets are used and many-sim shares add up', async () => {
    const q = await import('../src/engine/quickmatch');
    const g = q.simWorld(77);
    const a = q.autoSheet(g, 'eng1_ars'), b = q.autoSheet(g, 'IND');
    expect(a.xi.length).toBe(11); expect(b.xi.length).toBe(11);
    const swapped = { ...a, xi: [a.xi[0], ...a.xi.slice(1).reverse()] };
    const ms = q.playSim(g, 'eng1_ars', 'IND', [swapped, b], { record: true });
    expect(ms.done).toBe(true);
    const started = ms.pl.filter((p) => p.t === 0 && p.started).map((p) => p.id).sort();
    expect(started).toEqual([...swapped.xi].sort());
    expect((ms.replays ?? []).length).toBeGreaterThan(0);
    const many = q.playMany(g, 'eng1_ars', 'IND', [a, b], 12);
    expect(many.h + many.d + many.a).toBe(12); expect(many.h).toBeGreaterThan(many.a);
    expect(many.notable.length).toBeGreaterThan(0);
    for (const x of many.notable) { expect(x.ms.done).toBe(true); expect(x.sum.score).toEqual([x.ms.score[0], x.ms.score[1]]); }
    expect(many.notable.filter((x) => x.key === 'bigHome').every((x) => x.sum.score[0] > x.sum.score[1])).toBe(true);
    expect(many.players.reduce((n, p) => n + p.g, 0)).toBeGreaterThan(0);
    expect(many.team[0].poss + many.team[1].poss).toBeCloseTo(100, 0);
    // the Blue Lock XI: Blue Lock players only, and nobody plays for both sides against a club that has some of them
    const bl = q.autoSheet(g, 'sim_bluelock');
    expect(bl.xi.length).toBe(11);
    expect(bl.xi.every((id) => g.world.players[id].origin === 'bluelock')).toBe(true);
    const vs = q.playSim(g, 'sim_bluelock', 'nel_bastard', [bl, q.autoSheet(g, 'nel_bastard')]);
    const ids = vs.pl.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of q.SPECIAL_XIS) expect(q.autoSheet(g, x.id).xi.length, x.id).toBe(11);
    const nel = q.playSim(g, 'nel_bastard', 'nel_pxg', [q.autoSheet(g, 'nel_bastard'), q.autoSheet(g, 'nel_pxg')], { nel: true });
    expect(Math.max(nel.score[0], nel.score[1])).toBe(3);
  });
  it('every FIFA nation exists and World Cup qualifying produces 32 finalists', async () => {
    const { NATIONS } = await import('../src/engine/data/nations');
    expect(Object.keys(NATIONS).length).toBeGreaterThan(205);
    for (const id of ['IND', 'PAK', 'CHN', 'BAN', 'THA', 'FIJ', 'BOL']) expect(NATIONS[id], id).toBeTruthy();
    const intl = await import('../src/engine/international');
    const cfg = dc2(883); cfg.name = 'Qualifier'; cfg.nat = 'IND'; cfg.skipNel = true;
    const g = ng2(cfg); skipNel(g, '');
    expect(g.world.wcq?.year).toBe(2026);
    const mine = g.world.wcq!.groups.find((x) => x.teams.includes('IND'))!;
    expect(mine.conf).toBe('AFC');
    expect(g.world.wcq!.groups.reduce((n, x) => n + x.slots, 0)).toBe(32);
    ap2(g, (x) => x.world.day >= 250);
    expect(mine.next).toBeGreaterThan(0);
    const q = intl.finalizeWcq(g);
    expect(new Set(q).size).toBe(32);
    for (const gr of g.world.wcq!.groups) { const played = Object.values(gr.tab).reduce((n, r) => n + r[0], 0); expect(played % 2).toBe(0); expect(played).toBeGreaterThan(0); }
  });
});
describe('banter and rivalries', () => {
  it('ships more than 500 lines of banter and resolves a line for any player', async () => {
    const b = await import('../src/engine/data/banter');
    expect(b.countBanterLines()).toBeGreaterThan(500);
    const g = ng2(dc2(551));
    const ps = Object.values(g.world.players).slice(0, 300);
    for (const p of ps) for (const sit of ['pre', 'theyScore', 'youScore', 'youMiss', 'theyWon', 'press'] as const) { const l = b.banterLine(p, sit, 'Tej', 'Club', 2025, 3); expect(l.length).toBeGreaterThan(2); expect(l).not.toMatch(/\{(me|r|club)\}/); }
    const kaiser = Object.values(g.world.players).find((p) => p.name === 'Michael Kaiser')!;
    expect(new Set([1, 2, 4, 5, 7, 8].map((n) => b.banterLine(kaiser, 'pre', 'Tej', 'BM', 2025, n))).size).toBeGreaterThan(1);
  });
  it('post-match interviews fit the result: no bragging after a defeat', async () => {
    const rv = await import('../src/engine/rivalry');
    const b = await import('../src/engine/data/banter');
    const g = ng2(dc2(553));
    const line = (gl: number) => { const l = new Array(40).fill(0); l[S.APP] = 1; l[S.G] = gl; l[S.RATN] = 1; return l; };
    const ms = { uc: { idx: 0 }, pl: [{ t: 0, id: g.career.pid, used: true }] } as unknown as MatchState;
    const brag = /best player on that pitch|Tonight proved it|Nobody stops me|team did the work|collective win/i;
    const cases: [string, [number, number], number, number, boolean, string[]][] = [
      ['L', [0, 3], 6.4, 0, false, ['heavyLoss']], ['L', [1, 2], 6.6, 0, false, ['loss']], ['L', [2, 3], 8.6, 2, true, ['starLoss']], ['L', [0, 1], 5.6, 0, false, ['poorLoss']],
      ['W', [4, 0], 7.0, 0, false, ['bigWin']], ['W', [3, 1], 8.8, 2, true, ['starWin']], ['D', [1, 1], 6.8, 0, false, ['draw']], ['D', [2, 2], 8.4, 2, true, ['starDraw']],
    ];
    for (const [res, sc, rat, gl, potm, kinds] of cases) {
      let iv = null;
      for (let k = 0; k < 40 && !iv; k++) iv = rv.interviewFor(g, { fid: `f${k}${res}${sc}`, line: line(gl), res, sc, rat, potm, oppName: 'Rivals FC' } as never, ms);
      expect(iv, `${res} ${sc}`).toBeTruthy();
      expect(kinds).toContain(iv!.kind);
      expect(iv!.result).toBe(res);
      expect(iv!.question).not.toMatch(/\{/);
      if (res === 'L') for (const a of iv!.answers) expect(a.text, a.text).not.toMatch(brag);
      if (sc[0] - sc[1] <= -2) expect(iv!.question).toMatch(/defeat|painful|worst|left early|explain/i);
    }
    for (const k in b.ANSWERS) for (const t of ['humble', 'confident', 'ego'] as const) expect((b.ANSWERS as Record<string, Record<string, string[]>>)[k][t].length, k + t).toBeGreaterThan(2);
  });
  it('rivalries form from matches, keep a head-to-head and feed the tunnel scene and interviews', async () => {
    const rv = await import('../src/engine/rivalry');
    const cfg = dc2(552); cfg.name = 'Rival Test'; cfg.attrs = balancedAttrs('ST', 90, 'poacher', 3);
    const g = ng2(cfg);
    let formed = false, faced = false, asked = false;
    for (let m = 0; m < 10; m++) {
      ap2(g, (x) => !!uft2(x) && x.world.stage === 1, 80);
      const fx = uft2(g); if (!fx) break;
      const side = fx.h === g.world.players[g.career.pid].club ? fx.h : fx.a;
      const f = rv.faceoffFor(g, fx, side);
      if (f) { faced = true; expect(f.lines[0].length).toBeGreaterThan(2); expect(f.replies.length).toBe(3); const fxs = rv.applyFaceoff(g, fx, f.rival.id, 'fire'); expect(fxs.length).toBeGreaterThan(0); expect(rv.hypeFlow(g, fx.id)).toBe(34); }
      const ms = sum2(g, 'full'); if (!ms) break;
      if (f && ms.uc) expect(ms.pl[ms.uc.idx].fl).toBeGreaterThanOrEqual(34);
      let n = 0;
      while (!ms.done && n++ < 4000) { const d = ms.pending; if (d) { const sh = d.options.filter((o) => o.kind === 'shoot').sort((a, b) => b.p - a.p)[0]; adv2(ms, (sh ?? d.options[0]).id, 1); } else adv2(ms, undefined, 1); }
      finishUserMatch(g, ms);
      const um = g.career.matches[g.career.matches.length - 1];
      const iv = rv.interviewFor(g, um, ms);
      if (iv) { asked = true; const out = rv.applyInterview(g, iv, 'ego'); expect(out.length).toBeGreaterThan(0); }
      if (g.career.rivals.length) formed = true;
    }
    expect(formed).toBe(true); expect(asked).toBe(true);
    const rid = g.career.rivals[0];
    expect(g.career.rel[rid].rival).toBeGreaterThanOrEqual(14);
    void faced;
  });
});
const d2k = (ms: MatchState) => ms.pl.every((p) => p.s.every((v) => Number.isFinite(v) && v >= 0));
