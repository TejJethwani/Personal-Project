import { championshipPoints, computeStandingsFromResults, seasonResults } from '../championship/standings';
import { pointsTable } from '../config/divisions';
import { RACE_TUNING } from '../config/tuning';
import { driverShortName } from '../drivers/ratings';
import { hashString } from '../rng';
import { findEvent } from '../season/calendar';
import type { GameState, RaceLogEntry, RaceState } from '../types';
import { LIBRARY, type LibraryKey } from './commentaryLibrary';

/**
 * Broadcast commentary built from what actually happened in the race: the
 * race-control log plus moments read from the lap-by-lap record (launches,
 * side-by-side starts, three-way fights, a leader breaking clear or being
 * caught, rain on the radar, the run to the flag, the provisional title
 * lead). Nothing is invented: every line points at a logged event or at the
 * lap times and positions. Phrasing rotates through a large library so lines
 * do not repeat, and the context (lead, podium, points, late race, the wet,
 * the player's cars) picks the pool.
 *
 * Alongside the commentary: the Race Director's official messages, the team
 * radio of the player's cars, and alerts graded major or minor for the
 * broadcast overlays.
 */

export type CommentaryTone = 'lead' | 'overtake' | 'defend' | 'incident' | 'pit' | 'weather' | 'caution' | 'info' | 'battle' | 'radio' | 'finish' | 'penalty' | 'fastest' | 'start' | 'title';

export type AlertKind = 'start' | 'lead' | 'overtake' | 'defend' | 'fastest' | 'lockup' | 'mistake' | 'crash' | 'collision' | 'puncture' | 'failure' | 'rain' | 'pitError' | 'safetyCar' | 'titleLead' | 'finalLap' | 'battle' | 'finish';

export interface CommentaryLine {
  id: string;
  lap: number;
  text: string;
  tone: CommentaryTone;
  key: boolean;
  driverIds: string[];
  /** Shown as an on-screen alert. */
  alert?: AlertKind;
  /** Major alerts get the full-width banner; minor ones the ticker. */
  major?: boolean;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Walks each pool in a race-specific order, so the same line never comes twice in a row. */
class Picker {
  private used = new Map<string, number>();
  constructor(private salt: number) {}
  pick(pool: LibraryKey): string {
    const list = LIBRARY[pool];
    const n = this.used.get(pool) ?? 0;
    this.used.set(pool, n + 1);
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

interface Context {
  state: GameState;
  race: RaceState;
  name: (id: string) => string;
  mine: Set<string>;
  scoring: number;
  team: string;
  track: string;
}

export function buildCommentary(state: GameState, race: RaceState): CommentaryLine[] {
  const event = findEvent(state, race.eventId);
  const championship = !!event && !event.pointsPreset;
  const circuit = state.circuits[race.circuitId];
  const playerTeam = state.player.teamId;
  const cx: Context = {
    state,
    race,
    name: (id: string) => (state.drivers[id] ? driverShortName(state.drivers[id]) : '?'),
    mine: new Set(race.cars.filter((c) => c.teamId === playerTeam).map((c) => c.driverId)),
    scoring: event?.pointsPreset ? pointsTable(event.pointsPreset, race.cars.length).positions.length : championshipPoints(state, race.division).positions.length,
    team: state.teams[playerTeam]?.name ?? 'your team',
    track: circuit?.name ?? 'the circuit',
  };
  const pick = new Picker(hashString(race.id) % 11);
  const lines: CommentaryLine[] = [];
  const say = (lap: number, pool: LibraryKey, vars: Record<string, string | number>, tone: CommentaryTone, key: boolean, driverIds: string[], alert?: AlertKind, major = false): void => {
    // A template written in capitals is shouted in full; otherwise names keep their case.
    const template = pick.pick(pool);
    const words = template.replace(/\{\w+\}/g, '');
    const shout = /[A-Z]{4}/.test(words) && words === words.toUpperCase();
    const same = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.toUpperCase(), v]));
    const text = fill(template, { ...vars, ...same });
    lines.push({ id: `${lap}-${lines.length}`, lap, text: shout ? text.toUpperCase() : text, tone, key, driverIds, ...(alert ? { alert, major } : {}) });
  };
  const raw = (lap: number, text: string, tone: CommentaryTone, key: boolean, driverIds: string[], alert?: AlertKind, major = false): void => {
    lines.push({ id: `${lap}-${lines.length}`, lap, text, tone, key, driverIds, ...(alert ? { alert, major } : {}) });
  };

