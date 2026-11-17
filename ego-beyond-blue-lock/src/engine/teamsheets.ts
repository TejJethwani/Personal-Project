/**
 * Team sheets: every club's end-of-season line-up kept for the archive, the Team of the Season Cup
 * (each top league's Team of the Season plays the others, the winner then faces the All-Stars of every
 * other league), and the best elevens in history built from every Team of the Season ever named.
 */
import type { AwardXI, Game, Pos } from './types';
import { LEAGUES } from './data/clubs';
import { ovr } from './attributes';
import { pickSheet, teamInfo, teamName } from './match/setup';
import { mkComp, addFixture, roundRobin, seasonLabel } from './competitions';
import { rngOf } from './worldgen';
import { winnerId } from './match/setup';
import { S } from './match/model';
import { seasonLines } from './awards';
import { tempClub } from './quickmatch';
import { addNews, milestone } from './util';

export interface TotsTeam { lg: string; name: string; xi: string[]; form: string }
export interface TotsRow { lg: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }
export interface TotsMatch { h: string; a: string; sc: [number, number]; pens?: [number, number]; scorers: string[] }
export interface TotsCup { s: number; teams: TotsTeam[]; table: TotsRow[]; matches: TotsMatch[]; winner: string; allStars: TotsTeam; final: TotsMatch; champion: string }

/** At the end of the club season, file every league club's line-up in the archive. */
export function archiveSheets(g: Game): void {
  const w = g.world;
  const out: Record<string, { form: string; xi: [string, string, number, string][] }> = {};
  for (const L of LEAGUES) for (const id of w.comps[L.id]?.teams ?? []) {
    if (!w.clubs[id]) continue;
    const sh = pickSheet(null, w, teamInfo(w, id));
    out[id] = { form: sh.form, xi: sh.xi.map((x) => { const p = w.players[x.pid]; return [x.pid, x.pos, p ? ovr(p) : 0, p?.name ?? '?'] as [string, string, number, string]; }) };
  }
  (w.sheetArchive ??= {})[w.season] = out;
  // keep the archive bounded: the last 25 seasons
  for (const k of Object.keys(w.sheetArchive)) if (+k < w.season - 25) delete w.sheetArchive[+k];
}

const TOP = LEAGUES.filter((l) => l.tier === 1);
const LG_COL: Record<string, [string, string]> = { eng1: ['#3d195b', '#00ff85'], esp1: ['#ee2523', '#ffffff'], ger1: ['#d20515', '#ffffff'], ita1: ['#008fd7', '#ffffff'], fra1: ['#091c3e', '#dae025'], ned1: ['#ff6200', '#ffffff'], por1: ['#00205b', '#ffffff'] };

/** Between the end of the club season (day 308) and the summer tournament (day 330): one round every three days, then the final. */
export const TOTS_RR_DAYS = [309, 312, 315, 318, 321, 324, 327];
export const TOTS_FINAL_DAY = 329;
/** The live cup between the end of the club season and the final. */
export interface TotsLive { s: number; teams: TotsTeam[]; made: string[]; final?: string; allStars?: TotsTeam }

/**
 * The Team of the Season Cup, played as real fixtures between the end of the season and the summer tournament: each top league's Team of
 * the Season plays the others once (one round every three days), the table-topper meets the All-Stars of every other league.
 * If the user is in one of the sides, his matches are played like any other fixture.
 */
export function setupTotsCup(g: Game): void {
  const w = g.world, s = w.season;
  if (w.totsLive || w.totsCup?.some((x) => x.s === s)) return;
  const teams: TotsTeam[] = [], made: string[] = [];
  for (const L of TOP) {
    const a = w.awards[`tots:${L.id}:${s}`];
    if (!a?.xi || a.xi.length !== 11) continue;
    const xi = a.xi.map((x) => x.pid).filter((id) => w.players[id] && !w.players[id].retired);
    if (xi.length < 11) continue;
    const bench = seasonLines(g, L.id).filter((c) => !xi.includes(c.p.id) && !c.p.retired && c.line[S.RATN] >= 8).sort((x, y) => y.score - x.score).slice(0, 8).map((c) => c.p.id);
    const id = 'tots_' + L.id;
    w.clubs[id] = tempClub(g, id, `${L.name} TOTS`, L.sn, LG_COL[L.id] ?? ['#222', '#fff'], a.form ?? '4-3-3', [...xi, ...bench], `${L.name} Team of the Season`);
    made.push(id);
    teams.push({ lg: L.id, name: `${L.name} TOTS`, xi, form: a.form ?? '4-3-3' });
  }
  if (teams.length < 3) { for (const id of made) delete w.clubs[id]; return; }
  if (!w.comps.totscup) mkComp(w, { id: 'totscup', name: 'Team of the Season Cup', sn: 'TOTS Cup', kind: 'friendly', teams: [] });
  w.comps.totscup.teams = [...made];
  const rounds = roundRobin(made, false, rngOf(w));
  rounds.forEach((r, k) => { for (const [h, a] of r) if (h && a) addFixture(w, { comp: 'totscup', rd: k + 1, day: TOTS_RR_DAYS[Math.min(k, TOTS_RR_DAYS.length - 1)], h, a, neutral: true, stg: 'Group' }); });
  w.totsLive = { s, teams, made };
  const me = g.career.pid, mine = teams.find((t) => w.clubs['tots_' + t.lg].squad.includes(me));
  addNews(g, 'world', 'The Team of the Season Cup is coming', `${teams.length} Teams of the Season meet once each before the summer tournament; the winners face the All-Stars of every other league.${mine ? ` You are in the ${mine.name} squad.` : ''}`, { imp: 2, me: !!mine });
}

