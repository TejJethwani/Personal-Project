/**
 * Simulating whole seasons at once (1–25 years) with stop conditions. Pure engine logic: the UI calls `longSimChunk`
 * repeatedly (yielding between calls) and shows progress; tests call `longSimRun`.
 */
import type { Game } from './types';
import { nextStop, simUserMatch, advance, needsClub } from './sim';
import { openOffers, acceptOffer, ensureUserHasOptions } from './transfers';
import { takeJob } from './manager';
import { seasonLabel, fmtDate } from './competitions';
import { ovr } from './attributes';
import { S } from './match/model';

export interface LongSimOpts {
  years: number;
  /** stop for the end-of-season awards ceremony and the Ballon d'Or gala (otherwise they are marked as seen) */
  ceremonies: boolean;
  /** stop at the end of every season */
  seasonEnd: boolean;
  /** stop when you win a trophy */
  trophy: boolean;
  /** stop when you win the Ballon d'Or (player) */
  bdo: boolean;
  /** stop when a big club (reputation 88+) makes you an offer (player) or wants you as manager */
  bigOffer: boolean;
  /** pick the best available club / job automatically when you must choose one (otherwise stop) */
  autoClub: boolean;
  /** accept new contracts offered by your own club automatically (player) */
  autoRenew: boolean;
  /** stop when you pick up an injury of four weeks or more (player) */
  injury: boolean;
  /** stop when your OVR reaches this (player; 0 = off) */
  ovrTarget: number;
  /** manager: stop when board confidence falls below 25% */
  board: boolean;
  /** manager: stop when a club bids for one of your players */
  bids: boolean;
}
export const DEFAULT_LONGSIM: LongSimOpts = { years: 1, ceremonies: false, seasonEnd: false, trophy: false, bdo: true, bigOffer: false, autoClub: true, autoRenew: true, injury: false, ovrTarget: 0, board: true, bids: false };

export interface LongSimState {
  opts: LongSimOpts;
  target: number; tSeason: number; tDay: number; startAbs: number; season0: number;
  stopped: string;
  done: boolean;
  // snapshots for "what changed" checks
  trophies: number; bdoN: number; offerId: number; mgrOfferId: number; inj: number; conf: number; season: number; jobsKey: string;
  // for the report
  matches0: number; tl0: number; ovr0: number; mgrMatches0: number; mgrHist0: number; mgrTrophies0: number; clubs: string[];
}

const trophyCount = (g: Game) => g.mgr ? g.mgr.trophies.length : g.career.timeline.filter((t) => t.type === 'trophy').length;
const me = (g: Game) => g.world.players[g.career.pid];

export function longSimStart(g: Game, opts: LongSimOpts): LongSimState {
  const w = g.world;
  const years = Math.max(1, Math.min(25, Math.round(opts.years)));
  return {
    opts: { ...opts, years }, target: w.abs + years * 364 + 200, tSeason: w.season + years, tDay: w.phase === 'pro' ? w.day : 0, startAbs: w.abs, season0: w.season, stopped: '', done: false,
    trophies: trophyCount(g), bdoN: g.career.bdoHist?.length ?? 0, offerId: g.career.nextOffer, mgrOfferId: g.mgr?.nextId ?? 0, inj: g.mgr ? 0 : me(g).inj, conf: g.mgr?.conf ?? 100, season: w.season, jobsKey: g.mgr?.jobs.join(',') ?? '',
    matches0: g.career.matches.length, tl0: g.career.timeline.length, ovr0: g.mgr ? 0 : ovr(me(g)), mgrMatches0: g.mgr?.matches.length ?? 0, mgrHist0: g.mgr?.hist.length ?? 0, mgrTrophies0: g.mgr?.trophies.length ?? 0,
    clubs: [g.mgr ? g.mgr.club : me(g).club ?? ''],
  };
}

/** Pick a club when the career needs one: the best mix of club strength and the role on offer. */
function autoClub(g: Game): void {
  if (g.mgr) {
    const m = g.mgr;
    const best = [...m.jobs].sort((a, b) => (g.world.clubs[b]?.rep ?? 0) - (g.world.clubs[a]?.rep ?? 0))[0];
    if (best) takeJob(g, best);
    return;
  }
  const offs = openOffers(g).sort((a, b) => (g.world.clubs[b.club]?.rep ?? 0) * 0.6 + b.devScore * 3 + b.wage / 40000 - ((g.world.clubs[a.club]?.rep ?? 0) * 0.6 + a.devScore * 3 + a.wage / 40000));
  if (offs.length) acceptOffer(g, offs[0].id); else ensureUserHasOptions(g);
}