  const totals = lapTotals(race);
  const gapAt = (lap: number, a: string, b: string) => {
    const ta = totals.get(a)?.[lap];
    const tb = totals.get(b)?.[lap];
    return ta === undefined || tb === undefined ? null : tb - ta;
  };
  const byLap = new Map<number, RaceLogEntry[]>();
  for (const e of race.log) byLap.set(e.lap, [...(byLap.get(e.lap) ?? []), e]);
  const lastPass = new Map<string, number>();
  const battleTold = new Map<string, number>();
  const threeTold = new Map<string, number>();
  const escapeTold = new Set<number>();
  let closingTold = -99;
  let rainTold = -99;
  const wetAt = (lap: number) => (race.weather[lap - 1]?.wetness ?? 0) > 0.3;
  const leaderAt = (lap: number) => race.lapOrders[lap]?.[0];

  // Provisional championship: points before this race plus the points each running position would score.
  const title = championship ? provisionalTitle(state, race) : null;
  let titleLeader = title?.preLeader ?? null;

  for (let lap = 0; lap <= race.lap; lap++) {
    const left = race.totalLaps - lap;
    for (const e of byLap.get(lap) ?? []) narrate(e, lap, left);
    if (lap === 0) continue;
    const order = race.lapOrders[lap];
    if (!order) continue;

    if (lap === 1) openingLap(order);

    // Gaps mean nothing while a safety car has bunched the field (and for two laps after).
    const bunched = lap <= 2 || race.scLaps.some((l) => l >= lap - 2 && l <= lap);
    let threes = bunched ? 1 : 0;
    let duels = bunched ? 2 : 0;
    const busy = new Set<string>();
    // Three cars covered by a couple of seconds, held for two laps (once per trio every ten laps, one a lap).
    for (let i = 0; i + 2 < order.length && i < 10 && threes < 1; i++) {
      const [a, b, c] = order.slice(i, i + 3);
      const g1 = gapAt(lap, a, b);
      const g2 = gapAt(lap, b, c);
      const prev = race.lapOrders[lap - 1];
      const heldBefore = prev && prev.indexOf(a) === i && prev.indexOf(b) === i + 1 && prev.indexOf(c) === i + 2;
      if (g1 !== null && g2 !== null && g1 < 1 && g2 < 1 && heldBefore && race.safetyCar.type === 'none') {
        const key3 = `${a}|${b}|${c}`;
        if (lap - (threeTold.get(key3) ?? -99) >= 10 && ![a, b, c].some((id) => lap - (threeTold.get(id) ?? -99) < 6)) {
          threeTold.set(key3, lap);
          for (const id of [a, b, c]) {
            threeTold.set(id, lap);
            busy.add(id);
          }
          threes++;
          say(lap, 'threeWay', { a: cx.name(a), b: cx.name(b), c: cx.name(c), p: i + 1, g: (g1 + g2).toFixed(1) }, 'battle', i < 3, [a, b, c], 'battle', false);
        }
      }
    }
    // Long one-on-one battles, reported at three and eight laps (two a lap at most).
    for (let i = 1; i < order.length && i <= 12 && duels < 2; i++) {
      const a = order[i - 1];
      const b = order[i];
      if (busy.has(a) || busy.has(b)) continue;
      const g = gapAt(lap, a, b);
      if (g === null || g > 1.0) continue;
      let n = 0;
      for (let k = lap; k >= 1; k--) {
        const o = race.lapOrders[k];
        const ia = o?.indexOf(a) ?? -1;
        if (ia < 0 || o[ia + 1] !== b) break;
        n++;
      }
      const pair = `${a}|${b}`;
      if ((n === 3 || n === 8) && battleTold.get(pair) !== n) {
        battleTold.set(pair, n);
        duels++;
        say(lap, 'battle', { a: cx.name(a), b: cx.name(b), n, p: i }, 'battle', false, [a, b]);
      }
    }
    // The leader breaking clear, or being reeled in.
    if (order.length > 1) {
      const gap = gapAt(lap, order[0], order[1]);
      if (gap !== null && race.scLaps.indexOf(lap) < 0) {
        for (const threshold of [5, 10, 20]) {
          if (gap >= threshold && !escapeTold.has(threshold)) {
            escapeTold.add(threshold);
            say(lap, 'escape', { a: cx.name(order[0]), b: cx.name(order[1]), g: gap.toFixed(1) }, 'lead', false, [order[0]]);
            break;
          }
        }
        const before = lap > 5 ? gapAt(lap - 5, race.lapOrders[lap - 5]?.[0] ?? '', race.lapOrders[lap - 5]?.[1] ?? '') : null;
        if (before !== null && before >= 3 && gap < 1.5 && race.lapOrders[lap - 5]?.[0] === order[0] && race.lapOrders[lap - 5]?.[1] === order[1] && lap - closingTold >= 10 && !race.scLaps.some((l) => l > lap - 5 && l <= lap)) {
          closingTold = lap;
          say(lap, 'closing', { a: cx.name(order[0]), b: cx.name(order[1]), g: gap.toFixed(1) }, 'battle', true, [order[0], order[1]], 'battle', false);
        }
      }
    }
    // Rain on the radar (the forecast the teams see).
    const now = race.weather[lap - 1];
    if (now && now.rain < 0.05 && lap - rainTold > 8 && left > 2) {
      const soon = [1, 2, 3, 4].find((k) => (race.weather[lap - 1 + k]?.rain ?? 0) >= 0.1 && lap + k <= race.totalLaps);
      if (soon) {
        rainTold = lap;
        say(lap, 'rainSoon', { n: soon }, 'weather', soon <= 2, [], 'rain', false);
      }
    }
    // The run to the flag.
    const g12 = order.length > 1 ? gapAt(lap, order[0], order[1]) : null;
    const leadVars = { a: cx.name(order[0]), b: order[1] ? cx.name(order[1]) : '', g: g12 !== null ? g12.toFixed(1) : '' };
    if (left === 10 && race.totalLaps >= 25) say(lap, 'tenToGo', leadVars, 'info', false, [order[0]]);
    if (left === 5 && race.totalLaps >= 12 && order[1]) say(lap, 'fiveToGo', leadVars, 'info', false, [order[0]]);
    if (left === 3 && g12 !== null && g12 < 2 && race.totalLaps >= 8) say(lap, 'finalThreeClose', leadVars, 'battle', true, [order[0], order[1]], 'finalLap', true);
    if (left === 1 && order[1]) say(lap, 'finalLap', leadVars, 'info', true, [order[0]], 'finalLap', false);
    // Provisional title lead.
    if (title) {
      const leader = title.leaderAt(lap);
      if (leader && leader !== titleLeader && lap < race.totalLaps) say(lap, 'titleLead', { a: cx.name(leader) }, 'title', true, [leader], 'titleLead', true);
      titleLeader = leader ?? titleLeader;
    }
  }
  return lines;

