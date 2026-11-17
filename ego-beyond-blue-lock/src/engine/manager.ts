/**
 * Manager mode: the user runs a club. The whole world (leagues, cups, Europe, awards, transfers between AI clubs)
 * keeps running exactly as in a playing career; this module adds the manager's side of it: team selection and
 * tactics, a transfer budget and wage budget, buying, selling, releasing and renewing, a board that sets an
 * objective and loses patience, sackings and job offers.
 */
import type { Club, Game, ManagerState, MgrMsg, Player, Pos, World } from './types';
import type { MatchState } from './match/model';
import { S } from './match/model';
import { ovr, fitAt } from './attributes';
import { marketValue, wageFor, makeManager, rngOf } from './worldgen';
import { doTransfer, release, levelOf } from './transfers';
import { addNews, fmtEur } from './util';
import { fmtDate, tableOf, WINDOWS, seasonLabel } from './competitions';
import { FORMATIONS } from './data/clubs';
import { SHEETS, pickSheet, teamInfo, available, applyResult } from './match/setup';
import { clamp } from './rng';

export const MGR_ID = 'user_manager';
export const isManager = (g: Game | null | undefined): boolean => !!g?.mgr;
export function mgrClub(g: Game): Club | null { return g.mgr && g.mgr.club ? g.world.clubs[g.mgr.club] ?? null : null; }

// ───────────────────────────── messages ─────────────────────────────
export function mgrMsg(g: Game, kind: MgrMsg['kind'], title: string, body: string): void {
  const m = g.mgr!; const w = g.world;
  m.msgs.unshift({ id: m.nextId++, abs: w.abs, date: fmtDate(w, w.day, true), title, body, kind });
  if (m.msgs.length > 120) m.msgs.length = 120;
  m.unread++;
}

// ───────────────────────────── squad strength & the board's objective ─────────────────────────────
/** Average OVR of a club's best fifteen: what the board and the bookmakers judge a squad by. */
export function squadLevel(w: World, c: Club): number {
  const o = c.squad.map((id) => w.players[id]).filter((p) => p && !p.retired).map((p) => ovr(p)).sort((a, b) => b - a).slice(0, 15);
  return o.length ? o.reduce((a, b) => a + b, 0) / o.length : 50;
}
/** Where the board expects you to finish: the club's rank by squad strength (and reputation) in its league. */
export function expectedFinish(w: World, c: Club): number {
  if (!c.league) return 1;
  const rival = Object.values(w.clubs).filter((x) => x.league === c.league && !x.dormant);
  const sc = (x: Club) => squadLevel(w, x) + x.rep * 0.08;
  const me = sc(c);
  return 1 + rival.filter((x) => x.id !== c.id && sc(x) > me).length;
}
function objText(pos: number, n: number, tier: number): string {
  if (pos <= 1) return tier === 1 ? 'Win the league' : 'Win the league and promotion';
  if (pos <= 4 && tier === 1) return `Finish in the top ${pos <= 2 ? 2 : 4} — Champions League football`;
  if (pos <= 7 && tier === 1) return 'Qualify for Europe';
  if (tier > 1 && pos <= 6) return 'Reach the promotion places';
  if (pos >= n - 3) return 'Avoid relegation';
  return `Finish in the top ${Math.min(n, pos + 1)}`;
}
export function setObjective(g: Game): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c) return;
  const n = Object.values(w.clubs).filter((x) => x.league === c.league && !x.dormant).length || 20;
  const pos = expectedFinish(w, c);
  m.obj = { pos, text: objText(pos, n, w.comps[c.league ?? '']?.tier ?? 1) };
}
export function wageBill(w: World, c: Club): number { return c.squad.reduce((x, id) => x + (w.players[id]?.con?.wage ?? 0), 0); }
function confAdd(g: Game, d: number): void {
  const m = g.mgr!;
  m.conf = clamp(Math.round((m.conf + d) * 10) / 10, 0, 100);
  m.confLog.push({ abs: g.world.abs, v: m.conf });
  if (m.confLog.length > 400) m.confLog.shift();
}

