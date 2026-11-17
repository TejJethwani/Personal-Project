/**
 * Season lifecycle for professional football: building the competitions, wrapping up a
 * season (history, trophies, records, awards, promotion and relegation) and rolling over.
 */
import type { Club, Competition, Game, Player, World } from './types';
import { ovr } from './attributes';
import { clamp } from './rng';
import { rngOf, clubStrength, activatePoolClub, finalizeSquad } from './worldgen';
import { LEAGUES, POOLS } from './data/clubs';
import { mkComp, scheduleLeague, startCup, scheduleLeaguePhase, scheduleKo, tableOf, LEAGUE_SLOTS, CUP_DAYS, CUP_FINAL_DAY, CONT_GROUP_DAYS, CONT_KO_DAYS, CONT_FINAL_DAY, PLAYOFF_DAYS, compFixtures, seasonLabel, invalidateFixtures, dayOf } from './competitions';
import { S } from './match/model';
import { winnerId } from './match/setup';
import { addNews, milestone, ordinal, log } from './util';
import { compSeasonAwards, worldAwards, tournamentAwards, pruneAwards, seasonLines } from './awards';
import { rememberSeasonClubs, bdoSnapshot } from './ballondor';
import { uclSlots, uelSlots, updateCoefficients, coefRanking } from './coefficients';
import { archiveSheets, setupTotsCup, totsCupFinish } from './teamsheets';
import { archiveStats, contractYearEnd, managerChanges, ensureSquads, aiLoans, buildOffer, levelOf } from './transfers';
import { yearlyDevelopment, pruneRetired } from './development';
import { scheduleBreakFriendlies, finishTournament } from './international';
import { relOf } from './relationships';

/** 36-club Champions League and 24-club Europa League, both with a single-table league phase. */
const CONT_SIZE: Record<string, number> = { ucl: 36, uel: 24 };
export const SUPPORTED = 'England (Premier League, Championship, League One — connected by promotion and relegation), Spain (La Liga), Germany (Bundesliga), Italy (Serie A), France (Ligue 1), the Netherlands (Eredivisie) and Portugal (Primeira Liga), each with a domestic cup; the Champions League (36 clubs) and Europa League (24 clubs) with a league phase, knockout play-off and two-legged knockouts; World Cups, continental championships and U-20 tournaments.';

function leagueClubs(w: World, id: string): Club[] { return Object.values(w.clubs).filter((c) => c.league === id && !c.dormant); }

