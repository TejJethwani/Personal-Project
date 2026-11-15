/**
 * Awards. Every award considers the WHOLE eligible competition (never just the user's club),
 * is position-aware, stores nominees with the statistics behind the decision, and affects
 * reputation only — never attributes.
 */
import type { Award, AwardNom, AwardType, AwardXI, Competition, Game, Player, Pos } from './types';
import { POS_LINE } from './attributes';
import { clamp } from './rng';
import { S, NSTAT, newLine, addLine } from './match/model';
import { teamName } from './match/setup';
import { compFixtures, monthName, seasonLabel, tableOf } from './competitions';
import { addNews, milestone } from './util';

/** Performance score of a stat line over a period (rating is already position-aware). */
export function perfScore(line: number[], pos: Pos): number {
  if (!line[S.RATN]) return -99;
  const avg = line[S.RAT] / line[S.RATN];
  const ln = POS_LINE[pos];
  return (avg - 6) * Math.sqrt(line[S.RATN]) * 10 + line[S.G] * (ln === 3 ? 2 : ln === 2 ? 2.4 : 3) + line[S.A] * 1.7 + line[S.CS] * (ln <= 1 ? 1.6 : 0) + line[S.POTM] * 2 + (ln === 0 ? line[S.SV] * 0.25 : 0);
}
export function statBlurb(line: number[], pos: Pos): string {
  const parts: string[] = [];
  const ln = POS_LINE[pos];
  if (line[S.G]) parts.push(`${line[S.G]} goal${line[S.G] > 1 ? 's' : ''}`);
  if (line[S.A]) parts.push(`${line[S.A]} assist${line[S.A] > 1 ? 's' : ''}`);
  if (ln === 0) { parts.push(`${line[S.SV]} saves`); }
  if (ln <= 1 && line[S.CS]) parts.push(`${line[S.CS]} clean sheet${line[S.CS] > 1 ? 's' : ''}`);
  if (ln <= 2 && line[S.TKW] + line[S.INT] >= 4) parts.push(`${line[S.TKW] + line[S.INT]} tackles + interceptions`);
  if (line[S.KP] >= 3 && ln >= 2) parts.push(`${line[S.KP]} chances created`);
  if (line[S.RATN]) parts.push(`avg rating ${(line[S.RAT] / line[S.RATN]).toFixed(2)}${line[S.RATN] > 1 ? ` in ${line[S.RATN]} matches` : ''}`);
  return parts.join(', ');
}

const SLOT_OK: Record<string, Pos[]> = {
  GK: ['GK'], CB: ['CB'], LB: ['LB', 'LM'], RB: ['RB', 'RM'], DM: ['DM', 'CM'], CM: ['CM', 'DM', 'AM'], AM: ['AM', 'CM', 'SS'],
  LM: ['LM', 'LW', 'LB'], RM: ['RM', 'RW', 'RB'], LW: ['LW', 'LM', 'SS', 'RW'], RW: ['RW', 'RM', 'SS', 'LW'], ST: ['ST', 'SS'], SS: ['SS', 'ST', 'AM'],
};
const XI_FORMS: Record<string, string[]> = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'DM', 'CM', 'RM', 'ST', 'SS'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
};
export interface Cand { p: Player; club: string; score: number; rat: number; line: number[] }
/** Pick a plausible best XI: try several formations and keep the one with the highest total score. */
export function bestXI(g: Game, cands: Cand[]): { form: string; xi: AwardXI[] } {
  let best: { form: string; xi: AwardXI[]; total: number } | null = null;
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  for (const form in XI_FORMS) {
    const used = new Set<string>();
    const xi: AwardXI[] = [];
    let total = 0;
    for (const slot of XI_FORMS[form]) {
      const ok = SLOT_OK[slot];
      const c = sorted.find((x) => !used.has(x.p.id) && ok.includes(x.p.pos)) ?? sorted.find((x) => !used.has(x.p.id) && (slot === 'GK') === (x.p.pos === 'GK'));
      if (!c) continue;
      used.add(c.p.id);
      total += c.score - (c.p.pos === slot ? 0 : 0.6);
      xi.push({ pid: c.p.id, name: c.p.name, pos: slot as Pos, club: c.club, clubName: teamName(g.world, c.club), rat: Math.round(c.rat * 100) / 100 });
    }
    if (xi.length === 11 && (!best || total > best.total)) best = { form, xi, total };
  }
  return best ?? { form: '4-3-3', xi: [] };
}

