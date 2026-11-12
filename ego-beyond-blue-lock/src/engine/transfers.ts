/**
 * Transfers and contracts: the AI market, NEL signings, offers to the user with negotiation,
 * loans, contract expiry and managerial changes. Player identity (permanent id, history,
 * relationships) is always preserved across moves.
 * Units: transfer fees / market values in EUR, wages in EUR per week.
 */
import type { Club, Game, Offer, Player, Pos, SquadRole, Transfer, World } from './types';
import { ovr, POS_LINE, fitAt } from './attributes';
import { clamp, mixSeed, Rng } from './rng';
import { rngOf, marketValue, wageFor, addToClub, assignNumbers, makeManager, fillSquad, finalizeSquad, signContract } from './worldgen';
import { STYLES_TAC } from './data/clubs';
import { S } from './match/model';
import { addNews, fmtEur, fmtWage, milestone, tacticalFit, log, YEN_PER_EUR } from './util';
import { relOf, remember, adjust } from './relationships';
import { fmtDate, seasonLabel, windowOpen } from './competitions';

export const levelOf = (c: Club) => 38 + c.rep * 0.5;

export function archiveStats(g: Game, p: Player, compId: string, clubId: string): void {
  const w = g.world;
  const l = p.ss[compId];
  if (!l || !l[S.APP]) { delete p.ss[compId]; return; }
  const comp = w.comps[compId];
  const club = w.clubs[clubId];
  p.hist.push({ s: w.season, club: clubId, clubName: club?.name ?? (comp?.natTeams ? p.nat : '—'), comp: compId, compName: comp?.name ?? compId, ap: l[S.APP], st: l[S.START], min: Math.round((comp?.rules === 'nel' ? l[S.PLAY] : l[S.SEC]) / 60), g: l[S.G], a: l[S.A], rt: l[S.RATN] ? Math.round((l[S.RAT] / l[S.RATN]) * 100) : 0, mom: l[S.POTM], cs: l[S.CS], yc: l[S.YC], rc: l[S.RC], ovr: ovr(p) });
  if (p.id === g.career.pid) g.career.statHist.push({ s: w.season, club: clubId, clubName: club?.name ?? p.nat, comp: compId, compName: comp?.name ?? compId, rules: comp?.rules ?? 'reg', line: l.slice() });
  if (p.hist.length > 60 && p.id !== g.career.pid) p.hist.splice(0, p.hist.length - 60);
  delete p.ss[compId];
}

function record(g: Game, p: Player, from: Club | null, to: Club | null, fee: number, type: Transfer['type'], wage?: number): Transfer {
  const w = g.world;
  const t: Transfer = { id: w.trId++, pid: p.id, name: p.name, from: from?.id ?? null, fromName: from?.name ?? (type === 'youth' ? 'Youth intake' : 'Free agent'), to: to?.id ?? null, toName: to?.name ?? (type === 'retire' ? 'Retired' : 'Released'), fee, type, s: w.season, day: w.day, wage, ovr: ovr(p) };
  w.transfers.push(t);
  if (w.transfers.length > 2500) w.transfers = w.transfers.filter((x, i) => i > 500 || x.pid === g.career.pid || x.fee >= 30e6);
  return t;
}

/** Core move. Keeps the same Player object (same id, stats history, relationships). */
export function doTransfer(g: Game, p: Player, to: Club, fee: number, type: Transfer['type'], o: { wage?: number; years?: number; role?: SquadRole; loanFrom?: string; quiet?: boolean } = {}): Transfer {
  const w = g.world;
  const from = p.club ? w.clubs[p.club] ?? null : null;
  if (from && from.league && to.league !== from.league && p.ss[from.league]) archiveStats(g, p, from.league, from.id);
  addToClub(w, p, to);
  if (type === 'loan') {
    const parentCon = p.con;
    p.con = { club: to.id, wage: parentCon?.wage ?? wageFor(ovr(p), to.rep), from: w.season, until: parentCon?.until ?? w.season + 1, role: o.role ?? 'key', loanFrom: o.loanFrom ?? from?.id };
    (p as Player & { parentCon?: unknown }).parentCon = parentCon;
  } else if (type !== 'loanEnd') {
    signContract(w, p, to, o.role, o.years, o.wage);
  }
  p.lastMove = w.abs;
  p.morale = clamp(p.morale + 8, 0, 100);
  if (fee > 0) { to.budget -= fee; if (from) from.budget += fee * 0.9; }
  if (!p.num || to.squad.some((id) => id !== p.id && w.players[id]?.num === p.num)) assignNumbers(w, to, p.id === g.career.pid ? undefined : undefined);
  const t = record(g, p, from, to, fee, type, p.con?.wage);
  if (!o.quiet) {
    const big = fee >= 40e6 || p.origin === 'bluelock' || p.origin === 'master' || p.rep >= 85 || !!g.career.rel[p.id];
    if (big && p.id !== g.career.pid) {
      const rel = g.career.rel[p.id];
      addNews(g, 'transfer', `${p.name} ${type === 'loan' ? 'joins' : 'signs for'} ${to.name}${type === 'loan' ? ' on loan' : ''}`, `${from ? `From ${from.name}` : 'A free transfer'}${fee > 0 ? ` for ${fmtEur(fee)}` : ''}. ${p.name} (${ovr(p)} OVR, age ${w.season - p.born})${rel ? ' — someone you know well.' : '.'}`, { imp: fee >= 80e6 || rel ? 2 : 1, pids: [p.id], clubs: [to.id] });
      if (rel) {
        const mine = w.players[g.career.pid].club;
        if (to.id === mine) { remember(g, p.id, 'reunion', `${p.sn} joined you at ${to.name}.`, 1); g.career.flags['reunion:' + p.id] = w.abs; }
        else if (from?.id === mine) remember(g, p.id, 'left', `${p.sn} left ${from!.name} for ${to.name}.`, 0);
      }
    }
  }
  return t;
}

