import type { DivisionId, FacilityKey, TireCompound } from '../types';
import { DIVISION_ORDER } from '../types';

export interface PointsSystem {
  id: string;
  label: string;
  positions: number[];
  pole: number;
  fastestLap: number;
  /** Fastest-lap point only awarded when the driver finishes inside this position. */
  fastestLapTopN: number;
}

export const POINTS_PRESETS: Record<string, PointsSystem> = {
  club: { id: 'club', label: 'Club (10-8-6-5-4-3-2-1)', positions: [10, 8, 6, 5, 4, 3, 2, 1], pole: 1, fastestLap: 1, fastestLapTopN: 8 },
  junior: { id: 'junior', label: 'Junior (15-12-10-8-6-5-4-3-2-1)', positions: [15, 12, 10, 8, 6, 5, 4, 3, 2, 1], pole: 1, fastestLap: 1, fastestLapTopN: 10 },
  feeder: { id: 'feeder', label: 'Feeder (25-18-15… +2 pole, +1 FL)', positions: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], pole: 2, fastestLap: 1, fastestLapTopN: 10 },
  modern: { id: 'modern', label: 'Modern (25-18-15-12-10-8-6-4-2-1)', positions: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], pole: 0, fastestLap: 0, fastestLapTopN: 10 },
  modernFL: { id: 'modernFL', label: 'Modern + fastest lap (+1)', positions: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], pole: 0, fastestLap: 1, fastestLapTopN: 10 },
  classic: { id: 'classic', label: 'Classic (10-6-4-3-2-1)', positions: [10, 6, 4, 3, 2, 1], pole: 0, fastestLap: 0, fastestLapTopN: 6 },
  extended: { id: 'extended', label: 'Extended top 15 (30-25-21…)', positions: [30, 25, 21, 18, 16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1], pole: 0, fastestLap: 0, fastestLapTopN: 15 },
};

export interface LicensingRequirements {
  minCash: number;
  facilities: Partial<Record<FacilityKey, number>>;
  fullStaff: boolean;
  minReputation: number;
}

export interface DivisionConfig {
  id: DivisionId;
  tier: number;
  name: string;
  tagline: string;
  status: string;
  races: number;
  teams: number;
  /** Fraction of a circuit's Formula 1 lap count used for races. */
  lapsFactor: number;
  minLaps: number;
  maxLaps: number;
  /** Multiplier on F1 reference lap time (slower cars lower down). */
  lapTimeFactor: number;
  /** Typical annual operating budget of a midfield team. All money scales from this. */
  typicalBudget: number;
  entryFee: number;
  raceOperationsCost: number;
  /** Constructor-championship prize money by finishing position. */
  prizeMoney: number[];
  /** Per-race prize money by finishing position (paid to the team). */
  racePrize: number[];
  promotionBonus: number;
  /** Salary multiplier for drivers and staff employed in this division. */
  salaryFactor: number;
  rndCostScale: number;
  repairCostScale: number;
  /** Baseline per-lap mechanical failure probability for an average (50) reliability car. */
  failureRate: number;
  qualifyingSessions: 1 | 2 | 3;
  /** Number of cars eliminated after each knockout session. */
  knockoutEliminations: number[];
  dryCompounds: TireCompound[];
  mandatoryTwoCompounds: boolean;
  drs: boolean;
  /**
   * Added to the overtaking logit. Simple junior cars follow closely; Formula 1
   * cars lose downforce in dirty air and need a bigger pace advantage to pass.
   */
  overtakeModifier: number;
  ers: boolean;
  fuelManagement: boolean;
  practiceRuns: number;
  defaultPoints: string;
  tireDegFactor: number;
  fuelBurnPerLap: number;
  /** Reputation range for generated teams. */
  reputationRange: [number, number];
  /** Driver overall rating mean for race seats. */
  driverRatingMean: number;
  driverRatingSd: number;
  staffRatingMean: number;
  facilityRange: [number, number];
  carSpread: number;
  /** Requirements a team must meet to be promoted INTO this division. */
  licensing: LicensingRequirements;
  promotionSlots: number;
  relegationSlots: number;
  /** Typical reputation for this division's teams (used to scale attractiveness). */
  typicalReputation: number;
  academyCostPerDriver: number;
  scoutingCostPerWeek: number;
}

const prizeTable = (budget: number): number[] =>
  [0.42, 0.36, 0.31, 0.27, 0.24, 0.21, 0.18, 0.15, 0.12, 0.1, 0.09, 0.08].map((f) => Math.round(f * budget));

const racePrizeTable = (budget: number, races: number): number[] =>
  [0.012, 0.0085, 0.0065, 0.005, 0.004, 0.003, 0.0024, 0.0018, 0.0012, 0.0008].map((f) => Math.round((f * budget * 8) / races));

const B = { F5: 1_200_000, F4: 3_000_000, F3: 7_500_000, F2: 18_000_000, F1: 150_000_000 } as const;

