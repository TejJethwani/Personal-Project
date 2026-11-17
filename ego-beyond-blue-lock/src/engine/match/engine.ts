/**
 * Possession simulator. One engine drives every match in the game — interactive, highlights,
 * quick-sim and background fixtures — so all modes share the same rules and statistics.
 *
 * The match advances in small steps. Each step: update team shape → defensive action →
 * off-ball movement → on-ball action. When the user's player is involved and the decision is
 * important enough for the chosen interaction frequency, the engine pauses with a list of
 * options (ms.pending). AI players pick from the SAME option list using expected value.
 * All outcomes are resolved by seeded probability from attributes, pressure, positioning,
 * stamina, chemistry and abilities; commentary is generated afterwards and cannot alter results.
 */
import { A } from '../attributes';
import { M, FLOW, abilityDef, actValue, usesPerMatch, type ActCtx } from '../abilities';
import { Rng, clamp, sig } from '../rng';
import { S, RUN, ARR, RST, type MatchState, type Replay, type MPlayer, type Option, type Decision } from './model';
import { shotGeo, xgLogit, logistic, PENALTY_XG, logit } from './xg';
import { emit, nelMachine, regMachine, goalMinute, type Machine } from './rules';
import { say, abilityLine } from './commentary';

export const DBG: Record<string, number> = {};
const GB = 42; // general bonus slot in the modifier table (rival / big-match focus)
const LX = 1.05, LY = 0.68;
const K_ATT = [0, 0.5, 0.62, 0.55];
const K_DEF = [0, 0.56, 0.6, 0.42];

const machineOf = (ms: MatchState): Machine => (ms.rules.kind === 'nel' ? nelMachine : regMachine);
const ax = (t: number, x: number) => (t === 0 ? x : 100 - x);
/** Soft compression of skill gaps so mismatches are decisive without becoming absurd. */
const cz = (d: number) => 8 * Math.tanh(d / 8);
const dist = (x1: number, y1: number, x2: number, y2: number) => { const dx = (x1 - x2) * LX, dy = (y1 - y2) * LY; return Math.sqrt(dx * dx + dy * dy); };

function fat(ms: MatchState, p: MPlayer): number {
  const loss = (1 - p.st / 100) * 0.2;
  return 1 - loss * (1 - (ms.play > 2400 ? p.m[M.LATE_STA] : 0));
}
function at(ms: MatchState, p: MPlayer, i: number): number {
  let v = p.a[i];
  if (p.flEnd > ms.play && p.boost.indexOf(i) >= 0) v += FLOW.boost;
  return v * fat(ms, p) * (ms.teams[p.t].day ?? 1);
}
const passSk = (ms: MatchState, p: MPlayer, long: boolean) => (long ? at(ms, p, A.LPA) * 0.6 + at(ms, p, A.VIS) * 0.25 + at(ms, p, A.SPA) * 0.15 : at(ms, p, A.SPA) * 0.6 + at(ms, p, A.VIS) * 0.2 + at(ms, p, A.BCO) * 0.1 + at(ms, p, A.DEC) * 0.1);
const drbSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.DRI) * 0.45 + at(ms, p, A.AGI) * 0.15 + at(ms, p, A.BCO) * 0.15 + at(ms, p, A.ACC) * 0.15 + at(ms, p, A.BAL) * 0.1;
const defSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.TAC) * 0.4 + at(ms, p, A.DAW) * 0.2 + at(ms, p, A.MAR) * 0.15 + at(ms, p, A.STR) * 0.1 + at(ms, p, A.REA) * 0.15;
const intSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.INT) * 0.5 + at(ms, p, A.DAW) * 0.25 + at(ms, p, A.REA) * 0.15 + at(ms, p, A.TIQ) * 0.1;
const offSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.POS) * 0.5 + at(ms, p, A.TIQ) * 0.2 + at(ms, p, A.ACC) * 0.15 + at(ms, p, A.REA) * 0.15;
const airSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.HEA) * 0.4 + at(ms, p, A.JUM) * 0.35 + at(ms, p, A.STR) * 0.25 + (p.h - 180) * 0.4;
const holdSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.STR) * 0.45 + at(ms, p, A.BAL) * 0.25 + at(ms, p, A.BCO) * 0.3;
const paceSk = (ms: MatchState, p: MPlayer) => at(ms, p, A.ACC) * 0.45 + at(ms, p, A.SPD) * 0.55;
const gkSk = (p: MPlayer | null) => (p ? (p.a[A.GKD] + p.a[A.GKH] + p.a[A.GKR] * 1.2 + p.a[A.GKP]) / 4.2 : 30);
function shotSk(ms: MatchState, p: MPlayer, v: string): number {
  switch (v) {
    case 'power': return at(ms, p, A.SHP) * 0.45 + at(ms, p, A.FIN) * 0.4 + at(ms, p, A.COM) * 0.15;
    case 'long': case 'fk': return at(ms, p, A.LSH) * 0.5 + at(ms, p, A.SHP) * 0.3 + at(ms, p, A.COM) * 0.2;
    case 'header': return at(ms, p, A.HEA) * 0.6 + at(ms, p, A.JUM) * 0.2 + at(ms, p, A.POS) * 0.2;
    case 'volley': return at(ms, p, A.VOL) * 0.6 + at(ms, p, A.FIN) * 0.25 + at(ms, p, A.BAL) * 0.15;
    case 'chip': return at(ms, p, A.FIN) * 0.4 + at(ms, p, A.COM) * 0.3 + at(ms, p, A.VIS) * 0.15 + at(ms, p, A.BCO) * 0.15;
    case 'pen': return at(ms, p, A.PEN) * 0.6 + at(ms, p, A.COM) * 0.4;
    case 'first': return at(ms, p, A.FIN) * 0.5 + at(ms, p, A.FTO) * 0.2 + at(ms, p, A.REA) * 0.15 + at(ms, p, A.COM) * 0.15;
    default: return at(ms, p, A.FIN) * 0.6 + at(ms, p, A.COM) * 0.25 + at(ms, p, A.REA) * 0.15;
  }
}

/** Expected value of holding the ball at an attack-frame location (rough probability the possession ends in a goal). */
function ev(x: number, y: number): number {
  if (x < 0) x = 0; else if (x > 100) x = 100;
  const cy = Math.abs(y - 50) / 50;
  const r = x / 100;
  let v = 0.005 + 0.035 * r * r * Math.sqrt(r);
  if (x > 83) v += 0.09 * (1 - cy * 0.9);
  else if (x > 70) v += 0.03 * (1 - cy * 0.6);
  return v;
}

/** A deterministic 0–0.3 jitter per player and step, to break exact ties between mirror-image team-mates. */
function tieJit(ms: MatchState, i: number): number { return (((i + 1) * 2654435761 + ms.steps * 40503) >>> 0) % 1000 * 3e-4; }

/** Teams use the flanks: from the middle, a free full-back or winger out wide is worth more than the raw position suggests. */
function widthPull(width: number, fromY: number, toY: number, toX: number): number {
  if (Math.abs(toY - 50) < 22 || Math.abs(fromY - 50) > 26 || toX < 30 || toX > 88) return 0;
  return 0.009 * (0.55 + width * 0.9) * (toX > 60 ? 1.15 : 1);
}

/** Mean defensive quality of a team's outfielders (cached per step count bucket). */
const DQ = [60, 60];
function refreshDq(ms: MatchState): void {
  for (let t = 0; t < 2; t++) {
    const on = ms.teams[t].on;
    let s = 0, n = 0;
    for (let k = 0; k < on.length; k++) { const p = ms.pl[on[k]]; if (p.line === 0) continue; s += (p.a[A.INT] + p.a[A.DAW] + p.a[A.MAR] + p.a[A.TAC]) * 0.25 * (0.8 + 0.2 * (p.st / 100)); n++; }
    DQ[t] = n ? s / n + (11 - Math.min(11, on.length)) * -2.5 : 40;
  }
}
function gkOf(ms: MatchState, t: number): MPlayer | null {
  const on = ms.teams[t].on;
  for (let i = 0; i < on.length; i++) if (ms.pl[on[i]].pos === 'GK') return ms.pl[on[i]];
  return null;
}

// ───────────────────────────── shape & pressure ─────────────────────────────
function shape(ms: MatchState): void {
  for (let t = 0; t < 2; t++) {
    const T = ms.teams[t];
    const inPoss = ms.poss === t;
    const bAx = ax(t, ms.bx);
    const by = t === 0 ? ms.by : 100 - ms.by;
    const push = inPoss ? (T.tac.line - 0.5) * 6 + 2 : -(0.5 - T.tac.line) * 10 - 2;
    const wide = inPoss ? 0.9 + T.tac.width * 0.25 : 0.82;
    const ys = inPoss ? 0.18 : 0.3;
    for (let k = 0; k < T.on.length; k++) {
      const p = ms.pl[T.on[k]];
      let x: number, y: number;
      if (p.line === 0) { x = 4 + (bAx - 50) * 0.06; y = 50 + (by - 50) * 0.12; }
      else {
        x = p.bx + (bAx - 50) * (inPoss ? K_ATT[p.line] : K_DEF[p.line]) + push;
        y = 50 + (p.by - 50) * (inPoss && bAx > 68 && p.line >= 2 ? wide * 0.62 : wide) + (by - 50) * ys;
        if (inPoss && bAx > 70 && p.line === 2) x += 5; // midfielders arrive at the edge of the box
        if (p.run) {
          if (p.run === RUN.BEHIND || p.run === RUN.PRED) x += p.user ? 13 : 9;
          else if (p.run === RUN.BLIND) { x += p.user ? 7 : 9; if (p.user) y += y < 50 ? 9 : -9; }
          else if (p.run === RUN.SHORT) { // come short: towards the man on the ball, from wherever you are, stopping a few metres off him
            const gx = bAx - x, gy = by - y, k = p.user ? 0.55 : 0.4;
            x += Math.max(-14, Math.min(14, gx * k)); y += gy * (p.user ? 0.55 : 0.3);
            if (Math.abs(bAx - x) < 5 && Math.abs(by - y) < 5) x = bAx - 5; // a passing angle, not on top of him
          }
          else if (p.run === RUN.NEAR) { x += 8; y += (by - y) * 0.5; }
          else if (p.run === RUN.FAR) { x += 8; y += (100 - by - y) * 0.4; }
          else if (p.run === RUN.OVERLAP) { x += 12; if (p.user) y += y < 50 ? -8 : 8; }
        }
        if (p.beat > 0 && !inPoss) x += 7;
        if (p.user && ms.uc) x += (ms.uc.instr.stance - 1) * (inPoss ? 3 : 4);
        const cap = inPoss ? (p.run === RUN.BEHIND || p.run === RUN.BLIND || p.run === RUN.PRED || p.run === RUN.NEAR || p.run === RUN.FAR ? 93 : 87.5) : 96;
        if (x < 6) x = 6; else if (x > cap) x = cap;
        if (y < 3) y = 3; else if (y > 97) y = 97;
      }
      p.x = t === 0 ? x : 100 - x;
      p.y = t === 0 ? y : 100 - y;
    }
  }
  if (ms.car >= 0) { const c = ms.pl[ms.car]; c.x = ms.bx; c.y = ms.by; }
}

/** Sets ms.press (0..1) and ms.nd (nearest defender idx) for the current carrier. */
function pressure(ms: MatchState): void {
  const dt = 1 - ms.poss;
  const D = ms.teams[dt];
  let d1 = 99, d2 = 99, n1 = -1;
  for (let k = 0; k < D.on.length; k++) {
    const p = ms.pl[D.on[k]];
    if (p.line === 0 || p.beat > 0) continue;
    const d = dist(p.x, p.y, ms.bx, ms.by);
    if (d < d1) { d2 = d1; d1 = d; n1 = D.on[k]; } else if (d < d2) d2 = d;
  }
  ms.nd = n1;
  if (n1 < 0) { ms.press = 0; return; }
  const nd = ms.pl[n1];
  const close = 3 + 6 * D.tac.press * (0.5 + nd.st / 200) + (nd.user && ms.uc ? (ms.uc.instr.press - 1) * 2 : 0);
  const e1 = Math.max(1, d1 - close);
  let pr = clamp((12 - e1) / 12, 0, 1) * (0.55 + 0.45 * D.tac.press) + 0.25 * clamp((10 - d2) / 10, 0, 1);
  // crowding: space disappears as play approaches the penalty area (unless the carrier was played clean through)
  const cax = ax(ms.poss, ms.bx);
  if (cax > 58) pr += ((cax - 58) / 42) * 0.6 * (ms.arr === ARR.THROUGH ? 0.6 : 1) * (1.25 - D.tac.line * 0.5);
  if (ms.hold > 0) pr *= 0.6;
  if (nd.focus === 1) pr += 0.2;
  ms.press = pr > 1 ? 1 : pr;
}

function nearestOpp(ms: MatchState, t: number, x: number, y: number, skipBeat = true): { i: number; d: number } {
  const D = ms.teams[1 - t];
  let best = 99, bi = -1;
  for (let k = 0; k < D.on.length; k++) {
    const p = ms.pl[D.on[k]];
    if (p.line === 0 || (skipBeat && p.beat > 0)) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < best) { best = d; bi = D.on[k]; }
  }
  return { i: bi, d: best };
}

/** Closest approach of any defender to the passing lane, ignoring those already on the passer. */
function laneRisk(ms: MatchState, t: number, x1: number, y1: number, x2: number, y2: number): { r: number; i: number } {
  const D = ms.teams[1 - t];
  const vx = (x2 - x1) * LX, vy = (y2 - y1) * LY;
  const len2 = vx * vx + vy * vy || 1;
  let best = 99, bi = -1;
  for (let k = 0; k < D.on.length; k++) {
    const p = ms.pl[D.on[k]];
    if (p.line === 0 || p.beat > 0) continue;
    const wx = (p.x - x1) * LX, wy = (p.y - y1) * LY;
    let u = (wx * vx + wy * vy) / len2;
    if (u < 0.15) continue;
    if (u > 1) u = 1;
    const dx = wx - u * vx, dy = wy - u * vy;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (p.focus === 3) d -= 2.5;
    d -= p.m[M.INTERCEPT] * 8;
    if (d < best) { best = d; bi = D.on[k]; }
  }
  return { r: clamp((6 - best) / 6, 0, 1), i: bi };
}

// ───────────────────────────── stats, flow, events ─────────────────────────────
function touch(p: MPlayer): void { p.s[S.TCH]++; }

function flowGain(ms: MatchState, p: MPlayer, base: number, type: 'goal' | 'key' | 'dribble' | 'duel' | 'defend', opp?: MPlayer): void {
  if (!p.canFlow || p.flEnd > ms.play) return;
  let g = base * (1 + p.m[M.FLOW_GAIN]) * Math.pow(FLOW.reentryPenalty, p.flN);
  if (p.user && ms.uc) {
    g *= ms.uc.gain[type];
    if (opp && opp.ovr > p.ovr + 2) g *= ms.uc.gain.challenge;
    g *= 0.8 + ms.uc.realism * 0.2;
  } else if (opp && opp.ovr > p.ovr + 2) g *= 1.3;
  g *= 1 + ms.imp * 0.25 + Math.min(p.streak, 4) * 0.08;
  if (ms.score[p.t] < ms.score[1 - p.t]) g *= 1.15;
  p.fl = Math.min(FLOW.max, p.fl + g);
  p.streak++;
  if (p.fl >= FLOW.max && !(p.user && ms.uc && !ms.uc.autoFlow && ms.uc.mode !== 'sim')) enterFlow(ms, p);
}
function flowLoss(p: MPlayer, v: number): void { if (p.canFlow) { p.fl = Math.max(0, p.fl - v); p.streak = 0; } }
function enterFlow(ms: MatchState, p: MPlayer): void {
  p.flEnd = ms.play + FLOW.baseDuration * (0.85 + 0.06 * (p.ab.find((a) => abilityDef(a.id)?.kind === 'ultimate')?.lv ?? 1));
  p.flN++;
  p.fl = 0;
  emit(ms, 'flow', p.t, ms.pl.indexOf(p), -1, 0, say(ms, 'flow', p.nm), 3);
}
function tickFlow(ms: MatchState, dt: number): void {
  for (let t = 0; t < 2; t++) {
    const on = ms.teams[t].on;
    for (let k = 0; k < on.length; k++) {
      const p = ms.pl[on[k]];
      if (!p.canFlow) continue;
      if (p.flEnd > 0 && p.flEnd <= ms.play) {
        p.flEnd = 0; p.st = Math.max(5, p.st - FLOW.crashStamina);
        emit(ms, 'flow_end', p.t, on[k], -1, 0, say(ms, 'flow_end', p.nm), 1);
      } else if (p.flEnd === 0 && p.fl > 0) p.fl = Math.max(0, p.fl - (FLOW.decayPerMin * dt) / 60);
    }
  }
}

function memo(ms: MatchState, idx: number) {
  const u = ms.uc!;
  return (u.memo[idx] ??= { pt: 0, pf: 0, at: 0, af: 0, ign: 0, iIgn: 0, dw: 0, dl: 0, fouled: 0 });
}

/** Best matching triggered ability for a context. Returns logit bonuses by mod index. */
function actFor(ms: MatchState, p: MPlayer, ctx: ActCtx): { id: string; sta: number; fx: { k: number; v: number }[]; name: string } | null {
  for (let i = 0; i < p.ab.length; i++) {
    const d = abilityDef(p.ab[i].id);
    if (!d || !d.act || d.act.ctx !== ctx) continue;
    const scale = ABSCALE;
    const uses = p.abN[d.id] ?? 0;
    // counterplay: every repeat in a match is easier to read, more so against prepared opponents
    const read = Math.max(0.4, 1 - uses * (0.12 + ms.teams[1 - p.t].fam * 0.1));
    const fx = actValue({ id: d.id, lv: p.ab[i].lv, xp: 0 }, d, scale * read);
    return { id: d.id, sta: d.act.sta, fx, name: d.act.name };
  }
  return null;
}
function actBonus(act: { fx: { k: number; v: number }[] } | null, k: number): number {
  if (!act) return 0;
  for (let i = 0; i < act.fx.length; i++) if (act.fx[i].k === k) return act.fx[i].v;
  return 0;
}
function useAbility(ms: MatchState, p: MPlayer, id: string, sta: number, announce: boolean): void {
  p.abN[id] = (p.abN[id] ?? 0) + 1;
  p.st = Math.max(1, p.st - sta);
  if (ms.uc) {
    if (p.user) ms.uc.used[id] = (ms.uc.used[id] ?? 0) + 1;
    else if (ms.pl[ms.uc.idx].on) ms.uc.seen[id] = (ms.uc.seen[id] ?? 0) + 1;
  }
  if (announce && ms.verb > 0) emit(ms, 'ability', p.t, ms.pl.indexOf(p), -1, 0, abilityLine(ms, id, p.nm), 2);
}
function ultOf(p: MPlayer, key: string): { id: string; lv: number } | null {
  for (let i = 0; i < p.ab.length; i++) { const d = abilityDef(p.ab[i].id); if (d && d.ult === key) return p.ab[i]; }
  return null;
}
function canUlt(ms: MatchState, p: MPlayer, key: string): { id: string; lv: number } | null {
  // ultimates need Flow — except that the user may unleash theirs once per match without it, once the match has settled
  const settled = ms.rules.kind === 'nel' ? ms.play >= 900 : ms.clock >= 1500;
  if (p.flEnd <= ms.play && !(p.user && p.ultN === 0 && settled)) return null;
  const u = ultOf(p, key);
  if (!u || p.ultN >= usesPerMatch(u.lv)) return null;
  return u;
}
/** The most recent ultimate of a match (not saved): a goal that follows it is replayed with that ultimate's effects. */
const LAST_ULT = new WeakMap<MatchState, { key: string; idx: number; step: number }>();
function spendUlt(ms: MatchState, p: MPlayer, id: string, sta: number): void {
  LAST_FREE.set(ms, p.flEnd <= ms.play);
  p.ultN++;
  LAST_ULT.set(ms, { key: abilityDef(id)?.ult ?? '', idx: ms.pl.indexOf(p), step: ms.steps });
  if (ms.uc && ms.uc.mode !== 'sim') { const d = abilityDef(id); (ms.ults ??= []).push({ n: (ms.ults.length ? ms.ults[ms.ults.length - 1].n : 0) + 1, key: d?.ult ?? '', name: d?.name ?? 'Ultimate', idx: ms.pl.indexOf(p), t: p.t, x: p.x, y: p.y, min: goalMinute(ms) }); if (ms.ults.length > 12) ms.ults.shift(); }
  const left = p.flEnd - ms.play;
  p.flEnd = ms.play + Math.max(left * (1 - FLOW.ultimateShare), Math.min(left, 20));
  useAbility(ms, p, id, sta, true);
}