export function release(g: Game, p: Player, retire = false): void {
  const w = g.world;
  const from = p.club ? w.clubs[p.club] : null;
  if (from) from.squad = from.squad.filter((x) => x !== p.id);
  p.club = null; p.con = null;
  if (retire) p.retired = w.season; else if (!w.free.includes(p.id)) w.free.push(p.id);
  record(g, p, from ?? null, null, 0, retire ? 'retire' : 'release');
}

function inContinental(w: World, clubId: string): string {
  if (w.comps.ucl?.teams.includes(clubId)) return 'Champions League';
  if (w.comps.uel?.teams.includes(clubId)) return 'Europa League';
  return 'None this season';
}
function rivalsAt(w: World, c: Club, pos: Pos): Player[] {
  return c.squad.map((id) => w.players[id]).filter((q) => q && (q.pos === pos || q.pos2.includes(pos))).sort((a, b) => ovr(b) - ovr(a));
}
export function roleAt(g: Game, p: Player, c: Club): SquadRole {
  const w = g.world;
  const o = ovr(p);
  const all = c.squad.map((id) => w.players[id]).filter(Boolean).map(ovr).sort((a, b) => b - a);
  const better = all.filter((x) => x > o).length;
  const samePos = rivalsAt(w, c, p.pos).filter((q) => q.id !== p.id && ovr(q) >= o).length;
  const young = w.season - p.born <= 21;
  if (better <= 1 && samePos === 0) return 'star';
  if (better <= 9 && samePos <= 1) return 'key';
  if (better <= 17 && samePos <= 2) return 'rotation';
  return young ? (o >= levelOf(c) - 7 ? 'prospect' : 'development') : 'rotation';
}
const ROLE_MIN: Record<SquadRole, string> = { star: 'Guaranteed starter — the team is built around you', key: 'Regular starter', rotation: 'Rotation: roughly half the matches', prospect: 'Occasional appearances, cups and late substitutions', development: 'Development squad: first-team football only if you force your way in' };
export const ROLE_NAME: Record<SquadRole, string> = { star: 'Star Player', key: 'Key Player', rotation: 'Rotation', prospect: 'Prospect', development: 'Development Squad' };

export function buildOffer(g: Game, c: Club, kind: Offer['kind'], interest: number, o: { fee?: number; role?: SquadRole; route?: string; note?: string; deadline?: number; loanParent?: string; years?: number } = {}): Offer {
  const w = g.world;
  const p = w.players[g.career.pid];
  const my = ovr(p);
  const role = o.role ?? roleAt(g, p, c);
  const roleMul = role === 'star' ? 1.35 : role === 'key' ? 1.1 : role === 'rotation' ? 0.9 : role === 'prospect' ? 0.65 : 0.5;
  const wage = Math.round((wageFor(my, c.rep) * roleMul * (0.92 + interest / 600)) / 100) * 100;
  const comp = w.comps[c.league ?? ''];
  const rivals = rivalsAt(w, c, p.pos).filter((q) => q.id !== p.id).slice(0, 4).map((q) => ({ name: q.name, pos: q.pos, ovr: ovr(q), age: w.season - q.born }));
  const minutesScore = role === 'star' ? 10 : role === 'key' ? 9 : role === 'rotation' ? 6 : role === 'prospect' ? 3.5 : 2;
  const devScore = Math.round((c.fac * 0.45 + (c.mgr.rep / 10) * 0.2 + minutesScore * 0.35) * 10) / 10;
  const fit = tacticalFit(p, c.style);
  const st = STYLES_TAC[c.style];
  return {
    id: g.career.nextOffer++, club: c.id, clubName: c.name, league: c.league ?? '', leagueName: comp?.name ?? 'Unattached', kind, role,
    wage, years: o.years ?? (kind === 'loan' ? 1 : role === 'star' ? 4 : role === 'development' ? 3 : 3), fee: o.fee ?? 0,
    signOn: kind === 'loan' ? 0 : Math.round((wage * (role === 'star' ? 30 : 12)) / 1000) * 1000, goalBonus: POS_LINE[p.pos] >= 2 ? Math.round((wage * 0.12) / 100) * 100 : 0, appBonus: Math.round((wage * 0.05) / 100) * 100, clause: 0,
    managerRole: `${c.mgr.name} sees you as a ${p.pos} in a ${c.tac.form} playing ${st?.name ?? c.style} football. Tactical fit: ${fit >= 1 ? 'excellent' : fit >= 0 ? 'good' : fit >= -1 ? 'workable' : 'awkward'}.`,
    position: p.pos, competition: rivals, continental: inContinental(w, c.id), dev: `Facilities ${c.fac}/10, coaching ${Math.round(c.mgr.rep / 10)}/10, minutes ${ROLE_MIN[role].toLowerCase()}`, devScore,
    minutes: ROLE_MIN[role], route: o.route, deadline: o.deadline ?? w.abs + 14, status: 'open', interest: clamp(Math.round(interest), 1, 100), talks: 0, note: o.note, loanParent: o.loanParent,
  };
}

