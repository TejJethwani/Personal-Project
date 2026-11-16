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
import { S } from './match/model';
import { ovr } from './attributes';
import type { Club, Player } from './types';

/** Special sides for the simulator: they borrow players from their real clubs for one match. */
export const SPECIAL_XIS: { id: string; name: string; abbr: string; col: [string, string]; form: string; desc: string; pick: (ps: Player[], season: number) => Player[] }[] = [
  { id: 'sim_bluelock', name: 'Blue Lock XI', abbr: 'BLX', col: ['#0c1a33', '#1ea7ff'], form: '4-2-3-1', desc: 'The best of the Blue Lock project.', pick: (ps) => ps.filter((p) => p.origin === 'bluelock') },
  { id: 'sim_japanu20', name: 'Japan U-20', abbr: 'JU20', col: ['#f4f4f4', '#1d3c8f'], form: '4-4-2', desc: 'The Japanese under-20s who are not in Blue Lock.', pick: (ps, season) => ps.filter((p) => p.nat === 'JPN' && p.origin !== 'bluelock' && season - p.born <= 20) },
  { id: 'sim_newgen', name: 'New Generation World XI', abbr: 'NGW', col: ['#111111', '#ffd166'], form: '4-3-3', desc: 'The best players in the world aged 21 or under.', pick: (ps, season) => ps.filter((p) => season - p.born <= 21 && p.origin !== 'bluelock') },
  { id: 'sim_world', name: 'World XI', abbr: 'WXI', col: ['#f4f4f4', '#d4af37'], form: '4-3-3', desc: 'The best players on the planet.', pick: (ps) => ps },
  { id: 'sim_masters', name: 'NEL Masters XI', abbr: 'MAS', col: ['#3a0b2e', '#ffd166'], form: '4-3-3', desc: 'The master strikers and the best of the NEL clubs.', pick: (ps) => ps.filter((p) => p.origin === 'master' || p.origin === 'nelyouth' || !!p.nelTeam) },
];
/** Build the special sides as temporary clubs (26-man squads: the best per position). */
function addSpecialXIs(g: Game): void {
  const w = g.world;
  const all = Object.values(w.players).filter((p) => !p.retired && p.id !== '__nobody');
  const base = Object.values(w.clubs).find((c) => c.league === 'eng1')!;
  for (const x of SPECIAL_XIS) {
    const pool = x.pick(all, w.season).sort((a, b) => ovr(b) - ovr(a));
    const need: Record<string, number> = { GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 3, AM: 2, LW: 2, RW: 2, ST: 3, SS: 1, LM: 0, RM: 0 };
    const squad: string[] = [];
    for (const p of pool) { if (squad.length >= 26) break; if ((need[p.pos] ?? 0) > 0) { need[p.pos]--; squad.push(p.id); } }
    for (const p of pool) { if (squad.length >= 26) break; if (!squad.includes(p.id) && p.pos !== 'GK') squad.push(p.id); }
    if (squad.filter((id) => w.players[id].pos === 'GK').length === 0) { const gk = all.filter((p) => p.pos === 'GK').sort((a, b) => ovr(b) - ovr(a))[0]; if (gk) squad.push(gk.id); }
    const c: Club = { ...base, id: x.id, name: x.name, sn: x.name, abbr: x.abbr, nat: 'JPN', league: null, tier: 0, rep: 95, col: x.col, tac: { ...base.tac, form: x.form }, squad, nel: false, parent: undefined, master: undefined, identity: x.desc, hist: [], trophies: [], rec: {}, goalsAll: {}, dormant: false };
    w.clubs[x.id] = c;
  }
}

export interface SimSheet { form: string; xi: string[]; bench: string[] }

