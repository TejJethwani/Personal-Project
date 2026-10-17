import { DIVISIONS } from '../config/divisions';
import { RACE_TUNING, TIRE_TUNING } from '../config/tuning';
import type { Circuit, DivisionId, PaceMode, TireCompound, TireMode } from '../types';
import { clamp } from '../util';

export const DRY_COMPOUNDS: TireCompound[] = ['soft', 'medium', 'hard'];
export const isWetCompound = (c: TireCompound): boolean => c === 'intermediate' || c === 'wet';

export function compoundInfo(c: TireCompound) {
  return TIRE_TUNING.compounds[c];
}

/**
 * Pace penalty (s, 90 s lap) of a compound for a given track wetness 0..1.
 * Slicks lose heavily once the track is damp; intermediates are best in the
 * middle; full wets only shine in standing water.
 */
export function wetnessPenalty(c: TireCompound, wetness: number): number {
  const w = clamp(wetness, 0, 1);
  if (!isWetCompound(c)) return w <= 0.1 ? 0 : 15 * (w - 0.1) ** 1.05 + (w > 0.5 ? (w - 0.5) * 10 : 0);
  if (c === 'intermediate') {
    // Base dry offset is included in the compound offset; recover it as it gets wet.
    const recovery = TIRE_TUNING.compounds.intermediate.offset * clamp(w / 0.42, 0, 1);
    const tooWet = w > 0.72 ? (w - 0.72) * 9 : 0;
    return -recovery + tooWet;
  }
  const recovery = TIRE_TUNING.compounds.wet.offset * clamp(w / 0.78, 0, 1);
  return -recovery;
}

/** Best compound for the current wetness among the allowed list. */
export function idealCompoundForWetness(wetness: number, dryChoice: TireCompound = 'medium'): TireCompound {
  if (wetness >= 0.76) return 'wet';
  if (wetness >= 0.22) return 'intermediate';
  return dryChoice;
}

export function compoundPaceOffset(c: TireCompound, wetness: number, scale: number): number {
  return (TIRE_TUNING.compounds[c].offset + wetnessPenalty(c, wetness)) * scale;
}

/** Pace lost (s) due to wear, including the cliff. */
export function wearPenalty(c: TireCompound, wear: number, scale: number): number {
  const cliff = TIRE_TUNING.compounds[c].cliff;
  const base = Math.min(wear, cliff) * TIRE_TUNING.wearPace;
  const over = Math.max(0, wear - cliff);
  return (base + over * TIRE_TUNING.cliffPace + over * over * 0.004) * scale;
}

export interface WearContext {
  division: DivisionId;
  circuit: Circuit;
  tireManagement: number;
  carTireEfficiency: number;
  trackTemp: number;
  wetness: number;
  pace: PaceMode;
  tireMode: TireMode;
  dirtyAir: boolean;
  /** Season-twist multiplier on wear (absent = 1). */
  wearMultiplier?: number;
}

/** Wear (% of tyre life) per lap. */
export function wearPerLap(c: TireCompound, ctx: WearContext): number {
  const comp = TIRE_TUNING.compounds[c];
  const divFactor = DIVISIONS[ctx.division].tireDegFactor;
  const driver = 1.16 - ctx.tireManagement * 0.0042; // 0.74 .. 1.15
  const car = 1.12 - ctx.carTireEfficiency * 0.0028; // 0.84 .. 1.1
  const temp = 1 + clamp((ctx.trackTemp - 30) / 40, -0.25, 0.4);
  let wet = 1;
  if (isWetCompound(c)) {
    // Wet tyres overheat and shred on a dry track.
    const dryness = c === 'wet' ? clamp(0.6 - ctx.wetness, 0, 0.6) / 0.6 : clamp(0.25 - ctx.wetness, 0, 0.25) / 0.25;
    wet = 1 + dryness * (TIRE_TUNING.wetOnDryWear - 1);
  } else if (ctx.wetness > 0.15) {
    wet = 0.75; // slicks on a damp track are slow but don't wear
  }
  const t = RACE_TUNING;
  return (
    comp.wear *
    divFactor *
    ctx.circuit.tireStress *
    driver *
    car *
    temp *
    wet *
    t.paceModeWear[ctx.pace] *
    t.tireModeWear[ctx.tireMode] *
    (ctx.dirtyAir ? 1 + t.dirtyAirWear : 1) *
    (ctx.wearMultiplier ?? 1)
  );
}

/** Expected wear per lap used by strategists (normal modes, clean air). */
export function expectedWear(c: TireCompound, division: DivisionId, circuit: Circuit, tireManagement: number, carTireEfficiency: number, trackTemp: number, wetness = 0, wearMultiplier = 1): number {
  return wearPerLap(c, { division, circuit, tireManagement, carTireEfficiency, trackTemp, wetness, pace: 'balanced', tireMode: 'normal', dirtyAir: false, wearMultiplier });
}

export function allowedCompounds(division: DivisionId): TireCompound[] {
  return [...DIVISIONS[division].dryCompounds, 'intermediate', 'wet'];
}
