import { DIVISIONS } from '../config/divisions';
import { RACE_TUNING, TIRE_TUNING } from '../config/tuning';
import type { Rng } from '../rng';
import type { Circuit, DivisionId, StrategyPlan, TireCompound } from '../types';
import { compoundPaceOffset, expectedWear, idealCompoundForWetness, wearPenalty } from './tires';

export interface StrategyInputs {
  division: DivisionId;
  circuit: Circuit;
  laps: number;
  baseLap: number;
  tireManagement: number;
  carTireEfficiency: number;
  trackTemp: number;
  startWetness: number;
  /** 0..1 how accurately the team models tyre wear. */
  accuracy: number;
  /** Season-twist multiplier on wear (absent = 1). */
  wearMultiplier?: number;
}

interface Candidate {
  sequence: TireCompound[];
  stints: number[];
  time: number;
}

const COMPOUND_LABEL: Record<TireCompound, string> = { soft: 'S', medium: 'M', hard: 'H', intermediate: 'I', wet: 'W' };

function stintTime(c: TireCompound, laps: number, wearRate: number, scale: number): number {
  let t = 0;
  for (let i = 0; i < laps; i++) {
    t += compoundPaceOffset(c, 0, scale) + wearPenalty(c, wearRate * (i + 0.5), scale);
  }
  return t;
}

function sequences(compounds: TireCompound[], length: number): TireCompound[][] {
  if (length === 1) return compounds.map((c) => [c]);
  const out: TireCompound[][] = [];
  for (const seq of sequences(compounds, length - 1)) for (const c of compounds) out.push([...seq, c]);
  return out;
}

/** Pit-stop time loss (s) for the division at a circuit. */
export function pitLossFor(circuit: Circuit, baseLap: number): number {
  return circuit.pitLoss * Math.sqrt(baseLap / circuit.baseLapTime) + RACE_TUNING.stationaryBase + 0.6;
}

/**
 * Enumerate strategies (0-3 stops, every legal compound sequence), optimise
 * stint lengths by local search, and return the best options. Wear estimates
 * include the team's modelling error, so weaker strategists pick worse plans.
 */