// ───────────────────────────── appointment, sacking, jobs ─────────────────────────────
/** Take charge of a club (start of a career, or a new job). */
export function appoint(g: Game, clubId: string): void {
  const m = g.mgr!, w = g.world;
  const c = w.clubs[clubId];
  if (!c) throw new Error('Unknown club ' + clubId);
  m.club = c.id; m.since = w.season; m.sacked = false; m.jobs = []; m.conf = 62; m.confLog = [{ abs: w.abs, v: 62 }];
  m.sheet = null; m.autoPick = true; m.listed = []; m.releaseAtEnd = [];
  m.offers = m.offers.filter((o) => o.status !== 'open');
  c.mgr = { id: MGR_ID, name: m.name, nat: m.nat, style: c.style, rep: Math.round(m.rep), since: w.season };
  m.budget = Math.round(Math.max(c.budget, 2e6) / 1e5) * 1e5;
  m.base = m.budget;
  m.wageBudget = Math.round(wageBill(w, c) * 1.2 / 100) * 100;
  setObjective(g);
  SHEETS.delete(c.id);
  mgrMsg(g, 'board', `Welcome to ${c.name}`, `The board expects you to: ${m.obj.text.toLowerCase()} (around ${ordinal(m.obj.pos)}). Transfer budget ${fmtEur(m.budget)}, wage budget ${fmtEur(m.wageBudget)} a week.`);
  addNews(g, 'manager', `${c.name} appoint ${m.name}`, `${m.name} takes charge of ${c.name}. The board's target: ${m.obj.text.toLowerCase()}.`, { imp: 3, clubs: [c.id], me: true });
}
function ordinal(n: number): string { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

/** Clubs willing to hire the user right now. */
function jobOffers(g: Game, exclude: string, n = 3): string[] {
  const m = g.mgr!, w = g.world, rng = rngOf(w);
  const pool = Object.values(w.clubs).filter((c) => c.league && !c.nel && !c.dormant && c.id !== exclude && c.rep <= m.rep + 6 && c.rep >= m.rep - 22);
  const picks = rng.shuffle(pool).sort((a, b) => Math.abs(a.rep - m.rep) - Math.abs(b.rep - m.rep)).slice(0, 8);
  return rng.shuffle(picks).slice(0, n).map((c) => c.id);
}
export function sack(g: Game, why: string): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c) return;
  const rng = rngOf(w);
  c.mgr = makeManager(w, rng, c.nat, c.rep, c.style); c.mgr.since = w.season;
  SHEETS.delete(c.id);
  addNews(g, 'manager', `${c.name} sack ${m.name}`, why, { imp: 3, clubs: [c.id], me: true });
  mgrMsg(g, 'board', 'You have been sacked', `${why} Clubs have been in touch: pick your next job in the Board & Career page.`);
  m.rep = Math.max(20, m.rep - 6);
  m.club = ''; m.sacked = true; m.sheet = null; m.listed = [];
  for (const o of m.offers) if (o.status === 'open') o.status = 'expired';
  m.jobs = jobOffers(g, c.id, 4);
  if (!m.jobs.length) m.jobs = Object.values(w.clubs).filter((x) => x.league && !x.nel && !x.dormant && x.id !== c.id).sort((a, b) => a.rep - b.rep).slice(0, 3).map((x) => x.id);
}
export function takeJob(g: Game, clubId: string): string {
  const m = g.mgr!;
  if (!m.jobs.includes(clubId)) return 'That job is not on offer.';
  const old = mgrClub(g);
  if (old && old.id !== clubId) { const rng = rngOf(g.world); old.mgr = makeManager(g.world, rng, old.nat, old.rep, old.style); old.mgr.since = g.world.season; SHEETS.delete(old.id); }
  appoint(g, clubId);
  return '';
}
export function resign(g: Game): void {
  const m = g.mgr!, c = mgrClub(g);
  if (!c) return;
  const rng = rngOf(g.world);
  c.mgr = makeManager(g.world, rng, c.nat, c.rep, c.style); c.mgr.since = g.world.season;
  SHEETS.delete(c.id);
  addNews(g, 'manager', `${m.name} resigns at ${c.name}`, `${m.name} has left ${c.name} by mutual consent.`, { imp: 2, clubs: [c.id], me: true });
  m.club = ''; m.sacked = true; m.sheet = null; m.listed = [];
  m.jobs = jobOffers(g, c.id, 3);
  if (!m.jobs.length) m.jobs = Object.values(g.world.clubs).filter((x) => x.league && !x.nel && !x.dormant && x.id !== c.id).sort((a, b) => a.rep - b.rep).slice(0, 3).map((x) => x.id);
}

