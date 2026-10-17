import { RACE_TUNING } from '../config/tuning';
import { driverShortName } from '../drivers/ratings';
import { hashString } from '../rng';
import type { GameState, RaceLogEntry, RaceState } from '../types';

/**
 * Broadcast commentary built from what actually happened in the race: the
 * race-control log plus moments read from the lap-by-lap record (opening-lap
 * charges, long battles, a leader breaking clear, laps to go). Phrasing
 * rotates through pools so lines are not repeated word for word, and the same
 * pair swapping places is reported as a duel rather than as separate passes.
 */

export type CommentaryTone = 'lead' | 'overtake' | 'incident' | 'pit' | 'weather' | 'caution' | 'info' | 'battle' | 'radio' | 'finish' | 'penalty' | 'fastest' | 'start';

export interface CommentaryLine {
  id: string;
  lap: number;
  text: string;
  tone: CommentaryTone;
  key: boolean;
  driverIds: string[];
}

const POOLS = {
  lead: [
    '{a} takes the lead from {b}!',
    'New leader! {a} is through on {b}.',
    '{a} goes to the front, and {b} has no answer.',
    'Change at the top: {a} passes {b} to lead the race.',
  ],
  pass: [
    '{a} passes {b} for P{p}.',
    '{a} makes the move on {b}: up to P{p}.',
    '{b} cannot hold off {a}, who takes P{p}.',
    'A clean pass: {a} gets by {b} for P{p}.',
    '{a} goes down the inside of {b}. P{p}.',
    '{a} wins the drag race with {b} for P{p}.',
  ],
  swap: ['{a} and {b} swap places again: {a} back to P{p}!', 'Back and forth: {a} retakes P{p} from {b}.', 'Neither will give an inch. {a} is back ahead of {b}.'],
  battle: [
    '{b} has been all over the back of {a} for {n} laps, fighting for P{p}.',
    'Still nothing between them: {a} and {b} have been nose to tail for {n} laps.',
    '{a} is defending hard against {b}. {n} laps of pressure for P{p}.',
    'This fight for P{p} has gone on for {n} laps. {b} keeps looking for a way past {a}.',
  ],
  escape: ['{a} is pulling away: {g} seconds clear of {b}.', '{a} breaks the tow. The gap to {b} is now {g} seconds.', 'Lap after lap, {a} stretches the lead over {b}: {g} seconds.'],
  charge: ['What a start from {a}: up {n} places on the opening lap!', '{a} makes up {n} places on lap one.', 'Lightning launch from {a}: {n} places gained.'],
  fastest: ['Fastest lap of the race for {a}: {t}.', 'Purple sectors for {a}: a new fastest lap, {t}.', '{a} goes quickest of all with a {t}.'],
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

class Picker {
  private used = new Map<string, number>();
  constructor(private salt: number) {}
  pick(pool: keyof typeof POOLS): string {
    const list = POOLS[pool];
    const n = this.used.get(pool) ?? 0;
    this.used.set(pool, n + 1);
    // Walk the pool in a race-specific order so consecutive lines never repeat.
    return list[(n + this.salt) % list.length];
  }
}

/** Race time of each car at the end of every lap, for gaps in past laps. */
function lapTotals(race: RaceState): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const byGrid = [...race.cars].sort((a, b) => a.grid - b.grid);
  byGrid.forEach((c, idx) => {
    const totals: number[] = [idx * RACE_TUNING.gridSlotGap];
    let t = totals[0];
    for (const h of c.history) {
      t += h.lapTime;
      totals[h.lap] = t;
    }
    out.set(c.driverId, totals);
  });
  return out;
}

function toneOf(e: RaceLogEntry): CommentaryTone {
  switch (e.type) {
    case 'overtake':
      return 'overtake';
    case 'pit':
      return 'pit';
    case 'crash':
    case 'collision':
    case 'failure':
    case 'mistake':
      return 'incident';
    case 'safetyCar':
    case 'vsc':
    case 'safetyCarEnd':
      return 'caution';
    case 'weather':
      return 'weather';
    case 'radio':
      return 'radio';
    case 'fastestLap':
      return 'fastest';
    case 'finish':
      return 'finish';
    case 'penalty':
      return 'penalty';
    case 'start':
      return 'start';
    default:
      return 'info';
  }
}

