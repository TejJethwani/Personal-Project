/**
 * Neo Egoist League chapter: fixtures, club bids and valuation rankings, the top-23
 * selection, and the conclusion that hands the same save over to professional football.
 *
 * Bids are ANNUAL-SALARY offers in Japanese yen (¥), as in the NEL. They are a different
 * thing from later transfer fees / market values (EUR) and weekly wages (EUR per week).
 */
import type { Bid, BidState, Fixture, Game, NelSummary, Player } from './types';
import { ovr, POS_LINE } from './attributes';
import { rarityOf, mainWeapon } from './abilities';
import { clamp, hashStr, mixSeed } from './rng';
import { mkComp, scheduleLeague, compFixtures, tableOf } from './competitions';
import { S } from './match/model';
import { addNews, tacticalFit, fmtYenShort, milestone, ordinal, log } from './util';
import { nelRoundAwards, nelFinalAwards } from './awards';
import { makeNelOffers, signNelPlayers } from './transfers';
import { setupU20WorldCup } from './international';
import { NEL_CANON_RESULTS } from './data/nel';

export const NEL_ROUND_DAYS = [5, 12, 19, 26, 33];
export const NEL_END_DAY = 35;
export const PROLOGUE_END_DAY = 63;

export function initNel(g: Game): void {
  const w = g.world;
  const c = mkComp(w, { id: 'nel', name: 'Neo Egoist League', sn: 'NEL', kind: 'nel', rules: 'nel', teams: w.nel.teams.slice(), weekly: true });
  scheduleLeague(w, c, NEL_ROUND_DAYS, false);
}

export function nelPlayers(g: Game): Player[] {
  const w = g.world;
  const out: Player[] = [];
  for (const t of w.nel.teams) for (const id of w.clubs[t].squad) if (w.players[id]) out.push(w.players[id]);
  return out;
}
export function isBlueLock(g: Game, p: Player): boolean {
  if (p.id === g.career.pid) return p.nat === 'JPN' || !!p.nat2?.includes('JPN');
  return p.origin === 'bluelock';
}

/** Canon-guided mode only: the listed winner for a pairing that does not involve the user's team. */
export function canonWinner(g: Game, fx: Fixture): string | undefined {
  if (g.settings.canonChange) return undefined;
  const my = g.world.players[g.career.pid].club;
  if (fx.h === my || fx.a === my) return undefined;
  const c = NEL_CANON_RESULTS.find((r) => (r.a === fx.h && r.b === fx.a) || (r.a === fx.a && r.b === fx.h));
  return c?.winner;
}

function roundLines(g: Game, p: Player): { rd: number; line: number[] }[] {
  const out: { rd: number; line: number[] }[] = [];
  for (const f of compFixtures(g.world, 'nel')) if (f.played && f.lines?.[p.id]) out.push({ rd: f.rd, line: f.lines[p.id] });
  return out;
}

export interface Valuation { value: number; why: string[]; played: number; avg: number }
/** Scouting valuation of an NEL player after the rounds played so far. */
export function valuation(g: Game, p: Player, b: BidState | undefined): Valuation {
  const w = g.world;
  const o = ovr(p), ag = w.season - p.born;
  const rl = roundLines(g, p).filter((x) => x.line[S.RATN] > 0);
  const base = 3e6 * Math.pow(1.2, o - 62) * (1 + Math.max(0, p.pot - o) * 0.035) * (ag <= 17 ? 1.12 : ag >= 20 ? 0.9 : 1);
  const why: string[] = [];
  if (!rl.length) return { value: base * 0.35, why: ['Not yet seen in a match'], played: 0, avg: 0 };
  // performance over multiple games: recency-weighted, but every match counts
  let sw = 0, sp = 0, sum = 0;
  rl.forEach((x, i) => { const wt = 1 + i * 0.15; sw += wt; sp += wt * (x.line[S.RAT] - 6.5); sum += x.line[S.RAT]; });
  const avg = sum / rl.length;
  const perfMul = clamp(1 + (sp / sw) * 0.42, 0.55, 2.4);
  let cons = 1;
  if (rl.length >= 2) {
    const sd = Math.sqrt(rl.reduce((s, x) => s + (x.line[S.RAT] - avg) ** 2, 0) / rl.length);
    cons = 1 - clamp(sd - 0.6, 0, 1.5) * 0.12;
    if (sd < 0.5 && avg >= 7) why.push(`Consistent: ${avg.toFixed(1)} average across ${rl.length} matches`);
    else if (sd > 1.2) why.push('Inconsistent performances are holding the valuation back');
  }
  let gl = 0, as = 0, kp = 0, def = 0;
  for (const x of rl) { gl += x.line[S.G]; as += x.line[S.A]; kp += x.line[S.KP]; def += x.line[S.TKW] + x.line[S.INT] + x.line[S.BLK]; }
  const line = POS_LINE[p.pos];
  // diminishing returns: the fifth goal adds far less than the first
  const prod = gl * 1.0 + as * 0.7 + kp * 0.12 + def * 0.06 * (line <= 1 ? 1.7 : line === 2 ? 1.2 : 0.6);
  const prodMul = 1 + 0.5 * (1 - Math.exp(-prod / 4));
  const rar = rarityOf(p);
  const unique = 1 + rar * 0.03;
  const moments = b?.moments ?? 0;
  const momentMul = 1 + Math.min(0.18, moments * 0.06); // a spectacular moment helps, but is capped
  if (gl + as > 0) why.push(`${gl} goal${gl === 1 ? '' : 's'}, ${as} assist${as === 1 ? '' : 's'}`);
  if (line <= 2 && def >= 6) why.push(`${def} defensive actions won`);
  if (kp >= 4) why.push(`${kp} chances created`);
  if (avg >= 7.6) why.push(`Average rating ${avg.toFixed(1)}`); else if (avg < 6.3) why.push(`Average rating only ${avg.toFixed(1)}`);
  if (p.pot - o >= 8 && ag <= 18) why.push(`Age ${ag} with ${p.pot} potential`);
  const mw = mainWeapon(p);
  if (mw && rar >= 4) why.push(`Rare weapon: ${mw.name}`);
  if (moments > 0) why.push('High-profile moment on a big stage');
  if (!why.length) why.push(`Average rating ${avg.toFixed(1)} over ${rl.length} match${rl.length > 1 ? 'es' : ''}`);
  return { value: base * perfMul * cons * prodMul * unique * momentMul, why, played: rl.length, avg };
}