// ───────────────────────────── team selection ─────────────────────────────
/** The best eleven and bench the assistant would pick. */
export function assistantSheet(g: Game): { form: string; xi: string[]; bench: string[] } {
  const c = mgrClub(g)!;
  const had = SHEETS.get(c.id); SHEETS.delete(c.id);
  const s = pickSheet(g, g.world, teamInfo(g.world, c.id), 0, 9);
  if (had) SHEETS.set(c.id, had);
  return { form: s.form, xi: s.xi.map((x) => x.pid), bench: s.bench };
}
/** Your saved sheet with anyone unavailable (injured, suspended, sold) replaced by the best fit. */
export function validSheet(g: Game): { form: string; xi: string[]; bench: string[] } {
  const m = g.mgr!, w = g.world, c = mgrClub(g)!;
  if (m.autoPick || !m.sheet || !FORMATIONS[m.sheet.form]) return assistantSheet(g);
  const sl = FORMATIONS[m.sheet.form];
  const ok = (id: string) => c.squad.includes(id) && available(w.players[id]);
  const used = new Set<string>();
  const xi: string[] = [];
  for (let k = 0; k < 11; k++) { const id = m.sheet.xi[k]; if (id && ok(id) && !used.has(id)) { xi.push(id); used.add(id); } else xi.push(''); }
  for (let k = 0; k < 11; k++) {
    if (xi[k]) continue;
    const pos = sl[k][0] as Pos;
    const cand = c.squad.filter((id) => ok(id) && !used.has(id)).map((id) => w.players[id]).filter((p) => (pos === 'GK') === (p.pos === 'GK'));
    const best = (cand.length ? cand : c.squad.filter((id) => ok(id) && !used.has(id)).map((id) => w.players[id])).sort((a, b) => fitAt(b, pos) - fitAt(a, pos))[0];
    if (best) { xi[k] = best.id; used.add(best.id); }
  }
  const bench = [...m.sheet.bench.filter((id) => ok(id) && !used.has(id))];
  for (const id of bench) used.add(id);
  const rest = c.squad.filter((id) => ok(id) && !used.has(id)).map((id) => w.players[id]).sort((a, b) => ovr(b) - ovr(a));
  if (!bench.some((id) => w.players[id].pos === 'GK')) { const gk = rest.find((p) => p.pos === 'GK'); if (gk) { bench.unshift(gk.id); used.add(gk.id); } }
  for (const p of rest) { if (bench.length >= 9) break; if (!used.has(p.id)) { bench.push(p.id); used.add(p.id); } }
  return { form: m.sheet.form, xi: xi.filter(Boolean).length === 11 ? xi : assistantSheet(g).xi, bench: bench.slice(0, 9) };
}
/** Before every match: the team sheet the engine will use for your club. */
export function applySheet(g: Game): void {
  const c = mgrClub(g);
  if (!c) return;
  const s = validSheet(g);
  if (s.xi.length === 11) SHEETS.set(c.id, s); else SHEETS.delete(c.id);
}