  function narrate(e: RaceLogEntry, lap: number, left: number): void {
    const [x, y] = e.driverIds;
    const n = (id?: string) => (id ? cx.name(id) : '');
    switch (e.type) {
      case 'start':
        // Called once the cars are actually away.
        if (race.lap === 0) return;
        say(0, (race.weather[0]?.wetness ?? 0) > 0.2 ? 'startWet' : 'start', { track: cx.track, n: race.cars.length, laps: race.totalLaps }, 'start', true, [], 'start', true);
        return;
      case 'overtake': {
        if (e.driverIds.length !== 2 || e.text.startsWith('Team orders')) return raw(lap, e.text, 'overtake', e.key, e.driverIds);
        const lead = /for the LEAD/.test(e.text);
        const p = lead ? 1 : Number(/for P(\d+)/.exec(e.text)?.[1] ?? 0);
        const pair = [x, y].sort().join('|');
        const prev = lastPass.get(pair);
        lastPass.set(pair, lap);
        const vars = { a: n(x), b: n(y), p, n: left, team: cx.team };
        const finalLap = lap === race.totalLaps;
        if (lead && finalLap) return say(lap, 'lastLapWin', vars, 'lead', true, e.driverIds, 'lead', true);
        if (lead) return say(lap, left <= 5 && lap > 1 ? 'leadLate' : 'lead', vars, 'lead', true, e.driverIds, 'lead', true);
        if (finalLap) return say(lap, 'lastLapPass', vars, 'overtake', true, e.driverIds, 'overtake', cx.mine.has(x) || p <= 3);
        if (prev !== undefined && lap - prev <= 2) return say(lap, 'swap', vars, 'overtake', e.key, e.driverIds, 'overtake', false);
        if (p <= 3 && p > 1) return say(lap, 'podiumPass', vars, 'overtake', true, e.driverIds, 'overtake', false);
        if (cx.mine.has(x) && p === cx.scoring) return say(lap, 'intoPoints', vars, 'overtake', true, e.driverIds, 'overtake', false);
        if (cx.mine.has(y) && p === cx.scoring) return say(lap, 'outOfPoints', vars, 'overtake', true, e.driverIds, 'overtake', false);
        if (cx.mine.has(x)) return say(lap, 'myGain', vars, 'overtake', true, e.driverIds, 'overtake', false);
        if (cx.mine.has(y)) return say(lap, 'myLoss', vars, 'overtake', true, e.driverIds, 'overtake', false);
        if (wetAt(lap)) return say(lap, 'passWet', vars, 'overtake', e.key, e.driverIds, 'overtake', false);
        if (left <= 5 && lap > 1) return say(lap, 'passLate', vars, 'overtake', e.key, e.driverIds, 'overtake', false);
        return say(lap, 'pass', vars, 'overtake', e.key, e.driverIds, 'overtake', false);
      }
      case 'defend': {
        const p = Number(/for P(\d+)/.exec(e.text)?.[1] ?? 0);
        return say(lap, p === 1 ? 'defendLead' : 'defend', { a: n(x), b: n(y), p }, 'defend', p === 1, e.driverIds, 'defend', false);
      }
      case 'pit': {
        const m = /pits from P(\d+): (.+?) → (.+?) \(([\d.]+)s(, slow stop!)?\)/.exec(e.text);
        if (!m) return raw(lap, e.text, 'pit', e.key, e.driverIds);
        const vars = { a: n(x), p: m[1], from: m[2], to: m[3], t: m[4], team: cx.team };
        // The whole field's stops are on the timing tower; the broadcast calls the front, the player's cars and the dramas.
        if (!m[5] && Number(m[1]) > 10 && !cx.mine.has(x)) return;
        if (m[5]) return say(lap, 'pitSlow', vars, 'pit', true, e.driverIds, 'pitError', false);
        if (race.scLaps.includes(lap)) return say(lap, 'pitUnderSc', vars, 'pit', e.key, e.driverIds);
        return say(lap, cx.mine.has(x) ? 'pitPlayer' : 'pit', vars, 'pit', e.key, e.driverIds);
      }
      case 'mistake':
        if (!cx.mine.has(x) && (race.lapOrders[Math.max(0, lap - 1)]?.indexOf(x) ?? 99) >= 15) return;
        if (/spins/.test(e.text)) return say(lap, 'spin', { a: n(x) }, 'incident', e.key, e.driverIds, 'mistake', false);
        if (/locks up/.test(e.text)) return say(lap, 'lockup', { a: n(x) }, 'incident', false, e.driverIds, 'lockup', false);
        return say(lap, 'wide', { a: n(x) }, 'info', false, e.driverIds);
      case 'crash':
        return say(lap, /wet/i.test(race.cars.find((c) => c.driverId === x)?.retireReason ?? '') ? 'crashWet' : 'crash', { a: n(x) }, 'incident', true, e.driverIds, 'crash', true);
      case 'collision':
        // The engine's line carries the consequence (damage, puncture, retirement).
        return raw(lap, e.text, 'incident', e.key, e.driverIds, 'collision', /out/.test(e.text));
      case 'failure': {
        if (/puncture/i.test(e.text)) return say(lap, 'puncture', { a: n(x) }, 'incident', true, e.driverIds, 'puncture', cx.mine.has(x));
        if (/fuel/i.test(e.text)) return raw(lap, e.text, 'incident', true, e.driverIds, 'failure', cx.mine.has(x));
        const reason = /(?:with|out:) (.+?)[.!]$/.exec(e.text)?.[1];
        say(lap, 'failure', { a: n(x) }, 'incident', true, e.driverIds, 'failure', cx.mine.has(x) || (race.lapOrders[lap - 1]?.indexOf(x) ?? 99) < 3);
        if (reason) lines[lines.length - 1].text += ` (${reason})`;
        return;
      }
      case 'warning': {
        if (!cx.mine.has(x) && (race.lapOrders[Math.max(0, lap - 1)]?.indexOf(x) ?? 99) >= 5) return;
        const t = /has an? (\w+) warning/.exec(e.text)?.[1] ?? 'technical';
        return say(lap, 'warning', { a: n(x), t }, 'incident', e.key, e.driverIds);
      }
      case 'safetyCar':
        return say(lap, 'safetyCar', {}, 'caution', true, [], 'safetyCar', true);
      case 'vsc':
        return say(lap, 'vsc', {}, 'caution', true, [], 'safetyCar', true);
      case 'safetyCarEnd': {
        const leader = leaderAt(lap) ?? '';
        return say(lap, 'restart', { a: n(leader) }, 'caution', true, leader ? [leader] : []);
      }
      case 'weather':
        if (/falling/.test(e.text)) return say(lap, 'rainStart', {}, 'weather', true, [], 'rain', true);
        return say(lap, 'rainStop', {}, 'weather', false, []);
      case 'fastestLap': {
        const t = /, ([\d:.]+)\.$/.exec(e.text)?.[1] ?? '';
        return say(lap, 'fastest', { a: n(x), t }, 'fastest', false, e.driverIds, 'fastest', false);
      }
      case 'finish': {
        const winner = race.cars.find((c) => c.driverId === x);
        const second = race.lapOrders[race.totalLaps]?.[1];
        const g = winner && second ? (totals.get(second)?.[race.totalLaps] ?? 0) - (totals.get(x!)?.[race.totalLaps] ?? 0) : 0;
        const vars = { a: n(x), track: cx.track, g: Math.abs(g).toFixed(g < 1 ? 3 : 1), p: winner?.grid ?? 0, team: cx.team };
        const pool: LibraryKey = cx.mine.has(x!) ? 'winMine' : winner && winner.grid >= 6 ? 'winFromBack' : second && g < 1 ? 'winClose' : second && g > 10 ? 'winDominant' : 'win';
        return say(lap, pool, vars, 'finish', true, e.driverIds, 'finish', true);
      }
      case 'penalty':
        return raw(lap, e.text, 'penalty', e.key, e.driverIds);
      case 'info':
        if (/takes the lead/.test(e.text)) return raw(lap, e.text, 'lead', true, e.driverIds, 'lead', true);
        return raw(lap, e.text, 'info', e.key, e.driverIds);
      case 'radio':
      case 'control':
        // Radio and race control have their own feeds.
        return;
      default:
        return raw(lap, e.text, 'info', e.key, e.driverIds);
    }
  }

