/** Building a MatchState from the world (lineups, snapshots) and applying a finished match back to it. */
import type { Club, Fixture, Game, Player, Pos, Tactics, World } from '../types';
import { A, fitAt, ovr, POS_LINE, N_ATTR } from '../attributes';
import { buildMods, M, N_MODS, abilityDef, egoType, reactionName, weaponTags } from '../abilities';
import { mixSeed, seedState, clamp, hashStr } from '../rng';
import { FORMATIONS } from '../data/clubs';
import { NATIONS } from '../data/nations';
import { nationKit } from '../data/kits';
import { S, NSTAT, newLine, addLine, REG_RULES, type MatchState, type MPlayer, type MTeam, type Rules, type UserCtl } from './model';
import { advance, setInjuryRate } from './engine';

export interface TeamInfo { id: string; name: string; abbr: string; col: string; col2: string; tac: Tactics; squad: string[]; master?: string; nat: boolean; rep: number }


export function teamInfo(w: World, id: string, u20 = false): TeamInfo {
  const c = w.clubs[id];
  if (c) return { id, name: c.name, abbr: c.abbr, col: c.col[0], col2: c.col[1], tac: c.tac, squad: c.squad, master: c.master, nat: false, rep: c.rep };
  const n = NATIONS[id];
  const ns = w.nations[id];
  const h = hashStr(id);
  return {
    id, name: (n?.name ?? id) + (u20 ? ' U-20' : ''), abbr: id, col: nationKit(id).c1, col2: nationKit(id).c2,
    tac: { form: ['4-3-3', '4-2-3-1', '4-4-2'][h % 3], press: 0.55, line: 0.5, tempo: 0.55, width: 0.55, direct: 0.5 },
    squad: (u20 ? ns?.u20squad : ns?.squad) ?? [], nat: true, rep: n?.str ?? 70,
  };
}
export function teamName(w: World, id: string): string { return w.clubs[id]?.name ?? NATIONS[id]?.name ?? id; }
export function teamShort(w: World, id: string): string { return w.clubs[id]?.sn ?? NATIONS[id]?.name ?? id; }

export function available(p: Player | undefined): boolean { return !!p && !p.retired && p.inj <= 0 && p.susp <= 0; }

export interface Sheet { xi: { pid: string; pos: Pos; x: number; y: number }[]; bench: string[]; form: string; userScore?: { started: boolean; inSquad: boolean; score: number; rivals: { name: string; score: number }[]; reasons: string[] } }

/** Manager's selection score for a player in a slot (ability, condition, form, role, trust). */
export function selScore(g: Game | null, p: Player, pos: Pos, rotate: number): number {
  let s = fitAt(p, pos) * (0.9 + 0.1 * (p.fit / 100)) + (p.form - 6.6) * 0.9;
  if (rotate > 0 && p.con) s += p.con.role === 'star' || p.con.role === 'key' ? -rotate * 9 : p.con.role === 'prospect' || p.con.role === 'development' ? rotate * 5 : rotate * 3;
  if (p.fit < 62) s -= 7 + rotate * 4;
  else if (p.fit < 75) s -= rotate * 5;
  if (p.con) s += p.con.role === 'star' ? 1.5 : p.con.role === 'key' ? 0.8 : p.con.role === 'development' ? -1.5 : 0;
  if (g && p.id === g.career.pid) s += (g.career.mgrTrust - 50) / 9 + (g.career.promise && g.career.promise.club === p.club ? (g.career.promise.role === 'star' ? 2.5 : g.career.promise.role === 'key' ? 1.5 : 0) : 0);
  return s;
}