// ───────────────────────────── NEL → professional football ─────────────────────────────

/** Every NEL youngster (except the user) signs a first professional contract, following the bids. */
export function signNelPlayers(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  for (const tid of w.nel.teams) {
    const team = w.clubs[tid];
    for (const id of [...team.squad]) {
      if (id === g.career.pid) continue;
      const p = w.players[id];
      if (!p) continue;
      const b = w.nel.bids[id];
      let dest: Club | undefined = b?.topClub ? w.clubs[b.topClub] : undefined;
      // foreign youth are attached to their parent club and usually stay
      if (p.origin === 'nelyouth' && team.parent && (!dest || rng.chance(0.7))) dest = w.clubs[team.parent];
      if (!dest) {
        const o = ovr(p);
        const list = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && Math.abs(levelOf(c) - o) <= 4);
        dest = list.length ? rng.pick(list) : w.clubs[team.parent!];
      }
      const wage = b?.top ? Math.round(b.top / YEN_PER_EUR / 52 / 100) * 100 : undefined;
      const tr = doTransfer(g, p, dest, 0, 'nel', { wage, years: 3 + rng.int(3), role: undefined, quiet: true });
      p.con!.role = w.season - p.born <= 20 && ovr(p) < levelOf(dest) - 6 ? 'prospect' : ovr(p) >= levelOf(dest) + 3 ? 'key' : 'rotation';
      tr.fromName = team.name + ' (NEL)';
    }
  }
  const stars = Object.values(w.nel.bids).sort((a, b) => b.top - a.top).slice(0, 8).map((b) => w.players[b.pid]).filter((p) => p && p.id !== g.career.pid && p.club);
  addNews(g, 'transfer', 'NEL class of the year signs professional terms', stars.map((p) => `${p.name} → ${w.clubs[p.club!].name}`).join('; ') + '.', { imp: 2, pids: stars.map((p) => p.id) });
}

/** Career routes offered to the user at the end of the NEL. There is always at least one. */
export function makeNelOffers(g: Game): void {
  const w = g.world;
  const p = w.players[g.career.pid];
  const o = ovr(p);
  const b = w.nel.bids[p.id];
  const deadline = 62;
  const offers: Offer[] = [];
  const seen = new Set<string>();
  const add = (c: Club | undefined, interest: number, route: string, opt: Partial<Parameters<typeof buildOffer>[4]> = {}) => {
    if (!c || seen.has(c.id) || c.nel || c.dormant) return;
    seen.add(c.id);
    offers.push(buildOffer(g, c, 'nel', interest, { route, deadline, ...opt }));
  };
  const clubs = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant);
  const pick = (list: Club[], salt: string) => (list.length ? list[mixSeed(w.seed, 'nelroute', salt) % list.length] : undefined);
  // 1. the clubs that actually bid
  for (const bid of (b?.bids ?? []).slice(0, 3)) {
    const c = w.clubs[bid.club];
    if (!c) continue;
    const role = roleAt(g, p, c);
    add(c, 60 + Math.min(35, bid.amt / 1e7), role === 'development' || role === 'prospect' ? 'Major club — development squad' : role === 'rotation' ? 'Major club — first-team squad' : 'Major club — first team immediately', { note: `Backed by a ${Math.round(bid.amt / 1e6)}M yen NEL bid.` });
    if ((role === 'development' || role === 'prospect') && offers.length) {
      const loanTo = pick(clubs.filter((x) => x.league === c.league && x.id !== c.id && Math.abs(levelOf(x) - o) <= 3), 'loan' + c.id) ?? pick(clubs.filter((x) => Math.abs(levelOf(x) - o) <= 2 && x.tier <= 2), 'loan2' + c.id);
      if (loanTo && !seen.has(loanTo.id)) { seen.add(loanTo.id); offers.push(buildOffer(g, loanTo, 'nel', 55, { route: `Sign for ${c.sn}, season on loan`, deadline, loanParent: c.id, role: 'key', years: 1, note: `You would be contracted to ${c.name} and loaned to ${loanTo.name} for the season.` })); }
    }
  }
  // 2. a smaller top-flight club where you would start
  add(pick(clubs.filter((c) => c.tier === 1 && levelOf(c) <= o + 1 && levelOf(c) >= o - 5), 'small'), 55 + (o - 70), 'Smaller first-team club — guaranteed minutes');
  // 3. lower divisions for minutes
  add(pick(clubs.filter((c) => c.league === 'eng2' && levelOf(c) <= o + 2), 'champ'), 50, 'Second tier — play every week');
  if (offers.length < 3 || o < 72) add(pick(clubs.filter((c) => c.league === 'eng3' && levelOf(c) <= o + 4), 'l1'), 45, 'Third tier — earn your minutes');
  // 4. the guaranteed floor: a poor NEL limits offers, but the career always continues
  if (!offers.length) {
    add(pick(clubs.filter((c) => c.league === 'eng3'), 'floor'), 30, 'Trial contract — limited interest after the NEL', { note: 'After a difficult NEL this was the only concrete offer. It is still a professional contract.' });
    if (offers.length) { offers[0].years = 1; }
  }
  if (b?.top && offers.length) for (const of of offers) if (of.route?.startsWith('Major')) of.wage = Math.max(of.wage, Math.round((b.top / YEN_PER_EUR / 52) * (of.role === 'development' ? 0.5 : 0.8) / 100) * 100);
  g.career.offers.push(...offers);
  addNews(g, 'career', `${offers.length} professional route${offers.length === 1 ? '' : 's'} on the table`, `Your agent has ${offers.length} contract${offers.length === 1 ? '' : 's'} for you to consider: ${offers.map((x) => `${x.clubName} (${ROLE_NAME[x.role]})`).join(', ')}. Decide before ${fmtDate(w, deadline)}.`, { imp: 3, me: true });
}

