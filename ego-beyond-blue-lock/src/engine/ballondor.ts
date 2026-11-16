/**
 * The Ballon d'Or. Like the real one it is held in late October and judges the whole of the previous
 * season, summer tournaments (World Cup, Euros, Copa América…) included. A panel of 100 journalists, one
 * per footballing nation, each rank their top ten (15-12-10-8-7-5-4-3-2-1 points). Every journalist weighs
 * goals, trophies and consistency slightly differently and has a soft spot for his compatriots, so the
 * vote is close when the season was close and a landslide when one player was in a different world.
 *
 * The case has three parts. Output: goals and assists, weighted by the competition they came in (a Champions
 * League or World Cup goal is worth far more than a cup-tie goal). Trophies. And, weighing most, consistency:
 * the share of top-level games, few poor ones, the average level, availability, and big knockout nights.
 */
import { ordinal } from './util';
import type { Award, AwardNom, Game, Player } from './types';
import { S, newLine, addLine } from './match/model';
import { POS_LINE } from './attributes';
import { NATIONS, NAME_POOLS, nationName } from './data/nations';
import { LEAGUES } from './data/clubs';
import { dayOf, seasonLabel } from './competitions';
import { teamName } from './match/setup';
import { giveAward, bestXI, type Cand } from './awards';
import { addNews, milestone } from './util';
import { Rng } from './rng';

/** Late October of the following season (the real gala moved between late September and early November). */
export const BDO_DAY = dayOf(13, 0);
export const BDO_POINTS = [15, 12, 10, 8, 7, 5, 4, 3, 2, 1];

export interface BdoRow {
  pid: string; name: string; nat: string; pos: string; club: string; clubName: string; age: number;
  g: number; a: number; apps: number; rat: number; cs: number; sv: number;
  gW: number; aW: number; trophies: string[]; tPts: number; intl: string;
  /** share of good games (7.2+), percent; goals + assists in knockout ties and finals (finals count double) */
  good?: number; bigGA?: number;
  /** components of the case, so each journalist can weigh them differently */
  sGoals: number; sTroph: number; sForm: number;
}
export interface BdoVote { j: string; out: string; nat: string; picks: string[] }

/** Where it was done: a goal in the Champions League or at a World Cup is worth far more than one in a domestic cup tie. */
const COMP_W: Record<string, number> = { ucl: 1.5, uel: 1.05, wc: 1.6, euro: 1.4, copa: 1.35, afcon: 1.1, asian: 1.05, gold: 1.0 };
const LEAGUE_W: Record<string, number> = { eng1: 1, esp1: 1, ger1: 0.96, ita1: 0.96, fra1: 0.9, ned1: 0.72, por1: 0.74, eng2: 0.5, eng3: 0.35 };
const TOP5 = ['eng1', 'esp1', 'ger1', 'ita1', 'fra1'];
const CUPS = new Set(LEAGUES.map((l) => l.cup));
/** What winning each competition adds to a Ballon d'Or case. */
function trophyPts(cid: string): number {
  // the big ones decide Ballon d'Ors: a World Cup or a Champions League is worth a whole season of goals
  if (cid === 'wc') return 95; if (cid === 'ucl') return 85; if (cid === 'euro' || cid === 'copa') return 60;
  if (TOP5.includes(cid)) return 34; if (LEAGUE_W[cid]) return 14; if (cid === 'uel') return 26;
  if (cid === 'afcon' || cid === 'asian' || cid === 'gold') return 26; if (CUPS.has(cid)) return 10; return 0;
}
/** Diminishing returns: past an elite level, more of the same impresses voters less and less. */
const soft = (x: number, knee: number) => (x <= knee ? x : knee + (x - knee) * 0.45);

