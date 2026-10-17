import { stableNoise } from '../rng';
import type { Rng } from '../rng';
import type { Circuit, Driver, PracticeRun, Setup, SetupKey } from '../types';
import { clamp } from '../util';

export const SETUP_KEYS: SetupKey[] = ['frontWing', 'rearWing', 'suspension', 'rideHeight', 'gearing'];

export const SETUP_INFO: Record<SetupKey, { label: string; low: string; high: string }> = {
  frontWing: { label: 'Front Wing', low: 'Less front grip', high: 'More front grip' },
  rearWing: { label: 'Rear Wing', low: 'Low drag', high: 'High downforce' },
  suspension: { label: 'Suspension', low: 'Soft', high: 'Stiff' },
  rideHeight: { label: 'Ride Height', low: 'Low', high: 'High' },
  gearing: { label: 'Gear Ratios', low: 'Short (acceleration)', high: 'Long (top speed)' },
};

const SETUP_WEIGHT: Record<SetupKey, number> = { frontWing: 1, rearWing: 1.1, suspension: 0.9, rideHeight: 0.8, gearing: 0.9 };

export const DEFAULT_SETUP: Setup = { frontWing: 50, rearWing: 50, suspension: 50, rideHeight: 50, gearing: 50 };

/**
 * The ideal setup for a driver at a circuit. It depends on the track's
 * characteristics, the driver's personal preferences, and conditions that vary
 * by weekend, so teams must rediscover it in practice every time.
 */
export function idealSetup(seed: number, eventId: string, circuit: Circuit, driver: Driver): Setup {
  const d = circuit.weights.aerodynamics * 4 + circuit.weights.cornering * 2;
  const p = circuit.weights.straightLine * 3 + circuit.weights.powerUnit * 2;
  const m = circuit.weights.suspension * 4;
  const n = (k: string, amp: number) => stableNoise(seed, eventId, driver.id, k) * amp + stableNoise(seed, driver.id, 'pref', k) * amp * 0.6;
  return {
    frontWing: Math.round(clamp(25 + d * 55 + n('fw', 9), 5, 95)),
    rearWing: Math.round(clamp(30 + d * 50 - p * 35 + n('rw', 9), 5, 95)),
    suspension: Math.round(clamp(75 - m * 55 + (circuit.type === 'street' ? -10 : 0) + n('su', 10), 5, 95)),
    rideHeight: Math.round(clamp(30 + m * 40 + (circuit.type === 'street' ? 12 : 0) + n('rh', 10), 5, 95)),
    gearing: Math.round(clamp(20 + p * 70 + n('ge', 9), 5, 95)),
  };
}

/** What the simulator suggests for a circuit before any running: the track's part of the ideal setup. */
export function simulatorBaseline(circuit: Circuit): Setup {
  const d = circuit.weights.aerodynamics * 4 + circuit.weights.cornering * 2;
  const p = circuit.weights.straightLine * 3 + circuit.weights.powerUnit * 2;
  const m = circuit.weights.suspension * 4;
  return {
    frontWing: Math.round(clamp(25 + d * 55, 5, 95)),
    rearWing: Math.round(clamp(30 + d * 50 - p * 35, 5, 95)),
    suspension: Math.round(clamp(75 - m * 55 + (circuit.type === 'street' ? -10 : 0), 5, 95)),
    rideHeight: Math.round(clamp(30 + m * 40 + (circuit.type === 'street' ? 12 : 0), 5, 95)),
    gearing: Math.round(clamp(20 + p * 70, 5, 95)),
  };
}

export interface SetupPreset {
  id: string;
  label: string;
  description: string;
  setup: Setup;
}

/** Starting points for practice: the simulator baseline and variations on it. */
export function setupPresets(circuit: Circuit): SetupPreset[] {
  const b = simulatorBaseline(circuit);
  const adj = (patch: Partial<Record<keyof Setup, number>>): Setup => {
    const out = { ...b };
    for (const [k, v] of Object.entries(patch) as [keyof Setup, number][]) out[k] = Math.round(clamp(b[k] + v, 0, 100));
    return out;
  };
  return [
    { id: 'baseline', label: 'Simulator baseline', description: 'The track data from the simulator, before driver preference and conditions.', setup: b },
    { id: 'lowDrag', label: 'Low drag', description: 'Less wing and longer gears for the straights.', setup: adj({ frontWing: -8, rearWing: -15, gearing: 12 }) },
    { id: 'highDownforce', label: 'High downforce', description: 'More wing and shorter gears for the corners.', setup: adj({ frontWing: 10, rearWing: 15, gearing: -10 }) },
    { id: 'kerbs', label: 'Kerbs & bumps', description: 'Softer and higher, for street tracks and kerb-hopping.', setup: adj({ suspension: -15, rideHeight: 12 }) },
    { id: 'wet', label: 'Wet weather', description: 'More wing, softer, higher: grip over speed in the rain.', setup: adj({ frontWing: 10, rearWing: 12, suspension: -15, rideHeight: 12 }) },
  ];
}

export function setupQuality(setup: Setup, ideal: Setup): number {
  let err = 0;
  for (const k of SETUP_KEYS) err += Math.abs(setup[k] - ideal[k]) * SETUP_WEIGHT[k];
  return Math.round(clamp(100 - err * 0.6, 0, 100) * 10) / 10;
}

/** Probability that a driver's feedback on one setup area is correct. */
export function feedbackAccuracy(driver: Driver, engineerRating: number, simulatorLevel: number): number {
  return clamp(0.52 + driver.attributes.experience / 260 + engineerRating / 320 + simulatorLevel * 0.018, 0.5, 0.97);
}

export function setupFeedback(rng: Rng, setup: Setup, ideal: Setup, accuracy: number): PracticeRun['feedback'] {
  return SETUP_KEYS.map((key) => {
    const diff = setup[key] - ideal[key];
    const reliable = rng.chance(accuracy);
    if (reliable) {
      const abs = Math.abs(diff);
      const direction = abs <= 4 ? 0 : diff > 0 ? -1 : 1;
      const magnitude = abs <= 4 ? 'ok' : abs > 14 ? 'large' : 'small';
      return { key, direction: direction as -1 | 0 | 1, magnitude: magnitude as 'ok' | 'small' | 'large', reliable };
    }
    const direction = rng.pick([-1, 0, 1] as const);
    return { key, direction, magnitude: direction === 0 ? 'ok' : rng.pick(['small', 'large'] as const), reliable };
  });
}

/** How an engineer would adjust a setup given feedback (used by auto-practice). */
export function engineerAdjust(setup: Setup, feedback: PracticeRun['feedback'], engineerRating: number): Setup {
  const next = { ...setup };
  const precision = 0.75 + engineerRating / 400;
  for (const f of feedback) {
    if (f.direction === 0) continue;
    const step = (f.magnitude === 'large' ? 14 : 5) * precision;
    next[f.key] = Math.round(clamp(next[f.key] + f.direction * step, 0, 100));
  }
  return next;
}

/** Setup quality an AI engineering team typically reaches over a weekend. */
export function aiSetupQuality(rng: Rng, engineerRating: number, simulatorLevel: number, experience: number): number {
  return Math.round(clamp(54 + engineerRating * 0.28 + simulatorLevel * 2.2 + experience * 0.06 + rng.normal(0, 6), 30, 97));
}
