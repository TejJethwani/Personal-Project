/**
 * Rivalries as a storyline: they form from what happens on the pitch, keep a head-to-head record,
 * are fed by words (tunnel face-offs, interviews, press quotes) and pay off in development and reputation.
 */
import type { Game, Fixture, Player, UserMatch } from './types';
import type { MatchState } from './match/model';
import { S } from './match/model';
import { clamp, hashStr } from './rng';
import { adjust, relOf, remember } from './relationships';
import { addNews, milestone } from './util';
import { fmtDate, tableOf, compFixtures } from './competitions';
import { teamInfo, pickSheet, teamName } from './match/setup';
import { smartLine } from './data/banter2';
import { REPLIES, QUESTIONS, ANSWERS, type IvKind, type Tone } from './data/banter';
import { POS_LINE } from './attributes';

export { MAX_RIVALS } from './relationships';
import { MAX_RIVALS } from './relationships';
export interface H2H { w: number; d: number; l: number; mg: number; rg: number; dw: number; dl: number; n: number }
export function h2h(g: Game, id: string): H2H {
  const f = g.career.rel[id]?.flags ?? {};
  return { w: f.h2hW ?? 0, d: f.h2hD ?? 0, l: f.h2hL ?? 0, mg: f.h2hMG ?? 0, rg: f.h2hRG ?? 0, dw: f.duelW ?? 0, dl: f.duelL ?? 0, n: (f.h2hW ?? 0) + (f.h2hD ?? 0) + (f.h2hL ?? 0) };
}

