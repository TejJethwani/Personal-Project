import { DIVISIONS, eventLaps } from '../config/divisions';
import { RACE_TUNING } from '../config/tuning';
import { inRaceFrame, trackPerformance } from '../car/car';
import { eventCarOffset } from '../europe/power';
import { qualiPaceIndex } from '../drivers/ratings';
import { Rng } from '../rng';
import type { CalendarEvent, GameState, QualifyingEntry, QualifyingResult, TireCompound } from '../types';
import { basePace, divisionBaseLap } from './pace';
import { compoundPaceOffset, idealCompoundForWetness } from './tires';
import { generateEventWeather } from './weather';
import { twistEffects, weatherMods } from '../season/twists';

export type QualiRisk = 'safe' | 'normal' | 'maximum';

export interface QualiEntrant {
  driverId: string;
  teamId: string;
  setupQuality: number;
  risk: QualiRisk;
}

const RISK_PACE: Record<QualiRisk, number> = { safe: 0.0016, normal: 0, maximum: -0.0022 };
const RISK_MISTAKE: Record<QualiRisk, number> = { safe: 0.5, normal: 1, maximum: 2.1 };

export function qualifyingWetness(state: GameState, event: CalendarEvent): number {
  const circuit = state.circuits[event.circuitId];
  return generateEventWeather(state.seed, event.id, circuit, eventLaps(event, circuit.laps), weatherMods(state, event.division)).qualiWetness;
}

/** Number of cars progressing into each session. */
export function sessionSizes(division: CalendarEvent['division'], fieldSize: number): number[] {
  // Small fields (head-to-head races) run one shoot-out session.
  if (fieldSize <= 12) return [fieldSize];
  const cfg = DIVISIONS[division];
  const sizes = [fieldSize];
  for (const elim of cfg.knockoutEliminations) sizes.push(Math.max(1, sizes[sizes.length - 1] - elim));
  return sizes.slice(0, cfg.qualifyingSessions);
}

/**
 * Simulate a single qualifying session. Each driver gets several timed runs;
 * the track rubbers in during the session, traffic can spoil a lap, and
 * pushing to the limit risks a mistake that deletes the lap.
 */
export function runQualifyingSession(state: GameState, event: CalendarEvent, entrants: QualiEntrant[], sessionIndex: number): { driverId: string; best: number | null; sectors: [number, number, number] | null; note?: string }[] {
  const circuit = state.circuits[event.circuitId];
  const cfg = DIVISIONS[event.division];
  const rng = Rng.from(state.seed, 'quali', event.id, sessionIndex);
  const baseLap = divisionBaseLap(circuit, event.division);
  const scale = baseLap / RACE_TUNING.referenceLap;
  const wet = qualifyingWetness(state, event);
  const runs = cfg.qualifyingSessions === 1 ? 3 : 2;
  const totalRuns = cfg.qualifyingSessions * runs;
  const compound: TireCompound = idealCompoundForWetness(wet, cfg.dryCompounds[0]);
  const t = RACE_TUNING;
  return entrants.map((e) => {
    const driver = state.drivers[e.driverId];
    const team = state.teams[e.teamId];
    const carPerf = inRaceFrame(trackPerformance(team.car, circuit), event.division) + eventCarOffset(state, team, event);
    const drvPerf = qualiPaceIndex(driver, circuit, wet);
    let best: number | null = null;
    let bestSectors: [number, number, number] | null = null;
    let note: string | undefined;
    for (let r = 0; r < runs; r++) {
      const progress = (sessionIndex * runs + r) / Math.max(1, totalRuns - 1);
      let lap = basePace(baseLap, carPerf, drvPerf, e.setupQuality);
      lap += compoundPaceOffset(compound, wet, scale);
      lap -= t.qualiEvolution * baseLap * progress;
      lap += RISK_PACE[e.risk] * baseLap;
      lap += rng.normal(0, (0.08 + ((100 - driver.attributes.consistency) / 100) * 0.2) * scale);
      if (rng.chance(t.qualiTrafficChance)) {
        lap += rng.range(0.1, 0.7) * scale;
        if (!note) note = 'Traffic';
      }
      const pMistake = t.qualiMistakeChance * ((100 - driver.attributes.consistency) / 50) ** 1.2 * RISK_MISTAKE[e.risk] * (1 + wet * 2) * (1.25 - driver.attributes.mentality / 200);
      if (rng.chance(pMistake)) {
        if (rng.chance(0.55)) {
          note = 'Lap deleted';
          continue;
        }
        lap += rng.range(1.2, 4) * scale;
        note = 'Mistake';
      }
      if (best === null || lap < best) {
        best = lap;
        const raw = circuit.sectors.map((f) => lap * f * (1 + rng.normal(0, 0.005)));
        const sum = raw[0] + raw[1] + raw[2];
        bestSectors = raw.map((s) => (s * lap) / sum) as [number, number, number];
      }
    }
    return { driverId: e.driverId, best, sectors: bestSectors, note };
  });
}

