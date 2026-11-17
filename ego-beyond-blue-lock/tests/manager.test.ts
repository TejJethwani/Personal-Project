import { describe, it, expect } from 'vitest';
import { newManagerGame } from '../src/engine/managerStart';
import { autoPilot, nextStop, step, startUserMatch, finishUserMatch } from '../src/engine/sim';
import { advance as adv, managerSub } from '../src/engine/match/engine';
import { bid, askingPrice, wageDemand, takeJob, mgrClub, windowOpen, toggleListed, acceptOfferFor, releaseNow, renew, validSheet, assistantSheet } from '../src/engine/manager';
import { validate, cloneGame, exportSave, importSave } from '../src/engine/save';
import { ovr } from '../src/engine/attributes';
import type { Game } from '../src/engine/types';

function clubId(g: Game, name: string): string { return Object.values(g.world.clubs).find((c) => c.name === name || c.sn === name)!.id; }

describe('manager mode', () => {
  it('starts at a club in the professional season', () => {
    const g0 = newManagerGame({ name: 'Ego Jinpachi', nat: 'JPN', club: 'eng1_mun', seed: 7 });
    expect(g0.world.phase).toBe('pro');
    expect(g0.mgr!.club).toBe('eng1_mun');
    expect(g0.world.clubs.eng1_mun.mgr.name).toBe('Ego Jinpachi');
    expect(g0.mgr!.budget).toBeGreaterThan(0);
    expect(g0.mgr!.obj.pos).toBeGreaterThan(0);
    expect(validate(g0)).toEqual([]);
  }, 120000);

  it('plays a live match with the manager making substitutions', () => {
    const g = newManagerGame({ name: 'M', nat: 'ENG', club: 'eng1_ars', seed: 11 });
    autoPilot(g, (x) => nextStop(x).kind === 'match', 200);
    expect(nextStop(g).kind).toBe('match');
    const ms = startUserMatch(g, 'full')!;
    expect(ms.uc).toBeFalsy();
    expect(ms.mgrT).toBeGreaterThanOrEqual(0);
    let guard = 0, subs = 0;
    while (!ms.done && guard++ < 20000) {
      adv(ms, undefined, 5);
      const T = ms.teams[ms.mgrT!];
      if (ms.clock > 3600 && subs < 3 && T.bench.length) { const off = T.on.find((i) => ms.pl[i].line > 0)!; const err = managerSub(ms, ms.mgrT!, off, T.bench[0]); if (!err) subs++; }
    }
    expect(ms.done).toBe(true);
    expect(ms.teams[ms.mgrT!].subs).toBe(subs);
    const n0 = g.mgr!.matches.length;
    finishUserMatch(g, ms);
    expect(g.mgr!.matches.length).toBe(n0 + 1);
    expect(g.live).toBeNull();
  }, 120000);

  it('runs two full seasons: transfers, sales, contracts, board and jobs stay consistent', () => {
    const g = newManagerGame({ name: 'M', nat: 'ESP', club: 'esp1_bet', seed: 21 });
    const m = g.mgr!;
    let bought = 0, sold = 0, tries = 0;
    const season0 = g.world.season;
    for (let guard = 0; guard < 6000 && g.world.season < season0 + 2; guard++) {
      const st = nextStop(g).kind;
      if (st === 'club') { expect(m.jobs.length).toBeGreaterThan(0); expect(takeJob(g, m.jobs[0])).toBe(''); continue; }
      // business on the first day of each window week
      const c = mgrClub(g);
      if (c && windowOpen(g.world) && g.world.day % 7 === 1 && g.world.stage === 0 && tries < 40) {
        tries++;
        const pool = Object.values(g.world.players).filter((p) => p.club && p.club !== c.id && !g.world.clubs[p.club].nel && !p.retired && ovr(p) >= 70 && ovr(p) <= 80).slice(0, 40);
        const p = pool[(tries * 7) % pool.length];
        if (p && m.budget > askingPrice(g, p)) { const r = bid(g, p.id, askingPrice(g, p), wageDemand(g, p, c), 3); if (r.result === 'done') { bought++; expect(p.club).toBe(c.id); } }
        const weak = c.squad.map((id) => g.world.players[id]).sort((a, b) => ovr(a) - ovr(b))[0];
        if (weak && !m.listed.includes(weak.id)) toggleListed(g, weak.id);
        const off = m.offers.find((o) => o.status === 'open');
        if (off && c.squad.length > 22) { if (acceptOfferFor(g, off.id) === '') sold++; }
      }
      if (st === 'match') {
        const ms = startUserMatch(g, 'sim')!;
        adv(ms); finishUserMatch(g, ms);
        continue;
      }
      step(g);
      // the AI must never move the manager's players on its own
      const c2 = mgrClub(g);
      if (c2) { expect(c2.mgr.name).toBe('M'); expect(c2.squad.length).toBeGreaterThanOrEqual(16); }
    }
    expect(g.world.season).toBe(season0 + 2);
    expect(m.hist.length).toBeGreaterThanOrEqual(1);
    expect(m.matches.length).toBeGreaterThan(30);
    expect(validate(g)).toEqual([]);
    // the sheet logic always produces eleven
    if (m.club) { m.autoPick = false; m.sheet = assistantSheet(g); expect(validSheet(g).xi.length).toBe(11); }
    // release and renew
    const c = mgrClub(g);
    if (c) { const p = g.world.players[c.squad[c.squad.length - 1]]; renew(g, p.id, 2); const before = c.squad.length; if (before > 18 && releaseNow(g, p.id) === '') expect(c.squad.length).toBe(before - 1); }
    // save round trip
    const g2 = importSave(exportSave(cloneGame(g)));
    expect(g2.mgr!.name).toBe('M');
    console.log('MGR', { bought, sold, seasons: m.hist.map((h) => `${h.clubName} ${h.pos}/${h.n} obj ${h.obj} conf ${h.conf}`), budget: m.budget, conf: m.conf, sacked: m.sacked, msgs: m.msgs.length });
  }, 900000);

  it('a sacked manager gets job offers, takes one and the season carries on', () => {
    const g = newManagerGame({ name: 'S', nat: 'ITA', club: 'ita1_int', seed: 33 });
    const m = g.mgr!;
    let played = 0;
    for (let guard = 0; guard < 3000 && !m.sacked; guard++) {
      const st = nextStop(g).kind;
      if (st === 'match') { const ms = startUserMatch(g, 'sim')!; adv(ms); m.conf = 3; finishUserMatch(g, ms); played++; continue; }
      step(g);
    }
    expect(m.sacked).toBe(true);
    expect(m.club).toBe('');
    expect(g.world.clubs.ita1_int.mgr.name).not.toBe('S');
    expect(nextStop(g).kind).toBe('club');
    expect(m.jobs.length).toBeGreaterThan(0);
    const job = m.jobs[0];
    expect(takeJob(g, job)).toBe('');
    expect(m.club).toBe(job);
    expect(g.world.clubs[job].mgr.name).toBe('S');
    // and the world moves on with the new club
    const d0 = g.world.abs;
    autoPilot(g, (x) => x.world.abs >= d0 + 40, 60);
    expect(g.world.abs).toBeGreaterThanOrEqual(d0 + 40);
    expect(validate(g)).toEqual([]);
    console.log('SACK after', played, 'matches; new job', g.world.clubs[job].name);
  }, 300000);
});