export function planStrategies(inputs: StrategyInputs, rng: Rng | null, maxOptions = 4): StrategyPlan[] {
  const cfg = DIVISIONS[inputs.division];
  const scale = inputs.baseLap / RACE_TUNING.referenceLap;
  if (inputs.startWetness >= 0.22) {
    const start = idealCompoundForWetness(inputs.startWetness);
    return [{ startCompound: start, stops: [], label: `Wet start on ${start === 'wet' ? 'full wets' : 'intermediates'}, react to conditions` }];
  }
  const compounds = cfg.dryCompounds;
  const wear: Partial<Record<TireCompound, number>> = {};
  for (const c of compounds) {
    const err = rng ? 1 + rng.normal(0, 0.18 * (1 - inputs.accuracy)) : 1;
    wear[c] = expectedWear(c, inputs.division, inputs.circuit, inputs.tireManagement, inputs.carTireEfficiency, inputs.trackTemp, 0, inputs.wearMultiplier ?? 1) * Math.max(0.6, err);
  }
  const pitLoss = pitLossFor(inputs.circuit, inputs.baseLap);
  // Prefix sums of stint time per compound make every evaluation O(stints).
  const prefix: Partial<Record<TireCompound, number[]>> = {};
  for (const c of compounds) {
    const arr = [0];
    const rate = wear[c] ?? 2;
    for (let i = 0; i < inputs.laps; i++) arr.push(arr[i] + compoundPaceOffset(c, 0, scale) + wearPenalty(c, rate * (i + 0.5), scale));
    prefix[c] = arr;
  }
  const stint = (c: TireCompound, len: number): number => prefix[c]![Math.max(0, Math.min(len, inputs.laps))];
  const candidates: Candidate[] = [];
  for (let stops = 0; stops <= 3; stops++) {
    const n = stops + 1;
    if (n > inputs.laps / 6) break;
    for (const seq of sequences(compounds, n)) {
      if (cfg.mandatoryTwoCompounds && new Set(seq).size < 2 && compounds.length > 1) continue;
      // Initial allocation proportional to sustainable stint length.
      const maxLen = seq.map((c) => (TIRE_TUNING.compounds[c].cliff + 6) / (wear[c] ?? 2));
      const totalMax = maxLen.reduce((a, b) => a + b, 0);
      if (totalMax < inputs.laps * 0.92) continue;
      let stints = maxLen.map((m) => Math.max(3, Math.round((m / totalMax) * inputs.laps)));
      const fix = () => {
        const diff = inputs.laps - stints.reduce((a, b) => a + b, 0);
        stints[stints.length - 1] += diff;
      };
      fix();
      if (stints.some((s) => s < 2)) continue;
      const evalTime = (st: number[]) => st.reduce((t, len, i) => t + stint(seq[i], len), 0) + stops * pitLoss;
      let best = evalTime(stints);
      // Local search: shift laps between neighbouring stints.
      for (let iter = 0; iter < 40; iter++) {
        let improved = false;
        for (let i = 0; i < stints.length - 1; i++) {
          for (const delta of [-2, -1, 1, 2]) {
            const trial = [...stints];
            trial[i] += delta;
            trial[i + 1] -= delta;
            if (trial[i] < 2 || trial[i + 1] < 2) continue;
            const t = evalTime(trial);
            if (t < best - 1e-6) {
              best = t;
              stints = trial;
              improved = true;
            }
          }
        }
        if (!improved) break;
      }
      candidates.push({ sequence: seq, stints, time: best });
    }
  }
  if (candidates.length === 0) {
    // Fallback: ensure there is always a legal plan.
    const c = compounds.includes('hard') ? 'hard' : compounds[compounds.length - 1];
    const other = compounds.find((x) => x !== c) ?? c;
    const half = Math.floor(inputs.laps / 2);
    return [{ startCompound: other, stops: [{ lap: half, compound: c }], label: '1-stop (fallback)' }];
  }
  candidates.sort((a, b) => a.time - b.time);
  const seen = new Set<string>();
  const out: StrategyPlan[] = [];
  for (const cand of candidates) {
    const key = cand.sequence.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    let lap = 0;
    const stops = cand.stints.slice(0, -1).map((len, i) => {
      lap += len;
      return { lap, compound: cand.sequence[i + 1] };
    });
    const stopsLabel = stops.length === 0 ? 'No-stop' : `${stops.length}-stop`;
    out.push({
      startCompound: cand.sequence[0],
      stops,
      label: `${stopsLabel} ${cand.sequence.map((c) => COMPOUND_LABEL[c]).join('–')}${stops.length ? ` (lap ${stops.map((s) => s.lap).join(', ')})` : ''}`,
      predictedTime: Math.round(cand.time * 10) / 10,
    });
    if (out.length >= maxOptions) break;
  }
  return out;
}

/** Best compound to finish the race on from here, given remaining laps. */
export function compoundForRemaining(division: DivisionId, remaining: number, wearRates: Partial<Record<TireCompound, number>>, used: TireCompound[], scale: number): TireCompound {
  const cfg = DIVISIONS[division];
  const options = cfg.dryCompounds;
  const needsNew = cfg.mandatoryTwoCompounds && new Set(used.filter((c) => options.includes(c))).size < 2;
  let best: TireCompound = options[options.length - 1];
  let bestTime = Number.POSITIVE_INFINITY;
  for (const c of options) {
    if (needsNew && used.includes(c) && options.length > 1) continue;
    const rate = wearRates[c] ?? 2;
    if (rate * remaining > TIRE_TUNING.compounds[c].cliff + 8) continue;
    const t = stintTime(c, remaining, rate, scale);
    if (t < bestTime) {
      bestTime = t;
      best = c;
    }
  }
  if (bestTime === Number.POSITIVE_INFINITY) {
    // Nothing lasts: choose the most durable legal compound.
    const legal = options.filter((c) => !(needsNew && used.includes(c)));
    best = legal.includes('hard') ? 'hard' : legal[legal.length - 1] ?? options[0];
  }
  return best;
}
