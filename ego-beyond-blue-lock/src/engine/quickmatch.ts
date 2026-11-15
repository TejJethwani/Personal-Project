/**
 * Stand-alone match simulator: any two teams (clubs, NEL sides or national teams) with editable
 * team sheets, played by the same engine as career matches. No career is involved.
 */
import type { Game } from './types';
import { createWorld } from './worldgen';
import { mkComp, addFixture } from './competitions';
import { createMatch, pickSheet, teamInfo, SHEETS } from './match/setup';
import { advance, recordReplays } from './match/engine';
import type { MatchState } from './match/model';
import { defaultSettings } from './career';
import { selectSquad } from './international';
import { NATIONS } from './data/nations';

export interface SimSheet { form: string; xi: string[]; bench: string[] }

/** A world with no user in it. */
export function simWorld(seed: number): Game {
  const w = createWorld(seed >>> 0);
  const ghost = { ...Object.values(w.players)[0], id: '__nobody', club: null, name: 'Nobody' };
  w.players.__nobody = ghost as (typeof w.players)[string];
  mkComp(w, { id: 'simreg', name: 'Exhibition', sn: 'EXH', kind: 'league' });
  mkComp(w, { id: 'simnat', name: 'International Exhibition', sn: 'INT', kind: 'friendly', natTeams: true, teams: [] });
  const career = { pid: '__nobody', flags: {}, rel: {}, rivals: [], reactions: [], instr: { stance: 1, press: 1, risk: 1 }, egoType: 'devourer', mgrTrust: 50, matches: [], custom: [], inbox: [], timeline: [], statHist: [], people: {}, digest: [] } as unknown as Game['career'];
  return { schema: 1, id: 'sim', created: '', name: 'Match simulator', edited: false, settings: defaultSettings(), world: w, career, live: null };
}
export function ensureSquad(g: Game, id: string): void { if (NATIONS[id] && !g.world.clubs[id] && !g.world.nations[id]?.squad?.length) selectSquad(g, id, false); }
/** The coach's own team sheet, as a starting point for editing. */
export function autoSheet(g: Game, id: string): SimSheet {
  ensureSquad(g, id);
  const had = SHEETS.get(id); SHEETS.delete(id);
  const s = pickSheet(null, g.world, teamInfo(g.world, id), 0, 9);
  if (had) SHEETS.set(id, had);
  return { form: s.form, xi: s.xi.map((x) => x.pid), bench: s.bench };
}
export function squadOf(g: Game, id: string): string[] { ensureSquad(g, id); return teamInfo(g.world, id).squad; }

export interface SimOpts { nel?: boolean; knockout?: boolean; neutral?: boolean; record?: boolean }
/** Play one match with the given sheets. */
export function playSim(g: Game, home: string, away: string, sheets: [SimSheet, SimSheet], o: SimOpts = {}): MatchState {
  const w = g.world;
  ensureSquad(g, home); ensureSquad(g, away);
  SHEETS.set(home, sheets[0]); SHEETS.set(away, sheets[1]);
  try {
    const nat = !w.clubs[home] || !w.clubs[away];
    if (o.nel && !w.comps.simnel) mkComp(w, { id: 'simnel', name: 'First to three', sn: 'NEL', kind: 'nel', rules: 'nel' });
    const fx = addFixture(w, { comp: o.nel ? 'simnel' : nat ? 'simnat' : 'simreg', rd: 1, day: 0, h: home, a: away, ko: o.knockout, neutral: o.neutral });
    const ms = createMatch(g, fx, 'sim');
    if (o.record) recordReplays(ms);
    advance(ms);
    delete w.fixtures[fx.id];
    return ms;
  } finally { SHEETS.delete(home); SHEETS.delete(away); }
}
/** Many simulations of the same match-up: outcome shares and average score. */
export function playMany(g: Game, home: string, away: string, sheets: [SimSheet, SimSheet], n: number, o: SimOpts = {}): { n: number; h: number; d: number; a: number; gf: number; ga: number; scores: [string, number][] } {
  let h = 0, d = 0, a = 0, gf = 0, ga = 0;
  const sc: Record<string, number> = {};
  for (let i = 0; i < n; i++) { const ms = playSim(g, home, away, sheets, o); gf += ms.score[0]; ga += ms.score[1]; if (ms.winner === 0) h++; else if (ms.winner === 1) a++; else d++; const k = `${ms.score[0]}–${ms.score[1]}`; sc[k] = (sc[k] ?? 0) + 1; }
  return { n, h, d, a, gf: gf / n, ga: ga / n, scores: Object.entries(sc).sort((x, y) => y[1] - x[1]).slice(0, 6) };
}
