/**
 * Tunable simulation parameters. Every constant that shapes race outcomes or
 * the economy lives here so balance can be adjusted in one place and the
 * automated long-run tests can verify the consequences.
 *
 * Lap-time constants are expressed for a 90 s reference lap and scaled linearly
 * to each circuit/division's real base lap time.
 */
export const RACE_TUNING = {
  referenceLap: 90,
  /** Seconds per lap per car-performance point (90 s lap). Car spread dominates. */
  carSecondsPerPoint: 0.046,
  /** Seconds per lap per driver-performance point (90 s lap). */
  driverSecondsPerPoint: 0.03,
  /** Reference performance level both indices are measured against. */
  referencePerf: 60,
  /** Lap noise (s): base + inconsistency component. */
  lapNoiseBase: 0.11,
  lapNoiseInconsistency: 0.32,
  /** Pace mode offsets (s, 90 s lap): negative is faster. */
  paceModeOffset: { conserve: 0.55, balanced: 0, push: -0.28, attack: -0.5 },
  paceModeWear: { conserve: 0.82, balanced: 1, push: 1.18, attack: 1.4 },
  paceModeMistake: { conserve: 0.6, balanced: 1, push: 1.45, attack: 2.2 },
  paceModeFailure: { conserve: 0.55, balanced: 1, push: 1.35, attack: 1.8 },
  paceModeFatigue: { conserve: 0.75, balanced: 1, push: 1.2, attack: 1.45 },
  tireModeWear: { preserve: 0.8, normal: 1, aggressive: 1.25 },
  tireModeOffset: { preserve: 0.22, normal: 0, aggressive: -0.18 },
  fuelModeOffset: { lean: 0.32, standard: 0, rich: -0.18 },
  fuelModeBurn: { lean: 0.9, standard: 1, rich: 1.07 },
  /** Fuel weight penalty (s per kg, 90 s lap). */
  fuelSecondsPerKg: 0.032,
  ersOffset: { harvest: 0.3, balanced: 0, deploy: -0.32, overtake: -0.5 },
  ersCharge: { harvest: 14, balanced: 3, deploy: -12, overtake: -26 },
  /** Dirty air: penalty (s) when following within this interval. */
  dirtyAirWindow: 1.3,
  dirtyAirPenalty: 0.32,
  dirtyAirWear: 0.12,
  /** Overtaking model. */
  overtakeAdvantageWeight: 3.4,
  overtakeSkillWeight: 1 / 22,
  overtakeDifficultyWeight: 3.6,
  overtakeBase: 0.6,
  drsBonus: 0.9,
  ersOvertakeBonus: 0.45,
  defendBonus: 0.35,
  heldUpGapMin: 0.25,
  heldUpGapMax: 0.65,
  battleTimeLoss: 0.12,
  collisionBase: 0.0045,
  /** Driver mistakes per lap at average consistency, dry. */
  mistakeBase: 0.0105,
  crashShare: 0.085,
  spinShare: 0.2,
  /** Pit stop. */
  stationaryBase: 2.6,
  stationaryCrewSkill: 1.6,
  slowStopChance: 0.045,
  /** Safety car. */
  scLapFactor: 1.45,
  vscLapFactor: 1.36,
  scPitLossFactor: 0.52,
  vscPitLossFactor: 0.62,
  scGapCompression: 0.55,
  scChanceCrash: 0.58,
  vscChanceCrash: 0.28,
  scChanceFailure: 0.1,
  vscChanceFailure: 0.32,
  /** Mechanical failure: share that gives a warning before failing. */
  failureWarningShare: 0.45,
  /** Start: sd of launch time delta (s). */
  startSd: 0.55,
  gridSlotGap: 0.24,
  firstLapCollisionChance: 0.012,
  jumpStartChance: 0.003,
  /** Setup quality to pace (fraction of lap time at 0 or 100 quality). */
  setupPaceRange: 0.0042,
  /** Track evolution over qualifying (fraction of lap). */
  qualiEvolution: 0.0045,
  qualiTrafficChance: 0.12,
  qualiMistakeChance: 0.06,
};

export const TIRE_TUNING = {
  compounds: {
    soft: { offset: -0.68, wear: 2.55, cliff: 70, label: 'Soft', color: '#ef4444' },
    medium: { offset: 0, wear: 1.7, cliff: 76, label: 'Medium', color: '#facc15' },
    hard: { offset: 0.55, wear: 1.12, cliff: 82, label: 'Hard', color: '#f5f5f5' },
    intermediate: { offset: 2.6, wear: 1.5, cliff: 80, label: 'Intermediate', color: '#22c55e' },
    wet: { offset: 4.6, wear: 1.3, cliff: 85, label: 'Wet', color: '#3b82f6' },
  },
  /** Seconds lost per % of wear below the cliff (90 s lap). */
  wearPace: 0.017,
  /** Additional seconds per % beyond the cliff. */
  cliffPace: 0.13,
  punctureWear: 92,
  /** Wear multiplier when wet tyres run on a drying track. */
  wetOnDryWear: 3.2,
};

export const ECONOMY_TUNING = {
  weeksPerSeason: 44,
  firstRaceWeek: 2,
  lastRaceWeek: 42,
  /** Driver salary expectation curve. */
  salaryBase: 8_000,
  salaryRate: 0.12,
  salaryEliteRate: 0.16,
  salaryEliteThreshold: 80,
  staffSalaryBase: 14_000,
  staffSalaryRate: 0.085,
  /** Facility upgrade cost curve. */
  facilityCostBase: 50_000,
  facilityCostGrowth: 2.15,
  facilityUpkeepBase: 6_000,
  facilityUpkeepGrowth: 2,
  /** R&D: cost as fraction of division typical budget, base gain, base weeks, capacity used. */
  rnd: {
    minor: { cost: 0.016, gain: 3.0, weeks: 4, capacity: 1, risk: 0.08 },
    major: { cost: 0.042, gain: 6.6, weeks: 8, capacity: 2, risk: 0.15 },
    radical: { cost: 0.09, gain: 12.5, weeks: 12, capacity: 3, risk: 0.28 },
  },
  /** Sponsor value as a share of typical budget for an average team. */
  sponsorShare: { title: 0.2, major: 0.1, minor: 0.035 },
  sponsorSlots: { title: 1, major: 2, minor: 3 },
  /** Overdraft interest per week on negative balance. */
  overdraftInterest: 0.004,
};