  function openingLap(order: string[]): void {
    const grid = [...race.cars].sort((a, b) => a.grid - b.grid);
    // Places lost or gained around a spin or contact on lap one are not about the launch.
    const troubled = new Set(race.log.filter((e) => e.lap === 1 && (e.type === 'mistake' || e.type === 'collision' || e.type === 'crash')).flatMap((e) => e.driverIds));
    const pole = grid[0]?.driverId;
    if (pole && order[0] && order[0] !== pole && race.cars.find((c) => c.driverId === pole)?.status === 'running') say(1, 'holeshot', { a: cx.name(order[0]), b: cx.name(pole) }, 'lead', true, [order[0], pole], 'lead', true);
    else if (pole && order[0] === pole) say(1, 'poleHold', { a: cx.name(pole) }, 'lead', false, [pole]);
    let best: { id: string; gain: number } | null = null;
    let worst: { id: string; loss: number } | null = null;
    for (const c of race.cars) {
      const now = order.indexOf(c.driverId) + 1;
      if (now <= 0) continue;
      const gain = c.grid - now;
      if (troubled.has(c.driverId)) continue;
      if (gain >= 3 && (!best || gain > best.gain)) best = { id: c.driverId, gain };
      if (-gain >= 3 && c.grid <= race.cars.length / 2 && (!worst || -gain > worst.loss)) worst = { id: c.driverId, loss: -gain };
    }
    if (best) say(1, 'rocket', { a: cx.name(best.id), n: best.gain }, 'start', true, [best.id], 'start', best.gain >= 5 || cx.mine.has(best.id));
    if (worst) say(1, 'bogged', { a: cx.name(worst.id), n: worst.loss }, 'info', cx.mine.has(worst.id), [worst.id]);
    // Side by side: the closest pair in the top six at the end of lap one.
    let close: { a: string; b: string; g: number; p: number } | null = null;
    for (let i = 1; i < Math.min(6, order.length); i++) {
      const g = gapAt(1, order[i - 1], order[i]);
      if (g !== null && g < 0.25 && (!close || g < close.g)) close = { a: order[i - 1], b: order[i], g, p: i };
    }
    if (close) say(1, 'sideBySide', { a: cx.name(close.b), b: cx.name(close.a), p: close.p }, 'battle', false, [close.b, close.a], 'battle', false);
  }
}