// ───────────────────────────── possession changes & restarts ─────────────────────────────
function clearRuns(ms: MatchState): void {
  for (let i = 0; i < ms.pl.length; i++) { const p = ms.pl[i]; if (p.on) { p.run = 0; p.runT = 0; p.open = false; p.req = 0; p.focus = 0; } }
}
function give(ms: MatchState, idx: number, x: number, y: number, arr: number): void {
  const p = ms.pl[idx];
  if (p.t !== ms.poss) { ms.poss = p.t; ms.seq++; ms.seqPasses = 0; ms.seqStart = ms.play; ms.from = -1; clearRuns(ms); ms.hold = 0; }
  ms.car = idx; ms.bx = clamp(x, 1, 99); ms.by = clamp(y, 2, 98); ms.arr = arr; ms.bh = 0;
  touch(p);
}
function loose(ms: MatchState, x: number, y: number): void {
  ms.car = -1; ms.bx = clamp(x, 2, 98); ms.by = clamp(y, 3, 97); ms.arr = ARR.LOOSE; ms.bh = 0;
}
function setRestart(ms: MatchState, k: number, t: 0 | 1, x: number, y: number): void {
  ms.restart = { k, t, x, y }; ms.car = -1;
}

function pickTaker(ms: MatchState, t: number, fn: (p: MPlayer) => number): number {
  const on = ms.teams[t].on;
  let best = -1e9, bi = on[0];
  for (let k = 0; k < on.length; k++) { const p = ms.pl[on[k]]; if (p.line === 0) continue; const v = fn(p); if (v > best) { best = v; bi = on[k]; } }
  return bi;
}

function doRestart(ms: MatchState, rng: Rng): void {
  const r = ms.restart!;
  ms.restart = null;
  manageSubs(ms, rng);
  const t = r.t;
  if (ms.poss !== t) { ms.poss = t; ms.seq++; ms.seqPasses = 0; ms.seqStart = ms.play; clearRuns(ms); }
  ms.from = -1; ms.hold = 0; ms.note = '';
  const M2 = machineOf(ms);
  switch (r.k) {
    case RST.KICKOFF: {
      const i = pickTaker(ms, t, (p) => (p.line === 2 ? 10 : 0) - Math.abs(p.by - 50) / 10);
      ms.bx = 50; ms.by = 50; shape(ms); give(ms, i, t === 0 ? 49 : 51, 50, ARR.SET);
      M2.time(ms, 0, 0, 0);
      break;
    }
    case RST.GOALKICK: case RST.GKHOLD: {
      const g = gkOf(ms, t);
      const i = g ? ms.pl.indexOf(g) : ms.teams[t].on[0];
      ms.bx = t === 0 ? 6 : 94; ms.by = 50; shape(ms); give(ms, i, ms.bx, 50, ARR.SET);
      M2.time(ms, 0, r.k === RST.GOALKICK ? 22 : 6, 0);
      break;
    }
    case RST.THROW: {
      ms.bx = clamp(r.x, 3, 97); ms.by = r.y < 50 ? 3 : 97; shape(ms);
      const i = pickTaker(ms, t, (p) => -dist(p.x, p.y, ms.bx, ms.by));
      give(ms, i, ms.bx, ms.by, ARR.SET);
      M2.time(ms, 0, 9, 0);
      break;
    }
    case RST.CORNER: doCorner(ms, rng, t); break;
    case RST.FREEKICK: {
      ms.bx = clamp(r.x, 3, 97); ms.by = clamp(r.y, 3, 97); shape(ms);
      const bA = ax(t, ms.bx);
      M2.time(ms, 0, 22, 0);
      if (bA >= 70 && bA <= 86 && Math.abs(ms.by - 50) <= 24) {
        const i = pickTaker(ms, t, (p) => p.a[A.LSH] * 0.45 + p.a[A.CRO] * 0.3 + p.a[A.SHP] * 0.25 + (p.user ? 2 : 0) + (ultOf(p, 'fk') ? 15 : 0) + Math.min(0, ((p.age ?? 24) - 19) * 3));
        give(ms, i, ms.bx, ms.by, ARR.SET); ms.note = 'fk';
      } else if (bA > 66) {
        const i = pickTaker(ms, t, (p) => p.a[A.CRO]);
        give(ms, i, ms.bx, ms.by, ARR.SET); ms.note = 'fkc';
      } else {
        const i = pickTaker(ms, t, (p) => -dist(p.x, p.y, ms.bx, ms.by));
        give(ms, i, ms.bx, ms.by, ARR.SET);
      }
      break;
    }
    case RST.PENALTY: {
      // the designated taker: a senior forward or the team's star with good technique from the spot. Kids and holding
      // midfielders only get the ball if they really are the best option, and the user earns the job like anyone else.
      const i = pickTaker(ms, t, (p) => {
        const age = p.age ?? 24, pos = p.pos;
        const posB = p.line === 3 ? 7 : pos === 'AM' || pos === 'SS' || pos === 'LW' || pos === 'RW' ? 4 : p.line === 2 ? -1 : -5;
        const roleB = p.role === 'star' ? 7 : p.role === 'key' ? 3 : p.role === 'prospect' || p.role === 'development' ? -6 : 0;
        const ageB = age < 19 ? -(19 - age) * 4 : Math.min(4, (age - 19) * 0.6);
        const meB = p.user && ms.uc ? (ms.uc.trust - 50) / 12 : 0;
        return p.a[A.PEN] * 0.6 + p.a[A.COM] * 0.2 + p.ovr * 0.25 + posB + roleB + ageB + meB + p.ego * 0.02;
      });
      ms.bx = t === 0 ? 89.5 : 10.5; ms.by = 50; shape(ms); give(ms, i, ms.bx, 50, ARR.SET); ms.note = 'pen';
      M2.time(ms, 0, 70, 30);
      break;
    }
  }
}

function doCorner(ms: MatchState, rng: Rng, t: 0 | 1): void {
  const M2 = machineOf(ms);
  M2.time(ms, 4, 26, 0);
  const side = rng.chance(0.5) ? 4 : 96;
  ms.bx = t === 0 ? 98 : 2; ms.by = side; shape(ms);
  // two corner takers, one for each side, so a single crosser doesn't collect every set-piece assist
  const tk1 = pickTaker(ms, t, (p) => p.a[A.CRO] + (p.line === 3 ? -6 : 0));
  const tk2 = pickTaker(ms, t, (p) => (ms.pl.indexOf(p) === tk1 ? -999 : p.a[A.CRO] + (p.line === 3 ? -6 : 0)));
  const taker = ms.pl[side === 4 || ms.pl[tk2].a[A.CRO] < ms.pl[tk1].a[A.CRO] - 14 ? tk1 : tk2];
  const tgtI = pickTaker(ms, t, (p) => (p === taker ? -999 : airSk(ms, p) + (p.line === 1 ? 4 : 0) + rng.next() * 14));
  const tgt = ms.pl[tgtI];
  const defI = pickTaker(ms, 1 - t, (p) => airSk(ms, p) + rng.next() * 12);
  const def = ms.pl[defI];
  const ti = ms.pl.indexOf(taker);
  taker.s[S.PA]++; touch(taker);
  const act = actFor(ms, taker, 'cross');
  const p = sig((airSk(ms, tgt) - airSk(ms, def)) / 12 + (at(ms, taker, A.CRO) - 65) / 40 - 0.55 + taker.m[M.PA_CROSS] + tgt.m[M.AERIAL] - def.m[M.AERIAL] + (act && rng.chance(0.5) ? actBonus(act, M.PA_CROSS) : 0));
  if (ms.verb > 1) emit(ms, 'corner', t, ti, -1, 0, say(ms, 'corner', '', '', ms.teams[t].name), 0);
  if (rng.next() < p) {
    taker.s[S.PC]++; tgt.s[S.AW]++; def.s[S.AL]++;
    ms.poss = t; ms.from = ti; ms.fromT = ms.play;
    give(ms, tgtI, t === 0 ? 91 + rng.next() * 4 : 9 - rng.next() * 4, 42 + rng.next() * 16, ARR.CROSS);
    ms.bh = 2; ms.press = 0.45; ms.nd = defI;
    resolveShot(ms, rng, tgt, 'header', null, '');
  } else {
    def.s[S.AW]++; def.s[S.CLR]++; tgt.s[S.AL]++;
    if (ms.verb > 1) emit(ms, 'clear', 1 - t, defI, -1, 0, say(ms, 'corner_clear', '', def.nm), 0);
    const r = rng.next();
    if (r < 0.58) { const i = pickTaker(ms, 1 - t, (q) => (q.line >= 2 ? 5 : 0) + rng.next() * 6); give(ms, i, t === 0 ? 72 : 28, 30 + rng.next() * 40, ARR.LOOSE); }
    else if (r < 0.84) { const i = pickTaker(ms, t, (q) => (q.line === 2 ? 5 : 0) + rng.next() * 6); ms.poss = t; give(ms, i, t === 0 ? 76 : 24, 35 + rng.next() * 30, ARR.LOOSE); }
    else setRestart(ms, RST.THROW, t, t === 0 ? 88 : 12, side);
  }
}

// ───────────────────────────── substitutions & Star Change ─────────────────────────────
function swap(ms: MatchState, t: number, offI: number, onI: number, star: boolean): void {
  const T = ms.teams[t];
  const off = ms.pl[offI], on = ms.pl[onI];
  const k = T.on.indexOf(offI);
  if (k < 0) return;
  T.on[k] = onI;
  const b = T.bench.indexOf(onI);
  if (b >= 0) T.bench.splice(b, 1);
  on.bx = off.bx; on.by = off.by; on.x = off.x; on.y = off.y; on.line = off.line; on.pos = off.line === 0 ? 'GK' : on.pos;
  on.on = true; on.used = true; if (on.s[S.APP] === 0) on.s[S.APP] = 1;
  off.on = false; off.run = 0; off.open = false;
  if (ms.car === offI) { ms.car = onI; }
  ms.subsLog.push({ c: Math.floor(ms.clock), t, off: offI, on: onI, star });
}

function manageSubs(ms: MatchState, rng: Rng): void {
  for (let t = 0; t < 2; t++) {
    const T = ms.teams[t];
    // injuries first
    for (let k = 0; k < T.on.length; k++) {
      const p = ms.pl[T.on[k]];
      if (p.inj > 0 && p.on) {
        const repl = bestBench(ms, t, p);
        if (repl >= 0 && T.subs < ms.rules.subs) { T.subs++; emit(ms, 'sub', t, repl, T.on[k], 0, say(ms, 'sub', ms.pl[repl].nm, p.nm, T.name), 1); swap(ms, t, T.on[k], repl, false); machineOf(ms).time(ms, 0, 25, 25); }
        else { p.on = false; T.on.splice(k, 1); k--; }
      }
    }
    // Star Change (NEL only)
    if (ms.rules.starChange && T.star >= 0 && T.starState === 0 && ms.play > 1200) {
      const tgt = ms.rules.goalTarget;
      const trigger = ms.score[t] === tgt - 1 || ms.score[1 - t] === tgt - 1 || ms.play > 2700 || (ms.score[t] < ms.score[1 - t] && ms.play > 1800);
      if (trigger) {
        let off = -1, worst = 1e9;
        for (let k = 0; k < T.on.length; k++) {
          const p = ms.pl[T.on[k]];
          if (p.line < 2 || p.pos === 'DM') continue;
          let v = liveRating(p) * 10 + p.st * 0.3 + p.ovr * 0.4 - (p.line === 3 ? 6 : 0);
          if (p.user) v += liveRating(p) >= 6 ? 60 : 4;
          if (v < worst) { worst = v; off = T.on[k]; }
        }
        if (off >= 0) {
          T.starState = 1; T.starEnd = ms.play + ms.rules.starSec; T.starFor = off;
          const star = ms.pl[T.star];
          emit(ms, 'star_on', t, T.star, off, 0, say(ms, 'star_on', star.nm, '', T.name), 3);
          swap(ms, t, off, T.star, true);
        }
      }
    }
    // a benched user gets late minutes when the coach planned a cameo
    if (ms.uc && ms.uc.cameo && T.subs < ms.rules.subs) {
      const me = ms.pl[ms.uc.idx];
      const late = ms.rules.kind === 'nel' ? (ms.play >= 1500 || Math.max(ms.score[0], ms.score[1]) >= ms.rules.goalTarget - 1) : ms.clock >= 4080;
      if (me.t === t && !me.used && !me.on && me.inj <= 0 && late && T.bench.includes(ms.uc.idx)) { ms.uc.cameo = 0; bringOnUser(ms, t); }
    }
    // tactical substitutions
    if (T.subs < ms.rules.subs && T.bench.length && (ms.rules.kind === 'nel' ? ms.play : ms.clock) >= T.nextSub) {
      T.nextSub += ms.rules.kind === 'nel' ? 560 : 520;
      let off = -1, worst = 1e9;
      for (let k = 0; k < T.on.length; k++) {
        const p = ms.pl[T.on[k]];
        if (p.line === 0 || p.star) continue;
        let v = p.st * 0.9 + liveRating(p) * 9 + (p.yc ? -4 : 0);
        if (p.user) v += liveRating(p) >= 6.2 ? 40 : 0;
        if (v < worst) { worst = v; off = T.on[k]; }
      }
      if (off >= 0) {
        const repl = bestBench(ms, t, ms.pl[off]);
        if (repl >= 0 && (ms.pl[off].st < 62 || liveRating(ms.pl[off]) < 6.1 || rng.chance(0.35))) {
          T.subs++;
          emit(ms, 'sub', t, repl, off, 0, say(ms, 'sub', ms.pl[repl].nm, ms.pl[off].nm, T.name), 1);
          swap(ms, t, off, repl, false);
          machineOf(ms).time(ms, 0, 25, 25);
        }
      }
    }
  }
}
/** Swap the user in for the most tired / worst-performing team-mate in a similar role. */
function bringOnUser(ms: MatchState, t: number): boolean {
  const T = ms.teams[t];
  const me = ms.pl[ms.uc!.idx];
  const myLine = me.pos === 'GK' ? 0 : me.pos === 'CB' || me.pos === 'LB' || me.pos === 'RB' ? 1 : me.pos === 'LW' || me.pos === 'RW' || me.pos === 'SS' || me.pos === 'ST' ? 3 : 2;
  let off = -1, worst = 1e9;
  for (let k = 0; k < T.on.length; k++) {
    const p = ms.pl[T.on[k]];
    if ((p.line === 0) !== (myLine === 0) || p.star) continue;
    const v = p.st * 0.9 + liveRating(p) * 9 + Math.abs(p.line - myLine) * 30;
    if (v < worst) { worst = v; off = T.on[k]; }
  }
  if (off < 0) return false;
  T.subs++;
  emit(ms, 'sub', t, ms.uc!.idx, off, 0, say(ms, 'sub', me.nm, ms.pl[off].nm, T.name), 2);
  swap(ms, t, off, ms.uc!.idx, false);
  machineOf(ms).time(ms, 0, 25, 25);
  return true;
}
/**
 * The user asks the coach to bring them on. Chance depends on coach trust, how late it is, the score and how
 * often they have already asked. Deterministic for a given match state.
 */
export function subChance(ms: MatchState): number {
  const u = ms.uc; if (!u) return 0;
  const me = ms.pl[u.idx]; const T = ms.teams[me.t];
  if (me.used || me.on || me.inj > 0 || T.subs >= ms.rules.subs || !T.bench.includes(u.idx) || ms.done) return 0;
  const prog = ms.rules.kind === 'nel' ? clamp(ms.play / 2400, 0, 1) : clamp(ms.clock / 5400, 0, 1);
  const diff = ms.score[me.t] - ms.score[1 - me.t];
  return clamp(0.12 + u.trust / 180 + prog * 0.35 + (diff < 0 ? 0.15 : diff > 1 ? 0.1 : 0) - u.asked * 0.22, 0.03, 0.92);
}
export function requestSub(ms: MatchState): { ok: boolean; text: string } {
  const u = ms.uc;
  const p = subChance(ms);
  if (!u || p <= 0) return { ok: false, text: 'No substitution is possible right now.' };
  const rng = new Rng(ms.rng);
  const me = ms.pl[u.idx];
  const ok = rng.chance(p) && bringOnUser(ms, me.t);
  u.asked++;
  if (!ok) u.trust = Math.max(0, u.trust - 1.5);
  return { ok, text: ok ? 'The coach nods. You are going on!' : u.asked > 1 ? 'The coach waves you away — asking again is not helping.' : 'The coach shakes his head: "Not yet. Stay ready."' };
}
function bestBench(ms: MatchState, t: number, off: MPlayer): number {
  const T = ms.teams[t];
  let best = -1, bv = -1;
  for (let k = 0; k < T.bench.length; k++) {
    const p = ms.pl[T.bench[k]];
    if (p.used || p.inj > 0 || p.star) continue;
    if ((off.line === 0) !== (p.pos === 'GK')) continue;
    const lineOf = p.pos === 'GK' ? 0 : p.pos === 'CB' || p.pos === 'LB' || p.pos === 'RB' ? 1 : p.pos === 'LW' || p.pos === 'RW' || p.pos === 'SS' || p.pos === 'ST' ? 3 : 2;
    const v = p.ovr - Math.abs(lineOf - off.line) * 5 + (p.user ? 3 : 0);
    if (v > bv) { bv = v; best = T.bench[k]; }
  }
  return best;
}
/** Star Change expiry: the master striker MUST leave once the permitted playing time has elapsed. */
function checkStar(ms: MatchState): void {
  for (let t = 0; t < 2; t++) {
    const T = ms.teams[t];
    if (T.starState === 1 && ms.play >= T.starEnd) {
      T.starState = 2;
      const star = ms.pl[T.star];
      const back = ms.pl[T.starFor];
      emit(ms, 'star_off', t, T.star, T.starFor, 0, say(ms, 'star_off', star.nm), 2);
      if (T.on.indexOf(T.star) < 0) continue;
      let repl = T.starFor;
      if (back.inj > 0 || back.rc) repl = bestBench(ms, t, star);
      if (repl >= 0) {
        const k = T.on.indexOf(T.star);
        T.on[k] = repl;
        const r = ms.pl[repl];
        r.on = true; r.bx = star.bx; r.by = star.by; r.x = star.x; r.y = star.y; r.line = star.line;
        if (!r.used) { r.used = true; r.s[S.APP] = 1; const b = T.bench.indexOf(repl); if (b >= 0) T.bench.splice(b, 1); }
        ms.subsLog.push({ c: Math.floor(ms.clock), t, off: T.star, on: repl, star: true });
        if (ms.car === T.star) ms.car = repl;
      } else T.on.splice(T.on.indexOf(T.star), 1);
      star.on = false;
    }
  }
}