// ───────────────────────────── matches ─────────────────────────────
/** Which side the manager's club is in a match (or -1). */
export function mgrSide(g: Game, ms: MatchState): number { const id = g.mgr?.club; return ms.teams[0].id === id ? 0 : ms.teams[1].id === id ? 1 : -1; }
function xiLevel(ms: MatchState, t: number): number { const xs = ms.pl.filter((p) => p.t === t && p.started); return xs.length ? xs.reduce((a, p) => a + p.ovr, 0) / xs.length : 70; }
/** Record a finished match: world tables, the board's view of it, a little gate money. */
export function finishManagerMatch(g: Game, ms: MatchState): string[] {
  const w = g.world, m = g.mgr!;
  const fx = w.fixtures[ms.fid];
  g.live = null;
  if (!fx || fx.played || !ms.done) return [];
  applyResult(g, fx, ms);
  const t = mgrSide(g, ms);
  if (t < 0) return [];
  const comp = w.comps[fx.comp];
  const res: 'W' | 'D' | 'L' = ms.winner === t ? 'W' : ms.winner === -1 ? 'D' : 'L';
  // the board judges the result against what the two teams should produce
  const diff = xiLevel(ms, t) - xiLevel(ms, 1 - t) + (fx.neutral ? 0 : t === 0 ? 1.5 : -1.5);
  const expPts = clamp(1.35 + diff * 0.11, 0.25, 2.75);
  const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
  const weight = comp?.kind === 'league' ? 1 : comp?.kind === 'continental' ? 0.9 : comp?.kind === 'cup' ? 0.6 : 0.3;
  const before = m.conf;
  confAdd(g, (pts - expPts) * 1.25 * weight);
  if (fx.ko && res === 'L' && comp?.kind !== 'friendly') confAdd(g, -2 * weight);
  if (!fx.neutral && t === 0 && comp?.kind !== 'friendly') { const c = mgrClub(g)!; m.budget += Math.round((c.rep * c.rep * 12) / 1e4) * 1e4; }
  const potm = fx.potm && w.players[fx.potm] ? w.players[fx.potm].name : undefined;
  m.matches.push({ fid: fx.id, s: w.season, day: w.day, date: fmtDate(w, w.day, true), comp: fx.comp, compName: comp?.name ?? '', opp: ms.teams[1 - t].id, oppName: ms.teams[1 - t].name, home: t === 0, sc: [ms.score[t], ms.score[1 - t]], pens: ms.pens ? [ms.pens[t], ms.pens[1 - t]] : undefined, res, potm, conf: Math.round((m.conf - before) * 10) / 10 });
  if (m.matches.length > 400) m.matches.shift();
  checkBoard(g);
  return [];
}

/** After results: a board that has run out of patience acts. */
export function checkBoard(g: Game): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c || m.sacked) return;
  const played = m.matches.filter((x) => x.s === w.season && w.comps[x.comp]?.kind === 'league').length;
  if (m.since === w.season && played < 8) return; // a grace period for a new man
  if (m.conf <= 8) { sack(g, `The board has lost confidence in ${m.name} after a run of poor results.`); return; }
  if (m.conf <= 22 && c.league && played >= 10) {
    const tab = tableOf(w, c.league); const pos = tab.findIndex((r) => r.id === c.id) + 1;
    if (pos >= m.obj.pos + 6) sack(g, `${c.name} sit ${ordinal(pos)}, far below the target of ${ordinal(m.obj.pos)}.`);
  }
}