/** Hand-made team sheets (match simulator): team id → formation, eleven player ids in slot order, bench ids. */
export const SHEETS = new Map<string, { form: string; xi: string[]; bench: string[] }>();
export function pickSheet(g: Game | null, w: World, info: TeamInfo, rotate = 0, benchSize = 9): Sheet {
  const ov = SHEETS.get(info.id);
  if (ov && FORMATIONS[ov.form] && ov.xi.length === 11 && ov.xi.every((id) => w.players[id])) {
    const sl = FORMATIONS[ov.form];
    return { form: ov.form, xi: ov.xi.map((pid, k) => ({ pid, pos: sl[k][0] as Pos, x: sl[k][1], y: sl[k][2] })), bench: ov.bench.filter((id) => w.players[id] && !ov.xi.includes(id)).slice(0, benchSize) };
  }
  const form = FORMATIONS[info.tac.form] ? info.tac.form : '4-3-3';
  const slots = FORMATIONS[form];
  const pool = info.squad.map((id) => w.players[id]).filter(available);
  const pairs: { s: number; k: number; p: Player }[] = [];
  for (const p of pool) for (let k = 0; k < slots.length; k++) {
    const pos = slots[k][0] as Pos;
    if ((pos === 'GK') !== (p.pos === 'GK')) continue;
    pairs.push({ s: selScore(g, p, pos, rotate), k, p });
  }
  pairs.sort((a, b) => b.s - a.s);
  const xi: Sheet['xi'] = new Array(slots.length);
  const used = new Set<string>();
  let filled = 0;
  for (const pr of pairs) {
    if (xi[pr.k] || used.has(pr.p.id)) continue;
    xi[pr.k] = { pid: pr.p.id, pos: slots[pr.k][0] as Pos, x: slots[pr.k][1], y: slots[pr.k][2] };
    used.add(pr.p.id);
    if (++filled === slots.length) break;
  }
  // emergency: fill any empty slot (e.g. no fit goalkeeper) with the best remaining player
  for (let k = 0; k < slots.length; k++) if (!xi[k]) {
    const p = pool.filter((x) => !used.has(x.id)).sort((a, b) => ovr(b) - ovr(a))[0];
    if (p) { xi[k] = { pid: p.id, pos: slots[k][0] as Pos, x: slots[k][1], y: slots[k][2] }; used.add(p.id); }
  }
  const rest = pool.filter((p) => !used.has(p.id)).sort((a, b) => ovr(b) + (b.fit - 80) * 0.1 - (ovr(a) + (a.fit - 80) * 0.1));
  const bench: string[] = [];
  const gk = rest.find((p) => p.pos === 'GK');
  if (gk) bench.push(gk.id);
  for (const p of rest) { if (bench.length >= benchSize) break; if (p.pos === 'GK') continue; bench.push(p.id); }
  const sheet: Sheet = { xi: xi.filter(Boolean), bench, form };
  if (g && info.squad.includes(g.career.pid)) {
    const me = w.players[g.career.pid];
    const mine = sheet.xi.find((x) => x.pid === me.id);
    const pos = mine?.pos ?? me.pos;
    const myScore = selScore(g, me, pos, rotate);
    const rivals = pool.filter((p) => p.id !== me.id && p.pos !== 'GK' && (p.pos === pos || p.pos2.includes(pos) || POS_LINE[p.pos] === POS_LINE[pos]))
      .map((p) => ({ name: p.sn, score: Math.round(selScore(g, p, pos, rotate) * 10) / 10 })).sort((a, b) => b.score - a.score).slice(0, 4);
    const reasons: string[] = [];
    reasons.push(`Ability in role (${pos}): ${Math.round(fitAt(me, pos))}`);
    reasons.push(`Coach trust ${Math.round(g.career.mgrTrust)}/100 (${g.career.mgrTrust >= 50 ? '+' : ''}${((g.career.mgrTrust - 50) / 9).toFixed(1)} to selection)`);
    reasons.push(`Condition ${Math.round(me.fit)}%, recent form ${me.form.toFixed(1)}`);
    if (!available(me)) reasons.push(me.inj > 0 ? `Injured (${me.injName ?? 'injury'})` : 'Suspended');
    sheet.userScore = { started: !!mine, inSquad: !!mine || bench.includes(me.id), score: Math.round(myScore * 10) / 10, rivals, reasons };
  }
  return sheet;
}

