/**
 * Team sheets: every club's end-of-season line-up kept for the archive, the Team of the Season Cup
 * (each top league's Team of the Season plays the others, the winner then faces the All-Stars of every
 * other league), and the best elevens in history built from every Team of the Season ever named.
 */
import type { AwardXI, Game, Pos } from './types';
import { LEAGUES } from './data/clubs';
import { ovr } from './attributes';
import { pickSheet, teamInfo, teamName } from './match/setup';
import { mkComp } from './competitions';
import { S } from './match/model';
import { seasonLines } from './awards';
import { tempClub, autoSheet, playSim } from './quickmatch';
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

/** The end-of-season Team of the Season Cup. Runs after the season awards; leaves no trace on players. */
export function totsCup(g: Game): TotsCup | null {
  const w = g.world, s = w.season;
  if (w.totsCup?.some((x) => x.s === s)) return null;
  if (!w.comps.totscup) mkComp(w, { id: 'totscup', name: 'Team of the Season Cup', sn: 'TOTS Cup', kind: 'friendly', teams: [] });
  const teams: TotsTeam[] = [];
  const made: string[] = [];
  for (const L of TOP) {
    const a = w.awards[`tots:${L.id}:${s}`];
    if (!a?.xi || a.xi.length !== 11) continue;
    const xi = a.xi.map((x) => x.pid).filter((id) => w.players[id] && !w.players[id].retired);
    if (xi.length < 11) continue;
    // a bench of the league's next-best performers
    const bench = seasonLines(g, L.id).filter((c) => !xi.includes(c.p.id) && !c.p.retired && c.line[S.RATN] >= 8).sort((x, y) => y.score - x.score).slice(0, 8).map((c) => c.p.id);
    const id = 'tots_' + L.id;
    w.clubs[id] = tempClub(g, id, `${L.name} TOTS`, L.sn, LG_COL[L.id] ?? ['#222', '#fff'], a.form ?? '4-3-3', [...xi, ...bench], `${L.name} Team of the Season`);
    made.push(id);
    teams.push({ lg: L.id, name: `${L.name} TOTS`, xi, form: a.form ?? '4-3-3' });
  }
  const clean = () => { for (const id of made) delete w.clubs[id]; };
  if (teams.length < 3) { clean(); return null; }
  const sheet = (id: string) => autoSheet(g, id);
  const table: Record<string, TotsRow> = Object.fromEntries(teams.map((t) => [t.lg, { lg: t.lg, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  const matches: TotsMatch[] = [];
  const scorers = (ms: ReturnType<typeof playSim>) => ms.goals.filter((x) => x[4] !== 2).map((x) => `${w.players[x[2]]?.sn ?? '?'} ${x[0]}'`);
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
    const h = 'tots_' + teams[i].lg, a = 'tots_' + teams[j].lg;
    const ms = playSim(g, h, a, [sheet(h), sheet(a)], { comp: 'totscup', neutral: true });
    const [x, y] = ms.score;
    matches.push({ h: teams[i].lg, a: teams[j].lg, sc: [x, y], scorers: scorers(ms) });
    const A = table[teams[i].lg], B = table[teams[j].lg];
    A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
    if (x > y) { A.w++; B.l++; A.pts += 3; } else if (x < y) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  const rows = Object.values(table).sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
  const winner = rows[0].lg;
  // the All-Stars: every other league's Team of the Season, the best eleven of them picked on the day
  const pool = [...new Set(teams.filter((t) => t.lg !== winner).flatMap((t) => t.xi))];
  w.clubs.tots_allstars = tempClub(g, 'tots_allstars', 'All-Stars', 'ALL', ['#f4f4f4', '#d4af37'], '4-3-3', pool, 'The best of every other league');
  made.push('tots_allstars');
  const as = pickSheet(null, w, teamInfo(w, 'tots_allstars'));
  const allStars: TotsTeam = { lg: 'allstars', name: 'All-Stars', xi: as.xi.map((x) => x.pid), form: as.form };
  const fh = 'tots_' + winner;
  const fms = playSim(g, fh, 'tots_allstars', [sheet(fh), sheet('tots_allstars')], { comp: 'totscup', neutral: true, knockout: true });
  const final: TotsMatch = { h: winner, a: 'allstars', sc: [fms.score[0], fms.score[1]], pens: fms.pens ? [fms.pens[0], fms.pens[1]] : undefined, scorers: scorers(fms) };
  const champion = fms.winner === 0 ? winner : 'allstars';
  clean();
  const cup: TotsCup = { s, teams, table: rows, matches, winner, allStars, final, champion };
  (w.totsCup ??= []).push(cup);
  if (w.totsCup.length > 30) w.totsCup.shift();
  const lgName = (lg: string) => (lg === 'allstars' ? 'the All-Stars' : `the ${LEAGUES.find((l) => l.id === lg)?.name} Team of the Season`);
  addNews(g, 'world', `Team of the Season Cup: ${champion === 'allstars' ? 'the All-Stars' : LEAGUES.find((l) => l.id === winner)?.name + ' TOTS'} lift the trophy`, `${lgName(winner)} topped the round robin and met ${lgName('allstars')} in the final: ${final.sc[0]}–${final.sc[1]}${final.pens ? ` (${final.pens[0]}–${final.pens[1]} on penalties)` : ''}.`, { imp: 2 });
  const me = g.career.pid;
  const mine = (champion === 'allstars' ? allStars.xi : teams.find((t) => t.lg === winner)?.xi ?? []).includes(me);
  if (teams.some((t) => t.xi.includes(me)) || allStars.xi.includes(me)) {
    if (mine) milestone(g, 'award', `Won the ${s}/${String((s + 1) % 100).padStart(2, '0')} Team of the Season Cup.`);
    addNews(g, 'award', mine ? 'Team of the Season Cup winners — and you were in the side' : 'You played in the Team of the Season Cup', `${lgName(winner)} v ${lgName('allstars')}: ${final.sc[0]}–${final.sc[1]}.`, { imp: 2, me: true });
  }
  return cup;
}

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
