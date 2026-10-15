import { DIVISIONS } from '../config/divisions';
import { RACE_TUNING } from '../config/tuning';
import type { Circuit, DivisionId } from '../types';

/** Base lap time (s) for this division at this circuit. */
export function divisionBaseLap(circuit: Circuit, division: DivisionId): number {
  return circuit.baseLapTime * DIVISIONS[division].lapTimeFactor;
}

/**
 * Core pace model shared by practice, qualifying and the race.
 *
 *   lap = base + (ref - car) * kCar + (ref - driver) * kDriver - setupBonus
 *
 * All terms scale with the base lap length so a point of car performance is
 * worth the same relative time at a short or a long circuit.
 */
export function basePace(baseLap: number, carPerf: number, driverPerf: number, setupQuality: number): number {
  const t = RACE_TUNING;
  const scale = baseLap / t.referenceLap;
  const car = (t.referencePerf - carPerf) * t.carSecondsPerPoint * scale;
  const drv = (t.referencePerf - driverPerf) * t.driverSecondsPerPoint * scale;
  const setup = -((setupQuality - 50) / 50) * t.setupPaceRange * baseLap;
  return baseLap + car + drv + setup;
}

export function lapNoiseSd(consistency: number, scale: number): number {
  const t = RACE_TUNING;
  return (t.lapNoiseBase + ((100 - consistency) / 100) * t.lapNoiseInconsistency) * scale;
}

export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}` : `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