/** Opponents plan for whoever is scoring freely this season: goals per appearance above 0.55 draw extra marking. */
function markedMan(p: Player): number {
  let g = 0, ap = 0;
  for (const k in p.ss) { g += p.ss[k][S.G]; ap += p.ss[k][S.APP]; }
  if (ap < 4) return 0;
  // defences read a scorer quickly; a midfielder who keeps arriving to score is tracked sooner than a striker
  const ln = POS_LINE[p.pos] ?? 3;
  return clamp((g / ap - (ln >= 3 ? 0.5 : ln === 2 ? 0.28 : 0.18)) * 2.4, 0, 1.8);
}
function markedCreator(p: Player): number {
  let a = 0, ap = 0;
  for (const k in p.ss) { a += p.ss[k][S.A]; ap += p.ss[k][S.APP]; }
  if (ap < 4) return 0;
  return clamp((a / ap - 0.2) * 3.6, 0, 2.2);
}
function mkPlayer(w: World, p: Player, t: 0 | 1, slot: { pos: Pos; x: number; y: number } | null, mult: number, scale: number): MPlayer {
  const cond = mult * (0.9 + 0.1 * (p.fit / 100)) * (1 + (p.form - 6.6) * 0.006 + (p.morale - 60) * 0.0004) * (0.97 + 0.03 * (p.sharp / 100));
  const a = new Array(N_ATTR);
  for (let i = 0; i < N_ATTR; i++) a[i] = p.a[i] * cond;
  a[A.WFT] = p.a[A.WFT];
  const m = buildMods(p.ab, scale);
  m.length = N_MODS + 1; m[N_MODS] = 0;
  const pos = slot?.pos ?? p.pos;
  const line = POS_LINE[pos];
  const hasUlt = p.ab.some((r) => abilityDef(r.id)?.kind === 'ultimate');
  const o = ovr(p);
  return {
    id: p.id, nm: p.sn, num: p.num, t, pos, line, bx: slot?.x ?? 50, by: slot ? (t === 0 ? slot.y : slot.y) : 50, x: 50, y: 50,
    a, m, ovr: o, h: p.h, st: clamp(p.fit, 30, 100), on: !!slot, used: !!slot, started: !!slot, inC: 0, outC: -1, inP: 0, outP: -1,
    s: newLine(), fl: 0, flEnd: 0, flN: 0, canFlow: hasUlt || (p.pers.ego >= 72 && o >= 78),
    boost: line === 3 ? [A.FIN, A.POS, A.DRI, A.COM] : line === 2 ? [A.VIS, A.SPA, A.DEC, A.BCO] : line === 1 ? [A.TAC, A.INT, A.DAW] : [A.GKR, A.GKP],
    run: 0, runT: 0, open: false, beat: 0, yc: 0, rc: false, inj: 0,
    ab: p.ab.map((r) => ({ id: r.id, lv: r.lv, evo: r.evo })), abN: {}, ego: p.pers.ego, agg: 40 + p.pers.temper * 0.4,
    user: false, star: false, chem: 50, trust: 50, rival: false, mk: markedMan(p), mka: markedCreator(p), age: w.season - p.born, role: p.con?.role ?? '', foot: p.foot === 'L' ? 0 : p.foot === 'R' ? 1 : 2,
    streak: 0, lostTo: -1, ultN: 0, req: 0, focus: 0,
  };
}

export function rulesFor(g: Game, compId: string, ko: boolean): Rules {
  const comp = g.world.comps[compId];
  if (comp?.rules === 'nel') {
    const n = g.settings.nel;
    return { kind: 'nel', goalTarget: n.goalTarget, halfSec: 0, extraTime: false, subs: n.subs, starChange: n.starChange, starSec: n.starSec, offside: n.offside };
  }
  return { ...REG_RULES, extraTime: ko };
}

export function importance(w: World, fx: Fixture): number {
  const c = w.comps[fx.comp];
  if (!c) return 0.4;
  if (c.kind === 'nel') return 0.7 + (fx.rd >= 4 ? 0.2 : 0);
  if (c.kind === 'intl') return fx.ko ? 1 : 0.8;
  if (c.kind === 'continental') return fx.ko ? 0.95 : 0.75;
  if (c.kind === 'cup' || c.kind === 'playoff') return fx.stg === 'Final' ? 1 : fx.ko ? 0.7 : 0.6;
  if (c.kind === 'friendly') return 0.2;
  return fx.rd >= c.rounds - 4 ? 0.65 : 0.45;
}