/** Every player's case for the season `s` (call before the season's stat lines are archived). */
export function bdoRows(g: Game, minApps = 15, clubAt?: Record<string, string>): BdoRow[] {
  const w = g.world, s = w.season;
  const rows: BdoRow[] = [];
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired) continue;
    const line = newLine();
    let gW = 0, aW = 0, any = false, intl = '';
    for (const cid in p.ss) {
      const comp = w.comps[cid], l = p.ss[cid];
      if (!l[S.APP] || cid === 'nel' || comp?.u20 || comp?.kind === 'friendly' || cid === 'intlf') continue;
      const wt = COMP_W[cid] ?? LEAGUE_W[cid] ?? (CUPS.has(cid) ? 0.6 : comp?.kind === 'intl' ? 1.1 : 0.5);
      gW += l[S.G] * wt; aW += l[S.A] * wt; addLine(line, l); any = true;
      if (comp?.kind === 'intl' && l[S.APP]) intl = comp.name;
    }
    if (!any || line[S.RATN] < minApps) continue;
    const club = clubAt?.[id] ?? p.club ?? '';
    // trophies: the club he finished the season with, and his country in a summer tournament
    const trophies: string[] = []; let tPts = 0;
    const cl = w.clubs[club];
    if (cl) for (const t of cl.trophies) if (t.s === s && (p.ss[t.comp]?.[S.APP] ?? 0) > 0) { const v = trophyPts(t.comp); if (v) { trophies.push(w.comps[t.comp]?.name ?? t.name); tPts += v; } }
    for (const cid in p.ss) { const comp = w.comps[cid]; if (comp?.kind === 'intl' && !comp.u20 && (p.ss[cid][S.APP] ?? 0) > 0 && comp.hist.some((h) => h.s === s && h.champion === p.nat)) { trophies.push(comp.name); tPts += trophyPts(cid) || 14; } }
    const rat = line[S.RAT] / line[S.RATN], ln = POS_LINE[p.pos], n = line[S.RATN];
    // output, weighted by where it came: goals and assists both count, a defender's goal and a keeper's clean sheet more
    const sGoals = gW * (ln === 3 ? 3.2 : ln === 2 ? 3.6 : 4.6) + aW * (ln === 3 ? 2.6 : 3.0) + (ln <= 1 ? line[S.CS] * (ln === 0 ? 2.6 : 1.4) : 0) + (ln === 0 ? line[S.SV] * 0.12 : 0);
    // consistency, the heaviest part of the case: good games, few bad ones, average level and availability
    const f = w.formLog?.[id];
    const good = f && f[0] ? f[1] / f[0] : Math.max(0, Math.min(1, (rat - 6.6) / 1.8)), poor = f && f[0] ? f[2] / f[0] : 0.12;
    const bigN = f ? f[3] : 0, bigGA = f ? f[4] : 0, bigRat = bigN ? (f![5] / bigN) : 0;
    const sForm = (rat - 6.6) * 40 * Math.min(1, n / 35) + (good - 0.35) * 200 * Math.min(1, n / 30) - poor * 90 + Math.min(1, line[S.APP] / 50) * 30 + line[S.POTM] * 1.5
      // and how he played when it mattered most: knockout ties and finals
      + bigGA * 4 + (bigN ? (bigRat - 6.8) * 6 * Math.min(bigN, 8) : 0);
    rows.push({ pid: id, name: p.name, nat: p.nat, pos: p.pos, club, clubName: club ? teamName(w, club) : '—', age: s - p.born, g: line[S.G], a: line[S.A], apps: line[S.APP], rat, cs: line[S.CS], sv: line[S.SV], gW, aW, trophies, tPts, intl, good: Math.round(good * 100), bigGA, sGoals: soft(sGoals, 160), sTroph: tPts * 1.3, sForm: soft(sForm, 150) });
  }
  return rows.sort((a, b) => base(b) - base(a));
}
export const base = (r: BdoRow) => r.sGoals + r.sTroph + r.sForm;
export const bdoLine = (r: BdoRow) => `${r.g} goals, ${r.a} assists in ${r.apps} games · avg ${r.rat.toFixed(2)}${r.good != null ? ` · ${r.good}% top-level games` : ''}${r.bigGA ? ` · ${r.bigGA} in big games` : ''}${r.trophies.length ? ` · ${r.trophies.join(', ')}` : ''}`;