// ───────────────────────────── the user's offers ─────────────────────────────

export function openOffers(g: Game): Offer[] { return g.career.offers.filter((o) => o.status === 'open'); }

export function acceptOffer(g: Game, id: number): string {
  const w = g.world;
  const of = g.career.offers.find((x) => x.id === id);
  if (!of || of.status !== 'open') return 'That offer is no longer available.';
  const p = w.players[g.career.pid];
  const club = w.clubs[of.club];
  if (!club) return 'That club no longer exists.';
  const old = p.club ? w.clubs[p.club] : null;
  if (of.kind === 'renewal') {
    p.con = { club: club.id, wage: of.wage, from: w.season, until: w.season + of.years - 1, role: of.role, clause: of.clause || undefined, goalBonus: of.goalBonus, appBonus: of.appBonus };
    g.career.promise = { role: of.role, club: club.id };
    of.status = 'accepted';
    milestone(g, 'contract', `Signed a new ${of.years}-year contract at ${club.name} (${fmtWage(of.wage)}).`);
    addNews(g, 'career', `New contract at ${club.name}`, `${of.years} years, ${fmtWage(of.wage)}, role: ${ROLE_NAME[of.role]}.`, { imp: 2, me: true });
    return `You have signed a new contract with ${club.name}.`;
  }
  // archive current-season league stats under the old club before moving
  if (old && old.league && club.league !== old.league) archiveStats(g, p, old.league, old.id);
  if (of.loanParent && w.clubs[of.loanParent]) {
    const parent = w.clubs[of.loanParent];
    doTransfer(g, p, parent, 0, of.kind === 'nel' ? 'nel' : 'transfer', { wage: of.wage, years: 4, role: 'prospect', quiet: true });
    doTransfer(g, p, club, 0, 'loan', { role: of.role, loanFrom: parent.id, quiet: true });
  } else if (of.kind === 'loan') {
    doTransfer(g, p, club, 0, 'loan', { role: of.role, loanFrom: old?.id, quiet: true });
  } else {
    doTransfer(g, p, club, of.fee, of.kind === 'nel' ? 'nel' : of.kind === 'free' ? 'free' : 'transfer', { wage: of.wage, years: of.years, role: of.role, quiet: true });
    p.con!.until = w.season + of.years - 1 + (w.phase === 'nel' ? 0 : w.day > 300 ? 1 : 0);
    p.con!.clause = of.clause || undefined; p.con!.goalBonus = of.goalBonus; p.con!.appBonus = of.appBonus; p.con!.signOn = of.signOn;
    g.career.wages += of.signOn;
  }
  of.status = 'accepted';
  for (const x of g.career.offers) if (x.status === 'open') x.status = 'expired';
  g.career.promise = { role: of.role, club: club.id };
  g.career.mgrTrust = of.role === 'star' ? 68 : of.role === 'key' ? 60 : of.role === 'rotation' ? 50 : 42;
  g.career.flags.wantOut = 0;
  g.career.flags.mustMove = 0;
  if (of.kind === 'nel') g.career.nelRoute = of.route;
  for (const tid of club.squad) if (tid !== p.id) relOf(g, tid);
  relOf(g, club.mgr.id);
  if (old && !old.nel) for (const tid of old.squad) { const r = g.career.rel[tid]; if (r && r.friend >= 50) remember(g, tid, 'left_behind', `You left ${old.name} for ${club.name}.`, 0); }
  assignNumbers(w, club, p.id);
  const loanTxt = of.loanParent ? ` (contracted to ${w.clubs[of.loanParent].name})` : of.kind === 'loan' ? ' on loan' : '';
  milestone(g, 'transfer', `Joined ${club.name}${loanTxt}${of.fee > 0 ? ` for ${fmtEur(of.fee)}` : ''} as ${ROLE_NAME[of.role]} — ${fmtWage(of.wage)}, ${of.years} year${of.years > 1 ? 's' : ''}.`);
  addNews(g, 'transfer', `${p.name} ${of.kind === 'loan' || of.loanParent ? 'joins' : 'signs for'} ${club.name}${loanTxt}`, `${of.fee > 0 ? `Fee: ${fmtEur(of.fee)}. ` : ''}Role: ${ROLE_NAME[of.role]}. ${of.managerRole}`, { imp: 3, me: true, clubs: [club.id] });
  g.career.flags.bigMove = w.abs;
  return `Welcome to ${club.name}.`;
}