// ───────────────────────────── weekly business ─────────────────────────────
export function windowOpen(w: World): boolean {
  if (w.phase !== 'pro') return false;
  const d = w.day;
  return d < WINDOWS.summerEnd || (d >= WINDOWS.winterStart && d < WINDOWS.winterEnd) || d >= WINDOWS.summerStart;
}
/** What it takes to prise a player from his club. */
export function askingPrice(g: Game, p: Player): number {
  const w = g.world;
  const v = marketValue(p, w.season);
  const c = p.club ? w.clubs[p.club] : null;
  if (!c) return 0;
  const years = Math.max(0, (p.con?.until ?? w.season) - w.season);
  let k = 1.15 + years * 0.05 + (p.con?.role === 'star' ? 0.45 : p.con?.role === 'key' ? 0.22 : 0);
  if (c.squad.length <= 20) k += 0.25;
  if (p.origin === 'bluelock' || p.origin === 'master') k += 0.2;
  let f = v * k;
  if (p.con?.clause) f = Math.min(f, p.con.clause);
  return Math.round(f / 1e5) * 1e5;
}
export function wageDemand(g: Game, p: Player, c: Club): number { return Math.round(wageFor(ovr(p), c.rep) * (1 + p.rep / 300) / 100) * 100; }
/** Would he come? */
export function willing(g: Game, p: Player, c: Club): { ok: boolean; why: string } {
  const w = g.world;
  const from = p.club ? w.clubs[p.club] : null;
  const o = ovr(p);
  if (from && c.rep < from.rep - 14) return { ok: false, why: `${p.name} sees ${c.name} as a step down from ${from.name}.` };
  if (o >= levelOf(c) + 12 && c.rep < 80) return { ok: false, why: `${p.name} wants to play at a bigger club.` };
  if (w.season - p.born >= 34 && c.rep >= 85 && o < levelOf(c) - 6) return { ok: true, why: '' };
  return { ok: true, why: '' };
}
function nextSeasonStart(w: World): boolean { return w.day >= WINDOWS.summerStart; }
export function bid(g: Game, pid: string, fee: number, wage: number, years: number): { result: 'done' | 'counter' | 'rejected' | 'error'; text: string; ask?: number } {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const p = w.players[pid];
  if (!c || !p || p.retired) return { result: 'error', text: 'Unknown player.' };
  if (p.club === c.id) return { result: 'error', text: 'He already plays for you.' };
  const free = !p.club;
  if (!free && !windowOpen(w)) return { result: 'error', text: 'The transfer window is closed. Free agents can still be signed.' };
  if (p.club && w.clubs[p.club]?.nel) return { result: 'error', text: 'NEL players are not for sale.' };
  if (c.squad.length >= 32) return { result: 'error', text: 'Your squad is full (32). Sell or release someone first.' };
  if (fee > m.budget) return { result: 'error', text: `That is more than your transfer budget (${fmtEur(m.budget)}).` };
  const demand = wageDemand(g, p, c);
  if (wageBill(w, c) + wage > m.wageBudget) return { result: 'error', text: `His wages would take you over the wage budget (${fmtEur(m.wageBudget)} a week).` };
  const will = willing(g, p, c);
  if (!will.ok) return { result: 'rejected', text: will.why };
  if (wage < demand * 0.9) return { result: 'rejected', text: `${p.name} wants at least ${fmtEur(Math.round(demand * 0.9 / 100) * 100)} a week.`, ask: undefined };
  const ask = free ? 0 : askingPrice(g, p);
  if (!free && fee < ask * 0.97) {
    if (fee >= ask * 0.75) return { result: 'counter', text: `${w.clubs[p.club!].name} want ${fmtEur(ask)}.`, ask };
    return { result: 'rejected', text: `${w.clubs[p.club!].name} laughed that off. They value him at ${fmtEur(ask)}.`, ask };
  }
  const from = p.club ? w.clubs[p.club] : null;
  doTransfer(g, p, c, free ? 0 : fee, free ? 'free' : 'transfer', { wage, years: clamp(Math.round(years), 1, 5) });
  if (fee > 0) m.budget -= fee;
  m.deals.unshift({ s: w.season, date: fmtDate(w, w.day, true), pid: p.id, name: p.name, from: from?.name ?? 'Free agent', to: c.name, fee: free ? 0 : fee, dir: free ? 'free' : 'in' });
  addNews(g, 'transfer', `${c.name} sign ${p.name}`, `${p.name} (${ovr(p)} OVR, ${p.pos}) joins ${c.name}${from ? ` from ${from.name} for ${fmtEur(fee)}` : ' on a free transfer'}.`, { imp: 2, pids: [p.id], clubs: [c.id], me: true });
  void nextSeasonStart;
  return { result: 'done', text: `${p.name} has signed for ${c.name}!` };
}
export function toggleListed(g: Game, pid: string): void { const m = g.mgr!; m.listed = m.listed.includes(pid) ? m.listed.filter((x) => x !== pid) : [...m.listed, pid]; }
export function toggleReleaseAtEnd(g: Game, pid: string): void { const m = g.mgr!; m.releaseAtEnd = m.releaseAtEnd.includes(pid) ? m.releaseAtEnd.filter((x) => x !== pid) : [...m.releaseAtEnd, pid]; }
export function releaseCost(g: Game, p: Player): number { const left = Math.max(0, (p.con?.until ?? g.world.season) - g.world.season) + 0.5; return Math.round((p.con?.wage ?? 0) * 52 * left * 0.5 / 1e4) * 1e4; }
export function releaseNow(g: Game, pid: string): string {
  const m = g.mgr!, w = g.world, c = mgrClub(g); const p = w.players[pid];
  if (!c || !p || p.club !== c.id) return 'He is not your player.';
  if (c.squad.length <= 18) return 'You need at least 18 players.';
  const cost = releaseCost(g, p);
  if (cost > m.budget) return `Paying up his contract costs ${fmtEur(cost)}, more than your budget.`;
  m.budget -= cost;
  release(g, p);
  m.listed = m.listed.filter((x) => x !== pid);
  m.deals.unshift({ s: w.season, date: fmtDate(w, w.day, true), pid, name: p.name, from: c.name, to: 'Released', fee: -cost, dir: 'release' });
  return '';
}
export function renewDemand(g: Game, p: Player): number { const c = mgrClub(g)!; return Math.round(Math.max(p.con?.wage ?? 0, wageDemand(g, p, c)) * 1.05 / 100) * 100; }
export function renew(g: Game, pid: string, years: number): string {
  const m = g.mgr!, w = g.world, c = mgrClub(g); const p = w.players[pid];
  if (!c || !p || p.club !== c.id || !p.con) return 'He is not your player.';
  if (p.con.loanFrom) return 'He is only here on loan.';
  const wage = renewDemand(g, p);
  if (wageBill(w, c) - p.con.wage + wage > m.wageBudget) return `His new wage (${fmtEur(wage)}/wk) would break the wage budget.`;
  if (w.season - p.born >= 30 && p.pers.amb >= 75 && ovr(p) < levelOf(c) - 4) return `${p.name} wants regular football elsewhere and will not sign.`;
  p.con.wage = wage; p.con.until = Math.max(p.con.until, w.season) + clamp(Math.round(years), 1, 5);
  m.releaseAtEnd = m.releaseAtEnd.filter((x) => x !== pid);
  return '';
}
export function acceptOfferFor(g: Game, id: number): string {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const o = m.offers.find((x) => x.id === id);
  if (!c || !o || o.status !== 'open') return 'That offer is no longer open.';
  const p = w.players[o.pid], to = w.clubs[o.from];
  if (!p || p.club !== c.id || !to) { o.status = 'expired'; return 'That offer is no longer valid.'; }
  if (!windowOpen(w)) { o.status = 'expired'; return 'The window has closed.'; }
  if (c.squad.length <= 18) return 'You need at least 18 players.';
  doTransfer(g, p, to, o.fee, 'transfer');
  m.budget += Math.round(o.fee * 0.9 / 1e5) * 1e5;
  o.status = 'accepted';
  m.listed = m.listed.filter((x) => x !== p.id);
  for (const x of m.offers) if (x.pid === p.id && x.status === 'open') x.status = 'expired';
  m.deals.unshift({ s: w.season, date: fmtDate(w, w.day, true), pid: p.id, name: p.name, from: c.name, to: to.name, fee: o.fee, dir: 'out' });
  addNews(g, 'transfer', `${p.name} leaves ${c.name} for ${to.name}`, `${c.name} accept ${fmtEur(o.fee)} for ${p.name}.`, { imp: 2, pids: [p.id], clubs: [c.id, to.id], me: true });
  return '';
}
export function rejectOfferFor(g: Game, id: number): void { const o = g.mgr!.offers.find((x) => x.id === id); if (o && o.status === 'open') o.status = 'rejected'; }

