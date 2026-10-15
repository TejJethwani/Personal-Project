import { AI_PERSONALITIES, DIFFICULTIES, FINANCIAL_STARTS } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { CIRCUITS } from '../data/circuits';
import { TEAM_SEEDS } from '../data/teams';
import { generateCar } from '../car/car';
import { expectedSalary, overall } from '../drivers/ratings';
import { generateDriver, generateProspect, nextId, raceAgeFor, type GenContext } from '../drivers/generate';
import { generateStaff, STAFF_ROLES, staffExpectedSalary } from '../staff/staff';
import { FACILITY_KEYS } from '../team/facilities';
import { buildAllCalendars } from '../season/calendar';
import { Rng } from '../rng';
import type {
  AIPersonality,
  Contract,
  Driver,
  DriverRole,
  DriverStatus,
  DivisionId,
  FacilityKey,
  FacilityState,
  GameState,
  NewCareerConfig,
  StaffRole,
  Team,
} from '../types';
import { DIVISION_ORDER } from '../types';
import { clamp, roundMoney } from '../util';

export const SAVE_VERSION = 1;
export const START_YEAR = 2027;

export function emptyStats(): Team['stats'] {
  return {
    races: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    constructorTitles: 0,
    driverTitles: 0,
    constructorTitlesByDivision: {},
    promotions: 0,
    relegations: 0,
  };
}

function facilitiesAt(levels: Partial<Record<FacilityKey, number>>, fallback: number): Record<FacilityKey, FacilityState> {
  const out = {} as Record<FacilityKey, FacilityState>;
  for (const k of FACILITY_KEYS) out[k] = { level: clamp(Math.round(levels[k] ?? fallback), 1, 10), upgrade: null };
  return out;
}

export function makeContract(
  ids: { idCounter: number },
  season: number,
  teamId: string,
  role: DriverRole,
  salary: number,
  years: number,
  status: DriverStatus,
  extra: Partial<Contract> = {},
): Contract {
  return {
    id: nextId(ids, 'c'),
    teamId,
    role,
    salary: roundMoney(salary),
    startSeason: season,
    endSeason: season + Math.max(1, years) - 1,
    signingBonus: 0,
    winBonus: 0,
    podiumBonus: 0,
    status,
    releaseClause: 0,
    signedSeason: season,
    signedWeek: 0,
    ...extra,
  };
}

interface WorldBuild {
  state: GameState;
  ctx: GenContext;
}

function baseTeam(id: string, division: DivisionId, season: number): Team {
  return {
    id,
    name: '',
    shortName: '',
    nationality: 'GBR',
    colors: { primary: '#ffffff', secondary: '#000000' },
    livery: 'solid',
    principal: '',
    isPlayer: false,
    aiPersonality: null,
    division,
    reputation: 10,
    cash: 0,
    car: { components: {} as Team['car']['components'], developmentLevel: {} as Team['car']['developmentLevel'] },
    raceDrivers: [null, null],
    reserveDriverId: null,
    academyDriverIds: [],
    staff: Object.fromEntries(STAFF_ROLES.map((r) => [r, null])) as Record<StaffRole, string | null>,
    facilities: facilitiesAt({}, 1),
    rnd: [],
    rndHistory: [],
    sponsors: [],
    ledger: [],
    financeHistory: [],
    cashHistory: [],
    history: [],
    stats: emptyStats(),
    boardConfidence: 65,
    objectives: [],
    foundedSeason: season,
    bankruptWarnings: 0,
  };
}

function hireStaff(build: WorldBuild, team: Team, role: StaffRole, rating: number): void {
  const s = generateStaff(build.ctx, role, rating);
  s.contract = {
    teamId: team.id,
    salary: staffExpectedSalary(s.rating, team.division) * build.ctx.rng.range(0.9, 1.1),
    startSeason: build.state.season,
    endSeason: build.state.season + build.ctx.rng.int(0, 2),
  };
  s.contract.salary = roundMoney(s.contract.salary);
  s.history.push({ season: build.state.season, teamId: team.id, division: team.division });
  build.state.staff[s.id] = s;
  team.staff[role] = s.id;
}

function signDriverToTeam(build: WorldBuild, team: Team, driver: Driver, role: DriverRole, status: DriverStatus): void {
  const { rng } = build.ctx;
  const salary = role === 'academy' ? 0 : expectedSalary(driver, team.division) * rng.range(0.8, 1.12) * (role === 'reserve' ? 0.45 : 1);
  driver.contract = makeContract(build.state, build.state.season, team.id, role, salary, rng.int(1, 3), status);
  driver.transfers.push({ season: build.state.season, week: 0, fromTeamId: null, toTeamId: team.id, fee: 0, type: role === 'academy' ? 'academy' : 'signing' });
  build.state.drivers[driver.id] = driver;
}