export function rejectOffer(g: Game, id: number): void {
  const of = g.career.offers.find((x) => x.id === id);
  if (of && of.status === 'open') of.status = 'rejected';
}

export const NEGOTIATE = [
  { id: 'wage', label: 'Ask for a higher wage (+12%)' },
  { id: 'role', label: 'Ask for a bigger squad role' },
  { id: 'clause', label: 'Ask for a release clause' },
  { id: 'short', label: 'Ask for a shorter contract' },
  { id: 'bonus', label: 'Ask for better bonuses' },
];
/** One negotiation round. Success depends on how keen the club is; pushing too far loses the offer. */
export function negotiate(g: Game, id: number, what: string): string {
  const w = g.world;
  const of = g.career.offers.find((x) => x.id === id);
  if (!of || of.status !== 'open') return 'That offer is no longer available.';
  if (of.talks >= 3) return `${of.clubName} say this is their final offer.`;
  const rng = rngOf(w);
  const hard = what === 'role' ? 0.22 : what === 'wage' ? 0.1 : 0.05;
  const p = clamp(0.3 + (of.interest / 100) * 0.6 - of.talks * 0.17 - hard, 0.05, 0.92);
  of.talks++;
  if (rng.next() < p) {
    const me = w.players[g.career.pid];
    if (what === 'wage') of.wage = Math.round((of.wage * 1.12) / 100) * 100;
    else if (what === 'role') { const order: SquadRole[] = ['development', 'prospect', 'rotation', 'key', 'star']; const i = order.indexOf(of.role); if (i >= order.length - 1) return 'You already have the top role.'; of.role = order[i + 1]; of.minutes = ROLE_MIN[of.role]; }
    else if (what === 'clause') of.clause = Math.round((marketValue(me, w.season) * 1.6) / 1e5) * 1e5;
    else if (what === 'short') of.years = Math.max(1, of.years - 1);
    else if (what === 'bonus') { of.goalBonus = Math.round(of.goalBonus * 1.5 + 500); of.appBonus = Math.round(of.appBonus * 1.5 + 200); of.signOn = Math.round(of.signOn * 1.25); }
    of.interest = Math.max(5, of.interest - 6);
    return `${of.clubName} agree.`;
  }
  of.interest -= 16;
  if (of.interest < 18 || (of.talks >= 3 && rng.chance(0.3))) { of.status = 'withdrawn'; addNews(g, 'career', `${of.clubName} withdraw their offer`, 'Talks broke down over your demands.', { imp: 2, me: true }); return `${of.clubName} have walked away from the negotiation.`; }
  return `${of.clubName} refuse — and their patience is thinner now.`;
}

export function expireOffers(g: Game): void {
  for (const of of g.career.offers) if (of.status === 'open' && g.world.abs > of.deadline) of.status = 'expired';
  if (g.career.offers.length > 60) g.career.offers.splice(0, g.career.offers.length - 60);
}

function seasonForm(g: Game): { avg: number; ga: number; apps: number } {
  const p = g.world.players[g.career.pid];
  let r = 0, n = 0, ga = 0, apps = 0;
  for (const c in p.ss) { const l = p.ss[c]; r += l[S.RAT]; n += l[S.RATN]; ga += l[S.G] + l[S.A]; apps += l[S.APP]; }
  return { avg: n ? r / n : 0, ga, apps };
}