/** Stash the season's cases at the end of the summer, before the stat lines are archived. */
export function bdoSnapshot(g: Game): void {
  const w = g.world;
  const rows = bdoRows(g, 15, w.seasonClub);
  // the top of the list, plus the best keepers and young players for the Yashin and Kopa trophies
  const keep = new Set([...rows.slice(0, 80), ...rows.filter((r) => r.pos === 'GK').slice(0, 10), ...rows.filter((r) => r.age <= 21).slice(0, 12)]);
  w.bdoPending = { s: w.season, rows: rows.filter((r) => keep.has(r)) };
  delete w.seasonClub;
  w.formLog = {};
}
/** At the end of the club season remember where everyone played, before the summer window moves them. */
export function rememberSeasonClubs(g: Game): void {
  const w = g.world, m: Record<string, string> = {};
  for (const id in w.players) { const p = w.players[id]; if (p.club && Object.values(p.ss).some((l) => l[S.RATN] >= 8)) m[id] = p.club; }
  w.seasonClub = m;
}

const OUTLETS = ['Sport Daily', 'Football Times', 'Sports Herald', 'Football Gazette', 'Goal Review', 'Sports Weekly', 'Matchday Journal', 'The Football Post'];
function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** The panel: one journalist from each of the 100 strongest footballing nations. Stable from year to year. */
export function journalists(): { j: string; out: string; nat: string; wG: number; wT: number; wF: number; homer: number }[] {
  return Object.values(NATIONS).sort((a, b) => b.str - a.str || a.id.localeCompare(b.id)).slice(0, 100).map((n) => {
    const h = hashStr('bdo:' + n.id), pool = NAME_POOLS[n.pool] ?? NAME_POOLS.en;
    const r = Rng.seeded(h);
    const j = `${r.pick(pool.first)} ${r.pick(pool.last)}`;
    // each voter has a style: the stat-counter, the trophy-hunter, the purist who watches every game
    return { j, out: `${n.name} ${OUTLETS[h % OUTLETS.length]}`, nat: n.id, wG: 0.6 + r.next() * 0.8, wT: 0.5 + r.next() * 1.2, wF: 0.85 + r.next() * 0.6, homer: 0.04 + r.next() * 0.12 };
  });
}

