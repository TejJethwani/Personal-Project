/**
 * Relationships with the user's player. Five separate dimensions (respect, trust, friendship,
 * rivalry, tactical chemistry) so a fierce rival can still respect you. Significant shared
 * events are stored as memories and referenced by later dialogue.
 */
import type { Fixture, Game, Memory, Rel } from './types';
import { clamp } from './rng';
import { M } from './abilities';
import { S, type MatchState } from './match/model';
import { DIFFICULTY, teamShort } from './match/setup';
import { ovr } from './attributes';

export function hasRel(g: Game, id: string): boolean { return !!g.career.rel[id]; }
export function relOf(g: Game, id: string): Rel {
  let r = g.career.rel[id];
  if (!r) {
    const p = g.world.players[id];
    const me = g.world.players[g.career.pid];
    const base = p ? clamp(22 + (me.rep - 20) * 0.4 + (ovr(me) - ovr(p)) * 1.2, 5, 70) : 35;
    r = g.career.rel[id] = { resp: Math.round(base), trust: 35, friend: 12, rival: 0, chem: 25, met: g.world.abs, last: -99, mem: [], flags: {}, uses: {}, shared: 0, vs: 0 };
    if (p) p.notable = true;
  }
  return r;
}
export function personName(g: Game, id: string): string {
  return g.world.players[id]?.name ?? g.career.people[id]?.name ?? Object.values(g.world.clubs).find((c) => c.mgr.id === id)?.mgr.name ?? 'Unknown';
}
export function positiveMemories(r: Rel): number { return r.mem.filter((m) => m.w > 0).length; }

/** Apply relationship changes with progression gates so talking alone can never max a bond. */
export function adjust(g: Game, id: string, d: Partial<Record<'resp' | 'trust' | 'friend' | 'rival' | 'chem', number>>): string[] {
  const r = relOf(g, id);
  const out: string[] = [];
  const pos = positiveMemories(r);
  const caps = { resp: 100, trust: pos >= 2 ? 100 : 70, friend: pos >= 5 && r.shared >= 10 ? 100 : pos >= 2 ? 85 : 60, rival: 100, chem: r.shared >= 12 ? 100 : r.shared >= 5 ? 85 : 60 };
  const names = { resp: 'Respect', trust: 'Trust', friend: 'Friendship', rival: 'Rivalry', chem: 'Chemistry' };
  for (const k of ['resp', 'trust', 'friend', 'rival', 'chem'] as const) {
    const v = d[k];
    if (!v) continue;
    const before = r[k];
    r[k] = clamp(before + v, 0, v > 0 ? Math.max(before, caps[k]) : 100);
    const diff = Math.round((r[k] - before) * 10) / 10;
    if (Math.abs(diff) >= 0.5) out.push(`${names[k]} ${diff > 0 ? '+' : ''}${Math.round(diff)}`);
    else if (v > 0 && before >= caps[k]) out.push(`${names[k]} capped — needs more shared history`);
  }
  r.last = g.world.abs;
  return out;
}

export function remember(g: Game, id: string, t: string, txt: string, w: number, fid?: string): void {
  const r = relOf(g, id);
  const m: Memory = { t, s: g.world.season, d: g.world.day, txt, w, fid };
  r.mem.push(m);
  if (r.mem.length > 14) {
    let wi = 0;
    for (let i = 1; i < r.mem.length - 4; i++) if (Math.abs(r.mem[i].w) < Math.abs(r.mem[wi].w)) wi = i;
    r.mem.splice(wi, 1);
  }
}
export function lastMemory(r: Rel, types?: string[]): Memory | undefined {
  for (let i = r.mem.length - 1; i >= 0; i--) if (!types || types.includes(r.mem[i].t)) return r.mem[i];
  return undefined;
}
export function relLabel(r: Rel): string {
  if (r.rival >= 60 && r.friend >= 55) return 'Friendly rival';
  if (r.rival >= 60) return r.resp >= 60 ? 'Respected rival' : 'Bitter rival';
  if (r.friend >= 75) return 'Close friend';
  if (r.friend >= 50) return 'Friend';
  if (r.trust < 20) return 'Distrusts you';
  if (r.chem >= 70) return 'On your wavelength';
  if (r.resp >= 70) return 'Respects you';
  if (r.friend >= 28 || r.trust >= 50) return 'Teammate';
  return 'Acquaintance';
}