/** Weekly during transfer windows: interested clubs approach. Called from the day loop. */
export function generateUserOffers(g: Game): void {
  const w = g.world;
  if (w.phase !== 'pro' || !windowOpen(w)) return;
  const p = w.players[g.career.pid];
  if (!p || p.retired) return;
  if (openOffers(g).length >= 3) return;
  const rng = rngOf(w);
  const my = ovr(p);
  const cur = p.club ? w.clubs[p.club] : null;
  const f = seasonForm(g);
  const onLoan = !!p.con?.loanFrom;
  if (onLoan) return;
  const perf = f.apps >= 5 ? (f.avg - 6.6) * 10 : 0;
  const expiring = !!p.con && p.con.until <= w.season && w.day >= 150;
  const wantOut = Number(g.career.flags.wantOut ?? 0) > 0;
  const free = !cur;
  const recently = Number(g.career.flags.bigMove ?? -999) > w.abs - 120;
  if (recently && !free) return;
  let chance = 0.1 + perf * 0.012 + (p.rep - 40) * 0.002 + (expiring ? 0.25 : 0) + (wantOut ? 0.3 : 0) + (free ? 0.6 : 0);
  if (p.con && (p.con.role === 'development' || p.con.role === 'prospect')) chance += 0.12;
  if (rng.next() > chance) return;
  const cands = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.id !== cur?.id && c.league && my >= levelOf(c) - 9 && my <= levelOf(c) + 14);
  if (!cands.length) return;
  const scored = cands.map((c) => {
    const lvl = levelOf(c);
    const need = rivalsAt(w, c, p.pos).filter((q) => ovr(q) >= my).length;
    let s = 50 + perf * 1.5 + (my - lvl) * 3 + (p.pot - my) * (w.season - p.born <= 23 ? 1.2 : 0) - need * 8 + tacticalFit(p, c.style) * 3 + (p.rep - 50) * 0.2 + rng.normal() * 9;
    if (cur && c.rep < cur.rep - 12 && !wantOut && !expiring) s -= 25;
    return { c, s };
  }).sort((a, b) => b.s - a.s);
  const pickN = rng.chance(0.3) ? 2 : 1;
  for (const { c, s } of scored.slice(0, pickN)) {
    if (s < 42) continue;
    const role = roleAt(g, p, c);
    const loan = !free && !expiring && (p.con?.role === 'development' || p.con?.role === 'prospect') && c.rep < (cur?.rep ?? 0) && (role === 'key' || role === 'star');
    if (loan) {
      g.career.offers.push(buildOffer(g, c, 'loan', s, { role, deadline: w.abs + 12, note: `${cur!.name} are willing to let you go on loan for regular football.` }));
      addNews(g, 'career', `${c.name} want you on loan`, `They can offer what ${cur!.name} cannot right now: minutes.`, { imp: 2, me: true, clubs: [c.id] });
      continue;
    }
    if (free || expiring) {
      g.career.offers.push(buildOffer(g, c, 'free', s, { role, deadline: w.abs + 16, note: free ? 'You are a free agent.' : 'A pre-contract: your current deal is expiring.' }));
      addNews(g, 'career', `${c.name} offer you a contract`, `Role: ${ROLE_NAME[role]}.`, { imp: 2, me: true, clubs: [c.id] });
      continue;
    }
    // under contract: the clubs must agree a fee first
    const value = marketValue(p, w.season);
    const bid = Math.round((value * (0.85 + rng.next() * 0.5 + s / 400)) / 1e5) * 1e5;
    const keep = p.con!.role === 'star' ? 1.5 : p.con!.role === 'key' ? 1.25 : p.con!.role === 'rotation' ? 1.0 : 0.85;
    const clause = p.con!.clause && bid >= p.con!.clause;
    const accept = clause || wantOut ? bid >= value * 0.8 : bid >= value * keep;
    if (c.budget < bid) continue;
    if (accept) {
      g.career.offers.push(buildOffer(g, c, 'transfer', s, { role, fee: clause ? p.con!.clause! : bid, deadline: w.abs + 12, note: clause ? 'Your release clause has been met.' : `${cur!.name} have accepted a bid of ${fmtEur(bid)}.` }));
      addNews(g, 'career', `${cur!.name} accept ${fmtEur(bid)} bid from ${c.name}`, `It is now your decision. Role on offer: ${ROLE_NAME[role]}.`, { imp: 3, me: true, clubs: [c.id] });
    } else {
      addNews(g, 'career', `${cur!.name} reject ${fmtEur(bid)} bid from ${c.name}`, `Your club value you higher${p.con!.role === 'star' || p.con!.role === 'key' ? ' and consider you too important to sell' : ''}. You could force the issue by asking to leave.`, { imp: 2, me: true, clubs: [c.id] });
      g.career.flags.rejectedBid = c.id;
      g.career.flags.rejectedBidAbs = w.abs;
    }
  }
}

/** Current club's renewal / improved terms when you are performing or the deal is running down. */
export function renewalCheck(g: Game): void {
  const w = g.world;
  const p = w.players[g.career.pid];
  if (w.phase !== 'pro' || !p.club || !p.con || p.con.loanFrom) return;
  const c = w.clubs[p.club];
  if (g.career.offers.some((o) => o.kind === 'renewal' && o.status === 'open')) return;
  const role = roleAt(g, p, c);
  const order: SquadRole[] = ['development', 'prospect', 'rotation', 'key', 'star'];
  const better = order.indexOf(role) > order.indexOf(p.con.role);
  const expiring = p.con.until <= w.season && w.day >= 120;
  if (!(better || expiring)) return;
  if (Number(g.career.flags.renewAbs ?? -999) > w.abs - 90) return;
  if (expiring && ovr(p) < levelOf(c) - 8 && w.season - p.born > 23) return; // the club lets you go
  g.career.flags.renewAbs = w.abs;
  g.career.offers.push(buildOffer(g, c, 'renewal', 60 + (order.indexOf(role) - order.indexOf(p.con.role)) * 10, { role, deadline: w.abs + 30, note: better ? 'Your performances have earned improved terms.' : 'Your contract is running down.' }));
  addNews(g, 'career', `${c.name} offer you a new contract`, `Proposed role: ${ROLE_NAME[role]}.`, { imp: 2, me: true });
}