const REP_GAIN: Partial<Record<AwardType, number>> = { potr: 2, potw: 1, potm: 3, gotm: 1.5, pots: 8, ypots: 5, boot: 5, playmaker: 4, glove: 4, nel_mvp: 10, nel_boot: 6, nel_playmaker: 5, nel_glove: 4, nel_goal: 3, world_player: 14, world_young: 8, world_gk: 8, world_goal: 4, tourn_best: 8, tourn_boot: 5, def_s: 4, mid_s: 4, fwd_s: 4, signing_s: 3, golden_shoe: 8, world_def: 7, world_mid: 7, world_fwd: 7, world_scorer: 6, world_playmaker: 5, tourn_young: 4, tourn_glove: 4, potm_king: 3, dribbler: 3, ballwinner: 3, ironman: 2, breakout: 4, veteran: 3, world_dribbler: 5, world_ballwinner: 5, world_veteran: 4, world_breakout: 6, world_potm: 5 };
/** Routine recognitions: recorded and reported, but never treated as career honours (no timeline entry, no pop-up). */
export const MINOR_AWARDS: AwardType[] = ['potw', 'totw', 'potr', 'totr', 'gotm', 'totm'];
export const isMinorAward = (t: AwardType) => MINOR_AWARDS.includes(t);

function nom(g: Game, c: Cand): AwardNom {
  return { pid: c.p.id, name: c.p.name, club: c.club, clubName: teamName(g.world, c.club), line: statBlurb(c.line, c.p.pos), score: Math.round(c.score * 10) / 10 };
}

/** Store an award exactly once (deterministic id), apply reputation and career hooks. */
export function giveAward(g: Game, a: Omit<Award, 'day' | 's' | 'me'> & { s?: number }, news = false): Award | null {
  const w = g.world;
  if (w.awards[a.id]) return null;
  const me = g.career.pid;
  const aw: Award = { ...a, s: a.s ?? w.season, day: w.day, me: a.winner?.pid === me || !!a.xi?.some((x) => x.pid === me) || !!a.noms?.some((n) => n.pid === me) };
  w.awards[aw.id] = aw;
  w.awardIds.push(aw.id);
  const gain = REP_GAIN[aw.type] ?? 0;
  if (aw.winner) {
    const p = w.players[aw.winner.pid];
    if (p) { p.awards.push(aw.id); p.rep = clamp(p.rep + gain, 0, 99); p.notable = true; }
  }
  if (aw.xi) for (const x of aw.xi) { const p = w.players[x.pid]; if (p) { if (aw.type === 'tots' || aw.type === 'nel_xi' || aw.type === 'world_xi' || aw.type === 'tourn_xi') { p.awards.push(aw.id); p.rep = clamp(p.rep + 2.5, 0, 99); p.notable = true; } else if (x.pid === me) p.awards.push(aw.id); } }
  const mine = aw.winner?.pid === me || (!!aw.xi?.some((x) => x.pid === me));
  if (mine && isMinorAward(aw.type)) {
    addNews(g, 'award', aw.xi ? `You are in the ${aw.title}` : `You win: ${aw.title}`, `${aw.compName}${aw.period ? `, ${aw.period}` : ''}. ${aw.why}`, { imp: 1, me: true });
  } else if (mine) {
    milestone(g, 'award', `${aw.title} — ${aw.compName}${aw.period ? ` (${aw.period})` : ''}.`);
    addNews(g, 'award', `You win: ${aw.title}`, `${aw.compName}${aw.period ? `, ${aw.period}` : ''}. ${aw.why}`, { imp: 3, me: true });
    g.career.flags.awardPop = aw.id;
  } else if (news && aw.winner) {
    addNews(g, 'award', `${aw.winner.name} named ${aw.title}`, `${aw.compName}${aw.period ? `, ${aw.period}` : ''}: ${aw.winner.line}. ${aw.why}`, { imp: 1, pids: [aw.winner.pid], clubs: [aw.winner.club] });
  }
  return aw;
}

function candsFrom(g: Game, acc: Record<string, number[]>, clubOf: (p: Player) => string, min = 1): Cand[] {
  const out: Cand[] = [];
  for (const pid in acc) {
    const p = g.world.players[pid];
    const line = acc[pid];
    if (!p || line[S.RATN] < min) continue;
    out.push({ p, club: clubOf(p), score: perfScore(line, p.pos), rat: line[S.RAT] / line[S.RATN], line });
  }
  return out.sort((a, b) => b.score - a.score);
}
const curClub = (p: Player) => p.club ?? '';

/** Player and Team of the Round for the NEL (the league's weekly equivalents). */
export function nelRoundAwards(g: Game, rd: number): void {
  const w = g.world;
  const acc = w.acc.w.nel ?? {};
  const cands = candsFrom(g, acc, (p) => p.nelTeam ?? curClub(p));
  w.acc.w.nel = {};
  if (!cands.length) return;
  const period = `Round ${rd}`;
  giveAward(g, { id: `potr:nel:${w.season}:${rd}`, type: 'potr', title: 'Player of the Round', comp: 'nel', compName: 'Neo Egoist League', period, winner: nom(g, cands[0]), noms: cands.slice(0, 3).map((c) => nom(g, c)), why: `Best individual performance across both Round ${rd} matches (weekly-equivalent award).` }, true);
  const xi = bestXI(g, cands);
  if (xi.xi.length === 11) giveAward(g, { id: `totr:nel:${w.season}:${rd}`, type: 'totr', title: 'Team of the Round', comp: 'nel', compName: 'Neo Egoist League', period, xi: xi.xi, form: xi.form, why: `Best eleven from the four teams in action, arranged in a ${xi.form}.` });
}