/** Everything a match changes between the user and the people on the pitch. */
export function applyMatchRelations(g: Game, fx: Fixture, ms: MatchState): string[] {
  const u = ms.uc;
  const notes: string[] = [];
  if (!u) return notes;
  const w = g.world;
  const meM = ms.pl[u.idx];
  const c = g.career;
  if (!meM.used) {
    // watched from the bench: small chemistry from being around the group only
    return notes;
  }
  const chemMul = 1 + meM.m[M.CHEM_GAIN];
  const myRat = meM.s[S.RAT] || 6;
  const oppTeam = ms.teams[1 - meM.t];
  c.flags['fam:' + oppTeam.id] = Number(c.flags['fam:' + oppTeam.id] ?? 0) + 1;
  for (let i = 0; i < ms.pl.length; i++) {
    if (i === u.idx) continue;
    const q = ms.pl[i];
    if (!q.used) continue;
    const p = w.players[q.id];
    if (!p) continue;
    const mm = u.memo[i];
    if (q.t === meM.t) {
      const r = relOf(g, q.id);
      r.shared++;
      const ex = mm ? mm.pt + mm.pf : 0;
      adjust(g, q.id, { chem: Math.min(4.5, (0.7 + ex * 0.16) * chemMul), friend: 0.3, trust: ms.winner === meM.t ? 0.5 : 0 });
      if (!mm) continue;
      if (mm.at > 0) { adjust(g, q.id, { trust: 3 * mm.at, friend: 2, resp: 1, chem: 1.5 * chemMul }); remember(g, q.id, 'assist_to', `You set up ${p.sn}'s goal against ${oppTeam.name}.`, 2, fx.id); notes.push(`${p.sn} appreciated your assist.`); }
      if (mm.af > 0) { adjust(g, q.id, { friend: 2 * mm.af, chem: 1.5 * chemMul, trust: 1 }); remember(g, q.id, 'assist_from', `${p.sn} assisted your goal against ${oppTeam.name}.`, 2, fx.id); }
      if (mm.iIgn > 0) {
        const ego = p.pers.ego;
        if (ego >= 75) { adjust(g, q.id, { resp: 1, trust: -2 * mm.iIgn, rival: 2 }); }
        else adjust(g, q.id, { trust: -4 * mm.iIgn, friend: -1.5 * mm.iIgn });
        remember(g, q.id, 'ignored_them', `You shot against ${oppTeam.name} when ${p.sn} was in a better position.`, -2, fx.id);
        notes.push(`${p.sn} noticed you ignored him in a better position.`);
      }
      if (mm.ign > 0) { remember(g, q.id, 'ignored_me', `${p.sn} ignored your run against ${oppTeam.name}.`, -1, fx.id); adjust(g, q.id, { trust: -0.5 }); }
      if (u.used['react:' + q.id]) {
        adjust(g, q.id, { chem: 2 * chemMul, friend: 1 });
        const rx = c.reactions.find((x) => x.with === q.id);
        if (rx) { rx.uses += u.used['react:' + q.id]; if (rx.uses >= rx.lv * 4 && rx.lv < 5) rx.lv++; }
        else if (u.reactions[i]) { c.reactions.push({ id: 'rx' + q.id, with: q.id, withName: p.name, name: u.reactions[i], lv: 1, uses: 1, s: w.season }); remember(g, q.id, 'reaction', `Your first chemical reaction with ${p.sn}: "${u.reactions[i]}".`, 3, fx.id); notes.push(`Chemical reaction discovered with ${p.sn}: ${u.reactions[i]}.`); }
      }
    } else {
      if (!mm && !g.career.rel[q.id]) continue;
      const duels = mm ? mm.dw + mm.dl : 0;
      if (duels < 2 && !g.career.rel[q.id] && !(q.s[S.G] >= 2) && !(q.s[S.POTM] && meM.s[S.RATN])) continue;
      const r = relOf(g, q.id);
      r.vs++;
      if (mm && duels >= 2) {
        if (mm.dw - mm.dl >= 2) { adjust(g, q.id, { resp: 3, rival: 2 }); remember(g, q.id, 'beat_them', `You got the better of ${p.sn} (${mm.dw}–${mm.dl} in duels) against ${oppTeam.name}.`, 1, fx.id); }
        else if (mm.dl - mm.dw >= 2) {
          adjust(g, q.id, { rival: myRat < 6.4 ? 6 : 3, resp: -1 });
          remember(g, q.id, 'dominated', `${p.sn} shut you down for ${oppTeam.name} (${mm.dl}–${mm.dw} in duels${myRat < 6.4 ? `, you were rated ${myRat.toFixed(1)}` : ''}).`, -2, fx.id);
          if (myRat < 6.4) notes.push(`${p.name} dominated your duel. You will remember him.`);
        }
      }
      if (g.career.rivals.includes(q.id)) {
        adjust(g, q.id, { rival: 3, resp: myRat >= 7.5 ? 3 : 0 });
        remember(g, q.id, 'rival_match', `Faced your rival ${p.sn}: ${ms.teams[meM.t].abbr} ${ms.score[meM.t]}–${ms.score[1 - meM.t]} ${oppTeam.abbr}. You ${myRat.toFixed(1)}, him ${(q.s[S.RAT] || 6).toFixed(1)}.`, ms.winner === meM.t ? 2 : -1, fx.id);
      }
    }
  }
  // coach / manager: reacts to contribution for the role and tactical discipline, not goals alone
  const club = w.clubs[ms.teams[meM.t].id];
  const diff = DIFFICULTY[g.settings.difficulty] ?? DIFFICULTY[1];
  const disc = u.disciplineN > 0 ? u.discipline / u.disciplineN : 0.7;
  c.discipline = clamp(c.discipline * 0.7 + disc * 100 * 0.3, 0, 100);
  if (meM.s[S.RATN]) {
    const dTrust = ((myRat - 6.6) * 2.4 + (disc - 0.62) * 6 - u.selfish * 0.8) * (myRat < 6.6 ? diff.pressure : 1);
    c.mgrTrust = clamp(c.mgrTrust + dTrust, 0, 100);
    if (club) { adjust(g, club.mgr.id, { trust: dTrust * 0.6, resp: (myRat - 6.6) * 1.2 }); }
    notes.push(`Coach trust ${dTrust >= 0 ? '+' : ''}${dTrust.toFixed(1)} (rating ${myRat.toFixed(1)}, discipline ${Math.round(disc * 100)}%${u.selfish ? `, ${u.selfish} selfish decision${u.selfish > 1 ? 's' : ''}` : ''}).`);
  }
  c.image = clamp(c.image + u.selfish * 2 - u.unselfish * 1, -100, 100);
  // witnessed abilities → exposure for learning
  for (const id in u.seen) {
    if (g.world.players[c.pid].ab.some((a) => a.id === id)) continue;
    const L = (c.learning[id] ??= { exposure: 0, practice: 0 });
    L.exposure = Math.min(100, L.exposure + Math.min(18, u.seen[id] * 5));
  }
  void teamShort;
  return notes;
}
