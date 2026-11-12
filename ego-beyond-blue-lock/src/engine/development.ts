/**
 * Training, progression, ageing, retirement and youth intake.
 * Permanent attributes only change here; form, fitness, sharpness and morale are separate,
 * temporary condition values. Every attribute point the user gains is logged with its causes.
 */
import type { Game, Player, SessionPlan } from './types';
import { A, ATTRS, N_ATTR, N_OUT, POS_WEIGHTS, ovr, shiftOvr, POS_LINE } from './attributes';
import { abilityDef, addXp, meetsReq, SLOTS, buildMods, M, MAX_LEVEL } from './abilities';
import { clamp } from './rng';
import { rngOf, genPlayer, addToClub, signContract, assignNumbers, clubStrength } from './worldgen';
import { NEL_TEAMS } from './data/clubs';
import { S, type MatchState } from './match/model';
import { INJURY_RATE } from './match/setup';
import { addNews, milestone, styleAttrs } from './util';
import { fmtDate } from './competitions';
import { adjust, relOf } from './relationships';
import { release } from './transfers';

export interface SessionDef { id: string; name: string; desc: string; fatigue: number; focus?: Record<string, { name: string; attrs: number[] }> }
export const SESSIONS: SessionDef[] = [
  { id: 'technical', name: 'Technical Drills', desc: 'Repetition work on a chosen technique group.', fatigue: 4, focus: {
    shooting: { name: 'Shooting', attrs: [A.FIN, A.SHP, A.LSH, A.VOL, A.PEN] }, passing: { name: 'Passing', attrs: [A.SPA, A.LPA, A.VIS, A.CRO] },
    dribbling: { name: 'Dribbling & Control', attrs: [A.DRI, A.BCO, A.FTO, A.SKL, A.AGI] }, defending: { name: 'Defending', attrs: [A.TAC, A.MAR, A.INT, A.DAW, A.HEA] }, weakfoot: { name: 'Weak Foot', attrs: [A.WFT, A.BCO, A.FIN] } } },
  { id: 'position', name: 'Position-Specific Work', desc: 'The attributes your position values most, in match-like patterns.', fatigue: 4 },
  { id: 'tactical', name: 'Tactical Study', desc: 'Shape, triggers and video sessions with the staff. Coaches notice.', fatigue: 2 },
  { id: 'physical', name: 'Physical Development', desc: 'Gym and running. The biggest fatigue cost.', fatigue: 7, focus: {
    pace: { name: 'Pace & Agility', attrs: [A.ACC, A.SPD, A.AGI] }, strength: { name: 'Strength & Aerial', attrs: [A.STR, A.JUM, A.BAL] }, stamina: { name: 'Endurance', attrs: [A.STA, A.BAL] } } },
  { id: 'weapon', name: 'Weapon Practice', desc: 'Ability experience for an equipped weapon, or practice toward learning one you have studied.', fatigue: 5 },
  { id: 'chemistry', name: 'Chemistry Session', desc: 'Pattern work with one team-mate. Builds tactical chemistry with him.', fatigue: 3 },
  { id: 'analysis', name: 'Match Analysis', desc: 'Study your clips and the next opponent. Sharpens decisions and tactical discipline.', fatigue: 1 },
  { id: 'recovery', name: 'Recovery', desc: 'Pool, physio and sleep. Restores condition and lowers injury risk.', fatigue: -12 },
  { id: 'rest', name: 'Day Off', desc: 'Nothing scheduled.', fatigue: -8 },
];
export const INTENSITY = [{ name: 'Light', xp: 0.7, fat: 0.6 }, { name: 'Normal', xp: 1, fat: 1 }, { name: 'Intense', xp: 1.3, fat: 1.5 }];

const AGE_F = (ag: number) => (ag <= 17 ? 1.5 : ag === 18 ? 1.4 : ag === 19 ? 1.3 : ag === 20 ? 1.2 : ag === 21 ? 1.05 : ag <= 23 ? 0.9 : ag <= 25 ? 0.65 : ag <= 27 ? 0.4 : ag <= 29 ? 0.22 : 0.1);
/** Attribute points the user can expect to gain per week of focused training. */
export function weeklyGrowth(g: Game): number {
  const p = g.world.players[g.career.pid];
  const ag = g.world.season - p.born;
  const gap = p.pot - ovr(p);
  const club = p.club ? g.world.clubs[p.club] : null;
  return 1.15 * g.settings.devSpeed * AGE_F(ag) * clamp(0.25 + gap * 0.11, 0.1, 1.9) * (0.8 + (club?.fac ?? 5) * 0.04);
}

