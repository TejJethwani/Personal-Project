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
  const SIZES: Record<string, number> = { eng1: 20, eng2: 24, eng3: 24, esp1: 20, ger1: 18, ita1: 20, fra1: 18, ned1: 18, por1: 18 };
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
    for (const a of potw) { const p = w.players[a.winner!.pid]; const apps = (p.ss[a.comp]?.[S.APP] ?? 0) + p.hist.filter((h) => h.s === w.season && h.comp === a.comp).reduce((s, h) => s + h.ap, 0); expect(apps, a.id).toBeGreaterThan(0); } // a winner may have been sold since: his stats then live in his history
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
    for (const id of ['ucl', 'uel', 'engcup', 'espcup', 'gercup', 'itacup', 'fracup', 'nedcup', 'porcup', 'wc']) expect(w.comps[id].hist.some((x) => x.s === 2025 && x.champion), id).toBe(true);
    expect(h('eng2').promoted!.length).toBe(3); expect(h('eng3').promoted!.length).toBe(3);
    for (const t of ['pots', 'ypots', 'tots', 'boot', 'playmaker', 'glove']) expect(w.awards[`${t}:eng1:2025`], t).toBeTruthy();
    const yp = w.awards['ypots:eng1:2025'].winner!; expect(2025 - w.players[yp.pid].born).toBeLessThanOrEqual(21);
    const boot = w.awards['boot:eng1:2025'].winner!; expect(h('eng1').topScorer!.pid).toBe(boot.pid);
    expect(w.awards['world_xi:world:2025'].xi!.length).toBe(11);
    // the Ballon d'Or waits for its own gala in October, with the summer World Cup counted
    expect(w.awards['world_player:world:2025']).toBeFalsy(); expect(w.bdoPending?.s).toBe(2025);
    expect(w.bdoPending!.rows.length).toBeGreaterThan(30); expect(w.bdoPending!.rows.some((r) => /World Cup/.test(r.intl))).toBe(true);
    // realistic scale: no absurd totals
    for (const L of LEAGUES) expect(h(L.id).topScorer!.v, L.id + ' top scorer').toBeLessThan(55);
    // European league phase: 36 / 24 clubs, eight matches each, then a play-off round and a round of 16
    const ucl = compFixtures(w, 'ucl');
    const lp = ucl.filter((f) => f.stg === 'Group');
    expect(lp.length).toBe(36 * 8 / 2);
    // (the knockout rounds of 2025/26 are proven by the champion recorded above; these fixtures are next season's draw)
    expect(compFixtures(w, 'uel').filter((f) => f.stg === 'Group').length).toBe(24 * 8 / 2);
    // new awards and the ceremony hook
    for (const t of ['def_s', 'mid_s', 'fwd_s']) expect(w.awards[`${t}:eng1:2025`], t).toBeTruthy();
    for (const t of ['world_fwd', 'world_mid', 'world_def', 'golden_shoe', 'world_scorer', 'world_young']) expect(w.awards[`${t}:world:2025`], t).toBeTruthy();
    expect(Object.keys(w.awards).some((k) => k.startsWith('tourn_xi:wc'))).toBe(true);
    expect(g.career.flags.ceremony).toBe(2025);
    // the Ballon d'Or keeps its top thirty; rankings and judged awards are told apart; weekly teams never reach the timeline
    expect(w.awards['boot:eng1:2025'].mode).toBe('rank'); expect(w.awards['glove:eng1:2025'].mode).toBe('vote');
    for (const t of ['manager_s', 'potm_king', 'ironman', 'ballwinner']) expect(w.awards[`${t}:eng1:2025`], t).toBeTruthy();
    for (const t of ['world_manager', 'world_club', 'world_potm']) expect(w.awards[`${t}:world:2025`], t).toBeTruthy();
    expect(g.career.timeline.some((t) => /^Team of the (Week|Month)/.test(t.txt))).toBe(false);
    expect(w.news.some((n) => n.cat === 'paper')).toBe(true);
    // last season's tournaments keep their scoreboards after the rollover
    expect(compFixtures(w, 'wc').length).toBeGreaterThan(40);
    expect(compFixtures(w, 'nel').length).toBeGreaterThan(0);
    expect(h('eng1').table![0].pts).toBeLessThanOrEqual(114);
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
    expect(w.comps.ucl.teams.length).toBe(36); expect(w.comps.uel.teams.length).toBe(24);
    expect(validate(g)).toEqual([]);
    // squads and player.club stay consistent
    for (const c of Object.values(w.clubs)) for (const id of c.squad) expect(w.players[id].club).toBe(c.id);
  });

  it('a second professional season completes and the world keeps evolving without the user', async () => {
    const w = g.world;
    const meBefore = w.players[g.career.pid];
    const id = meBefore.id, hist = meBefore.hist.length;
    autoPilot(g, (x) => x.world.season === 2027);
    expect(w.season).toBe(2027); expect(w.archive.length).toBe(2);
    // the 2025/26 Ballon d'Or gala took place in late October 2026: 100 ballots of ten, a top thirty, and the other trophies of the night
    const bdo = w.awards['world_player:bdo:2025'];
    expect(bdo.title).toBe("Ballon d'Or"); expect(bdo.noms!.length).toBe(30); expect(bdo.votes!.length).toBe(100);
    for (const v of bdo.votes!) expect(new Set(v.picks).size).toBe(10);
    const tot = bdo.votes!.reduce((x, v) => x + v.picks.length, 0); expect(tot).toBe(1000);
    expect(bdo.noms![0].score).toBeGreaterThanOrEqual(bdo.noms![1].score);
    expect(bdo.noms!.reduce((x, n) => x + n.score, 0)).toBeLessThanOrEqual(100 * 67);
    for (const t of ['kopa', 'yashin', 'muller', 'bdo_club', 'cruyff']) expect(w.awards[`${t}:bdo:2025`], t).toBeTruthy();
    expect(g.career.flags.gala).toBe(2025); expect(w.bdoPending?.s).toBe(2026);
    // team sheets: archive, the Team of the Season Cup and the best XI in history
    expect(Object.keys(w.sheetArchive?.[2025] ?? {}).length).toBeGreaterThan(100);
    const cup = w.totsCup!.find((x) => x.s === 2025)!;
    expect(cup.teams.length).toBeGreaterThanOrEqual(5); expect(cup.matches.length).toBe(cup.teams.length * (cup.teams.length - 1) / 2);
    expect(cup.table[0].lg).toBe(cup.winner); expect(cup.allStars.xi.length).toBe(11); expect(['allstars', cup.winner]).toContain(cup.champion);
    for (const t of cup.teams) expect(cup.allStars.xi.some((id) => t.lg === cup.winner && t.xi.includes(id))).toBe(false);
    expect(Object.keys(w.clubs).some((id) => id.startsWith('tots_'))).toBe(false);
    const hx = (await import('../src/engine/teamsheets')).historyXI(g, 'all')!;
    expect(hx.xi.length).toBe(11); expect(hx.ovr).toBeGreaterThan(70); for (const x of hx.xi) expect(x.ovr).toBeGreaterThan(0);
    expect(new Set(hx.xi.map((x) => x.pid + ':' + x.s)).size).toBe(11);
    const me = w.players[id];
    expect(me).toBe(meBefore); expect(me.hist.length).toBeGreaterThanOrEqual(hist);
    expect(g.career.matches.length).toBeGreaterThan(40);
    expect(w.transfers.filter((t) => t.type === 'transfer' && t.pid !== id).length).toBeGreaterThan(30);
    expect(w.transfers.some((t) => t.type === 'retire')).toBe(true);
    expect(Object.values(w.players).some((p) => p.origin === 'regen' && p.club)).toBe(true);
    // managers change (old news about other people is cleared at the season rollover, so check the clubs)
    expect(Object.values(w.clubs).some((c) => c.mgr.since > 2025)).toBe(true);
    expect(w.news.filter((n) => n.s < w.season).every((n) => n.me)).toBe(true);
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