/** Build every competition and fixture for the current season. */
export function setupSeason(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  // club fixtures are rebuilt each season; NEL and international scoreboards stay until their next edition
  for (const id of Object.keys(w.fixtures)) { const k = w.comps[w.fixtures[id].comp]?.kind; if (k !== 'nel' && k !== 'intl') delete w.fixtures[id]; }
  w.sched = {}; w.acc = { w: {}, m: {}, goals: { __season: w.acc.goals.__season ?? [] } }; w.events = [];
  invalidateFixtures(w);
  for (const k of Object.keys(w.done)) if (!k.startsWith('keep:')) delete w.done[k];
  const cupTeams: Record<string, string[]> = {};
  let qual = (w.comps.ucl?.qual ?? null) as Record<string, string[]> | null;
  const firstQual = !qual;
  if (!qual) qual = { ucl: [], uel: [] };
  for (const L of LEAGUES) {
    const clubs = leagueClubs(w, L.id);
    const c = mkComp(w, { id: L.id, name: L.name, sn: L.sn, kind: 'league', nat: L.nat, tier: L.tier, teams: clubs.map((x) => x.id), up: L.up, playoff: L.playoff, down: L.down, weekly: true });
    const rounds = (clubs.length - 1) * 2;
    scheduleLeague(w, c, LEAGUE_SLOTS[rounds] ?? LEAGUE_SLOTS[38]);
    // expectations: where the squad strength says the club should finish
    const ranked = [...clubs].sort((a, b) => clubStrength(w, b) + b.rep * 0.15 - (clubStrength(w, a) + a.rep * 0.15));
    ranked.forEach((cl, i) => { cl.expect = i + 1; cl.tier = L.tier; });
    (cupTeams[L.cup] ??= []).push(...clubs.map((x) => x.id));
    if (firstQual && uclSlots(w, L.id)) {
      const byRep = [...clubs].sort((a, b) => b.rep - a.rep);
      const u1 = uclSlots(w, L.id), u2 = uelSlots(w, L.id);
      qual.ucl.push(...byRep.slice(0, u1).map((x) => x.id));
      qual.uel.push(...byRep.slice(u1, u1 + u2).map((x) => x.id));
    }
  }
  for (const L of LEAGUES) {
    if (w.comps[L.cup]?.season === w.season && w.comps[L.cup].stages.length) continue;
    const c = mkComp(w, { id: L.cup, name: L.cupName, sn: L.cupName, kind: 'cup', nat: L.nat, teams: cupTeams[L.cup] });
    c.season = w.season;
    startCup(w, c, CUP_DAYS, CUP_FINAL_DAY);
  }
  for (const [id, name, sn] of [['ucl', 'Champions League', 'UCL'], ['uel', 'Europa League', 'UEL']] as const) {
    const size = CONT_SIZE[id];
    const teams = (qual[id] ?? []).filter((t) => w.clubs[t] && w.clubs[t].league && !w.clubs[t].dormant).slice(0, size);
    // top up from the strongest clubs not already in Europe if a qualifier dropped out of the pyramid
    const inEurope = new Set([...(qual.ucl ?? []), ...(qual.uel ?? [])]);
    for (const c of Object.values(w.clubs).filter((x) => x.tier === 1 && !x.dormant && !x.nel && !inEurope.has(x.id)).sort((a, b) => b.rep - a.rep)) { if (teams.length >= size) break; teams.push(c.id); inEurope.add(c.id); }
    const c = mkComp(w, { id, name, sn, kind: 'continental', teams });
    c.qual = qual;
    (c as Competition & { days?: number[] }).days = [...CONT_KO_DAYS, CONT_FINAL_DAY];
    scheduleLeaguePhase(w, c, teams, 8, CONT_GROUP_DAYS);
  }
  scheduleBreakFriendlies(g);
  for (const wk of [2, 3, 4, 23, 24, 25]) w.events.push({ key: 'market', day: dayOf(wk, 1) }, { key: 'market', day: dayOf(wk, 4) });
  w.events.push({ key: 'midseason', day: dayOf(21, 0) });
  log(w, 'season', `setup ${seasonLabel(w.season)}`);
}

function recordCheck(g: Game, store: Record<string, { v: number; pid: string; name: string; s: number; club?: string; clubName?: string }>, key: string, v: number, p: Player, label: string, scope: string): void {
  const w = g.world;
  const old = store[key];
  if (old && v <= old.v) return;
  // only a genuinely beaten record makes a headline (the first season of a save sets the baseline silently)
  if (old && v > old.v) addNews(g, 'record', `Record broken: ${p.name} — ${label}`, `${v} ${label} in ${scope} beats the previous best of ${old.v} (${old.name}, ${seasonLabel(old.s)}). Records are counted from the ${seasonLabel(2025)} baseline of this save.`, { imp: p.id === g.career.pid ? 3 : 2, pids: [p.id] });
  store[key] = { v, pid: p.id, name: p.name, s: w.season, club: p.club ?? undefined, clubName: p.club ? w.clubs[p.club]?.name : undefined };
  if (old && p.id === g.career.pid) milestone(g, 'record', `Set a new record: ${v} ${label} in ${scope}.`);
}