/** Weekly awards for every league (Team of the Week + Player of the Week). */
export function weeklyAwards(g: Game, week: number): void {
  const w = g.world;
  for (const id in w.acc.w) {
    if (id === 'nel') continue;
    const comp = w.comps[id];
    const acc = w.acc.w[id];
    w.acc.w[id] = {};
    if (!comp || comp.kind !== 'league') continue;
    const cands = candsFrom(g, acc, curClub);
    if (cands.length < 22) continue;
    const period = `Week ${week}`;
    giveAward(g, { id: `potw:${id}:${w.season}:${week}`, type: 'potw', title: 'Player of the Week', comp: id, compName: comp.name, period, winner: nom(g, cands[0]), noms: cands.slice(0, 3).map((c) => nom(g, c)), why: 'Highest performance score of all players in the division this week.' });
    const xi = bestXI(g, cands);
    if (xi.xi.length === 11) giveAward(g, { id: `totw:${id}:${w.season}:${week}`, type: 'totw', title: 'Team of the Week', comp: id, compName: comp.name, period, xi: xi.xi, form: xi.form, why: `Best eleven of the division this week in a ${xi.form}.` });
  }
}

/** Player of the Month and Goal of the Month for every league. */
export function monthlyAwards(g: Game, month: number): void {
  const w = g.world;
  const mName = monthName(month);
  for (const id in w.acc.m) {
    const comp = w.comps[id];
    const acc = w.acc.m[id];
    w.acc.m[id] = {};
    if (!comp) continue;
    const cands = candsFrom(g, acc, curClub, 2);
    if (cands.length >= 40) { const xi = bestXI(g, cands); if (xi.xi.length === 11) giveAward(g, { id: `totm:${id}:${w.season}:${month}`, type: 'totm', title: 'Team of the Month', comp: id, compName: comp.name, period: mName, xi: xi.xi, form: xi.form, why: `The best eleven of ${mName} by performance score, in a ${xi.form}.` }); }
    if (cands.length >= 20) giveAward(g, { id: `potm:${id}:${w.season}:${month}`, type: 'potm', title: 'Player of the Month', comp: id, compName: comp.name, period: mName, winner: nom(g, cands[0]), noms: cands.slice(0, 4).map((c) => nom(g, c)), why: `Best sustained form in ${mName} among players with at least two rated appearances.` }, id === g.world.players[g.career.pid]?.con?.club);
  }
  for (const id in w.acc.goals) {
    if (id === 'nel' || id === '__season') continue;
    const comp = w.comps[id];
    const list = w.acc.goals[id].sort((a, b) => b.spec - a.spec);
    w.acc.goals[id] = [];
    if (!comp || !list.length) continue;
    const mk = (x: (typeof list)[number]): AwardNom => ({ pid: x.pid, name: x.name, club: x.club, clubName: teamName(w, x.club), line: `${x.desc}, ${x.min}'`, score: x.spec });
    giveAward(g, { id: `gotm:${id}:${w.season}:${month}`, type: 'gotm', title: 'Goal of the Month', comp: id, compName: comp.name, period: mName, winner: mk(list[0]), noms: list.slice(0, 3).map(mk), why: 'Chosen by spectacle score: difficulty of the chance (low xG), distance, technique and the importance of the moment.' });
    (w.acc.goals.__season ??= []).push(list[0]);
  }
}

export function seasonLines(g: Game, compId: string): Cand[] {
  const out: Cand[] = [];
  const w = g.world;
  for (const id in w.players) {
    const p = w.players[id];
    const line = p.ss[compId];
    if (!line || !line[S.APP]) continue;
    out.push({ p, club: compId === 'nel' ? p.nelTeam ?? curClub(p) : curClub(p), score: perfScore(line, p.pos), rat: line[S.RATN] ? line[S.RAT] / line[S.RATN] : 0, line });
  }
  return out;
}
function top(cands: Cand[], idx: number, tie: number = S.A): Cand[] {
  return [...cands].sort((a, b) => b.line[idx] - a.line[idx] || b.line[tie] - a.line[tie] || a.line[S.SEC] - b.line[S.SEC]);
}