/** Recompute every club's bid after a round. Bids are sticky: they move toward the new valuation, up or down. */
export function updateBids(g: Game, rd: number): void {
  const w = g.world;
  const clubs = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.rep >= 66);
  const levelOf = (rep: number) => 38 + rep * 0.5;
  const prevRank: Record<string, number> = {};
  for (const id in w.nel.bids) prevRank[id] = w.nel.bids[id].rank;
  for (const p of nelPlayers(g)) {
    const b = (w.nel.bids[p.id] ??= { pid: p.id, top: 0, topClub: '', bids: [], hist: [], rank: 0, prevRank: 0, perf: [], moments: 0 });
    const fx = compFixtures(w, 'nel').find((f) => f.rd === rd && f.played && f.lines?.[p.id]);
    const line = fx?.lines?.[p.id];
    b.perf[rd - 1] = line && line[S.RATN] ? line[S.RAT] : 0;
    if (line && line[S.RATN]) {
      const big = fx!.goals?.some((gl) => gl[2] === p.id && gl[5] >= 70) || line[S.RAT] >= 9.2 || (line[S.G] >= 2 && line[S.POTM] > 0);
      if (big) b.moments++;
    }
    const v = valuation(g, p, b);
    if (!v.played) { b.bids = []; b.top = 0; b.topClub = ''; continue; }
    const o = ovr(p);
    const parent = p.nelTeam ? w.clubs[p.nelTeam]?.parent : undefined;
    const cand: Bid[] = [];
    for (const c of clubs) {
      const lvl = levelOf(c.rep);
      if (o < lvl - 13 || p.pot < lvl - 3) continue;
      const fit = 1 + tacticalFit(p, c.style) * 0.035;
      let better = 0;
      for (const id of c.squad) { const q = w.players[id]; if (q && q.pos === p.pos && ovr(q) >= o) better++; }
      const need = better === 0 ? 1.14 : better === 1 ? 1.05 : better === 2 ? 0.97 : 0.9;
      const wealth = Math.pow(c.rep / 90, 2);
      const noise = 0.92 + ((mixSeed(w.seed, p.id, c.id, rd) % 1000) / 1000) * 0.16;
      let amt = v.value * fit * need * wealth * noise * (c.id === parent ? 1.08 : 1);
      const old = b.bids.find((x) => x.club === c.id);
      if (old) amt = old.amt + clamp(amt - old.amt, -old.amt * 0.25, old.amt * 0.4);
      const why = [...v.why];
      if (need > 1.1) why.push(`${c.sn} have nobody better at ${p.pos}`);
      if (fit > 1.05) why.push(`Suits ${c.sn}'s ${c.style} football`);
      if (c.id === parent) why.push('Already in the club\'s system');
      cand.push({ club: c.id, clubName: c.name, amt: Math.round(amt / 1e6) * 1e6, rd, why });
    }
    cand.sort((x, y) => y.amt - x.amt);
    b.bids = cand.slice(0, 5).filter((x) => x.amt >= 5e6);
    const prevTop = b.top;
    b.top = b.bids[0]?.amt ?? 0;
    b.topClub = b.bids[0]?.club ?? '';
    b.hist.push({ rd, amt: b.top, club: b.topClub, clubName: b.bids[0]?.clubName ?? '', rank: 0, delta: b.top - prevTop, why: b.bids[0]?.why ?? v.why });
  }
  const ranked = Object.values(w.nel.bids).sort((a, b) => b.top - a.top || hashStr(a.pid) - hashStr(b.pid));
  ranked.forEach((b, i) => { b.prevRank = prevRank[b.pid] ?? 0; b.rank = b.top > 0 ? i + 1 : 0; const h = b.hist[b.hist.length - 1]; if (h && h.rd === rd) h.rank = b.rank; });
  // news: biggest movers and the user's own bid
  const my = w.nel.bids[g.career.pid];
  if (my && my.hist.length && my.hist[my.hist.length - 1].rd === rd && my.top > 0) {
    const h = my.hist[my.hist.length - 1];
    const dir = h.delta > 0 ? 'rises to' : h.delta < 0 ? 'falls to' : 'holds at';
    addNews(g, 'bid', `Your bid ${dir} ${fmtYenShort(my.top)}`, `${h.clubName} lead the bidding for you after Round ${rd}. You are ranked ${ordinal(my.rank)} overall.${h.why.length ? ' Scouts note: ' + h.why.slice(0, 3).join('; ') + '.' : ''}`, { imp: 2, me: true, clubs: [h.club] });
  } else if (my && my.top === 0) addNews(g, 'bid', 'No bid yet', 'Clubs have not seen enough of you on the pitch to make an offer.', { imp: 1, me: true });
  const movers = ranked.filter((b) => b.hist.length && b.hist[b.hist.length - 1].rd === rd && b.pid !== g.career.pid).sort((a, b) => b.hist[b.hist.length - 1].delta - a.hist[a.hist.length - 1].delta);
  const up = movers[0];
  if (up && up.hist[up.hist.length - 1].delta > 0) {
    const p = w.players[up.pid];
    addNews(g, 'bid', `${p.name}'s valuation jumps to ${fmtYenShort(up.top)}`, `${up.hist[up.hist.length - 1].clubName} now lead the bidding (${ordinal(up.rank)} overall). ${up.hist[up.hist.length - 1].why.slice(0, 2).join('; ')}.`, { pids: [p.id], imp: 1 });
  }
  const down = movers[movers.length - 1];
  if (down && down.hist[down.hist.length - 1].delta < 0) {
    const p = w.players[down.pid];
    addNews(g, 'bid', `Clubs cool on ${p.name}`, `Top bid drops to ${fmtYenShort(down.top)} after Round ${rd}.`, { pids: [p.id], imp: 1 });
  }
}