/**
 * Advance a few days (or one match). Returns false when the run is over (target reached, a stop condition, or the
 * career needs the user).
 */
export function longSimChunk(g: Game, st: LongSimState): boolean {
  const o = st.opts, w = g.world;
  if (st.done) return false;
  const stop = (why: string) => { st.stopped = why; st.done = true; return false; };
  if (reached(g, st)) { st.done = true; return false; }
  const ns = nextStop(g);
  if (ns.kind === 'live') return stop('A match is in progress.');
  if (ns.kind === 'retired') return stop('Your career is over.');
  if (ns.kind === 'summary') { g.career.flags.nelSummarySeen = 1; return true; }
  if (ns.kind === 'club' || needsClub(g)) {
    if (!o.autoClub) return stop(g.mgr ? 'You need a new job.' : 'You must choose a club.');
    autoClub(g);
    if (nextStop(g).kind === 'club') { ensureUserHasOptions(g); autoClub(g); if (nextStop(g).kind === 'club') return stop('No club could be found automatically.'); }
    const now = g.mgr ? g.mgr.club : me(g).club ?? '';
    if (now && st.clubs[st.clubs.length - 1] !== now) st.clubs.push(now);
    return true;
  }
  const f = g.career.flags;
  if ((f.ceremony != null && f.ceremony !== f.ceremonySeen) || (f.gala != null && f.gala !== f.galaSeen)) {
    if (o.ceremonies) return stop(f.gala != null && f.gala !== f.galaSeen ? "The Ballon d'Or gala." : 'The end-of-season awards ceremony.');
    if (f.gala != null) f.galaSeen = f.gala;
    if (f.ceremony != null) f.ceremonySeen = f.ceremony;
  }
  delete f.awardPop;
  // contracts from your own club
  if (!g.mgr) {
    const p = me(g);
    const ren = openOffers(g).find((x) => x.kind === 'renewal' || (x.club === p.club && x.kind !== 'loan'));
    if (ren && o.autoRenew) acceptOffer(g, ren.id);
  }
  // play / advance
  if (ns.kind === 'match') simUserMatch(g);
  else advance(g, 2);
  // stop conditions
  const p = g.mgr ? null : me(g);
  const club = g.mgr ? g.mgr.club : p?.club ?? '';
  if (club && st.clubs[st.clubs.length - 1] !== club) st.clubs.push(club);
  if (o.trophy && trophyCount(g) > st.trophies) { st.trophies = trophyCount(g); return stop(g.mgr ? `Trophy won: ${g.mgr.trophies[g.mgr.trophies.length - 1]?.name}.` : `Trophy won: ${[...g.career.timeline].reverse().find((t) => t.type === 'trophy')?.txt ?? ''}`); }
  st.trophies = trophyCount(g);
  const bh = g.career.bdoHist ?? [];
  if (bh.length > st.bdoN) { const last = bh[bh.length - 1]; st.bdoN = bh.length; if (o.bdo && last.rank === 1) return stop(`You won the Ballon d'Or (${seasonLabel(last.s)})!`); }
  if (!g.mgr) {
    const fresh = g.career.offers.filter((x) => x.id >= st.offerId && x.status === 'open');
    st.offerId = g.career.nextOffer;
    const big = fresh.find((x) => (w.clubs[x.club]?.rep ?? 0) >= 88 && x.club !== p!.club);
    if (o.bigOffer && big) return stop(`${big.clubName} have made you an offer.`);
    if (o.injury && p!.inj >= 28 && st.inj < 28) { st.inj = p!.inj; return stop(`Injury: out for ${p!.inj} days.`); }
    st.inj = p!.inj;
    if (o.ovrTarget > 0 && ovr(p!) >= o.ovrTarget) return stop(`You reached ${ovr(p!)} OVR.`);
  } else {
    const m = g.mgr;
    if (o.bids && m.offers.some((x) => x.id >= st.mgrOfferId && x.status === 'open')) { st.mgrOfferId = m.nextId; return stop('A club has bid for one of your players.'); }
    st.mgrOfferId = m.nextId;
    const jk = m.jobs.join(',');
    if (o.bigOffer && m.club && jk && jk !== st.jobsKey && m.jobs.some((id) => (w.clubs[id]?.rep ?? 0) >= 88)) { st.jobsKey = jk; return stop('A big club wants you as their manager.'); }
    st.jobsKey = jk;
    if (o.board && m.club && m.conf < 25 && st.conf >= 25) { st.conf = m.conf; return stop(`Board confidence is down to ${Math.round(m.conf)}%.`); }
    st.conf = m.conf;
  }
  if (w.season !== st.season) { st.season = w.season; if (o.seasonEnd) return stop(`The ${seasonLabel(w.season)} season is about to start.`); }
  if (reached(g, st)) { st.done = true; return false; }
  return true;
}
/** N seasons later, at the same point of the season (a run started during the NEL ends as that season starts). */
function reached(g: Game, st: LongSimState): boolean { const w = g.world; return w.abs >= st.target || (w.phase === 'pro' && (w.season > st.tSeason || (w.season === st.tSeason && w.day >= st.tDay))); }