// ───────────────────────────── AI market ─────────────────────────────

/** One day of AI transfer business. Clubs fix their weakest position within budget. */
export function aiTransferDay(g: Game, intensity = 1): number {
  const w = g.world;
  const rng = rngOf(w);
  const clubs = rng.shuffle(Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.league));
  const pool = Object.values(w.players).filter((p) => p.club && !p.retired && p.id !== g.career.pid && w.clubs[p.club] && !w.clubs[p.club].nel && (p.lastMove ?? -999) < w.abs - 150 && !p.con?.loanFrom);
  let deals = 0;
  for (const c of clubs) {
    if (rng.next() > 0.07 * intensity || c.squad.length >= 29) continue;
    const lvl = levelOf(c);
    // weakest slot relative to the club's level
    const need: Record<string, number> = {};
    for (const pos of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as Pos[]) {
      const best = c.squad.map((id) => w.players[id]).filter((q) => q && q.inj < 60).map((q) => fitAt(q, pos)).sort((a, b) => b - a);
      need[pos] = lvl - (best[0] ?? 40) + (lvl - (best[1] ?? 40)) * (pos === 'CB' || pos === 'CM' || pos === 'ST' ? 0.5 : 0.2);
    }
    const pos = (Object.keys(need) as Pos[]).sort((a, b) => need[b] - need[a])[rng.int(2)];
    let best: Player | null = null, bs = -1e9;
    for (let k = 0; k < 60; k++) {
      const q = pool[rng.int(pool.length)];
      if (!q || q.club === c.id || q.pos !== pos || q.retired) continue;
      const qo = ovr(q);
      const sc = w.clubs[q.club!];
      if (!sc || qo < lvl - 3 || qo > lvl + 7) continue;
      const val = marketValue(q, w.season);
      if (val * 1.15 > c.budget) continue;
      if (sc.rep > c.rep + 4 && (q.con?.role === 'star' || q.con?.role === 'key')) continue;
      if (sc.squad.length <= 19) continue;
      const s = qo + Math.max(0, q.pot - qo) * (w.season - q.born <= 23 ? 0.5 : 0) - (w.season - q.born > 30 ? 3 : 0) + rng.normal() * 2;
      if (s > bs) { bs = s; best = q; }
    }
    if (!best) continue;
    const fee = Math.round((marketValue(best, w.season) * (1 + rng.next() * 0.3)) / 1e5) * 1e5;
    doTransfer(g, best, c, fee, 'transfer');
    best.con!.role = roleAt(g, best, c);
    deals++;
  }
  // free agents find clubs
  for (const id of [...w.free]) {
    const p = w.players[id];
    if (!p || p.retired || id === g.career.pid) continue;
    if (rng.next() > 0.12) continue;
    const o = ovr(p);
    const dest = clubs.find((c) => c.squad.length < 26 && Math.abs(levelOf(c) - o) <= 5);
    if (dest) { doTransfer(g, p, dest, 0, 'free', { quiet: p.rep < 75 }); p.con!.role = roleAt(g, p, dest); deals++; }
  }
  return deals;
}

/** Summer: big clubs loan out youngsters who are far from the first team. */
export function aiLoans(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  const clubs = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.league);
  for (const c of clubs) {
    if (c.rep < 78 || c.squad.length < 24) continue;
    const lvl = levelOf(c);
    for (const id of [...c.squad]) {
      const p = w.players[id];
      if (!p || id === g.career.pid || p.con?.loanFrom || w.season - p.born > 21 || ovr(p) > lvl - 7 || rng.next() > 0.3 || c.squad.length <= 22) continue;
      const dest = rng.pick(clubs.filter((x) => x.id !== c.id && x.squad.length < 27 && Math.abs(levelOf(x) - ovr(p)) <= 3));
      if (dest) doTransfer(g, p, dest, 0, 'loan', { role: 'rotation', loanFrom: c.id });
    }
  }
}

/** Season end: loans return, expiring contracts are renewed or released. */
export function contractYearEnd(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  const me = g.career.pid;
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired || !p.con) continue;
    if (p.con.loanFrom) {
      const parent = w.clubs[p.con.loanFrom];
      const pc = (p as Player & { parentCon?: Player['con'] }).parentCon ?? null;
      if (parent) {
        addToClub(w, p, parent);
        p.con = pc && pc.club === parent.id ? pc : { club: parent.id, wage: p.con.wage, from: w.season, until: w.season + 2, role: 'rotation' };
        delete (p as Player & { parentCon?: unknown }).parentCon;
        record(g, p, w.clubs[p.con.club] ?? null, parent, 0, 'loanEnd');
        if (id === me) { addNews(g, 'career', `Loan over: you return to ${parent.name}`, 'Your parent club will reassess your role for next season.', { imp: 2, me: true }); g.career.mgrTrust = 50; g.career.promise = undefined; }
      }
      continue;
    }
    if (p.con.until > w.season) continue;
    const c = w.clubs[p.con.club];
    if (!c) { p.con = null; continue; }
    if (id === me) continue; // the user's expiry is handled by offers / free agency
    const o = ovr(p), ag = w.season - p.born;
    const keep = o >= levelOf(c) - 6 || (ag <= 23 && p.pot >= levelOf(c)) || c.squad.length <= 21;
    if (keep && rng.next() < 0.85) { p.con.until = w.season + 1 + rng.int(3); p.con.wage = wageFor(o, c.rep); }
    else release(g, p);
  }
  // the user
  const p = w.players[me];
  if (p.con && !p.con.loanFrom && p.con.until <= w.season && p.club) {
    const c = w.clubs[p.club];
    release(g, p);
    addNews(g, 'career', `Your contract at ${c.name} has expired`, 'You are a free agent. Clubs can sign you without a fee.', { imp: 3, me: true });
    milestone(g, 'contract', `Contract at ${c.name} expired — free agent.`);
    g.career.promise = undefined;
  }
}