function gainXp(g: Game, attr: number, amount: number, source: string): void {
  const c = g.career;
  const p = g.world.players[c.pid];
  if (attr >= N_OUT || p.a[attr] >= 99) return;
  const dim = clamp(1.3 - (p.a[attr] / 100) * 0.95, 0.25, 1);
  const v = amount * dim;
  c.xp[attr] += v;
  const src = (c.xpSrc[attr] ??= {});
  src[source] = (src[source] ?? 0) + v;
  while (c.xp[attr] >= 1 && p.a[attr] < 99) {
    c.xp[attr] -= 1;
    const before = ovr(p);
    p.a[attr]++;
    const total = Object.values(src).reduce((s, x) => s + x, 0) || 1;
    const why = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, x]) => `${k} (${Math.round((x / total) * 100)}%)`);
    c.devLog.push({ s: g.world.season, day: g.world.day, date: fmtDate(g.world, g.world.day), attr, delta: 1, to: p.a[attr], why });
    if (c.devLog.length > 400) c.devLog.splice(0, 100);
    c.xpSrc[attr] = {};
    const after = ovr(p);
    if (after > before) {
      c.ovrLog.push({ s: g.world.season, day: g.world.day, ovr: after });
      c.digest.push(`OVR ${before} → ${after} (${ATTRS[attr].name} +1)`);
      if (after % 5 === 0) milestone(g, 'growth', `Reached ${after} OVR.`);
      if (g.settings.dynamicPot && after >= p.pot && p.pot < 99 && g.world.season - p.born <= 24) p.pot = Math.min(99, p.pot + 1);
    }
  }
}

function sessionAttrs(g: Game, s: SessionPlan): number[] {
  const p = g.world.players[g.career.pid];
  const def = SESSIONS.find((x) => x.id === s.type);
  if (def?.focus) return (def.focus[s.focus ?? ''] ?? Object.values(def.focus)[0]).attrs;
  if (s.type === 'position') { const w = POS_WEIGHTS[p.pos]; return [...Array(N_OUT).keys()].sort((a, b) => w[b] - w[a]).slice(0, 7); }
  if (s.type === 'tactical') return [A.TIQ, A.DEC, POS_LINE[p.pos] >= 2 ? A.POS : A.DAW, A.REA];
  if (s.type === 'analysis') return [A.DEC, A.TIQ, A.COM];
  return [];
}