/** After a match: rivalry heat, automatic rivalries, the head-to-head record and the duel verdict. */
export function afterMatchRivalry(g: Game, ms: MatchState): string[] {
  const u = ms.uc, c = g.career, w = g.world;
  const notes: string[] = [];
  if (!u) return notes;
  const me = ms.pl[u.idx];
  // older saves could hold more rivals than the cap: keep the hottest
  if (c.rivals.length > MAX_RIVALS) c.rivals = [...c.rivals].sort((x, y) => (c.rel[y]?.rival ?? 0) - (c.rel[x]?.rival ?? 0)).slice(0, MAX_RIVALS);
  if (!me.used) return notes;
  const myRat = me.s[S.RAT] || 6;
  const res = ms.winner === me.t ? 'W' : ms.winner === -1 ? 'D' : 'L';
  for (const q of ms.pl) {
    if (q.t === me.t || !q.used || Math.max(q.s[S.SEC], q.s[S.PLAY]) < 600) continue;
    const p = w.players[q.id];
    if (!p) continue;
    const hisRat = q.s[S.RAT] || 6;
    const declared = c.rivals.includes(q.id);
    const sameRole = Math.abs(q.line - me.line) <= 1 && q.line >= 2;
    // heat: two players deciding the same match, or two of the same kind measuring each other
    let heat = 0;
    if (q.s[S.G] > 0 && me.s[S.G] > 0) heat += 9;
    if (hisRat >= 7.4 && myRat >= 7.0) heat += 6;
    if (sameRole && (hisRat >= 7.0 || myRat >= 7.0)) heat += 4;
    if (q.s[S.POTM] || me.s[S.POTM]) heat += sameRole || q.line === 0 || me.line === 0 ? 2 : 1;
    if (me.line === 0 && q.s[S.G] > 0) heat += 3; // a keeper remembers who beats him
    if (q.line === 0 && me.s[S.G] > 0) heat += 3;
    if (!declared && !c.rel[q.id] && heat < 4) continue;
    const r = relOf(g, q.id);
    if (heat) adjust(g, q.id, { rival: Math.max(1, Math.round(heat * 0.75)) });
    if (!declared && r.rival >= 24 && c.rivals.length < MAX_RIVALS && p.rep >= w.players[c.pid].rep - 25 && (heat >= 8 || r.rival >= 38)) {
      c.rivals.push(q.id);
      remember(g, q.id, 'rival_declared', `A rivalry with ${p.sn} grew out of your matches.`, 1);
      milestone(g, 'rival', `A rivalry is born: ${p.name}.`);
      addNews(g, 'rivalry', `${w.players[c.pid].name} v ${p.name}: a rivalry is born`, `Every time they share a pitch something happens. The two will be measured against each other from now on.`, { imp: 2, me: true, pids: [q.id] });
      notes.push(`New rival: ${p.name}.`);
    }
    if (c.rivals.includes(q.id) || r.rival >= 25) {
      const f = r.flags;
      f[res === 'W' ? 'h2hW' : res === 'D' ? 'h2hD' : 'h2hL'] = (f[res === 'W' ? 'h2hW' : res === 'D' ? 'h2hD' : 'h2hL'] ?? 0) + 1;
      f.h2hMG = (f.h2hMG ?? 0) + me.s[S.G]; f.h2hRG = (f.h2hRG ?? 0) + q.s[S.G];
      // the full match record behind the head-to-head
      // what kind of match it was: league, cup, Europe, international, NEL — and whether it was a final or a title decider
      const fx = w.fixtures[ms.fid], comp = fx ? w.comps[fx.comp] : undefined;
      let decider = false;
      if (comp?.kind === 'league') { const tab = tableOf(w, comp.id); const left = compFixtures(w, comp.id).filter((f) => !f.played).length / Math.max(1, tab.length / 2); const top = tab.slice(0, 3).map((r) => r.id); decider = left <= 4 && top.includes(fx!.h) && top.includes(fx!.a); }
      (c.rivalLog ??= []).push({ kind: comp?.kind ?? 'friendly', stg: fx?.stg, decider, rid: q.id, fid: ms.fid, s: w.season, date: fmtDate(w, w.day), comp: ms.compName, my: ms.teams[me.t].name, his: ms.teams[q.t].name, sc: [ms.score[me.t], ms.score[q.t]], pens: ms.pens ? [ms.pens[me.t], ms.pens[q.t]] : undefined, res, mg: me.s[S.G], ma: me.s[S.A], hg: q.s[S.G], ha: q.s[S.A], mr: Math.round(myRat * 10) / 10, hr: Math.round(hisRat * 10) / 10, potm: me.s[S.POTM] ? 1 : q.s[S.POTM] ? 2 : 0, home: me.t === 0 });
      if (c.rivalLog.length > 400) c.rivalLog.shift();
      const won = myRat - hisRat >= 0.4, lost = hisRat - myRat >= 0.4;
      const dec = c.rivals.includes(q.id);
      if (won && !dec) f.duelW = (f.duelW ?? 0) + 1; else if (lost && !dec) f.duelL = (f.duelL ?? 0) + 1;
      if (won && dec) { f.duelW = (f.duelW ?? 0) + 1; const mp = w.players[c.pid]; mp.rep = clamp(mp.rep + 0.5, 0, 99); c.flags.duelBoost = (Number(c.flags.duelBoost ?? 0)) + 1; notes.push(`You won the duel with ${p.sn} (${myRat.toFixed(1)} v ${hisRat.toFixed(1)}): reputation up, extra development this week.`); }
      else if (lost && dec) { f.duelL = (f.duelL ?? 0) + 1; notes.push(`${p.sn} won the duel today (${hisRat.toFixed(1)} v ${myRat.toFixed(1)}).`); }
      if (dec && (won || lost)) addNews(g, 'rivalry', won ? `${w.players[c.pid].sn} gets the better of ${p.sn}` : `${p.sn} wins the latest duel with ${w.players[c.pid].sn}`, `Ratings ${myRat.toFixed(1)} v ${hisRat.toFixed(1)}. Head to head: ${f.duelW ?? 0}–${f.duelL ?? 0} in duels.`, { imp: 1, me: true, pids: [q.id] });
    }
  }
  delete c.flags.hype; delete c.flags.hypeFid;
  return notes;
}