/** Every morning in manager mode: offers expire, AI clubs bid for listed players (and now and then your stars). */
export function managerMorning(g: Game): void {
  const m = g.mgr!, w = g.world;
  if (!m.club) return;
  const c = mgrClub(g);
  if (!c) return;
  for (const o of m.offers) if (o.status === 'open' && w.abs - o.abs > 7) o.status = 'expired';
  if (w.phase !== 'pro' || !windowOpen(w) || w.day % 7 !== 2) return;
  const rng = rngOf(w);
  const clubs = Object.values(w.clubs).filter((x) => x.league && !x.nel && !x.dormant && x.id !== c.id);
  const want = (p: Player, chance: number, prem: number, unsolicited: boolean) => {
    if (m.offers.some((o) => o.pid === p.id && o.status === 'open') || rng.next() > chance) return;
    const o = ovr(p);
    const buyers = clubs.filter((x) => Math.abs(levelOf(x) - o) <= 6 && x.budget >= marketValue(p, w.season) * 0.7 && x.squad.length < 30);
    if (!buyers.length) return;
    const b = rng.pick(buyers);
    const fee = Math.round(marketValue(p, w.season) * prem * (0.9 + rng.next() * 0.3) / 1e5) * 1e5;
    m.offers.push({ id: m.nextId++, pid: p.id, from: b.id, fee, day: w.day, abs: w.abs, status: 'open', unsolicited });
    mgrMsg(g, 'transfer', `${b.name} bid ${fmtEur(fee)} for ${p.name}`, unsolicited ? `${p.name} was not for sale, but ${b.name} have made an offer. It stays open for a week.` : `An offer for your transfer-listed ${p.pos}. It stays open for a week.`);
  };
  for (const pid of m.listed) { const p = w.players[pid]; if (p && p.club === c.id) want(p, 0.55, 0.95, false); }
  for (const pid of c.squad) { const p = w.players[pid]; if (p && !m.listed.includes(pid) && ovr(p) >= levelOf(c) + 3) want(p, 0.04, 1.4, true); }
}