// ───────────────────────────── ratings ─────────────────────────────
/** Position-aware match rating from the stat line (6.0 baseline). */
export function ratingOf(p: MPlayer, gf: number, ga: number, win: number): number {
  const s = p.s;
  let r = 6.0;
  const line = p.line;
  r += s[S.G] * (line === 3 ? 1.05 : line === 2 ? 1.2 : 1.35) + s[S.A] * 0.75;
  r += Math.min(1.2, s[S.KP] * 0.22) + Math.min(0.6, (s[S.SOT] - s[S.G]) * 0.12) - s[S.BCM] * 0.3 - Math.min(0.4, (s[S.SH] - s[S.SOT]) * 0.04) + Math.min(0.3, s[S.TCH] / 260);
  r += Math.min(0.9, s[S.DC] * 0.16) - Math.min(0.5, (s[S.DA] - s[S.DC]) * 0.06);
  const pa = s[S.PA];
  if (pa > 0) r += clamp((s[S.PC] - (pa - s[S.PC]) * 3.2) * 0.013, -0.7, 0.8) * (line === 2 ? 1.25 : 1);
  const defW = line === 1 ? 0.2 : line === 2 ? 0.16 : 0.1;
  r += Math.min(1.5, (s[S.TKW] + s[S.INT] + s[S.BLK] * 1.2) * defW + s[S.CLR] * 0.07) - (s[S.TKA] - s[S.TKW]) * 0.04;
  r += Math.min(0.5, s[S.AW] * 0.07) - Math.min(0.3, s[S.AL] * 0.04);
  r -= s[S.YC] * 0.25 + s[S.RC] * 1.3 + s[S.OG] * 0.9 + s[S.PENM] * 0.5 + Math.min(0.6, s[S.LOST] * 0.035) + s[S.FC] * 0.05;
  if (line === 0) r += Math.min(2.2, s[S.SV] * 0.3) - s[S.GC] * 0.42 + (s[S.GC] === 0 ? 0.6 : 0);
  else if (line === 1) r += (s[S.GC] === 0 ? 0.55 : -Math.min(1.1, s[S.GC] * 0.24));
  else if (line === 2) r += s[S.GC] === 0 ? 0.2 : -Math.min(0.5, s[S.GC] * 0.1);
  r += win * 0.25 + (gf - ga) * 0.03;
  return clamp(Math.round(r * 10) / 10, 3, 10);
}
function liveRating(p: MPlayer): number { return ratingOf(p, 0, 0, 0); }

// ───────────────────────────── options ─────────────────────────────
function riskLabel(p: number): string { return p >= 0.8 ? 'Safe' : p >= 0.58 ? 'Moderate' : p >= 0.35 ? 'Risky' : 'Audacious'; }

/** Global finishing offset applied to the xG logit (calibrated so league-wide goals ≈ xG). */
const SHOT_OFFSET = 0;
/** Utility cost of shooting: higher values make players wait for better chances (fewer, better shots). */
const SHOT_COST = 0.15;
const LONG_COST = 0.017;
/** First-to-three matches are about patience: chances are rarer so a match lasts about an hour of playing time. */
const NEL_EXTRA = -0.02;
function shotCalc(ms: MatchState, c: MPlayer, v: string, act: { fx: { k: number; v: number }[] } | null, ult: string): { xg: number; p: number; d: number; theta: number } {
  const t = c.t;
  const cax = ax(t, ms.bx);
  const g = shotGeo(cax, ms.by);
  if (v === 'pen') {
    const gk = gkOf(ms, 1 - t);
    const p = logistic(logit(PENALTY_XG) + (shotSk(ms, c, 'pen') - gkSk(gk)) / 30 + c.m[GB] + (c.user && ms.uc ? ms.uc.forgive : 0));
    return { xg: PENALTY_XG, p: clamp(p, 0.4, 0.95), d: g.d, theta: g.theta };
  }
  let press = v === 'fk' ? 0.35 : ms.press;
  // attention: a striker who keeps shooting gets marked tighter. It lowers his real chance but not the chance quality (xG).
  const attn = v !== 'fk' ? Math.min(0.7, c.mk * 0.5 + c.s[S.SH] * 0.04 + c.s[S.G] * 0.18) : 0;
  if (v === 'first' || v === 'header' || v === 'volley') press *= 0.8; // defenders have less time to close a first-time strike
  if (v === 'placed' && ms.arr !== ARR.SET) press = Math.min(1, press + 0.12); // taking a touch invites pressure
  const header = v === 'header', volley = v === 'volley';
  const one = ms.arr === ARR.THROUGH && press < 0.42 && cax > 78;
  const xl = xgLogit(g, { header, volley, pressure: press, oneOnOne: one, rebound: ms.arr === ARR.REBOUND, cutback: v === 'first' && ms.arr === ARR.GROUND });
  const xg = logistic(xl);
  const gk = gkOf(ms, 1 - t);
  let l = xl - SHOT_OFFSET - attn + cz(shotSk(ms, c, v) - gkSk(gk)) / 60 + c.m[GB] + ms.esc;
  // composure wins back part of the pressure penalty
  const comp = clamp((at(ms, c, A.COM) - DQ[1 - c.t] - 6) / 110, -0.15, 0.32) + c.m[M.COMPOSURE] + c.m[M.SH_PRESS] + actBonus(act, M.SH_PRESS);
  l += 0.5 * press * clamp(comp, -0.15, 0.85);
  if (header) l += c.m[M.SH_HEAD] + actBonus(act, M.SH_HEAD);
  else if (volley) l += c.m[M.SH_VOLLEY] + actBonus(act, M.SH_VOLLEY) + actBonus(act, M.SH_PLACED);
  else if (v === 'long' || v === 'fk') l += c.m[M.SH_LONG] + actBonus(act, M.SH_LONG) + c.m[M.SH_POWER] * 0.5;
  else if (v === 'power') l += c.m[M.SH_POWER] + actBonus(act, M.SH_POWER) + 0.05;
  else l += c.m[M.SH_PLACED] + actBonus(act, M.SH_PLACED);
  if (v === 'first') l += c.m[M.SH_FIRST] + actBonus(act, M.SH_FIRST) + actBonus(act, M.SH_POWER) * 0.5;
  if (one) l += c.m[M.SH_1V1] + actBonus(act, M.SH_1V1);
  if (g.d > 18 && v !== 'long' && v !== 'fk') l += (c.m[M.SH_LONG] + actBonus(act, M.SH_LONG)) * 0.6;
  if (g.theta < 0.4 && !header) l += (c.m[M.SH_ANGLE] + actBonus(act, M.SH_ANGLE)) * (1 - g.theta / 0.4) * 1.6;
  if (cax > 83) l += c.m[M.BOX_POS] * 0.35;
  // weak-foot expectation (averaged, so the builder stays RNG-free): the ball falls to the weaker side ~30% of the time
  if (c.foot !== 2 && !header) l -= 0.3 * (1 - c.a[A.WFT] / 100) * 1.1 * (1 - Math.min(0.9, c.m[M.SH_WEAK] + actBonus(act, M.SH_WEAK)));
  if (c.user && ms.uc) l += ms.uc.forgive;
  let p = logistic(l);
  // skill and weapons move the chance around its xG, but never far: the number on screen stays honest
  p = clamp(p, xg * 0.3, xg * 1.25 + 0.04);
  if (ult === 'zero') p = logistic(l + 0.25 + 0.5 * press * 0.5);
  return { xg, p: clamp(p, 0.004, 0.93), d: g.d, theta: g.theta };
}

/** Dead Angle Genesis: an invented finish from a difficult position. Spectacular, never guaranteed. */
function dagCalc(ms: MatchState, c: MPlayer, v: string, lv: number): number {
  const cax = ax(c.t, ms.bx);
  const g = shotGeo(cax, ms.by);
  const tech = at(ms, c, A.VOL) * 0.3 + at(ms, c, A.FIN) * 0.3 + at(ms, c, A.AGI) * 0.2 + at(ms, c, A.BAL) * 0.2;
  // how well the ball height suits the chosen finish
  const want = v === 'scissor' ? 2 : v === 'volley' ? 1 : 0;
  const fit = 1 - Math.abs(ms.bh - want) * 0.5;
  const space = 1 - ms.press;
  const gk = gkOf(ms, 1 - c.t);
  let l = -1.25 + 1.6 * Math.max(g.theta, 0.45) - 0.1 * g.d - 0.6 * ms.press; // angle floor + halved pressure penalty
  l += (tech - 70) / 14 + (fit - 0.5) * 1.0 - 0.35 * (1 - space) - 0.6 + lv * 0.08;
  l -= (gkSk(gk) * 0.9 - 65) / 28; // the keeper is caught by surprise
  l += (at(ms, c, A.BAL) - 65) / 60 * ms.press; // balance matters under contact
  if (c.user && ms.uc) l += ms.uc.forgive + (ms.uc.realism - 1) * 0.15;
  return clamp(logistic(l), 0.03, 0.6);
}

const OPTS: Option[] = [];
function opt(kind: string, id: string, p: number, u: number, tgt: number, v: string): Option {
  const o: Option = { id, kind, label: '', detail: '', intent: '', risk: '', p, u, tgt, v, ab: '', sta: 0 };
  OPTS.push(o);
  return o;
}

function passCalc(ms: MatchState, c: MPlayer, mate: MPlayer, kind: string, tx: number, ty: number, act: { fx: { k: number; v: number }[] } | null, v = ''): { p: number; lane: number } {
  const d = dist(ms.bx, ms.by, tx, ty);
  const lob = v === 'lob';
  const long = d > 30 || kind === 'cross' || lob;
  const sk = passSk(ms, c, long);
  const no = nearestOpp(ms, c.t, tx, ty);
  let open = clamp((no.d - 1.5) / 9, 0, 1);
  if (mate.open) open = Math.max(open, 0.78);
  const lr = laneRisk(ms, c.t, ms.bx, ms.by, tx, ty);
  const disg = Math.min(0.8, c.m[M.PA_DISG] + actBonus(act, M.PA_DISG));
  const pres = ms.press * (1 - Math.min(0.85, c.m[M.PRESS_RES] + c.m[M.COMPOSURE]));
  let l: number;
  if (kind === 'through') l = 0.05 + c.m[M.PA_THROUGH] + actBonus(act, M.PA_THROUGH) + c.m[M.VISION] + actBonus(act, M.VISION) + (at(ms, c, A.VIS) - 65) / 30;
  else if (kind === 'cross') {
    const def = no.i >= 0 ? ms.pl[no.i] : null;
    l = -0.7 + c.m[M.PA_CROSS] + actBonus(act, M.PA_CROSS) + (at(ms, c, A.CRO) - 65) / 22 + (def ? (airSk(ms, mate) - airSk(ms, def)) / 18 + mate.m[M.AERIAL] - def.m[M.AERIAL] : 0.5);
  } else if (kind === 'cutback') l = 0.9 + c.m[M.PA_CROSS] * 0.6 + actBonus(act, M.PA_CROSS) * 0.6 + c.m[M.PA_SHORT];
  else if (long) l = 1.2 + c.m[M.PA_LONG] + actBonus(act, M.PA_LONG);
  else l = (d < 18 ? 3.5 : 2.9) + c.m[M.PA_SHORT] + actBonus(act, M.PA_SHORT);
  l += cz(sk - DQ[1 - c.t] - 11) / 17 - pres * 1.05 + (open - 0.5) * 1.2 - lr.r * (lob ? 0.2 : v === 'driven' ? 0.5 : kind === 'cross' || long ? 0.5 : 1.0) * (1 - disg) + c.m[GB] + actBonus(act, M.VISION) * 0.5;
  // lofted balls clear the lane but are harder to weight; driven balls beat the lane but are harder to take
  if (lob) l += (kind === 'through' ? -0.25 + c.m[M.PA_LONG] * 0.6 + actBonus(act, M.PA_LONG) * 0.6 : 0) - (d < 14 ? 0.5 : 0.1);
  else if (v === 'driven') l -= 0.3;
  const tax = ax(c.t, tx), cax0 = ax(c.t, ms.bx);
  if (tax < cax0 - 3) l += 0.6;
  else if (tax > cax0 + 8) l -= (tax - cax0 - 8) * 0.03; // the further forward, the harder the pass
  if (tax > 66 && !mate.open && kind !== 'cutback') l -= ((tax - 66) / 34) * 1.5; // congestion around the box
  { // a deep, compact block crowds the box: balls into it are harder against a low line (and easier against a high one)
    const DL = ms.teams[1 - c.t].tac.line;
    if (tax > 70) l -= (0.5 - DL) * (kind === 'through' ? 0.5 : 1.1);
  }
  const free = mate.open && lr.r < 0.35;
  if (tax > 74) l -= Math.min(2, mate.mk * 1.2 + mate.s[S.SH] * 0.12 + mate.s[S.G] * 0.7) * (free ? 0.45 : 1); // a man who keeps scoring is marked tighter
  if (free) l += kind === 'through' ? 0.35 : 0.7; // a free man with a clear lane is a simple ball
  if (c.user && ms.uc) { l += ms.uc.forgive + (mate.chem - 50) / 100 * 0.6 + (ms.uc.dominion > ms.play ? 0.5 : 0); }
  else if (mate.user) l += (mate.chem - 50) / 100 * 0.4;
  return { p: clamp(sig(l), 0.03, 0.985), lane: lr.i };
}

const CAND = new Array<number>(12);
const CRAW = new Array<number>(12);