/** Run today's planned session for the user. */
export function runTraining(g: Game, isMatchDay: boolean): void {
  const w = g.world;
  const c = g.career;
  const p = w.players[c.pid];
  if (p.retired) return;
  const dow = w.day % 7;
  let s: SessionPlan = c.plan[dow] ?? { type: 'rest' };
  if (isMatchDay) s = { type: 'match' };
  if (p.inj > 0) { p.fit = clamp(p.fit + 6, 0, 100); return; }
  if (s.type === 'match') return;
  const def = SESSIONS.find((x) => x.id === s.type) ?? SESSIONS[SESSIONS.length - 1];
  const it = INTENSITY[c.intensity] ?? INTENSITY[1];
  const club = p.club ? w.clubs[p.club] : null;
  if (def.fatigue < 0) { p.fit = clamp(p.fit - def.fatigue, 0, 100); return; }
  p.fit = clamp(p.fit - def.fatigue * it.fat, 5, 100);
  const G = weeklyGrowth(g);
  const per = (G / 4.5) * it.xp * (p.fit < 45 ? 0.6 : 1);
  const attrs = sessionAttrs(g, s);
  const ident = club ? (club.nel ? (NEL_TEAMS.find((t) => t.id === club.id)?.train.map((k) => A[k as keyof typeof A]) ?? []) : styleAttrs(club.style)) : [];
  const label = s.type === 'technical' || s.type === 'physical' ? `${def.name}: ${def.focus?.[s.focus ?? '']?.name ?? ''}` : def.name;
  if (attrs.length) {
    for (const a of attrs) {
      const bonus = ident.includes(a) ? 1.25 : 1;
      gainXp(g, a, (per / attrs.length) * bonus, label);
      if (bonus > 1) { const src = (c.xpSrc[a] ??= {}); const add = (per / attrs.length) * 0.0001; src[`${club!.sn} training identity`] = (src[`${club!.sn} training identity`] ?? 0) + add + (per / attrs.length) * 0.2; }
    }
  }
  if (s.type === 'tactical') { c.mgrTrust = clamp(c.mgrTrust + 0.5, 0, 100); c.discipline = clamp(c.discipline + 0.6, 0, 100); }
  if (s.type === 'analysis') c.discipline = clamp(c.discipline + 0.9, 0, 100);
  if (s.type === 'weapon') {
    const learnMul = 1 + buildMods(p.ab, 1)[M.LEARN];
    const target = s.ability;
    const ref = p.ab.find((r) => r.id === target) ?? p.ab.find((r) => abilityDef(r.id)?.kind === 'weapon');
    if (target && !p.ab.some((r) => r.id === target) && c.learning[target]) {
      const L = c.learning[target];
      const d = abilityDef(target);
      if (d && meetsReq(p.a, d).ok) { L.practice = Math.min(100, L.practice + 13 * it.xp * learnMul * Math.max(0.3, L.exposure / 100)); tryLearn(g, target); }
    } else if (ref) {
      if (addXp(ref, 11 * it.xp)) abilityLevelUp(g, ref.id, ref.lv);
    }
  }
  if (s.type === 'chemistry' && s.partner && club?.squad.includes(s.partner)) {
    const chemMul = 1 + buildMods(p.ab, 1)[M.CHEM_GAIN];
    adjust(g, s.partner, { chem: 2.4 * chemMul * it.xp, friend: 0.5, trust: 0.4 });
    const mate = w.players[s.partner];
    // working with a team-mate exposes you to his weapons
    for (const r of mate?.ab ?? []) { const d = abilityDef(r.id); if (d && d.kind !== 'passive' && !p.ab.some((x) => x.id === r.id)) { const L = (c.learning[r.id] ??= { exposure: 0, practice: 0, from: mate.id }); L.exposure = Math.min(100, L.exposure + 7 * learnMulOf(p)); } }
  }
  // training injuries
  const rate = INJURY_RATE[g.settings.injuries] ?? 1;
  if (rate > 0 && def.fatigue >= 4) {
    const inj = 0.0016 * rate * it.fat * (p.fit < 45 ? 3 : p.fit < 60 ? 1.6 : 1) * (1 - buildMods(p.ab, 1)[M.INJ_RES]);
    if (rngOf(w).next() < inj) {
      p.inj = rngOf(w).range(4, 24); p.injName = 'training knock';
      addNews(g, 'injury', `Training injury: out for about ${p.inj} days`, 'You pushed through a session on tired legs. Recovery sessions lower this risk.', { imp: 2, me: true });
    }
  }
}
const learnMulOf = (p: Player) => 1 + buildMods(p.ab, 1)[M.LEARN];

export function tryLearn(g: Game, id: string): boolean {
  const c = g.career;
  const p = g.world.players[c.pid];
  const L = c.learning[id];
  const d = abilityDef(id);
  if (!L || !d || p.ab.some((r) => r.id === id)) return false;
  if (L.exposure < 100 || L.practice < 100 || !meetsReq(p.a, d).ok) return false;
  const have = p.ab.filter((r) => abilityDef(r.id)?.kind === d.kind).length;
  if (have >= SLOTS[d.kind]) return false;
  p.ab.push({ id, lv: 1, xp: 0 });
  delete c.learning[id];
  milestone(g, 'ability', `Learned a new ${d.kind}: ${d.name}.`);
  addNews(g, 'career', `New ${d.kind} learned: ${d.name}`, `After studying it and weeks of practice, ${d.name} is now part of your game at level 1.`, { imp: 3, me: true });
  return true;
}