export interface LongSimReport { from: string; to: string; days: number; stopped: string; lines: string[] }
export function longSimReport(g: Game, st: LongSimState): LongSimReport {
  const w = g.world;
  const lines: string[] = [];
  if (g.mgr) {
    const ms = g.mgr.matches.slice(st.mgrMatches0);
    const W = ms.filter((x) => x.res === 'W').length, D = ms.filter((x) => x.res === 'D').length, L = ms.filter((x) => x.res === 'L').length;
    lines.push(`${ms.length} matches: ${W} won, ${D} drawn, ${L} lost.`);
    for (const h of g.mgr.hist.slice(st.mgrHist0)) lines.push(`${seasonLabel(h.s)}: ${h.clubName} finished ${h.pos}${h.pos === 1 ? 'st' : h.pos === 2 ? 'nd' : h.pos === 3 ? 'rd' : 'th'} (target ${h.obj})${h.trophies.length ? ` — ${h.trophies.join(', ')}` : ''}.`);
    const tr = g.mgr.trophies.slice(st.mgrTrophies0);
    if (tr.length) lines.push(`Trophies: ${tr.map((t) => `${t.name} (${seasonLabel(t.s)})`).join(', ')}.`);
  } else {
    const ms = g.career.matches.slice(st.matches0);
    let gl = 0, as = 0, apps = 0; for (const m of ms) if (m.line && m.line[S.APP]) { apps++; gl += m.line[S.G]; as += m.line[S.A]; }
    lines.push(`${apps} appearances, ${gl} goals, ${as} assists.`);
    const p = me(g);
    if (!p.retired) lines.push(`OVR ${st.ovr0} → ${ovr(p)}.`);
    for (const t of g.career.timeline.slice(st.tl0)) if (['trophy', 'award', 'transfer', 'contract', 'intl', 'record', 'retire'].includes(t.type)) lines.push(t.txt);
    const bh = (g.career.bdoHist ?? []).slice(-(Math.max(0, w.season - st.season0) + 1)).filter((b) => b.s >= st.season0);
    if (bh.length) lines.push(`Ballon d'Or: ${bh.map((b) => `${seasonLabel(b.s)} ${b.rank ? `#${b.rank}` : 'outside the top 30'}`).join(', ')}.`);
  }
  if (st.clubs.length > 1) lines.push(`Clubs: ${st.clubs.filter(Boolean).map((id) => w.clubs[id]?.name ?? id).join(' → ')}.`);
  return { from: seasonLabel(st.season0), to: `${seasonLabel(w.season)} · ${fmtDate(w, w.day, true)}`, days: w.abs - st.startAbs, stopped: st.stopped, lines: lines.slice(0, 40) };
}

/** Run the whole thing synchronously (tests). */
export function longSimRun(g: Game, opts: LongSimOpts, guardChunks = 200000): LongSimReport {
  const st = longSimStart(g, opts);
  for (let i = 0; i < guardChunks && longSimChunk(g, st); i++) { /* keep going */ }
  return longSimReport(g, st);
}