export function blRanking(g: Game): BidState[] {
  return Object.values(g.world.nel.bids).filter((b) => { const p = g.world.players[b.pid]; return p && isBlueLock(g, p); }).sort((a, b) => b.top - a.top || a.rank - b.rank);
}

/** Called when both matches of an NEL round are complete. Idempotent per round. */
export function afterNelRound(g: Game, rd: number): void {
  const w = g.world;
  if (w.nel.round >= rd) return;
  w.nel.round = rd;
  updateBids(g, rd);
  nelRoundAwards(g, rd);
  const fs = compFixtures(w, 'nel').filter((f) => f.rd === rd);
  const playing = new Set(fs.flatMap((f) => [f.h, f.a]));
  const rest = w.nel.teams.find((t) => !playing.has(t));
  addNews(g, 'nel', `NEL Round ${rd}: ${fs.map((f) => `${w.clubs[f.h].sn} ${f.sc?.[0]}–${f.sc?.[1]} ${w.clubs[f.a].sn}`).join(' · ')}`, `${rest ? w.clubs[rest].name + ' rested this round. ' : ''}${tableOf(w, 'nel').slice(0, 2).map((r, i) => `${ordinal(i + 1)}: ${r.name} (${r.pts} pts)`).join(', ')}.`, { imp: 2 });
  log(w, 'nel', `round ${rd} complete`);
}

