/**
 * The day loop. Each day moves through three stages (morning → user match → evening) that are
 * recorded in the save, so repeating an advance call can never process a day, a fixture,
 * a wage payment, an award or a transfer twice.
 */
import type { Fixture, Game, UserMatch } from './types';
import { ovr } from './attributes';
import { clamp } from './rng';
import { compFixtures, progressComps, weekOf, SEASON_END_DAY, SUMMER_TOURNAMENT_DAY, SEASON_DAYS, monthOf, fmtDate, tableOf, dayOf, seasonLabel } from './competitions';
import { S, type MatchState } from './match/model';
import { createMatch, applyResult, simFixture, teamName, INJURY_RATE, REALISM } from './match/setup';
import { advance as advanceMatch, setInjuryRate, setAbilityScale } from './match/engine';
import { clockLabel } from './match/rules';
import { afterNelRound, concludeNel, canonWinner, NEL_END_DAY, PROLOGUE_END_DAY } from './nel';
import { onCompFinished, endSeason, rollover, startPro } from './season';
import { weeklyAwards, monthlyAwards } from './awards';
import { weeklyPress } from './press';
import { afterMatchRivalry } from './rivalry';
import { aiTransferDay, generateUserOffers, renewalCheck, expireOffers, ensureUserHasOptions, openOffers, acceptOffer, managerChanges, buildOffer } from './transfers';
import { runTraining, dailyRecovery, worldDevTick, userAgeing, payWages, applyMatchDevelopment } from './development';
import { applyMatchRelations } from './relationships';
import { spawnWeekly, spawnPreMatch, spawnPostMatch, expireInteractions } from './interactions';
import { setupSummerTournament, breakFriendly } from './international';
import { addNews, milestone, log, ordinal } from './util';
import { registerCustom } from './abilities';

/** The user's team id in a fixture (club, or nation when called up), or null. */
export function userSide(g: Game, fx: Fixture): string | null {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (!me || me.retired) return null;
  const comp = w.comps[fx.comp];
  if (comp?.natTeams) {
    for (const t of [fx.h, fx.a]) { const sq = comp.u20 ? w.nations[t]?.u20squad : w.nations[t]?.squad; if (sq?.includes(me.id)) return t; }
    return null;
  }
  return me.club && (fx.h === me.club || fx.a === me.club) ? me.club : null;
}
export function userFixtureToday(g: Game): Fixture | null {
  const w = g.world;
  for (const id of w.sched[w.day] ?? []) { const f = w.fixtures[id]; if (f && !f.played && f.s === w.season && userSide(g, f)) return f; }
  return null;
}
export function nextUserFixture(g: Game): Fixture | null {
  const w = g.world;
  let best: Fixture | null = null;
  for (const id in w.fixtures) { const f = w.fixtures[id]; if (f.played || f.s !== w.season || f.day < w.day) continue; if (!userSide(g, f)) continue; if (!best || f.day < best.day) best = f; }
  return best;
}

function worldNewsFor(g: Game, fx: Fixture, ms: MatchState): void {
  const w = g.world;
  const comp = w.comps[fx.comp];
  if (!comp || comp.kind === 'friendly') return;
  for (const p of ms.pl) {
    if (!p.used) continue;
    const pl = w.players[p.id];
    if (!pl) continue;
    if (p.s[S.G] >= 3 && (comp.tier ?? 1) <= 1) addNews(g, 'match', `${pl.name} scores ${p.s[S.G] >= 4 ? p.s[S.G] + ' goals' : 'a hat-trick'}`, `${ms.teams[0].name} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].name} (${comp.name}).`, { imp: 1, pids: [pl.id] });
    else if (p.s[S.RAT] >= 9.3 && w.season - pl.born <= 20 && pl.origin !== 'bluelock' && comp.kind !== 'nel') { pl.notable = true; addNews(g, 'match', `Breakout: ${pl.name} (${w.season - pl.born}) rated ${p.s[S.RAT].toFixed(1)}`, `The ${pl.pos} lit up ${ms.teams[p.t].name}'s ${ms.score[p.t]}–${ms.score[1 - p.t]} ${ms.winner === p.t ? 'win' : 'match'} against ${ms.teams[1 - p.t].name}.`, { imp: 1, pids: [pl.id] }); }
  }
  const a = w.clubs[fx.h], b = w.clubs[fx.a];
  if (a && b && ms.winner >= 0 && (comp.kind === 'cup' || (comp.tier ?? 9) === 1)) {
    const win = ms.winner === 0 ? a : b, lose = ms.winner === 0 ? b : a;
    if (lose.rep - win.rep >= 17) addNews(g, 'match', `Upset: ${win.name} beat ${lose.name}`, `${a.sn} ${ms.score[0]}–${ms.score[1]} ${b.sn} in the ${comp.name}.`, { imp: 1, clubs: [win.id, lose.id] });
  }
}