function buildOptions(ms: MatchState, c: MPlayer, full: boolean): Option[] {
  OPTS.length = 0;
  const t = c.t;
  const T = ms.teams[t];
  const ci = ms.car;
  const cax = ax(t, ms.bx);
  const cy = ms.by;
  const isGk = c.line === 0;
  const fresh = ms.arr === ARR.GROUND || ms.arr === ARR.THROUGH || ms.arr === ARR.REBOUND || ms.arr === ARR.CROSS || ms.arr === ARR.LOFT;
  const loseCost = ev(100 - cax, 100 - cy) * 0.85;

  if (ms.note === 'pen') {
    const s = shotCalc(ms, c, 'pen', null, '');
    if (full) {
      const a = opt('shoot', 'pen:place', s.p, 1, -1, 'pen'); a.label = 'Place it in the corner'; a.detail = 'Side-foot into the corner. Reliable if you pick your spot.'; a.intent = 'Score'; a.risk = riskLabel(s.p);
      const b = opt('shoot', 'pen:power', clamp(s.p + 0.03, 0, 0.95), 0.9, -1, 'pen'); b.label = 'Blast it'; b.detail = 'Power down the middle-high. Harder to save, easier to miss the target.'; b.intent = 'Score'; b.risk = riskLabel(s.p - 0.1);
      const d = opt('shoot', 'pen:chip', clamp(s.p - 0.06 + (c.a[A.COM] - 70) / 200, 0.3, 0.95), 0.6, -1, 'pen'); d.label = 'Chip down the middle'; d.detail = 'Humiliate the keeper — if he dives. Composure decides it.'; d.intent = 'Statement'; d.risk = 'Audacious';
    } else opt('shoot', 'pen:place', s.p, 1, -1, 'pen');
    return OPTS;
  }

  // ── shots ──
  if (!isGk && cax >= 62) {
    const g = shotGeo(cax, cy);
    if (g.d <= 34) {
      const bias = 0.82 + c.ego / 380 + (c.line === 3 ? 0.1 : 0) + (T.tac.direct - 0.5) * 0.1;
      const inBox = g.d <= 18;
      const add = (v: string, id: string, label: string, detail: string, ab = '') => {
        const act = ab ? actFor(ms, c, ab as ActCtx) : null;
        const s = shotCalc(ms, c, v, act, '');
        // a speculative effort from distance costs far less than wasting a clear chance: the ball usually goes out for a
        // goal kick or a corner, or loops up off a defender, so players do try their luck from range now and then
        const long = v === 'long' && ms.note !== 'fk' && ms.rules.kind !== 'nel';
        const u = long
          ? (s.p * 0.9 + 0.006) * bias * (0.85 + (at(ms, c, A.LSH) - 60) / 120) - LONG_COST - (ms.rules.kind === 'nel' ? NEL_EXTRA * 0.5 : 0) - c.s[S.SH] * 0.006 - c.s[S.G] * 0.02 - c.mk * 0.03 - (ms.press > 0.7 ? 0.02 : 0)
          : (s.p * 0.9 + 0.008) * bias * (g.d > 16.5 ? 0.75 : 1) - SHOT_COST - (ms.rules.kind === 'nel' ? NEL_EXTRA : 0) - c.s[S.SH] * 0.04 - c.s[S.XG] * 0.06 - c.s[S.G] * 0.1 - c.mk * 0.12;
        const o = opt('shoot', id, s.p, u, -1, v);
        if (act) { o.ab = act.id; o.sta = act.sta; o.hot = true; }
        if (full) { o.label = label; o.detail = detail + ` (${Math.round(g.d)} m, xG ${s.xg.toFixed(2)})`; o.intent = 'Go for goal'; o.risk = riskLabel(Math.min(1, s.p * 2.4)); }
        return o;
      };
      if (ms.note === 'fk') add('fk', 'shoot:fk', 'Shoot from the free kick', 'Over or around the wall.');
      else if (fresh && ms.bh >= 1 && cax > 80) {
        if (ms.bh === 2) { const st = canUlt(ms, c, 'sky'); if (st) { const o = add('header', 'ult:sky', 'Sky Tyrant', 'Rise above everyone and bury the header.'); o.ab = st.id; o.sta = 6; o.hot = true; }
          add('header', 'shoot:header', 'Head it at goal', 'Attack the ball in the air.'); if (full && actFor(ms, c, 'aerial')) add('header', 'shoot:header:ab', `${actFor(ms, c, 'aerial')!.name}`, 'Trigger your aerial weapon.', 'aerial'); }
        else add('volley', 'shoot:volley', 'Volley first time', 'Strike it out of the air.');
        if (full && actFor(ms, c, 'shot_air')) add('volley', 'shoot:air:ab', actFor(ms, c, 'shot_air')!.name, 'Kill the ball and finish in one motion.', 'shot_air');
      } else if (fresh) {
        add('first', 'shoot:first', 'Shoot first time', 'Hit it before the defence is set.');
        if (full) {
          if (actFor(ms, c, 'shot_first')) add('first', 'shoot:first:ab', actFor(ms, c, 'shot_first')!.name, 'Trigger your first-time shooting weapon.', 'shot_first');
          if (inBox) add('placed', 'shoot:placed', 'Take a touch, then place it', 'More control, but the touch invites pressure.');
        }
      } else if (inBox) {
        add('placed', 'shoot:placed', 'Placed finish', 'Pick your corner.');
        if (full) {
          add('power', 'shoot:power', 'Power shot', 'Hit it hard. More misses, fewer saves.');
          if (actFor(ms, c, 'shot_box')) add('placed', 'shoot:box:ab', actFor(ms, c, 'shot_box')!.name, 'Trigger your box-finishing weapon.', 'shot_box');
          if (g.theta < 0.42 && actFor(ms, c, 'shot_angle')) add('placed', 'shoot:angle:ab', actFor(ms, c, 'shot_angle')!.name, 'Bend it from the tight angle.', 'shot_angle');
        }
      } else {
        add('long', 'shoot:long', 'Shoot from distance', 'Test the keeper from range.');
        if (full && actFor(ms, c, 'shot_long')) add('long', 'shoot:long:ab', actFor(ms, c, 'shot_long')!.name, 'Trigger your long-range weapon.', 'shot_long');
        if (full && g.theta < 0.42 && actFor(ms, c, 'shot_angle')) add('placed', 'shoot:angle:ab', actFor(ms, c, 'shot_angle')!.name, 'Bend it from the tight angle.', 'shot_angle');
      }
      // ultimates
      if (full || c.canFlow) {
        const dag = canUlt(ms, c, 'dag');
        if (dag && (g.theta < 0.55 || (g.d <= 20 && (ms.bh >= 1 || ms.press > 0.5)))) {
          const vars: [string, string, string][] = ms.bh === 2 ? [['scissor', 'Scissor kick', 'Launch yourself at the high ball.'], ['volley', 'Improvised volley', 'Adjust mid-air and strike across it.']]
            : ms.bh === 1 ? [['volley', 'Improvised volley', 'Meet it at an impossible body angle.'], ['reverse', 'Reverse finish', 'Flick it behind your standing leg.']]
              : [['outside', 'Outside-foot shot', 'Bend it away from the keeper with the outside of the boot.'], ['reverse', 'Reverse finish', 'Back-heel or flick it from a closed body shape.']];
          for (const [vv, label, detail] of vars) {
            const p = dagCalc(ms, c, vv, dag.lv);
            const o = opt('shoot', 'ult:dag:' + vv, p, p * 0.95 * bias, -1, 'dag:' + vv);
            o.ab = dag.id; o.sta = 8; o.hot = true;
            if (full) { o.label = `Dead Angle Genesis — ${label}`; o.detail = `${detail} Technique, ball height, balance and pressure decide it.`; o.intent = 'Invent a goal'; o.risk = riskLabel(Math.min(1, p * 1.7)); }
            if (!full) break;
          }
        }
        const zero = canUlt(ms, c, 'zero');
        if (zero && g.d <= 24) {
          const s = shotCalc(ms, c, inBox ? 'placed' : 'long', null, 'zero');
          const o = opt('shoot', 'ult:zero', s.p, s.p * 0.95 * bias, -1, inBox ? 'placed' : 'long');
          o.ab = zero.id; o.sta = 7; o.hot = true;
          if (full) { o.label = 'Zero-Frame Strike'; o.detail = 'No back-lift, no warning. Cannot be blocked.'; o.intent = 'Go for goal'; o.risk = riskLabel(Math.min(1, s.p * 2.2)); }
        }
        const comet = ms.note !== 'fk' ? canUlt(ms, c, 'comet') : null;
        if (comet && g.d > 17 && g.d <= 32 && ms.bh === 0) {
          const s = shotCalc(ms, c, 'long', null, 'comet');
          const p = clamp(s.xg * 2.2 + 0.06 + c.m[M.SH_LONG] * 0.1, 0.05, 0.45);
          const o = opt('shoot', 'ult:comet', p, p * 0.95 * bias, -1, 'long');
          o.ab = comet.id; o.sta = 8; o.hot = true;
          if (full) { o.label = 'Comet Drive'; o.detail = `Set it on fire from ${Math.round(g.d)} metres. Rises, then dips under the bar.`; o.intent = 'Go for goal'; o.risk = riskLabel(Math.min(1, p * 2)); }
        }
        const cres = ms.note !== 'fk' ? canUlt(ms, c, 'crescent') : null;
        if (cres && g.d > 13 && g.d <= 30 && ms.bh === 0) {
          const s = shotCalc(ms, c, 'placed', null, 'crescent');
          const p = clamp(s.xg * 2 + 0.1 + c.m[M.SH_ANGLE] * 0.1, 0.08, 0.5);
          const o = opt('shoot', 'ult:crescent', p, p * 0.95 * bias, -1, 'placed');
          o.ab = cres.id; o.sta = 7; o.hot = true;
          if (full) { o.label = 'Crescent Strike'; o.detail = 'Start it metres wide of the post and hook it back in.'; o.intent = 'Go for goal'; o.risk = riskLabel(Math.min(1, p * 2)); }
        }
        const fkU = ms.note === 'fk' ? canUlt(ms, c, 'fk') : null;
        if (fkU && g.d <= 32) {
          const s = shotCalc(ms, c, 'fk', null, 'fk');
          const p = clamp(s.p * 2.3 + 0.08, 0.1, 0.5);
          const o = opt('shoot', 'ult:fk', p, p * bias, -1, 'fk');
          o.ab = fkU.id; o.sta = 5; o.hot = true;
          if (full) { o.label = 'Free-Kick Sovereign'; o.detail = 'Over the wall, round the keeper, into the corner nobody can reach.'; o.intent = 'Go for goal'; o.risk = riskLabel(Math.min(1, p * 2)); }
        }
      }
    }
  }
  if (ms.note === 'fk' && !full) return OPTS;

  // ── passes ──
  let n = 0;
  const on = T.on;
  let safe = -1, safeV = -1;
  for (let k = 0; k < on.length; k++) {
    const mi = on[k];
    if (mi === ci) continue;
    const m = ms.pl[mi];
    if (m.line === 0 && cax > 38) continue;
    const d = dist(ms.bx, ms.by, m.x, m.y);
    if (d < 3 || d > 58) continue;
    const max = ax(t, m.x);
    let raw = tieJit(ms, mi) * 1e-3 + ev(max, m.y) - m.s[S.SH] * 0.02 - m.s[S.XG] * 0.04 - m.s[S.G] * 0.06 - m.mk * 0.07 - (d > 34 ? 0.006 : 0) + (m.open ? 0.03 : 0) + (m.req > 0 ? 0.015 * (1.25 - c.ego / 100) * (0.6 + m.trust / 120) : 0);
    if (m.user && !c.user) raw *= 0.82 + m.trust / 300;
    if (ms.uc && c.user && ms.uc.combo === mi) raw += 0.01;
    raw += widthPull(T.tac.width, cy, m.y, max);
    if (isGk) raw = (d < 30 ? 0.02 : 0.012) + ev(max, m.y) * 0.4;
    CAND[n] = mi; CRAW[n] = raw; n++;
    const sv = (max <= cax + 4 ? 1 : 0.5) * (d < 26 ? 1 / (1 + Math.abs(d - 12)) : 0);
    if (sv > safeV) { safeV = sv; safe = mi; }
  }
  const chosen: number[] = [];
  {
    // candidates: the most valuable target, the best nearby target, the nearest team-mate and a safe outlet
    let b1 = -1, v1 = -1, b2 = -1, v2 = -1, b3 = -1, d3 = 99, b4 = -1, v4 = -1, b5 = -1, v5 = -1;
    for (let k = 0; k < n; k++) {
      const m = ms.pl[CAND[k]];
      // a tiny tie-break that changes every step: with the ball on the centre line (kick-offs, goal kicks) the left and
      // right team-mates are exactly as far away, and always picking the first-listed one sent the play down the left
      const d = dist(ms.bx, ms.by, m.x, m.y) + tieJit(ms, CAND[k]);
      if (CRAW[k] > v1) { v1 = CRAW[k]; b1 = k; }
      if (d < 24 && CRAW[k] > v2) { v2 = CRAW[k]; b2 = k; }
      if (d < d3) { d3 = d; b3 = k; }
      // the best man out wide (full-back or winger on the far side of the ball's lane), so the play can go to the flanks
      if (Math.abs(m.y - 50) > 22 && Math.abs(m.y - cy) > 12 && CRAW[k] > v5) { v5 = CRAW[k]; b5 = k; }
    }
    if (full) for (let k = 0; k < n; k++) if (k !== b1 && k !== b2 && CRAW[k] > v4) { v4 = CRAW[k]; b4 = k; }
    for (const b of [b1, b2, b3, b4, b5]) if (b >= 0 && chosen.indexOf(CAND[b]) < 0) chosen.push(CAND[b]);
  }
  if (safe >= 0 && chosen.indexOf(safe) < 0) chosen.push(safe);
  const wideCar = Math.abs(cy - 50) > 24 && cax > 70;
  for (let k = 0; k < chosen.length; k++) {
    const mi = chosen[k];
    const m = ms.pl[mi];
    const max = ax(t, m.x);
    let kind = 'pass';
    let tx = m.x, ty = m.y;
    const running = m.run === RUN.BEHIND || m.run === RUN.BLIND || m.run === RUN.PRED;
    if (ms.note === 'fkc' && max > 80) kind = 'cross';
    else if (running && max > cax + 5) { kind = 'through'; tx = m.x + (t === 0 ? 5 : -5); }
    else if (wideCar && max > 82 && Math.abs(m.y - 50) < 24) kind = max < cax - 1.5 ? 'cutback' : 'cross';
    const tax = ax(t, tx);
    const pc = passCalc(ms, c, m, kind, tx, ty, null);
    let u = pc.p * ev(tax, ty) - (1 - pc.p) * (ev(100 - tax, 100 - ty) * 0.8 + 0.035 - T.tac.direct * 0.012) + T.tac.direct * 0.0004 * (tax - cax);
    if (kind === 'through') u += pc.p * 0.06;
    if (kind === 'pass') u += pc.p * widthPull(T.tac.width, cy, ty, tax);
    // a creator who has already carved the defence open gets watched: his next final ball into the box is closed down
    if (tax > 76) {
      u -= (c.s[S.KP] * 0.022 + c.s[S.A] * 0.05 + c.mka * 0.055) * pc.p;
      // a deep midfielder threading a simple ball into the box is rarer than wide play and No. 10s
      if (kind === 'pass' && (c.pos === 'CM' || c.pos === 'DM' || c.line <= 1)) u -= 0.02 * pc.p;
    }
    // wide delivery: crosses and cut-backs are what wide players are there for (this bonus used to sit in an
    // unreachable else-branch, so balls into the box from the flanks were never rewarded)
    if (kind === 'cross') u += pc.p * 0.05 * (0.6 + T.tac.width * 0.8);
    else if (kind === 'cutback') u += pc.p * 0.06;
    if (m.user && !c.user) { u *= 0.86 + m.trust / 340; if (m.req > 0) u += 0.012 * (1.25 - c.ego / 100) * (0.5 + m.chem / 100); }
    const o = opt(kind, `${kind}:${mi}`, pc.p, u, mi, kind);
    if (full) {
      const prog = tax - cax;
      o.label = kind === 'through' ? `Through ball to ${m.nm}` : kind === 'cross' ? `Cross to ${m.nm}` : kind === 'cutback' ? `Cut back to ${m.nm}` : `Pass to ${m.nm}`;
      o.detail = `${m.pos} · ${m.open ? 'in space' : nearestOpp(ms, t, m.x, m.y).d < 4 ? 'marked' : 'available'} · ${prog > 8 ? 'progressive' : prog < -4 ? 'backwards' : 'sideways'}${m.req > 0 ? ' · calling for it' : ''}`;
      o.intent = kind === 'pass' ? (prog > 8 ? 'Progress play' : 'Keep possession') : 'Create a chance';
      o.risk = riskLabel(pc.p);
      const actK: ActCtx = kind === 'through' ? 'pass_through' : kind === 'cross' || kind === 'cutback' ? 'cross' : 'pass_any';
      const act = actFor(ms, c, actK) ?? (kind !== 'pass' ? actFor(ms, c, 'pass_any') : null);
      if (act) {
        const pc2 = passCalc(ms, c, m, kind, tx, ty, act);
        if (pc2.p > pc.p + 0.01) {
          const o2 = opt(kind, `${kind}:${mi}:ab`, pc2.p, u + 0.01, mi, kind);
          o2.ab = act.id; o2.sta = act.sta; o2.hot = true;
          o2.label = `${act.name} → ${m.nm}`; o2.detail = `Weapon-assisted ${kind === 'pass' ? 'pass' : kind}.`; o2.intent = o.intent; o2.risk = riskLabel(pc2.p);
        }
      }
      // other ways to play the same ball: over the top, driven, or the other kind of cross
      const dd = dist(ms.bx, ms.by, m.x, m.y);
      if (kind === 'pass' || kind === 'through') {
        if (dd > 10 && tax > cax - 6 && k < 3) {
          const lp = passCalc(ms, c, m, kind, tx, ty, null, 'lob');
          const o3 = opt(kind, `${kind}:${mi}:lob`, lp.p, u, mi, 'lob');
          o3.label = kind === 'through' ? `Lob over the top for ${m.nm}` : dd > 30 ? `Switch play to ${m.nm}` : `Lofted pass to ${m.nm}`;
          o3.detail = 'In the air: clears defenders in the lane, but harder to weight and to control.'; o3.intent = kind === 'through' ? 'Create a chance' : prog > 8 ? 'Progress play' : 'Change the angle'; o3.risk = riskLabel(lp.p);
        }
        if (dd > 8 && dd < 34 && k < 2) {
          const dp = passCalc(ms, c, m, kind, tx, ty, null, 'driven');
          const o4 = opt(kind, `${kind}:${mi}:driven`, dp.p, u, mi, 'driven');
          o4.label = kind === 'through' ? `Driven through ball to ${m.nm}` : `Driven pass to ${m.nm}`;
          o4.detail = 'Hit hard along the ground: quicker through the lane, tougher first touch.'; o4.intent = o.intent; o4.risk = riskLabel(dp.p);
        }
      } else if (kind === 'cross') {
        const lc = passCalc(ms, c, m, 'cutback', tx, ty, null);
        const o3 = opt('cutback', `cutback:${mi}:low`, lc.p, u, mi, 'low');
        o3.label = `Low cross to ${m.nm}`; o3.detail = 'Drilled along the ground across the box for a first-time finish.'; o3.intent = 'Create a chance'; o3.risk = riskLabel(lc.p);
      } else if (kind === 'cutback') {
        const hc = passCalc(ms, c, m, 'cross', tx, ty, null);
        const o3 = opt('cross', `cross:${mi}:high`, hc.p, u, mi, 'high');
        o3.label = `Chip it up for ${m.nm}`; o3.detail = 'A lifted ball to attack in the air.'; o3.intent = 'Create a chance'; o3.risk = riskLabel(hc.p);
      }
    }
  }
  if (isGk) return OPTS;

  // ── dribble / carry ──
  const nd = ms.nd >= 0 ? ms.pl[ms.nd] : null;
  const dNear = nd ? dist(nd.x, nd.y, ms.bx, ms.by) : 99;
  if (ms.note !== 'fkc' && ms.note !== 'fk') {
    if (nd && (ms.press > 0.3 || dNear < 9)) {
      const tight = ms.press > 0.55;
      const base = cz(drbSk(ms, c) - defSk(ms, nd)) / 16 - 0.05 - (ms.press > 0.8 ? 0.35 : 0) + (tight ? c.m[M.DR_TIGHT] : c.m[M.DR_OPEN] + c.m[M.PACE] * 0.5) - nd.m[M.TACKLE] * 0.6 + c.m[GB] - nd.m[GB]
        + (nd.focus === 2 ? -0.45 : 0) + (c.lostTo === ms.nd ? c.m[M.ADAPT] : 0) + (c.user && ms.uc ? ms.uc.forgive : 0);
      const p = clamp(sig(base), 0.05, 0.95);
      // a wide attacker who beats his man cuts inside towards goal
      const wideAtt = Math.abs(cy - 50) > 20 && (c.line === 3 || c.pos === 'LW' || c.pos === 'RW' || c.pos === 'LM' || c.pos === 'RM');
      const gain = ev(cax + 11, cy + (50 - cy) * (wideAtt ? 0.38 : 0.12)) * (1 + (cax > 66 ? 0.25 : 0));
      const o = opt('dribble', 'dribble:takeon', p, p * gain - (1 - p) * (loseCost + 0.04) + (c.ego - 50) / 5000 - 0.012, ms.nd, 'takeon');
      if (full) {
        o.label = `Take on ${nd.nm}`; o.detail = `${nd.pos} · ${tight ? 'tight to you' : 'backing off'}`; o.intent = 'Beat your man'; o.risk = riskLabel(p);
        const sp = clamp(sig(base - 0.3 + (at(ms, c, A.SKL) - 65) / 28 + c.m[M.DR_SKILL]), 0.04, 0.95);
        const o2 = opt('dribble', 'dribble:skill', sp, sp * gain * 1.2 - (1 - sp) * loseCost, ms.nd, 'skill');
        o2.label = 'Skill move'; o2.detail = 'Bigger reward, builds Flow. Fail and the ball is gone.'; o2.intent = 'Humiliate him'; o2.risk = riskLabel(sp);
        const act = actFor(ms, c, tight ? 'dribble_tight' : 'dribble_open');
        if (act) {
          const ap = clamp(sig(base + actBonus(act, tight ? M.DR_TIGHT : M.DR_OPEN) + actBonus(act, M.PRESS_RES)), 0.05, 0.96);
          const o3 = opt('dribble', 'dribble:takeon:ab', ap, ap * gain - (1 - ap) * loseCost, ms.nd, 'takeon'); o3.ab = act.id; o3.sta = act.sta; o3.hot = true;
          o3.label = act.name; o3.detail = `Weapon take-on against ${nd.nm}.`; o3.intent = 'Beat your man'; o3.risk = riskLabel(ap);
        }
        const actS = actFor(ms, c, 'dribble_skill');
        if (actS) {
          const ap = clamp(sig(base - 0.3 + (at(ms, c, A.SKL) - 65) / 28 + c.m[M.DR_SKILL] + actBonus(actS, M.DR_SKILL)), 0.05, 0.96);
          const o3 = opt('dribble', 'dribble:skill:ab', ap, ap * gain * 1.2 - (1 - ap) * loseCost, ms.nd, 'skill'); o3.ab = actS.id; o3.sta = actS.sta; o3.hot = true;
          o3.label = actS.name; o3.detail = 'Your signature skill move.'; o3.intent = 'Humiliate him'; o3.risk = riskLabel(ap);
        }
      }
      const tr = canUlt(ms, c, 'trance');
      if (tr && cax > 45) {
        const p3 = clamp(sig(base + 0.9) * sig(base + 0.6) * sig(base + 0.3), 0.03, 0.85);
        const o4 = opt('dribble', 'ult:trance', p3, p3 * ev(88, 50) - (1 - p3) * loseCost, ms.nd, 'trance'); o4.ab = tr.id; o4.sta = 10; o4.hot = true;
        if (full) { o4.label = 'Monster Trance'; o4.detail = 'Chain up to three take-ons. One failure ends it.'; o4.intent = 'Go through all of them'; o4.risk = riskLabel(p3); }
      }
      const ch = canUlt(ms, c, 'charge');
      if (ch && cax > 50 && cax < 84) {
        const pc = clamp(sig((at(ms, c, A.STR) - at(ms, nd, A.STR)) / 10 + (at(ms, c, A.BAL) - 65) / 30 + 0.7) * sig((at(ms, c, A.STR) - 70) / 12 + 0.9), 0.06, 0.85);
        const o5 = opt('dribble', 'ult:charge', pc, pc * ev(88, 50) - (1 - pc) * loseCost, ms.nd, 'charge'); o5.ab = ch.id; o5.sta = 9; o5.hot = true;
        if (full) { o5.label = 'Bulldozer Charge'; o5.detail = 'Go through two defenders, not round them. Strength against strength.'; o5.intent = 'Bulldoze through'; o5.risk = riskLabel(pc); }
      }
    } else {
      const adv = 6 + paceSk(ms, c) / 12;
      const o = opt('carry', 'carry', 0.97, ev(cax + adv, cy) * 0.97 - 0.03 * loseCost + (cax < 80 ? 0.004 : 0), -1, 'carry');
      if (full) { o.label = 'Carry forward'; o.detail = 'Space ahead of you — drive into it.'; o.intent = 'Progress play'; o.risk = 'Safe'; }
      const gs = canUlt(ms, c, 'sprint');
      if (gs && cax < 62) {
        const chaser = nd ? paceSk(ms, nd) : 60;
        const p = clamp(sig((paceSk(ms, c) - chaser) / 9 + 1.1 + c.m[M.PACE]), 0.1, 0.95);
        const o2 = opt('carry', 'ult:sprint', p, p * ev(82, 50) - (1 - p) * loseCost, -1, 'sprint'); o2.ab = gs.id; o2.sta = 14; o2.hot = true;
        if (full) { o2.label = 'God Sprint'; o2.detail = 'Carry it the length of the pitch. Huge stamina cost.'; o2.intent = 'Break the game open'; o2.risk = riskLabel(p); }
      }
    }
  }

  // ── hold ──
  {
    const hp = nd && ms.press > 0.4 ? clamp(sig((holdSk(ms, c) - (at(ms, nd, A.STR) * 0.6 + at(ms, nd, A.TAC) * 0.4)) / 12 + 1.1 + c.m[M.HOLD] + ms.press * -0.6 * (1 - Math.min(0.85, c.m[M.PRESS_RES]))), 0.1, 0.97) : 0.97;
    const o = opt('hold', 'hold', hp, hp * ev(cax, cy) * 0.86 - (1 - hp) * loseCost, -1, 'hold');
    if (full) {
      o.label = 'Hold it up'; o.detail = 'Shield the ball and let runners move.'; o.intent = 'Keep possession'; o.risk = riskLabel(hp);
      const act = actFor(ms, c, 'hold');
      if (act) {
        const ap = clamp(hp + (1 - hp) * 0.5, 0, 0.98);
        const o2 = opt('hold', 'hold:ab', ap, o.u + 0.004, -1, 'hold'); o2.ab = act.id; o2.sta = act.sta; o2.hot = true;
        o2.label = act.name; o2.detail = 'Freeze the defenders and open runs for the next action.'; o2.intent = 'Control the tempo'; o2.risk = riskLabel(ap);
      }
    }
  }

  // ── one-two ──
  if ((full || c.m[M.ONE_TWO] > 0) && cax > 30 && ms.note === '') {
    let bi = -1, bd = 17;
    for (let k = 0; k < on.length; k++) {
      const mi = on[k]; if (mi === ci) continue;
      const m = ms.pl[mi]; if (m.line === 0) continue;
      const d = dist(ms.bx, ms.by, m.x, m.y);
      if (d < bd && d > 3 && ax(t, m.x) > cax - 6) { bd = d; bi = mi; }
    }
    if (bi >= 0) {
      const m = ms.pl[bi];
      const act = full ? actFor(ms, c, 'onetwo') : null;
      const calc = (a: typeof act) => clamp(sig(1.0 + (passSk(ms, c, false) - 65) / 14 + (passSk(ms, m, false) - 65) / 20 - ms.press * 1.0 + c.m[M.ONE_TWO] + actBonus(a, M.ONE_TWO) + (c.user ? (m.chem - 50) / 60 + (ms.uc ? ms.uc.forgive : 0) : m.user ? (m.chem - 50) / 80 : 0) + (ms.uc && c.user && ms.uc.combo === bi ? 0.35 : 0)), 0.05, 0.95);
      const p = calc(null);
      const o = opt('onetwo', `onetwo:${bi}`, p, p * ev(cax + 12, cy) * 1.08 - (1 - p) * loseCost, bi, 'onetwo');
      if (full) {
        o.label = `One-two with ${m.nm}`; o.detail = `Give it, go, get it back beyond your marker. Chemistry ${Math.round(m.chem)}.`; o.intent = 'Break the line'; o.risk = riskLabel(p);
        if (act) { const ap = calc(act); const o2 = opt('onetwo', `onetwo:${bi}:ab`, ap, o.u + 0.005, bi, 'onetwo'); o2.ab = act.id; o2.sta = act.sta; o2.hot = true; o2.label = `${act.name} with ${m.nm}`; o2.detail = 'Weapon combination.'; o2.intent = 'Break the line'; o2.risk = riskLabel(ap); }
        const rx = ms.uc?.reactions[bi];
        const ch = canUlt(ms, c, 'chain');
        if ((rx || ch) && cax > 50 && m.chem >= 55) {
          const rp = clamp(sig(1.3 + (m.chem - 50) / 28 + (passSk(ms, c, false) - 65) / 16 - ms.press * 0.6 + (ch ? 0.5 : 0)), 0.1, 0.95);
          const o3 = opt('onetwo', ch ? `ult:chain:${bi}` : `react:${bi}`, rp, 1, bi, 'react'); o3.hot = true; o3.sta = ch ? 6 : 4; if (ch) o3.ab = ch.id;
          o3.label = ch ? `Chain Reaction with ${m.nm}` : `Chemical Reaction — ${rx} (${m.nm})`; o3.detail = 'A rehearsed combination that ends with you facing goal.'; o3.intent = 'Create a chance'; o3.risk = riskLabel(rp);
        }
      }
    }
  }
  // puppet-master pass
  {
    const pm = canUlt(ms, c, 'puppet');
    if (pm) {
      let bi = -1, bv = -1;
      for (let k = 0; k < on.length; k++) { const m = ms.pl[on[k]]; if (on[k] === ci || m.line < 2) continue; const v = ax(t, m.x) + (m.run ? 10 : 0); if (ax(t, m.x) > cax + 4 && v > bv) { bv = v; bi = on[k]; } }
      if (bi >= 0) {
        const p = clamp(0.8 + pm.lv * 0.025, 0, 0.93);
        const o = opt('through', `ult:puppet:${bi}`, p, p * 0.3, bi, 'through'); o.ab = pm.id; o.sta = 5; o.hot = true;
        if (full) { o.label = `Puppet-Master Pass → ${ms.pl[bi].nm}`; o.detail = 'Move the defender, then pass through the space he left.'; o.intent = 'Create a chance'; o.risk = riskLabel(p); }
      }
    }
    if (full && c.user && ms.uc) {
      const fd = canUlt(ms, c, 'dominion');
      if (fd && ms.uc.dominion <= ms.play) { const o = opt('meta', 'ult:dominion', 1, 0, -1, ''); o.ab = fd.id; o.sta = 4; o.hot = true; o.label = 'Field Dominion'; o.detail = 'Three minutes of perfect information and sharper reads.'; o.intent = 'See everything'; o.risk = 'Safe'; }
      if (c.fl >= FLOW.max && c.flEnd <= ms.play) { const o = opt('meta', 'flow:enter', 1, 0, -1, ''); o.hot = true; o.label = 'ENTER FLOW'; o.detail = 'Your meter is full. Flow sharpens your key attributes for several minutes, then crashes.'; o.intent = 'Awaken'; o.risk = 'Safe'; }
    }
  }
  if (full && c.user && ms.note !== 'pen' && ax(c.t, ms.bx) > 52 && !OPTS.some((o) => o.id.startsWith('ult:') && o.id !== 'ult:dominion')) {
    const ur = anyUlt(ms, c);
    if (ur) { const d = abilityDef(ur.id)!; const o = opt('shoot', 'ult:go', c.flEnd > ms.play ? ULT_GOAL : ULT_FREE, 0, -1, ''); o.ab = ur.id; o.sta = 7; o.hot = true; o.label = d.name; o.detail = d.desc.split('. ')[0] + '.'; o.intent = 'Score'; o.risk = 'Ultimate'; }
  }
  if (full && c.user) for (let k = 0; k < OPTS.length; k++) { const o = OPTS[k]; if (o.id.startsWith('ult:') && o.id !== 'ult:dominion') { o.p = Math.max(o.p, c.flEnd > ms.play ? ULT_GOAL : ULT_FREE); if (!o.detail.includes('ULTIMATE')) o.detail += ' ULTIMATE — finishes the move itself and almost always scores.'; o.intent = 'Score'; o.risk = 'Ultimate'; } }
  return OPTS;
}

