/**
 * Two SEPARATE match state machines sharing one possession simulator.
 *
 *  • nelMachine  – Neo Egoist League: no halves, no 90-minute ending. The clock is actual
 *                  ball-in-play time and the match ends only when a team reaches the goal target.
 *  • regMachine  – regulation football: two 45-minute halves with stoppage time, optional
 *                  extra time and a penalty shoot-out for knockout ties. Never ends on a goal count.
 */
import type { MatchState, MEvent } from './model';
import { A } from '../attributes';
import { Rng, sig } from '../rng';

export function emit(ms: MatchState, k: string, t: number, p: number, q: number, v: number, x: string, i: number): void {
  if (ms.verb === 0 && i < 2) return;
  const e: MEvent & { h?: number } = { c: Math.floor(ms.clock), k, t, p, q, v, x, i };
  e.h = ms.period;
  ms.ev.push(e);
}

/** Display minute for a clock value, e.g. "45+2'" in regulation or "37:12" of playing time in NEL. */
export function clockLabel(kind: 'nel' | 'reg', clock: number, period: number): string {
  if (kind === 'nel') {
    const m = Math.floor(clock / 60), s = Math.floor(clock % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
  const base = [0, 45, 90, 105, 120][period] ?? 120;
  const min = Math.floor(clock / 60) + 1;
  if (period <= 4 && min > base) return `${base}+${min - base}'`;
  return `${Math.min(min, 120)}'`;
}
export function goalMinute(ms: MatchState): number {
  if (ms.rules.kind === 'nel') return Math.floor(ms.play / 60) + 1;
  const base = [0, 45, 90, 105, 120][ms.period] ?? 120;
  return Math.min(Math.floor(ms.clock / 60) + 1, base);
}

export interface Machine {
  start(ms: MatchState): void;
  /** advance clocks by in-play seconds `dt` plus dead-ball seconds `dead` */
  time(ms: MatchState, dt: number, dead: number, stoppage: number): void;
  /** check period / match end; returns true when the match is over */
  tick(ms: MatchState, rng: Rng): boolean;
}

function finish(ms: MatchState, text: string): void {
  ms.done = true;
  ms.phase = 'FT';
  ms.pending = null;
  const [h, a] = ms.score;
  if (ms.pens) ms.winner = ms.pens[0] > ms.pens[1] ? 0 : 1;
  else if (ms.agg) { const H = h + ms.agg[0], Aw = a + ms.agg[1]; ms.winner = H > Aw ? 0 : Aw > H ? 1 : -1; }
  else ms.winner = h > a ? 0 : a > h ? 1 : -1;
  emit(ms, 'ft', -1, -1, -1, 0, text, 3);
}

// ───────────────────────────── NEL ─────────────────────────────
export const nelMachine: Machine = {
  start(ms) {
    ms.phase = 'LIVE'; ms.period = 1; ms.periodEnd = 0;
    emit(ms, 'ko', -1, -1, -1, 0, `Kick-off. First to ${ms.rules.goalTarget} goals wins — there is no full-time whistle in the Neo Egoist League.`, 2);
  },
  time(ms, dt) {
    ms.play += dt;
    ms.clock = ms.play; // NEL clock = actual elapsed playing time; stoppages never count
  },
  tick(ms) {
    const T = ms.rules.goalTarget;
    if (ms.score[0] >= T || ms.score[1] >= T) {
      const w = ms.score[0] >= T ? 0 : 1;
      finish(ms, `MATCH OVER — ${ms.teams[w].name} reach ${T} goals. ${ms.teams[0].name} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].name}.`);
      return true;
    }
    // Exhaustion escalator: very long matches open up so a decisive goal always arrives.
    // NEL sides are built to attack (strikers converted into defenders): finishing gets a flat edge,
    // and very long matches open up further so a decisive goal always arrives.
    ms.esc = 0.4 + (ms.play > 5400 ? (ms.play - 5400) / 900 : 0);
    if (ms.play > 21600) { // absolute safety net (6 hours of playing time) — should never be reached
      if (ms.score[0] === ms.score[1]) ms.score[ms.poss]++;
      ms.note = 'safety-cap';
      finish(ms, 'Match ended by safety cap.');
      return true;
    }
    return false;
  },
};

// ───────────────────────────── Regulation ─────────────────────────────
const BOUND = [0, 2700, 5400, 6300, 7200];
function level(ms: MatchState): boolean {
  if (ms.agg) return ms.score[0] + ms.agg[0] === ms.score[1] + ms.agg[1];
  return ms.score[0] === ms.score[1];
}

export const regMachine: Machine = {
  start(ms) {
    ms.phase = 'H1'; ms.period = 1; ms.periodEnd = 0; ms.lost = 0;
    emit(ms, 'ko', -1, -1, -1, 0, 'Kick-off.', 2);
  },
  time(ms, dt, dead, stoppage) {
    ms.play += dt;
    ms.clock += dt + dead;
    ms.lost += stoppage;
  },
  tick(ms, rng) {
    if (ms.period > 4) return ms.done;
    const bound = BOUND[ms.period];
    if (!ms.periodEnd && ms.clock >= bound) {
      const et = ms.period > 2;
      const added = Math.max(60, Math.min(et ? 180 : 600, Math.round((ms.lost * (ms.period === 1 ? 0.45 : 0.8) + (ms.period === 2 ? 60 : 0)) / 60) * 60));
      ms.periodEnd = bound + added;
      emit(ms, 'added', -1, -1, -1, added / 60, `${added / 60} minute${added > 60 ? 's' : ''} of added time.`, 1);
    }
    if (ms.periodEnd && ms.clock >= ms.periodEnd) {
      const p = ms.period;
      ms.periodEnd = 0; ms.lost = 0;
      if (p === 1) {
        ms.period = 2; ms.phase = 'H2'; ms.clock = 2700;
        emit(ms, 'ht', -1, -1, -1, 0, `Half-time: ${ms.teams[0].name} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].name}.`, 2);
        ms.restart = { k: 1, t: 1, x: 50, y: 50 };
        for (const pl of ms.pl) if (pl.on) pl.st = Math.min(100, pl.st + 6);
      } else if (p === 2) {
        if (ms.ko && ms.rules.extraTime && level(ms)) {
          ms.period = 3; ms.phase = 'ET1'; ms.clock = 5400;
          emit(ms, 'et', -1, -1, -1, 0, 'Level after ninety minutes. Extra time.', 2);
          ms.restart = { k: 1, t: 0, x: 50, y: 50 };
        } else { finish(ms, `Full-time: ${ms.teams[0].name} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].name}.`); return true; }
      } else if (p === 3) {
        ms.period = 4; ms.phase = 'ET2'; ms.clock = 6300;
        ms.restart = { k: 1, t: 1, x: 50, y: 50 };
      } else if (p === 4) {
        if (level(ms)) { ms.period = 5; ms.phase = 'PENS'; shootout(ms, rng); }
        finish(ms, `Full-time after extra time: ${ms.teams[0].name} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].name}${ms.pens ? ` (${ms.pens[0]}–${ms.pens[1]} on penalties)` : ''}.`);
        return true;
      }
    }
    return false;
  },
};

/** Penalty shoot-out: best five takers each, then sudden death. Shoot-out goals are not match goals. */
function shootout(ms: MatchState, rng: Rng): void {
  const pens: [number, number] = [0, 0];
  const order = [0, 1].map((t) => ms.teams[t].on.map((i) => ms.pl[i]).filter((p) => p.pos !== 'GK').sort((a, b) => b.a[A.PEN] + b.a[A.COM] - (a.a[A.PEN] + a.a[A.COM])));
  const gk = [0, 1].map((t) => ms.teams[t].on.map((i) => ms.pl[i]).find((p) => p.pos === 'GK'));
  let n = 0;
  emit(ms, 'pens', -1, -1, -1, 0, 'It goes to a penalty shoot-out.', 2);
  while (n < 40) {
    for (let t = 0; t < 2; t++) {
      const taker = order[t][n % Math.max(1, order[t].length)];
      const keeper = gk[1 - t];
      const ks = keeper ? (keeper.a[A.GKD] + keeper.a[A.GKR] + keeper.a[A.GKP]) / 3 : 40;
      const ts = taker ? taker.a[A.PEN] * 0.6 + taker.a[A.COM] * 0.4 : 50;
      const p = sig(1.15 + (ts - ks) / 30);
      const ok = rng.next() < p;
      if (ok) pens[t]++;
      emit(ms, 'pen_so', t, taker ? ms.pl.indexOf(taker) : -1, -1, 0, `${taker?.nm ?? 'Taker'} ${ok ? 'scores' : 'misses'}. (${pens[0]}–${pens[1]})`, 2);
      if (n < 5) {
        const left0 = 5 - n - (t >= 0 ? 1 : 0), left1 = 5 - n - (t >= 1 ? 1 : 0);
        if (pens[0] > pens[1] + left1 || pens[1] > pens[0] + left0) { ms.pens = pens; return; }
      }
    }
    n++;
    if (n >= 5 && pens[0] !== pens[1]) break;
  }
  if (pens[0] === pens[1]) pens[rng.int(2)]++;
  ms.pens = pens;
}
