/**
 * Core data model for PROJECT APEX.
 *
 * The whole game lives in a single serialisable `GameState` object. The engine
 * mutates it through validated actions; the UI only reads from it. Nothing in
 * here may hold functions, class instances, Maps or Sets so that the state can
 * be cloned, saved to IndexedDB and exported as JSON without conversion.
 */

export type DivisionId = 'F5' | 'F4' | 'F3' | 'F2' | 'F1';
export const DIVISION_ORDER: DivisionId[] = ['F5', 'F4', 'F3', 'F2', 'F1'];

export type Difficulty = 'casual' | 'standard' | 'realistic' | 'hardcore';
export type Philosophy = 'youth' | 'engineering' | 'financial' | 'aggressive' | 'balanced';
export type FinancialStart = 'shoestring' | 'modest' | 'backed';
export type AIPersonality = 'conservative' | 'recruiter' | 'engineering' | 'youth' | 'gambler' | 'obsessive';
export type LiveryPattern = 'solid' | 'stripe' | 'split' | 'arrow' | 'halo' | 'fade';

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export interface DriverAttributes {
  pace: number;
  qualifying: number;
  racecraft: number;
  consistency: number;
  tireManagement: number;
  wetWeather: number;
  braking: number;
  adaptability: number;
  aggression: number;
  experience: number;
  mentality: number;
  fitness: number;
}
export type AttributeKey = keyof DriverAttributes;

export type Archetype =
  | 'generational'
  | 'qualifier'
  | 'tireWhisperer'
  | 'wetMaster'
  | 'veteranLeader'
  | 'overtaker'
  | 'inconsistentProdigy'
  | 'allRounder'
  | 'payDriver'
  | 'journeyman';

export type Personality =
  | 'loyal'
  | 'mercenary'
  | 'ambitious'
  | 'teamPlayer'
  | 'hotHeaded'
  | 'calm'
  | 'mediaDarling'
  | 'perfectionist';

export type DriverRole = 'race' | 'reserve' | 'academy';
export type DriverStatus = 'number1' | 'equal' | 'number2';

export interface Contract {
  id: string;
  teamId: string;
  role: DriverRole;
  /** Salary per season. */
  salary: number;
  /** First season the contract is active. */
  startSeason: number;
  /** Last season covered (inclusive). */
  endSeason: number;
  signingBonus: number;
  winBonus: number;
  podiumBonus: number;
  status: DriverStatus;
  /** Fee another team must pay to buy the driver out. 0 = not for sale. */
  releaseClause: number;
  signedSeason: number;
  signedWeek: number;
}

export type TrainingIntensity = 'light' | 'normal' | 'intense';
export type TrainingFocus = 'balanced' | 'speed' | 'racecraft' | 'tires' | 'wet' | 'physical' | 'mental';

export interface DriverSeasonRecord {
  season: number;
  year: number;
  division: DivisionId;
  teamId: string | null;
  position: number | null;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  starts: number;
  dnfs: number;
  fastestLaps: number;
  overall: number;
  champion: boolean;
}

export interface DriverCareer {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  dnfs: number;
  lapsLed: number;
  championships: Partial<Record<DivisionId, number>>;
  seasons: DriverSeasonRecord[];
  bestFinish: number | null;
}

export interface InjuryRecord {
  season: number;
  week: number;
  description: string;
  weeksOut: number;
}

export interface DisciplineRecord {
  season: number;
  round: number;
  division: DivisionId;
  description: string;
  penaltyPoints: number;
}