export const DIVISIONS: Record<DivisionId, DivisionConfig> = {
  F5: {
    id: 'F5',
    tier: 0,
    name: 'Formula 5',
    tagline: 'Amateur entry championship',
    status: 'Amateur / Entry',
    races: 8,
    teams: 10,
    lapsFactor: 0.33,
    minLaps: 16,
    maxLaps: 24,
    lapTimeFactor: 1.3,
    typicalBudget: B.F5,
    entryFee: Math.round(B.F5 * 0.03),
    raceOperationsCost: Math.round((B.F5 * 0.13) / 8),
    prizeMoney: prizeTable(B.F5),
    racePrize: racePrizeTable(B.F5, 8),
    promotionBonus: 0,
    salaryFactor: 0.7,
    rndCostScale: B.F5,
    repairCostScale: B.F5 * 0.012,
    failureRate: 0.0026,
    qualifyingSessions: 1,
    knockoutEliminations: [],
    dryCompounds: ['medium'],
    mandatoryTwoCompounds: false,
    drs: false,
    overtakeModifier: 0.2,
    ers: false,
    fuelManagement: false,
    practiceRuns: 4,
    defaultPoints: 'club',
    tireDegFactor: 1.3,
    fuelBurnPerLap: 0.9,
    reputationRange: [4, 22],
    driverRatingMean: 47,
    driverRatingSd: 6,
    staffRatingMean: 36,
    facilityRange: [1, 2],
    carSpread: 3.5,
    licensing: { minCash: 0, facilities: {}, fullStaff: false, minReputation: 0 },
    promotionSlots: 2,
    relegationSlots: 0,
    typicalReputation: 12,
    academyCostPerDriver: 12_000,
    scoutingCostPerWeek: 1_500,
  },
  F4: {
    id: 'F4',
    tier: 1,
    name: 'Formula 4',
    tagline: 'Junior development series',
    status: 'Junior Development',
    races: 10,
    teams: 10,
    lapsFactor: 0.38,
    minLaps: 18,
    maxLaps: 28,
    lapTimeFactor: 1.22,
    typicalBudget: B.F4,
    entryFee: Math.round(B.F4 * 0.03),
    raceOperationsCost: Math.round((B.F4 * 0.13) / 10),
    prizeMoney: prizeTable(B.F4),
    racePrize: racePrizeTable(B.F4, 10),
    promotionBonus: Math.round(B.F4 * 0.15),
    salaryFactor: 0.85,
    rndCostScale: B.F4,
    repairCostScale: B.F4 * 0.01,
    failureRate: 0.0021,
    qualifyingSessions: 1,
    knockoutEliminations: [],
    dryCompounds: ['soft', 'hard'],
    mandatoryTwoCompounds: false,
    drs: false,
    overtakeModifier: -0.3,
    ers: false,
    fuelManagement: false,
    practiceRuns: 5,
    defaultPoints: 'junior',
    tireDegFactor: 1.3,
    fuelBurnPerLap: 1.0,
    reputationRange: [14, 34],
    driverRatingMean: 54,
    driverRatingSd: 6,
    staffRatingMean: 44,
    facilityRange: [2, 3],
    carSpread: 4,
    licensing: { minCash: 150_000, facilities: { engineering: 2 }, fullStaff: false, minReputation: 8 },
    promotionSlots: 2,
    relegationSlots: 2,
    typicalReputation: 24,
    academyCostPerDriver: 15_000,
    scoutingCostPerWeek: 3_000,
  },
  F3: {
    id: 'F3',
    tier: 2,
    name: 'Formula 3',
    tagline: 'Professional development championship',
    status: 'Professional Development',
    races: 12,
    teams: 10,
    lapsFactor: 0.42,
    minLaps: 20,
    maxLaps: 30,
    lapTimeFactor: 1.15,
    typicalBudget: B.F3,
    entryFee: Math.round(B.F3 * 0.03),
    raceOperationsCost: Math.round((B.F3 * 0.13) / 12),
    prizeMoney: prizeTable(B.F3),
    racePrize: racePrizeTable(B.F3, 12),
    promotionBonus: Math.round(B.F3 * 0.15),
    salaryFactor: 1.0,
    rndCostScale: B.F3,
    repairCostScale: B.F3 * 0.008,
    failureRate: 0.0017,
    qualifyingSessions: 1,
    knockoutEliminations: [],
    dryCompounds: ['soft', 'medium', 'hard'],
    mandatoryTwoCompounds: false,
    drs: true,
    overtakeModifier: -0.1,
    ers: false,
    fuelManagement: false,
    practiceRuns: 5,
    defaultPoints: 'feeder',
    tireDegFactor: 1.25,
    fuelBurnPerLap: 1.15,
    reputationRange: [24, 46],
    driverRatingMean: 60,
    driverRatingSd: 6,
    staffRatingMean: 52,
    facilityRange: [3, 4],
    carSpread: 4.5,
    licensing: { minCash: 400_000, facilities: { engineering: 3, manufacturing: 2 }, fullStaff: false, minReputation: 16 },
    promotionSlots: 2,
    relegationSlots: 2,
    typicalReputation: 35,
    academyCostPerDriver: 20_000,
    scoutingCostPerWeek: 6_000,
  },
  F2: {
    id: 'F2',
    tier: 3,
    name: 'Formula 2',
    tagline: 'Elite junior championship',
    status: 'Elite Junior Championship',
    races: 14,
    teams: 10,
    lapsFactor: 0.52,
    minLaps: 26,
    maxLaps: 38,
    lapTimeFactor: 1.08,
    typicalBudget: B.F2,
    entryFee: Math.round(B.F2 * 0.03),
    raceOperationsCost: Math.round((B.F2 * 0.13) / 14),
    prizeMoney: prizeTable(B.F2),
    racePrize: racePrizeTable(B.F2, 14),
    promotionBonus: Math.round(B.F2 * 0.15),
    salaryFactor: 1.3,
    rndCostScale: B.F2 * 0.85,
    repairCostScale: B.F2 * 0.006,
    failureRate: 0.0013,
    qualifyingSessions: 2,
    knockoutEliminations: [10],
    dryCompounds: ['soft', 'medium', 'hard'],
    mandatoryTwoCompounds: true,
    drs: true,
    overtakeModifier: 0,
    ers: false,
    fuelManagement: true,
    practiceRuns: 6,
    defaultPoints: 'feeder',
    tireDegFactor: 1.3,
    fuelBurnPerLap: 1.35,
    reputationRange: [36, 62],
    driverRatingMean: 66,
    driverRatingSd: 5.5,
    staffRatingMean: 60,
    facilityRange: [4, 6],
    carSpread: 5,
    licensing: { minCash: 1_000_000, facilities: { engineering: 4, manufacturing: 3, strategy: 2 }, fullStaff: true, minReputation: 26 },
    promotionSlots: 2,
    relegationSlots: 2,
    typicalReputation: 48,
    academyCostPerDriver: 30_000,
    scoutingCostPerWeek: 12_000,
  },
  F1: {
    id: 'F1',
    tier: 4,
    name: 'Formula 1',
    tagline: 'The World Championship',
    status: 'World Championship',
    races: 22,
    teams: 10,
    lapsFactor: 1,
    minLaps: 44,
    maxLaps: 78,
    lapTimeFactor: 1,
    typicalBudget: B.F1,
    entryFee: Math.round(B.F1 * 0.03),
    raceOperationsCost: Math.round((B.F1 * 0.13) / 22),
    prizeMoney: prizeTable(B.F1),
    racePrize: racePrizeTable(B.F1, 22),
    promotionBonus: Math.round(B.F1 * 0.15),
    salaryFactor: 3.0,
    rndCostScale: B.F1 * 0.65,
    repairCostScale: B.F1 * 0.003,
    failureRate: 0.0008,
    qualifyingSessions: 3,
    knockoutEliminations: [5, 5],
    dryCompounds: ['soft', 'medium', 'hard'],
    mandatoryTwoCompounds: true,
    drs: true,
    overtakeModifier: -1.1,
    ers: true,
    fuelManagement: true,
    practiceRuns: 8,
    defaultPoints: 'modernFL',
    tireDegFactor: 1,
    fuelBurnPerLap: 1.6,
    reputationRange: [55, 96],
    driverRatingMean: 76,
    driverRatingSd: 5.5,
    staffRatingMean: 72,
    facilityRange: [6, 9],
    carSpread: 4.8,
    licensing: { minCash: 3_000_000, facilities: { engineering: 5, manufacturing: 4, aeroCenter: 4, simulator: 3 }, fullStaff: true, minReputation: 36 },
    promotionSlots: 0,
    relegationSlots: 2,
    typicalReputation: 72,
    academyCostPerDriver: 60_000,
    scoutingCostPerWeek: 30_000,
  },
};

export const divisionTier = (d: DivisionId): number => DIVISIONS[d].tier;
export const divisionAbove = (d: DivisionId): DivisionId | null => DIVISION_ORDER[DIVISIONS[d].tier + 1] ?? null;
export const divisionBelow = (d: DivisionId): DivisionId | null => (DIVISIONS[d].tier > 0 ? DIVISION_ORDER[DIVISIONS[d].tier - 1] : null);
export const divisionByTier = (tier: number): DivisionId => DIVISION_ORDER[Math.max(0, Math.min(4, tier))];

export function raceLapsFor(division: DivisionId, circuitLaps: number): number {
  const cfg = DIVISIONS[division];
  return Math.max(cfg.minLaps, Math.min(cfg.maxLaps, Math.round(circuitLaps * cfg.lapsFactor)));
}

export function pointsSystemFor(preset: string): PointsSystem {
  return POINTS_PRESETS[preset] ?? POINTS_PRESETS.modern;
}