export interface Faceoff { rival: Player; lines: string[]; h: H2H; replies: { tone: 'cold' | 'fire' | 'respect'; text: string }[] }
/** A declared rival in the opposing team: the tunnel scene before kick-off. */
export function faceoffFor(g: Game, fx: Fixture, side: string): Faceoff | null {
  const w = g.world, c = g.career;
  if (!c.rivals.length || c.flags.hypeFid === fx.id) return null;
  const opp = fx.h === side ? fx.a : fx.h;
  const comp = w.comps[fx.comp];
  const info = teamInfo(w, opp, !!comp?.u20);
  const sheet = pickSheet(null, w, info);
  const inXi = new Set(sheet.xi.map((x) => x.pid));
  const id = c.rivals.find((r) => inXi.has(r)) ?? c.rivals.find((r) => info.squad.includes(r));
  const p = id ? w.players[id] : null;
  if (!p) return null;
  const me = w.players[c.pid];
  const salt = hashStr(fx.id);
  const k = (n: number) => (salt + n) % 12;
  const hh = h2h(g, p.id);
  return {
    rival: p, h: h2h(g, p.id),
    lines: [smartLine(p, 'pre', { lead: 0, myGoals: 0, h2hDiff: hh.w - hh.l }, me.sn, info.name, w.season, salt), smartLine(p, 'press', { lead: 0, myGoals: 0, h2hDiff: hh.w - hh.l }, me.sn, info.name, w.season, salt + 3)],
    replies: [{ tone: 'cold', text: REPLIES.cold[k(1)] }, { tone: 'fire', text: REPLIES.fire[k(5)] }, { tone: 'respect', text: REPLIES.respect[k(9)] }],
  };
}
/** The user's answer in the tunnel. It changes the rivalry and how he starts the match. */
export function applyFaceoff(g: Game, fx: Fixture, rivalId: string, tone: 'cold' | 'fire' | 'respect'): string[] {
  const c = g.career;
  c.flags.hypeFid = fx.id; c.flags.hype = tone;
  const fxs = tone === 'fire' ? adjust(g, rivalId, { rival: 5, resp: -1 }) : tone === 'cold' ? adjust(g, rivalId, { rival: 3, resp: 1 }) : adjust(g, rivalId, { rival: 1, resp: 3, friend: 1 });
  if (tone === 'fire') c.image = clamp(c.image + 3, -100, 100);
  if (tone === 'respect') c.image = clamp(c.image - 2, -100, 100);
  fxs.push(tone === 'fire' ? 'You start the match with your Flow meter a third full — but he is fired up too' : tone === 'cold' ? 'You start composed: Flow meter a fifth full' : 'A calm start; the respect is mutual');
  return fxs;
}
/** Flow the user starts a match with after a tunnel exchange (read by the match setup). */
export function hypeFlow(g: Game, fid: string): number {
  const c = g.career;
  if (c.flags.hypeFid !== fid) return 0;
  return c.flags.hype === 'fire' ? 34 : c.flags.hype === 'cold' ? 20 : 8;
}