/** Run the gala: the Ballon d'Or by journalist vote plus the trophies handed out on the same night. */
export function ballonDorGala(g: Game): string[] {
  const w = g.world, pend = w.bdoPending;
  if (!pend || !pend.rows.length) return [];
  delete w.bdoPending;
  const s = pend.s, rows = pend.rows, period = seasonLabel(s);
  const rng = Rng.seeded(hashStr(`bdo:${w.seed}:${s}`));
  // the shortlist: thirty nominees announced in September, as for the real award
  const short = rows.slice(0, 30);
  const pts: Record<string, number> = {}, firsts: Record<string, number> = {}, votes: BdoVote[] = [];
  for (const J of journalists()) {
    const sc = short.map((r) => ({ r, v: (r.sGoals * J.wG + r.sTroph * J.wT + r.sForm * J.wF) * (1 + (r.nat === J.nat ? J.homer : 0)) * (1 + (rng.next() - 0.5) * 0.36) }));
    sc.sort((a, b) => b.v - a.v);
    const picks = sc.slice(0, 10).map((x) => x.r.pid);
    picks.forEach((pid, i) => { pts[pid] = (pts[pid] ?? 0) + BDO_POINTS[i]; if (i === 0) firsts[pid] = (firsts[pid] ?? 0) + 1; });
    votes.push({ j: J.j, out: J.out, nat: J.nat, picks });
  }
  const ranked = [...short].sort((a, b) => (pts[b.pid] ?? 0) - (pts[a.pid] ?? 0) || (firsts[b.pid] ?? 0) - (firsts[a.pid] ?? 0) || base(b) - base(a));
  const nomOf = (r: BdoRow, line = bdoLine(r), score = pts[r.pid] ?? 0): AwardNom => ({ pid: r.pid, name: r.name, club: r.club, clubName: r.clubName, line, score });
  const ids: string[] = [];
  const give = (a: Omit<Award, 'day' | 's' | 'me' | 'comp' | 'compName' | 'period'>) => { const x = giveAward(g, { ...a, comp: 'bdo', compName: "Ballon d'Or Gala", period, s }, true); if (x) ids.push(x.id); return x; };
  // the supporting trophies first, as on the night
  const young = rows.filter((r) => r.age <= 21);
  if (young.length) give({ id: `kopa:bdo:${s}`, type: 'kopa', title: 'Kopa Trophy', winner: nomOf(young[0], bdoLine(young[0]), Math.round(base(young[0]))), noms: young.slice(0, 5).map((r) => nomOf(r, bdoLine(r), Math.round(base(r)))), why: "Best player in the world aged 21 or under, judged on the same case as the Ballon d'Or.", mode: 'vote' });
  const gkScore = (r: BdoRow) => r.cs * 3 + r.sv * 0.14 + (r.rat - 6.5) * 14 + r.tPts * 0.4;
  const gks = rows.filter((r) => r.pos === 'GK').sort((a, b) => gkScore(b) - gkScore(a));
  if (gks.length) give({ id: `yashin:bdo:${s}`, type: 'yashin', title: 'Yashin Trophy', winner: nomOf(gks[0], `${gks[0].cs} clean sheets, ${gks[0].sv} saves · avg ${gks[0].rat.toFixed(2)}`, Math.round(gkScore(gks[0]))), noms: gks.slice(0, 5).map((r) => nomOf(r, `${r.cs} clean sheets, ${r.sv} saves · avg ${r.rat.toFixed(2)}`, Math.round(gkScore(r)))), why: 'Best goalkeeper in the world: clean sheets, saves, form and trophies.', mode: 'vote' });
  const scorers = [...rows].sort((a, b) => b.g - a.g || b.a - a.a);
  if (scorers.length) give({ id: `muller:bdo:${s}`, type: 'muller', title: 'Gerd Müller Trophy', winner: nomOf(scorers[0], `${scorers[0].g} goals for club and country`, scorers[0].g), noms: scorers.slice(0, 8).map((r) => nomOf(r, `${r.g} goals for club and country`, r.g)), why: 'Most goals for club and country over the whole season, summer tournament included.', mode: 'rank' });
  { // club and coach of the year: what the season's trophies were worth
    const cl = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant).map((c) => ({ c, t: c.trophies.filter((t) => t.s === s), sc: c.trophies.filter((t) => t.s === s).reduce((x, t) => x + trophyPts(t.comp), 0) + c.rep * 0.05 })).filter((x) => x.t.length).sort((a, b) => b.sc - a.sc);
    if (cl.length) {
      const ln = (x: (typeof cl)[number]) => x.t.map((t) => w.comps[t.comp]?.name ?? t.name).join(', ');
      give({ id: `bdo_club:bdo:${s}`, type: 'bdo_club', title: 'Club of the Year', winner: { pid: '', name: cl[0].c.name, club: cl[0].c.id, clubName: cl[0].c.name, line: ln(cl[0]), score: Math.round(cl[0].sc) }, noms: cl.slice(0, 5).map((x) => ({ pid: '', name: x.c.name, club: x.c.id, clubName: x.c.name, line: ln(x), score: Math.round(x.sc) })), why: 'The club whose season was worth the most silverware.', mode: 'vote' });
      give({ id: `cruyff:bdo:${s}`, type: 'cruyff', title: 'Johan Cruyff Trophy', winner: { pid: '', name: cl[0].c.mgr.name, club: cl[0].c.id, clubName: cl[0].c.name, line: ln(cl[0]), score: Math.round(cl[0].sc) }, noms: cl.slice(0, 5).map((x) => ({ pid: '', name: x.c.mgr.name, club: x.c.id, clubName: x.c.name, line: ln(x), score: Math.round(x.sc) })), why: 'Coach of the year.', mode: 'vote' });
    }
  }
  { // the Dream Team: the best eleven of the voting
    const cands: Cand[] = rows.map((r) => ({ p: w.players[r.pid], club: r.club, score: base(r), rat: r.rat, line: newLine() })).filter((c) => c.p);
    const xi = bestXI(g, cands);
    if (xi.xi.length === 11) give({ id: `bdo_xi:bdo:${s}`, type: 'bdo_xi', title: "Ballon d'Or Dream Team", xi: xi.xi, form: xi.form, why: `The panel's best eleven of the season in a ${xi.form}.` });
  }
  if (ranked.length) {
    const top = ranked[0];
    const a = give({ id: `world_player:bdo:${s}`, type: 'world_player', title: "Ballon d'Or", winner: nomOf(top), noms: ranked.map((r) => nomOf(r)), votes, why: `Voted by 100 journalists, one from each of the world's top footballing nations. Each ranks ten players (15, 12, 10, 8, 7, 5, 4, 3, 2 and 1 points). ${top.name} received ${pts[top.pid]} points and ${firsts[top.pid] ?? 0} first-place votes.`, mode: 'vote' });
    if (a) {
      const me = g.career.pid, myRank = ranked.findIndex((r) => r.pid === me);
      (g.career.bdoHist ??= []).push({ s, rank: myRank >= 0 ? myRank + 1 : 0, pts: pts[me] ?? 0, winner: top.name });
      if (myRank > 0) { milestone(g, 'award', `${ordinal(myRank + 1)} in the ${period} Ballon d'Or with ${pts[me]} points.`); addNews(g, 'award', `Ballon d'Or: you finish ${ordinal(myRank + 1)}`, `${top.name} won it with ${pts[top.pid]} points. You received ${pts[me]}, with ${firsts[me] ?? 0} first-place votes.`, { imp: 3, me: true }); }
      addNews(g, 'paper', `${top.name} wins the Ballon d'Or`, `${top.name} (${top.clubName}) collects ${pts[top.pid]} points, ${pts[top.pid] - (pts[ranked[1]?.pid] ?? 0)} ahead of ${ranked[1]?.name ?? 'the field'}. ${bdoLine(top)}.`, { imp: 3, pids: [top.pid] });
    }
  }
  // once a decade: the Super Ballon d'Or for the best player of the last ten years
  if (s % 10 === 9) {
    const tally: Record<string, { name: string; club: string; clubName: string; wins: number; pod: number; top10: number; pts: number; n: number }> = {};
    for (const a of Object.values(w.awards)) {
      if (a.type !== 'world_player' || a.s < s - 9 || a.s > s) continue;
      (a.noms ?? []).forEach((n, i) => { const e = (tally[n.pid] ??= { name: n.name, club: n.club, clubName: n.clubName, wins: 0, pod: 0, top10: 0, pts: 0, n: 0 }); if (i === 0) e.wins++; if (i < 3) e.pod++; if (i < 10) e.top10++; e.pts += a.votes ? n.score : Math.max(0, 30 - i) * 30; e.n++; e.club = n.club; e.clubName = n.clubName; });
    }
    const sc = (e: (typeof tally)[string]) => e.wins * 900 + e.pod * 300 + e.top10 * 60 + e.pts * 0.4;
    const list = Object.entries(tally).sort((a, b) => sc(b[1]) - sc(a[1])).slice(0, 5);
    if (list.length >= 3) {
      const nomS = ([pid, e]: (typeof list)[number]): AwardNom => ({ pid, name: e.name, club: e.club, clubName: e.clubName, line: `${e.wins} Ballon d'Or${e.wins === 1 ? '' : 's'}, ${e.pod} podium${e.pod === 1 ? '' : 's'}, ${e.top10} top-ten finishes in ten years`, score: Math.round(sc(e)) });
      give({ id: `super_bdo:bdo:${s}`, type: 'super_bdo', title: "Super Ballon d'Or", winner: nomS(list[0]), noms: list.map(nomS), why: `Awarded once a decade to the best player of the last ten Ballon d'Ors (${seasonLabel(s - 9)} to ${seasonLabel(s)}): wins first, then podiums, top-ten finishes and points.`, mode: 'vote' });
      addNews(g, 'paper', `${list[0][1].name} wins the Super Ballon d'Or`, `The best player of the decade: ${nomS(list[0]).line}.`, { imp: 3, pids: [list[0][0]] });
    }
  }
  g.career.flags.gala = s;
  return ids;
}

/** In-season Ballon d'Or power ranking (no votes yet: the panel's average view of the case so far). */
export function bdoForm(g: Game, minApps: number): BdoRow[] { return bdoRows(g, minApps); }
export function natName(id: string): string { return nationName(id); }
export type { Player };