function aiPick(ms: MatchState, rng: Rng, c: MPlayer, opts: Option[]): Option {
  const T = ms.teams[c.t];
  const tau = (0.012 + ((100 - at(ms, c, A.DEC)) / 100) * 0.03) * T.tau;
  let max = -1e9;
  for (let i = 0; i < opts.length; i++) if (opts[i].kind !== 'meta' && opts[i].u > max) max = opts[i].u;
  let tot = 0;
  for (let i = 0; i < opts.length; i++) { const o = opts[i]; if (o.kind === 'meta') { o.p = o.p; continue; } tot += Math.exp((o.u - max) / tau); }
  let r = rng.next() * tot;
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i]; if (o.kind === 'meta') continue;
    r -= Math.exp((o.u - max) / tau);
    if (r <= 0) return o;
  }
  for (let i = opts.length - 1; i >= 0; i--) if (opts[i].kind !== 'meta') return opts[i];
  return opts[0];
}

// ───────────────────────────── resolution ─────────────────────────────
function turnoverTo(ms: MatchState, idx: number, x: number, y: number): void { give(ms, idx, x, y, ARR.LOOSE); }

function foul(ms: MatchState, rng: Rng, by: MPlayer, on: MPlayer, hard: number): void {
  const t = on.t;
  by.s[S.FC]++; on.s[S.FW]++;
  const bi = ms.pl.indexOf(by), oi = ms.pl.indexOf(on);
  const oax = ax(t, ms.bx);
  const inBox = oax >= 83.5 && Math.abs(ms.by - 50) <= 29;
  if (ms.uc && on.user) memo(ms, bi).fouled++;
  if (inBox) emit(ms, 'pen_won', t, oi, bi, 0, say(ms, 'pen_won', on.nm, by.nm), 3);
  else if (ms.verb > 1) emit(ms, 'foul', by.t, bi, oi, 0, say(ms, 'foul', by.nm, on.nm), 0);
  let stop = 0;
  const cardP = (0.13 + hard * 0.12 + (inBox ? 0.1 : 0) + (by.agg - 50) / 600) * (by.yc ? 0.3 : 1);
  const r = rng.next();
  if (r < 0.002 + (inBox ? 0.01 : 0) + hard * 0.006) { by.rc = true; by.s[S.RC]++; emit(ms, 'red', by.t, bi, -1, 0, say(ms, 'red', by.nm), 3); sendOff(ms, by); stop = 40; }
  else if (r < cardP) {
    by.yc++; by.s[S.YC]++;
    if (by.yc >= 2) { by.rc = true; by.s[S.RC]++; emit(ms, 'red', by.t, bi, -1, 0, say(ms, 'second_yellow', by.nm), 3); sendOff(ms, by); stop = 40; }
    else { emit(ms, 'yellow', by.t, bi, -1, 0, say(ms, 'yellow', by.nm), 1); stop = 15; }
  }
  // injury chance from the contact
  const injP = (ms.inj.length > 3 ? 0 : 0.006) * injMul * (1 - on.m[M.INJ_RES]) * (1 + hard);
  if (rng.next() < injP) { on.inj = rng.range(4, 60); ms.inj.push({ idx: oi, days: on.inj }); emit(ms, 'inj', on.t, oi, -1, 0, say(ms, 'inj', on.nm), 2); stop += 60; }
  machineOf(ms).time(ms, 0, 0, stop);
  setRestart(ms, inBox ? RST.PENALTY : RST.FREEKICK, t as 0 | 1, ms.bx, ms.by);
}
let injMul = 1;
let ABSCALE = 0.5;
/** Set the ability strength multiplier (career realism setting). */
export function setAbilityScale(v: number): void { ABSCALE = v; }
function sendOff(ms: MatchState, p: MPlayer): void {
  const T = ms.teams[p.t];
  const k = T.on.indexOf(ms.pl.indexOf(p));
  if (k >= 0) T.on.splice(k, 1);
  p.on = false; T.red++;
  if (p.pos === 'GK' && T.on.length) {
    // an outfielder goes in goal if no substitution is available
    const repl = T.bench.find((b) => ms.pl[b].pos === 'GK' && !ms.pl[b].used);
    if (repl != null && T.subs < ms.rules.subs) {
      let off = -1, worst = 1e9;
      for (const i of T.on) { const q = ms.pl[i]; if (q.user) continue; const v = q.ovr + (q.line === 3 ? -5 : 0); if (v < worst) { worst = v; off = i; } }
      if (off >= 0) { T.subs++; const o = ms.pl[off]; swap(ms, p.t, off, repl, false); const g = ms.pl[repl]; g.line = 0; g.pos = 'GK'; g.bx = 4; g.by = 50; void o; }
    } else { const q = ms.pl[T.on[0]]; q.line = 0; q.bx = 4; q.by = 50; }
  }
}

/** The team-mate who set this shot up, or -1. Only a recent final ball counts: a pass the shooter then carried 40 m is not an assist. */
export const ASSIST_WINDOW = 9;
function setter(ms: MatchState, ci: number, t: number): number {
  return ms.from >= 0 && ms.from !== ci && ms.pl[ms.from].t === t && ms.play - ms.fromT <= ASSIST_WINDOW ? ms.from : -1;
}
function goal(ms: MatchState, rng: Rng, c: MPlayer, v: string, xg: number, d: number, flag: number, abId: string): void {
  const t = c.t;
  const ci = ms.pl.indexOf(c);
  c.s[S.G]++; c.s[S.SOT]++;
  if (flag === 1) c.s[S.PENG]++;
  ms.score[t]++;
  let ai = -1;
  if (flag !== 1) { ai = setter(ms, ci, t); if (ai >= 0) ms.pl[ai].s[S.A]++; }
  const D = ms.teams[1 - t].on;
  for (let k = 0; k < D.length; k++) ms.pl[D[k]].s[S.GC]++;
  const winner = ms.rules.kind === 'nel' && ms.score[t] >= ms.rules.goalTarget;
  const late = ms.rules.kind === 'reg' && ms.clock > 5100;
  let spec = (1 - xg) * 42 + (d > 20 ? (d - 20) * 2.4 : 0) + ms.seqPasses * 1.2 + ms.imp * 10 + (winner || late ? 8 : 0);
  if (v === 'volley') spec += 14; else if (v === 'header') spec += 3; else if (v.startsWith('dag')) spec += 30; else if (v === 'fk') spec += 12;
  if (abId) spec += 6;
  spec = clamp(Math.round(spec), 1, 100);
  ms.goals.push([goalMinute(ms), t as 0 | 1, c.id, ai >= 0 ? ms.pl[ai].id : '', flag, spec, Math.round(xg * 100)]);
  const key = winner ? 'goal_win' : flag === 1 ? 'goal_pen' : v === 'fk' ? 'goal_fk' : v === 'header' ? 'goal_head' : v === 'volley' ? 'goal_volley' : d > 20 ? 'goal_long' : ms.arr === ARR.THROUGH ? 'goal_1v1' : xg > 0.45 ? 'goal_tap' : late ? 'goal_late' : 'goal';
  let txt = say(ms, key, c.nm) + (ai >= 0 ? ' ' + say(ms, 'assist', '', ms.pl[ai].nm) : '');
  if (ms.verb > 0) txt += ` ${ms.teams[0].abbr} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].abbr}`;
  emit(ms, 'goal', t, ci, ai, xg, txt, 3);
  flowGain(ms, c, 30, 'goal');
  if (ai >= 0) flowGain(ms, ms.pl[ai], 20, 'key');
  if (ms.uc) {
    if (c.user && ai >= 0) memo(ms, ai).af++;
    if (ai >= 0 && ms.pl[ai].user) { memo(ms, ci).at++; ms.uc.unselfish++; }
  }
  for (let k = 0; k < D.length; k++) flowLoss(ms.pl[D[k]], 4);
  machineOf(ms).time(ms, 0, 50, 30);
  setRestart(ms, RST.KICKOFF, (1 - t) as 0 | 1, 50, 50);
}

/** Matches whose shots are recorded for the 3D view even though nobody is playing them (match simulator). */
const REC = new WeakSet<MatchState>();
/** Ultimates that are one man's work: the replay never shows a pass leading into them. */
const SOLO_ULT = new Set(['zero', 'dag', 'trance', 'sprint', 'charge', 'comet', 'fk', 'crescent']);
export function recordReplays(ms: MatchState): void { REC.add(ms); }
function resolveShot(ms: MatchState, rng: Rng, c: MPlayer, v: string, act: { id: string; sta: number; fx: { k: number; v: number }[] } | null, ult: string, pForce = -1): void {
  if ((!ms.uc || ms.uc.mode === 'sim') && !REC.has(ms)) return resolveShot0(ms, rng, c, v, act, ult, pForce);
  // capture the moment for the 3D replay (no RNG is consumed here, so the simulation is unchanged)
  const ci = ms.pl.indexOf(c);
  const gk = gkOf(ms, 1 - c.t);
  const from = v !== 'pen' ? setter(ms, ci, c.t) : -1;
  const sc0 = ms.score[c.t], ev0 = ms.ev.length;
  const h = (ms.steps * 2654435761) >>> 0;
  const s = shotCalc(ms, c, v.startsWith('dag') ? 'placed' : v, act, ult);
  const rp: Replay = {
    id: (ms.replays?.length ? ms.replays[ms.replays.length - 1].id : 0) + 1, min: goalMinute(ms), t: c.t, sh: ci, as: SOLO_ULT.has(ult) ? -1 : from, gk: gk ? ms.pl.indexOf(gk) : -1, v, d: s.d, xg: s.xg, p: pForce >= 0 ? pForce : s.p, res: 'save',
    bx: ms.bx, by: ms.by, fx: from >= 0 && !SOLO_ULT.has(ult) ? ms.pl[from].x : -1, fy: from >= 0 && !SOLO_ULT.has(ult) ? ms.pl[from].y : -1, high: ms.bh >= 1 || v === 'header' || v === 'volley',
    gy: ((h % 1000) / 500 - 1) * 0.86, gz: (((h >>> 10) % 1000) / 1000) * 0.8 + 0.06,
    pl: [], sc: [0, 0], ult: ult || (v.startsWith('dag') ? 'dag' : undefined), ab: act ? abilityDef(act.id)?.name : undefined, clock: ms.clock,
  };
  for (let t = 0; t < 2; t++) for (const i of ms.teams[t].on) rp.pl.push([i, Math.round(ms.pl[i].x * 10) / 10, Math.round(ms.pl[i].y * 10) / 10]);
  resolveShot0(ms, rng, c, v, act, ult, pForce);
  if (ms.score[c.t] > sc0) rp.res = 'goal';
  else {
    const e = ms.ev.slice(ev0).find((x) => x.k === 'shot' || x.k === 'pen_miss');
    if (e?.k === 'shot') rp.res = e.q === -1 ? (/POST!|woodwork|crossbar denies/.test(e.x) ? 'post' : 'off') : e.q === rp.gk ? 'save' : 'block';
    if (rp.res === 'block' && e) rp.blk = e.q;
  }
  { // where the ball is aimed, made consistent with what happened: goals find the corners, saves stay within the keeper's reach
    const r1 = ((h >>> 3) % 997) / 997, r2 = ((h >>> 13) % 991) / 991, r3 = ((h >>> 21) % 983) / 983, sg = rp.gy >= 0 ? 1 : -1;
    if (rp.res === 'goal') { rp.gy = sg * (0.42 + 0.5 * r1); rp.gz = r2 < 0.48 ? 0.04 + 0.3 * r3 : 0.6 + 0.34 * r3; }
    else if (rp.res === 'save') { rp.gy = sg * (0.12 + 0.62 * r1); rp.gz = 0.08 + 0.72 * r2; }
  }
  rp.sc = [ms.score[0], ms.score[1]];
  const lu = LAST_ULT.get(ms);
  if (!rp.ult && lu && lu.key && ms.steps - lu.step <= 6 && lu.idx === ci && !['curtain', 'dominion'].includes(lu.key) && (from < 0 || !['trance', 'sprint'].includes(lu.key))) rp.ult = lu.key;
  const dr = DRIB.get(ms);
  if (dr && dr.idx === ci && ms.steps - dr.step <= 2 && !rp.ult) { rp.skill = dr.skill; rp.beat = dr.def; rp.as = -1; rp.fx = -1; rp.fy = -1; }
  (ms.replays ??= []).push(rp); if (ms.replays.length > 60) ms.replays.shift();
}
function resolveShot0(ms: MatchState, rng: Rng, c: MPlayer, v: string, act: { id: string; sta: number; fx: { k: number; v: number }[] } | null, ult: string, pForce = -1): void {
  const t = c.t;
  const ci = ms.pl.indexOf(c);
  const isPen = v === 'pen';
  const s = shotCalc(ms, c, v.startsWith('dag') ? 'placed' : v, act, ult);
  const cur = CURTAIN.get(ms);
  const shut = !!cur && cur.t !== t && ms.steps <= cur.until && v !== 'pen'; // Iron Curtain: nothing gets through for a spell
  const p = shut ? 0 : Math.min(0.98, (pForce >= 0 ? pForce : s.p) * KMUL);
  const xg = v.startsWith('dag') ? Math.min(s.xg, 0.12) : s.xg;
  c.s[S.SH]++; c.s[S.XG] += xg; touch(c);
  if (DBG.on) { const k = v + '/' + ms.arr + (s.d > 18 ? '/far' : '/box'); DBG[k + ' n'] = (DBG[k + ' n'] ?? 0) + 1; DBG[k + ' xg'] = (DBG[k + ' xg'] ?? 0) + xg; DBG[k + ' pr'] = (DBG[k + ' pr'] ?? 0) + ms.press; }
  { const si = isPen ? -1 : setter(ms, ci, t); if (si >= 0) { ms.pl[si].s[S.KP]++; ms.pl[si].s[S.XA] += xg; flowGain(ms, ms.pl[si], 8, 'key'); } }
  machineOf(ms).time(ms, 2.5, 0, 0);
  const gk = gkOf(ms, 1 - t);
  const gi = gk ? ms.pl.indexOf(gk) : -1;
  const nd = ms.nd >= 0 ? ms.pl[ms.nd] : null;
  const big = xg >= 0.3;
  if (rng.next() < p) { goal(ms, rng, c, v, xg, s.d, isPen ? 1 : v === 'fk' ? 3 : 0, act?.id ?? (ult ? ult : '')); return; }
  if (big) c.s[S.BCM]++;
  flowLoss(c, big ? 8 : 3);
  if (isPen) {
    c.s[S.PENM]++;
    const saved = rng.chance(0.6);
    if (saved && gk) { c.s[S.SOT]++; gk.s[S.SV]++; }
    emit(ms, 'pen_miss', t, ci, gi, xg, say(ms, 'pen_miss', c.nm, gk?.nm ?? ''), 3);
    setRestart(ms, RST.GOALKICK, (1 - t) as 0 | 1, 0, 0);
    return;
  }
  const header = v === 'header';
  const sk = shotSk(ms, c, v.startsWith('dag') ? 'volley' : v);
  const compact = Math.max(0, 0.5 - ms.teams[1 - t].tac.line); // bodies behind the ball: a low block blocks more shots
  const pBlock = ult === 'zero' || v === 'fk' || ult === 'comet' ? 0.02 : header ? 0.04 + compact * 0.1 : clamp(0.05 + ms.press * 0.3 + (s.d > 18 ? 0.08 : 0) + compact * (s.d > 18 ? 0.4 : 0.22), 0, 0.55);
  const pOff = clamp(0.44 - (sk - 65) / 110 + (s.d - 12) / 80 + ms.press * 0.1 + (v === 'power' ? 0.08 : 0), 0.12, 0.8);
  const r = rng.next();
  if (r < pBlock && nd) {
    nd.s[S.BLK]++;
    emit(ms, 'shot', t, ci, ms.nd, xg, say(ms, 'shot_block', c.nm, nd.nm), 1);
    const r2 = rng.next();
    if (r2 < 0.38) setRestart(ms, RST.CORNER, t as 0 | 1, 0, 0);
    else if (r2 < 0.7) reboundBall(ms, rng, t);
    else turnoverTo(ms, ms.nd, ms.bx, ms.by);
    return;
  }
  if (rng.next() < pOff) {
    emit(ms, 'shot', t, ci, -1, xg, say(ms, rng.chance(0.06) ? 'shot_post' : 'shot_off', c.nm), big ? 2 : 1);
    setRestart(ms, RST.GOALKICK, (1 - t) as 0 | 1, 0, 0);
    return;
  }
  c.s[S.SOT]++;
  if (gk) { gk.s[S.SV]++; flowGain(ms, gk, 6, 'defend'); }
  emit(ms, 'shot', t, ci, gi, xg, say(ms, big ? 'shot_save_big' : 'shot_save', c.nm, gk?.nm ?? 'the keeper'), big ? 2 : 1);
  const pHold = gk ? clamp(0.5 + (gk.a[A.GKH] - 65) / 100 - (v === 'power' || v === 'long' ? 0.12 : 0), 0.2, 0.85) : 0.2;
  if (rng.next() < pHold) { setRestart(ms, RST.GKHOLD, (1 - t) as 0 | 1, 0, 0); return; }
  if (rng.chance(0.45)) { setRestart(ms, RST.CORNER, t as 0 | 1, 0, 0); return; }
  reboundBall(ms, rng, t);
}