/** Free-agent safety net: the user is never left without a way to continue the career. */
export function ensureUserHasOptions(g: Game): void {
  const w = g.world;
  const p = w.players[g.career.pid];
  if (p.club || p.retired) return;
  if (openOffers(g).length >= 2) return;
  const o = ovr(p);
  const clubs = Object.values(w.clubs).filter((c) => !c.nel && !c.dormant && c.league).sort((a, b) => Math.abs(levelOf(a) - o) - Math.abs(levelOf(b) - o));
  const have = new Set(openOffers(g).map((x) => x.club));
  let n = 0;
  for (const c of clubs) {
    if (have.has(c.id)) continue;
    g.career.offers.push(buildOffer(g, c, 'free', 50, { deadline: w.abs + 30, note: 'You are a free agent.' }));
    if (++n >= 3) break;
  }
  if (n) addNews(g, 'career', 'Free-agent offers arrive', 'Your agent has found clubs willing to sign you immediately.', { imp: 3, me: true });
}

/** Managers are judged against expectation at the end of the season (and at mid-season for disasters). */
export function managerChanges(g: Game, positions: Record<string, { pos: number; n: number; relegated: boolean }>, midSeason = false): void {
  const w = g.world;
  const rng = rngOf(w);
  for (const cid in positions) {
    const c = w.clubs[cid];
    if (!c || c.nel) continue;
    const { pos, relegated } = positions[cid];
    const under = pos - c.expect;
    const tenure = w.season - c.mgr.since;
    let p = midSeason ? (under >= 9 ? 0.35 : 0) : under >= 7 ? 0.7 : under >= 4 ? 0.3 : relegated ? 0.6 : tenure >= 6 ? 0.08 : 0.02;
    if (c.mgr.rep >= 90) p *= 0.6;
    if (rng.next() >= p) continue;
    const old = c.mgr;
    const styles = Object.keys(STYLES_TAC).filter((s) => !['rational', 'athletic', 'creative', 'strategic', 'dualace'].includes(s));
    const keepStyle = ['rational', 'athletic', 'creative', 'strategic', 'dualace'].includes(c.style) || rng.chance(0.4);
    const style = keepStyle ? c.style : rng.pick(styles);
    c.mgr = makeManager(w, rng, rng.chance(0.6) ? c.nat : rng.pick(['ESP', 'GER', 'ITA', 'POR', 'NED', 'FRA', 'ARG', 'ENG']), c.rep, style);
    c.mgr.since = w.season + (midSeason ? 0 : 1);
    if (!keepStyle) { c.style = style; const st = STYLES_TAC[style]; c.tac = { form: rng.pick(st.form), press: st.press, line: st.line, tempo: st.tempo, width: st.width, direct: st.direct }; }
    const mine = w.players[g.career.pid].club === cid;
    addNews(g, 'manager', `${c.name} sack ${old.name}`, `${c.name} finished ${under >= 4 ? `${under} places below expectation` : 'the season'} and have appointed ${c.mgr.name}${keepStyle ? '' : `, who will switch to ${STYLES_TAC[style].name.toLowerCase()} football`}.`, { imp: mine ? 3 : c.rep >= 82 ? 2 : 1, clubs: [cid], me: mine });
    if (mine) {
      g.career.mgrTrust = clamp(45 + (g.career.mgrTrust - 50) * 0.3, 0, 100);
      g.career.promise = undefined;
      g.career.flags.newManager = w.abs;
      relOf(g, c.mgr.id);
      adjust(g, c.mgr.id, { resp: (ovr(w.players[g.career.pid]) - levelOf(c)) * 1.5 });
    }
    log(w, 'manager', `${c.name}: ${old.name} -> ${c.mgr.name}`);
  }
}

/** Top up thin squads with youth so every club can always field a team. */
export function ensureSquads(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  for (const c of Object.values(w.clubs)) {
    if (c.nel || c.dormant || !c.league) continue;
    const gks = c.squad.filter((id) => w.players[id]?.pos === 'GK').length;
    if (c.squad.length < 21 || gks < 2) {
      const before = new Set(c.squad);
      fillSquad(w, rng, c, levelOf(c) - 4, 22, true);
      for (const id of c.squad) if (!before.has(id)) { const p = w.players[id]; p.origin = 'regen'; record(g, p, null, c, 0, 'youth'); }
      finalizeSquad(w, c);
    }
  }
}
export { seasonLabel, Rng };