/** Called when any competition finishes. Handles trophies, history, play-offs and awards. */
export function onCompFinished(g: Game, c: Competition): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (c.kind === 'nel') return;
  if (c.kind === 'intl') { finishTournament(g, c); tournamentAwards(g, c); return; }
  if (c.kind === 'league') {
    const tab = tableOf(w, c.id);
    c.hist.push({ s: w.season, champion: tab[0].id, championName: tab[0].name, runnerUp: tab[1]?.id, table: tab.map((r) => ({ id: r.id, name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })) });
    const champ = w.clubs[tab[0].id];
    champ.trophies.push({ s: w.season, comp: c.id, name: c.name });
    addNews(g, 'club', `${champ.name} are ${c.name} champions`, `${tab[0].pts} points from ${tab[0].p} matches, ${tab[0].pts - (tab[1]?.pts ?? 0)} clear of ${tab[1]?.name}.${champ.expect >= 6 ? ` Pre-season they were expected to finish ${ordinal(champ.expect)}.` : ''}`, { imp: champ.id === me.club ? 3 : c.tier === 1 ? 2 : 1, clubs: [champ.id], me: champ.id === me.club });
    if (champ.id === me.club) milestone(g, 'trophy', `Won the ${c.name} with ${champ.name}.`);
    if (c.playoff && tab.length >= 6) {
      const seeds = tab.slice(c.up ?? 2, (c.up ?? 2) + 4).map((r) => r.id);
      const pc = mkComp(w, { id: c.id + 'po', name: `${c.name} Play-offs`, sn: `${c.sn} PO`, kind: 'playoff', teams: seeds, parent: c.id });
      (pc as Competition & { days?: number[] }).days = [Math.max(PLAYOFF_DAYS[1], w.day + 5)];
      scheduleKo(w, pc, [[seeds[0], seeds[3]], [seeds[1], seeds[2]]], 1, [Math.max(PLAYOFF_DAYS[0], w.day + 2)], false, 'Semi-final');
    }
    return;
  }
  if (!c.champion || !w.clubs[c.champion]) return;
  const champ = w.clubs[c.champion];
  const fin = compFixtures(w, c.id).filter((f) => f.stg === 'Final' && f.played)[0];
  const ru = fin ? (winnerId(fin) === fin.h ? fin.a : fin.h) : undefined;
  c.hist.push({ s: w.season, champion: champ.id, championName: champ.name, runnerUp: ru });
  if (c.kind === 'playoff') {
    addNews(g, 'club', `${champ.name} win the ${c.name}`, `${champ.name} are promoted through the play-offs${ru ? `, beating ${w.clubs[ru]?.name} in the final` : ''}.`, { imp: champ.id === me.club ? 3 : 1, clubs: [champ.id], me: champ.id === me.club });
    if (champ.id === me.club) milestone(g, 'promotion', `Promoted through the play-offs with ${champ.name}.`);
    return;
  }
  champ.trophies.push({ s: w.season, comp: c.id, name: c.name });
  addNews(g, 'club', `${champ.name} win the ${c.name}`, `${fin ? `${w.clubs[fin.h]?.sn} ${fin.sc?.[0]}–${fin.sc?.[1]} ${w.clubs[fin.a]?.sn}${fin.pens ? ` (${fin.pens[0]}–${fin.pens[1]} pens)` : fin.aet ? ' after extra time' : ''}. ` : ''}${champ.tier > 1 ? 'A giant-killing run for the ages.' : ''}`, { imp: champ.id === me.club || c.kind === 'continental' ? 3 : 2, clubs: [champ.id], me: champ.id === me.club });
  if (champ.id === me.club) milestone(g, 'trophy', `Won the ${c.name} with ${champ.name}.`);
  if (c.kind === 'continental') tournamentAwards(g, c);
  for (const id of champ.squad) { const p = w.players[id]; if (p) p.rep = clamp(p.rep + (c.kind === 'continental' ? 4 : 1.5), 0, 99); }
}