function generateAiTeam(build: WorldBuild, division: DivisionId, index: number, rank: number, personality: AIPersonality): Team {
  const { rng } = build.ctx;
  const { state } = build;
  const cfg = DIVISIONS[division];
  const seed = TEAM_SEEDS[division][index];
  const team = baseTeam(nextId(state, 't'), division, state.season);
  const strength = (4.5 - rank) / 4.5; // +1 strongest .. -1 weakest
  team.name = seed.name;
  team.shortName = seed.shortName;
  team.nationality = seed.nationality;
  team.colors = { primary: seed.primary, secondary: seed.secondary };
  team.livery = seed.livery;
  const principalName = generateStaff(build.ctx, 'technicalDirector', 50);
  team.principal = `${principalName.firstName} ${principalName.lastName}`;
  team.aiPersonality = personality;
  const [rMin, rMax] = cfg.reputationRange;
  team.reputation = Math.round(clamp(rMin + ((strength + 1) / 2) * (rMax - rMin) + rng.normal(0, 3), 1, 99));
  team.cash = roundMoney(cfg.typicalBudget * rng.range(0.22, 0.42) * (1 + strength * 0.35));
  team.car = generateCar(rng, 50 + strength * cfg.carSpread * 1.15 + rng.normal(0, 1.2), 3.5);
  const [fMin, fMax] = cfg.facilityRange;
  const fBase = fMin + ((strength + 1) / 2) * (fMax - fMin);
  const levels: Partial<Record<FacilityKey, number>> = {};
  for (const k of FACILITY_KEYS) levels[k] = clamp(Math.round(fBase + rng.normal(0, 0.7)), Math.max(1, fMin - 1), Math.min(10, fMax + 1));
  if (personality === 'youth') levels.trainingAcademy = (levels.trainingAcademy ?? 1) + 1;
  if (personality === 'engineering') levels.engineering = (levels.engineering ?? 1) + 1;
  team.facilities = facilitiesAt(levels, fBase);
  // Licensing requirements for the current division are always satisfied at generation.
  for (const [k, lvl] of Object.entries(cfg.licensing.facilities) as [FacilityKey, number][]) {
    team.facilities[k].level = Math.max(team.facilities[k].level, lvl);
  }

  for (const role of STAFF_ROLES) {
    const vacancyChance = division === 'F5' ? 0.22 : division === 'F4' ? 0.1 : 0;
    if (role !== 'technicalDirector' && role !== 'raceEngineer' && rng.chance(vacancyChance)) continue;
    hireStaff(build, team, role, cfg.staffRatingMean + strength * 7 + rng.normal(0, 6));
  }

  // Drivers: two race drivers, usually a reserve, academy for youth-minded teams.
  const raceTargets = [0, 1].map(() => cfg.driverRatingMean + strength * 4.5 + rng.normal(0, cfg.driverRatingSd * 0.65));
  raceTargets.sort((a, b) => b - a);
  const drivers = raceTargets.map((t) => generateDriver(build.ctx, { targetOverall: t, age: raceAgeFor(rng, division), division }));
  const gap = overall(drivers[0]) - overall(drivers[1]);
  drivers.forEach((d, i) => {
    const status: DriverStatus = gap >= 4 ? (i === 0 ? 'number1' : 'number2') : 'equal';
    signDriverToTeam(build, team, d, 'race', status);
    team.raceDrivers[i] = d.id;
  });
  if (rng.chance(division === 'F5' ? 0.4 : 0.75)) {
    const reserve = generateDriver(build.ctx, { targetOverall: cfg.driverRatingMean - 4 + rng.normal(0, 4), age: raceAgeFor(rng, division), division });
    signDriverToTeam(build, team, reserve, 'reserve', 'number2');
    team.reserveDriverId = reserve.id;
  }
  const academyCount = personality === 'youth' ? rng.int(2, 3) : rng.chance(0.35) ? 1 : 0;
  for (let i = 0; i < academyCount; i++) {
    const p = generateProspect(build.ctx, cfg.tier * 0.5);
    signDriverToTeam(build, team, p, 'academy', 'number2');
    team.academyDriverIds.push(p.id);
  }
  return team;
}