/** A world with no user in it. */
export function simWorld(seed: number): Game {
  const w = createWorld(seed >>> 0);
  const ghost = { ...Object.values(w.players)[0], id: '__nobody', club: null, name: 'Nobody' };
  w.players.__nobody = ghost as (typeof w.players)[string];
  mkComp(w, { id: 'simreg', name: 'Exhibition', sn: 'EXH', kind: 'league' });
  mkComp(w, { id: 'simnat', name: 'International Exhibition', sn: 'INT', kind: 'friendly', natTeams: true, teams: [] });
  const career = { pid: '__nobody', flags: {}, rel: {}, rivals: [], reactions: [], instr: { stance: 1, press: 1, risk: 1 }, egoType: 'devourer', mgrTrust: 50, matches: [], custom: [], inbox: [], timeline: [], statHist: [], people: {}, digest: [] } as unknown as Game['career'];
  const g: Game = { schema: 1, id: 'sim', created: '', name: 'Match simulator', edited: false, settings: defaultSettings(), world: w, career, live: null };
  addSpecialXIs(g);
  return g;
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
export function playSim(g: Game, home: string, away: string, sheets0: [SimSheet, SimSheet], o: SimOpts = {}): MatchState {
  let sheets = sheets0;
  const w = g.world;
  ensureSquad(g, home); ensureSquad(g, away);
  // a player can only play for one side: the away team replaces anyone the home team has picked
  const taken = new Set([...sheets[0].xi, ...sheets[0].bench]);
  if (sheets[1].xi.some((id) => taken.has(id)) || sheets[1].bench.some((id) => taken.has(id))) {
    const pool = squadOf(g, away).filter((id) => !taken.has(id)).sort((x, y) => ovr(w.players[y]) - ovr(w.players[x]));
    const xi = sheets[1].xi.map((id) => { if (!taken.has(id)) return id; const pos = w.players[id].pos; const k = pool.findIndex((q) => (w.players[q].pos === 'GK') === (pos === 'GK') && !sheets[1].xi.includes(q)); return k >= 0 ? pool.splice(k, 1)[0] : id; });
    sheets = [sheets[0], { ...sheets[1], xi, bench: sheets[1].bench.filter((id) => !taken.has(id) && !xi.includes(id)) }];
  }
  SHEETS.set(home, sheets[0]); SHEETS.set(away, sheets[1]);
  // every simulation starts from the same fresh state: tiredness, form, cards and knocks from one match must not
  // leak into the next (after 100 back-to-back matches both sides would otherwise be exhausted and leak goals)
  const ids = [...new Set([...squadOf(g, home), ...squadOf(g, away)])].filter((id) => w.players[id]);
  const saved = ids.map((id) => { const p = w.players[id]; return [p, { fit: p.fit, sharp: p.sharp, form: p.form, morale: p.morale, yel: p.yel, susp: p.susp, inj: p.inj, injName: p.injName, rep: p.rep, caps: p.caps, ig: p.ig, ss: p.ss }] as const; });
  for (const [p] of saved) p.ss = {};
  const goalsAll = [home, away].map((id) => w.clubs[id] ? [w.clubs[id], { ...w.clubs[id].goalsAll }] as const : null);
  try {
    const nat = !w.clubs[home] || !w.clubs[away];
    if (o.nel && !w.comps.simnel) mkComp(w, { id: 'simnel', name: 'First to three', sn: 'NEL', kind: 'nel', rules: 'nel' });
    const fx = addFixture(w, { comp: o.nel ? 'simnel' : nat ? 'simnat' : 'simreg', rd: 1, day: 0, h: home, a: away, ko: o.knockout, neutral: o.neutral });
    const ms = createMatch(g, fx, 'sim');
    if (o.record) recordReplays(ms);
    advance(ms);
    delete w.fixtures[fx.id];
    return ms;
  } finally {
    SHEETS.delete(home); SHEETS.delete(away);
    for (const [p, v] of saved) Object.assign(p, v);
    for (const x of goalsAll) if (x) x[0].goalsAll = x[1];
  }
}
export interface SimSummary { i: number; score: [number, number]; winner: number; pens: [number, number] | null; goals: number; lead: number; comeback: number; lateWinner: number; reds: number; xg: [number, number]; intensity: number; scorers: string[] }
export interface ManyResult {
  n: number; h: number; d: number; a: number; gf: number; ga: number; scores: [string, number][];
  /** notable matches, kept in full so they can be opened */
  notable: { key: string; title: string; ms: MatchState; sum: SimSummary }[];
  team: { poss: number; shots: number; sot: number; xg: number; fouls: number; yc: number; rc: number; cs: number; biggestWin: string }[];
  players: { id: string; name: string; t: number; g: number; a: number; apps: number; rat: number; potm: number; hat: number }[];
  pens: number; comebacks: number; lateWinners: number; draws00: number;
}
/** What happened in one simulated match, for the notable-match lists. */
function summarise(ms: MatchState, i: number): SimSummary {
  const gl = [...ms.goals].sort((a, b) => a[0] - b[0]);
  let h = 0, a = 0, leadChanges = 0, lastLeader = 0, maxDef = [0, 0], late = -1;
  for (const x of gl) {
    const before = Math.sign(h - a);
    if (x[1] === 0) h++; else a++;
    const now = Math.sign(h - a);
    if (now !== 0 && now !== lastLeader) { if (lastLeader !== 0) leadChanges++; lastLeader = now; }
    maxDef[0] = Math.max(maxDef[0], a - h); maxDef[1] = Math.max(maxDef[1], h - a);
    if (x[0] >= (ms.rules.kind === 'nel' ? 40 : 85) && before === 0 && now !== 0) late = x[1];
  }
  const w = ms.winner;
  const comeback = w >= 0 ? maxDef[w] : 0;
  const lateWinner = w >= 0 && late === w && Math.sign(h - a) === (w === 0 ? 1 : -1) ? 1 : 0;
  const sum = (t: number, k: number) => ms.pl.filter((p) => p.t === t && p.used).reduce((x, p) => x + p.s[k], 0);
  const reds = sum(0, S.RC) + sum(1, S.RC);
  const xg: [number, number] = [sum(0, S.XG), sum(1, S.XG)];
  const goals = ms.score[0] + ms.score[1];
  const intensity = goals * 1.2 + leadChanges * 3 + comeback * 3 + lateWinner * 4 + (ms.pens ? 4 : 0) + reds * 1.5 - Math.abs(ms.score[0] - ms.score[1]) * 1.5 + Math.min(4, xg[0] + xg[1]) * 0.5;
  const scorers = gl.map((x) => `${ms.pl.find((p) => p.id === x[2])?.nm ?? '?'} ${x[0]}'`);
  return { i, score: [ms.score[0], ms.score[1]], winner: w, pens: ms.pens, goals, lead: leadChanges, comeback, lateWinner, reds, xg, intensity, scorers };
}
const NOTABLE: { key: string; title: (h: string, a: string) => string; score: (s: SimSummary) => number; ok: (s: SimSummary) => boolean }[] = [
  { key: 'bigHome', title: (h) => `Biggest ${h} wins`, score: (s) => (s.score[0] - s.score[1]) * 10 + s.score[0], ok: (s) => s.winner === 0 && !s.pens },
  { key: 'bigAway', title: (_h, a) => `Biggest ${a} wins`, score: (s) => (s.score[1] - s.score[0]) * 10 + s.score[1], ok: (s) => s.winner === 1 && !s.pens },
  { key: 'intense', title: () => 'Most intense matches', score: (s) => s.intensity, ok: () => true },
  { key: 'thriller', title: () => 'Goal-fests', score: (s) => s.goals * 10 - Math.abs(s.score[0] - s.score[1]), ok: (s) => s.goals >= 4 },
  { key: 'comeback', title: () => 'Comebacks', score: (s) => s.comeback * 10 + s.goals, ok: (s) => s.comeback >= 1 },
  { key: 'late', title: () => 'Last-gasp winners', score: (s) => s.goals + s.lead * 2, ok: (s) => s.lateWinner === 1 },
  { key: 'pens', title: () => 'Penalty shoot-outs', score: (s) => (s.pens ? s.pens[0] + s.pens[1] : 0), ok: (s) => !!s.pens },
];
/** Many simulations of the same match-up: outcome shares, notable matches and aggregated statistics. */
export function playMany(g: Game, home: string, away: string, sheets: [SimSheet, SimSheet], n: number, o: SimOpts = {}): ManyResult {
  let h = 0, d = 0, a = 0, gf = 0, ga = 0, pens = 0, comebacks = 0, lateWinners = 0, d00 = 0;
  const sc: Record<string, number> = {};
  const keep: Record<string, { ms: MatchState; sum: SimSummary }[]> = {};
  const tm = [0, 1].map(() => ({ poss: 0, shots: 0, sot: 0, xg: 0, fouls: 0, yc: 0, rc: 0, cs: 0, best: [-1, ''] as [number, string] }));
  const pl: Record<string, ManyResult['players'][number]> = {};
  for (let i = 0; i < n; i++) {
    const ms = playSim(g, home, away, sheets, { ...o, record: true });
    gf += ms.score[0]; ga += ms.score[1];
    if (ms.winner === 0) h++; else if (ms.winner === 1) a++; else d++;
    const k = `${ms.score[0]}–${ms.score[1]}`; sc[k] = (sc[k] ?? 0) + 1;
    if (ms.score[0] + ms.score[1] === 0) d00++;
    const sm = summarise(ms, i + 1);
    if (sm.pens) pens++; if (sm.comeback) comebacks++; if (sm.lateWinner) lateWinners++;
    // team totals
    const pass = [0, 1].map((t) => ms.pl.filter((p) => p.t === t && p.used).reduce((x, p) => x + p.s[S.PA], 0));
    for (let t = 0; t < 2; t++) {
      const T = tm[t], sum = (k2: number) => ms.pl.filter((p) => p.t === t && p.used).reduce((x, p) => x + p.s[k2], 0);
      T.poss += pass[t] / Math.max(1, pass[0] + pass[1]); T.shots += sum(S.SH); T.sot += sum(S.SOT); T.xg += sum(S.XG); T.fouls += sum(S.FC); T.yc += sum(S.YC); T.rc += sum(S.RC);
      if (ms.score[1 - t] === 0) T.cs++;
      const marg = ms.score[t] - ms.score[1 - t];
      if (marg > T.best[0]) T.best = [marg, t === 0 ? `${ms.score[0]}–${ms.score[1]}` : `${ms.score[1]}–${ms.score[0]}`];
    }
    // players
    for (const p of ms.pl) {
      if (!p.used) continue;
      const r = (pl[p.id] ??= { id: p.id, name: p.nm, t: p.t, g: 0, a: 0, apps: 0, rat: 0, potm: 0, hat: 0 });
      r.apps++; r.g += p.s[S.G]; r.a += p.s[S.A]; r.rat += p.s[S.RATN] ? p.s[S.RAT] : 6; r.potm += p.s[S.POTM]; if (p.s[S.G] >= 3) r.hat++;
    }
    // keep the match in full only while it is in the top three of some list
    for (const nb of NOTABLE) {
      if (!nb.ok(sm)) continue;
      const L = (keep[nb.key] ??= []);
      L.push({ ms, sum: sm }); L.sort((x, y) => nb.score(y.sum) - nb.score(x.sum)); if (L.length > 3) L.pop();
    }
  }
  const nm = (id: string) => g.world.clubs[id]?.name ?? NATIONS[id]?.name ?? id;
  const notable: ManyResult['notable'] = [];
  for (const nb of NOTABLE) for (const x of keep[nb.key] ?? []) notable.push({ key: nb.key, title: nb.title(nm(home), nm(away)), ms: x.ms, sum: x.sum });
  return {
    n, h, d, a, gf: gf / n, ga: ga / n, scores: Object.entries(sc).sort((x, y) => y[1] - x[1]).slice(0, 6), notable, pens, comebacks, lateWinners, draws00: d00,
    team: tm.map((T) => ({ poss: (T.poss / n) * 100, shots: T.shots / n, sot: T.sot / n, xg: T.xg / n, fouls: T.fouls / n, yc: T.yc / n, rc: T.rc / n, cs: T.cs, biggestWin: T.best[0] > 0 ? T.best[1] : '—' })),
    players: Object.values(pl).map((r) => ({ ...r, rat: r.rat / Math.max(1, r.apps) })),
  };
}