/** End of the club season: awards, records, history rows, prize money, managers, movement plans. */
export function endSeason(g: Game): void {
  const w = g.world;
  if (w.done['keep:seasonEnd:' + w.season]) return;
  w.done['keep:seasonEnd:' + w.season] = 1;
  const me = w.players[g.career.pid];
  const positions: Record<string, { pos: number; n: number; relegated: boolean }> = {};
  const champs: { comp: string; compName: string; club: string; clubName: string }[] = [];
  const awardIds: string[] = [];
  const moves: string[] = [];
  const qual: Record<string, string[]> = { ucl: [], uel: [] };
  // this season's European results go into the coefficients, and the new ranking decides next season's places
  updateCoefficients(w);
  const slotsNext = { ucl: Object.fromEntries(coefRanking(w).map((x) => [x.lg, x.ucl])), uel: Object.fromEntries(coefRanking(w).map((x) => [x.lg, x.uel])) } as Record<'ucl' | 'uel', Record<string, number>>;
  for (const L of LEAGUES) {
    const c = w.comps[L.id];
    if (!c) continue;
    const tab = tableOf(w, L.id);
    const n = tab.length;
    const h = c.hist.find((x) => x.s === w.season);
    const down = tab.slice(n - (c.down ?? 0)).map((r) => r.id);
    const up = tab.slice(0, c.up ?? 0).map((r) => r.id);
    const po = w.comps[L.id + 'po'];
    if (po?.champion && po.season === w.season) up.push(po.champion);
    if (h) { h.relegated = down; h.promoted = up; }
    tab.forEach((r, i) => {
      const cl = w.clubs[r.id];
      positions[r.id] = { pos: i + 1, n, relegated: down.includes(r.id) };
      cl.hist.push({ s: w.season, comp: L.id, compName: L.name, pos: i + 1, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, note: i === 0 ? 'Champions' : up.includes(r.id) ? 'Promoted' : down.includes(r.id) ? 'Relegated' : undefined });
      if (cl.hist.length > 40) cl.hist.shift();
      cl.budget = Math.round(cl.budget * 0.35 + Math.pow(cl.rep / 100, 6) * 250e6 * (0.7 + ((n - i) / n) * 0.6));
      // reputation drifts toward results
      cl.rep = clamp(cl.rep + (cl.expect - (i + 1)) * 0.12 + (i === 0 ? 0.8 : 0) - (down.includes(r.id) ? 1.2 : 0) + (up.includes(r.id) ? 1.5 : 0), 40, 96);
    });
    if (tab[0]) champs.push({ comp: L.id, compName: L.name, club: tab[0].id, clubName: tab[0].name });
    const u1 = slotsNext.ucl[L.id] ?? 0, u2 = slotsNext.uel[L.id] ?? 0;
    if (u1) { qual.ucl.push(...tab.slice(0, u1).map((r) => r.id)); qual.uel.push(...tab.slice(u1, u1 + u2).map((r) => r.id)); }
    awardIds.push(...compSeasonAwards(g, c));
    // records from the season's stat lines
    for (const cd of seasonLines(g, L.id)) {
      if (cd.line[S.G] >= 8) { recordCheck(g, c.rec, 'goals', cd.line[S.G], cd.p, 'goals in a season', c.name); const cl = cd.p.club ? w.clubs[cd.p.club] : null; if (cl) recordCheck(g, cl.rec, 'goals', cd.line[S.G], cd.p, 'goals in a season', cl.name); }
      if (cd.line[S.A] >= 6) recordCheck(g, c.rec, 'assists', cd.line[S.A], cd.p, 'assists in a season', c.name);
      if (cd.line[S.CS] >= 6 && cd.p.pos === 'GK') recordCheck(g, c.rec, 'cleansheets', cd.line[S.CS], cd.p, 'clean sheets in a season', c.name);
    }
    const mine = positions[me.club ?? ''];
    if (mine && tab.some((r) => r.id === me.club)) {
      const cl = w.clubs[me.club!];
      const note = up.includes(cl.id) ? 'promoted' : down.includes(cl.id) ? 'relegated' : mine.pos === 1 ? 'champions' : `finished ${ordinal(mine.pos)}`;
      milestone(g, 'season', `${seasonLabel(w.season)}: ${cl.name} ${note} in the ${L.name}.`);
      if (up.includes(cl.id) && mine.pos <= (c.up ?? 0)) milestone(g, 'promotion', `Promoted from the ${L.name} with ${cl.name}.`);
    }
    if (down.length) { addNews(g, 'club', `${L.name}: ${down.map((id) => w.clubs[id].sn).join(', ')} relegated`, `${up.length ? `Coming up to replace them next season are decided separately. ` : ''}Final day table settled.`, { imp: down.includes(me.club ?? '') ? 3 : 1, clubs: down, me: down.includes(me.club ?? '') }); moves.push(`${L.name} relegated: ${down.map((id) => w.clubs[id].sn).join(', ')}`); }
    if (up.length) { addNews(g, 'club', `${L.name}: ${up.map((id) => w.clubs[id].sn).join(', ')} promoted`, 'They will play in the division above next season.', { imp: up.includes(me.club ?? '') ? 3 : 1, clubs: up, me: up.includes(me.club ?? '') }); moves.push(`${L.name} promoted: ${up.map((id) => w.clubs[id].sn).join(', ')}`); }
  }
  for (const id of ['ucl', 'uel', ...LEAGUES.map((l) => l.cup)]) { const c = w.comps[id]; if (c?.champion && c.season === w.season && w.clubs[c.champion] && !champs.some((x) => x.comp === id)) champs.push({ comp: id, compName: c.name, club: c.champion, clubName: w.clubs[c.champion].name }); }
  // holders of the Champions League always return
  const holder = w.comps.ucl?.champion;
  if (holder && !qual.ucl.includes(holder)) { qual.uel = qual.uel.filter((x) => x !== holder); qual.ucl.push(holder); }
  if (w.comps.ucl) w.comps.ucl.qual = qual;
  awardIds.push(...worldAwards(g));
  rememberSeasonClubs(g);
  archiveSheets(g);
  setupTotsCup(g);
  g.career.flags.ceremony = w.season; // the UI presents the season's awards as a ceremony
  w.rec.seasons = { v: (w.rec.seasons?.v ?? 0) + 1, pid: '', name: '', s: w.season };
  managerChanges(g, positions);
  w.archive.push({ s: w.season, champs, awards: awardIds, moves });
  // user season summary
  let ap = 0, gl = 0, as = 0, rt = 0, rn = 0;
  for (const cid in me.ss) { const l = me.ss[cid]; ap += l[S.APP]; gl += l[S.G]; as += l[S.A]; rt += l[S.RAT]; rn += l[S.RATN]; }
  if (ap) milestone(g, 'season', `${seasonLabel(w.season)} personal: ${ap} apps, ${gl} goals, ${as} assists, average rating ${rn ? (rt / rn).toFixed(2) : '—'}.`);
  addNews(g, 'world', `${seasonLabel(w.season)} season review`, champs.map((x) => `${x.compName}: ${x.clubName}`).join(' · '), { imp: 2 });
  log(w, 'season', `end ${seasonLabel(w.season)}`);
}