function createPlayerTeam(build: WorldBuild, config: NewCareerConfig): Team {
  const { rng } = build.ctx;
  const { state } = build;
  const cfg = DIVISIONS.F5;
  const team = baseTeam(nextId(state, 't'), 'F5', state.season);
  team.isPlayer = true;
  team.name = config.teamName.trim() || 'Project Apex Racing';
  team.shortName = (config.shortName.trim() || team.name.slice(0, 3)).toUpperCase().slice(0, 3);
  team.nationality = config.nationality;
  team.colors = { primary: config.primaryColor, secondary: config.secondaryColor };
  team.livery = config.livery;
  team.principal = config.principalName.trim() || 'Team Principal';
  const fs = FINANCIAL_STARTS[config.financialStart];
  const diff = DIFFICULTIES[config.difficulty];
  team.reputation = Math.round(clamp(6 + fs.reputationBonus, 1, 20));
  team.cash = roundMoney(cfg.typicalBudget * 0.42 * fs.cashFactor * diff.startingCash);
  // A basic car: lower midfield, not overpowered.
  team.car = generateCar(rng, 48.5, 2.5);
  team.facilities = facilitiesAt({ engineering: 2, manufacturing: 1, simulator: 1, aeroCenter: 1, trainingAcademy: 1, fitness: 1, scouting: 1, strategy: 1 }, 1);
  // Small staff: four key roles, three vacancies to fill.
  hireStaff(build, team, 'technicalDirector', 35 + rng.normal(0, 2));
  hireStaff(build, team, 'raceEngineer', 36 + rng.normal(0, 2));
  hireStaff(build, team, 'chiefMechanic', 34 + rng.normal(0, 2));
  hireStaff(build, team, 'headStrategist', 33 + rng.normal(0, 2));
  for (const role of STAFF_ROLES) {
    const id = team.staff[role];
    if (id) state.staff[id].contract!.endSeason = state.season + 1;
  }
  // Two contracted drivers: an experienced journeyman and a raw youngster.
  const lead = generateDriver(build.ctx, { targetOverall: 47 + rng.normal(0, 1), age: rng.int(20, 24), division: 'F5', archetype: rng.pick(['allRounder', 'journeyman', 'tireWhisperer'] as const) });
  const rookie = generateDriver(build.ctx, { targetOverall: 43 + rng.normal(0, 1), age: rng.int(16, 18), division: 'F5', potentialBoost: config.philosophy === 'youth' ? 6 : 3 });
  [lead, rookie].forEach((d, i) => {
    signDriverToTeam(build, team, d, 'race', 'equal');
    d.contract!.endSeason = state.season + (i === 0 ? 1 : 2);
    d.contract!.salary = roundMoney(expectedSalary(d, 'F5'));
    d.morale = 70;
    team.raceDrivers[i] = d.id;
  });
  return team;
}

export function createWorld(config: NewCareerConfig): GameState {
  const seed = (config.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rng = Rng.from(seed, 'world');
  const state: GameState = {
    version: SAVE_VERSION,
    id: `career-${seed.toString(36)}-${Date.now().toString(36)}`,
    seed,
    rng: Rng.from(seed, 'runtime').state,
    createdAt: Date.now(),
    savedAt: Date.now(),
    season: 1,
    year: START_YEAR,
    week: 0,
    phase: 'preseason',
    settings: {
      difficulty: config.difficulty,
      pointsPreset: Object.fromEntries(DIVISION_ORDER.map((d) => [d, DIVISIONS[d].defaultPoints])) as Record<DivisionId, string>,
      pendingPointsPreset: null,
      autosave: true,
      defaultRaceSpeed: 20,
      autoSkipAiWeekends: true,
    },
    player: {
      teamId: '',
      principalName: config.principalName,
      philosophy: config.philosophy,
      financialStart: config.financialStart,
      scouting: {},
      scoutAssignments: [],
      negotiations: {},
      sponsorOffers: [],
      opportunities: [],
      promotionOffer: null,
      gameOverReason: null,
      seasonsPlayed: 0,
      bailoutsUsed: 0,
    },
    teams: {},
    drivers: {},
    staff: {},
    circuits: Object.fromEntries(CIRCUITS.map((c) => [c.id, c])),
    calendars: { F5: [], F4: [], F3: [], F2: [], F1: [] },
    results: {},
    weekend: null,
    news: [],
    history: [],
    regulations: [],
    nextRegulations: [],
    processed: {},
    idCounter: 0,
    lastSeasonReview: null,
  };
  const build: WorldBuild = { state, ctx: { rng, ids: state, season: 1 } };

  const personalities = Object.keys(AI_PERSONALITIES) as AIPersonality[];
  for (const division of DIVISION_ORDER) {
    const count = TEAM_SEEDS[division].length;
    const ranks = rng.shuffle([...Array(count).keys()]);
    for (let i = 0; i < count; i++) {
      const team = generateAiTeam(build, division, i, division === 'F5' ? ranks[i] * (10 / 9) : ranks[i], rng.pick(personalities));
      state.teams[team.id] = team;
    }
  }
  const player = createPlayerTeam(build, config);
  state.teams[player.id] = player;
  state.player.teamId = player.id;

  // Free agents across all levels, plus unsigned youth prospects.
  for (const division of DIVISION_ORDER) {
    const cfg = DIVISIONS[division];
    const count = division === 'F1' ? 8 : division === 'F5' ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const d = generateDriver(build.ctx, { targetOverall: cfg.driverRatingMean - 3 + rng.normal(0, cfg.driverRatingSd), age: raceAgeFor(rng, division), division });
      state.drivers[d.id] = d;
    }
  }
  for (let i = 0; i < 36; i++) {
    const p = generateProspect(build.ctx, rng.range(0, 1.5));
    state.drivers[p.id] = p;
  }

  // Free-agent staff market.
  for (const role of STAFF_ROLES) {
    for (let i = 0; i < 7; i++) {
      const s = generateStaff(build.ctx, role, rng.pick([30, 36, 42, 50, 58, 66, 74]) + rng.normal(0, 4));
      state.staff[s.id] = s;
    }
  }

  state.calendars = buildAllCalendars(state, 1);
  // The player's own drivers and staff are fully known.
  for (const id of player.raceDrivers) if (id) state.player.scouting[id] = 100;
  return state;
}