/** End-of-season awards for a league or the NEL. Returns created award ids. */
export function compSeasonAwards(g: Game, comp: Competition, nel = false): string[] {
  const w = g.world;
  const all = seasonLines(g, comp.id);
  if (!all.length) return [];
  const minApps = nel ? 2 : Math.max(8, Math.floor(comp.rounds * 0.4));
  const elig = all.filter((c) => c.line[S.RATN] >= minApps).sort((a, b) => b.score - a.score);
  const period = seasonLabel(w.season);
  const ids: string[] = [];
  const give = (type: AwardType, title: string, list: Cand[], why: string, lineFn?: (c: Cand) => string, mode: 'rank' | 'vote' = 'vote') => {
    if (!list.length) return;
    const mk = (c: Cand) => { const n = nom(g, c); if (lineFn) n.line = lineFn(c); return n; };
    const a = giveAward(g, { id: `${type}:${comp.id}:${w.season}`, type, title, comp: comp.id, compName: comp.name, period, winner: mk(list[0]), noms: list.slice(0, mode === 'rank' ? 10 : 5).map(mk), why, mode }, true);
    if (a) ids.push(a.id);
  };
  give(nel ? 'nel_mvp' : 'pots', nel ? 'NEL Most Valuable Player' : 'Player of the Season', elig, `Highest season-long performance score among players with at least ${minApps} rated appearances.`);
  if (!nel) give('ypots', 'Young Player of the Season', elig.filter((c) => w.season - c.p.born <= 21), 'Best season among players aged 21 or under.');
  give(nel ? 'nel_boot' : 'boot', 'Golden Boot', top(all.filter((c) => c.line[S.G] > 0), S.G), 'Most goals in the competition. Ties are broken by assists, then by fewer minutes played.', (c) => `${c.line[S.G]} goals in ${c.line[S.APP]} appearances`, 'rank');
  // judged on several things, so the outcome is not obvious from one table
  const pmScore = (c: Cand) => c.line[S.A] * 3 + c.line[S.KP] * 0.55 + c.line[S.XA] * 2 + c.line[S.PC] * 0.004 + (c.rat - 6.5) * 4;
  give(nel ? 'nel_playmaker' : 'playmaker', 'Playmaker Award', all.filter((c) => c.line[S.RATN] >= minApps && c.line[S.A] + c.line[S.KP] > 0).sort((a, b) => pmScore(b) - pmScore(a)), 'Judged on assists, chances created, expected assists, passing volume and average rating together.', (c) => `${c.line[S.A]} assists, ${c.line[S.KP]} chances created, xA ${c.line[S.XA].toFixed(1)}, avg ${c.rat.toFixed(2)}`);
  const gkScore = (c: Cand) => c.line[S.CS] * 3 + c.line[S.SV] * 0.12 - (c.line[S.GC] / Math.max(1, c.line[S.APP])) * 9 + (c.rat - 6.5) * 6;
  const gks = all.filter((c) => c.p.pos === 'GK' && c.line[S.APP] >= minApps).sort((a, b) => gkScore(b) - gkScore(a));
  give(nel ? 'nel_glove' : 'glove', nel ? 'Goalkeeper of the Tournament' : 'Golden Glove', gks, 'Judged on clean sheets, saves, goals conceded per game and average rating together.', (c) => `${c.line[S.CS]} clean sheets, ${c.line[S.SV]} saves, ${(c.line[S.GC] / Math.max(1, c.line[S.APP])).toFixed(2)} conceded per game`);
  if (!nel) {
    give('def_s', 'Defender of the Season', elig.filter((c) => POS_LINE[c.p.pos] === 1), 'Best season-long performance score among defenders.');
    give('mid_s', 'Midfielder of the Season', elig.filter((c) => POS_LINE[c.p.pos] === 2), 'Best season-long performance score among midfielders.');
    give('fwd_s', 'Forward of the Season', elig.filter((c) => POS_LINE[c.p.pos] === 3), 'Best season-long performance score among forwards.');
    give('potm_king', 'Most Player-of-the-Match Awards', top(all.filter((c) => c.line[S.POTM] > 0), S.POTM, S.G), 'Most Player of the Match awards in the competition.', (c) => `${c.line[S.POTM]} awards in ${c.line[S.APP]} appearances`, 'rank');
    give('ironman', 'Iron Man', top(all.filter((c) => c.p.pos !== 'GK'), S.SEC, S.APP), 'Most minutes played by an outfield player.', (c) => `${Math.round(c.line[S.SEC] / 60)} minutes in ${c.line[S.APP]} appearances`, 'rank');
    const drScore = (c: Cand) => c.line[S.DC] * 1 + (c.line[S.DA] ? (c.line[S.DC] / c.line[S.DA]) * 30 : 0) + (c.rat - 6.5) * 5;
    give('dribbler', 'Dribbler of the Season', elig.filter((c) => c.line[S.DA] >= 25).sort((a, b) => drScore(b) - drScore(a)), 'Judged on completed dribbles, success rate and average rating together.', (c) => `${c.line[S.DC]}/${c.line[S.DA]} dribbles, avg ${c.rat.toFixed(2)}`);
    const bwScore = (c: Cand) => (c.line[S.TKW] + c.line[S.INT]) * 0.6 + c.line[S.BLK] * 0.8 + (c.rat - 6.5) * 8;
    give('ballwinner', 'Ball-Winner of the Season', elig.filter((c) => POS_LINE[c.p.pos] >= 1 && POS_LINE[c.p.pos] <= 2).sort((a, b) => bwScore(b) - bwScore(a)), 'Judged on tackles won, interceptions, blocks and average rating together.', (c) => `${c.line[S.TKW]} tackles won, ${c.line[S.INT]} interceptions, avg ${c.rat.toFixed(2)}`);
    give('breakout', 'Breakthrough Player', elig.filter((c) => w.season - c.p.born <= 23 && c.p.rep < 55), 'Best season by a player aged 23 or under who was not yet established at the start of it.');
    give('veteran', 'Veteran of the Season', elig.filter((c) => w.season - c.p.born >= 32), 'Best season by a player aged 32 or over.');
    { // Manager of the Season: finishing position against what the squad should achieve
      const tab = tableOf(w, comp.id);
      const ms = tab.map((r, i) => ({ cl: w.clubs[r.id], pos: i + 1, pts: r.pts })).filter((x) => x.cl?.mgr).map((x) => ({ ...x, sc: (x.cl.expect - x.pos) * 1.4 + (x.pos === 1 ? 6 : x.pos <= 4 ? 2.5 : 0) + x.pts * 0.03 })).sort((a, b) => b.sc - a.sc);
      if (ms.length) { const mk = (x: (typeof ms)[number]): AwardNom => ({ pid: '', name: x.cl.mgr.name, club: x.cl.id, clubName: x.cl.name, line: `finished ${x.pos}${['st', 'nd', 'rd'][x.pos - 1] ?? 'th'} with ${x.pts} points (expected ${x.cl.expect}${['st', 'nd', 'rd'][x.cl.expect - 1] ?? 'th'})`, score: Math.round(x.sc * 10) / 10 }); const a = giveAward(g, { id: `manager_s:${comp.id}:${w.season}`, type: 'manager_s', title: 'Manager of the Season', comp: comp.id, compName: comp.name, period, winner: mk(ms[0]), noms: ms.slice(0, 4).map(mk), why: 'Judged on the final position against expectations, with credit for winning the title or a top-four place.', mode: 'vote' }); if (a) ids.push(a.id); }
    }
    give('signing_s', 'Signing of the Season', elig.filter((c) => c.p.con && c.p.con.from === w.season && c.p.con.club === c.p.club), 'Best season by a player who joined his club this season.');
  }
  const xi = bestXI(g, elig);
  if (xi.xi.length === 11) { const a = giveAward(g, { id: `${nel ? 'nel_xi' : 'tots'}:${comp.id}:${w.season}`, type: nel ? 'nel_xi' : 'tots', title: nel ? 'NEL Best Eleven' : 'Team of the Season', comp: comp.id, compName: comp.name, period, xi: xi.xi, form: xi.form, why: `Best eleven over the season in a ${xi.form}.` }); if (a) ids.push(a.id); }
  // store headline numbers on the competition history
  const h = comp.hist[comp.hist.length - 1];
  if (h && h.s === w.season) {
    const ts = top(all, S.G)[0], ta = top(all, S.A)[0];
    if (ts && ts.line[S.G]) h.topScorer = { pid: ts.p.id, name: ts.p.name, v: ts.line[S.G], club: teamName(w, ts.club) };
    if (ta && ta.line[S.A]) h.topAssist = { pid: ta.p.id, name: ta.p.name, v: ta.line[S.A], club: teamName(w, ta.club) };
    if (elig[0]) h.best = { pid: elig[0].p.id, name: elig[0].p.name, club: teamName(w, elig[0].club) };
  }
  return ids;
}

