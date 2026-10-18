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
  paceModeOffset: { conserve: 0.38, balanced: 0, push: -0.18, attack: -0.32 },
  paceModeWear: { conserve: 0.82, balanced: 1, push: 1.18, attack: 1.4 },
  paceModeMistake: { conserve: 0.6, balanced: 1, push: 1.45, attack: 2.2 },
  paceModeFailure: { conserve: 0.55, balanced: 1, push: 1.35, attack: 1.8 },
  paceModeFatigue: { conserve: 0.75, balanced: 1, push: 1.2, attack: 1.45 },
  tireModeWear: { preserve: 0.8, normal: 1, aggressive: 1.25 },
  tireModeOffset: { preserve: 0.15, normal: 0, aggressive: -0.12 },
  fuelModeOffset: { lean: 0.25, standard: 0, rich: -0.1 },
  fuelModeBurn: { lean: 0.9, standard: 1, rich: 1.07 },
  /** Fuel weight penalty (s per kg, 90 s lap). */
  fuelSecondsPerKg: 0.032,
  ersOffset: { harvest: 0.25, balanced: 0, deploy: -0.2, overtake: -0.32 },
  ersCharge: { harvest: 14, balanced: 3, deploy: -12, overtake: -26 },
  /** Dirty air: penalty (s) when following within this interval. */
  dirtyAirWindow: 1.3,
  dirtyAirPenalty: 0.32,
  dirtyAirWear: 0.12,
  /** Overtaking model. */
  overtakeAdvantageWeight: 2.2,
  /** Weight of the attacker's underlying (noise-free) pace advantage, s per lap at a 90 s lap. */
  overtakePaceWeight: 2.5,
  /** Logit penalty for re-passing a car that passed you in the last two laps. */
  repassPenalty: 1.4,
  overtakeSkillWeight: 1 / 22,
  overtakeDifficultyWeight: 3.6,
  overtakeBase: -0.8,
  drsBonus: 0.8,
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
  scChanceCrash: 0.45,
  vscChanceCrash: 0.38,
  scChanceFailure: 0.1,
  vscChanceFailure: 0.32,
  /** Mechanical failure: share that gives a warning before failing. */
  failureWarningShare: 0.45,
  /** Start: sd of launch time delta (s). */
  startSd: 0.7,
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
  /** Staff salary for a typical-rated member of each series (role weight 1). */
  staffSalaryScale: { F5: 26_000, F4: 48_000, F3: 90_000, F2: 160_000, F1: 600_000 },
  /** Relative pay by role. */
  staffRoleWeight: {
    technicalDirector: 1.6,
    raceEngineer: 1.0,
    headStrategist: 1.0,
    chiefMechanic: 0.85,
    driverCoach: 0.6,
    headScout: 0.55,
    academyDirector: 0.65,
  },
  /** Salary growth per rating point above the series' typical staff rating. */
  staffSalaryRate: 0.04,
  /** Facility upgrade cost curve. */
  facilityCostBase: 50_000,
  facilityCostGrowth: 2.15,
  facilityUpkeepBase: 6_000,
  facilityUpkeepGrowth: 2,
  /**
   * R&D packages: cost as a fraction of the division's typical budget, base
   * gain (rating points before team efficiency and diminishing returns), base
   * weeks, engineering capacity used, base risk, and development load (how much
   * it counts towards this season's diminishing returns on the component).
   */
  rnd: {
    quick: { cost: 0.005, gain: 2, weeks: 2, capacity: 1, risk: 0.05, load: 0.5 },
    minor: { cost: 0.01, gain: 4, weeks: 4, capacity: 1, risk: 0.08, load: 1 },
    major: { cost: 0.022, gain: 7, weeks: 7, capacity: 1, risk: 0.14, load: 1.8 },
    radical: { cost: 0.04, gain: 10, weeks: 10, capacity: 2, risk: 0.24, load: 3 },
  },
  /** Approach: multipliers on gain, risk, cost and breakthrough chance. */
  rndApproach: {
    safe: { gain: 0.85, risk: 0.5, cost: 1, breakthrough: 0.6 },
    balanced: { gain: 1, risk: 1, cost: 1, breakthrough: 1 },
    ambitious: { gain: 1.25, risk: 1.8, cost: 1.15, breakthrough: 1.6 },
  },
  /** Timeline: multipliers on weeks, cost and risk. */
  rndTimeline: {
    normal: { weeks: 1, cost: 1, risk: 1 },
    rush: { weeks: 0.6, cost: 1.4, risk: 1.3 },
  },
  /**
   * Car development boost (rating points added to every component) at season
   * end by championship position: the top teams are rewarded, the bottom
   * teams get catch-up help, the middle gets the least.
   */
  finishDevelopmentBoost: [2.0, 1.6, 1.2, 0.8, 0.5, 0.5, 0.8, 1.1, 1.4, 1.8],
  /** European leagues: the top of the table earns the most, little catch-up below. */
  euroDevelopmentBoost: [1.8, 1.6, 1.45, 1.3, 1.15, 1.0, 0.9, 0.85, 0.85, 0.9],
  /** Sponsor value as a share of typical budget for an average team. */
  sponsorShare: { title: 0.2, major: 0.1, minor: 0.035 },
  sponsorSlots: { title: 1, major: 2, minor: 3 },
  /** Overdraft interest per week on negative balance. */
  overdraftInterest: 0.004,
};