function abilityLevelUp(g: Game, id: string, lv: number): void {
  const d = abilityDef(id);
  if (!d) return;
  g.career.digest.push(`${d.name} reached level ${lv}`);
  milestone(g, 'ability', `${d.name} reached level ${lv}.`);
  if (lv === 3 && d.evo?.length) { g.career.flags['evo:' + id] = 1; addNews(g, 'career', `${d.name} is ready to evolve`, 'Choose an evolution branch on the Weapons screen.', { imp: 3, me: true }); }
}

/** Attribute experience and ability experience earned in a match. */
export function applyMatchDevelopment(g: Game, ms: MatchState): string[] {
  const u = ms.uc;
  const notes: string[] = [];
  if (!u) return notes;
  const mp = ms.pl[u.idx];
  if (!mp.used) return notes;
  const p = g.world.players[g.career.pid];
  const s = mp.s;
  const total = ms.rules.kind === 'nel' ? Math.max(ms.play, 1) : 5400;
  const share = Math.min(1.2, (ms.rules.kind === 'nel' ? s[S.PLAY] : s[S.SEC]) / total);
  const rat = s[S.RATN] ? s[S.RAT] : 6;
  const pts = weeklyGrowth(g) * 0.3 * share * clamp(1 + (rat - 6.5) * 0.3, 0.5, 1.8);
  const used: [number, number][] = [[A.FIN, s[S.SH] * 1.2 + s[S.G] * 3], [A.POS, s[S.SH] + s[S.G] * 2], [A.SPA, s[S.PC] * 0.25], [A.VIS, s[S.KP] * 2 + s[S.A] * 3], [A.DRI, s[S.DC] * 1.6], [A.BCO, s[S.TCH] * 0.1], [A.TAC, s[S.TKW] * 2], [A.INT, s[S.INT] * 2], [A.DAW, s[S.INT] + s[S.BLK] * 2 + s[S.CLR]], [A.HEA, s[S.AW] * 1.5], [A.STA, share * 4], [A.COM, share * 2 + s[S.G] * 2], [A.DEC, share * 3], [A.REA, share * 2]];
  const tot = used.reduce((x, y) => x + y[1], 0) || 1;
  const label = `Match vs ${ms.teams[1 - mp.t].name}`;
  for (const [a, v] of used) if (v > 0) gainXp(g, a, (pts * v) / tot, label);
  // abilities
  for (const r of p.ab) {
    const d = abilityDef(r.id);
    if (!d) continue;
    const n = u.used[r.id] ?? 0;
    const xp = d.kind === 'passive' ? 2.5 * share + (rat >= 7.5 ? 2 : 0) : n * (d.kind === 'ultimate' ? 16 : 8) + (n > 0 && s[S.G] > 0 ? 6 : 0) + (d.kind === 'weapon' ? 1.5 * share : 0);
    if (xp > 0 && addXp(r, xp)) { abilityLevelUp(g, r.id, r.lv); notes.push(`${d.name} levelled up to ${r.lv}.`); }
  }
  if (mp.flN > 0) notes.push(`You entered Flow ${mp.flN} time${mp.flN > 1 ? 's' : ''}.`);
  return notes;
}

/** Daily condition recovery for everyone. */
export function dailyRecovery(g: Game): void {
  const w = g.world;
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired) continue;
    if (p.inj > 0) { p.inj--; if (p.inj === 0 && id === g.career.pid) addNews(g, 'injury', 'You are fit again', 'The medical staff have cleared you to train and play.', { imp: 2, me: true }); }
    if (p.fit < 100) p.fit = Math.min(100, p.fit + (id === g.career.pid ? 5.5 : 8.5));
  }
}

/** Monthly development for the rest of the world: growth by age, potential, playing time and club facilities; decline with age. */
export function worldDevTick(g: Game): void {
  const w = g.world;
  const rng = rngOf(w);
  const me = g.career.pid;
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired || id === me) continue;
    const ag = w.season - p.born;
    const o = ovr(p);
    const club = p.club ? w.clubs[p.club] : null;
    let apps = 0;
    for (const c in p.ss) apps += p.ss[c][S.APP];
    if (ag <= 29 && p.pot > o) {
      const play = club ? clamp(0.55 + apps / 22, 0.55, 1.25) : 0.6;
      p.dev += AGE_F(ag) * (p.pot - o) * 0.028 * play * (0.8 + (club?.fac ?? 5) * 0.04) * (0.7 + rng.next() * 0.6) * (p.origin === 'bluelock' ? 1.25 : 1);
    } else if (ag >= 30) {
      p.dev -= (0.05 + (ag - 30) * 0.035) * (0.6 + rng.next() * 0.8) * (p.pos === 'GK' ? 0.6 : 1);
    }
    if (p.dev >= 1) { const n = Math.floor(p.dev); shiftOvr(p, n, rng); p.dev -= n; }
    else if (p.dev <= -1) { const n = Math.floor(-p.dev); shiftOvr(p, -n, rng); p.dev += n; if (p.pot > ovr(p) + 1) p.pot = Math.max(ovr(p), p.pot - 1); }
    p.sharp = clamp(p.sharp - 4, 20, 100);
  }
}