/** A loose ball in the box after a save or block. */
function reboundBall(ms: MatchState, rng: Rng, t: number): void {
  const A2 = ms.teams[t].on;
  let bi = -1, bv = -1;
  for (let k = 0; k < A2.length; k++) {
    const p = ms.pl[A2[k]];
    if (p.line < 2) continue;
    const v = at(ms, p, A.REA) * 0.5 + at(ms, p, A.POS) * 0.5 + p.m[M.REBOUND] * 160 + (ax(t, p.x) > 76 ? 12 : 0) + (p.run === RUN.PRED ? 40 : 0) + rng.next() * 30;
    if (v > bv) { bv = v; bi = A2[k]; }
  }
  const pAtt = bi >= 0 ? clamp(0.36 + ms.pl[bi].m[M.REBOUND] + (at(ms, ms.pl[bi], A.REA) - 65) / 300, 0.1, 0.75) : 0;
  if (bi >= 0 && rng.next() < pAtt) {
    ms.from = -1;
    give(ms, bi, t === 0 ? 88 + rng.next() * 7 : 12 - rng.next() * 7, 38 + rng.next() * 24, ARR.REBOUND);
    if (ms.verb > 1) emit(ms, 'rebound', t, bi, -1, 0, say(ms, 'rebound', ms.pl[bi].nm), 1);
  } else {
    const di = pickTaker(ms, 1 - t, (p) => (p.line === 1 ? 10 : 0) + rng.next() * 8);
    ms.pl[di].s[S.CLR]++;
    if (rng.chance(0.5)) { const mi = pickTaker(ms, 1 - t, (p) => (p.line >= 2 ? 6 : 0) + rng.next() * 6); give(ms, mi, t === 0 ? 62 : 38, 25 + rng.next() * 50, ARR.LOOSE); }
    else loose(ms, t === 0 ? 68 : 32, 20 + rng.next() * 60);
  }
}

function resolve(ms: MatchState, rng: Rng, c: MPlayer, o: Option): void {
  const t = c.t;
  const ci = ms.car;
  const M2 = machineOf(ms);
  const T = ms.teams[t];
  const tempo = 1.18 - T.tac.tempo * 0.36;
  const cax = ax(t, ms.bx);
  const nd = ms.nd >= 0 ? ms.pl[ms.nd] : null;
  const user = c.user && ms.uc;
  // abilities: the user's choice is explicit; AI stars trigger theirs with judgement
  let act: ReturnType<typeof actFor> = null;
  let ult = '';
  if (o.id.startsWith('ult:')) ult = o.id.split(':')[1];
  else if (o.ab) { const d = abilityDef(o.ab); if (d?.act) act = actFor(ms, c, d.act.ctx); }
  ms.note = ms.note === 'pen' || ms.note === 'fk' || ms.note === 'fkc' ? ms.note : '';

  if (ult === 'go') { // the generic ultimate trigger: whatever the ultimate is, it finishes the move
    const ur = anyUlt(ms, c);
    if (ur) {
      const key = abilityDef(ur.id)?.ult ?? '';
      spendUlt(ms, c, ur.id, 7);
      let sh = c, from = -1;
      if (key === 'puppet' || key === 'chain') { let bi = -1, bv = -1; const on = ms.teams[t].on; for (let k = 0; k < on.length; k++) { const q = ms.pl[on[k]]; if (q === c || q.line < 2) continue; const v2 = q.line * 20 + q.ovr; if (v2 > bv) { bv = v2; bi = on[k]; } } if (bi >= 0) { c.s[S.PA]++; c.s[S.PC]++; touch(c); if (key === 'puppet') { sh = ms.pl[bi]; from = ci; } else from = bi; } }
      ultStrike(ms, rng, sh, key, from, key === 'sky' ? 'header' : key === 'sprint' || key === 'charge' ? 'power' : key === 'comet' ? 'long' : from >= 0 ? 'first' : 'placed');
      return;
    }
  }
  switch (o.kind) {
    case 'shoot': {
      if (!user && !ult && !act && c.ab.length && c.st > 35) {
        const ctx: ActCtx = o.v === 'first' ? 'shot_first' : o.v === 'long' ? 'shot_long' : o.v === 'header' ? 'aerial' : o.v === 'volley' ? 'shot_air' : shotGeo(cax, ms.by).theta < 0.42 ? 'shot_angle' : 'shot_box';
        const a = actFor(ms, c, ctx);
        if (a && rng.chance(0.6)) act = a;
      }
      if (user && ms.uc) {
        // selfishness check: was a clearly better option available to a team-mate?
        let best = 0, bi = -1;
        for (let i = 0; i < OPTS.length; i++) { const q = OPTS[i]; if ((q.kind === 'through' || q.kind === 'cutback' || q.kind === 'pass' || q.kind === 'cross') && q.tgt >= 0 && q.u > best) { best = q.u; bi = q.tgt; } }
        if (bi >= 0 && best > o.u * 1.7 + 0.03 && o.p < 0.22) { ms.uc.selfish++; memo(ms, bi).iIgn++; }
      }
      const v = o.v;
      if (act) useAbility(ms, c, act.id, act.sta, true);
      if (ult === 'dag') { const u = ultOf(c, 'dag')!; spendUlt(ms, c, u.id, 8); ms.note = ''; resolveShot(ms, rng, c, v, null, 'dag', user ? Math.max(o.p, ug(ms)) : o.p); break; }
      if (ult === 'sky') { const u = ultOf(c, 'sky')!; spendUlt(ms, c, u.id, 6); ms.note = ''; resolveShot(ms, rng, c, 'header', null, 'sky', user ? ug(ms) : Math.max(o.p, 0.5)); break; }
      if (ult === 'zero') { const u = ultOf(c, 'zero')!; spendUlt(ms, c, u.id, 7); }
      if (ult === 'comet') { const u = ultOf(c, 'comet')!; spendUlt(ms, c, u.id, 8); ms.note = ''; resolveShot(ms, rng, c, 'long', null, 'comet', user ? Math.max(o.p, ug(ms) * 0.85) : o.p); break; }
      if (ult === 'crescent') { const u = ultOf(c, 'crescent')!; spendUlt(ms, c, u.id, 7); ms.note = ''; resolveShot(ms, rng, c, 'placed', null, 'crescent', user ? Math.max(o.p, ug(ms) * 0.85) : o.p); break; }
      if (ult === 'fk') { const u = ultOf(c, 'fk')!; spendUlt(ms, c, u.id, 5); ms.note = ''; resolveShot(ms, rng, c, 'fk', null, 'fk', user ? Math.max(o.p, ug(ms) * 0.85) : o.p); break; }
      const wasPen = ms.note === 'pen';
      ms.note = '';
      const dom = !!user && !!ms.uc && ms.uc.dominion > ms.play && !wasPen && !ult;
      if (dom) ms.uc!.dominion = 0;
      resolveShot(ms, rng, c, wasPen ? 'pen' : v, act, dom ? 'dominion' : ult, ult === 'zero' ? (user ? Math.max(o.p, ug(ms)) : o.p) : dom ? Math.max(o.p, 0.82) : wasPen ? o.p : -1);
      break;
    }
    case 'pass': case 'through': case 'cross': case 'cutback': {
      const mi = o.tgt;
      const m = ms.pl[mi];
      let kind = o.kind;
      let tx = m.x, ty = m.y;
      if (kind === 'through') tx = m.x + (t === 0 ? 5 : -5);
      if (!user && !act && c.ab.length && c.st > 35 && (kind === 'through' || kind === 'cross')) { const a = actFor(ms, c, kind === 'through' ? 'pass_through' : 'cross'); if (a && rng.chance(0.5)) act = a; }
      let p = o.p;
      if (act) { useAbility(ms, c, act.id, act.sta, false); if (!user) p = passCalc(ms, c, m, kind, tx, ty, act).p; }
      if (ult === 'puppet' && user) { const u = ultOf(c, 'puppet')!; spendUlt(ms, c, u.id, 5); c.s[S.PA]++; c.s[S.PC]++; touch(c); ms.note = ''; ultStrike(ms, rng, m, 'puppet', ci, 'first'); break; }
      if (ult === 'puppet') { const u = ultOf(c, 'puppet')!; spendUlt(ms, c, u.id, 5); kind = 'through'; tx = m.x + (t === 0 ? 8 : -8); m.open = true; m.run = RUN.BEHIND; m.runT = 2; }
      const d = dist(ms.bx, ms.by, tx, ty);
      const lob = o.v === 'lob';
      const long = d > 30 || lob;
      c.s[S.PA]++; touch(c);
      M2.time(ms, (long ? 5.2 : d > 16 ? 3.8 : 3) * tempo + rng.next() * 1.6, 0, 0);
      const wasFk = ms.note === 'fkc';
      ms.note = '';
      // offside
      if (kind === 'through' && ms.rules.offside) {
        const D = ms.teams[1 - t];
        const pOff = clamp(0.15 - (offSk(ms, m) - 65) / 250 + (D.tac.line - 0.5) * 0.16 - m.m[M.RUN_BEHIND] * 0.12 - (ult ? 0.06 : 0), 0.02, 0.4);
        if (rng.next() < pOff) {
          m.s[S.OFF]++;
          emit(ms, 'offside', t, mi, -1, 0, say(ms, 'offside', m.nm), 1);
          M2.time(ms, 0, 18, 0);
          setRestart(ms, RST.FREEKICK, (1 - t) as 0 | 1, tx, ty);
          break;
        }
      }
      if (rng.next() < p) {
        c.s[S.PC]++;
        ms.seqPasses++;
        ms.from = ci; ms.fromT = ms.play;
        const arr = kind === 'through' ? ARR.THROUGH : kind === 'cross' ? ARR.CROSS : long ? ARR.LOFT : ARR.GROUND;
        if (kind === 'cross') {
          const no = nearestOpp(ms, t, tx, ty);
          m.s[S.AW]++; if (no.i >= 0) ms.pl[no.i].s[S.AL]++;
        }
        give(ms, mi, tx, ty, arr);
        ms.bh = kind === 'cross' ? (wasFk || rng.chance(0.7) ? 2 : 1) : lob ? 1 : long ? (rng.chance(0.5) ? 1 : 0) : 0;
        if (kind === 'through') { m.open = true; }
        m.req = 0;
        if (ms.uc) {
          if (c.user) memo(ms, mi).pt++;
          else if (m.user) { memo(ms, ci).pf++; }
        }
        if (ms.verb > 1 || kind === 'through' || kind === 'cross' || kind === 'cutback') {
          const key = lob ? (kind === 'through' ? 'lob_through' : 'lob') : kind === 'through' ? 'through' : kind === 'cross' ? 'cross_ok' : kind === 'cutback' ? 'cutback' : long ? 'pass_long' : 'pass';
          emit(ms, 'pass', t, ci, mi, 0, say(ms, key, c.nm, m.nm), kind === 'pass' ? 0 : 1);
        }
        if (kind === 'through' || kind === 'cutback') flowGain(ms, c, 5, 'key');
      } else {
        c.s[S.LOST]++;
        flowLoss(c, 3);
        if (kind === 'cross') {
          const no = nearestOpp(ms, t, tx, ty);
          if (no.i >= 0 && rng.chance(0.65)) {
            const df = ms.pl[no.i];
            df.s[S.AW]++; df.s[S.CLR]++; m.s[S.AL]++;
            if (ms.verb > 1) emit(ms, 'pass', 1 - t, no.i, ci, 0, say(ms, 'cross_fail', c.nm, df.nm), 0);
            if (rng.chance(0.25)) setRestart(ms, RST.CORNER, t as 0 | 1, 0, 0);
            else if (rng.chance(0.5)) loose(ms, t === 0 ? 74 : 26, 25 + rng.next() * 50);
            else turnoverTo(ms, no.i, tx, ty);
          } else setRestart(ms, RST.GOALKICK, (1 - t) as 0 | 1, 0, 0);
          break;
        }
        const r = rng.next();
        const lr = laneRisk(ms, t, ms.bx, ms.by, tx, ty);
        let ii = lr.i >= 0 ? lr.i : nearestOpp(ms, t, tx, ty, false).i;
        if (r < 0.4 && ii >= 0) {
          const df = ms.pl[ii];
          df.s[S.INT]++;
          flowGain(ms, df, 6, 'defend', c);
          emit(ms, 'int', 1 - t, ii, ci, 0, say(ms, df.user ? 'intercept_user' : 'pass_int', df.user ? df.nm : c.nm, df.nm), kind === 'through' ? 1 : 0);
          turnoverTo(ms, ii, df.x, df.y);
        } else if (r < 0.72) {
          if (ms.verb > 1) emit(ms, 'out', t, ci, -1, 0, say(ms, 'pass_out', c.nm), 0);
          const tax = ax(t, tx);
          if (tax > 96 && kind === 'through') setRestart(ms, RST.GOALKICK, (1 - t) as 0 | 1, 0, 0);
          else setRestart(ms, RST.THROW, (1 - t) as 0 | 1, tx, ty);
        } else loose(ms, (ms.bx + tx) / 2, (ms.by + ty) / 2);
      }
      break;
    }
    case 'dribble': {
      if (!nd) { ms.bx = clamp(ms.bx + (t === 0 ? 6 : -6), 2, 98); break; }
      const ni = ms.nd;
      if (ult === 'charge') {
        const u = ultOf(c, 'charge')!; spendUlt(ms, c, u.id, 9);
        c.s[S.DA]++; touch(c); M2.time(ms, 6, 0, 0);
        if (user || rng.next() < o.p) {
          c.s[S.DC]++; c.s[S.DA]++; c.s[S.DC]++;
          nd.beat = 3;
          const D = ms.teams[1 - t].on; let n = 0;
          for (let k = 0; k < D.length && n < 1; k++) { const q = ms.pl[D[k]]; if (q.line === 1 && q !== nd) { q.beat = 2; n++; } }
          ms.bx = t === 0 ? 86 : 14; ms.by = 40 + rng.next() * 20; ms.arr = ARR.SET; ms.from = -1;
          flowGain(ms, c, 12, 'dribble', nd);
          if (user) ultStrike(ms, rng, c, 'charge', -1, 'power');
        } else { c.s[S.LOST]++; nd.s[S.TKA]++; nd.s[S.TKW]++; emit(ms, 'dribble', 1 - t, ni, ci, 0, say(ms, 'dribble_fail', c.nm, nd.nm), 1); turnoverTo(ms, ni, ms.bx, ms.by); }
        break;
      }
      if (ult === 'trance') {
        const u = ultOf(c, 'trance')!; spendUlt(ms, c, u.id, 10);
        c.s[S.DA]++; touch(c); M2.time(ms, 7, 0, 0);
        if (user || rng.next() < o.p) {
          c.s[S.DC] += 1; c.s[S.DA] += 2; c.s[S.DC] += 2;
          nd.beat = 3;
          const D = ms.teams[1 - t].on; let n = 0;
          for (let k = 0; k < D.length && n < 2; k++) { const q = ms.pl[D[k]]; if (q.line === 1 && q !== nd) { q.beat = 2; n++; } }
          ms.bx = t === 0 ? 87 : 13; ms.by = 42 + rng.next() * 16; ms.arr = ARR.SET; ms.from = -1;
          flowGain(ms, c, 14, 'dribble', nd);
          if (user) ultStrike(ms, rng, c, 'trance', -1);
        } else { c.s[S.LOST]++; nd.s[S.TKA]++; nd.s[S.TKW]++; emit(ms, 'dribble', 1 - t, ni, ci, 0, say(ms, 'dribble_fail', c.nm, nd.nm), 1); turnoverTo(ms, ni, ms.bx, ms.by); }
        break;
      }
      const skill = o.v === 'skill';
      if (!user && !act && c.ab.length && c.st > 40) { const a = actFor(ms, c, ms.press > 0.55 ? 'dribble_tight' : 'dribble_open') ?? actFor(ms, c, 'dribble_skill'); if (a && rng.chance(0.45)) act = a; }
      let p = o.p;
      if (act) { useAbility(ms, c, act.id, act.sta, user ? true : false); if (!user) p = clamp(p + 0.08, 0, 0.96); }
      c.s[S.DA]++; touch(c);
      c.st = Math.max(1, c.st - 0.7);
      M2.time(ms, 3.8 * tempo + rng.next() * 1.5, 0, 0);
      if (rng.next() < p) {
        c.s[S.DC]++;
        DRIB.set(ms, { idx: ci, step: ms.steps, def: ms.nd, skill: skill ? (act ? 2 : 1) : 0 });
        nd.beat = skill ? 3 : 2;
        const adv = (skill ? 13 : 10) + paceSk(ms, c) / 30;
        // beating a man near the box gets you to around the penalty spot, not to a tap-in on the goal line
        const nax = Math.min(cax + adv, Math.max(cax, 92));
        ms.bx = clamp(t === 0 ? nax : 100 - nax, 2, 98);
        const wideAtt = Math.abs(ms.by - 50) > 20 && (c.line === 3 || c.pos === 'LW' || c.pos === 'RW' || c.pos === 'LM' || c.pos === 'RM');
        ms.by = clamp(ms.by + (50 - ms.by) * (wideAtt ? 0.38 : 0.12) + (rng.next() - 0.5) * 8, 3, 97);
        ms.arr = ARR.SET; ms.from = -1;
        flowGain(ms, c, skill ? 10 : 7, 'dribble', nd);
        c.lostTo = -1;
        if (ms.uc) { if (c.user) memo(ms, ni).dw++; else if (nd.user) { memo(ms, ci).dl++; } }
        if (ms.verb > 1 || cax > 60) emit(ms, 'dribble', t, ci, ni, 0, say(ms, skill ? 'skill_ok' : 'dribble_ok', c.nm, nd.nm), cax > 66 ? 1 : 0);
      } else {
        const fp = clamp(0.28 + (nd.agg - 50) / 260 - (at(ms, nd, A.TAC) - 62) / 260 - nd.m[M.TACKLE] * 0.15 + (skill ? 0.04 : 0), 0.05, 0.42) * (cax > 83 ? 0.07 : 1);
        nd.s[S.TKA]++;
        if (rng.next() < fp) { foul(ms, rng, nd, c, cax > 80 ? 0.5 : 0); break; }
        nd.s[S.TKW]++; c.s[S.LOST]++;
        flowLoss(c, 6); flowGain(ms, nd, 7, 'defend', c);
        c.lostTo = ni;
        if (ms.uc) { if (c.user) memo(ms, ni).dl++; else if (nd.user) memo(ms, ci).dw++; }
        if (ms.verb > 1 || cax > 60) emit(ms, 'dribble', 1 - t, ni, ci, 0, say(ms, 'dribble_fail', c.nm, nd.nm), cax > 66 ? 1 : 0);
        turnoverTo(ms, ni, ms.bx, ms.by);
      }
      break;
    }
    case 'carry': {
      touch(c);
      if (ult === 'sprint') {
        const u = ultOf(c, 'sprint')!; spendUlt(ms, c, u.id, 14);
        M2.time(ms, 8, 0, 0);
        if (user) { c.s[S.DA]++; c.s[S.DC]++; ultStrike(ms, rng, c, 'sprint', -1, 'power'); }
        else if (rng.next() < o.p) { ms.bx = t === 0 ? 80 : 20; ms.by = clamp(ms.by + (50 - ms.by) * 0.5, 5, 95); ms.arr = ARR.SET; ms.from = -1; const D = ms.teams[1 - t].on; for (let k = 0; k < D.length; k++) { const q = ms.pl[D[k]]; if (q.line === 2) q.beat = 2; } flowGain(ms, c, 10, 'dribble'); c.s[S.DA]++; c.s[S.DC]++; }
        else if (nd) { c.s[S.DA]++; c.s[S.LOST]++; nd.s[S.TKA]++; nd.s[S.TKW]++; emit(ms, 'dribble', 1 - t, ms.nd, ci, 0, say(ms, 'dribble_fail', c.nm, nd.nm), 1); turnoverTo(ms, ms.nd, ms.bx, ms.by); }
        break;
      }
      M2.time(ms, 4.2 * tempo + rng.next() * 1.5, 0, 0);
      if (rng.next() < 0.97 || !nd) {
        const adv = 6 + paceSk(ms, c) / 12;
        ms.bx = clamp(ms.bx + (t === 0 ? adv : -adv), 2, 98);
        ms.by = clamp(ms.by + (50 - ms.by) * 0.06 + (rng.next() - 0.5) * 6, 3, 97);
        ms.arr = ARR.SET;
        if (ms.verb > 1) emit(ms, 'carry', t, ci, -1, 0, say(ms, 'carry', c.nm), 0);
      } else { c.s[S.LOST]++; nd.s[S.INT]++; turnoverTo(ms, ms.nd, ms.bx, ms.by); }
      break;
    }
    case 'hold': {
      touch(c);
      if (act) useAbility(ms, c, act.id, act.sta, false);
      M2.time(ms, 3.4 + rng.next() * 1.5, 0, 0);
      if (rng.next() < o.p || !nd) {
        ms.arr = ARR.SET;
        const tempoV = c.m[M.TEMPO] + actBonus(act, M.TEMPO) + actBonus(act, M.HOLD) * 0.5;
        if (tempoV > 0.15 || act) { ms.hold = 2; const on = T.on; for (let k = 0; k < on.length; k++) { const q = ms.pl[on[k]]; if (q.line >= 2 && on[k] !== ci && !q.run && rng.next() < 0.3 + tempoV) { q.run = RUN.BEHIND; q.runT = 2; q.open = rng.next() < 0.5 + tempoV * 0.5; } } }
        if (ms.verb > 1) emit(ms, 'hold', t, ci, -1, 0, say(ms, 'hold', c.nm), 0);
      } else {
        c.s[S.LOST]++; nd.s[S.TKA]++; nd.s[S.TKW]++; flowLoss(c, 4);
        if (ms.verb > 1) emit(ms, 'hold', 1 - t, ms.nd, ci, 0, say(ms, 'hold_fail', c.nm, nd.nm), 0);
        turnoverTo(ms, ms.nd, ms.bx, ms.by);
      }
      break;
    }
    case 'onetwo': {
      const mi = o.tgt, m = ms.pl[mi];
      const react = o.v === 'react';
      if (act) useAbility(ms, c, act.id, act.sta, false);
      if (ult === 'chain') { const u = ultOf(c, 'chain')!; spendUlt(ms, c, u.id, 6); }
      else if (react) c.st = Math.max(1, c.st - 4);
      c.s[S.PA]++; m.s[S.PA]++; touch(c); touch(m);
      M2.time(ms, 5 * tempo + rng.next() * 1.5, 0, 0);
      if (ult === 'chain' && user) { c.s[S.PC]++; m.s[S.PC]++; ms.seqPasses += 2; ultStrike(ms, rng, c, 'chain', mi, 'first'); break; }
      if (rng.next() < o.p) {
        c.s[S.PC]++; m.s[S.PC]++; ms.seqPasses += 2;
        if (nd) nd.beat = 2;
        const adv = react ? 18 : 12;
        const nx = react ? Math.max(ax(t, ms.bx) + adv, 84) : ax(t, ms.bx) + adv;
        ms.bx = t === 0 ? clamp(nx, 2, 96) : 100 - clamp(nx, 2, 96);
        ms.by = clamp(ms.by + (50 - ms.by) * (react ? 0.6 : 0.2), 4, 96);
        ms.from = mi; ms.fromT = ms.play; ms.arr = ARR.GROUND; ms.bh = 0;
        if (ms.uc) { if (c.user) { memo(ms, mi).pt++; memo(ms, mi).pf++; ms.uc.unselfish++; } else if (m.user) { memo(ms, ci).pt++; memo(ms, ci).pf++; } }
        emit(ms, 'onetwo', t, ci, mi, 0, say(ms, react ? 'reaction' : 'onetwo', c.nm, m.nm), react ? 2 : 1);
        flowGain(ms, c, react ? 14 : 6, 'key');
        if (react && ms.uc && c.user) ms.uc.used['react:' + m.id] = (ms.uc.used['react:' + m.id] ?? 0) + 1;
      } else {
        c.s[S.LOST]++; flowLoss(c, 3);
        if (ms.verb > 1) emit(ms, 'onetwo', t, ci, mi, 0, say(ms, 'onetwo_fail', c.nm, m.nm), 0);
        if (nd) { nd.s[S.INT]++; turnoverTo(ms, ms.nd, nd.x, nd.y); } else loose(ms, ms.bx, ms.by);
      }
      break;
    }
  }
}