export function buildCommentary(state: GameState, race: RaceState): CommentaryLine[] {
  const name = (id: string) => (state.drivers[id] ? driverShortName(state.drivers[id]) : '?');
  const pick = new Picker(hashString(race.id) % 7);
  const lines: CommentaryLine[] = [];
  const push = (lap: number, text: string, tone: CommentaryTone, key: boolean, driverIds: string[]) => lines.push({ id: `${lap}-${lines.length}`, lap, text, tone, key, driverIds });
  const totals = lapTotals(race);
  const lastPass = new Map<string, number>();
  const battleTold = new Map<string, number>();
  const escapeTold = new Set<number>();
  const byLap = new Map<number, RaceLogEntry[]>();
  for (const e of race.log) byLap.set(e.lap, [...(byLap.get(e.lap) ?? []), e]);

  for (let lap = 0; lap <= race.lap; lap++) {
    for (const e of byLap.get(lap) ?? []) {
      if (e.type === 'overtake' && e.driverIds.length === 2 && !e.text.startsWith('Team orders')) {
        const [a, b] = e.driverIds;
        const m = /for P(\d+)/.exec(e.text);
        const lead = /LEAD/.test(e.text);
        const p = lead ? 1 : m ? Number(m[1]) : 0;
        const pair = [a, b].sort().join('|');
        const prev = lastPass.get(pair);
        lastPass.set(pair, lap);
        const pool = lead ? 'lead' : prev !== undefined && lap - prev <= 2 ? 'swap' : 'pass';
        push(lap, fill(pick.pick(pool), { a: name(a), b: name(b), p }), lead ? 'lead' : 'overtake', e.key, e.driverIds);
        continue;
      }
      if (e.type === 'fastestLap' && e.driverIds[0]) {
        const t = /, ([\d:.]+)\.$/.exec(e.text)?.[1] ?? '';
        push(lap, fill(pick.pick('fastest'), { a: name(e.driverIds[0]), t }), 'fastest', false, e.driverIds);
        continue;
      }
      push(lap, e.text, toneOf(e), e.key, e.driverIds);
    }
    if (lap === 0) continue;
    const order = race.lapOrders[lap];
    if (!order) continue;
    // Opening-lap charges.
    if (lap === 1) {
      let best: { id: string; gain: number } | null = null;
      for (const c of race.cars) {
        const now = order.indexOf(c.driverId) + 1;
        if (now <= 0) continue;
        const gain = c.grid - now;
        if (gain >= 3 && (!best || gain > best.gain)) best = { id: c.driverId, gain };
      }
      if (best) push(1, fill(pick.pick('charge'), { a: name(best.id), n: best.gain }), 'overtake', false, [best.id]);
    }
    // Long battles: the same pair nose to tail, reported at 3 and 8 laps.
    for (let i = 1; i < order.length; i++) {
      const a = order[i - 1];
      const b = order[i];
      const ta = totals.get(a)?.[lap];
      const tb = totals.get(b)?.[lap];
      if (ta === undefined || tb === undefined || tb - ta > 1.0) continue;
      let n = 0;
      for (let k = lap; k >= 1; k--) {
        const o = race.lapOrders[k];
        const ia = o?.indexOf(a) ?? -1;
        if (ia < 0 || o[ia + 1] !== b) break;
        n++;
      }
      const pair = `${a}|${b}`;
      if ((n === 3 || n === 8) && battleTold.get(pair) !== n && i <= 12) {
        battleTold.set(pair, n);
        push(lap, fill(pick.pick('battle'), { a: name(a), b: name(b), n, p: i }), 'battle', false, [a, b]);
      }
    }
    // A leader breaking clear.
    if (order.length > 1) {
      const t1 = totals.get(order[0])?.[lap];
      const t2 = totals.get(order[1])?.[lap];
      if (t1 !== undefined && t2 !== undefined) {
        const gap = t2 - t1;
        for (const threshold of [5, 10, 20]) {
          if (gap >= threshold && !escapeTold.has(threshold) && race.safetyCar.type === 'none') {
            escapeTold.add(threshold);
            push(lap, fill(pick.pick('escape'), { a: name(order[0]), b: name(order[1]), g: gap.toFixed(1) }), 'lead', false, [order[0]]);
            break;
          }
        }
      }
    }
    // Laps to go.
    const left = race.totalLaps - lap;
    if (left === 10 && race.totalLaps >= 25) push(lap, `Ten laps to go. ${name(order[0])} leads.`, 'info', false, [order[0]]);
    if (left === 5 && race.totalLaps >= 12) push(lap, `Five laps remaining${order[1] ? `, and ${name(order[1])} is the closest challenger` : ''}.`, 'info', false, [order[0]]);
    if (left === 1) push(lap, `Final lap! ${name(order[0])} leads${order[1] ? ` from ${name(order[1])}` : ''}.`, 'info', true, [order[0]]);
  }
  return lines;
}

export interface Moment {
  id: string;
  lap: number;
  title: string;
  text: string;
  tone: CommentaryTone;
}

/** Big on-screen moments of the latest lap: lead changes, crashes, caution, rain, final lap, finish. */
export function latestMoment(state: GameState, race: RaceState, lines: CommentaryLine[]): Moment | null {
  const playerTeam = state.player.teamId;
  const mine = (ids: string[]) => ids.some((id) => race.cars.find((c) => c.driverId === id)?.teamId === playerTeam);
  const recent = lines.filter((l) => l.lap === race.lap).reverse();
  const by = (pred: (l: CommentaryLine) => boolean) => recent.find(pred);
  const finish = by((l) => l.tone === 'finish');
  if (finish) return { id: finish.id, lap: race.lap, title: 'Chequered flag', text: finish.text.replace('CHEQUERED FLAG! ', ''), tone: 'finish' };
  const caution = by((l) => l.tone === 'caution' && !/resumes|Green/.test(l.text));
  if (caution) return { id: caution.id, lap: race.lap, title: /VIRTUAL/.test(caution.text) ? 'Virtual safety car' : 'Safety car', text: caution.text, tone: 'caution' };
  const crash = by((l) => l.tone === 'incident' && l.key);
  if (crash) return { id: crash.id, lap: race.lap, title: mine(crash.driverIds) ? 'Drama for your team' : 'Incident', text: crash.text, tone: 'incident' };
  const lead = by((l) => l.tone === 'lead' && /lead|leader|front/i.test(l.text) && !/clear|pulling|stretches|tow/.test(l.text));
  if (lead) return { id: lead.id, lap: race.lap, title: 'New leader', text: lead.text, tone: 'lead' };
  const rain = by((l) => l.tone === 'weather' && /falling/.test(l.text));
  if (rain) return { id: rain.id, lap: race.lap, title: 'Rain', text: rain.text, tone: 'weather' };
  const myPass = by((l) => l.tone === 'overtake' && mine(l.driverIds.slice(0, 1)) && l.driverIds.length === 2);
  if (myPass) return { id: myPass.id, lap: race.lap, title: 'Overtake', text: myPass.text, tone: 'overtake' };
  const last = by((l) => /^Final lap/.test(l.text));
  if (last) return { id: last.id, lap: race.lap, title: 'Final lap', text: last.text, tone: 'info' };
  return null;
}