/** The user's own age-related decline (physical first). Applied monthly. */
export function userAgeing(g: Game): void {
  const w = g.world;
  const p = w.players[g.career.pid];
  const ag = w.season - p.born;
  if (ag < 31 || p.retired) return;
  const rng = rngOf(w);
  const loss = (0.05 + (ag - 31) * 0.035) * (0.6 + rng.next() * 0.8);
  p.dev -= loss;
  if (p.dev <= -1) {
    const before = ovr(p);
    const changed = shiftOvr(p, -1, rng);
    p.dev += 1;
    for (const a of new Set(changed)) g.career.devLog.push({ s: w.season, day: w.day, date: fmtDate(w, w.day), attr: a, delta: -1, to: p.a[a], why: [`Age ${ag}: natural decline`] });
    if (ovr(p) < before) g.career.ovrLog.push({ s: w.season, day: w.day, ovr: ovr(p) });
  }
}

/** Season rollover: potential drift, retirements and a new youth intake at every club. */
export function yearlyDevelopment(g: Game): { retired: Player[]; youth: Player[] } {
  const w = g.world;
  const rng = rngOf(w);
  const me = g.career.pid;
  const retired: Player[] = [];
  const youth: Player[] = [];
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired || id === me) continue;
    const ag = w.season + 1 - p.born;
    const o = ovr(p);
    let apps = 0, rat = 0, rn = 0;
    for (const c in p.ss) { apps += p.ss[c][S.APP]; rat += p.ss[c][S.RAT]; rn += p.ss[c][S.RATN]; }
    // dynamic potential for the world
    if (ag <= 24 && rn >= 18 && rat / rn >= 7.35 && p.pot < 97) p.pot += 1 + (rat / rn >= 7.7 ? 1 : 0);
    else if (ag >= 22 && ag <= 27 && apps < 6 && p.pot > o + 2) p.pot -= 1;
    if (ag >= 26 && p.pot > o + 2) p.pot = Math.max(o, p.pot - 1);
    // retirement
    const pr = ag >= 40 ? 1 : ag >= 34 ? 0.22 + (ag - 34) * 0.18 - (o - 75) * 0.02 : ag >= 32 && !p.club ? 0.5 : !p.club && ag >= 29 && o < 62 ? 0.4 : 0;
    if (pr > 0 && rng.next() < pr) {
      const hadRel = !!g.career.rel[id];
      if (p.club) release(g, p, true); else { p.retired = w.season; const fi = w.free.indexOf(id); if (fi >= 0) w.free.splice(fi, 1); }
      retired.push(p);
      if (p.rep >= 80 || hadRel) addNews(g, 'world', `${p.name} retires`, `${p.name} ends his career at ${ag - 1}${p.awards.length ? ` with ${p.awards.length} individual award${p.awards.length > 1 ? 's' : ''}` : ''}.${hadRel ? ' You shared a pitch with him.' : ''}`, { imp: hadRel ? 2 : 1, pids: [id] });
      continue;
    }
    if (ag >= 31 && o >= 82 && rn >= 10 && rat / rn < 6.5 && rng.chance(0.5)) addNews(g, 'world', `Is time catching up with ${p.name}?`, `At ${ag - 1}, ${p.name} averaged just ${(rat / rn).toFixed(2)} this season.`, { imp: 1, pids: [id] });
    // abilities mature slowly
    if (p.ab.length && rn >= 15 && rng.chance(0.25)) { const r = p.ab[rng.int(p.ab.length)]; if (r.lv < MAX_LEVEL && o >= 78 + r.lv * 2) r.lv++; }
  }
  // youth intake
  for (const c of Object.values(w.clubs)) {
    if (c.nel || c.dormant || !c.league) continue;
    const n = c.squad.length >= 28 ? 1 : rng.range(2, 3);
    const lvl = 38 + c.rep * 0.5;
    for (let i = 0; i < n; i++) {
      const gem = rng.chance(0.03 + c.youth * 0.008);
      const pos = rng.pick(['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST'] as const);
      const o = clamp(Math.round(lvl - rng.range(8, 15) + (gem ? 5 : 0)), 45, 82);
      const p = genPlayer(w, rng, { nat: rng.chance(0.78) ? c.nat : rng.pick(['FRA', 'BRA', 'NGA', 'ARG', 'POR', 'SEN', 'JPN', 'NED', 'GHA', 'CIV', 'USA', 'KOR']), pos, ovr: o, age: rng.range(16, 18), pot: clamp(o + rng.range(6, 14) + Math.round(c.youth * 0.6) + (gem ? 8 : 0), o, 97), origin: 'regen' });
      p.born = w.season + 1 - rng.range(16, 18);
      addToClub(w, p, c);
      signContract(w, p, c, 'prospect', 3);
      p.con!.from = w.season + 1; p.con!.until = w.season + 4;
      youth.push(p);
      if (gem && p.pot >= 90) { p.notable = true; addNews(g, 'youth', `${c.name} unveil academy prospect ${p.name}`, `A ${w.season + 1 - p.born}-year-old ${p.pos} the coaches believe could reach the very top.`, { imp: 1, pids: [p.id], clubs: [c.id] }); }
    }
    // release surplus fringe players so squads stay a sensible size
    while (c.squad.length > 30) {
      const list = c.squad.map((id) => w.players[id]).filter((p) => p && p.id !== me && !g.career.rel[p.id]).sort((a, b) => ovr(a) + (a.pot - ovr(a)) * 0.4 - (ovr(b) + (b.pot - ovr(b)) * 0.4));
      if (!list.length) break;
      release(g, list[0]);
    }
    assignNumbers(w, c, c.squad.includes(me) ? me : undefined);
  }
  // free agents nobody wants drift out of the game
  for (const id of [...w.free]) { const p = w.players[id]; if (!p || id === me) continue; if (rng.chance(0.35) && !g.career.rel[id] && !p.notable) { p.retired = w.season; w.free.splice(w.free.indexOf(id), 1); } }
  // the user's dynamic potential
  if (g.settings.dynamicPot) {
    const p = w.players[me];
    let rat = 0, rn = 0;
    for (const c in p.ss) { rat += p.ss[c][S.RAT]; rn += p.ss[c][S.RATN]; }
    const ag = w.season + 1 - p.born;
    if (ag <= 25 && rn >= 15 && rat / rn >= 7.4 && p.pot < 99) { p.pot = Math.min(99, p.pot + 1); addNews(g, 'career', 'Your ceiling just got higher', `A ${(rat / rn).toFixed(2)} average over the season has scouts revising your potential upward to ${p.pot}.`, { imp: 2, me: true }); }
    else if (ag >= 23 && ag <= 28 && rn < 8 && p.pot > ovr(p) + 1) { p.pot -= 1; addNews(g, 'career', 'A lost season costs development', `With so little football, your projected ceiling slips to ${p.pot}.`, { imp: 2, me: true }); }
  }
  return { retired, youth };
}

/** Drop retired players nobody references any more, keeping the save size bounded. */
export function pruneRetired(g: Game): number {
  const w = g.world;
  let n = 0;
  for (const id in w.players) {
    const p = w.players[id];
    if (!p.retired || p.retired >= w.season - 1 || id === g.career.pid) continue;
    if (p.notable || p.awards.length || g.career.rel[id] || p.rep >= 78) continue;
    delete w.players[id];
    n++;
  }
  return n;
}

export function payWages(g: Game): void {
  const w = g.world;
  const key = w.season * 100 + Math.floor(w.day / 7);
  if (g.career.lastWageWeek === key) return;
  g.career.lastWageWeek = key;
  const p = w.players[g.career.pid];
  if (p.con) g.career.wages += p.con.wage;
}
export { clubStrength, relOf, N_ATTR };