export interface Interview { kind: IvKind; question: string; rival: Player | null; result: 'W' | 'D' | 'L'; answers: { tone: Tone; text: string }[] }
/** A post-match interview is offered after rival matches, after results that matter and after very good or very bad nights. */
export function interviewFor(g: Game, um: UserMatch, ms: MatchState): Interview | null {
  const w = g.world, c = g.career;
  if (!um.line) return null;
  const me = ms.uc ? ms.pl[ms.uc.idx] : null;
  if (!me) return null;
  const rv = ms.pl.find((q) => q.t !== me.t && q.used && c.rivals.includes(q.id));
  const rival = rv ? w.players[rv.id] : null;
  const res = um.res, gd = um.sc[0] - um.sc[1];
  const star = um.rat >= 8 || um.line[S.G] >= 2 || um.potm, poor = um.rat > 0 && um.rat < 6.2;
  const kind: IvKind = rival ? (res === 'W' ? 'rivalWin' : res === 'L' ? 'rivalLoss' : 'rivalDraw')
    : star ? (res === 'W' ? 'starWin' : res === 'D' ? 'starDraw' : 'starLoss')
      : poor ? (res === 'W' ? 'poorWin' : 'poorLoss')
        : res === 'W' ? (gd >= 3 ? 'bigWin' : 'win') : res === 'D' ? 'draw' : gd <= -3 ? 'heavyLoss' : 'loss';
  const routine = kind === 'win' || kind === 'draw' || kind === 'loss';
  if (routine && hashStr(um.fid) % 4 !== 0) return null;
  const salt = hashStr(um.fid);
  const sc = `${um.sc[0]}–${um.sc[1]}`;
  const goals = um.line[S.G] === 1 ? 'One goal' : `${um.line[S.G]} goals`;
  const fill = (t: string) => t.replace(/\{r\}/g, rival?.sn ?? '').replace(/\{opp\}/g, um.oppName).replace(/\{sc\}/g, sc).replace(/\{g\}/g, goals);
  const q = QUESTIONS[kind];
  const set = ANSWERS[kind];
  return {
    kind, rival, result: res, question: fill(q[salt % q.length]),
    answers: (['humble', 'confident', 'ego'] as const).map((tone, i) => ({ tone, text: fill(set[tone][(salt + i * 3) % set[tone].length]) })),
  };
}
export function applyInterview(g: Game, iv: Interview, tone: 'humble' | 'confident' | 'ego'): string[] {
  const c = g.career, me = g.world.players[c.pid];
  const out: string[] = [];
  if (tone === 'humble') { const t = iv.result === 'L' ? 2.5 : 1.5; c.image = clamp(c.image - 5, -100, 100); c.mgrTrust = clamp(c.mgrTrust + t, 0, 100); out.push(`Coach trust +${t}`, 'Public image: more humble'); if (iv.rival) out.push(...adjust(g, iv.rival.id, { resp: 3, rival: -1 })); }
  else if (tone === 'confident') { const r = iv.result === 'W' ? 0.4 : 0.15; me.rep = clamp(me.rep + r, 0, 99); c.image = clamp(c.image + 1, -100, 100); out.push(`Reputation +${r}`); if (iv.result === 'L') { c.mgrTrust = clamp(c.mgrTrust + 0.5, 0, 100); out.push('Coach trust +0.5 (backing the team)'); } if (iv.rival) out.push(...adjust(g, iv.rival.id, { rival: 3, resp: 1 })); }
  else if (iv.result === 'L') { c.image = clamp(c.image + 6, -100, 100); c.mgrTrust = clamp(c.mgrTrust - 2.5, 0, 100); out.push('Public image: more arrogant', 'Coach trust −2.5 (blaming others after a defeat)'); if (iv.kind === 'starLoss') { me.rep = clamp(me.rep + 0.3, 0, 99); out.push('Reputation +0.3'); } if (iv.rival) out.push(...adjust(g, iv.rival.id, { rival: 7, resp: -2 })); }
  else { me.rep = clamp(me.rep + 0.7, 0, 99); c.image = clamp(c.image + 7, -100, 100); c.mgrTrust = clamp(c.mgrTrust - 1, 0, 100); out.push('Reputation +0.7', 'Public image: more arrogant', 'Coach trust −1'); if (iv.rival) out.push(...adjust(g, iv.rival.id, { rival: 7, resp: -2 })); }
  const said = iv.answers.find((a) => a.tone === tone)!.text;
  addNews(g, iv.rival ? 'rivalry' : 'career', `${me.sn}: "${said}"`, `${iv.question} — ${me.name}'s answer after the match${iv.rival ? ` against ${iv.rival.name}'s side` : ''}.`, { imp: tone === 'ego' ? 2 : 1, me: true, pids: iv.rival ? [iv.rival.id] : undefined });
  if (iv.rival) remember(g, iv.rival.id, 'talked', tone === 'ego' ? `You dismissed ${iv.rival.sn} in front of the press.` : tone === 'humble' ? `You praised ${iv.rival.sn} in front of the press.` : `You spoke about ${iv.rival.sn} to the press.`, tone === 'ego' ? -1 : 0.5);
  void POS_LINE;
  return out;
}

export type RivalEntry = NonNullable<Game['career']['rivalLog']>[number];
/**
 * Every recorded meeting with a player: the rivalry log, plus matches rebuilt from the stat lines the game keeps
 * for your own fixtures (this season's club matches, the NEL and international tournaments).
 */
export function rivalHistory(g: Game, rid: string): RivalEntry[] {
  const w = g.world, c = g.career, p = w.players[rid];
  const out = (c.rivalLog ?? []).filter((x) => x.rid === rid);
  const have = new Set(out.map((x) => x.fid));
  if (!p) return out;
  const teamIn = (s: number) => new Set([...p.hist.filter((h) => h.s === s).map((h) => h.club), ...(s === w.season ? [p.club ?? '', p.nelTeam ?? ''] : []), p.nat]);
  for (const um of c.matches) {
    if (have.has(um.fid) || !um.line) continue;
    const fx = w.fixtures[um.fid]; const hl = fx?.lines?.[rid];
    if (!fx || !hl || !hl[S.RATN] || !teamIn(um.s).has(um.opp)) continue;
    const comp = w.comps[um.comp];
    out.push({ kind: comp?.kind ?? 'friendly', stg: fx.stg, decider: false, rid, fid: um.fid, s: um.s, date: um.date, comp: um.compName, my: teamName(w, um.club), his: um.oppName, sc: um.sc, pens: um.pens, res: um.res, mg: um.line[S.G], ma: um.line[S.A], hg: hl[S.G], ha: hl[S.A], mr: Math.round(um.rat * 10) / 10, hr: Math.round((hl[S.RAT] / hl[S.RATN]) * 10) / 10, potm: um.potm ? 1 : fx.potm === rid ? 2 : 0, home: um.home });
  }
  return out.sort((a, b) => a.s - b.s || (w.fixtures[a.fid]?.day ?? 0) - (w.fixtures[b.fid]?.day ?? 0));
}