export function nelFinalAwards(g: Game): string[] {
  const w = g.world;
  const ids = compSeasonAwards(g, w.comps.nel, true);
  // goal of the tournament
  let best: { spec: number; pid: string; fid: string; min: number; xg: number } | null = null;
  for (const f of compFixtures(w, 'nel')) for (const gl of f.goals ?? []) if (gl[4] !== 2 && (!best || gl[5] > best.spec)) best = { spec: gl[5], pid: gl[2], fid: f.id, min: gl[0], xg: gl[6] };
  if (best && w.players[best.pid]) {
    const p = w.players[best.pid];
    const a = giveAward(g, { id: `nel_goal:nel:${w.season}`, type: 'nel_goal', title: 'NEL Goal of the Tournament', comp: 'nel', compName: 'Neo Egoist League', period: seasonLabel(w.season), winner: { pid: p.id, name: p.name, club: p.nelTeam ?? '', clubName: teamName(w, p.nelTeam ?? ''), line: `Spectacle ${best.spec}/100 (xG ${(best.xg / 100).toFixed(2)})`, score: best.spec }, why: 'The single most spectacular goal of the league by spectacle score.' }, true);
    if (a) ids.push(a.id);
  }
  return ids;
}

const LEAGUE_WEIGHT: Record<string, number> = { eng1: 1, esp1: 0.98, ger1: 0.94, ita1: 0.95, fra1: 0.9, ned1: 0.78, por1: 0.8, eng2: 0.6, eng3: 0.45, ucl: 1.25, uel: 0.85 };
/** Every player's all-competition form this season, weighted by competition strength (the Ballon d'Or ranking). */
export function worldCands(g: Game, minRated = 15): Cand[] {
  const w = g.world;
  const agg: Record<string, { line: number[]; score: number }> = {};
  for (const id in w.players) {
    const p = w.players[id];
    let line: number[] | null = null, score = 0;
    for (const cid in p.ss) {
      const comp = w.comps[cid];
      const l = p.ss[cid];
      if (!l[S.RATN] || cid === 'nel' || comp?.u20 || comp?.kind === 'friendly') continue;
      const wt = LEAGUE_WEIGHT[cid] ?? (comp?.kind === 'intl' ? 1.3 : comp?.kind === 'cup' ? 0.7 : 0.6);
      score += perfScore(l, p.pos) * wt;
      line ??= newLine();
      addLine(line, l);
    }
    if (line && line[S.RATN] >= minRated) {
      const club = p.club ? w.clubs[p.club] : undefined;
      // team success matters for the world vote
      if (club) for (const t of club.trophies) if (t.s === w.season) score += t.comp === 'ucl' ? 14 : t.comp.endsWith('1') ? 8 : 4;
      agg[id] = { line, score };
    }
  }
  return Object.entries(agg).map(([id, v]) => ({ p: w.players[id], club: w.players[id].club ?? '', score: v.score, rat: v.line[S.RAT] / v.line[S.RATN], line: v.line })).sort((a, b) => b.score - a.score);
}
/** World awards across all competitions of the season (club and international). */
export function worldAwards(g: Game): string[] {
  const w = g.world;
  const cands = worldCands(g);
  const ids: string[] = [];
  const period = seasonLabel(w.season);
  const give = (type: AwardType, title: string, list: Cand[], why: string) => {
    if (!list.length) return;
    const a = giveAward(g, { id: `${type}:world:${w.season}`, type, title, comp: 'world', compName: 'World Football', period, winner: nom(g, list[0]), noms: list.slice(0, type === 'world_player' ? 30 : 5).map((c) => nom(g, c)), why, mode: 'vote' }, true);
    if (a) ids.push(a.id);
  };
  give('world_player', "Ballon d'Or", cands, 'All competitions, weighted by the strength of each league and competition, with a bonus for trophies won.');
  give('world_young', 'Golden Boy', cands.filter((c) => w.season - c.p.born <= 21), 'Best player in world football aged 21 or under.');
  give('world_gk', 'World Goalkeeper of the Year', cands.filter((c) => c.p.pos === 'GK'), 'Best goalkeeper across all competitions.');
  give('world_fwd', 'World Forward of the Year', cands.filter((c) => POS_LINE[c.p.pos] === 3), 'Best forward across all competitions.');
  give('world_mid', 'World Midfielder of the Year', cands.filter((c) => POS_LINE[c.p.pos] === 2), 'Best midfielder across all competitions.');
  { const dr = (c: Cand) => c.line[S.DC] + (c.line[S.DA] ? (c.line[S.DC] / c.line[S.DA]) * 30 : 0) + (c.rat - 6.5) * 5; give('world_dribbler', 'World Dribbler of the Year', cands.filter((c) => c.line[S.DA] >= 30).sort((a, b) => dr(b) - dr(a)), 'Judged on completed dribbles, success rate and average rating across all competitions.'); }
  { const bw = (c: Cand) => (c.line[S.TKW] + c.line[S.INT]) * 0.6 + c.line[S.BLK] * 0.8 + (c.rat - 6.5) * 8; give('world_ballwinner', 'World Ball-Winner of the Year', cands.filter((c) => POS_LINE[c.p.pos] >= 1 && POS_LINE[c.p.pos] <= 2).sort((a, b) => bw(b) - bw(a)), 'Judged on tackles won, interceptions, blocks and average rating across all competitions.'); }
  give('world_breakout', 'World Breakthrough of the Year', cands.filter((c) => w.season - c.p.born <= 23 && c.p.rep < 62), 'Best season in world football by a young player who was not yet a star when it began.');
  give('world_veteran', 'World Veteran of the Year', cands.filter((c) => w.season - c.p.born >= 32), 'Best season in world football by a player aged 32 or over.');
  { // club and manager of the year: the season's trophies decide
    const cl = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant).map((c) => ({ c, sc: c.trophies.filter((t) => t.s === w.season).reduce((x, t) => x + (t.comp === 'ucl' ? 10 : t.comp.endsWith('1') ? 6 : t.comp === 'uel' ? 4 : 3), 0) + c.rep * 0.02 })).filter((x) => x.sc > 2).sort((a, b) => b.sc - a.sc);
    if (cl.length) {
      const line = (x: (typeof cl)[number]) => x.c.trophies.filter((t) => t.s === w.season).map((t) => w.comps[t.comp]?.name ?? t.comp).join(', ') || 'no trophies';
      const mkC = (x: (typeof cl)[number]): AwardNom => ({ pid: '', name: x.c.name, club: x.c.id, clubName: x.c.name, line: line(x), score: Math.round(x.sc * 10) / 10 });
      const a = giveAward(g, { id: `world_club:world:${w.season}`, type: 'world_club', title: 'World Club of the Year', comp: 'world', compName: 'World Football', period, winner: mkC(cl[0]), noms: cl.slice(0, 5).map(mkC), why: 'Decided by the trophies won this season, weighted by their prestige.', mode: 'vote' }, true); if (a) ids.push(a.id);
      const mkM = (x: (typeof cl)[number]): AwardNom => ({ pid: '', name: x.c.mgr.name, club: x.c.id, clubName: x.c.name, line: line(x), score: Math.round(x.sc * 10) / 10 });
      const b = giveAward(g, { id: `world_manager:world:${w.season}`, type: 'world_manager', title: 'World Manager of the Year', comp: 'world', compName: 'World Football', period, winner: mkM(cl[0]), noms: cl.slice(0, 5).map(mkM), why: 'Decided by the trophies his club won this season.', mode: 'vote' }, true); if (b) ids.push(b.id);
    }
  }
  give('world_def', 'World Defender of the Year', cands.filter((c) => POS_LINE[c.p.pos] === 1), 'Best defender across all competitions.');
  {
    const withLine = (title: string, type: AwardType, list: Cand[], fn: (c: Cand) => string, why: string) => {
      if (!list.length) return;
      const mk = (c: Cand) => { const n = nom(g, c); n.line = fn(c); return n; };
      const a = giveAward(g, { id: `${type}:world:${w.season}`, type, title, comp: 'world', compName: 'World Football', period, winner: mk(list[0]), noms: list.slice(0, 10).map(mk), why, mode: type === 'world_playmaker' ? 'vote' : 'rank' }, true);
      if (a) ids.push(a.id);
    };
    withLine('World Top Scorer', 'world_scorer', top(cands.filter((c) => c.line[S.G] > 0), S.G), (c) => `${c.line[S.G]} goals in ${c.line[S.APP]} matches (all competitions)`, 'Most goals for club and country across every competition.');
    const pm = (c: Cand) => c.line[S.A] * 3 + c.line[S.KP] * 0.55 + c.line[S.XA] * 2 + (c.rat - 6.5) * 4;
    withLine('World Playmaker of the Year', 'world_playmaker', cands.filter((c) => c.line[S.A] + c.line[S.KP] > 0).sort((a, b) => pm(b) - pm(a)), (c) => `${c.line[S.A]} assists, ${c.line[S.KP]} chances created, avg ${c.rat.toFixed(2)}`, 'Judged on assists, chances created, expected assists and average rating across every competition.');
    withLine('Most Player-of-the-Match Awards in World Football', 'world_potm', top(cands.filter((c) => c.line[S.POTM] > 0), S.POTM, S.G), (c) => `${c.line[S.POTM]} awards in ${c.line[S.APP]} matches`, 'Most Player of the Match awards across every competition.');
    // European Golden Shoe: league goals × league coefficient
    const shoe: (Cand & { pts: number; g: number; lg: string })[] = [];
    for (const id in w.players) {
      const p = w.players[id];
      for (const cid in p.ss) { const comp = w.comps[cid]; if (comp?.kind !== 'league' || !p.ss[cid][S.G]) continue; const k = (LEAGUE_WEIGHT[cid] ?? 0.5) >= 0.9 ? 2 : (LEAGUE_WEIGHT[cid] ?? 0.5) >= 0.75 ? 1.5 : 1; shoe.push({ p, club: p.club ?? '', score: p.ss[cid][S.G] * k, rat: 0, line: p.ss[cid], pts: p.ss[cid][S.G] * k, g: p.ss[cid][S.G], lg: comp.sn }); }
    }
    shoe.sort((a, b) => b.pts - a.pts || a.line[S.SEC] - b.line[S.SEC]);
    withLine('European Golden Shoe', 'golden_shoe', shoe, (c) => { const x = c as (typeof shoe)[number]; return `${x.g} league goals (${x.lg}) = ${x.pts} points`; }, 'League goals multiplied by the league coefficient (×2 top five leagues, ×1.5 next tier, ×1 others).');
  }
  const xi = bestXI(g, [...cands.slice(0, 250), ...cands.filter((c) => c.p.pos === "GK").slice(0, 5)]);
  if (xi.xi.length === 11) { const a = giveAward(g, { id: `world_xi:world:${w.season}`, type: 'world_xi', title: 'World Eleven', comp: 'world', compName: 'World Football', period, xi: xi.xi, form: xi.form, why: `The best eleven in world football, arranged in a ${xi.form}.` }); if (a) ids.push(a.id); }
  const goals = (w.acc.goals.__season ?? []).sort((a, b) => b.spec - a.spec);
  if (goals.length) {
    const mk = (x: (typeof goals)[number]): AwardNom => ({ pid: x.pid, name: x.name, club: x.club, clubName: teamName(w, x.club), line: x.desc, score: x.spec });
    const a = giveAward(g, { id: `world_goal:world:${w.season}`, type: 'world_goal', title: 'World Goal of the Year', comp: 'world', compName: 'World Football', period, winner: mk(goals[0]), noms: goals.slice(0, 3).map(mk), why: 'Chosen from the Goal of the Month winners of every league.' }, true);
    if (a) ids.push(a.id);
  }
  w.acc.goals.__season = [];
  return ids;
}