function morning(g: Game): void {
  const w = g.world;
  registerCustom(g.career.custom);
  setInjuryRate(INJURY_RATE[g.settings.injuries] ?? 1);
  setAbilityScale(REALISM[g.settings.realism]?.scale ?? 0.5);
  const uf = userFixtureToday(g);
  expireInteractions(g); expireOffers(g);
  dailyRecovery(g);
  runTraining(g, !!uf);
  const dow = w.day % 7;
  if (dow === 0) {
    payWages(g);
    spawnWeekly(g);
    if (w.phase === 'pro') { generateUserOffers(g); renewalCheck(g); }
    ensureUserHasOptions(g);
  }
  if (w.phase === 'pro') {
    for (const e of w.events) {
      if (e.day !== w.day) continue;
      if (e.key === 'market') aiTransferDay(g, w.day < 60 ? 1.6 : 1);
      else if (e.key === 'intlbreak') breakFriendly(g);
      else if (e.key === 'midseason') midSeason(g);
    }
    if (w.day % 28 === 14) { worldDevTick(g); userAgeing(g); }
    if (w.day === SEASON_END_DAY) endSeason(g);
    if (w.day === SUMMER_TOURNAMENT_DAY - 1) setupSummerTournament(g);
    if (w.day > SEASON_END_DAY && w.day % 7 === 3) aiTransferDay(g, 1.5);
  } else {
    if (w.day === 21) worldDevTick(g);
    if (w.day === NEL_END_DAY) concludeNel(g);
  }
  if (uf) spawnPreMatch(g, uf);
  // every other fixture of the day is simulated with the same engine
  for (const id of [...(w.sched[w.day] ?? [])]) {
    const f = w.fixtures[id];
    if (!f || f.played || f === uf) continue;
    const ms = simFixture(g, f, f.comp === 'nel' ? canonWinner(g, f) : undefined);
    if (ms) worldNewsFor(g, f, ms);
  }
}

function midSeason(g: Game): void {
  const w = g.world;
  const pos: Record<string, { pos: number; n: number; relegated: boolean }> = {};
  for (const id in w.comps) {
    const c = w.comps[id];
    if (c.kind !== 'league') continue;
    const tab = tableOf(w, id);
    tab.forEach((r, i) => { pos[r.id] = { pos: i + 1, n: tab.length, relegated: false }; });
    if (c.tier === 1) for (let i = 0; i < 2; i++) { const cl = w.clubs[tab[i]?.id]; if (cl && cl.expect >= 7) addNews(g, 'club', `${cl.name}: an unexpected title challenge`, `Expected to finish around ${ordinal(cl.expect)}, they sit ${ordinal(i + 1)} in the ${c.name} at the halfway point with ${tab[i].pts} points.`, { imp: 2, clubs: [cl.id] }); }
  }
  managerChanges(g, pos, true);
}

function evening(g: Game): void {
  const w = g.world;
  for (const c of progressComps(g)) onCompFinished(g, c);
  // a cup round can complete a later stage on the same evening
  for (const c of progressComps(g)) onCompFinished(g, c);
  if (w.phase === 'nel') {
    const fs = compFixtures(w, 'nel');
    for (let rd = w.nel.round + 1; rd <= 5; rd++) { const r = fs.filter((f) => f.rd === rd); if (r.length && r.every((f) => f.played)) afterNelRound(g, rd); else break; }
  } else {
    if (w.day % 7 === 6) { weeklyAwards(g, weekOf(w.day)); weeklyPress(g, weekOf(w.day)); }
    if (w.day < SEASON_END_DAY && monthOf(w, w.day) !== monthOf(w, w.day + 1)) monthlyAwards(g, monthOf(w, w.day));
  }
}

