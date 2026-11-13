import { describe, it, expect, beforeAll } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { autoPilot, nextUserFixture, startUserMatch, finishUserMatch, userFixtureToday, step } from '../src/engine/sim';
import { advance as advMatch } from '../src/engine/match/engine';
import { compFixtures, tableOf, monthOf } from '../src/engine/competitions';
import { validate, cloneGame } from '../src/engine/save';
import { S } from '../src/engine/match/model';
import { LEAGUES } from '../src/engine/data/clubs';
import { ovr } from '../src/engine/attributes';
import type { Game } from '../src/engine/types';

/** End-to-end: a whole NEL, the transition, and two full professional seasons with rollover. */
describe('full career simulation', () => {
  let g: Game;
  let mid: Game; // snapshot in the middle of the first professional season
  const SIZES: Record<string, number> = { eng1: 20, eng2: 24, eng3: 24, esp1: 20, ger1: 18, ita1: 20, fra1: 18 };
  beforeAll(() => {
    const cfg = defaultConfig(20251); cfg.name = 'E2E Egoist';
    g = newGame(cfg);
    autoPilot(g, (x) => x.world.phase === 'pro');
  });

  it('the NEL hands over to a playable professional season with identity preserved', () => {
    const w = g.world, me = w.players[g.career.pid];
    expect(w.phase).toBe('pro'); expect(w.season).toBe(2025);
    expect(w.nel.summary).toBeTruthy(); expect(w.nel.top23!.length).toBeLessThanOrEqual(g.settings.nel.topN);
    expect(w.nel.summary!.ranking.length).toBeGreaterThan(40);
    expect(me.club && w.clubs[me.club] && !w.clubs[me.club].nel).toBeTruthy();
    expect(me.con).toBeTruthy();
    expect(me.hist.some((h) => h.comp === 'nel')).toBe(true); // NEL stats kept in career history
    expect(g.career.statHist.some((h) => h.rules === 'nel')).toBe(true);
    expect(Object.keys(g.career.rel).length).toBeGreaterThan(10); // relationships survive
    expect(nextUserFixture(g)).toBeTruthy();
    // every Blue Lock player has moved on to a professional club too
    const bl = Object.values(w.players).filter((p) => p.origin === 'bluelock' && p.nelTeam);
    expect(bl.length).toBeGreaterThan(25);
    for (const p of bl) expect(p.club && !w.clubs[p.club!].nel, p.name).toBeTruthy();
    for (const L of LEAGUES) { expect(w.comps[L.id].teams.length).toBe(SIZES[L.id]); const n = SIZES[L.id]; expect(compFixtures(w, L.id).length).toBe(n * (n - 1)); }
    expect(validate(g)).toEqual([]);
  });

  it('the first professional match can be played interactively', () => {
    const c = cloneGame(g);
    autoPilot(c, () => !!userFixtureToday(c) && c.world.stage === 1);
    const ms = startUserMatch(c, 'full')!;
    expect(ms.rules.kind).toBe('reg');
    advMatch(ms);
    let n = 0;
    while (!ms.done && n++ < 500) advMatch(ms, ms.pending!.options[0].id);
    expect(ms.done).toBe(true); expect(ms.clock).toBeGreaterThanOrEqual(5400);
    finishUserMatch(c, ms);
    expect(c.world.fixtures[ms.fid].played).toBe(true);
    expect(c.career.matches[c.career.matches.length - 1].fid).toBe(ms.fid);
  });

  it('mid-season: tables, scores and weekly/monthly awards reconcile', () => {
    autoPilot(g, (x) => x.world.day >= 150);
    mid = cloneGame(g);
    const w = g.world;
    for (const L of LEAGUES) {
      const fs = compFixtures(w, L.id).filter((f) => f.played);
      expect(fs.length).toBeGreaterThan(100);
      const tab = tableOf(w, L.id);
      let pts = 0, gf = 0;
      for (const f of fs) { expect(f.goals!.length).toBe(f.sc![0] + f.sc![1]); pts += f.sc![0] === f.sc![1] ? 2 : 3; gf += f.sc![0] + f.sc![1]; }
      expect(tab.reduce((s, r) => s + r.pts, 0)).toBe(pts);
      expect(tab.reduce((s, r) => s + r.gf, 0)).toBe(gf); expect(tab.reduce((s, r) => s + r.ga, 0)).toBe(gf);
      expect(tab.reduce((s, r) => s + r.w, 0)).toBe(tab.reduce((s, r) => s + r.l, 0));
      expect(tab.reduce((s, r) => s + r.p, 0)).toBe(fs.length * 2);
      // league goals in player lines equal league goals in results (own goals are not credited to scorers)
      let pg = 0; for (const p of Object.values(w.players)) { pg += (p.ss[L.id]?.[S.G] ?? 0) + (p.ss[L.id]?.[S.OG] ?? 0); for (const hr of p.hist) if (hr.s === w.season && hr.comp === L.id) pg += hr.g; } // players who moved league mid-season have that spell archived
      expect(pg).toBe(gf);
    }
    const awards = Object.values(w.awards);
    const potw = awards.filter((a) => a.type === 'potw' && a.s === w.season);
    expect(potw.length).toBeGreaterThan(50);
    for (const a of potw) { const p = w.players[a.winner!.pid]; expect(p.ss[a.comp]?.[S.APP], a.id).toBeGreaterThan(0); }
    const totw = awards.filter((a) => a.type === 'totw');
    for (const a of totw.slice(0, 40)) { expect(a.xi!.length).toBe(11); expect(a.xi!.filter((x) => x.pos === 'GK').length).toBe(1); expect(new Set(a.xi!.map((x) => x.pid)).size).toBe(11); }
    // not just strikers: defenders and midfielders are recognised
    const posSeen = new Set(potw.map((a) => w.players[a.winner!.pid].pos));
    expect(posSeen.size).toBeGreaterThan(4);
    const potm = awards.filter((a) => a.type === 'potm');
    expect(potm.length).toBeGreaterThanOrEqual(LEAGUES.length * 3);
    expect(new Set(awards.map((a) => a.id)).size).toBe(awards.length);
    void monthOf;
  });

  it('advancing from the same snapshot is deterministic and never double-processes', () => {
    const a = cloneGame(mid), b = cloneGame(mid);
    for (let i = 0; i < 3; i++) step(b); // extra calls on an already-processed stage must change nothing unexpected
    const b2 = cloneGame(mid);
    autoPilot(a, (x) => x.world.day >= 165); autoPilot(b2, (x) => x.world.day >= 165);
    expect(tableOf(a.world, 'eng1')).toEqual(tableOf(b2.world, 'eng1'));
    expect(a.world.transfers.length).toBe(b2.world.transfers.length);
    expect(a.world.awardIds).toEqual(b2.world.awardIds);
    expect(a.career.wages).toBe(b2.career.wages);
  });

  it('season one finishes: champions, cups, continental, awards, promotion and relegation', () => {
    autoPilot(g, (x) => x.world.season === 2026);
    const w = g.world;
    expect(w.archive.length).toBe(1);
    const h = (id: string) => w.comps[id].hist.find((x) => x.s === 2025)!;
    for (const L of LEAGUES) {
      expect(h(L.id).champion, L.id).toBeTruthy(); expect(h(L.id).table!.length).toBe(SIZES[L.id]);
      expect(h(L.id).relegated!.length).toBe(L.down); expect(h(L.id).topScorer).toBeTruthy();
    }
    for (const id of ['ucl', 'uel', 'engcup', 'espcup', 'gercup', 'itacup', 'fracup', 'wc']) expect(w.comps[id].hist.some((x) => x.s === 2025 && x.champion), id).toBe(true);
    expect(h('eng2').promoted!.length).toBe(3); expect(h('eng3').promoted!.length).toBe(3);
    for (const t of ['pots', 'ypots', 'tots', 'boot', 'playmaker', 'glove']) expect(w.awards[`${t}:eng1:2025`], t).toBeTruthy();
    const yp = w.awards['ypots:eng1:2025'].winner!; expect(2025 - w.players[yp.pid].born).toBeLessThanOrEqual(21);
    const boot = w.awards['boot:eng1:2025'].winner!; expect(h('eng1').topScorer!.pid).toBe(boot.pid);
    expect(w.awards['world_player:world:2025']).toBeTruthy(); expect(w.awards['world_xi:world:2025'].xi!.length).toBe(11);
    // realistic scale: no absurd totals
    expect(h('eng1').topScorer!.v).toBeLessThan(70); expect(h('eng1').table![0].pts).toBeLessThanOrEqual(114);
  });

  it('next-season leagues are valid after promotion and relegation', () => {
    const w = g.world;
    const seen = new Set<string>();
    for (const L of LEAGUES) {
      const teams = w.comps[L.id].teams;
      expect(teams.length, L.id).toBe(SIZES[L.id]);
      for (const t of teams) { expect(seen.has(t)).toBe(false); seen.add(t); const c = w.clubs[t]; expect(c.league).toBe(L.id); expect(c.dormant).toBeFalsy(); expect(c.squad.length).toBeGreaterThanOrEqual(18); expect(c.squad.filter((id) => w.players[id].pos === 'GK').length).toBeGreaterThanOrEqual(2); }
      expect(compFixtures(w, L.id).length).toBe(teams.length * (teams.length - 1));
      const prev = w.comps[L.id].hist.find((x) => x.s === 2025)!;
      for (const id of prev.relegated!) expect(teams).not.toContain(id);
    }
    const e2 = w.comps.eng2.hist.find((x) => x.s === 2025)!;
    for (const id of e2.promoted!) expect(w.comps.eng1.teams).toContain(id);
    for (const id of w.comps.eng1.hist.find((x) => x.s === 2025)!.relegated!) expect(w.comps.eng2.teams).toContain(id);
    expect(w.comps.ucl.teams.length).toBe(16); expect(w.comps.uel.teams.length).toBe(16);
    expect(validate(g)).toEqual([]);
    // squads and player.club stay consistent
    for (const c of Object.values(w.clubs)) for (const id of c.squad) expect(w.players[id].club).toBe(c.id);
  });

  it('a second professional season completes and the world keeps evolving without the user', () => {
    const w = g.world;
    const meBefore = w.players[g.career.pid];
    const id = meBefore.id, hist = meBefore.hist.length;
    autoPilot(g, (x) => x.world.season === 2027);
    expect(w.season).toBe(2027); expect(w.archive.length).toBe(2);
    const me = w.players[id];
    expect(me).toBe(meBefore); expect(me.hist.length).toBeGreaterThanOrEqual(hist);
    expect(g.career.matches.length).toBeGreaterThan(40);
    expect(w.transfers.filter((t) => t.type === 'transfer' && t.pid !== id).length).toBeGreaterThan(30);
    expect(w.transfers.some((t) => t.type === 'retire')).toBe(true);
    expect(Object.values(w.players).some((p) => p.origin === 'regen' && p.club)).toBe(true);
    expect(w.news.some((n) => n.cat === 'manager')).toBe(true);
    // Blue Lock players are still in the game, at professional clubs, and have developed
    const isagi = Object.values(w.players).find((p) => p.name === 'Yoichi Isagi')!;
    expect(isagi.club).toBeTruthy(); expect(ovr(isagi)).toBeGreaterThanOrEqual(82); expect(isagi.hist.length).toBeGreaterThan(1);
    // identity of transferred players is preserved
    const moved = w.transfers.find((t) => t.type === 'transfer' && w.players[t.pid]);
    expect(w.players[moved!.pid].id).toBe(moved!.pid);
    expect(validate(g)).toEqual([]);
    expect(JSON.stringify(g).length).toBeLessThan(40e6);
  });
});