// ───────────────────────────── the season ─────────────────────────────
/** End of the season: the board's review, prize money, the new budget. */
export function managerSeasonEnd(g: Game): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c || !c.league) return;
  const tab = tableOf(w, c.league); const pos = tab.findIndex((r) => r.id === c.id) + 1; const row = tab[pos - 1];
  const trophies = c.trophies.filter((t) => t.s === w.season).map((t) => t.name);
  for (const t of trophies) m.trophies.push({ s: w.season, name: t, club: c.name });
  const delta = (m.obj.pos - pos) * 4 + trophies.length * 7 - (m.conf > 80 ? (m.conf - 80) * 0.5 : 0);
  confAdd(g, delta);
  m.rep = clamp(m.rep + (m.obj.pos - pos) * 1.3 + trophies.length * 3 + (pos === 1 ? 3 : 0), 10, 99);
  c.mgr.rep = Math.round(m.rep);
  m.hist.push({ s: w.season, club: c.id, clubName: c.name, league: w.comps[c.league]?.name ?? '', pos, n: tab.length, obj: m.obj.pos, trophies, conf: Math.round(m.conf), w: row?.w ?? 0, d: row?.d ?? 0, l: row?.l ?? 0 });
  const prize = Math.round(((tab.length - pos + 1) * 0.8e6 * ((w.comps[c.league]?.tier ?? 1) === 1 ? 1 : 0.3) + trophies.length * 8e6) / 1e5) * 1e5;
  m.budget += prize;
  const verdict = pos <= m.obj.pos - 2 ? 'The board is delighted' : pos <= m.obj.pos ? 'The board is satisfied' : pos <= m.obj.pos + 3 ? 'The board is disappointed' : 'The board is furious';
  mgrMsg(g, 'season', `${seasonLabel(w.season)} review: ${ordinal(pos)}`, `${verdict}. Target ${ordinal(m.obj.pos)}, finished ${ordinal(pos)}${trophies.length ? `, won ${trophies.join(', ')}` : ''}. Prize money ${fmtEur(prize)}. Board confidence ${Math.round(m.conf)}%.`);
  if (m.conf < 25 || pos >= m.obj.pos + 7) { sack(g, `${c.name} finished ${ordinal(pos)} against a target of ${ordinal(m.obj.pos)}.`); return; }
  // a good season brings interest from bigger clubs
  if (pos <= m.obj.pos - 2 || trophies.length) { const offers = jobOffers(g, c.id, 2).filter((id) => w.clubs[id].rep > c.rep); if (offers.length) { m.jobs = offers; mgrMsg(g, 'job', 'Other clubs want you', `${offers.map((id) => w.clubs[id].name).join(' and ')} would like to talk. See Board & Career — you can stay, too.`); } }
}
/** New season: fresh objective and budget, expiring contracts handled as you decided. */
export function managerNewSeason(g: Game): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c) return;
  // half of what is left over carries into the new season, on top of the club's normal allocation (more when the board is happy)
  const base = m.base ?? Math.max(c.budget, 2e6);
  m.budget = Math.round(Math.max(m.budget * 0.5 + base * (0.75 + m.conf / 400), 2e6) / 1e5) * 1e5;
  m.wageBudget = Math.round(Math.max(m.wageBudget, wageBill(w, c) * 1.08) / 100) * 100;
  m.conf = clamp(m.conf * 0.6 + 62 * 0.4, 0, 100);
  setObjective(g);
  mgrMsg(g, 'board', `${seasonLabel(w.season)}: the board's target`, `${m.obj.text} (around ${ordinal(m.obj.pos)}). Transfer budget ${fmtEur(m.budget)}, wage budget ${fmtEur(m.wageBudget)} a week.`);
}
/** Season end, contracts: yours are renewed automatically unless you marked them to leave. */
export function managerContracts(g: Game): void {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  if (!c) return;
  for (const id of [...c.squad]) {
    const p = w.players[id];
    if (!p?.con || p.con.loanFrom || p.con.until > w.season) continue;
    if (m.releaseAtEnd.includes(id) || (w.season - p.born >= 36)) { release(g, p, w.season - p.born >= 36); m.deals.unshift({ s: w.season, date: fmtDate(w, w.day, true), pid: id, name: p.name, from: c.name, to: 'Contract expired', fee: 0, dir: 'release' }); continue; }
    p.con.until = w.season + 1 + (w.season - p.born <= 27 ? 2 : 1);
    p.con.wage = Math.max(p.con.wage, wageFor(ovr(p), c.rep));
  }
  m.releaseAtEnd = [];
}

/** Players' season lines for the squad screen. */
export function seasonLine(p: Player): number[] { const t = new Array(40).fill(0); for (const k in p.ss) { const l = p.ss[k]; for (let i = 0; i < l.length && i < t.length; i++) t[i] += l[i]; } return t; }
export { S };