/** NEL conclusion: final table, rankings, awards, evaluation, selection and career routes. */
export function concludeNel(g: Game): void {
  const w = g.world;
  if (w.nel.done) return;
  w.nel.done = true;
  const me = w.players[g.career.pid];
  const table = tableOf(w, 'nel');
  const champ = table[0];
  const comp = w.comps.nel;
  comp.done = true; comp.champion = champ.id;
  comp.hist.push({ s: w.season, champion: champ.id, championName: champ.name, table: table.map((r) => ({ id: r.id, name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })) });
  w.clubs[champ.id].trophies.push({ s: w.season, comp: 'nel', name: 'Neo Egoist League' });
  const all = Object.values(w.nel.bids).filter((b) => b.top > 0).sort((a, b) => b.top - a.top);
  const bl = blRanking(g).filter((b) => b.top > 0);
  const N = g.settings.nel.topN;
  w.nel.top23 = bl.slice(0, N).map((b) => b.pid);
  const myB = w.nel.bids[me.id];
  const japan = isBlueLock(g, me);
  const myBl = bl.findIndex((b) => b.pid === me.id) + 1;
  const myRank = all.findIndex((b) => b.pid === me.id) + 1;
  const ageOk = w.season - me.born <= 20;
  const selected = ageOk && (japan ? myBl > 0 && myBl <= N : myRank > 0 && myRank <= N);
  const awards = nelFinalAwards(g);
  // evaluation
  const lines = compFixtures(w, 'nel').filter((f) => f.lines?.[me.id]).map((f) => f.lines![me.id]);
  const played = lines.filter((l) => l[S.RATN] > 0);
  const avg = played.length ? played.reduce((s, l) => s + l[S.RAT], 0) / played.length : 0;
  const gl = lines.reduce((s, l) => s + l[S.G], 0), as = lines.reduce((s, l) => s + l[S.A], 0);
  const ev: string[] = [];
  ev.push(played.length ? `${played.length} rated appearance${played.length > 1 ? 's' : ''}, average rating ${avg.toFixed(2)}.` : 'You did not earn a rated appearance.');
  ev.push(`${gl} goal${gl === 1 ? '' : 's'} and ${as} assist${as === 1 ? '' : 's'}.`);
  ev.push(myRank ? `Final valuation ${fmtYenShort(myB.top)} — ${ordinal(myRank)} of ${all.length} valued players${japan && myBl ? `, ${ordinal(myBl)} in the Blue Lock ranking` : ''}.` : 'No club placed a bid on you.');
  ev.push(`Coach trust finished at ${Math.round(g.career.mgrTrust)}/100; tactical discipline ${Math.round(g.career.discipline)}%.`);
  const score = (avg ? (avg - 6) * 22 : 0) + (gl + as) * 4 + (myRank ? Math.max(0, 30 - myRank) : 0);
  const grade = score >= 75 ? 'S' : score >= 58 ? 'A' : score >= 42 ? 'B' : score >= 26 ? 'C' : score >= 12 ? 'D' : 'E';
  ev.push(selected ? `SELECTED: you finished inside the top ${N}${japan ? ' of the Blue Lock ranking and will go to the U-20 World Cup with Japan' : ` overall and have earned a U-20 World Cup call-up from ${me.nat}`}.`
    : !ageOk ? 'You are over the U-20 age limit, so the selection does not apply — clubs still watched every minute.'
      : `NOT SELECTED: you finished outside the top ${N}. The U-20 World Cup will go on without you — professional football will not.`);
  const summary: NelSummary = {
    table: table.map((r) => ({ id: r.id, name: r.name, p: r.p, w: r.w, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })), champion: champ.id,
    ranking: all.map((b, i) => { const p = w.players[b.pid]; return { pid: b.pid, name: p.name, team: p.nelTeam ?? '', amt: b.top, club: b.bids[0]?.clubName ?? '', rank: i + 1, bl: isBlueLock(g, p) }; }),
    myRank, myBid: myB?.top ?? 0, myBlRank: myBl, selected, eligible: japan, evalLines: ev, grade, awards,
  };
  w.nel.summary = summary;
  // reputation consequences for everyone
  all.forEach((b, i) => { const p = w.players[b.pid]; if (p) p.rep = clamp(p.rep + Math.max(0, 24 - i * 0.55), 0, 99); });
  if (selected) g.career.flags.u20 = 1;
  g.career.flags.nelGrade = grade;
  milestone(g, 'nel', `Finished the Neo Egoist League ${myRank ? `ranked ${ordinal(myRank)} (${fmtYenShort(myB.top)})` : 'without a bid'} — grade ${grade}. ${selected ? 'Selected for the U-20 World Cup.' : 'Missed the U-20 selection.'}`);
  addNews(g, 'nel', `${champ.name} win the Neo Egoist League`, `Final table: ${table.map((r) => `${r.name} ${r.pts}`).join(', ')}. ${all[0] ? `${w.players[all[0].pid].name} tops the valuation ranking at ${fmtYenShort(all[0].top)}.` : ''}`, { imp: 3, clubs: [champ.id] });
  addNews(g, 'nel', `Blue Lock top ${N} confirmed`, `${w.nel.top23!.slice(0, 6).map((id) => w.players[id].sn).join(', ')} lead the squad for the U-20 World Cup.${selected && japan ? ' You are in.' : japan ? ' You are not on the list.' : ''}`, { imp: 3, me: japan });
  signNelPlayers(g);
  makeNelOffers(g);
  setupU20WorldCup(g);
}
