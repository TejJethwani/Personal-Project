import { test } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { mkComp, addFixture } from '../src/engine/competitions';
import { createMatch } from '../src/engine/match/setup';
import { advance, DBG } from '../src/engine/match/engine';
import { S } from '../src/engine/match/model';
import type { Game } from '../src/engine/types';

function fakeGame(): Game {
  const w = createWorld(Number(process.env.SEED ?? 12345));
  const settings: any = { difficulty: 1, injuries: 2, devSpeed: 1, realism: 1, freq: 1, canonChange: true, showProb: false, dynamicPot: true, autoFlow: true, matchSpeed: 1, reduceMotion: false, nel: { goalTarget: 3, starChange: true, starSec: 180, subs: 5, offside: true, topN: 23 }, mode: 'balanced' };
  const career: any = { pid: 'none', flags: {}, rel: {}, rivals: [], reactions: [], instr: { stance: 1, press: 1, risk: 1 }, egoType: 'devourer', mgrTrust: 50 };
  w.players.none = { ...Object.values(w.players)[0], id: 'none', club: null } as any;
  return { schema: 1, id: 'x', created: '', name: '', edited: false, settings, world: w, career, live: null };
}

function run(g: Game, comp: string, pairs: [string, string][], label: string) {
  const w = g.world;
  let n = 0, goals = 0, shots = 0, sot = 0, pa = 0, pc = 0, xg = 0, fouls = 0, yc = 0, rc = 0, tk = 0, tkw = 0, drb = 0, drc = 0, off = 0, steps = 0, clock = 0, play = 0, homeW = 0, draws = 0, awayW = 0, corners = 0, pens = 0, inter = 0, rat = 0, ratn = 0, maxClock = 0, subs = 0, inj = 0;
  const t0 = Date.now();
  const hist: Record<string, number> = {};
  for (const [h, a] of pairs) {
    const fx = addFixture(w, { comp, rd: 1, day: 0, h, a });
    const ms = createMatch(g, fx, 'sim');
    advance(ms);
    n++; goals += ms.score[0] + ms.score[1]; steps += ms.steps; clock += ms.clock; play += ms.play; maxClock = Math.max(maxClock, ms.clock);
    if (ms.winner === 0) homeW++; else if (ms.winner === 1) awayW++; else draws++;
    const k = `${ms.score[0]}-${ms.score[1]}`; hist[k] = (hist[k] ?? 0) + 1;
    subs += ms.subsLog.length; inj += ms.inj.length;
    for (const p of ms.pl) { if (!p.used) continue; shots += p.s[S.SH]; sot += p.s[S.SOT]; pa += p.s[S.PA]; pc += p.s[S.PC]; xg += p.s[S.XG]; fouls += p.s[S.FC]; yc += p.s[S.YC]; rc += p.s[S.RC]; tk += p.s[S.TKA]; tkw += p.s[S.TKW]; drb += p.s[S.DA]; drc += p.s[S.DC]; off += p.s[S.OFF]; pens += p.s[S.PENG] + p.s[S.PENM]; inter += p.s[S.INT]; if (p.s[S.RATN]) { rat += p.s[S.RAT]; ratn++; } }
  }
  const ms = Date.now() - t0;
  const f = (v: number) => (v / n).toFixed(2);
  console.log(`\n== ${label}: ${n} matches, ${(ms / n).toFixed(2)} ms/match, ${f(steps)} steps`);
  console.log(`goals ${f(goals)} xG ${f(xg)} shots ${f(shots)} sot ${f(sot)} | passes ${f(pa)} acc ${(pc / pa * 100).toFixed(1)}% | drib ${f(drb)} (${(drc / drb * 100).toFixed(0)}%) tackles ${f(tk)} (${(tkw / tk * 100).toFixed(0)}%) int ${f(inter)}`);
  console.log(`fouls ${f(fouls)} yc ${f(yc)} rc ${f(rc)} off ${f(off)} pens ${f(pens)} subs ${f(subs)} inj ${f(inj)} | clock ${(clock / n / 60).toFixed(1)}min play ${(play / n / 60).toFixed(1)}min max ${(maxClock / 60).toFixed(0)} | H/D/A ${homeW}/${draws}/${awayW} | avg rating ${(rat / ratn).toFixed(2)}`);
  console.log(Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '));
}

test('calibration', () => {
  const g = fakeGame();
  const w = g.world;
  mkComp(w, { id: 'x1', name: 'X', sn: 'X', kind: 'league' });
  mkComp(w, { id: 'nel', name: 'NEL', sn: 'NEL', kind: 'nel', rules: 'nel' });
  const pl = Object.values(w.clubs).filter((c) => c.league === 'eng1').map((c) => c.id);
  const pairs: [string, string][] = [];
  for (let i = 0; i < 300; i++) pairs.push([pl[i % 20], pl[(i * 7 + 3) % 20 === i % 20 ? (i + 1) % 20 : (i * 7 + 3) % 20]]);
  DBG.on = 1;
  run(g, 'x1', pairs, 'Premier League');
  const ks = [...new Set(Object.keys(DBG).filter(k=>k!=='on').map(k=>k.split(' ')[0]))];
  console.log(ks.map(k=>`${k}: n=${(DBG[k+' n']/300).toFixed(2)} xg/shot=${(DBG[k+' xg']/DBG[k+' n']).toFixed(3)} press=${(DBG[k+' pr']/DBG[k+' n']).toFixed(2)}`).sort().join('\n'));
  DBG.on = 0;
  const l1 = Object.values(w.clubs).filter((c) => c.league === 'eng3').map((c) => c.id);
  run(g, 'x1', Array.from({ length: 150 }, (_, i) => [l1[i % 24], l1[(i + 5) % 24]] as [string, string]), 'League One');
  run(g, 'x1', Array.from({ length: 60 }, (_, i) => [pl[i % 20], l1[i % 24]] as [string, string]), 'PL (home) v L1');
  const nel = w.nel.teams;
  run(g, 'nel', Array.from({ length: 100 }, (_, i) => [nel[i % 5], nel[(i + 1 + (i % 3)) % 5 === i % 5 ? (i + 1) % 5 : (i + 1 + (i % 3)) % 5]] as [string, string]), 'NEL');
  console.log('players', Object.keys(w.players).length, 'clubs', Object.keys(w.clubs).length);
});