/** Apply promotion / relegation so that every league has a valid set of clubs next season. */
function applyMovement(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  const me = w.players[g.career.pid];
  const move = (id: string, league: string | null, tier: number) => { const c = w.clubs[id]; if (!c) return; c.league = league; c.tier = tier; c.dormant = league === null; };
  const plan: [string, string | null, number][] = [];
  for (const L of LEAGUES) {
    const h = w.comps[L.id]?.hist.find((x) => x.s === w.season);
    if (!h) continue;
    const below = LEAGUES.find((x) => x.nat === L.nat && x.tier === L.tier + 1);
    const above = LEAGUES.find((x) => x.nat === L.nat && x.tier === L.tier - 1);
    for (const id of h.relegated ?? []) plan.push([id, below ? below.id : null, below ? below.tier : L.tier + 1]);
    if (above) for (const id of h.promoted ?? []) plan.push([id, above.id, above.tier]);
    if (!below && (h.relegated?.length ?? 0) > 0) {
      // clubs arrive from the division below the simulated pyramid
      const pool = (w.pool[L.nat] ?? []).filter((id) => w.clubs[id]?.dormant && !(h.relegated ?? []).includes(id));
      const ups = rng.shuffle([...pool]).sort((a, b) => w.clubs[b].rep - w.clubs[a].rep + (rng.next() - 0.5) * 8).slice(0, h.relegated!.length);
      for (const id of ups) plan.push([id, L.id, L.tier]);
      const poolName = POOLS[L.nat]?.name ?? 'the division below';
      if (ups.length) addNews(g, 'club', `${ups.map((id) => w.clubs[id].sn).join(', ')} promoted from ${poolName}`, `They join the ${L.name}. (${poolName} is outside the simulated pyramid.)`, { imp: 1, clubs: ups });
      for (const id of h.relegated ?? []) if (!(w.pool[L.nat] ?? []).includes(id)) (w.pool[L.nat] ??= []).push(id);
    }
  }
  for (const [id, league, tier] of plan) {
    const wasDormant = w.clubs[id].dormant;
    move(id, league, tier);
    if (wasDormant && league) { activatePoolClub(w, w.clubs[id]); w.clubs[id].rep = clamp(w.clubs[id].rep + 2, 40, 96); }
  }
  // the user's club left the simulated pyramid: a relegation release clause activates
  const mc = me.club ? w.clubs[me.club] : null;
  if (mc && mc.dormant) {
    const o = ovr(me);
    const clubs = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.league).sort((a, b) => Math.abs(levelOf(a) - o) - Math.abs(levelOf(b) - o)).slice(0, 4);
    for (const c of clubs) g.career.offers.push(buildOffer(g, c, 'free', 60, { deadline: w.abs + 40, note: `${mc.name} have dropped below the simulated pyramid; your relegation release clause lets you leave for free.` }));
    g.career.flags.mustMove = 1;
    addNews(g, 'career', `${mc.name} drop out of the simulated leagues`, 'Your relegation release clause is active. Choose a new club from the offers your agent has gathered.', { imp: 3, me: true });
  }
}