export const DIFFICULTY = [
  { name: 'Rookie', oppTau: 1.5, forgive: 0.25, pressure: 0.7, desc: 'Opponents make noisier decisions (×1.5 decision noise), your actions get +0.25 logit forgiveness, managers are patient.' },
  { name: 'Professional', oppTau: 1.15, forgive: 0.08, pressure: 1, desc: 'Slightly noisy opponents (×1.15), small forgiveness (+0.08 logit), normal management pressure.' },
  { name: 'Elite', oppTau: 1, forgive: 0, pressure: 1.25, desc: 'Opponents decide at full sharpness, no forgiveness, managers demand more (×1.25 trust swings).' },
  { name: 'Egoist', oppTau: 0.85, forgive: -0.1, pressure: 1.5, desc: 'Opponents decide more sharply than you (×0.85 noise), −0.10 logit on your actions, ruthless managers (×1.5).' },
];
export const INJURY_RATE = [0, 0.5, 1, 1.8];
/** Ability strength multiplier applied to every ability effect in a match. */
export const REALISM = [{ name: 'Grounded', scale: 0.35 }, { name: 'Balanced', scale: 0.5 }, { name: 'Anime', scale: 0.7 }];
export const FREQ_THR = [72, 50, 30];

/** Create a ready-to-play MatchState for a fixture. `mode` only matters when the user is involved. */
export function createMatch(g: Game, fx: Fixture, mode: 'full' | 'key' | 'sim' = 'sim', attempt = 0): MatchState {
  const w = g.world;
  const comp = w.comps[fx.comp];
  const u20 = !!comp?.u20;
  const infos = [teamInfo(w, fx.h, u20), teamInfo(w, fx.a, u20)];
  const rules = rulesFor(g, fx.comp, !!fx.ko);
  const me = w.players[g.career.pid];
  const userTeam = infos[0].squad.includes(me.id) ? 0 : infos[1].squad.includes(me.id) ? 1 : -1;
  const imp = importance(w, fx);
  const scale = REALISM[g.settings.realism]?.scale ?? 1;
  const pl: MPlayer[] = [];
  const teams: MTeam[] = [];
  const early = comp?.kind === 'cup' && !['Final', 'Semi-final', 'Quarter-final'].includes(fx.stg ?? '');
  const rotate = early ? 0.6 : comp?.kind === 'friendly' && fx.comp !== 'totscup' ? 1 : 0;
  let sel: Sheet['userScore'];
  for (let t = 0; t < 2; t++) {
    const info = infos[t];
    const sheet = pickSheet(userTeam === t ? g : null, w, info, rotate, rules.kind === 'nel' ? 12 : 9);
    if (userTeam === t) sel = sheet.userScore;
    const mult = t === 0 && !fx.neutral ? 1.035 : 1;
    const on: number[] = [], bench: number[] = [];
    for (const s of sheet.xi) {
      const mp = mkPlayer(w, w.players[s.pid], t as 0 | 1, s, mult, scale);
      mp.s[S.APP] = 1; mp.s[S.START] = 1;
      on.push(pl.length); pl.push(mp);
    }
    for (const id of sheet.bench) { bench.push(pl.length); pl.push(mkPlayer(w, w.players[id], t as 0 | 1, null, mult, scale)); }
    let star = -1;
    if (rules.starChange && info.master && w.players[info.master]) {
      const mp = mkPlayer(w, w.players[info.master], t as 0 | 1, null, mult, scale);
      mp.star = true; mp.canFlow = true;
      star = pl.length; pl.push(mp);
    }
    const diff = DIFFICULTY[g.settings.difficulty] ?? DIFFICULTY[1];
    teams.push({
      id: info.id, name: info.name, abbr: info.abbr, col: info.col, col2: info.col2, on, bench, subs: 0, form: sheet.form, tac: { ...info.tac, form: sheet.form },
      star, starState: 0, starEnd: 0, starFor: -1, tau: userTeam >= 0 && userTeam !== t ? diff.oppTau : 1,
      fam: userTeam >= 0 && userTeam !== t ? clamp(Number(g.career.flags['fam:' + info.id] ?? 0) * 0.25, 0, 1) : 0,
      nextSub: rules.kind === 'nel' ? 1300 : 3500, red: 0,
    });
  }
  let uc: UserCtl | null = null;
  if (userTeam >= 0) {
    const idx = pl.findIndex((p) => p.id === me.id);
    if (idx >= 0) {
      const mp = pl[idx];
      mp.user = true; mp.canFlow = true;
      { const f = g.career.flags; if (f.hypeFid === fx.id) mp.fl = Math.min(95, mp.fl + (f.hype === 'fire' ? 34 : f.hype === 'cold' ? 20 : 8)); } // the tunnel exchange with a rival
      const et = egoType(g.career.egoType);
      mp.boost = et.boost;
      const diff = DIFFICULTY[g.settings.difficulty] ?? DIFFICULTY[1];
      uc = {
        idx, mode, thr: FREQ_THR[g.settings.freq] ?? 50, showP: g.settings.showProb, forgive: diff.forgive, autoFlow: g.settings.autoFlow,
        trust: g.career.mgrTrust ?? 50, asked: 0, cameo: ((hashStr(fx.id) >>> 3) % 100) < 35 + (g.career.mgrTrust ?? 50) * 0.5 ? 1 : 0,
        instr: { ...g.career.instr }, egoBoost: et.boost, gain: et.gain, lastSeq: -1, lastDefSeq: -1, decisions: 0, selfish: 0, unselfish: 0, discipline: 0, disciplineN: 0,
        memo: {}, combo: -1, reactions: {}, seen: {}, used: {}, dominion: 0, realism: g.settings.realism,
      };
      const myTags = weaponTags(me);
      for (let i = 0; i < pl.length; i++) {
        const q = pl[i];
        if (i === idx) continue;
        const rel = g.career.rel[q.id];
        if (q.t === mp.t) {
          q.chem = rel ? rel.chem : 30; q.trust = rel ? rel.trust : 40;
          if (g.career.combo && g.career.combo.with === q.id && g.career.combo.until >= w.abs) uc.combo = i;
          const rx = g.career.reactions.find((r) => r.with === q.id);
          if (rx) uc.reactions[i] = rx.name;
          else if (q.chem >= 70) uc.reactions[i] = reactionName(myTags, weaponTags(w.players[q.id]));
        } else if (g.career.rivals.includes(q.id)) { q.rival = true; }
      }
    }
  }
  // general focus bonus: rival on the pitch and big-match temperament
  const rivalIds = new Set(g.career.rivals);
  for (const p of pl) {
    let gb = p.m[M.BIGMATCH] * imp;
    if (p.m[M.RIVAL] > 0) {
      if (p.user ? pl.some((q) => q.t !== p.t && rivalIds.has(q.id)) : pl.some((q) => q.user && q.t !== p.t) && rivalIds.has(p.id)) gb += p.m[M.RIVAL];
    }
    p.m[N_MODS] = gb;
  }
  for (const p of pl) if (p.t === 1) p.by = 100 - p.by; // mirror the away formation across the pitch
  const seed = mixSeed(w.seed, fx.id, attempt);
  // match-day form: some days a side just clicks and some days it does not (roughly normal, sd ~3.5%, capped at ±8%).
  // It keeps the better side favourite but lets draws and upsets happen as often as they do in real football.
  for (let t = 0; t < 2; t++) {
    let h = (mixSeed(seed, 'day', t) >>> 0) || 1, sum = 0;
    for (let k = 0; k < 4; k++) { h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0; sum += (h % 10000) / 10000; }
    (teams[t] as MTeam).day = 1 + Math.max(-0.08, Math.min(0.08, (sum - 2) * 0.06));
  }
  // underdogs raise their game: the weaker starting XI gets a lift that grows with the gap (and tops out), so a
  // title side drops points now and then instead of winning almost everything
  {
    const xiOvr = (t: number) => { const xs = pl.filter((q) => q.t === t && q.on && q.line > 0); return xs.length ? xs.reduce((x, q) => x + q.ovr, 0) / xs.length : 70; };
    const o0 = xiOvr(0), o1 = xiOvr(1), gap = Math.abs(o0 - o1), weak = o0 < o1 ? 0 : 1;
    if (gap > 1) (teams[weak] as MTeam).day = ((teams[weak] as MTeam).day ?? 1) + Math.min(0.13, (gap - 0.5) * 0.014);
  }
  let agg: [number, number] | null = null;
  if (fx.leg === 2 && fx.tie) {
    const first = Object.values(w.fixtures).find((f) => f.tie === fx.tie && f.leg === 1 && f.played);
    if (first?.sc) agg = [first.sc[1], first.sc[0]];
  }
  const ms: MatchState = {
    v: 1, fid: fx.id, comp: fx.comp, compName: comp?.name ?? '', rules, rng: seedState(seed), crng: seedState(seed ^ 0x5bd1e995),
    clock: 0, play: 0, period: 1, phase: 'PRE', periodEnd: 0, lost: 0, score: [0, 0], pens: null, agg, ko: !!fx.ko,
    teams: teams as [MTeam, MTeam], pl, bx: 50, by: 50, car: -1, poss: 0, arr: 0, bh: 0, from: -1, fromT: 0, seq: 0, seqPasses: 0, seqStart: 0,
    restart: null, stage: 0, pending: null, choice: null, ev: [], goals: [], done: false, winner: -1, uc, imp, verb: uc && mode !== 'sim' ? 2 : uc ? 1 : 0,
    steps: 0, esc: 0, inj: [], subsLog: [], hold: 0, note: '', press: 0, nd: -1, home0: true, neutral: !!fx.neutral,
  };
  if (sel && uc) (ms as MatchState & { sel?: unknown }).sel = sel;
  return ms;
}