export interface Stop { kind: 'match' | 'club' | 'summary' | 'live' | 'retired' | 'none'; label: string; detail: string }
export function needsClub(g: Game): boolean {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (me.retired) return false;
  if (w.phase === 'nel') return w.day >= PROLOGUE_END_DAY - 1 && w.stage === 2 && (!me.club || !!w.clubs[me.club]?.nel);
  // a free agent cannot drift through a season: the game stops until he signs somewhere
  if (!me.club) return true;
  return !!g.career.flags.mustMove && !!me.club && !!w.clubs[me.club]?.dormant;
}
/** What the career hub should present as the next meaningful action. */
export function nextStop(g: Game): Stop {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (me.retired) return { kind: 'retired', label: 'Career over', detail: 'You have retired. Your history remains browsable.' };
  if (g.live) return { kind: 'live', label: 'Resume match', detail: 'An interactive match is in progress.' };
  if (w.nel.summary && !g.career.flags.nelSummarySeen) return { kind: 'summary', label: 'View the NEL conclusion', detail: 'Final table, rankings, awards, your evaluation and career routes.' };
  if (needsClub(g)) return { kind: 'club', label: me.club ? 'Choose your club' : 'Sign for a club', detail: me.club ? 'You must accept a contract before the season can continue.' : 'Your contract has ended. Pick one of the offers before the season can continue.' };
  const uf = w.stage <= 1 ? userFixtureToday(g) : null;
  if (uf) { const side = userSide(g, uf)!; const opp = uf.h === side ? uf.a : uf.h; return { kind: 'match', label: `Play: ${teamName(w, side)} v ${teamName(w, opp)}`, detail: `${w.comps[uf.comp]?.name ?? ''}${uf.stg ? ' · ' + uf.stg : ` · Round ${uf.rd}`}` }; }
  const nf = nextUserFixture(g);
  return { kind: 'none', label: 'Continue', detail: nf ? `Next match: ${fmtDate(w, nf.day, true)} — ${teamName(w, nf.h)} v ${teamName(w, nf.a)}` : 'No fixtures scheduled for you yet.' };
}

/** Process one stage of the current day. Returns a stop reason, or null if time moved on. */
export function step(g: Game): Stop['kind'] | null {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (g.live) return 'live';
  if (w.stage === 0) { morning(g); w.stage = 1; }
  if (w.stage === 1) {
    if (userFixtureToday(g)) return 'match';
    evening(g);
    w.stage = 2;
  }
  if (w.nel.summary && !g.career.flags.nelSummarySeen) return 'summary';
  if (needsClub(g)) { ensureUserHasOptions(g); return 'club'; }
  // move to the next day
  if (w.phase === 'nel' && w.day >= PROLOGUE_END_DAY) { startPro(g); w.abs++; return null; }
  if (w.phase === 'pro' && w.day >= SEASON_DAYS - 1) { rollover(g); w.abs++; return null; }
  w.day++; w.abs++; w.stage = 0;
  void me;
  return null;
}

export interface AdvanceReport { days: number; stop: Stop['kind'] | 'event' | null; digest: string[] }
/** Advance until something needs the player (a match, a decision, important news) or `maxDays` pass. */
export function advance(g: Game, maxDays = 7): AdvanceReport {
  const w = g.world;
  const c = g.career;
  c.digest = [];
  const news0 = w.newsId;
  const off0 = c.nextOffer, int0 = c.nextInteraction;
  let days = 0;
  let stop: AdvanceReport['stop'] = null;
  const phase0 = w.phase, season0 = w.season;
  for (let guard = 0; guard < maxDays * 3 + 3; guard++) {
    const d0 = w.abs;
    const r = step(g);
    if (r) { stop = r; break; }
    if (w.abs !== d0) days++;
    if (w.phase !== phase0 || w.season !== season0) { stop = 'event'; break; }
    if (c.nextOffer !== off0 || c.inbox.some((x) => x.id >= int0 && !x.done && x.blocking)) { stop = 'event'; break; }
    if (c.flags.awardPop) { stop = 'event'; break; }
    if (days >= maxDays) break;
  }
  for (const n of w.news) if (n.id >= news0 && n.me && n.imp >= 2) c.digest.push(n.title);
  if (c.nextInteraction !== int0) c.digest.push(`${c.inbox.filter((x) => x.id >= int0 && !x.done).length} new interaction(s) waiting`);
  return { days, stop, digest: c.digest };
}

// ───────────────────────────── the user's match ─────────────────────────────

