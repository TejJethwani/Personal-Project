/**
 * Lap-by-lap race simulation engine.
 *
 * Model summary (see docs/SIMULATION.md for the full description):
 *  - Every lap each running car gets a lap time from the shared pace model
 *    (car performance at this track, driver skill in these conditions, setup)
 *    plus tyre compound/wear, fuel load, driver instructions, dirty air,
 *    damage, fatigue and random noise scaled by the driver's consistency.
 *  - Cars are then resolved front-to-back. A car whose lap would put it ahead
 *    of the car in front must complete an overtake; the chance depends on the
 *    pace advantage, racecraft vs. defence, DRS/ERS and how hard it is to pass
 *    at the circuit. Failing leaves it stuck in dirty air.
 *  - Incidents (mistakes, collisions, mechanical failures with optional
 *    warnings) and safety cars are rolled from the same seeded RNG.
 *
 * The full state (including the RNG) lives in `RaceState`, so a race can be
 * paused, saved and resumed. Stepping the same state with the same commands
 * always produces exactly the same race, whatever the playback speed.
 */
import { DIFFICULTIES, PHILOSOPHIES } from '../config/difficulty';
import { AI_PERSONALITIES } from '../config/difficulty';
import { DIVISIONS, eventLaps } from '../config/divisions';
import { RACE_TUNING, TIRE_TUNING } from '../config/tuning';
import { reliabilityIndex, trackPerformance } from '../car/car';
import { eventCarOffset } from '../europe/power';
import { attackIndex, defenceIndex, driverShortName, racePaceIndex } from '../drivers/ratings';
import { Rng } from '../rng';
import { staffRating } from '../staff/staff';
import type {
  CalendarEvent,
  CarRaceState,
  Circuit,
  Driver,
  ErsMode,
  FailureType,
  FuelMode,
  GameState,
  PaceMode,
  RaceInstructions,
  RaceLogType,
  RaceState,
  StrategyPlan,
  TeamOrder,
  TireCompound,
  TireMode,
} from '../types';
import { assertRule, clamp, sigmoid } from '../util';
import { basePace, divisionBaseLap, lapNoiseSd } from './pace';
import { compoundForRemaining, pitLossFor } from './strategy';
import { allowedCompounds, compoundPaceOffset, expectedWear, idealCompoundForWetness, isWetCompound, wearPenalty, wearPerLap } from './tires';
import { generateEventWeather } from './weather';
import { twistEffects, weatherMods, type TwistEffects } from '../season/twists';

export interface RaceEntrantInput {
  driverId: string;
  teamId: string;
  grid: number;
  setupQuality: number;
  plan: StrategyPlan;
  instructions: RaceInstructions;
  autoStrategy: boolean;
  autoInstructions: boolean;
  fuelMargin: number;
  isPlayer: boolean;
}

/** Sentinel for 'no lap time yet' (Infinity does not survive JSON). */
export const NO_TIME = 99999;

export const DEFAULT_INSTRUCTIONS: RaceInstructions = { pace: 'balanced', tires: 'normal', fuel: 'standard', ers: 'balanced', defend: false, teamOrder: 'free' };