const INJ_NAMES = ['hamstring strain', 'ankle sprain', 'knee knock', 'calf strain', 'groin strain', 'bruised ribs', 'thigh strain', 'shoulder injury'];

/**
 * Apply a finished match to the world. Idempotent: a fixture that is already marked as
 * played is never processed twice, so goals, stats and cards cannot be duplicated.
 */
export function applyResult(g: Game, fx: Fixture, ms: MatchState): boolean {
  if (fx.played || !ms.done) return false;
  const w = g.world;
  const comp = w.comps[fx.comp];
  fx.played = true;
  fx.sc = [ms.score[0], ms.score[1]];
  if (ms.pens) fx.pens = [ms.pens[0], ms.pens[1]];
  if (ms.period >= 3) fx.aet = true;
  fx.goals = ms.goals.map((x) => [...x] as typeof x);
  fx.mins = Math.round(ms.clock / 60);
  fx.playSec = Math.round(ms.play);
  const keep = w.keepLines || ms.uc != null || comp?.kind === 'nel';
  if (keep) fx.lines = {};
  const total = ms.rules.kind === 'nel' ? ms.play : 5400;
  const accW = comp?.weekly ? (w.acc.w[fx.comp] ??= {}) : null;
  const accM = comp?.weekly && comp.kind === 'league' ? (w.acc.m[fx.comp] ??= {}) : null;
  // suspensions served by players who missed this match
  for (const tid of [fx.h, fx.a]) {
    const c = w.clubs[tid];
    if (c && comp && comp.kind !== 'friendly' && !comp.natTeams) for (const id of c.squad) { const p = w.players[id]; if (p && p.susp > 0 && !ms.pl.some((m) => m.id === id && m.used)) p.susp--; }
  }
  const h = hashStr(fx.id);
  for (let i = 0; i < ms.pl.length; i++) {
    const mp = ms.pl[i];
    if (!mp.used) continue;
    const p = w.players[mp.id];
    if (!p) continue;
    const line = mp.s;
    if (line[S.POTM]) fx.potm = p.id;
    const ss = (p.ss[fx.comp] ??= newLine());
    addLine(ss, line);
    if (keep) fx.lines![p.id] = line.slice(0, NSTAT);
    if (accW) addLine((accW[p.id] ??= newLine()), line);
    if (accM) addLine((accM[p.id] ??= newLine()), line);
    // condition
    const share = Math.min(1.3, (ms.rules.kind === 'nel' ? line[S.PLAY] : line[S.SEC]) / total);
    p.fit = clamp(p.fit - share * (27 - p.a[A.STA] * 0.11) * (comp?.kind === 'friendly' ? 0.6 : 1), 25, 100);
    p.sharp = clamp(p.sharp + share * 12, 0, 100);
    // every rated club or senior international match feeds the Ballon d'Or consistency record (good games, poor games, big games)
    if (line[S.RATN] && comp && comp.kind !== 'friendly' && comp.kind !== 'nel' && !comp.u20) {
      const f = ((w.formLog ??= {})[p.id] ??= [0, 0, 0, 0, 0, 0]);
      const big = (!!fx.stg && fx.stg !== 'Group' && comp.kind !== 'league') ? (fx.stg === 'Final' ? 2 : 1) : 0;
      f[0]++; if (line[S.RAT] >= 7.2) f[1]++; if (line[S.RAT] < 6.3) f[2]++;
      if (big) { f[3] += big; f[4] += (line[S.G] + line[S.A]) * big; f[5] += line[S.RAT] * big; }
    }
    if (line[S.RATN]) { p.form = p.form * 0.7 + line[S.RAT] * 0.3; p.morale = clamp(p.morale + (line[S.RAT] - 6.5) * 1.6 + (ms.winner === mp.t ? 1.5 : ms.winner === -1 ? 0 : -1.5), 5, 100); }
    if (comp && !comp.natTeams && comp.kind !== 'friendly') {
      if (line[S.YC] && !line[S.RC]) { p.yel += line[S.YC]; if (p.yel >= 5) { p.yel -= 5; p.susp += 1; } }
      if (line[S.RC]) p.susp += 1 + ((h + i) % 2);
    }
    if (line[S.G] && p.club && w.clubs[p.club] && !comp?.natTeams) { const c = w.clubs[p.club]; c.goalsAll[p.id] = (c.goalsAll[p.id] ?? 0) + line[S.G]; }
    if (comp?.natTeams && !comp.u20) { p.caps++; p.ig += line[S.G]; }
    if (line[S.RATN] && line[S.RAT] >= 8.6) p.rep = clamp(p.rep + 0.4 * ms.imp, 0, 99);
  }
  for (const inj of ms.inj) {
    const p = w.players[ms.pl[inj.idx].id];
    if (p) { p.inj = Math.max(p.inj, inj.days); p.injName = INJ_NAMES[(h + inj.idx) % INJ_NAMES.length]; p.fit = Math.min(p.fit, 60); }
  }
  // goal-of-the-month candidates
  if (comp?.weekly) {
    const list = (w.acc.goals[fx.comp] ??= []);
    for (const gl of ms.goals) {
      if (gl[5] < 50 || gl[4] === 2) continue;
      const p = w.players[gl[2]];
      if (!p) continue;
      list.push({ fid: fx.id, pid: p.id, name: p.name, club: gl[1] === 0 ? fx.h : fx.a, min: gl[0], spec: gl[5], desc: `${gl[6] <= 8 ? 'A low-probability strike' : 'A fine goal'} (xG ${(gl[6] / 100).toFixed(2)}) against ${teamShort(w, gl[1] === 0 ? fx.a : fx.h)}` });
    }
    if (list.length > 60) { list.sort((a, b) => b.spec - a.spec); list.length = 40; }
  }
  return true;
}

/** Simulate a fixture start-to-finish in the background (no user decisions) and apply it. */
export function simFixture(g: Game, fx: Fixture, wantWinner?: string): MatchState | null {
  if (fx.played) return null;
  setInjuryRate(INJURY_RATE[g.settings.injuries] ?? 1);
  let ms = createMatch(g, fx, 'sim', 0);
  advance(ms);
  if (wantWinner) {
    // canon-guided mode: search seeds until the simulation itself produces the listed winner
    for (let k = 1; k < 60 && ms.teams[ms.winner]?.id !== wantWinner; k++) { ms = createMatch(g, fx, 'sim', k); advance(ms); }
  }
  applyResult(g, fx, ms);
  return ms;
}

export function winnerId(fx: Fixture): string | null {
  if (!fx.played || !fx.sc) return null;
  if (fx.pens) return fx.pens[0] > fx.pens[1] ? fx.h : fx.a;
  return fx.sc[0] > fx.sc[1] ? fx.h : fx.sc[1] > fx.sc[0] ? fx.a : null;
}