export function startUserMatch(g: Game, mode: 'full' | 'key' | 'sim'): MatchState | null {
  const fx = userFixtureToday(g);
  if (!fx) return null;
  if (g.world.stage === 0) step(g);
  setInjuryRate(INJURY_RATE[g.settings.injuries] ?? 1);
  setAbilityScale(REALISM[g.settings.realism]?.scale ?? 0.5);
  registerCustom(g.career.custom);
  const ms = createMatch(g, fx, mode);
  const sel = (ms as MatchState & { sel?: Game['career']['lastSel'] }).sel;
  if (sel) g.career.lastSel = { ...sel, fid: fx.id } as Game['career']['lastSel'];
  g.live = ms;
  return ms;
}

/** Apply a finished user match to the world and the career. Safe to call twice. */
export function finishUserMatch(g: Game, ms: MatchState): string[] {
  const w = g.world;
  const c = g.career;
  const fx = w.fixtures[ms.fid];
  g.live = null;
  if (!fx || fx.played || !ms.done) return [];
  applyResult(g, fx, ms);
  const comp = w.comps[fx.comp];
  const me = w.players[c.pid];
  const u = ms.uc;
  const notes: string[] = [];
  const side = u ? ms.pl[u.idx].t : 0;
  const mp = u ? ms.pl[u.idx] : null;
  const myTeam = ms.teams[side], opp = ms.teams[1 - side];
  const res = ms.winner === side ? 'W' : ms.winner === -1 ? 'D' : 'L';
  const played = !!mp?.used;
  if (u && u.asked > 1) c.mgrTrust = clamp(c.mgrTrust - (u.asked - 1) * 1.5, 0, 100);
  if (u && mp) {
    notes.push(...applyMatchRelations(g, fx, ms));
    notes.push(...afterMatchRivalry(g, ms));
    notes.push(...applyMatchDevelopment(g, ms));
  }
  const line = played ? mp!.s.slice() : null;
  const feed = ms.ev.filter((e) => e.i >= 2 && e.x).slice(-40).map((e) => `${clockLabel(ms.rules.kind, e.c, e.h ?? 1)} ${e.x}`);
  const um: UserMatch = {
    fid: fx.id, s: w.season, day: w.day, date: fmtDate(w, w.day, true), comp: fx.comp, compName: comp?.name ?? '', rules: ms.rules.kind, club: myTeam.id, opp: opp.id, oppName: opp.name, home: side === 0,
    sc: [ms.score[side], ms.score[1 - side]], pens: ms.pens ? [ms.pens[side], ms.pens[1 - side]] : undefined, res, line, rat: played && line![S.RATN] ? line![S.RAT] : 0, potm: !!line?.[S.POTM], started: !!mp?.started, feed,
  };
  c.matches.push(um);
  if (c.matches.length > 700) c.matches.splice(0, 100);
  if (played && line) {
    if (me.con) c.wages += (me.con.appBonus ?? 0) + (me.con.goalBonus ?? 0) * line[S.G];
    const pro = comp?.rules !== 'nel';
    const firsts: [string, boolean, string][] = [
      ['debut:' + (pro ? (comp?.natTeams ? 'intl' : 'pro') : 'nel'), true, `${pro ? (comp?.natTeams ? 'International' : 'Professional') : 'NEL'} debut: ${myTeam.name} ${ms.score[side]}–${ms.score[1 - side]} ${opp.name}.`],
      ['goal:' + (pro ? (comp?.natTeams ? 'intl' : 'pro') : 'nel'), line[S.G] > 0, `First ${pro ? (comp?.natTeams ? 'international' : 'professional') : 'NEL'} goal, against ${opp.name}.`],
    ];
    for (const [k, cond, txt] of firsts) if (cond && !c.flags[k]) { c.flags[k] = 1; milestone(g, 'first', txt); }
    if (line[S.G] >= 3) milestone(g, 'feat', `${line[S.G] >= 4 ? line[S.G] + ' goals' : 'Hat-trick'} against ${opp.name} (${comp?.name}).`);
    if (line[S.POTM]) me.rep = clamp(me.rep + 0.6 + ms.imp, 0, 99);
    addNews(g, 'match', `${myTeam.name} ${ms.score[side]}–${ms.score[1 - side]} ${opp.name}${ms.pens ? ` (${ms.pens[side]}–${ms.pens[1 - side]} pens)` : ''}`, `${comp?.name}. You: ${line[S.RATN] ? `rated ${line[S.RAT].toFixed(1)}` : 'unrated cameo'}${line[S.G] ? `, ${line[S.G]} goal${line[S.G] > 1 ? 's' : ''}` : ''}${line[S.A] ? `, ${line[S.A]} assist${line[S.A] > 1 ? 's' : ''}` : ''}${line[S.POTM] ? ' — Player of the Match' : ''}.`, { imp: line[S.POTM] || line[S.G] >= 2 ? 2 : 1, me: true });
  } else {
    addNews(g, 'match', `${myTeam.name} ${ms.score[side]}–${ms.score[1 - side]} ${opp.name}`, `${comp?.name}. You were an unused substitute${c.lastSel?.inSquad === false ? ' — in fact you were left out of the squad entirely' : ''}.`, { imp: 1, me: true });
    c.mgrTrust = clamp(c.mgrTrust + 0.3, 0, 100);
  }
  worldNewsFor(g, fx, ms);
  spawnPostMatch(g, fx, ms);
  log(w, 'match', `${myTeam.abbr} ${ms.score[side]}-${ms.score[1 - side]} ${opp.abbr}`);
  void ovr; void dayOf; void seasonLabel;
  return notes;
}