/** Live standings of the round robin. */
export function totsTable(g: Game): TotsRow[] {
  const w = g.world, L = w.totsLive;
  if (!L) return [];
  const rows: Record<string, TotsRow> = Object.fromEntries(L.teams.map((t) => [t.lg, { lg: t.lg, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const id in w.fixtures) {
    const f = w.fixtures[id];
    if (f.comp !== 'totscup' || f.stg !== 'Group' || !f.played || !f.sc) continue;
    const A = rows[f.h.slice(5)], B = rows[f.a.slice(5)];
    if (!A || !B) continue;
    const [x, y] = f.sc;
    A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
    if (x > y) { A.w++; B.l++; A.pts += 3; } else if (x < y) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  return Object.values(rows).sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}

/** After the round robin: the All-Stars are picked and the final is scheduled. */
export function totsCupFinal(g: Game): void {
  const w = g.world, L = w.totsLive;
  if (!L || L.final) return;
  const table = totsTable(g);
  if (!table.length) return;
  const winner = table[0].lg;
  const pool = [...new Set(L.teams.filter((t) => t.lg !== winner).flatMap((t) => t.xi))].filter((id) => w.players[id] && !w.players[id].retired);
  w.clubs.tots_allstars = tempClub(g, 'tots_allstars', 'All-Stars', 'ALL', ['#f4f4f4', '#d4af37'], '4-3-3', pool, 'The best of every other league');
  L.made.push('tots_allstars');
  const as = pickSheet(null, w, teamInfo(w, 'tots_allstars'));
  L.allStars = { lg: 'allstars', name: 'All-Stars', xi: as.xi.map((x) => x.pid), form: as.form };
  const fx = addFixture(w, { comp: 'totscup', rd: 99, day: TOTS_FINAL_DAY, h: 'tots_' + winner, a: 'tots_allstars', neutral: true, ko: true, stg: 'Final' });
  L.final = fx.id;
  const me = g.career.pid;
  const inIt = w.clubs['tots_' + winner].squad.includes(me) ? `the ${lgName(winner)} TOTS` : w.clubs.tots_allstars.squad.includes(me) ? 'the All-Stars' : '';
  addNews(g, 'world', `${lgName(winner)} TOTS top the table — the All-Stars await`, `${lgName(winner)}'s Team of the Season finished first with ${table[0].pts} points and meet the All-Stars in the final.${inIt ? ` You are in the squad for ${inIt}.` : ''}`, { imp: 2, me: !!inIt });
}

/** After the final: the cup goes into the record books and the borrowed sides are dissolved. */
export function totsCupFinish(g: Game, force = false): TotsCup | null {
  const w = g.world, L = w.totsLive;
  if (!L) return null;
  const fin = L.final ? w.fixtures[L.final] : undefined;
  if (L.final && !fin?.played && !force) return null;
  const scorers = (f: { goals?: [number, number, string, string, number, number, number][] }) => (f.goals ?? []).filter((x) => x[4] !== 2).map((x) => `${w.players[x[2]]?.sn ?? '?'} ${x[0]}'`);
  const matches: TotsMatch[] = [];
  for (const id in w.fixtures) { const f = w.fixtures[id]; if (f.comp === 'totscup' && f.stg === 'Group' && f.played && f.sc) matches.push({ h: f.h.slice(5), a: f.a.slice(5), sc: [f.sc[0], f.sc[1]], scorers: scorers(f as never) }); }
  const table = totsTable(g);
  const winner = table[0]?.lg ?? '';
  const final: TotsMatch = fin?.sc ? { h: winner, a: 'allstars', sc: [fin.sc[0], fin.sc[1]], pens: fin.pens ? [fin.pens[0], fin.pens[1]] : undefined, scorers: scorers(fin as never) } : { h: winner, a: 'allstars', sc: [0, 0], scorers: [] };
  const champion = fin ? (winnerId(fin) === fin.h ? winner : 'allstars') : winner;
  const cup: TotsCup = { s: L.s, teams: L.teams, table, matches, winner, allStars: L.allStars ?? { lg: 'allstars', name: 'All-Stars', xi: [], form: '4-3-3' }, final, champion };
  (w.totsCup ??= []).push(cup);
  if (w.totsCup.length > 30) w.totsCup.shift();
  // the cup lines are kept in the cup record, not in anyone's season statistics
  for (const id in w.players) delete w.players[id].ss.totscup;
  for (const id of Object.keys(w.fixtures)) if (w.fixtures[id].comp === 'totscup') delete w.fixtures[id];
  for (const id of L.made) delete w.clubs[id];
  delete w.totsLive;
  const lgN = (lg: string) => (lg === 'allstars' ? 'the All-Stars' : `the ${lgName(lg)} Team of the Season`);
  addNews(g, 'world', `Team of the Season Cup: ${champion === 'allstars' ? 'the All-Stars' : lgName(winner) + ' TOTS'} lift the trophy`, `${lgN(winner)} met ${lgN('allstars')} in the final: ${final.sc[0]}–${final.sc[1]}${final.pens ? ` (${final.pens[0]}–${final.pens[1]} on penalties)` : ''}.`, { imp: 2 });
  const me = g.career.pid;
  const side = (champion === 'allstars' ? cup.allStars.xi : cup.teams.find((t) => t.lg === winner)?.xi ?? []);
  if (side.includes(me)) milestone(g, 'award', `Won the ${seasonLabel(L.s)} Team of the Season Cup.`);
  return cup;
}
const lgName = (id: string) => LEAGUES.find((l) => l.id === id)?.name ?? id;


// ── the best elevens in history ──
const SLOT_OK: Record<string, Pos[]> = {
  GK: ['GK'], CB: ['CB'], LB: ['LB', 'LM'], RB: ['RB', 'RM'], DM: ['DM', 'CM'], CM: ['CM', 'DM', 'AM'], AM: ['AM', 'CM', 'SS'],
  LW: ['LW', 'LM', 'SS', 'RW'], RW: ['RW', 'RM', 'SS', 'LW'], ST: ['ST', 'SS'],
};
const FORM_433: Pos[] = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW'] as Pos[];
export interface HistoryXI { xi: AwardXI[]; ovr: number; form: string }
/**
 * The best eleven ever named in a Team of the Season (one league, or all of them together): each pick is a
 * player in one particular season, rated as he was that season. The same player may appear twice, from
 * two different seasons — never the same season twice.
 */
export function historyXI(g: Game, league: string | 'all'): HistoryXI | null {
  const w = g.world;
  const cands: AwardXI[] = [];
  for (const a of Object.values(w.awards)) {
    if (!a.xi || (a.type !== 'tots' && a.type !== 'world_xi')) continue;
    if (league !== 'all' && a.comp !== league) continue;
    if (league === 'all' && a.type === 'tots' && !TOP.some((l) => l.id === a.comp)) continue;
    for (const x of a.xi) {
      const p = w.players[x.pid];
      const o = x.ovr ?? p?.hist.find((h) => h.s === a.s)?.ovr ?? (p && a.s === w.season ? ovr(p) : 0);
      if (!o) continue;
      cands.push({ ...x, ovr: o, s: a.s, pos: (p?.pos ?? x.pos) as Pos });
    }
  }
  if (cands.length < 11) return null;
  // dedupe: one entry per player and season
  const best = new Map<string, AwardXI>();
  for (const c of cands) { const k = c.pid + ':' + c.s; const e = best.get(k); if (!e || (c.ovr ?? 0) > (e.ovr ?? 0)) best.set(k, c); }
  const pool = [...best.values()].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || b.rat - a.rat);
  const used = new Set<string>(), xi: AwardXI[] = [];
  for (const slot of FORM_433) {
    const c = pool.find((x) => !used.has(x.pid + ':' + x.s) && SLOT_OK[slot].includes(x.pos)) ?? pool.find((x) => !used.has(x.pid + ':' + x.s) && (slot === 'GK') === (x.pos === 'GK'));
    if (!c) continue;
    used.add(c.pid + ':' + c.s);
    xi.push({ ...c, pos: slot });
  }
  if (xi.length < 11) return null;
  return { xi, form: '4-3-3', ovr: Math.round(xi.reduce((s, x) => s + (x.ovr ?? 0), 0) / xi.length) };
}
export const TOP_LEAGUES = TOP;
export const leagueTeamName = (w: Game['world'], id: string) => teamName(w, id);