/** Run every session and produce the final grid (with grid penalties applied). */
export function runFullQualifying(state: GameState, event: CalendarEvent, entrants: QualiEntrant[]): QualifyingResult {
  return buildQualifying(state, event, entrants, sessionSizes(event.division, entrants.length).length);
}

export function buildQualifying(state: GameState, event: CalendarEvent, entrants: QualiEntrant[], sessionsToRun: number, previous?: QualifyingEntry[][]): QualifyingResult {
  const sizes = sessionSizes(event.division, entrants.length);
  const sessions = runSessions(state, event, entrants, sessionsToRun, previous);
  return combineSessions(state, entrants, sessions, sizes, event);
}

/** Run sessions up to `sessionsToRun`, continuing from previously completed ones. Returns raw session tables. */
export function runSessions(state: GameState, event: CalendarEvent, entrants: QualiEntrant[], sessionsToRun: number, previous?: QualifyingEntry[][]): QualifyingEntry[][] {
  const sizes = sessionSizes(event.division, entrants.length);
  const sessions: QualifyingEntry[][] = previous ? [...previous] : [];
  let field = entrants;
  if (sessions.length) {
    const last = sessions[sessions.length - 1];
    const next = sizes[sessions.length];
    field = last.slice(0, next).map((q) => entrants.find((e) => e.driverId === q.driverId)!).filter(Boolean);
  }
  for (let s = sessions.length; s < Math.min(sessionsToRun, sizes.length); s++) {
    const times = runQualifyingSession(state, event, field, s);
    times.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
    const entries: QualifyingEntry[] = times.map((tm, i) => ({
      driverId: tm.driverId,
      teamId: field.find((f) => f.driverId === tm.driverId)!.teamId,
      position: i + 1,
      bestLap: tm.best,
      sessionTimes: [],
      eliminatedIn: null,
      sectors: tm.sectors,
      gridPenalty: 0,
      grid: i + 1,
      note: tm.note,
    }));
    sessions.push(entries);
    const next = sizes[s + 1];
    if (next !== undefined) field = entries.slice(0, next).map((q) => field.find((f) => f.driverId === q.driverId)!);
  }
  return sessions;
}

export function combineSessions(state: GameState, entrants: QualiEntrant[], sessions: QualifyingEntry[][], sizes: number[], event: CalendarEvent): QualifyingResult {
  const order: QualifyingEntry[] = [];
  const placed = new Set<string>();
  for (let s = sessions.length - 1; s >= 0; s--) {
    for (const e of sessions[s]) {
      if (placed.has(e.driverId)) continue;
      placed.add(e.driverId);
      order.push({
        ...e,
        sessionTimes: sessions.map((sess) => sess.find((x) => x.driverId === e.driverId)?.bestLap ?? null),
        eliminatedIn: s === sizes.length - 1 ? null : s + 1,
      });
    }
  }
  // Drivers not yet run (partial qualifying) keep entry order at the back.
  for (const e of entrants) {
    if (!placed.has(e.driverId)) order.push({ driverId: e.driverId, teamId: e.teamId, position: 0, bestLap: null, sessionTimes: [], eliminatedIn: null, sectors: null, gridPenalty: 0, grid: 0 });
  }
  order.forEach((e, i) => (e.position = i + 1));
  // Grid penalties: move the driver back, others close up.
  const grid = [...order];
  // Season twist: the reverse-grid round flips the top ten.
  if (twistEffects(state, event.division).reverseGridRound === event.round && sessions.length >= sizes.length) {
    const top = grid.splice(0, Math.min(10, grid.length)).reverse();
    grid.unshift(...top);
  }
  const penalised = order.filter((e) => (state.drivers[e.driverId]?.pendingGridPenalty ?? 0) > 0);
  for (const e of penalised) {
    const pen = state.drivers[e.driverId].pendingGridPenalty;
    const idx = grid.indexOf(e);
    grid.splice(idx, 1);
    const target = Math.min(grid.length, idx + pen);
    grid.splice(target, 0, e);
    e.gridPenalty = pen;
  }
  grid.forEach((e, i) => (e.grid = i + 1));
  const wet = qualifyingWetness(state, event) > 0.2;
  return { sessions: sessions.length, entries: order, wet };
}