/** Quick-simulate the user's match with the same engine (the AI plays the user's role). */
export function simUserMatch(g: Game): string[] {
  const ms = startUserMatch(g, 'sim');
  if (!ms) return [];
  advanceMatch(ms);
  return finishUserMatch(g, ms);
}

/**
 * Auto-pilot used by tests and by "simulate ahead": plays every user match in quick-sim and
 * accepts the best available contract when one is required.
 */
export function autoPilot(g: Game, until: (g: Game) => boolean, maxDays = 5000): number {
  let days = 0;
  for (let guard = 0; guard < maxDays * 4 && !until(g); guard++) {
    const d0 = g.world.abs;
    const r = step(g);
    if (g.world.abs !== d0) days++;
    if (until(g)) break;
    if (r === 'match') simUserMatch(g);
    else if (r === 'summary') g.career.flags.nelSummarySeen = 1;
    else if (r === 'club') {
      const offs = openOffers(g).sort((a, b) => b.devScore + b.wage / 20000 - (a.devScore + a.wage / 20000));
      if (offs.length) acceptOffer(g, offs[0].id); else ensureUserHasOptions(g);
      if (!openOffers(g).length && g.world.players[g.career.pid].club && !g.world.clubs[g.world.players[g.career.pid].club!]?.nel) g.career.flags.mustMove = 0;
      const me = g.world.players[g.career.pid];
      if (me.club && !g.world.clubs[me.club]?.dormant) g.career.flags.mustMove = 0;
    } else if (r === 'live') { const ms = g.live as MatchState; advanceMatch(ms); if (ms.pending) { ms.uc!.mode = 'sim'; advanceMatch(ms, ms.pending.options[0].id); } finishUserMatch(g, ms); }
    // a free agent takes the first acceptable offer
    const me = g.world.players[g.career.pid];
    if (!me.club && !me.retired && g.world.phase === 'pro') { const offs = openOffers(g); if (offs.length) acceptOffer(g, offs[0].id); }
    if (days >= maxDays) break;
  }
  return days;
}

/**
 * Skip the Neo Egoist League: the league is still simulated in full for the rest of the world
 * (results, bids, selections, signings), then the user joins the chosen professional club.
 */
export function skipNel(g: Game, clubId: string): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  for (let guard = 0; guard < 900 && w.phase === 'nel'; guard++) {
    const r = step(g);
    if (r === 'summary') g.career.flags.nelSummarySeen = 1;
    else if (r === 'match' || r === 'live') simUserMatch(g); // e.g. a youth international he was still picked for
    else if (r === 'club') {
      const o = ovr(me);
      const pool = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.league);
      const club = w.clubs[clubId] && !w.clubs[clubId].nel ? w.clubs[clubId] : pool.sort((a, b) => Math.abs(38 + a.rep * 0.5 - o) - Math.abs(38 + b.rep * 0.5 - o))[0];
      for (const of of g.career.offers) if (of.status === 'open') of.status = 'expired';
      const of = buildOffer(g, club, 'nel', 60, { route: 'Direct to professional football', deadline: w.abs + 5 });
      g.career.offers.push(of);
      acceptOffer(g, of.id);
    }
  }
  g.career.flags.nelSummarySeen = 1;
  g.career.digest = [];
}