/** Provisional drivers' championship leader at each lap of a championship race. */
function provisionalTitle(state: GameState, race: RaceState): { preLeader: string | null; leaderAt: (lap: number) => string | null } | null {
  const before = computeStandingsFromResults(seasonResults(state, race.division).filter((r) => r.eventId !== race.eventId)).drivers;
  if (!before.length || before[0].points <= 0) return null;
  const pre = new Map(before.map((r) => [r.id, r.points]));
  const table = championshipPoints(state, race.division).positions;
  return {
    preLeader: before[0].id,
    leaderAt: (lap: number) => {
      const order = race.lapOrders[lap];
      if (!order) return null;
      const live = new Map(pre);
      order.forEach((id, i) => live.set(id, (live.get(id) ?? 0) + (table[i] ?? 0)));
      let best: string | null = null;
      let pts = -1;
      for (const [id, p] of live) if (p > pts || (p === pts && best !== null && id === before[0].id)) [best, pts] = [id, p];
      return best;
    },
  };
}

export interface Moment {
  id: string;
  lap: number;
  title: string;
  text: string;
  tone: CommentaryTone;
  alert: AlertKind;
}

const MAJOR_TITLES: Partial<Record<AlertKind, string>> = {
  finish: 'Chequered flag',
  safetyCar: 'Race control',
  crash: 'Crash',
  collision: 'Collision',
  lead: 'New leader',
  titleLead: 'Championship',
  rain: 'Rain',
  finalLap: 'Final laps',
  start: 'Lights out',
  failure: 'Retirement',
  puncture: 'Puncture',
};