export interface TransferRecord {
  season: number;
  week: number;
  fromTeamId: string | null;
  toTeamId: string | null;
  fee: number;
  type: 'signing' | 'release' | 'buyout' | 'extension' | 'academy' | 'promotion' | 'retirement' | 'expiry';
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  attributes: DriverAttributes;
  /** Ceiling for the overall rating (hidden from the player unless scouted). */
  potential: number;
  archetype: Archetype;
  personality: Personality;
  morale: number;
  /** Short-term form/confidence 0-100. */
  confidence: number;
  contract: Contract | null;
  /** Signed contract that begins next season (pre-contract agreement). */
  futureContract: Contract | null;
  /** Personal sponsorship the driver brings to a team per season. */
  backing: number;
  training: { intensity: TrainingIntensity; focus: TrainingFocus };
  injury: { weeksRemaining: number; description: string } | null;
  penaltyPoints: number;
  raceBan: number;
  pendingGridPenalty: number;
  career: DriverCareer;
  injuries: InjuryRecord[];
  discipline: DisciplineRecord[];
  transfers: TransferRecord[];
  ratingHistory: { season: number; overall: number }[];
  /** Overall rating at the start of the current season, used for development deltas. */
  seasonStartOverall: number;
  /** Recent finishing positions in their division (latest last). */
  form: number[];
  retired: boolean;
  retiredSeason: number | null;
  /** Season this driver first appeared in the world. */
  debutSeason: number;
  /** Drives for a guest team (European League mode); not part of the driver market. */
  guest?: boolean;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export type StaffRole =
  | 'technicalDirector'
  | 'raceEngineer'
  | 'headStrategist'
  | 'chiefMechanic'
  | 'driverCoach'
  | 'headScout'
  | 'academyDirector';

export interface StaffContract {
  teamId: string;
  salary: number;
  startSeason: number;
  endSeason: number;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  role: StaffRole;
  rating: number;
  experience: number;
  specialization: string;
  contract: StaffContract | null;
  history: { season: number; teamId: string; division: DivisionId }[];
  retired: boolean;
}

// ---------------------------------------------------------------------------
// Car
// ---------------------------------------------------------------------------

export type ComponentKey =
  | 'aerodynamics'
  | 'chassis'
  | 'powerUnit'
  | 'braking'
  | 'suspension'
  | 'cooling'
  | 'reliability'
  | 'tireEfficiency'
  | 'straightLine'
  | 'cornering';

export interface Car {
  /** Component performance ratings 1-100, relative to the division's regulations. */
  components: Record<ComponentKey, number>;
  /** Upgrades completed this season per component (drives diminishing returns). */
  developmentLevel: Record<ComponentKey, number>;
}

export type RnDScale = 'quick' | 'minor' | 'major' | 'radical';
/** How hard the engineers push the concept: safer gains or a bigger, riskier step. */
export type RnDApproach = 'safe' | 'balanced' | 'ambitious';
/** Normal build or a rushed one (faster, dearer, riskier). */
export type RnDTimeline = 'normal' | 'rush';
export interface RnDOptions {
  approach: RnDApproach;
  timeline: RnDTimeline;
}
export type RnDPhase = 'design' | 'manufacture' | 'testing';

export interface RnDProject {
  id: string;
  component: ComponentKey;
  scale: RnDScale;
  cost: number;
  weeksTotal: number;
  weeksElapsed: number;
  /** Extra weeks added by delays. */
  delayWeeks: number;
  expectedGain: number;
  capacity: number;
  startedSeason: number;
  startedWeek: number;
  /** Absent in older saves (balanced, normal). */
  approach?: RnDApproach;
  timeline?: RnDTimeline;
}

export type RnDOutcome = 'success' | 'underwhelming' | 'breakthrough' | 'reliabilityCompromise';

export interface RnDCompletion {
  id: string;
  component: ComponentKey;
  scale: RnDScale;
  outcome: RnDOutcome;
  gain: number;
  reliabilityLoss: number;
  season: number;
  week: number;
  cost: number;
}

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

export type FacilityKey =
  | 'aeroCenter'
  | 'simulator'
  | 'trainingAcademy'
  | 'engineering'
  | 'manufacturing'
  | 'fitness'
  | 'scouting'
  | 'strategy';

export interface FacilityState {
  level: number;
  upgrade: { targetLevel: number; weeksRemaining: number; cost: number } | null;
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export type TxCategory =
  | 'prize'
  | 'raceBonus'
  | 'sponsor'
  | 'driverFunding'
  | 'investor'
  | 'promotion'
  | 'transferIncome'
  | 'driverSalary'
  | 'staffSalary'
  | 'development'
  | 'facilities'
  | 'operations'
  | 'buyout'
  | 'repairs'
  | 'entry'
  | 'signingBonus'
  | 'severance'
  | 'scouting'
  | 'academy'
  | 'interest'
  | 'other';

export interface Transaction {
  season: number;
  week: number;
  category: TxCategory;
  amount: number;
  label: string;
}

export interface SeasonFinanceSummary {
  season: number;
  division: DivisionId;
  revenue: number;
  expenses: number;
  profit: number;
  endCash: number;
  byCategory: Partial<Record<TxCategory, number>>;
}

export type SponsorTier = 'title' | 'major' | 'minor';
export type SponsorRisk = 'safe' | 'standard' | 'highRisk';
export type SponsorExpectationType = 'constructorPosition' | 'avgPoints' | 'podiums' | 'wins' | 'pointsFinishes';

export interface SponsorExpectation {
  type: SponsorExpectationType;
  target: number;
}

export interface SponsorOffer {
  id: string;
  name: string;
  industry: string;
  tier: SponsorTier;
  risk: SponsorRisk;
  perRace: number;
  signingBonus: number;
  winBonus: number;
  podiumBonus: number;
  pointsBonus: number;
  /** Paid at season end if the team finishes at or above the position. */
  championshipBonus: { position: number; amount: number } | null;
  seasons: number;
  expectation: SponsorExpectation;
  /** Absolute week after which the offer is withdrawn. */
  expiresAbsWeek: number;
  /** Remaining negotiation patience. */
  patience: number;
  /** Hidden ceiling for total per-season value the sponsor will accept. */
  maxValue: number;
}

export interface SponsorDeal extends Omit<SponsorOffer, 'expiresAbsWeek' | 'patience' | 'maxValue'> {
  startSeason: number;
  endSeason: number;
  satisfaction: number;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TeamSeasonRecord {
  season: number;
  year: number;
  division: DivisionId;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  reputation: number;
  endCash: number;
  champion: boolean;
  promoted: boolean;
  relegated: boolean;
  drivers: string[];
}

export interface TeamStats {
  races: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  constructorTitles: number;
  driverTitles: number;
  constructorTitlesByDivision: Partial<Record<DivisionId, number>>;
  promotions: number;
  relegations: number;
}

export interface BoardObjective {
  id: string;
  description: string;
  type: 'constructorPosition' | 'promotion' | 'wins' | 'podiums' | 'profit' | 'cashAbove' | 'avoidRelegation' | 'championship';
  target: number;
  importance: 'critical' | 'major' | 'minor';
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  nationality: string;
  colors: { primary: string; secondary: string };
  livery: LiveryPattern;
  principal: string;
  isPlayer: boolean;
  aiPersonality: AIPersonality | null;
  division: DivisionId;
  reputation: number;
  cash: number;
  car: Car;
  raceDrivers: [string | null, string | null];
  reserveDriverId: string | null;
  academyDriverIds: string[];
  staff: Record<StaffRole, string | null>;
  facilities: Record<FacilityKey, FacilityState>;
  rnd: RnDProject[];
  rndHistory: RnDCompletion[];
  sponsors: SponsorDeal[];
  ledger: Transaction[];
  financeHistory: SeasonFinanceSummary[];
  /** Cash at the end of each in-season week of the current season. */
  cashHistory: { week: number; cash: number }[];
  history: TeamSeasonRecord[];
  stats: TeamStats;
  boardConfidence: number;
  objectives: BoardObjective[];
  foundedSeason: number;
  /** European League mode: the club this team races as. */
  clubId?: string;
  /** A quick-model club given a car and drivers for one race against the player; never managed. */
  guest?: boolean;
  /** Set when the team must stop operating (only possible for the player in strict modes). */
  bankruptWarnings: number;
}

// ---------------------------------------------------------------------------
// Circuits, calendar and weather
// ---------------------------------------------------------------------------

export type PaceComponentKey = 'aerodynamics' | 'chassis' | 'powerUnit' | 'braking' | 'suspension' | 'straightLine' | 'cornering';

export interface Circuit {
  id: string;
  name: string;
  location: string;
  country: string;
  /** Lap count for a full Formula 1 distance. */
  laps: number;
  /** Reference lap time (s) for a midfield F1 car in the dry. */
  baseLapTime: number;
  lengthKm: number;
  /** Relative importance of each car area at this track (sums to 1). */
  weights: Record<PaceComponentKey, number>;
  /** 0 (easy to pass) .. 1 (nearly impossible). */
  overtakingDifficulty: number;
  /** Tyre wear multiplier, ~0.7-1.4. */
  tireStress: number;
  /** Brake stress multiplier. */
  brakeStress: number;
  /** Probability of rain in a given race weekend (0-1). */
  rainChance: number;
  /** Typical track temperature (°C). */
  baseTrackTemp: number;
  /** Time lost driving through the pit lane (s, F1 car). */
  pitLoss: number;
  /** Likelihood multiplier for safety-car deployments after incidents. */
  safetyCarRisk: number;
  /** Proportion of lap time in each sector. */
  sectors: [number, number, number];
  /** 0..1 how much the track rewards driver skill/adaptability (street circuits high). */
  driverDemand: number;
  type: 'permanent' | 'street' | 'hybrid';
  /** Divisions this circuit can appear in. */
  tiers: DivisionId[];
  character: string;
  /** Track-map style (absent = classic generated outline). */
  layout?: CircuitLayout;
  /** Fuel burned per lap relative to the series norm (absent = 1). */
  fuelFactor?: number;
  /** Altitude in metres: thin air works engines and cooling harder (absent = sea level). */
  altitude?: number;
  /** How changeable the weather is, 0..1: more and shorter showers (absent = 0). */
  weatherVolatility?: number;
}

export type CircuitLayout = 'street' | 'speedway' | 'mountain' | 'kart' | 'endurance' | 'stopgo' | 'technical' | 'flowing';

export interface CalendarEvent {
  id: string;
  division: DivisionId;
  round: number;
  circuitId: string;
  week: number;
  completed: boolean;
  /** Entrant teams when the field is not simply the division (European League cup and continental races). */
  teamIds?: string[];
  /** Race distance when it differs from the division's standard length. */
  laps?: number;
  /** Points system for this event when it differs from the division's. */
  pointsPreset?: string;
  /** European League mode: which competition this race belongs to. */
  euro?: EuroEventMeta;
}

// ---------------------------------------------------------------------------
// European League mode
// ---------------------------------------------------------------------------

export type EuroCompetition = 'league' | 'cup' | 'leagueCup' | 'superCup' | 'CL' | 'EL' | 'ECL' | 'ESC';
export type ContinentalCompetition = 'CL' | 'EL' | 'ECL';

export interface EuroEventMeta {
  competition: EuroCompetition;
  label: string;
  /** Head-to-head races: the fixture this race decides. */
  fixtureId?: string;
}

export type EuroHonour = 'league' | 'cup' | 'leagueCup' | 'superCup' | 'CL' | 'EL' | 'ECL' | 'ESC' | 'lowerLeague';

export interface EuroClub {
  id: string;
  name: string;
  short: string;
  assocId: string;
  /** League level inside the association (1 = top flight). */
  level: number;
  /** Strength on the continental scale (car-rating points). Clubs run as full teams compute it live. */
  power: number;
  /** Full team in the player's association, null for clubs run by the quick model. */
  teamId: string | null;
  colors: { primary: string; secondary: string };
  livery: LiveryPattern;
  homeCircuitId: string;
  /** Club coefficient points of the last five seasons, oldest first. */
  coef: number[];
  honours: Partial<Record<EuroHonour, number>>;
  /** Pace split between the club's two cars this season (quick model). */
  drivers: [number, number];
}

export interface LiteStandingRow {
  clubId: string;
  points: number;
  wins: number;
  podiums: number;
  races: number;
  best: number | null;
}

export interface EuroLeague {
  id: string;
  assocId: string;
  level: number;
  name: string;
  short: string;
  clubIds: string[];
  /** Weeks of the season's gameweeks (one league race each). */
  weeks: number[];
  /** Standings of leagues run by the quick model; full leagues use the race calendar. */
  standings: Record<string, LiteStandingRow>;
  /** Full league of the player's association, raced as this division. */
  division: DivisionId | null;
}

export interface H2HCar {
  side: 'home' | 'away';
  /** Driver id when the race ran on the full engine. */
  driverId?: string;
  position: number;
  points: number;
  dnf: boolean;
}

export interface FixtureResult {
  home: number;
  away: number;
  cars: H2HCar[];
}

export type FixtureKind = 'match' | 'leg1' | 'leg2' | 'single' | 'decider';

export interface EuroFixture {
  id: string;
  competition: EuroCompetition;
  /** 'league', 'qualifying', 'playoff', 'r16', 'qf', 'sf', 'final', or a cup round name. */
  stage: string;
  matchday: number;
  week: number;
  home: string;
  away: string;
  circuitId: string;
  kind: FixtureKind;
  tieId: string | null;
  result: FixtureResult | null;
  /** Calendar event when the player's team takes part. */
  eventId: string | null;
}

export interface EuroTie {
  id: string;
  competition: EuroCompetition;
  stage: string;
  /** Hosts the first leg (or the only race). */
  home: string;
  away: string;
  fixtures: string[];
  decider: string | null;
  shootout: { winner: string; laps: Record<string, number> } | null;
  aggregate: [number, number];
  winner: string | null;
}

export type ContinentalStage = 'qualifying' | 'league' | 'playoff' | 'r16' | 'qf' | 'sf' | 'final' | 'done';

export interface ContinentalState {
  id: ContinentalCompetition;
  season: number;
  direct: string[];
  qualifyingPool: string[];
  qualifiers: number;
  qualifyingRounds: string[][];
  teams: string[];
  pots: string[][];
  fixtures: string[];
  stage: ContinentalStage;
  knockout: Record<'playoff' | 'r16' | 'qf' | 'sf' | 'final', string[]>;
  winner: string | null;
  runnerUp: string | null;
}

export interface CupState {
  id: string;
  kind: 'cup' | 'leagueCup' | 'superCup' | 'ESC';
  assocId: string | null;
  name: string;
  entrants: string[];
  rounds: string[][];
  /** Weeks the remaining rounds are raced in. */
  weeks: number[];
  alive: string[];
  winner: string | null;
  runnerUp: string | null;
}

export interface EuroAssociationState {
  id: string;
  /** Association coefficient of the last five seasons, oldest first. */
  coef: number[];
  rankHistory: number[];
  /** Last season's outcome, which decides European places and the super cup. */
  last: { order: string[]; cupWinner: string | null; leagueCupWinner: string | null };
}

export interface EuroSeasonHistory {
  season: number;
  year: number;
  winners: Partial<Record<'CL' | 'EL' | 'ECL' | 'ESC', { winner: string; runnerUp: string | null }>>;
  domestic: Record<string, { champion: string | null; cup: string | null; leagueCup?: string | null; superCup?: string | null }>;
  /** How far the player's team went in each competition. */
  player: { competition: EuroCompetition; reached: string }[];
  ranking: string[];
}

export interface EuropeState {
  playerAssocId: string;
  clubs: Record<string, EuroClub>;
  leagues: Record<string, EuroLeague>;
  associations: Record<string, EuroAssociationState>;
  fixtures: Record<string, EuroFixture>;
  ties: Record<string, EuroTie>;
  continental: Partial<Record<ContinentalCompetition, ContinentalState>>;
  cups: Record<string, CupState>;
  /** Cup and continental race events the player's team takes part in. */
  events: CalendarEvent[];
  /** Quick-model clubs materialised as teams for a race against the player (club id -> team id). */
  guests: Record<string, string>;
  titleHolders: Record<'CL' | 'EL' | 'ECL', string | null>;
  history: EuroSeasonHistory[];
  /** A tie's extra race keeps the setup work of the deciding leg run just before it. */
  carry: { weekendId: string; setupQuality: Record<string, number>; tireKnowledge: number } | null;
}

export type WeatherCondition = 'dry' | 'cloudy' | 'lightRain' | 'heavyRain';

export interface WeatherForecastEntry {
  /** Fraction of race distance this entry starts at. */
  from: number;
  rainProbability: number;
  condition: WeatherCondition;
}

// ---------------------------------------------------------------------------
// Race simulation
// ---------------------------------------------------------------------------

export type TireCompound = 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet';
export type PaceMode = 'conserve' | 'balanced' | 'push' | 'attack';
export type TireMode = 'preserve' | 'normal' | 'aggressive';
export type FuelMode = 'lean' | 'standard' | 'rich';
export type ErsMode = 'harvest' | 'balanced' | 'deploy' | 'overtake';
export type TeamOrder = 'free' | 'hold' | 'letPass';

export interface Setup {
  frontWing: number;
  rearWing: number;
  suspension: number;
  rideHeight: number;
  gearing: number;
}
export type SetupKey = keyof Setup;

export interface PracticeRun {
  run: number;
  setup: Setup;
  lapTime: number;
  feedback: { key: SetupKey; direction: -1 | 0 | 1; magnitude: 'small' | 'large' | 'ok'; reliable: boolean }[];
  setupQuality: number;
  program: 'setup' | 'longRun' | 'qualiSim';
  tireNotes?: { compound: TireCompound; degPerLap: number }[];
}

export interface StrategyStop {
  lap: number;
  compound: TireCompound;
}

export interface StrategyPlan {
  startCompound: TireCompound;
  stops: StrategyStop[];
  label: string;
  predictedTime?: number;
}

export interface RaceInstructions {
  pace: PaceMode;
  tires: TireMode;
  fuel: FuelMode;
  ers: ErsMode;
  defend: boolean;
  teamOrder: TeamOrder;
}

export type FailureType = 'engine' | 'gearbox' | 'brakes' | 'hydraulics' | 'cooling' | 'electrics' | 'suspension';

export interface CarRaceState {
  driverId: string;
  teamId: string;
  grid: number;
  position: number;
  /** Cumulative race time (s) at the end of the last completed lap. */
  totalTime: number;
  lapsCompleted: number;
  lastLap: number;
  bestLap: number;
  sectors: [number, number, number];
  bestSectors: [number, number, number];
  gapToLeader: number;
  interval: number;
  tire: { compound: TireCompound; age: number; wear: number };
  stints: { compound: TireCompound; fromLap: number; toLap: number | null }[];
  fuel: number;
  ers: number;
  /** Persistent pace loss from damage (s/lap). */
  damage: number;
  fatigue: number;
  status: 'running' | 'retired' | 'dsq';
  retireReason: string | null;
  retiredLap: number | null;
  pitStops: number;
  pitThisLap: boolean;
  pitRequest: TireCompound | null;
  /** Time penalties (s) to be added at the end or served at a stop. */
  penaltySeconds: number;
  trackLimitWarnings: number;
  instructions: RaceInstructions;
  plan: StrategyPlan;
  /** Strategist handles pit timing automatically. */
  autoStrategy: boolean;
  /** Strategist manages pace/tyre/ERS modes until the player takes manual control. */
  autoInstructions: boolean;
  warning: { type: FailureType; severity: number; lapIssued: number } | null;
  /** Hidden latent failure counter (laps until failure if not managed). */
  latentFailure: { type: FailureType; health: number } | null;
  lapsLed: number;
  usedCompounds: TireCompound[];
  /** Who last passed this car and when (stops instant re-passes); absent in older saves. */
  passedBy?: { driverId: string; lap: number };
  /** Base pace data computed at race start (performance indices). */
  carPerf: number;
  driverPerf: number;
  setupQuality: number;
  /** Reaction delay counter for weather calls. */
  weatherCallTimer: number;
  isPlayer: boolean;
  history: { lap: number; position: number; lapTime: number; compound: TireCompound }[];
}

export type RaceLogType =
  | 'start'
  | 'overtake'
  | 'pit'
  | 'fastestLap'
  | 'mistake'
  | 'crash'
  | 'collision'
  | 'failure'
  | 'warning'
  | 'safetyCar'
  | 'vsc'
  | 'safetyCarEnd'
  | 'penalty'
  | 'weather'
  | 'radio'
  | 'finish'
  | 'info';

export interface RaceLogEntry {
  lap: number;
  type: RaceLogType;
  text: string;
  driverIds: string[];
  key: boolean;
}

export interface RaceWeatherLap {
  rain: number;
  wetness: number;
  trackTemp: number;
}

export interface RaceState {
  id: string;
  eventId: string;
  division: DivisionId;
  circuitId: string;
  season: number;
  round: number;
  totalLaps: number;
  lap: number;
  rng: number;
  baseLapTime: number;
  weather: RaceWeatherLap[];
  cars: CarRaceState[];
  safetyCar: { type: 'none' | 'sc' | 'vsc'; lapsRemaining: number; count: number; vscCount: number };
  log: RaceLogEntry[];
  fastestLap: { driverId: string; time: number; lap: number } | null;
  finished: boolean;
  drsEnabled: boolean;
  /** Compressed lap-by-lap order for charts. */
  lapOrders: string[][];
  /** Laps run under safety car / VSC. */
  scLaps: number[];
  /** Penalties issued by the stewards during the race. */
  stewards: { driverId: string; seconds: number; points: number; reason: string; lap: number }[];
  /** Damage/crash repair bills per team (applied with the result). */
  damageCosts: Record<string, number>;
  /** Injuries sustained in crashes (driverId -> weeks out). */
  injuries: Record<string, number>;
  /** Mechanical failures by driver (for grid penalties next race). */
  failures: Record<string, string>;
  /** On-track passes (team orders and pit stops excluded); absent in older saves. */
  passes?: { firstLap: number; total: number };
  /** European League mode: competition of this race. */
  competition?: EuroCompetition;
}

export interface QualifyingEntry {
  driverId: string;
  teamId: string;
  position: number;
  bestLap: number | null;
  sessionTimes: (number | null)[];
  eliminatedIn: number | null;
  sectors: [number, number, number] | null;
  gridPenalty: number;
  grid: number;
  note?: string;
}

export interface QualifyingResult {
  sessions: number;
  entries: QualifyingEntry[];
  wet: boolean;
}

export type ResultStatus = 'finished' | 'dnf' | 'dsq' | 'dns';

export interface RaceResultEntry {
  driverId: string;
  teamId: string;
  position: number;
  grid: number;
  points: number;
  status: ResultStatus;
  laps: number;
  time: number | null;
  gap: string;
  bestLap: number | null;
  fastestLap: boolean;
  pitStops: number;
  penaltySeconds: number;
  reason: string | null;
  lapsLed: number;
}

export interface RaceResult {
  eventId: string;
  division: DivisionId;
  season: number;
  round: number;
  circuitId: string;
  wet: boolean;
  safetyCars: number;
  entries: RaceResultEntry[];
  poleDriverId: string | null;
  fastestLapDriverId: string | null;
  qualifying: QualifyingEntry[];
  /** European League mode: competition of this race (absent = league race or Classic). */
  competition?: EuroCompetition;
}

// ---------------------------------------------------------------------------
// Race weekend (player division)
// ---------------------------------------------------------------------------

export type WeekendPhase = 'practice' | 'qualifying' | 'raceSetup' | 'race' | 'complete';

export interface WeekendState {
  eventId: string;
  phase: WeekendPhase;
  forecast: WeatherForecastEntry[];
  practice: {
    runsRemaining: Record<string, number>;
    setups: Record<string, Setup>;
    runs: Record<string, PracticeRun[]>;
    bestSetupQuality: Record<string, number>;
    tireKnowledge: number;
  };
  qualifying: {
    sessionIndex: number;
    result: QualifyingResult | null;
    riskMode: Record<string, 'safe' | 'normal' | 'maximum'>;
    sessionResults: QualifyingEntry[][];
  };
  /** Setup quality of every car in the field (AI computed, player from practice). */
  setupQuality: Record<string, number>;
  strategies: Record<string, StrategyPlan>;
  strategyOptions: Record<string, StrategyPlan[]>;
  startInstructions: Record<string, RaceInstructions>;
  startFuelMargin: Record<string, number>;
  race: RaceState | null;
  resultApplied: boolean;
  /** Player drivers' morale and confidence at the start of the race (for the post-race report). */
  startMood?: Record<string, { morale: number; confidence: number }>;
}

// ---------------------------------------------------------------------------
// Market, scouting, negotiation
// ---------------------------------------------------------------------------

export interface DriverOffer {
  driverId: string;
  role: DriverRole;
  salary: number;
  years: number;
  signingBonus: number;
  winBonus: number;
  podiumBonus: number;
  status: DriverStatus;
  /** Start now (current season) or from next season. */
  startNextSeason: boolean;
  /** Seat to fill when signing a race driver mid-season (index 0/1). */
  seatIndex?: 0 | 1;
  releaseClause?: number;
}

export interface NegotiationMemory {
  attempts: number;
  /** Driver refuses talks until this absolute week. */
  blockedUntil: number;
  lastResponse: string | null;
  askingSalary: number | null;
  lastAbsWeek: number;
}

export interface ScoutAssignment {
  targetId: string;
  targetType: 'driver' | 'staff';
  weeksRemaining: number;
  weeksTotal: number;
}

// ---------------------------------------------------------------------------
// News and events
// ---------------------------------------------------------------------------

export type NewsCategory =
  | 'race'
  | 'transfer'
  | 'rumor'
  | 'engineering'
  | 'finance'
  | 'championship'
  | 'promotion'
  | 'board'
  | 'interview'
  | 'regulation'
  | 'academy'
  | 'injury'
  | 'discipline'
  | 'sponsor'
  | 'preview'
  | 'milestone';

export interface NewsItem {
  id: string;
  season: number;
  week: number;
  category: NewsCategory;
  headline: string;
  body: string;
  division: DivisionId | null;
  teamIds: string[];
  driverIds: string[];
  importance: 1 | 2 | 3;
  read: boolean;
}

export interface OpportunityChoice {
  id: string;
  label: string;
  description: string;
}

export interface Opportunity {
  id: string;
  kind: 'investor' | 'windTunnel' | 'paySeat' | 'mediaDeal' | 'engineerPoach' | 'charity' | 'testDay' | 'transferBid';
  title: string;
  body: string;
  choices: OpportunityChoice[];
  expiresAbsWeek: number;
  data: Record<string, number | string>;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  text: string;
  page?: string;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface StandingRow {
  id: string;
  teamId?: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
  starts: number;
  positions: number[];
  best: number | null;
}

export interface DivisionSeasonHistory {
  division: DivisionId;
  driverStandings: StandingRow[];
  constructorStandings: StandingRow[];
  championDriverId: string | null;
  championTeamId: string | null;
  results: RaceResult[];
  teamNames: Record<string, string>;
}

export interface SeasonAward {
  title: string;
  driverId?: string;
  teamId?: string;
  description: string;
}

export interface SeasonHistory {
  season: number;
  year: number;
  divisions: Record<DivisionId, DivisionSeasonHistory>;
  promotions: { teamId: string; from: DivisionId; to: DivisionId }[];
  relegations: { teamId: string; from: DivisionId; to: DivisionId }[];
  awards: SeasonAward[];
  playerDivision: DivisionId;
  playerPosition: number;
  retirements: string[];
}

// ---------------------------------------------------------------------------
// Settings and top-level state
// ---------------------------------------------------------------------------

export interface GameSettings {
  difficulty: Difficulty;
  /** Points system preset per division (takes effect at next season start). */
  pointsPreset: Record<DivisionId, string>;
  pendingPointsPreset: Record<DivisionId, string> | null;
  autosave: boolean;
  defaultRaceSpeed: 1 | 5 | 20 | 60;
  autoSkipAiWeekends: boolean;
}

export type GamePhase = 'preseason' | 'season' | 'weekend' | 'seasonReview' | 'offseason' | 'gameOver';

export interface PlayerProfile {
  teamId: string;
  principalName: string;
  philosophy: Philosophy;
  financialStart: FinancialStart;
  scouting: Record<string, number>;
  scoutAssignments: ScoutAssignment[];
  negotiations: Record<string, NegotiationMemory>;
  sponsorOffers: SponsorOffer[];
  opportunities: Opportunity[];
  /** Promotion decision pending at season end. */
  promotionOffer: { to: DivisionId } | null;
  gameOverReason: string | null;
  seasonsPlayed: number;
  bailoutsUsed: number;
  /** This season's optional challenges (absent in older saves). */
  challenges?: SeasonChallenge[];
  /** This season's rival team and head-to-head record (absent in older saves). */
  rival?: Rivalry | null;
  /** Achievements unlocked in this career, by id (absent in older saves). */
  achievements?: Record<string, { season: number; week: number }>;
}

export type ChallengeKind =
  | 'win'
  | 'podium'
  | 'points'
  | 'pointsStreak'
  | 'doublePoints'
  | 'wetPoints'
  | 'charge'
  | 'frontRow'
  | 'reliable'
  | 'fastestLap'
  | 'beatRival';

export interface SeasonChallenge {
  id: string;
  season: number;
  kind: ChallengeKind;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  failed: boolean;
  reward: { cash: number; reputation: number; devBoost: number };
}

export interface Rivalry {
  teamId: string;
  season: number;
  /** Races in which the player's best car finished ahead of / behind the rival's. */
  ahead: number;
  behind: number;
}

/** A one-race daily challenge scenario (game mode 'daily'). */
export interface DailyChallengeInfo {
  date: string;
  eventId: string;
  division: DivisionId;
  goalPosition: number;
  title: string;
  description: string;
  /** Best finishing position of the player's cars once the race is done. */
  bestFinish: number | null;
}

export interface RegulationNotice {
  division: DivisionId;
  season: number;
  magnitude: 'stable' | 'minor' | 'major';
  focus: ComponentKey | null;
  text: string;
}

export interface GameState {
  version: number;
  id: string;
  seed: number;
  rng: number;
  createdAt: number;
  savedAt: number;
  season: number;
  year: number;
  week: number;
  phase: GamePhase;
  settings: GameSettings;
  player: PlayerProfile;
  teams: Record<string, Team>;
  drivers: Record<string, Driver>;
  staff: Record<string, StaffMember>;
  circuits: Record<string, Circuit>;
  calendars: Record<DivisionId, CalendarEvent[]>;
  results: Record<string, RaceResult>;
  weekend: WeekendState | null;
  news: NewsItem[];
  history: SeasonHistory[];
  regulations: RegulationNotice[];
  /** Upcoming regulation changes announced for next season. */
  nextRegulations: RegulationNotice[];
  /** Bookkeeping to make processes idempotent (anti-exploit). */
  processed: Record<string, true>;
  idCounter: number;
  lastSeasonReview: SeasonReviewSummary | null;
  /** 'daily' marks a throwaway daily-challenge world, 'european' a European League career (absent = Classic career). */
  mode?: 'career' | 'daily' | 'european';
  daily?: DailyChallengeInfo | null;
  /** European League mode world (absent in Classic careers). */
  europe?: EuropeState;
}

export interface SeasonReviewSummary {
  season: number;
  division: DivisionId;
  position: number;
  points: number;
  champion: boolean;
  promoted: boolean;
  relegated: boolean;
  newDivision: DivisionId;
  prizeMoney: number;
  awards: SeasonAward[];
  objectives: { description: string; met: boolean }[];
  boardConfidence: number;
  expiredDrivers: string[];
  retirements: string[];
  regulation: RegulationNotice | null;
  notes: string[];
  /** Season-end car development boost earned by the finishing position (absent in older saves). */
  developmentBoost?: number;
  /** Season challenges completed out of those set (absent in older saves). */
  challenges?: { completed: number; total: number };
  /** Finished in a promotion place but held no licence for the series above (absent in older saves). */
  missedPromotion?: { to: DivisionId; failed: string[] } | null;
  /** European League mode: cup and continental runs, and next season's European place. */
  europe?: {
    reached: { competition: EuroCompetition; name: string; reached: string }[];
    nextSeason: { competition: ContinentalCompetition; name: string; direct: boolean }[];
  };
}

export interface NewCareerConfig {
  teamName: string;
  shortName: string;
  nationality: string;
  primaryColor: string;
  secondaryColor: string;
  livery: LiveryPattern;
  principalName: string;
  philosophy: Philosophy;
  difficulty: Difficulty;
  financialStart: FinancialStart;
  seed?: number;
  /** European League mode: the association the team enters. */
  european?: { assocId: string };
}