/** New season: contracts, development, movement, cleanup, then a fresh fixture list. */
export function rollover(g: Game): void {
  const w = g.world;
  const me = g.career.pid;
  if (w.totsLive) totsCupFinish(g, true); // never carry the cup into a new season
  // the Ballon d'Or judges the whole season, summer tournament included: take the cases before the lines are archived
  bdoSnapshot(g);
  // archive every player's season lines into their career history
  for (const id in w.players) {
    const p = w.players[id];
    for (const cid of Object.keys(p.ss)) archiveStats(g, p, cid, w.comps[cid]?.natTeams ? '' : p.club ?? '');
    p.yel = 0; p.susp = 0;
  }
  contractYearEnd(g);
  const dev = yearlyDevelopment(g);
  applyMovement(g);
  pruneAwards(g);
  const pruned = pruneRetired(g);
  w.season++;
  // yesterday's papers: once a season is over only the stories about the user are kept
  w.news = w.news.filter((n) => n.me || n.s >= w.season);
  w.day = 0; w.stage = 0;
  // drop relationship entries for people who no longer exist
  for (const id of Object.keys(g.career.rel)) if (!w.players[id] && !g.career.people[id] && !Object.values(w.clubs).some((c) => c.mgr.id === id)) delete g.career.rel[id];
  ensureSquads(g);
  for (const c of Object.values(w.clubs)) if (!c.nel && !c.dormant && c.league) finalizeSquad(w, c);
  const p = w.players[me];
  if (p.con && g.career.promise && g.career.promise.club === p.club) p.con.role = g.career.promise.role;
  for (const id of ['wc', 'euro', 'copa', 'afcon', 'asian', 'gold', 'u20wc', 'u20asian', 'u21euro', 'intlf']) if (w.comps[id]) w.comps[id].done = true;
  setupSeason(g);
  aiLoans(g);
  if (p.club && w.clubs[p.club]) for (const tid of w.clubs[p.club].squad) if (tid !== me) relOf(g, tid);
  g.career.ovrLog.push({ s: w.season, day: 0, ovr: ovr(p) });
  addNews(g, 'world', `The ${seasonLabel(w.season)} season begins`, `${dev.retired.length} players retired over the summer and ${dev.youth.length} academy graduates signed first contracts.${pruned ? '' : ''}`, { imp: 2 });
  log(w, 'season', `rollover -> ${seasonLabel(w.season)}`);
}

/** NEL → professional football: the same save continues into the baseline season. */
export function startPro(g: Game): void {
  const w = g.world;
  if (w.phase === 'pro') return;
  for (const id in w.players) { const p = w.players[id]; for (const cid of Object.keys(p.ss)) archiveStats(g, p, cid, p.nelTeam && cid === 'nel' ? p.nelTeam : cid === 'u20wc' ? '' : p.club ?? ''); }
  w.phase = 'pro'; w.day = 0; w.stage = 0;
  for (const id of ['nel', 'u20wc']) if (w.comps[id]) w.comps[id].done = true;
  ensureSquads(g);
  for (const c of Object.values(w.clubs)) if (!c.nel && !c.dormant && c.league) finalizeSquad(w, c);
  const p = w.players[g.career.pid];
  if (p.con && g.career.promise) p.con.role = g.career.promise.role;
  setupSeason(g);
  aiLoans(g);
  g.career.ovrLog.push({ s: w.season, day: 0, ovr: ovr(p) });
  const club = p.club ? w.clubs[p.club] : null;
  milestone(g, 'pro', `Professional career begins${club ? ` at ${club.name}` : ''} — ${seasonLabel(w.season)}.`);
  addNews(g, 'world', `Welcome to the ${seasonLabel(w.season)} season`, `${w.baseline} Supported competitions: ${SUPPORTED}`, { imp: 3 });
}