const MAJOR_ORDER: AlertKind[] = ['finish', 'safetyCar', 'crash', 'collision', 'failure', 'puncture', 'lead', 'titleLead', 'rain', 'finalLap', 'start'];

/** The biggest moment of the latest lap for the full-width banner. */
export function latestMoment(state: GameState, race: RaceState, lines: CommentaryLine[]): Moment | null {
  const playerTeam = state.player.teamId;
  const recent = lines.filter((l) => l.lap === race.lap && l.alert && l.major);
  for (const kind of MAJOR_ORDER) {
    const l = recent.find((x) => x.alert === kind);
    if (!l) continue;
    const mine = l.driverIds.some((id) => race.cars.find((c) => c.driverId === id)?.teamId === playerTeam);
    const title = mine && (kind === 'crash' || kind === 'collision' || kind === 'failure' || kind === 'puncture') ? 'Drama for your team' : MAJOR_TITLES[kind] ?? 'Race';
    return { id: l.id, lap: l.lap, title, text: l.text, tone: l.tone, alert: kind };
  }
  return null;
}

/** Minor alerts of the latest lap for the ticker (most important first, at most four). */
export function lapAlerts(race: RaceState, lines: CommentaryLine[]): CommentaryLine[] {
  return lines.filter((l) => l.lap === race.lap && l.alert && !l.major).slice(-4);
}