// ───────────────────────────── step phases ─────────────────────────────
function importanceBall(cax: number): number { return cax >= 83 ? 95 : cax >= 66 ? 80 : cax >= 45 ? 56 : 36; }

function ask(ms: MatchState, d: Decision): boolean {
  const u = ms.uc!;
  if (u.mode === 'sim') return false;
  const thr = u.mode === 'key' ? Math.max(u.thr, 70) : u.thr;
  if (d.imp < thr) return false;
  ms.pending = d;
  u.decisions++;
  return true;
}

/** Defensive phase. Returns 1 to pause for the user, 2 when possession changed, 0 otherwise. */
function defPhase(ms: MatchState, rng: Rng): number {
  if (ms.car < 0) return 0;
  const c = ms.pl[ms.car];
  if (c.line === 0 || ms.note) return 0;
  const nd = ms.nd >= 0 ? ms.pl[ms.nd] : null;
  if (!nd) return 0;
  const dt = nd.t;
  const D = ms.teams[dt];
  const cax = ax(c.t, ms.bx);
  const u = ms.uc;
  const tackleP = () => clamp(sig(cz(defSk(ms, nd) - (drbSk(ms, c) * 0.6 + holdSk(ms, c) * 0.4)) / 16 - 0.55 + nd.m[M.TACKLE] - c.m[M.PRESS_RES] * 0.6 + nd.m[GB] - c.m[GB] + (nd.user && u ? u.forgive : 0)), 0.05, 0.92);
  if (nd.user && u && nd.on) {
    if (ms.choice == null) {
      if (u.lastDefSeq !== ms.seq && ms.press > 0.25) {
        const imp = cax >= 66 ? 78 : cax >= 40 ? 52 : 38;
        const tp = tackleP();
        const act = actFor(ms, nd, 'tackle');
        const opts: Option[] = [];
        const mk = (id: string, label: string, detail: string, intent: string, p: number, kind: string): Option => ({ id, kind, label, detail, intent, risk: riskLabel(p), p, u: 0, tgt: ms.car, v: '', ab: '', sta: 0 });
        opts.push(mk('def:tackle', `Tackle ${c.nm}`, 'Commit now. Miss and you are out of the play; mistime it and it is a foul.', 'Win the ball', tp, 'tackle'));
        if (act) { const o = mk('def:tackle:ab', act.name, 'Trigger your ball-winning weapon.', 'Win the ball', clamp(sig(logit(tp) + actBonus(act, M.TACKLE)), 0, 0.95), 'tackle'); o.ab = act.id; o.sta = act.sta; o.hot = true; opts.push(o); }
        opts.push(mk('def:press', 'Press him', 'Close the space and rush his decision. Costs stamina.', 'Force an error', 0.75, 'press'));
        opts.push(mk('def:contain', 'Jockey', 'Stay on your feet and show him away from goal.', 'Delay the attack', 0.9, 'contain'));
        const ia = actFor(ms, nd, 'intercept');
        const o4 = mk('def:cut', ia ? ia.name : 'Cut the passing lane', 'Step off and read the next pass.', 'Intercept', 0.55, 'cut'); if (ia) { o4.ab = ia.id; o4.sta = ia.sta; o4.hot = true; } opts.push(o4);
        const ic = canUlt(ms, nd, 'curtain');
        if (ic && cax > 60) { const o = mk('ult:curtain', 'Iron Curtain', 'A perfectly timed last-ditch challenge.', 'Stop him dead', clamp(0.8 + ic.lv * 0.02, 0, 0.92), 'tackle'); o.ab = ic.id; o.sta = 8; o.hot = true; opts.push(o); }
        u.lastDefSeq = ms.seq;
        if (ask(ms, { kind: 'defend', title: `${c.nm} is running at you`, ctx: `${D.name} out of possession · ${cax >= 66 ? 'your defensive third' : 'midfield'}`, options: opts, imp })) return 1;
      }
    } else {
      const ch = ms.choice; ms.choice = null;
      if (ch.startsWith('def:tackle') || ch === 'ult:curtain') {
        let p = tackleP();
        let noFoul = false;
        if (ch === 'ult:curtain') { const ic = ultOf(nd, 'curtain')!; spendUlt(ms, nd, ic.id, 8); p = nd.user ? 1 : clamp(0.8 + ic.lv * 0.02, 0, 0.92); noFoul = true; if (nd.user) CURTAIN.set(ms, { t: nd.t, until: ms.steps + 40 }); }
        else if (ch.endsWith(':ab')) { const act = actFor(ms, nd, 'tackle'); if (act) { p = clamp(sig(logit(p) + actBonus(act, M.TACKLE)), 0, 0.95); useAbility(ms, nd, act.id, act.sta, true); } }
        return doTackle(ms, rng, nd, c, p, noFoul);
      }
      if (ch === 'def:press') { nd.focus = 1; nd.st = Math.max(1, nd.st - 1.2); ms.press = Math.min(1, ms.press + 0.22); u.discipline += u.instr.press >= 1 ? 1 : 0.5; u.disciplineN++; if (ms.verb > 1) emit(ms, 'press', dt, ms.nd, ms.car, 0, say(ms, 'press', nd.nm, c.nm), 0); return 0; }
      if (ch === 'def:contain') { nd.focus = 2; u.discipline += 1; u.disciplineN++; if (ms.verb > 1) emit(ms, 'press', dt, ms.nd, ms.car, 0, say(ms, 'contain', nd.nm, c.nm), 0); return 0; }
      if (ch === 'def:cut') { nd.focus = 3; const ia = actFor(ms, nd, 'intercept'); if (ia) useAbility(ms, nd, ia.id, ia.sta, false); ms.press *= 0.6; u.discipline += 1; u.disciplineN++; return 0; }
      return 0;
    }
  }
  // AI tackle attempt
  const pAtt = clamp(ms.press * (0.008 + 0.02 * D.tac.press) * (nd.agg / 70) * (nd.user && u ? 0.5 + u.instr.press * 0.5 : 1), 0, 0.42);
  if (rng.next() < pAtt) return doTackle(ms, rng, nd, c, tackleP(), false);
  if (rng.next() < ms.press * 0.022 * (nd.agg / 60) * (cax > 83 ? 0.08 : 1)) { foul(ms, rng, nd, c, 0); return 2; }
  return 0;
}

function doTackle(ms: MatchState, rng: Rng, nd: MPlayer, c: MPlayer, p: number, noFoul: boolean): number {
  const ni = ms.pl.indexOf(nd), ci = ms.car;
  const cax = ax(c.t, ms.bx);
  nd.s[S.TKA]++;
  nd.st = Math.max(1, nd.st - 0.5);
  machineOf(ms).time(ms, 1.5, 0, 0);
  if (rng.next() < p) {
    nd.s[S.TKW]++; c.s[S.LOST]++;
    flowGain(ms, nd, 7, 'defend', c); flowLoss(c, 5);
    if (ms.uc) { if (nd.user) { memo(ms, ci).dw++; ms.uc.discipline += 1; ms.uc.disciplineN++; } else if (c.user) memo(ms, ni).dl++; }
    if (ms.verb > 1 || cax > 62 || nd.user) emit(ms, 'tackle', nd.t, ni, ci, 0, say(ms, 'tackle', nd.nm, c.nm), cax > 70 || nd.user ? 1 : 0);
    turnoverTo(ms, ni, ms.bx, ms.by);
    return 2;
  }
  const fp = noFoul ? 0 : clamp(0.3 + (nd.agg - 50) / 240 - (at(ms, nd, A.TAC) - 62) / 240 - nd.m[M.TACKLE] * 0.2, 0.06, 0.5) * (cax > 83 ? 0.07 : 1);
  if (rng.next() < fp) { foul(ms, rng, nd, c, cax > 80 ? 0.5 : 0.1); return 2; }
  nd.beat = 2;
  if (ms.uc) { if (nd.user) memo(ms, ci).dl++; else if (c.user) memo(ms, ni).dw++; }
  if (ms.verb > 1) emit(ms, 'tackle', c.t, ci, ni, 0, say(ms, 'tackle_miss', nd.nm, c.nm), 0);
  pressure(ms);
  return 0;
}

/** The last successful take-on (shown before the shot in the 3D view when he shoots straight after it). */
const DRIB = new WeakMap<MatchState, { idx: number; step: number; def: number; skill: number }>();
const CURTAIN = new WeakMap<MatchState, { t: number; until: number }>();
const URGE = new WeakMap<MatchState, { idx: number; step: number }>();
const PRED = new WeakMap<MatchState, number>();
/** Chance that a user's ultimate ends in a goal. */
const ULT_GOAL = 0.9;
/** An ultimate unleashed without Flow (the once-a-match free use) is a big moment, not a guaranteed goal. */
const ULT_FREE = 0.6;
const LAST_FREE = new WeakMap<MatchState, boolean>();
const ug = (ms: MatchState) => (LAST_FREE.get(ms) ? ULT_FREE : ULT_GOAL);
/** The user's ultimate finishes the move itself: the ball is put on a plate and struck. */
/** The user's ultimate if it can be used now (any kind). */
function anyUlt(ms: MatchState, p: MPlayer): { id: string; lv: number } | null {
  for (let i = 0; i < p.ab.length; i++) { const d = abilityDef(p.ab[i].id); if (d?.kind === 'ultimate' && d.ult && d.ult !== 'curtain' && d.ult !== 'dominion' && d.ult !== 'fk') return canUlt(ms, p, d.ult); }
  return null;
}
function ultStrike(ms: MatchState, rng: Rng, sh: MPlayer, key: string, from: number, v0 = 'placed'): void {
  let v = v0;
  const t = sh.t;
  ms.car = ms.pl.indexOf(sh); ms.poss = t as 0 | 1; ms.from = from; ms.fromT = ms.play;
  // the strike happens where the move actually is: a shooter wide on the left stays on the left
  const tight = key === 'dag', far = key === 'comet' || key === 'crescent', run = key === 'trance' || key === 'sprint' || key === 'charge';
  const carrier = ms.car >= 0 && ms.pl[ms.car] === sh;
  const cx = ax(t, carrier ? ms.bx : sh.x), cy = carrier ? ms.by : sh.y;
  const j1 = rng.next(), j2 = rng.next();
  const nax = tight ? 94 + j1 * 3 : key === 'crescent' ? clamp(cx, 76, 86) : far ? clamp(cx, 70, 81) : run ? clamp(Math.max(cx + 10, 84), 84, 90) : clamp(cx, 80, 92);
  const ny = tight ? (cy < 50 ? 9 + j2 * 7 : 84 + j2 * 7) : run ? clamp(cy + (50 - cy) * 0.3 + (j2 - 0.5) * 6, 28, 72) : clamp(cy + (j2 - 0.5) * 4, 22, 78);
  ms.bx = t === 0 ? nax : 100 - nax; ms.by = ny; ms.arr = from >= 0 ? ARR.GROUND : ARR.SET; ms.bh = v === 'header' ? 2 : 0; ms.note = '';
  if (tight) v = 'dag:outside';
  sh.x = ms.bx; sh.y = ms.by;
  resolveShot(ms, rng, sh, v, null, key, ug(ms));
}
function startRun(ms: MatchState, p: MPlayer, type: number, bonus: number, rng: Rng | null, pFixed = -1): number {
  const t = p.t;
  const mk = nearestOpp(ms, t, p.x, p.y);
  const marker = mk.i >= 0 ? ms.pl[mk.i] : null;
  const D = ms.teams[1 - t];
  let l = marker ? cz(offSk(ms, p) - (at(ms, marker, A.MAR) * 0.45 + at(ms, marker, A.DAW) * 0.35 + at(ms, marker, A.SPD) * 0.2)) / 15 - 0.35 - marker.m[M.READ] : 1.2;
  if (type === RUN.BLIND) l += p.m[M.RUN_BLIND] + 0.05;
  else if (type === RUN.BEHIND) l += p.m[M.RUN_BEHIND] + p.m[M.PACE] * 0.5 + (D.tac.line - 0.5) * 0.9;
  else if (type === RUN.NEAR || type === RUN.FAR) l += p.m[M.BOX_POS] + 0.1;
  else if (type === RUN.SHORT) l += 0.9;
  else if (type === RUN.OVERLAP) l += 0.5 + p.m[M.PACE] * 0.5;
  l += bonus + p.m[GB];
  if (marker && marker.focus === 4) l -= 0.8;
  const pr = pFixed >= 0 ? pFixed : clamp(sig(l), 0.05, 0.95);
  if (!rng) return pr;
  p.run = type; p.runT = 2 + (type === RUN.SHORT ? 0 : 1);
  p.open = rng.next() < pr;
  p.st = Math.max(1, p.st - (type === RUN.SHORT || type === RUN.HOLD ? 0.2 : 0.6));
  return pr;
}