/** Best player and top scorer of a cup / continental / international tournament. */
export function tournamentAwards(g: Game, comp: Competition): string[] {
  const w = g.world;
  const all = seasonLines(g, comp.id);
  const ids: string[] = [];
  const period = seasonLabel(w.season);
  const clubOf = (p: Player) => (comp.natTeams ? p.nat : p.club ?? '');
  const elig = all.filter((c) => c.line[S.RATN] >= 3).map((c) => ({ ...c, club: clubOf(c.p) })).sort((a, b) => b.score - a.score);
  if (elig.length) { const a = giveAward(g, { id: `tourn_best:${comp.id}:${w.season}`, type: 'tourn_best', title: `${comp.sn} Player of the Tournament`, comp: comp.id, compName: comp.name, period, winner: nom(g, elig[0]), noms: elig.slice(0, 3).map((c) => nom(g, c)), why: 'Best performance score among players with at least three rated appearances in the competition.' }, true); if (a) ids.push(a.id); }
  const sc = top(all.filter((c) => c.line[S.G] > 0).map((c) => ({ ...c, club: clubOf(c.p) })), S.G);
  if (sc.length) { const n = nom(g, sc[0]); n.line = `${sc[0].line[S.G]} goals`; const a = giveAward(g, { id: `tourn_boot:${comp.id}:${w.season}`, type: 'tourn_boot', title: `${comp.sn} Top Scorer`, comp: comp.id, compName: comp.name, period, winner: n, noms: sc.slice(0, 3).map((c) => { const x = nom(g, c); x.line = `${c.line[S.G]} goals`; return x; }), why: 'Most goals in the competition.' }); if (a) ids.push(a.id); }
  const xi = bestXI(g, elig);
  if (xi.xi.length === 11) { const a = giveAward(g, { id: `tourn_xi:${comp.id}:${w.season}`, type: 'tourn_xi', title: `${comp.sn} Team of the Tournament`, comp: comp.id, compName: comp.name, period, xi: xi.xi, form: xi.form, why: `Best eleven of the competition in a ${xi.form}.` }); if (a) ids.push(a.id); }
  const young = elig.filter((c) => w.season - c.p.born <= 21);
  if (young.length && !comp.u20) { const a = giveAward(g, { id: `tourn_young:${comp.id}:${w.season}`, type: 'tourn_young', title: `${comp.sn} Young Player of the Tournament`, comp: comp.id, compName: comp.name, period, winner: nom(g, young[0]), noms: young.slice(0, 3).map((c) => nom(g, c)), why: 'Best player aged 21 or under.' }); if (a) ids.push(a.id); }
  const gks = elig.filter((c) => c.p.pos === 'GK').sort((a, b) => b.line[S.CS] - a.line[S.CS] || b.score - a.score);
  if (gks.length) { const n = nom(g, gks[0]); n.line = `${gks[0].line[S.CS]} clean sheets, ${gks[0].line[S.SV]} saves`; const a = giveAward(g, { id: `tourn_glove:${comp.id}:${w.season}`, type: 'tourn_glove', title: `${comp.sn} Golden Glove`, comp: comp.id, compName: comp.name, period, winner: n, why: 'Most clean sheets in the competition.' }); if (a) ids.push(a.id); }
  return ids;
}

/** Keep the awards store bounded: weekly awards of past seasons are kept only if they involve the user. */
export function pruneAwards(g: Game): void {
  const w = g.world;
  const keep: string[] = [];
  for (const id of w.awardIds) {
    const a = w.awards[id];
    if (!a) continue;
    if (a.s < w.season && (a.type === 'potw' || a.type === 'totw' || a.type === 'gotm' || a.type === 'potm' || a.type === 'totm') && !a.me) { delete w.awards[id]; continue; }
    keep.push(id);
  }
  w.awardIds = keep;
  void NSTAT;
}