// ---------------------------------------------------------------------------
// Race Director and team radio
// ---------------------------------------------------------------------------

export interface FeedLine {
  id: string;
  lap: number;
  text: string;
  level: 'info' | 'flag' | 'penalty' | 'caution' | 'green';
  speaker?: string;
}

/** Official race control messages: start, flags, DRS, safety cars, penalties, stewards, the finish. */
export function raceDirectorFeed(state: GameState, race: RaceState): FeedLine[] {
  const n = (id?: string) => (id && state.drivers[id] ? driverShortName(state.drivers[id]).toUpperCase() : '');
  const out: FeedLine[] = [];
  const add = (lap: number, text: string, level: FeedLine['level']) => out.push({ id: `rd-${out.length}`, lap, text, level });
  for (const e of race.log) {
    const [x, y] = e.driverIds;
    switch (e.type) {
      case 'start':
        add(0, race.lap === 0 ? `FORMATION LAP. ${race.cars.length} CARS, ${race.totalLaps} LAPS.` : `RACE START. ${race.cars.length} CARS, ${race.totalLaps} LAPS.`, 'green');
        break;
      case 'control':
        add(e.lap, e.text.toUpperCase(), /DRS enabled/.test(e.text) ? 'green' : 'flag');
        break;
      case 'penalty':
        add(e.lap, `PENALTY: ${e.text.replace(/^Stewards: /, '').toUpperCase()}`, 'penalty');
        break;
      case 'safetyCar':
        add(e.lap, 'SAFETY CAR DEPLOYED. PIT LANE OPEN.', 'caution');
        break;
      case 'vsc':
        add(e.lap, 'VIRTUAL SAFETY CAR DEPLOYED.', 'caution');
        break;
      case 'safetyCarEnd':
        add(e.lap, /VSC/.test(e.text) ? 'VSC ENDING.' : 'SAFETY CAR IN THIS LAP.', 'green');
        break;
      case 'crash':
        add(e.lap, `DOUBLE YELLOW FLAGS. CAR OF ${n(x)} STOPPED IN THE BARRIER.`, 'flag');
        break;
      case 'collision':
        add(e.lap, `INCIDENT INVOLVING ${n(x)} AND ${n(y)} NOTED.`, 'flag');
        break;
      case 'failure':
        add(e.lap, `YELLOW FLAG. CAR OF ${n(x)} STOPPED${/puncture/i.test(e.text) ? ' WITH A PUNCTURE' : ''}.`, 'flag');
        break;
      case 'info':
        if (/^Stewards/.test(e.text)) add(e.lap, e.text.toUpperCase(), 'info');
        break;
      case 'weather':
        add(e.lap, /falling/.test(e.text) ? 'RAIN REPORTED. TRACK DECLARED WET.' : 'RAIN HAS STOPPED.', 'info');
        break;
      case 'finish':
        add(e.lap, 'CHEQUERED FLAG.', 'green');
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Radio of the player's cars: the drivers' own calls from the race, pit calls,
 * the start, and the engineer's updates every five laps (position, gaps and
 * pace against the car ahead, from the lap record).
 */
export function teamRadioFeed(state: GameState, race: RaceState): FeedLine[] {
  const playerTeam = state.player.teamId;
  const cars = race.cars.filter((c) => c.teamId === playerTeam);
  const n = (id: string) => (state.drivers[id] ? driverShortName(state.drivers[id]) : '?');
  const totals = lapTotals(race);
  const out: FeedLine[] = [];
  const add = (lap: number, speaker: string, text: string, level: FeedLine['level'] = 'info') => out.push({ id: `tr-${out.length}`, lap, text, level, speaker });
  const mine = new Set(cars.map((c) => c.driverId));
  const logByLap = new Map<number, RaceLogEntry[]>();
  for (const e of race.log) if (e.driverIds.some((id) => mine.has(id))) logByLap.set(e.lap, [...(logByLap.get(e.lap) ?? []), e]);

  for (let lap = 0; lap <= race.lap; lap++) {
    for (const e of logByLap.get(lap) ?? []) {
      const id = e.driverIds.find((d) => mine.has(d))!;
      if (e.type === 'radio') add(lap, n(id), e.text.replace(/^[^:]+: /, '').replace(/^"|"$/g, ''), 'info');
      if (e.type === 'pit' && e.driverIds[0] === id) {
        const t = /\(([\d.]+)s/.exec(e.text)?.[1];
        add(lap, 'Engineer', `Box, box. ${n(id)}, box this lap.${t ? ` ${/slow/.test(e.text) ? 'Sorry, slow stop' : 'Good stop'}: ${t} seconds.` : ''}`, /slow/.test(e.text) ? 'flag' : 'info');
      }
      if (e.type === 'warning') add(lap, 'Engineer', `${n(id)}, we see a problem on the data. Manage the car.`, 'flag');
      if ((e.type === 'failure' || e.type === 'crash' || (e.type === 'collision' && /out/.test(e.text))) && race.cars.find((c) => c.driverId === id)?.retiredLap === lap) add(lap, 'Engineer', `${n(id)}, stop the car, stop the car. We are out.`, 'penalty');
    }
    if (lap === 0) continue;
    const order = race.lapOrders[lap];
    if (!order) continue;
    for (const car of cars) {
      const pos = order.indexOf(car.driverId);
      if (pos < 0) continue;
      if (lap === 1) {
        const gain = car.grid - (pos + 1);
        add(lap, 'Engineer', gain >= 2 ? `Great start, ${n(car.driverId)}. P${pos + 1}, up ${gain}.` : gain <= -2 ? `We lost ${-gain} at the start. P${pos + 1}. Stay calm, long race.` : `P${pos + 1} after lap one. Settle in.`);
        continue;
      }
      const left = race.totalLaps - lap;
      if (left === 1) {
        add(lap, 'Engineer', `Last lap, ${n(car.driverId)}. P${pos + 1}. Bring it home.`, 'green');
        continue;
      }
      if (lap % 5 !== 0) continue;
      const ahead = order[pos - 1];
      const behind = order[pos + 1];
      const t = totals.get(car.driverId)?.[lap];
      const gA = ahead && t !== undefined ? t - (totals.get(ahead)?.[lap] ?? t) : null;
      const gB = behind && t !== undefined ? (totals.get(behind)?.[lap] ?? t) - t : null;
      const myLap = car.history.find((h) => h.lap === lap)?.lapTime;
      const aheadLap = ahead ? race.cars.find((c) => c.driverId === ahead)?.history.find((h) => h.lap === lap)?.lapTime : undefined;
      const parts = [`P${pos + 1}.`];
      if (ahead && gA !== null) parts.push(`Gap to ${n(ahead)} ahead ${gA.toFixed(1)}.`);
      if (behind && gB !== null) parts.push(`${n(behind)} is ${gB.toFixed(1)} behind.`);
      // A pit stop or a moment off track makes one lap meaningless for comparing pace.
      if (myLap && aheadLap && Math.abs(aheadLap - myLap) < 3) {
        const d = aheadLap - myLap;
        if (Math.abs(d) >= 0.1) parts.push(d > 0 ? `You were ${d.toFixed(1)} faster than ${n(ahead!)} that lap.` : `${n(ahead!)} was ${(-d).toFixed(1)} quicker that lap.`);
      }
      add(lap, 'Engineer', `${n(car.driverId)}, ${parts.join(' ')}`);
    }
  }
  return out;
}