/** Off-ball phase: runs by attackers. Returns 1 to pause for the user. */
function offPhase(ms: MatchState, rng: Rng): number {
  if (ms.car < 0) return 0;
  const c = ms.pl[ms.car];
  const t = c.t;
  const T = ms.teams[t];
  const cax = ax(t, ms.bx);
  const u = ms.uc;
  const wide = Math.abs(ms.by - 50) > 24 && cax > 68;
  if (u && ms.choice != null) {
    const me = ms.pl[u.idx];
    const ch = ms.choice; ms.choice = null;
    if (ch === 'run:shoot') { const pr = clamp(0.55 + me.trust / 260 + (c.ego - 50) / 250, 0.15, 0.9); if (rng.next() < pr) URGE.set(ms, { idx: ms.car, step: ms.steps }); me.run = RUN.HOLD; me.runT = 2; emit(ms, 'call', t, u.idx, ms.car, 0, `${me.nm} screams at ${c.nm} to shoot!`, 1); }
    else if (ch === 'run:call') { me.run = RUN.HOLD; me.runT = 3; me.req = 4; me.open = rng.next() < clamp(0.35 + nearestOpp(ms, t, me.x, me.y).d / 12, 0.2, 0.92); emit(ms, 'call', t, u.idx, ms.car, 0, `${me.nm} calls for it to feet.`, 0); }
    const map: Record<string, number> = { 'run:behind': RUN.BEHIND, 'run:blind': RUN.BLIND, 'run:short': RUN.SHORT, 'run:near': RUN.NEAR, 'run:far': RUN.FAR, 'run:overlap': RUN.OVERLAP, 'run:hold': RUN.HOLD };
    if (ch === 'ult:predator') {
      const pe = ultOf(me, 'predator')!; spendUlt(ms, me, pe.id, 6);
      me.run = RUN.PRED; me.runT = 3; me.open = true; me.req = 3;
      if (u.mode !== 'sim') { // the pass comes at once and the finish is all but certain
        c.s[S.PA]++; c.s[S.PC]++; touch(c);
        ultStrike(ms, rng, me, 'predator', ms.pl.indexOf(c), 'first'); PRED.set(ms, ms.steps);
      }
    } else if (ch.startsWith('run:blind:ab') || ch.startsWith('run:behind:ab')) {
      const act = actFor(ms, me, 'run');
      const type = ch.startsWith('run:blind') ? RUN.BLIND : RUN.BEHIND;
      if (act) { useAbility(ms, me, act.id, act.sta, false); startRun(ms, me, type, actBonus(act, M.RUN_BLIND) + actBonus(act, M.RUN_BEHIND) + u.forgive, rng); } else startRun(ms, me, type, u.forgive, rng);
      me.req = 3;
    } else if (map[ch] != null) {
      const type = map[ch];
      if (type === RUN.HOLD) { me.run = RUN.HOLD; me.runT = 2; me.open = false; u.discipline += 1; u.disciplineN++; }
      else { startRun(ms, me, type, u.forgive, rng); me.runT += 2; me.req = type === RUN.SHORT ? 3 : 2; if (type === RUN.SHORT || type === RUN.OVERLAP) { u.discipline += 1; u.disciplineN++; } }
    }
    if (PRED.get(ms) === ms.steps) return 2;
    // the run happens now, not a step later: move the player at once so the choice is visible
    shape(ms); pressure(ms);
  }
  // AI runs
  if (cax > 38) {
    const on = T.on;
    for (let k = 0; k < on.length; k++) {
      const p = ms.pl[on[k]];
      if (on[k] === ms.car || p.line < 2) continue;
      if (p.run) { if (--p.runT <= 0) { p.run = 0; p.open = false; } continue; }
      if (p.user && u && u.mode !== 'sim' && u.lastSeq === ms.seq) continue;
      const pr = (p.line === 3 ? 0.13 : p.pos === 'AM' ? 0.09 : 0.035) + offSk(ms, p) / 1100 + (cax > 62 ? 0.05 : 0);
      if (rng.next() < pr) {
        const type = wide && ax(t, p.x) > 74 ? (rng.chance(0.5) ? RUN.NEAR : RUN.FAR) : p.m[M.RUN_BLIND] > 0.2 || rng.chance(0.3) ? RUN.BLIND : RUN.BEHIND;
        if (p.user && u && u.mode !== 'sim') continue;
        startRun(ms, p, type, 0, rng);
      }
    }
  }
  // user off-ball prompt
  if (u) {
    const me = ms.pl[u.idx];
    if (me.on && me.t === t && u.idx !== ms.car && me.line > 0 && u.lastSeq !== ms.seq && !me.run && cax >= 40 && (me.line >= 2 || cax > 58)) {
      const imp = cax >= 66 ? 72 : 48;
      const opts: Option[] = [];
      const mk = (id: string, label: string, detail: string, intent: string, p: number): Option => ({ id, kind: 'run', label, detail, intent, risk: riskLabel(p), p, u: 0, tgt: -1, v: '', ab: '', sta: 0 });
      const act = actFor(ms, me, 'run');
      if (me.line >= 2) {
        opts.push(mk('run:behind', 'Run in behind', `Sprint beyond the last defender and ask ${c.nm} for the through ball.`, 'Get in on goal', startRun(ms, me, RUN.BEHIND, u.forgive, null)));
        opts.push(mk('run:blind', 'Blindside run', 'Drift off your marker\'s shoulder into his blind spot.', 'Lose your marker', startRun(ms, me, RUN.BLIND, u.forgive, null)));
        if (act) { const d = abilityDef(act.id)!; const blind = d.fx.some((f) => f.k === 'RUN_BLIND') || act.fx.some((f) => f.k === M.RUN_BLIND); const o = mk(blind ? 'run:blind:ab' : 'run:behind:ab', act.name, 'Trigger your movement weapon.', 'Lose your marker', startRun(ms, me, blind ? RUN.BLIND : RUN.BEHIND, actBonus(act, M.RUN_BLIND) + actBonus(act, M.RUN_BEHIND) + u.forgive, null)); o.ab = act.id; o.sta = act.sta; o.hot = true; opts.push(o); }
      }
      if (wide && me.line >= 2) {
        opts.push(mk('run:near', 'Attack the near post', 'Dart across your marker for the early ball.', 'Meet the cross', startRun(ms, me, RUN.NEAR, u.forgive, null)));
        opts.push(mk('run:far', 'Peel to the far post', 'Hang off the back of the defence.', 'Meet the cross', startRun(ms, me, RUN.FAR, u.forgive, null)));
      }
      if (me.pos === 'LB' || me.pos === 'RB' || me.pos === 'LM' || me.pos === 'RM') opts.push(mk('run:overlap', 'Overlap', 'Go around the outside to give width.', 'Stretch them', startRun(ms, me, RUN.OVERLAP, u.forgive, null)));
      opts.push(mk('run:call', 'Call for the pass where you are', `Stay put, show your feet and demand the ball. ${c.nm} decides whether to trust you.`, 'Get on the ball', clamp(0.35 + nearestOpp(ms, t, me.x, me.y).d / 12, 0.2, 0.92)));
      if (cax > 62) opts.push(mk('run:shoot', `Tell ${c.nm} to shoot`, 'Shout for the shot. Whether he listens depends on his trust in you and his own ego.', 'Force the issue', clamp(0.55 + me.trust / 260 + (c.ego - 50) / 250, 0.15, 0.9)));
      opts.push(mk('run:short', 'Come short and call for it', `Show for the ball to feet. ${c.nm} decides whether to trust you.`, 'Get on the ball', 0.85));
      opts.push(mk('run:hold', 'Hold your position', 'Keep the team\'s shape and pin your marker.', 'Stay disciplined', 0.95));
      const pe = canUlt(ms, me, 'predator');
      if (pe && cax > 60) { const o = mk('ult:predator', 'Predator\'s Eye', 'Lock onto the most dangerous point in the box and arrive there unmarked.', 'Get free', 0.95); o.ab = pe.id; o.sta = 6; o.hot = true; opts.push(o); }
      u.lastSeq = ms.seq;
      if (ask(ms, { kind: 'offball', title: `${c.nm} has the ball`, ctx: `${T.name} in possession · ${cax >= 66 ? 'final third' : 'midfield'}${wide ? ' · ball is wide' : ''}`, options: opts, imp })) return 1;
      // not asked: AI decides for the user's player on the next step
      u.lastSeq = -1;
    }
  }
  return 0;
}

/** The shot a user-goalkeeper has been asked about, and the multiplier his answer puts on the chance of a goal. */
const KEEP = new WeakMap<MatchState, string>();
let KMUL = 1;
function actPhase(ms: MatchState, rng: Rng): number {
  if (ms.car < 0) { resolveLoose(ms, rng); return 0; }
  const c = ms.pl[ms.car];
  const u = ms.uc;
  const isUser = !!(c.user && u && u.mode !== 'sim');
  const cax = ax(c.t, ms.bx);
  const opts = buildOptions(ms, c, isUser);
  if (!opts.length) { ms.bx = clamp(ms.bx + (c.t === 0 ? 4 : -4), 2, 98); machineOf(ms).time(ms, 3, 0, 0); return 0; }
  let chosen: Option | null = null;
  // resuming after the user-goalkeeper's decision: the shot that was coming is taken, altered by his choice
  let kpDone = false, kmul = 1;
  const kp = KEEP.get(ms);
  if (kp != null && ms.choice != null && u && !isUser) {
    const ch = ms.choice; ms.choice = null; KEEP.delete(ms); kpDone = true;
    chosen = opts.find((o) => o.id === kp) ?? null;
    const left = ((ms.steps * 2654435761) >>> 0) % 1000 < 500; // the side the shot is going (the same number places it in the 3D view)
    const geo = shotGeo(cax, ms.by);
    kmul = ch === 'gk:set' ? (ms.note === 'pen' ? 1.05 : 0.9) : ch === 'gk:left' ? (left ? 0.5 : 1.45) : ch === 'gk:right' ? (left ? 1.45 : 0.5) : ch === 'gk:rush' ? (geo.d < 10 ? 0.62 : 1.18) : ch === 'gk:big' ? 0.76 : 1;
  } else if (kp != null) KEEP.delete(ms);
  const urge = URGE.get(ms);
  if (urge && urge.idx === ms.car && ms.steps - urge.step <= 1 && !isUser) { URGE.delete(ms); const sh = opts.filter((o) => o.kind === 'shoot').sort((a, b) => b.p - a.p)[0]; if (sh) chosen = sh; }
  if (isUser && u) {
    if (ms.choice != null) {
      const ch = ms.choice; ms.choice = null;
      if (ch === 'flow:enter') { enterFlow(ms, c); return actPhase(ms, rng); }
      if (ch === 'ult:dominion') { const fd = ultOf(c, 'dominion'); if (fd) { spendUlt(ms, c, fd.id, 4); u.dominion = ms.play + 180; } return actPhase(ms, rng); }
      chosen = opts.find((o) => o.id === ch) ?? null;
    } else {
      const imp = ms.note === 'pen' ? 100 : ms.note === 'fk' ? 90 : importanceBall(cax);
      const list = opts.map((o) => ({ ...o })).sort((a, b) => (a.kind === 'meta' ? -1 : 0) - (b.kind === 'meta' ? -1 : 0));
      const where = cax >= 83 ? 'in the box' : cax >= 66 ? 'final third' : cax >= 45 ? 'midfield' : 'own half';
      const d: Decision = { kind: ms.note === 'pen' ? 'penalty' : 'ball', title: ms.note === 'pen' ? 'Penalty — you are taking it' : ms.arr === ARR.CROSS || ms.arr === ARR.LOFT ? 'The ball is dropping to you' : ms.arr === ARR.REBOUND ? 'The rebound falls to you!' : 'You have the ball', ctx: `${where} · pressure ${ms.press > 0.66 ? 'heavy' : ms.press > 0.33 ? 'moderate' : 'light'}${c.flEnd > ms.play ? ' · FLOW' : ''}`, options: list, imp };
      if (ask(ms, d)) return 1;
    }
  }
  if (!chosen) {
    chosen = aiPick(ms, rng, c, opts);
    // AI stars reach for ultimates when the moment allows
    if (c.canFlow && c.flEnd > ms.play && !isUser) { const hot = opts.find((o) => o.id.startsWith('ult:') && o.kind === chosen!.kind); if (hot && rng.chance(0.55)) chosen = hot; }
  }
  if (u && c.user && isUser) { const best = opts.reduce((m, o) => (o.kind !== 'meta' && o.u > m ? o.u : m), -1); if (chosen.u >= best * 0.7) { u.discipline += 1; } u.disciplineN++; }
  // teammates ignoring the user's run
  if (u && !c.user && c.t === ms.pl[u.idx].t) {
    const me = ms.pl[u.idx];
    if (me.on && me.req > 0 && me.open && chosen.tgt !== u.idx && (chosen.kind === 'shoot' || chosen.kind === 'dribble')) {
      memo(ms, ms.car).ign++;
      if (ms.verb > 0) emit(ms, 'ignored', c.t, u.idx, ms.car, 0, say(ms, 'run_ignored', me.nm, c.nm), 1);
      me.req = 0;
    }
  }
  // the user in goal: every shot at his goal is his decision (set, guess a side, come out, stay big)
  if (u && u.mode !== 'sim' && !isUser && chosen.kind === 'shoot' && !kpDone) {
    const me = ms.pl[u.idx];
    if (me.on && me.line === 0 && me.t !== c.t) {
      const geo = shotGeo(cax, ms.by);
      const gp = clamp(chosen.p, 0.02, 0.97);
      const mkO = (id: string, label: string, detail: string, mult: number, risk: string): Option => ({ id, kind: 'keep', label, detail, intent: 'Keep it out', risk, p: clamp(1 - gp * mult, 0.02, 0.98), u: 0, tgt: -1, v: '', ab: '', sta: 0 });
      const pen = ms.note === 'pen';
      const opts2: Option[] = [mkO('gk:set', pen ? 'Stay in the middle' : 'Set yourself and react', pen ? 'Wait for him to commit.' : 'Hold your ground and trust your reflexes. Reliable.', pen ? 1.05 : 0.9, 'Safe')];
      opts2.push(mkO('gk:left', 'Commit early: dive left', 'Left is the top of the pitch view. Right guess and you are there before the ball; wrong and the net is empty.', 0.975, 'Guess'));
      opts2.push(mkO('gk:right', 'Commit early: dive right', 'Right is the bottom of the pitch view. Right guess and you are there before the ball; wrong and the net is empty.', 0.975, 'Guess'));
      if (!pen && geo.d < 17) opts2.push(mkO('gk:rush', 'Rush out and smother', geo.d < 10 ? 'He is close: closing the angle fast is your best chance.' : 'He still has time to lift it over you.', geo.d < 10 ? 0.62 : 1.18, geo.d < 10 ? 'Moderate' : 'Risky'));
      if (!pen && geo.d < 9) opts2.push(mkO('gk:big', 'Stay big', 'Spread yourself and make him beat you.', 0.76, 'Moderate'));
      KEEP.set(ms, chosen.id);
      if (ask(ms, { kind: 'keeper', title: pen ? `Penalty — ${c.nm} steps up` : `${c.nm} shoots!`, ctx: `${Math.round(geo.d)} m out · he scores ${Math.round(gp * 100)}% of the time from here`, options: opts2, imp: 100 })) return 1;
      KEEP.delete(ms);
    }
  }
  KMUL = kmul;
  resolve(ms, rng, c, chosen);
  KMUL = 1;
  return 0;
}

function resolveLoose(ms: MatchState, rng: Rng): void {
  let b0 = -1, b1 = -1, v0 = -1e9, v1 = -1e9;
  for (let t = 0; t < 2; t++) {
    const on = ms.teams[t].on;
    for (let k = 0; k < on.length; k++) {
      const p = ms.pl[on[k]];
      if (p.line === 0) continue;
      const v = -dist(p.x, p.y, ms.bx, ms.by) * 2.2 + at(ms, p, A.REA) * 0.25 + p.m[M.REBOUND] * 60 + rng.next() * 16;
      if (t === 0) { if (v > v0) { v0 = v; b0 = on[k]; } } else if (v > v1) { v1 = v; b1 = on[k]; }
    }
  }
  const w = b1 < 0 || (b0 >= 0 && v0 >= v1) ? b0 : b1;
  machineOf(ms).time(ms, 2.5, 0, 0);
  if (w < 0) { setRestart(ms, RST.GOALKICK, ms.poss, 0, 0); return; }
  give(ms, w, ms.bx, ms.by, ARR.LOOSE);
  if (ms.verb > 1) emit(ms, 'loose', ms.pl[w].t, w, -1, 0, say(ms, 'loose', ms.pl[w].nm), 0);
}

function tick(ms: MatchState, rng: Rng, c0: number, p0: number): void {
  const dc = ms.clock - c0, dp = ms.play - p0;
  if (dc <= 0 && dp <= 0) return;
  for (let t = 0; t < 2; t++) {
    const T = ms.teams[t];
    const drainT = 0.0082 * (1 + 0.45 * T.tac.press + 0.2 * T.tac.tempo);
    for (let k = 0; k < T.on.length; k++) {
      const p = ms.pl[T.on[k]];
      p.s[S.SEC] += dc; p.s[S.PLAY] += dp;
      if (dp > 0) {
        let d = dp * drainT * (1.4 - p.a[A.STA] / 100 * 0.75) * (p.line === 0 ? 0.25 : p.line === 2 ? 1.1 : 1) * (1 - p.m[M.STA_SAVE]);
        if (p.flEnd > ms.play) d *= 1.25;
        if (p.user && ms.uc) d *= 0.9 + ms.uc.instr.press * 0.1;
        p.st = p.st - d < 1 ? 1 : p.st - d;
      }
      if (p.beat > 0) p.beat--;
      if (p.req > 0) p.req--;
    }
  }
  if (ms.hold > 0) ms.hold--;
  if (dp > 0) tickFlow(ms, dp);
}

function stepOnce(ms: MatchState, rng: Rng): void {
  const M2 = machineOf(ms);
  const c0 = ms.clock, p0 = ms.play;
  if (ms.stage === 0) {
    if (M2.tick(ms, rng)) return;
    if (ms.rules.starChange) checkStar(ms);
    if (ms.restart) { doRestart(ms, rng); if (ms.done) return; if (ms.restart) { tick(ms, rng, c0, p0); return; } }
    shape(ms);
    if ((ms.steps & 15) === 0 || ms.steps < 2) refreshDq(ms);
    pressure(ms);
    ms.stage = 1;
  }
  if (ms.stage === 1) {
    const r = defPhase(ms, rng);
    if (r === 1) return;
    if (r === 2) { ms.stage = 0; ms.steps++; tick(ms, rng, c0, p0); return; }
    ms.stage = 2;
  }
  if (ms.stage === 2) {
    const r2 = offPhase(ms, rng);
    if (r2 === 1) return;
    if (r2 === 2) { ms.stage = 0; ms.steps++; tick(ms, rng, c0, p0); return; }
    ms.stage = 3;
  }
  if (ms.stage === 3) {
    if (actPhase(ms, rng) === 1) return;
    ms.stage = 0; ms.steps++;
    tick(ms, rng, c0, p0);
  }
}

/** Set the per-match injury multiplier (career setting). */
export function setInjuryRate(mult: number): void { injMul = mult; }

/**
 * Advance the match. Runs until the match ends, a user decision is pending or `maxSteps`
 * simulation steps have elapsed. Pass `choice` to answer the pending decision.
 */
export function advance(ms: MatchState, choice?: string, maxSteps = 1e9): void {
  if (ms.done) return;
  const rng = new Rng(ms.rng);
  if (ms.pending) {
    if (choice == null) return;
    const ok = ms.pending.options.some((o) => o.id === choice);
    ms.choice = ok ? choice : ms.pending.options[0].id;
    ms.pending = null;
  }
  if (ms.phase === 'PRE') { machineOf(ms).start(ms); ms.restart = { k: RST.KICKOFF, t: 0, x: 50, y: 50 }; }
  let n = 0;
  const startSteps = ms.steps;
  while (!ms.done && !ms.pending && ms.steps - startSteps < maxSteps && n++ < 200000) stepOnce(ms, rng);
  // keep the picture consistent between steps: whoever has the ball stands where the ball is
  if (ms.car >= 0 && ms.pl[ms.car]?.on) { ms.pl[ms.car].x = ms.bx; ms.pl[ms.car].y = ms.by; }
  if (ms.done) finishMatch(ms);
}

function finishMatch(ms: MatchState): void {
  if (ms.pl.some((p) => p.s[S.RATN] > 0)) return;
  let best = -1, bv = -1;
  for (let i = 0; i < ms.pl.length; i++) {
    const p = ms.pl[i];
    if (!p.used) continue;
    const gf = ms.score[p.t], ga = ms.score[1 - p.t];
    const win = ms.winner === p.t ? 1 : ms.winner === -1 ? 0 : -1;
    const minPlay = ms.rules.kind === 'nel' ? 480 : 600;
    if (p.s[S.SEC] >= minPlay || p.s[S.G] > 0 || p.star) {
      const r = ratingOf(p, gf, ga, win);
      p.s[S.RAT] = r; p.s[S.RATN] = 1;
      const v = r + p.s[S.G] * 0.01;
      if (v > bv) { bv = v; best = i; }
    }
    // clean sheet: goalkeepers and defenders who played at least 60% of the match while the team conceded none in total
    const total = ms.rules.kind === 'nel' ? ms.play : Math.max(5400, ms.clock);
    if (ga === 0 && p.line <= 1 && p.s[S.SEC] >= total * 0.6) p.s[S.CS] = 1;
  }
  if (best >= 0) ms.pl[best].s[S.POTM] = 1;
}