export function createRaceState(state: GameState, event: CalendarEvent, entrants: RaceEntrantInput[]): RaceState {
  const circuit = state.circuits[event.circuitId];
  const cfg = DIVISIONS[event.division];
  const totalLaps = eventLaps(event, circuit.laps);
  const baseLapTime = divisionBaseLap(circuit, event.division);
  const weather = generateEventWeather(state.seed, event.id, circuit, totalLaps, weatherMods(state, event.division));
  const sorted = [...entrants].sort((a, b) => a.grid - b.grid);
  const cars: CarRaceState[] = sorted.map((e, idx) => {
    const team = state.teams[e.teamId];
    const fuel = cfg.fuelBurnPerLap * totalLaps * (1 + (cfg.fuelManagement ? e.fuelMargin : 0.03));
    return {
      driverId: e.driverId,
      teamId: e.teamId,
      grid: e.grid,
      position: idx + 1,
      totalTime: idx * RACE_TUNING.gridSlotGap,
      lapsCompleted: 0,
      lastLap: 0,
      bestLap: NO_TIME,
      sectors: [0, 0, 0],
      bestSectors: [NO_TIME, NO_TIME, NO_TIME],
      gapToLeader: idx * RACE_TUNING.gridSlotGap,
      interval: idx === 0 ? 0 : RACE_TUNING.gridSlotGap,
      tire: { compound: e.plan.startCompound, age: 0, wear: 0 },
      stints: [{ compound: e.plan.startCompound, fromLap: 1, toLap: null }],
      fuel,
      ers: cfg.ers ? 100 : 0,
      damage: 0,
      fatigue: 0,
      status: 'running',
      retireReason: null,
      retiredLap: null,
      pitStops: 0,
      pitThisLap: false,
      pitRequest: null,
      penaltySeconds: 0,
      trackLimitWarnings: 0,
      instructions: { ...e.instructions },
      plan: e.plan,
      autoStrategy: e.autoStrategy,
      autoInstructions: e.autoInstructions,
      warning: null,
      latentFailure: null,
      lapsLed: 0,
      usedCompounds: [e.plan.startCompound],
      carPerf: trackPerformance(team.car, circuit) + eventCarOffset(state, team, event),
      driverPerf: 0,
      setupQuality: e.setupQuality,
      weatherCallTimer: 0,
      isPlayer: e.isPlayer,
      history: [],
    };
  });
  const race: RaceState = {
    id: `race-${event.id}`,
    eventId: event.id,
    division: event.division,
    circuitId: circuit.id,
    season: state.season,
    round: event.round,
    totalLaps,
    lap: 0,
    rng: Rng.from(state.seed, 'race', event.id).state,
    baseLapTime,
    weather: weather.race,
    cars,
    safetyCar: { type: 'none', lapsRemaining: 0, count: 0, vscCount: 0 },
    log: [],
    fastestLap: null,
    finished: false,
    drsEnabled: false,
    lapOrders: [cars.map((c) => c.driverId)],
    scLaps: [],
    stewards: [],
    damageCosts: {},
    injuries: {},
    failures: {},
  };
  const startWet = weather.race[0]?.wetness ?? 0;
  pushLog(race, 0, 'start', `Lights out at ${circuit.name}! ${totalLaps} laps${startWet > 0.2 ? ' on a wet track' : ''}.`, [], true);
  return race;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type RaceCommand =
  | { type: 'pace'; value: PaceMode }
  | { type: 'tires'; value: TireMode }
  | { type: 'fuel'; value: FuelMode }
  | { type: 'ers'; value: ErsMode }
  | { type: 'defend'; value: boolean }
  | { type: 'teamOrder'; value: TeamOrder }
  | { type: 'pit'; compound: TireCompound }
  | { type: 'cancelPit' }
  | { type: 'autoStrategy'; value: boolean }
  | { type: 'autoInstructions'; value: boolean };

export function applyRaceCommand(state: GameState, race: RaceState, driverId: string, cmd: RaceCommand): void {
  const car = race.cars.find((c) => c.driverId === driverId);
  assertRule(car, 'Driver is not in this race.');
  assertRule(car.isPlayer, 'You can only instruct your own drivers.');
  assertRule(!race.finished, 'The race has finished.');
  assertRule(car.status === 'running', 'That car is no longer running.');
  const cfg = DIVISIONS[race.division];
  switch (cmd.type) {
    case 'pace':
      car.instructions.pace = cmd.value;
      car.autoInstructions = false;
      radio(race, car, state, paceRadio(cmd.value));
      break;
    case 'tires':
      car.instructions.tires = cmd.value;
      car.autoInstructions = false;
      break;
    case 'fuel':
      assertRule(cfg.fuelManagement, `${cfg.name} has no fuel management.`);
      car.instructions.fuel = cmd.value;
      car.autoInstructions = false;
      break;
    case 'ers':
      assertRule(cfg.ers, `${cfg.name} cars have no ERS.`);
      car.instructions.ers = cmd.value;
      car.autoInstructions = false;
      break;
    case 'defend':
      car.instructions.defend = cmd.value;
      car.autoInstructions = false;
      break;
    case 'teamOrder':
      car.instructions.teamOrder = cmd.value;
      break;
    case 'pit':
      assertRule(allowedCompounds(race.division).includes(cmd.compound), `${cmd.compound} tyres are not available in ${cfg.name}.`);
      assertRule(race.lap < race.totalLaps, 'The race is over.');
      car.pitRequest = cmd.compound;
      radio(race, car, state, `Box, box. ${TIRE_TUNING.compounds[cmd.compound].label}s ready.`);
      break;
    case 'cancelPit':
      car.pitRequest = null;
      radio(race, car, state, 'Stay out, stay out.');
      break;
    case 'autoStrategy':
      car.autoStrategy = cmd.value;
      break;
    case 'autoInstructions':
      car.autoInstructions = cmd.value;
      break;
  }
}

function paceRadio(p: PaceMode): string {
  switch (p) {
    case 'conserve':
      return 'Copy. Lifting and coasting, looking after the car.';
    case 'balanced':
      return 'Understood, standard pace.';
    case 'push':
      return 'Pushing now. Let me know the gaps.';
    case 'attack':
      return 'Full attack. Everything I have got!';
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function pushLog(race: RaceState, lap: number, type: RaceLogType, text: string, driverIds: string[], key: boolean): void {
  race.log.push({ lap, type, text, driverIds, key });
}

function radio(race: RaceState, car: CarRaceState, state: GameState, text: string): void {
  if (!car.isPlayer) return;
  pushLog(race, race.lap, 'radio', `${driverShortName(state.drivers[car.driverId])}: "${text}"`, [car.driverId], false);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAILURE_TEXT: Record<FailureType, string> = {
  engine: 'engine failure',
  gearbox: 'gearbox failure',
  brakes: 'brake failure',
  hydraulics: 'hydraulics problem',
  cooling: 'overheating',
  electrics: 'electrical failure',
  suspension: 'suspension failure',
};

const WARNING_TEXT: Record<FailureType, string> = {
  engine: 'Engine temperatures are rising. Manage it.',
  gearbox: 'We see a gearbox issue. Short-shift and be gentle.',
  brakes: 'Brake temps are critical. Lift earlier into the big stops.',
  hydraulics: 'Hydraulic pressure is dropping. Go easy.',
  cooling: 'The car is overheating. Find clean air and back off.',
  electrics: 'We have an electrical glitch. Cycle the settings, stay calm.',
  suspension: 'Something is off with the suspension. Avoid the kerbs.',
};

function retire(_race: RaceState, car: CarRaceState, lap: number, reason: string): void {
  car.status = 'retired';
  car.retireReason = reason;
  car.retiredLap = lap;
  car.warning = null;
  car.latentFailure = null;
  car.stints[car.stints.length - 1].toLap = lap;
}

function failureFactor(mode: PaceMode): number {
  return RACE_TUNING.paceModeFailure[mode];
}

function healthDrain(mode: PaceMode): number {
  return mode === 'conserve' ? 0.3 : mode === 'balanced' ? 1 : mode === 'push' ? 1.45 : 1.9;
}

function runningOrder(race: RaceState): CarRaceState[] {
  return race.cars.filter((c) => c.status === 'running').sort((a, b) => a.position - b.position);
}

function sortAndPosition(race: RaceState): void {
  const running = race.cars.filter((c) => c.status === 'running').sort((a, b) => a.totalTime - b.totalTime);
  const out = race.cars
    .filter((c) => c.status !== 'running')
    .sort((a, b) => (b.lapsCompleted - a.lapsCompleted) || ((b.retiredLap ?? 0) - (a.retiredLap ?? 0)) || (a.totalTime - b.totalTime));
  const ordered = [...running, ...out];
  const leader = running[0];
  ordered.forEach((c, i) => {
    c.position = i + 1;
    if (c.status === 'running' && leader) {
      c.gapToLeader = c.totalTime - leader.totalTime;
      c.interval = i === 0 ? 0 : c.totalTime - running[i - 1].totalTime;
    }
  });
}

interface LapContext {
  state: GameState;
  race: RaceState;
  circuit: Circuit;
  rng: Rng;
  lap: number;
  scale: number;
  wetness: number;
  rain: number;
  trackTemp: number;
  sc: RaceState['safetyCar']['type'];
  incidents: { severity: 'crash' | 'failure' | 'collision' }[];
  /** This season's twists for the series. */
  fx: TwistEffects;
}

function teamStrategistAccuracy(state: GameState, teamId: string): number {
  const team = state.teams[teamId];
  return clamp(staffRating(state, team, 'headStrategist') / 100 * 0.7 + (team.facilities.strategy.level / 10) * 0.3, 0.1, 1);
}

// ---------------------------------------------------------------------------
// AI / strategist decisions
// ---------------------------------------------------------------------------

function wearRatesFor(ctx: LapContext, car: CarRaceState, driver: Driver): Partial<Record<TireCompound, number>> {
  const team = ctx.state.teams[car.teamId];
  const out: Partial<Record<TireCompound, number>> = {};
  for (const c of DIVISIONS[ctx.race.division].dryCompounds) {
    out[c] = expectedWear(c, ctx.race.division, ctx.circuit, driver.attributes.tireManagement, team.car.components.tireEfficiency, ctx.trackTemp, 0, ctx.fx.wear);
  }
  return out;
}

/** Decide whether the strategist calls this car in at the end of this lap. */
function strategistPitCall(ctx: LapContext, car: CarRaceState, order: CarRaceState[]): TireCompound | null {
  const { race, lap, state } = ctx;
  const remaining = race.totalLaps - lap;
  const driver = state.drivers[car.driverId];
  const cfg = DIVISIONS[race.division];
  const accuracy = teamStrategistAccuracy(state, car.teamId);
  // Strategists look at the radar: wetness a few laps ahead, with error.
  const ahead = race.weather[Math.min(race.weather.length - 1, lap + 1)]?.wetness ?? ctx.wetness;
  const soon = ctx.wetness * 0.5 + ahead * 0.5;
  const onWet = isWetCompound(car.tire.compound);
  const dryChoice = () => compoundForRemaining(race.division, Math.max(1, remaining), wearRatesFor(ctx, car, driver), car.usedCompounds, ctx.scale);
  const ideal = idealCompoundForWetness(soon, onWet ? dryChoice() : car.tire.compound);
  const mismatch = (onWet && !isWetCompound(ideal)) || (!onWet && isWetCompound(ideal)) || (onWet && isWetCompound(ideal) && ideal !== car.tire.compound && Math.abs(soon - 0.76) > 0.08);
  if (mismatch && remaining >= 2) {
    car.weatherCallTimer += 1;
    const reaction = accuracy > 0.7 ? 1 : accuracy > 0.45 ? 2 : 3;
    if (car.weatherCallTimer >= reaction || (!onWet && ctx.wetness > 0.45)) {
      car.weatherCallTimer = 0;
      return isWetCompound(ideal) ? ideal : dryChoice();
    }
  } else {
    car.weatherCallTimer = 0;
  }
  if (remaining <= 1) return null;
  if (onWet) return null;

  const cliff = TIRE_TUNING.compounds[car.tire.compound].cliff;
  const rates = wearRatesFor(ctx, car, driver);
  const myRate = rates[car.tire.compound] ?? 2;
  const lapsLeftOnTire = (cliff + 4 - car.tire.wear) / Math.max(0.3, myRate);
  const nextStop = car.plan.stops[car.pitStops];
  const mustUseSecond = cfg.mandatoryTwoCompounds && new Set(car.usedCompounds.filter((c) => !isWetCompound(c))).size < 2 && !race.weather.slice(0, lap).some((w) => w.wetness > 0.22);

  // Puncture / dangerous wear.
  if (car.tire.wear >= TIRE_TUNING.punctureWear - 4) return dryChoice();
  // Cheap stop under safety car.
  if ((ctx.sc === 'sc' || ctx.sc === 'vsc') && remaining > 6) {
    const planned = nextStop ? nextStop.lap - lap : Infinity;
    if (planned <= 12 || car.tire.wear > 40 || (mustUseSecond && remaining < race.totalLaps * 0.7)) return nextStop && planned <= 12 ? nextStop.compound : dryChoice();
  }
  // Planned stop window.
  if (nextStop && lap >= nextStop.lap) {
    // Overcut: stay out if the tyres still have life and we're in clean air.
    if (lapsLeftOnTire > 3 && car.interval > 2.5 && lap - nextStop.lap < 2 && ctx.rng.chance(0.35 * accuracy)) return null;
    return nextStop.compound;
  }
  // Cover an undercut from the car behind.
  const behind = order[order.indexOf(car) + 1];
  if (behind && behind.pitThisLap === false && behind.pitStops > car.pitStops && behind.tire.age <= 1 && behind.totalTime - car.totalTime < pitLossFor(ctx.circuit, race.baseLapTime) * 0.35 + 2) {
    if (nextStop && nextStop.lap - lap <= 6 && ctx.rng.chance(accuracy)) return nextStop.compound;
  }
  // Tyres will not last to the planned stop.
  if (lapsLeftOnTire < 1.5 && remaining > lapsLeftOnTire + 1) return nextStop?.compound ?? dryChoice();
  // Must still use a second compound before the end.
  if (mustUseSecond && remaining <= Math.max(3, Math.round(race.totalLaps * 0.12))) return dryChoice();
  // Unplanned extra stop if tyres are finished and many laps remain.
  if (!nextStop && remaining > 8 && car.tire.wear > cliff - 2) return dryChoice();
  return null;
}

/** Strategist-managed pace/tyre/ERS instructions. */
function strategistInstructions(ctx: LapContext, car: CarRaceState, order: CarRaceState[]): void {
  const { race, lap, state } = ctx;
  const team = state.teams[car.teamId];
  const cfg = DIVISIONS[race.division];
  const risk = team.aiPersonality ? AI_PERSONALITIES[team.aiPersonality].raceRisk : 0.5;
  const idx = order.indexOf(car);
  const ahead = idx > 0 ? order[idx - 1] : null;
  const behind = order[idx + 1] ?? null;
  const remaining = race.totalLaps - lap;
  const ins = car.instructions;
  let pace: PaceMode = 'balanced';
  let tires: TireMode = 'normal';
  const gapAhead = ahead ? car.totalTime - ahead.totalTime : 99;
  const gapBehind = behind ? behind.totalTime - car.totalTime : 99;
  const nextStop = car.plan.stops[car.pitStops];
  const stintLeft = nextStop ? nextStop.lap - lap : remaining;
  const cliff = TIRE_TUNING.compounds[car.tire.compound].cliff;
  const projectedWear = car.tire.wear + stintLeft * 2.2;

  if (car.warning || car.latentFailure) pace = 'conserve';
  else if (ctx.sc !== 'none') pace = 'balanced';
  else if (remaining <= 4 && gapAhead < 1.6) pace = risk > 0.6 ? 'attack' : 'push';
  else if (gapAhead < 1.0 && car.tire.wear < 60) pace = 'push';
  else if (nextStop && nextStop.lap - lap <= 1) pace = 'push';
  else if (projectedWear > cliff + 10 && stintLeft > 4) {
    pace = 'conserve';
    tires = 'preserve';
  }
  if (gapBehind < 0.8 && pace === 'balanced') pace = 'push';
  if (pace === 'push' && risk < 0.3 && remaining > 10) pace = 'balanced';
  ins.pace = pace;
  ins.tires = tires;
  ins.defend = gapBehind < 0.9 && risk >= 0.35;

  if (cfg.ers) {
    if (car.ers < 20) ins.ers = 'harvest';
    else if (gapAhead < 1.0 && car.ers > 35) ins.ers = 'overtake';
    else if (gapBehind < 0.8 && car.ers > 30) ins.ers = 'deploy';
    else ins.ers = car.ers > 80 ? 'deploy' : 'balanced';
  }
  if (cfg.fuelManagement) {
    const need = (remaining + 1) * cfg.fuelBurnPerLap * 1.03;
    ins.fuel = car.fuel < need ? 'lean' : car.fuel > need * 1.05 && gapAhead < 1.5 ? 'rich' : 'standard';
  }
  // Team orders for AI teams: number-two drivers yield to a faster number one.
  if (!car.isPlayer && ahead && ahead.teamId === car.teamId) {
    const me = state.drivers[car.driverId];
    const mate = state.drivers[ahead.driverId];
    if (me.contract?.status === 'number1' && mate.contract?.status === 'number2' && gapAhead < 1.0 && remaining > 3) {
      ahead.instructions.teamOrder = 'letPass';
    }
  }
}

// ---------------------------------------------------------------------------
// The lap step
// ---------------------------------------------------------------------------

export function stepRaceLap(state: GameState, race: RaceState): void {
  if (race.finished) return;
  const lap = race.lap + 1;
  const rng = new Rng(race.rng);
  const circuit = state.circuits[race.circuitId];
  const cfg = DIVISIONS[race.division];
  const diff = DIFFICULTIES[state.settings.difficulty];
  const wx = race.weather[lap - 1] ?? race.weather[race.weather.length - 1];
  const prevWx = race.weather[lap - 2];
  const ctx: LapContext = {
    state,
    race,
    circuit,
    rng,
    lap,
    scale: race.baseLapTime / RACE_TUNING.referenceLap,
    wetness: wx.wetness,
    rain: wx.rain,
    trackTemp: wx.trackTemp,
    sc: race.safetyCar.type,
    incidents: [],
    fx: twistEffects(state, race.division),
  };
  const t = RACE_TUNING;
  const order = runningOrder(race);
  const prevPositions = new Map(order.map((c) => [c.driverId, c.position]));
  const leaderBefore = order[0]?.driverId;

  if (prevWx && prevWx.rain < 0.1 && wx.rain >= 0.1) pushLog(race, lap, 'weather', `Rain is falling at ${circuit.name}!`, [], true);
  if (prevWx && prevWx.rain >= 0.1 && wx.rain < 0.1) pushLog(race, lap, 'weather', 'The rain has stopped. A dry line will start to appear.', [], false);
  race.drsEnabled = cfg.drs && lap > 2 && ctx.sc === 'none' && ctx.wetness < 0.25 && !race.scLaps.includes(lap - 1);

  // 1. Decisions: instructions and pit calls.
  const pitCalls = new Map<string, TireCompound>();
  for (const car of order) {
    if (car.autoInstructions || !car.isPlayer) strategistInstructions(ctx, car, order);
    let pitCompound: TireCompound | null = null;
    if (car.pitRequest) {
      pitCompound = car.pitRequest;
      car.pitRequest = null;
    } else if (car.autoStrategy || !car.isPlayer) {
      pitCompound = strategistPitCall(ctx, car, order);
    }
    // Heavy damage forces a stop for repairs even without a call.
    if (!pitCompound && car.damage > 1.2 && race.totalLaps - lap > 2) pitCompound = car.tire.compound === 'intermediate' || car.tire.compound === 'wet' ? car.tire.compound : car.plan.stops[car.pitStops]?.compound ?? car.tire.compound;
    car.pitThisLap = !!pitCompound && lap < race.totalLaps;
    if (car.pitThisLap && pitCompound) pitCalls.set(car.driverId, pitCompound);
  }

  // 2. Raw lap times.
  const tentative = new Map<string, number>();
  const lapTimes = new Map<string, number>();
  const cleanPace = new Map<string, number>();
  // Failure odds are judged against the field's reliability, so a whole series
  // developing over the years does not make breakdowns vanish.
  const fieldReliability = race.cars.reduce((s, c) => s + reliabilityIndex(state.teams[c.teamId].car, ctx.trackTemp), 0) / Math.max(1, race.cars.length);
  for (const car of order) {
    const driver = state.drivers[car.driverId];
    const team = state.teams[car.teamId];
    const ins = car.instructions;
    const fatiguePenalty = Math.max(0, car.fatigue - 55) * 0.07;
    car.driverPerf = racePaceIndex(driver, circuit, ctx.wetness) - fatiguePenalty;
    let lapTime = basePace(race.baseLapTime, car.carPerf, car.driverPerf, car.setupQuality);
    lapTime += compoundPaceOffset(car.tire.compound, ctx.wetness, ctx.scale);
    lapTime += wearPenalty(car.tire.compound, car.tire.wear, ctx.scale);
    lapTime += car.fuel * t.fuelSecondsPerKg * ctx.scale;
    lapTime += t.paceModeOffset[ins.pace] * ctx.scale;
    lapTime += t.tireModeOffset[ins.tires] * ctx.scale;
    if (cfg.fuelManagement) lapTime += t.fuelModeOffset[ins.fuel] * ctx.scale;
    if (cfg.ers) {
      const usable = ins.ers === 'harvest' || ins.ers === 'balanced' || car.ers > 5;
      lapTime += (usable ? t.ersOffset[ins.ers] : 0) * ctx.scale;
    }
    lapTime += car.damage;
    if (car.warning) lapTime += 0.12 * car.warning.severity * ctx.scale;
    const idx = order.indexOf(car);
    if (idx > 0 && ctx.sc === 'none') {
      const interval = car.totalTime - order[idx - 1].totalTime;
      if (interval < t.dirtyAirWindow) lapTime += t.dirtyAirPenalty * (1 - interval / t.dirtyAirWindow) * ctx.scale * (0.55 + circuit.overtakingDifficulty * 0.6);
    }
    cleanPace.set(car.driverId, lapTime);
    lapTime += rng.normal(0, lapNoiseSd(driver.attributes.consistency, ctx.scale));

    // Lap 1 launch.
    if (lap === 1) {
      lapTime += rng.normal(0, t.startSd * (1.35 - driver.attributes.experience / 160));
      if (rng.chance(t.jumpStartChance)) {
        car.penaltySeconds += 5;
        race.stewards.push({ driverId: car.driverId, seconds: 5, points: 1, reason: 'Jump start', lap });
        pushLog(race, lap, 'penalty', `${driverShortName(driver)} jumped the start: 5 second penalty.`, [car.driverId], car.isPlayer);
      }
    }

    // Mistakes.
    const wetTyre = isWetCompound(car.tire.compound);
    const slickOnWet = !wetTyre && ctx.wetness > 0.18 ? 1 + (ctx.wetness - 0.18) * 14 : 1;
    const pressure = car.interval < 1 || (order[idx + 1] && order[idx + 1].totalTime - car.totalTime < 1) ? 1.35 - driver.attributes.mentality / 240 : 1;
    const pMistake =
      t.mistakeBase *
      ((100 - driver.attributes.consistency) / 50) ** 1.3 *
      t.paceModeMistake[ins.pace] *
      (1 + ctx.wetness * 2.2) *
      (1 + Math.max(0, car.fatigue - 50) / 50) *
      pressure *
      slickOnWet *
      (1.2 - driver.confidence / 250) *
      (lap === 1 ? 1.5 : 1) *
      (ctx.sc === 'sc' ? 0.12 : ctx.sc === 'vsc' ? 0.3 : 1);
    if (rng.chance(pMistake)) {
      const roll = rng.next();
      const crashShare = t.crashShare * (1 + ctx.wetness * 0.6) * (circuit.type === 'street' ? 1.5 : 1);
      if (roll < crashShare) {
        retire(race, car, lap, ctx.wetness > 0.3 ? 'Crashed in the wet' : 'Crashed');
        ctx.incidents.push({ severity: 'crash' });
        race.damageCosts[car.teamId] = (race.damageCosts[car.teamId] ?? 0) + cfg.repairCostScale * rng.range(0.6, 1.6);
        if (rng.chance(0.08 * (1.4 - driver.attributes.fitness / 100))) race.injuries[car.driverId] = rng.int(1, 6);
        pushLog(race, lap, 'crash', `CRASH! ${driverShortName(driver)} is in the barriers and out of the race.`, [car.driverId], true);
        continue;
      } else if (roll < crashShare + t.spinShare) {
        lapTime += rng.range(5, 12) * ctx.scale;
        car.tire.wear = Math.min(100, car.tire.wear + 6);
        pushLog(race, lap, 'mistake', `${driverShortName(driver)} spins! Loses a lot of time.`, [car.driverId], car.isPlayer || car.position <= 3);
      } else {
        lapTime += rng.range(0.4, 2.0) * ctx.scale;
        if (car.isPlayer) pushLog(race, lap, 'mistake', `${driverShortName(driver)} runs wide and loses time.`, [car.driverId], false);
      }
    }

    // Track limits.
    if (ctx.sc === 'none' && rng.chance(0.004 * (driver.attributes.aggression / 60) * t.paceModeMistake[ins.pace])) {
      car.trackLimitWarnings += 1;
      if (car.trackLimitWarnings === 4) {
        car.penaltySeconds += 5;
        race.stewards.push({ driverId: car.driverId, seconds: 5, points: 0, reason: 'Repeated track limits', lap });
        pushLog(race, lap, 'penalty', `${driverShortName(driver)}: 5 second penalty for exceeding track limits.`, [car.driverId], car.isPlayer);
      }
    }

    // Mechanical reliability.
    const relIdx = reliabilityIndex(team.car, ctx.trackTemp);
    const crew = staffRating(state, team, 'chiefMechanic');
    const pFail = cfg.failureRate * ctx.fx.failure * diff.reliabilityMultiplier * Math.exp((fieldReliability - relIdx) / 28) * failureFactor(ins.pace) * (1.25 - crew / 200);
    if (car.latentFailure) {
      car.latentFailure.health -= healthDrain(ins.pace);
      if (car.latentFailure.health <= 0) {
        const type = car.latentFailure.type;
        retire(race, car, lap, capitalise(FAILURE_TEXT[type]));
        race.failures[car.driverId] = type;
        ctx.incidents.push({ severity: 'failure' });
        pushLog(race, lap, 'failure', `${driverShortName(driver)} retires with ${FAILURE_TEXT[type]}.`, [car.driverId], true);
        continue;
      }
    } else if (rng.chance(pFail)) {
      const type = rng.weighted<FailureType>([
        { item: 'engine', weight: 0.25 },
        { item: 'gearbox', weight: 0.18 },
        { item: 'hydraulics', weight: 0.12 },
        { item: 'electrics', weight: 0.12 },
        { item: 'brakes', weight: 0.13 * circuit.brakeStress },
        { item: 'cooling', weight: 0.1 * (ctx.trackTemp > 32 ? 2 : 0.6) },
        { item: 'suspension', weight: 0.1 },
      ]);
      if (rng.chance(t.failureWarningShare) && lap < race.totalLaps - 1) {
        car.latentFailure = { type, health: rng.range(3, 10) };
        car.warning = { type, severity: rng.int(1, 3), lapIssued: lap };
        pushLog(race, lap, 'warning', `${driverShortName(driver)} has a ${type} warning.`, [car.driverId], car.isPlayer);
        radio(race, car, state, WARNING_TEXT[type]);
      } else {
        retire(race, car, lap, capitalise(FAILURE_TEXT[type]));
        race.failures[car.driverId] = type;
        ctx.incidents.push({ severity: 'failure' });
        pushLog(race, lap, 'failure', `${driverShortName(driver)} is out: ${FAILURE_TEXT[type]}!`, [car.driverId], true);
        continue;
      }
    }

    // Safety car / VSC pace.
    if (ctx.sc === 'sc') lapTime = race.baseLapTime * t.scLapFactor + rng.normal(0, 0.15);
    else if (ctx.sc === 'vsc') lapTime *= t.vscLapFactor;

    // Pit stop.
    const pitCompound = pitCalls.get(car.driverId);
    if (car.pitThisLap && pitCompound) {
      const lossFactor = ctx.sc === 'sc' ? t.scPitLossFactor : ctx.sc === 'vsc' ? t.vscPitLossFactor : 1;
      let stationary = t.stationaryBase + (1 - crew / 100) * t.stationaryCrewSkill + Math.abs(rng.normal(0, 0.25));
      let slow = false;
      if (rng.chance(t.slowStopChance * (1.4 - crew / 100))) {
        stationary += rng.range(2, 7);
        slow = true;
      }
      if (car.damage > 0.5) {
        stationary += 6;
        car.damage = 0;
        race.damageCosts[car.teamId] = (race.damageCosts[car.teamId] ?? 0) + cfg.repairCostScale * 0.3;
      }
      if (car.penaltySeconds > 0) {
        stationary += car.penaltySeconds;
        pushLog(race, lap, 'penalty', `${driverShortName(driver)} serves a ${car.penaltySeconds}s penalty in the pits.`, [car.driverId], car.isPlayer);
        car.penaltySeconds = 0;
      }
      lapTime += (circuit.pitLoss * Math.sqrt(race.baseLapTime / circuit.baseLapTime)) * lossFactor + stationary;
      const fromCompound = car.tire.compound;
      car.stints[car.stints.length - 1].toLap = lap;
      car.stints.push({ compound: pitCompound, fromLap: lap + 1, toLap: null });
      car.tire = { compound: pitCompound, age: 0, wear: 0 };
      if (!car.usedCompounds.includes(pitCompound)) car.usedCompounds.push(pitCompound);
      car.pitStops += 1;
      const msg = `${driverShortName(driver)} pits from P${car.position}: ${TIRE_TUNING.compounds[fromCompound].label} → ${TIRE_TUNING.compounds[pitCompound].label} (${stationary.toFixed(1)}s${slow ? ', slow stop!' : ''}).`;
      pushLog(race, lap, 'pit', msg, [car.driverId], car.isPlayer || car.position <= 3);
      if (car.isPlayer && slow) radio(race, car, state, 'Sorry, problem with the front-left. We lost time there.');
    }
    lapTimes.set(car.driverId, lapTime);
    tentative.set(car.driverId, car.totalTime + lapTime);
  }

  // 3. On-track battles, resolved front to back.
  const running = order.filter((c) => c.status === 'running');
  const philosophy = PHILOSOPHIES[state.player.philosophy];
  if (ctx.sc === 'none') {
    const passes = new Map<string, number>();
    for (let i = 1; i < running.length; i++) {
      let j = i;
      while (j > 0) {
        const car = running[j];
        const ahead = running[j - 1];
        if (car.status !== 'running') break;
        if (ahead.status !== 'running') {
          running[j] = ahead;
          running[j - 1] = car;
          j--;
          continue;
        }
        const tCar = tentative.get(car.driverId)!;
        const tAhead = tentative.get(ahead.driverId)!;
        if (tCar >= tAhead + 0.12) break;
        // Pit lane: no fight, the car that stays out simply passes or is passed.
        if (ahead.pitThisLap !== car.pitThisLap) {
          if (car.pitThisLap) {
            tentative.set(car.driverId, Math.max(tCar, tAhead + 0.3));
            break;
          }
          running[j] = ahead;
          running[j - 1] = car;
          j--;
          continue;
        }
        if (car.pitThisLap && ahead.pitThisLap) {
          if (tCar < tAhead) {
            running[j] = ahead;
            running[j - 1] = car;
            j--;
            continue;
          }
          break;
        }
        const count = passes.get(car.driverId) ?? 0;
        const sameTeam = car.teamId === ahead.teamId;
        if (sameTeam && ahead.instructions.teamOrder === 'letPass') {
          tentative.set(ahead.driverId, Math.max(tAhead, tCar) + 0.35);
          ahead.instructions.teamOrder = 'free';
          pushLog(race, lap, 'overtake', `Team orders: ${driverShortName(state.drivers[ahead.driverId])} lets ${driverShortName(state.drivers[car.driverId])} through.`, [car.driverId, ahead.driverId], car.isPlayer);
          running[j] = ahead;
          running[j - 1] = car;
          j--;
          continue;
        }
        if ((sameTeam && car.instructions.teamOrder === 'hold') || count >= (lap === 1 ? 3 : 2)) {
          tentative.set(car.driverId, tAhead + rng.range(0.5, 0.8));
          break;
        }
        const dCar = state.drivers[car.driverId];
        const dAhead = state.drivers[ahead.driverId];
        const advantage = tAhead + 0.12 - tCar;
        const interval = car.totalTime - ahead.totalTime;
        const paceAdvantage = clamp(((cleanPace.get(ahead.driverId) ?? 0) - (cleanPace.get(car.driverId) ?? 0)) / ctx.scale, -2, 2);
        let logit =
          t.overtakeAdvantageWeight * advantage +
          // Into the first corners the launch matters far more than race pace.
          t.overtakePaceWeight * paceAdvantage * (lap === 1 ? 0.3 : 1) +
          (attackIndex(dCar) - defenceIndex(dAhead)) * t.overtakeSkillWeight -
          circuit.overtakingDifficulty * t.overtakeDifficultyWeight * (lap === 1 ? 0.55 : 1) +
          t.overtakeBase +
          cfg.overtakeModifier +
          ctx.fx.overtake;
        if (race.drsEnabled && interval < 1.0) logit += t.drsBonus;
        if (cfg.ers && car.instructions.ers === 'overtake' && car.ers > 10) logit += t.ersOvertakeBonus;
        if (cfg.ers && ahead.instructions.ers === 'overtake' && ahead.ers > 10) logit -= t.ersOvertakeBonus * 0.6;
        if (ahead.instructions.defend) logit -= t.defendBonus;
        if (car.instructions.pace === 'attack') logit += 0.25;
        if (car.isPlayer) logit += philosophy.overtakeBonus;
        if (ahead.isPlayer && ahead.instructions.defend) logit -= philosophy.overtakeBonus * 0.5;
        if (ctx.wetness > 0.3) logit += (dCar.attributes.wetWeather - dAhead.attributes.wetWeather) / 40;
        // Having just been passed by this car, the attacker is rarely back in range at once.
        if (car.passedBy?.driverId === ahead.driverId && lap - car.passedBy.lap <= 2) logit -= t.repassPenalty;
        const pass = rng.chance(sigmoid(logit));
        // Contact risk on every attempt.
        const aggression = ((dCar.attributes.aggression + dAhead.attributes.aggression) / 120) ** 1.5;
        let pCol = t.collisionBase * aggression * (1 + ctx.wetness * 1.5) * (lap === 1 ? 2.2 : 1) * (car.instructions.pace === 'attack' ? 1.35 : 1) * (ahead.instructions.defend ? 1.25 : 1);
        if (dCar.personality === 'hotHeaded') pCol *= 1.35;
        if (car.isPlayer || ahead.isPlayer) pCol *= philosophy.collisionMultiplier;
        if (rng.chance(pCol)) {
          resolveCollision(ctx, car, ahead, tentative);
          break;
        }
        passes.set(car.driverId, count + 1);
        if (pass) {
          race.passes ??= { firstLap: 0, total: 0 };
          race.passes.total++;
          if (lap === 1) race.passes.firstLap++;
          ahead.passedBy = { driverId: car.driverId, lap };
          tentative.set(ahead.driverId, Math.max(tAhead + t.battleTimeLoss, tCar + 0.2));
          running[j] = ahead;
          running[j - 1] = car;
          if (j - 1 === 0 || car.isPlayer || ahead.isPlayer || j <= 3) {
            const forWhat = j - 1 === 0 ? ' for the LEAD' : ` for P${j}`;
            pushLog(race, lap, 'overtake', `${driverShortName(dCar)} passes ${driverShortName(dAhead)}${forWhat}!`, [car.driverId, ahead.driverId], j - 1 === 0 || car.isPlayer || ahead.isPlayer);
          }
          j--;
        } else {
          tentative.set(car.driverId, tAhead + rng.range(t.heldUpGapMin, t.heldUpGapMax) * (lap === 1 ? 0.6 : 1));
          tentative.set(ahead.driverId, tAhead + t.battleTimeLoss * 0.4);
          break;
        }
      }
    }
  } else {
    // Under safety car: hold position (pit lane excepted).
    for (let i = 1; i < running.length; i++) {
      const car = running[i];
      const ahead = running[i - 1];
      const tCar = tentative.get(car.driverId);
      const tAhead = tentative.get(ahead.driverId);
      if (tCar === undefined || tAhead === undefined) continue;
      if (car.pitThisLap || ahead.pitThisLap) continue;
      if (tCar < tAhead + 0.3) tentative.set(car.driverId, tAhead + 0.3);
    }
  }

  // 4. Commit lap.
  for (const car of race.cars) {
    if (car.status !== 'running') continue;
    const driver = state.drivers[car.driverId];
    const team = state.teams[car.teamId];
    const newTotal = tentative.get(car.driverId);
    if (newTotal === undefined) continue;
    const lapTime = newTotal - car.totalTime;
    car.totalTime = newTotal;
    car.lastLap = lapTime;
    car.lapsCompleted = lap;
    const sec = circuit.sectors.map((f) => lapTime * f * (1 + rng.normal(0, 0.004)));
    const sumSec = sec[0] + sec[1] + sec[2];
    car.sectors = sec.map((s) => (s * lapTime) / sumSec) as [number, number, number];
    if (ctx.sc === 'none' && !car.pitThisLap) {
      car.sectors.forEach((s, k) => {
        if (s < car.bestSectors[k]) car.bestSectors[k] = s;
      });
    }
    if (lapTime < car.bestLap && !car.pitThisLap && ctx.sc === 'none') {
      car.bestLap = lapTime;
      if (!race.fastestLap || lapTime < race.fastestLap.time) {
        race.fastestLap = { driverId: car.driverId, time: lapTime, lap };
        if (lap > 3) pushLog(race, lap, 'fastestLap', `Fastest lap: ${driverShortName(driver)}, ${formatShort(lapTime)}.`, [car.driverId], false);
      }
    }
    // Tyres, fuel, energy, fatigue.
    const idx = running.indexOf(car);
    const dirtyAir = idx > 0 && newTotal - (tentative.get(running[idx - 1].driverId) ?? 0) < t.dirtyAirWindow;
    if (!car.pitThisLap) {
      const sc = ctx.sc === 'sc' ? 0.35 : ctx.sc === 'vsc' ? 0.55 : 1;
      car.tire.wear = clamp(
        car.tire.wear +
          wearPerLap(car.tire.compound, {
            division: race.division,
            circuit,
            tireManagement: driver.attributes.tireManagement,
            carTireEfficiency: team.car.components.tireEfficiency,
            trackTemp: ctx.trackTemp,
            wetness: ctx.wetness,
            pace: car.instructions.pace,
            tireMode: car.instructions.tires,
            dirtyAir,
            wearMultiplier: ctx.fx.wear,
          }) *
            sc,
        0,
        100,
      );
      car.tire.age += 1;
    } else {
      car.tire.age = 0;
    }
    if (car.tire.wear >= TIRE_TUNING.punctureWear && rng.chance(0.25)) {
      car.totalTime += 12 * ctx.scale;
      car.tire.wear = 100;
      car.damage += 0.3;
      pushLog(race, lap, 'failure', `${driverShortName(driver)} suffers a puncture after running the tyres to destruction!`, [car.driverId], true);
      if (car.isPlayer) radio(race, car, state, 'Puncture! The tyre is gone!');
    }
    const burn = cfg.fuelBurnPerLap * (cfg.fuelManagement ? t.fuelModeBurn[car.instructions.fuel] : 1) * (car.instructions.pace === 'attack' ? 1.05 : car.instructions.pace === 'push' ? 1.025 : car.instructions.pace === 'conserve' ? 0.97 : 1) * (ctx.sc !== 'none' ? 0.6 : 1);
    car.fuel = Math.max(0, car.fuel - burn);
    const remaining = race.totalLaps - lap;
    if (cfg.fuelManagement && remaining > 0 && car.fuel < remaining * cfg.fuelBurnPerLap * 0.985 && car.instructions.fuel !== 'lean') {
      car.instructions.fuel = 'lean';
      radio(race, car, state, 'Fuel is critical, I have to lift and coast.');
    }
    if (car.fuel <= 0 && remaining > 0) {
      retire(race, car, lap, 'Out of fuel');
      pushLog(race, lap, 'failure', `${driverShortName(driver)} has run out of fuel!`, [car.driverId], true);
      continue;
    }
    if (cfg.ers) car.ers = clamp(car.ers + t.ersCharge[car.instructions.ers], 0, 100);
    car.fatigue = clamp(car.fatigue + (1.25 - driver.attributes.fitness / 100) * 1.3 * t.paceModeFatigue[car.instructions.pace] * (1 + ctx.wetness * 0.2) * (circuit.type === 'street' ? 1.1 : 1), 0, 100);
    if (car.warning && lap - car.warning.lapIssued > 12 && car.latentFailure && car.latentFailure.health > 2 && car.instructions.pace === 'conserve') {
      // Nursed long enough: the issue stabilises.
      car.warning = null;
      car.latentFailure = null;
      radio(race, car, state, 'Temperatures are back under control.');
    }
    if (car.isPlayer && car.tire.wear > TIRE_TUNING.compounds[car.tire.compound].cliff - 6 && car.tire.wear - wearRateApprox(car) <= TIRE_TUNING.compounds[car.tire.compound].cliff - 6) {
      radio(race, car, state, 'These tyres are finished. I am losing grip everywhere!');
    }
    car.pitThisLap = false;
  }
  for (const car of race.cars) car.pitThisLap = false;

  // 5. Positions and gaps.
  sortAndPosition(race);
  if (ctx.sc === 'sc') compressField(race, rng);
  const nowRunning = runningOrder(race);
  if (nowRunning[0]) nowRunning[0].lapsLed += 1;
  if (leaderBefore && nowRunning[0] && nowRunning[0].driverId !== leaderBefore && lap > 1) {
    const already = race.log.some((l) => l.lap === lap && l.type === 'overtake' && l.text.includes('LEAD'));
    if (!already) pushLog(race, lap, 'info', `${driverShortName(state.drivers[nowRunning[0].driverId])} takes the lead!`, [nowRunning[0].driverId], true);
  }
  for (const car of race.cars) {
    if (car.status !== 'running') continue;
    car.history.push({ lap, position: car.position, lapTime: car.lastLap, compound: car.tire.compound });
    if (car.isPlayer) {
      const before = prevPositions.get(car.driverId) ?? car.position;
      if (before - car.position >= 2) radio(race, car, state, `Great work, up to P${car.position}!`);
    }
  }
  race.lapOrders.push(race.cars.filter((c) => c.status === 'running').sort((a, b) => a.position - b.position).map((c) => c.driverId));

  // 6. Safety car management.
  updateSafetyCar(ctx);

  race.lap = lap;
  race.rng = rng.state;
  if (lap >= race.totalLaps) finishRace(state, race);
}

function wearRateApprox(car: CarRaceState): number {
  return car.tire.age > 0 ? car.tire.wear / car.tire.age : 2;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShort(t: number): string {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(3).padStart(6, '0')}`;
}

function resolveCollision(ctx: LapContext, car: CarRaceState, ahead: CarRaceState, tentative: Map<string, number>): void {
  const { race, rng, state, lap } = ctx;
  const cfg = DIVISIONS[race.division];
  const dA = state.drivers[car.driverId];
  const dB = state.drivers[ahead.driverId];
  const roll = rng.next();
  const names = `${driverShortName(dA)} and ${driverShortName(dB)}`;
  let retirement = false;
  if (roll < 0.45) {
    car.damage += rng.range(0.25, 0.8) * ctx.scale;
    tentative.set(car.driverId, (tentative.get(car.driverId) ?? car.totalTime) + 1.5);
    pushLog(race, lap, 'collision', `Contact between ${names}! ${driverShortName(dA)} has front-wing damage.`, [car.driverId, ahead.driverId], car.isPlayer || ahead.isPlayer);
  } else if (roll < 0.65) {
    ahead.tire.wear = 100;
    ahead.damage += 0.2;
    tentative.set(ahead.driverId, (tentative.get(ahead.driverId) ?? ahead.totalTime) + 9 * ctx.scale);
    tentative.set(car.driverId, (tentative.get(car.driverId) ?? car.totalTime) + 0.8);
    pushLog(race, lap, 'collision', `${driverShortName(dA)} clips ${driverShortName(dB)}: PUNCTURE for ${driverShortName(dB)}!`, [car.driverId, ahead.driverId], true);
  } else if (roll < 0.8) {
    retire(race, car, lap, 'Collision');
    retirement = true;
    tentative.delete(car.driverId);
    pushLog(race, lap, 'collision', `${driverShortName(dA)} is out after hitting ${driverShortName(dB)}!`, [car.driverId, ahead.driverId], true);
  } else if (roll < 0.9) {
    retire(race, ahead, lap, 'Collision');
    retirement = true;
    tentative.delete(ahead.driverId);
    pushLog(race, lap, 'collision', `${driverShortName(dB)} is taken out by ${driverShortName(dA)}!`, [car.driverId, ahead.driverId], true);
  } else {
    retire(race, car, lap, 'Collision');
    retire(race, ahead, lap, 'Collision');
    retirement = true;
    tentative.delete(car.driverId);
    tentative.delete(ahead.driverId);
    pushLog(race, lap, 'collision', `BIG CRASH! ${names} are both out!`, [car.driverId, ahead.driverId], true);
  }
  if (retirement) {
    ctx.incidents.push({ severity: 'collision' });
    race.damageCosts[car.teamId] = (race.damageCosts[car.teamId] ?? 0) + cfg.repairCostScale * rng.range(0.5, 1.3);
    race.damageCosts[ahead.teamId] = (race.damageCosts[ahead.teamId] ?? 0) + cfg.repairCostScale * rng.range(0.3, 1.0);
  }
  // Stewards: the attacker is usually to blame.
  const blameChance = 0.45 + (dA.attributes.aggression - 50) / 200;
  if (rng.chance(blameChance)) {
    const seconds = retirement ? 10 : 5;
    const points = retirement ? 3 : 2;
    if (car.status === 'running') car.penaltySeconds += seconds;
    race.stewards.push({ driverId: car.driverId, seconds, points, reason: 'Causing a collision', lap });
    pushLog(race, lap, 'penalty', `Stewards: ${seconds}s penalty and ${points} penalty points for ${driverShortName(dA)} for causing a collision.`, [car.driverId], true);
  } else {
    pushLog(race, lap, 'info', `Stewards: no further action. Racing incident.`, [car.driverId, ahead.driverId], false);
  }
}

function compressField(race: RaceState, rng: Rng): void {
  const running = race.cars.filter((c) => c.status === 'running').sort((a, b) => a.position - b.position);
  for (let i = 1; i < running.length; i++) {
    const target = running[i - 1].totalTime + 0.45 + rng.range(0, 0.25);
    const car = running[i];
    if (car.totalTime > target) car.totalTime = target + (car.totalTime - target) * (1 - RACE_TUNING.scGapCompression);
  }
  const leader = running[0];
  for (let i = 0; i < running.length; i++) {
    running[i].gapToLeader = running[i].totalTime - (leader?.totalTime ?? 0);
    running[i].interval = i === 0 ? 0 : running[i].totalTime - running[i - 1].totalTime;
  }
}

function updateSafetyCar(ctx: LapContext): void {
  const { race, rng, circuit, lap } = ctx;
  const t = RACE_TUNING;
  const sc = race.safetyCar;
  if (sc.type !== 'none') {
    race.scLaps.push(lap);
    sc.lapsRemaining -= 1;
    if (sc.lapsRemaining <= 0) {
      pushLog(race, lap, 'safetyCarEnd', sc.type === 'sc' ? 'Safety car in this lap. Racing resumes!' : 'VSC ending. Green flag!', [], true);
      sc.type = 'none';
    }
    return;
  }
  if (lap >= race.totalLaps - 1 || ctx.incidents.length === 0) return;
  let pSc = 0;
  let pVsc = 0;
  for (const inc of ctx.incidents) {
    if (inc.severity === 'failure') {
      pSc = Math.max(pSc, t.scChanceFailure * circuit.safetyCarRisk);
      pVsc = Math.max(pVsc, t.vscChanceFailure);
    } else {
      pSc = Math.max(pSc, t.scChanceCrash * circuit.safetyCarRisk * (ctx.wetness > 0.4 ? 1.2 : 1));
      pVsc = Math.max(pVsc, t.vscChanceCrash);
    }
  }
  if (ctx.incidents.length >= 2) pSc = Math.min(0.95, pSc * 1.4);
  const roll = rng.next();
  if (roll < pSc) {
    sc.type = 'sc';
    sc.lapsRemaining = rng.int(3, 5);
    sc.count += 1;
    pushLog(race, lap, 'safetyCar', 'SAFETY CAR deployed! The field will bunch up.', [], true);
  } else if (roll < pSc + pVsc * (1 - pSc)) {
    sc.type = 'vsc';
    sc.lapsRemaining = rng.int(1, 3);
    sc.vscCount += 1;
    pushLog(race, lap, 'vsc', 'VIRTUAL SAFETY CAR. Drivers must slow down.', [], true);
  }
}

function finishRace(state: GameState, race: RaceState): void {
  for (const car of race.cars) {
    if (car.status === 'running' && car.penaltySeconds > 0) {
      car.totalTime += car.penaltySeconds;
    }
  }
  sortAndPosition(race);
  for (const car of race.cars) if (car.status === 'running') car.stints[car.stints.length - 1].toLap = race.totalLaps;
  race.finished = true;
  const winner = race.cars.find((c) => c.position === 1);
  if (winner) pushLog(race, race.totalLaps, 'finish', `CHEQUERED FLAG! ${driverShortName(state.drivers[winner.driverId])} wins!`, [winner.driverId], true);
  for (const car of race.cars) {
    if (car.isPlayer && car.status === 'running') {
      radio(race, car, state, car.position === 1 ? 'YES! YES! We won! Thank you everyone!' : car.position <= 3 ? `Podium! P${car.position}! What a job!` : `P${car.position}. We take that and keep pushing.`);
    }
  }
}

/** Advance until the next key event (or the end). Returns number of laps run. */
export function stepToNextKeyEvent(state: GameState, race: RaceState): number {
  let laps = 0;
  const before = race.log.length;
  while (!race.finished) {
    stepRaceLap(state, race);
    laps++;
    if (race.log.slice(before).some((l) => l.key)) break;
  }
  return laps;
}

export function runRaceToEnd(state: GameState, race: RaceState): void {
  let guard = 0;
  while (!race.finished && guard++ < 500) stepRaceLap(state, race);
}

export function lapsDownText(gap: number, avgLap: number): string {
  const laps = Math.floor(gap / avgLap);
  return laps >= 1 ? `+${laps} Lap${laps > 1 ? 's' : ''}` : `+${gap.toFixed(3)}`;
}
