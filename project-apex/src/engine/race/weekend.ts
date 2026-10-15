import { AI_PERSONALITIES, PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS, raceLapsFor } from '../config/divisions';
import { RACE_TUNING } from '../config/tuning';
import { trackPerformance } from '../car/car';
import { assignPoints, divisionStandings, pointsRemaining } from '../championship/standings';
import { driverName, driverShortName, overall, racePaceIndex } from '../drivers/ratings';
import { postTransaction } from '../finance/ledger';
import { aiSponsorIncomePerRace, expectationProgress, projectedPosition } from '../finance/sponsors';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { Rng } from '../rng';
import { findEvent } from '../season/calendar';
import { playerTeam, teamsInDivision } from '../selectors';
import { staffRating } from '../staff/staff';
import type {
  CalendarEvent,
  Driver,
  GameState,
  PracticeRun,
  QualifyingEntry,
  RaceInstructions,
  RaceResult,
  RaceResultEntry,
  RaceState,
  Setup,
  StrategyPlan,
  Team,
  WeekendState,
} from '../types';
import { assertRule, clamp, ordinal } from '../util';
import { createRaceState, DEFAULT_INSTRUCTIONS, lapsDownText, NO_TIME, runRaceToEnd, stepRaceLap, stepToNextKeyEvent, type RaceEntrantInput } from './engine';
import { basePace, divisionBaseLap, formatRaceTime } from './pace';
import { buildQualifying, combineSessions, qualifyingWetness, runSessions, sessionSizes, type QualiEntrant, type QualiRisk } from './qualifying';
import { DEFAULT_SETUP, engineerAdjust, feedbackAccuracy, idealSetup, setupFeedback, setupQuality } from './setup';
import { planStrategies, type StrategyInputs } from './strategy';
import { expectedWear } from './tires';
import { forecastFor, generateEventWeather } from './weather';

// ---------------------------------------------------------------------------
// Line-ups
// ---------------------------------------------------------------------------

export function driverAvailable(d: Driver | undefined | null): boolean {
  return !!d && !d.retired && !d.injury && d.raceBan <= 0;
}

export interface LineupSlot {
  seat: number;
  regularId: string | null;
  driverId: string | null;
  substitute: boolean;
  reason: string | null;
}

/** Who drives each car this weekend: regular drivers, or the reserve/academy as substitute. */
export function eventLineup(state: GameState, team: Team): LineupSlot[] {
  const used = new Set<string>();
  const slots: LineupSlot[] = [];
  const backups = [team.reserveDriverId, ...team.academyDriverIds.filter((id) => (state.drivers[id]?.age ?? 0) >= 16)].filter((id): id is string => !!id);
  for (let seat = 0; seat < 2; seat++) {
    const regularId = team.raceDrivers[seat];
    const regular = regularId ? state.drivers[regularId] : null;
    if (regular && driverAvailable(regular)) {
      slots.push({ seat, regularId, driverId: regularId, substitute: false, reason: null });
      used.add(regularId!);
      continue;
    }
    const reason = !regular ? 'Seat vacant' : regular.injury ? `${driverShortName(regular)} injured` : regular.raceBan > 0 ? `${driverShortName(regular)} banned` : 'Unavailable';
    const sub = backups.find((id) => !used.has(id) && driverAvailable(state.drivers[id]));
    if (sub) {
      used.add(sub);
      slots.push({ seat, regularId, driverId: sub, substitute: true, reason });
    } else {
      slots.push({ seat, regularId, driverId: null, substitute: false, reason });
    }
  }
  return slots;
}

export function lineupIssues(state: GameState, team: Team): string[] {
  return eventLineup(state, team)
    .filter((s) => s.substitute || !s.driverId)
    .map((s) => (s.driverId ? `${s.reason}: ${driverShortName(state.drivers[s.driverId])} will deputise.` : `${s.reason}: car ${s.seat + 1} cannot start without a driver.`));
}

interface Participant {
  driverId: string;
  teamId: string;
}

export function participantsFor(state: GameState, event: CalendarEvent): Participant[] {
  const out: Participant[] = [];
  for (const team of teamsInDivision(state, event.division)) {
    for (const slot of eventLineup(state, team)) if (slot.driverId) out.push({ driverId: slot.driverId, teamId: team.id });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

export function strategyAccuracy(state: GameState, team: Team, tireKnowledge = 50): number {
  const strategist = staffRating(state, team, 'headStrategist') / 100;
  return clamp(strategist * 0.5 + (team.facilities.strategy.level / 10) * 0.25 + (tireKnowledge / 100) * 0.25, 0.05, 1);
}

export function strategyInputs(state: GameState, event: CalendarEvent, driverId: string, teamId: string, accuracy: number): StrategyInputs {
  const circuit = state.circuits[event.circuitId];
  const laps = raceLapsFor(event.division, circuit.laps);
  const weather = generateEventWeather(state.seed, event.id, circuit, laps);
  const driver = state.drivers[driverId];
  const team = state.teams[teamId];
  return {
    division: event.division,
    circuit,
    laps,
    baseLap: divisionBaseLap(circuit, event.division),
    tireManagement: driver.attributes.tireManagement,
    carTireEfficiency: team.car.components.tireEfficiency,
    trackTemp: weather.race[0]?.trackTemp ?? circuit.baseTrackTemp,
    startWetness: weather.race[0]?.wetness ?? 0,
    accuracy,
  };
}

function aiPlan(state: GameState, event: CalendarEvent, p: Participant): StrategyPlan {
  const team = state.teams[p.teamId];
  const rng = Rng.from(state.seed, 'aiStrategy', event.id, p.driverId);
  const accuracy = strategyAccuracy(state, team, 40 + team.facilities.strategy.level * 5);
  const options = planStrategies(strategyInputs(state, event, p.driverId, p.teamId, accuracy), rng, 3);
  const risk = team.aiPersonality ? AI_PERSONALITIES[team.aiPersonality].raceRisk : 0.5;
  // Bold strategists sometimes gamble on an alternative plan.
  if (options.length > 1 && rng.chance(0.15 + risk * 0.25)) return options[1];
  return options[0];
}

// ---------------------------------------------------------------------------
// Player weekend
// ---------------------------------------------------------------------------

export function startPlayerWeekend(state: GameState, eventId: string): WeekendState {
  const event = findEvent(state, eventId);
  assertRule(event, 'Unknown event.');
  const team = playerTeam(state);
  assertRule(event.division === team.division, 'This event is not in your division.');
  assertRule(!event.completed, 'This event has already been completed.');
  const circuit = state.circuits[event.circuitId];
  const cfg = DIVISIONS[event.division];
  const weather = generateEventWeather(state.seed, event.id, circuit, raceLapsFor(event.division, circuit.laps));
  const accuracy = strategyAccuracy(state, team, 30);
  const lineup = eventLineup(state, team).filter((s) => s.driverId);
  const weekend: WeekendState = {
    eventId,
    phase: 'practice',
    forecast: forecastFor(state.seed, event.id, team.id, weather, accuracy),
    practice: {
      runsRemaining: Object.fromEntries(lineup.map((s) => [s.driverId!, cfg.practiceRuns])),
      setups: Object.fromEntries(lineup.map((s) => [s.driverId!, { ...DEFAULT_SETUP }])),
      runs: Object.fromEntries(lineup.map((s) => [s.driverId!, [] as PracticeRun[]])),
      bestSetupQuality: Object.fromEntries(lineup.map((s) => [s.driverId!, 0])),
      tireKnowledge: 15 + team.facilities.strategy.level * 4,
    },
    qualifying: { sessionIndex: 0, result: null, riskMode: Object.fromEntries(lineup.map((s) => [s.driverId!, 'normal'])), sessionResults: [] },
    setupQuality: {},
    strategies: {},
    strategyOptions: {},
    startInstructions: Object.fromEntries(lineup.map((s) => [s.driverId!, { ...DEFAULT_INSTRUCTIONS }])),
    startFuelMargin: Object.fromEntries(lineup.map((s) => [s.driverId!, 0.01])),
    race: null,
    resultApplied: false,
  };
  // AI teams prepare their cars over the weekend.
  for (const p of participantsFor(state, event)) {
    if (p.teamId === team.id) continue;
    weekend.setupQuality[p.driverId] = aiQuality(state, event, p);
  }
  state.weekend = weekend;
  state.phase = 'weekend';
  return weekend;
}

/**
 * AI teams run exactly the same practice programme the player's race engineer
 * would: set off from a baseline setup, read the driver's (sometimes wrong)
 * feedback and adjust. Better engineers, simulators and experienced drivers
 * converge faster. No hidden bonus or penalty for either side.
 */
function aiQuality(state: GameState, event: CalendarEvent, p: Participant): number {
  const team = state.teams[p.teamId];
  const driver = state.drivers[p.driverId];
  const circuit = state.circuits[event.circuitId];
  const ideal = idealSetup(state.seed, event.id, circuit, driver);
  const engineer = staffRating(state, team, 'raceEngineer');
  const accuracy = feedbackAccuracy(driver, engineer, team.facilities.simulator.level);
  const rng = Rng.from(state.seed, 'aiPractice', event.id, p.driverId);
  let setup: Setup = { ...DEFAULT_SETUP };
  let best = 0;
  for (let i = 0; i < DIVISIONS[event.division].practiceRuns; i++) {
    best = Math.max(best, setupQuality(setup, ideal));
    setup = engineerAdjust(setup, setupFeedback(rng, setup, ideal, accuracy), engineer);
  }
  return best;
}

function requireWeekend(state: GameState, phase?: WeekendState['phase']): { weekend: WeekendState; event: CalendarEvent } {
  const weekend = state.weekend;
  assertRule(weekend, 'There is no race weekend in progress.');
  if (phase) assertRule(weekend.phase === phase, `This action is only available during ${phase}.`);
  const event = findEvent(state, weekend.eventId);
  assertRule(event, 'Unknown event.');
  return { weekend, event };
}

export function setPracticeSetup(state: GameState, driverId: string, setup: Setup): void {
  const { weekend } = requireWeekend(state, 'practice');
  assertRule(weekend.practice.setups[driverId], 'That driver is not taking part.');
  const clean = {} as Setup;
  for (const k of Object.keys(DEFAULT_SETUP) as (keyof Setup)[]) clean[k] = Math.round(clamp(Number(setup[k]) || 0, 0, 100));
  weekend.practice.setups[driverId] = clean;
}

export function runPractice(state: GameState, driverId: string, program: PracticeRun['program'] = 'setup'): PracticeRun {
  const { weekend, event } = requireWeekend(state, 'practice');
  const remaining = weekend.practice.runsRemaining[driverId];
  assertRule(remaining !== undefined, 'That driver is not taking part.');
  assertRule(remaining > 0, 'No practice runs remaining for this driver.');
  const team = playerTeam(state);
  const driver = state.drivers[driverId];
  const circuit = state.circuits[event.circuitId];
  const runIndex = weekend.practice.runs[driverId].length;
  const rng = Rng.from(state.seed, 'practice', event.id, driverId, runIndex);
  const setup = weekend.practice.setups[driverId];
  const ideal = idealSetup(state.seed, event.id, circuit, driver);
  const quality = setupQuality(setup, ideal);
  const accuracy = feedbackAccuracy(driver, staffRating(state, team, 'raceEngineer'), team.facilities.simulator.level) * (program === 'longRun' ? 0.85 : 1);
  const feedback = setupFeedback(rng, setup, ideal, accuracy);
  const weather = generateEventWeather(state.seed, event.id, circuit, raceLapsFor(event.division, circuit.laps));
  const baseLap = divisionBaseLap(circuit, event.division);
  const lapTime =
    basePace(baseLap, trackPerformance(team.car, circuit), racePaceIndex(driver, circuit, weather.practiceWetness), quality) +
    (program === 'qualiSim' ? -0.6 : 0.9) * (baseLap / RACE_TUNING.referenceLap) +
    weather.practiceWetness * 6 +
    rng.normal(0, 0.2);
  const run: PracticeRun = { run: runIndex + 1, setup: { ...setup }, lapTime, feedback, setupQuality: quality, program };
  if (program === 'longRun') {
    weekend.practice.tireKnowledge = clamp(weekend.practice.tireKnowledge + 28, 0, 100);
    const knowledge = weekend.practice.tireKnowledge / 100;
    run.tireNotes = DIVISIONS[event.division].dryCompounds.map((c) => ({
      compound: c,
      degPerLap: Math.round(expectedWear(c, event.division, circuit, driver.attributes.tireManagement, team.car.components.tireEfficiency, weather.race[0]?.trackTemp ?? circuit.baseTrackTemp) * (1 + rng.normal(0, 0.2 * (1 - knowledge))) * 100) / 100,
    }));
  }
  if (program === 'qualiSim') driver.confidence = clamp(driver.confidence + 2, 0, 100);
  weekend.practice.runs[driverId].push(run);
  weekend.practice.runsRemaining[driverId] = remaining - 1;
  weekend.practice.bestSetupQuality[driverId] = Math.max(weekend.practice.bestSetupQuality[driverId] ?? 0, quality);
  return run;
}

/** Let the race engineer use the remaining runs, iterating on driver feedback. */
export function autoPractice(state: GameState, driverId: string): void {
  const { weekend } = requireWeekend(state, 'practice');
  const team = playerTeam(state);
  const engineer = staffRating(state, team, 'raceEngineer');
  let guard = 0;
  while ((weekend.practice.runsRemaining[driverId] ?? 0) > 0 && guard++ < 20) {
    const isLast = weekend.practice.runsRemaining[driverId] === 1 && weekend.practice.tireKnowledge < 60;
    const run = runPractice(state, driverId, isLast ? 'longRun' : 'setup');
    weekend.practice.setups[driverId] = engineerAdjust(run.setup, run.feedback, engineer);
  }
}

export function finishPractice(state: GameState): void {
  const { weekend, event } = requireWeekend(state, 'practice');
  for (const driverId of Object.keys(weekend.practice.setups)) {
    const runs = weekend.practice.runs[driverId];
    let quality = weekend.practice.bestSetupQuality[driverId] ?? 0;
    if (runs.length === 0) {
      // No running at all: the car races on its baseline setup.
      quality = setupQuality(DEFAULT_SETUP, idealSetup(state.seed, event.id, state.circuits[event.circuitId], state.drivers[driverId]));
    }
    weekend.setupQuality[driverId] = quality;
    const driver = state.drivers[driverId];
    driver.confidence = clamp(driver.confidence + (quality - 65) / 6, 5, 95);
  }
  weekend.phase = 'qualifying';
}

export function setQualifyingRisk(state: GameState, driverId: string, risk: QualiRisk): void {
  const { weekend } = requireWeekend(state, 'qualifying');
  assertRule(weekend.qualifying.riskMode[driverId] !== undefined, 'That driver is not taking part.');
  weekend.qualifying.riskMode[driverId] = risk;
}

function qualiEntrants(state: GameState, event: CalendarEvent, weekend: WeekendState): QualiEntrant[] {
  const pTeam = state.player.teamId;
  return participantsFor(state, event).map((p) => {
    const team = state.teams[p.teamId];
    const risk: QualiRisk = p.teamId === pTeam ? weekend.qualifying.riskMode[p.driverId] ?? 'normal' : team.aiPersonality && AI_PERSONALITIES[team.aiPersonality].raceRisk > 0.7 ? 'maximum' : 'normal';
    return { driverId: p.driverId, teamId: p.teamId, setupQuality: weekend.setupQuality[p.driverId] ?? 60, risk };
  });
}

export function runNextQualifyingSession(state: GameState): QualifyingEntry[] {
  const { weekend, event } = requireWeekend(state, 'qualifying');
  const entrants = qualiEntrants(state, event, weekend);
  const sizes = sessionSizes(event.division, entrants.length);
  const idx = weekend.qualifying.sessionIndex;
  assertRule(idx < sizes.length, 'Qualifying is complete.');
  const sessions = runSessions(state, event, entrants, idx + 1, weekend.qualifying.sessionResults);
  weekend.qualifying.sessionResults = sessions;
  weekend.qualifying.sessionIndex = idx + 1;
  weekend.qualifying.result = combineSessions(state, entrants, sessions, sizes, event);
  if (weekend.qualifying.sessionIndex >= sizes.length) enterRaceSetup(state, weekend, event);
  return sessions[idx];
}

function enterRaceSetup(state: GameState, weekend: WeekendState, event: CalendarEvent): void {
  const team = playerTeam(state);
  const accuracy = strategyAccuracy(state, team, weekend.practice.tireKnowledge);
  for (const driverId of Object.keys(weekend.practice.setups)) {
    const rng = Rng.from(state.seed, 'playerStrategy', event.id, driverId);
    const options = planStrategies(strategyInputs(state, event, driverId, team.id, accuracy), rng, 4);
    weekend.strategyOptions[driverId] = options;
    weekend.strategies[driverId] = options[0];
  }
  weekend.phase = 'raceSetup';
}

export function chooseStrategy(state: GameState, driverId: string, optionIndex: number): void {
  const { weekend } = requireWeekend(state, 'raceSetup');
  const options = weekend.strategyOptions[driverId];
  assertRule(options && options[optionIndex], 'Unknown strategy option.');
  weekend.strategies[driverId] = options[optionIndex];
}

export function setStartInstructions(state: GameState, driverId: string, patch: Partial<RaceInstructions>): void {
  const { weekend } = requireWeekend(state, 'raceSetup');
  assertRule(weekend.startInstructions[driverId], 'That driver is not taking part.');
  weekend.startInstructions[driverId] = { ...weekend.startInstructions[driverId], ...patch };
}

export function setFuelMargin(state: GameState, driverId: string, margin: number): void {
  const { weekend, event } = requireWeekend(state, 'raceSetup');
  assertRule(DIVISIONS[event.division].fuelManagement, 'Fuel loads are fixed by the regulations in this division.');
  assertRule(margin >= -0.05 && margin <= 0.06, 'Fuel margin must be between -5% and +6%.');
  weekend.startFuelMargin[driverId] = margin;
}

function buildEntrants(state: GameState, event: CalendarEvent, quali: QualifyingEntry[], weekend: WeekendState | null, playerAuto: boolean): RaceEntrantInput[] {
  const pTeam = state.player.teamId;
  return quali.map((q) => {
    const isPlayer = q.teamId === pTeam && !playerAuto;
    const team = state.teams[q.teamId];
    const plan = isPlayer && weekend ? weekend.strategies[q.driverId] : aiPlan(state, event, { driverId: q.driverId, teamId: q.teamId });
    const margin = isPlayer && weekend ? weekend.startFuelMargin[q.driverId] ?? 0.01 : team.aiPersonality === 'gambler' ? -0.01 : 0.01;
    return {
      driverId: q.driverId,
      teamId: q.teamId,
      grid: q.grid,
      setupQuality: weekend?.setupQuality[q.driverId] ?? 60,
      plan,
      instructions: isPlayer && weekend ? { ...weekend.startInstructions[q.driverId] } : { ...DEFAULT_INSTRUCTIONS },
      autoStrategy: true,
      autoInstructions: true,
      fuelMargin: margin,
      isPlayer,
    };
  });
}

export function startRace(state: GameState): RaceState {
  const { weekend, event } = requireWeekend(state, 'raceSetup');
  const quali = weekend.qualifying.result;
  assertRule(quali, 'Qualifying has not been completed.');
  const race = createRaceState(state, event, buildEntrants(state, event, quali.entries, weekend, false));
  weekend.race = race;
  weekend.phase = 'race';
  return race;
}

export type RaceAdvanceMode = 'lap' | 'key' | 'finish';

export function advanceRace(state: GameState, mode: RaceAdvanceMode): void {
  const { weekend } = requireWeekend(state, 'race');
  const race = weekend.race;
  assertRule(race, 'The race has not started.');
  if (race.finished) return;
  if (mode === 'lap') stepRaceLap(state, race);
  else if (mode === 'key') stepToNextKeyEvent(state, race);
  else runRaceToEnd(state, race);
  if (race.finished) completePlayerRace(state);
}

function completePlayerRace(state: GameState): void {
  const { weekend, event } = requireWeekend(state, 'race');
  const race = weekend.race!;
  if (weekend.resultApplied) return;
  const result = classify(state, event, race, weekend.qualifying.result!.entries);
  applyRaceResult(state, result, race);
  weekend.resultApplied = true;
  weekend.phase = 'complete';
}

/** Close the weekend and return to the season calendar. */
export function closeWeekend(state: GameState): void {
  const { weekend } = requireWeekend(state, 'complete');
  assertRule(weekend.resultApplied, 'The race result has not been recorded yet.');
  state.weekend = null;
  state.phase = 'season';
}

// ---------------------------------------------------------------------------
// Automatic weekends (AI divisions, holiday mode)
// ---------------------------------------------------------------------------

export function simulateEventAutomatically(state: GameState, event: CalendarEvent): RaceResult {
  assertRule(!event.completed, 'Event already completed.');
  const participants = participantsFor(state, event);
  const pseudoWeekend = { setupQuality: {} as Record<string, number> } as WeekendState;
  for (const p of participants) pseudoWeekend.setupQuality[p.driverId] = aiQuality(state, event, p);
  const entrants: QualiEntrant[] = participants.map((p) => {
    const team = state.teams[p.teamId];
    const risk: QualiRisk = team.aiPersonality && AI_PERSONALITIES[team.aiPersonality].raceRisk > 0.7 ? 'maximum' : 'normal';
    return { driverId: p.driverId, teamId: p.teamId, setupQuality: pseudoWeekend.setupQuality[p.driverId], risk };
  });
  const sizes = sessionSizes(event.division, entrants.length);
  const quali = buildQualifying(state, event, entrants, sizes.length);
  const race = createRaceState(state, event, buildEntrants(state, event, quali.entries, pseudoWeekend, true));
  runRaceToEnd(state, race);
  const result = classify(state, event, race, quali.entries);
  applyRaceResult(state, result, race);
  return result;
}

// ---------------------------------------------------------------------------
// Classification and result application
// ---------------------------------------------------------------------------

export function classify(state: GameState, event: CalendarEvent, race: RaceState, quali: QualifyingEntry[]): RaceResult {
  assertRule(race.finished, 'Race is not finished.');
  const sorted = [...race.cars].sort((a, b) => a.position - b.position);
  const leader = sorted[0];
  const avgLap = leader ? leader.totalTime / Math.max(1, race.totalLaps) : 90;
  const entries: RaceResultEntry[] = sorted.map((c, i) => {
    const finished = c.status === 'running';
    const gap = c.totalTime - leader.totalTime;
    return {
      driverId: c.driverId,
      teamId: c.teamId,
      position: i + 1,
      grid: c.grid,
      points: 0,
      status: finished ? 'finished' : c.status === 'dsq' ? 'dsq' : 'dnf',
      laps: c.lapsCompleted,
      time: finished ? c.totalTime : null,
      gap: !finished ? `DNF (${c.retireReason ?? 'Retired'})` : i === 0 ? formatRaceTime(c.totalTime) : lapsDownText(gap, avgLap),
      bestLap: c.bestLap < NO_TIME ? c.bestLap : null,
      fastestLap: false,
      pitStops: c.pitStops,
      penaltySeconds: race.stewards.filter((s) => s.driverId === c.driverId).reduce((sum, s) => sum + s.seconds, 0),
      reason: c.retireReason,
      lapsLed: c.lapsLed,
    };
  });
  // Validate classification integrity.
  const ids = new Set(entries.map((e) => e.driverId));
  assertRule(ids.size === entries.length, 'Invalid classification: duplicate driver.');
  const pole = quali.find((q) => q.position === 1)?.driverId ?? null;
  const preset = state.settings.pointsPreset[event.division];
  assignPoints(entries, preset, pole, race.fastestLap?.driverId ?? null);
  return {
    eventId: event.id,
    division: event.division,
    season: state.season,
    round: event.round,
    circuitId: event.circuitId,
    wet: race.weather.some((w) => w.wetness > 0.25),
    safetyCars: race.safetyCar.count,
    entries,
    poleDriverId: pole,
    fastestLapDriverId: race.fastestLap?.driverId ?? null,
    qualifying: quali,
  };
}

export function applyRaceResult(state: GameState, result: RaceResult, race: RaceState): void {
  const key = `result:${result.eventId}`;
  assertRule(!state.processed[key], 'This race result has already been recorded.');
  const event = findEvent(state, result.eventId);
  assertRule(event && !event.completed, 'Event already completed.');
  state.processed[key] = true;
  event.completed = true;
  state.results[result.eventId] = result;
  const cfg = DIVISIONS[result.division];
  const circuit = state.circuits[result.circuitId];
  const participants = new Set(result.entries.map((e) => e.driverId));

  // Drivers: career statistics, form, morale, discipline.
  for (const e of result.entries) {
    const d = state.drivers[e.driverId];
    if (!d) continue;
    const c = d.career;
    c.starts += 1;
    c.points += e.points;
    c.lapsLed += e.lapsLed;
    if (e.status === 'finished') {
      if (e.position === 1) c.wins += 1;
      if (e.position <= 3) c.podiums += 1;
      c.bestFinish = c.bestFinish === null ? e.position : Math.min(c.bestFinish, e.position);
    } else c.dnfs += 1;
    if (e.fastestLap) c.fastestLaps += 1;
    if (e.driverId === result.poleDriverId) c.poles += 1;
    d.form.push(e.status === 'finished' ? e.position : 25);
    if (d.form.length > 6) d.form.shift();
    const gained = e.status === 'finished' ? e.grid - e.position : -3;
    d.confidence = clamp(d.confidence + gained * 1.6 + (e.position === 1 && e.status === 'finished' ? 8 : 0) - (e.reason?.startsWith('Crash') ? 6 : 0), 5, 95);
    d.morale = clamp(d.morale + (d.confidence - 50) / 30 + (e.position <= 3 && e.status === 'finished' ? 2 : 0) - (d.contract?.status === 'number2' ? 0.6 : 0), 5, 100);
    d.pendingGridPenalty = 0;
  }
  // Teammate comparison morale.
  const byTeam = new Map<string, RaceResultEntry[]>();
  for (const e of result.entries) byTeam.set(e.teamId, [...(byTeam.get(e.teamId) ?? []), e]);
  for (const entries of byTeam.values()) {
    if (entries.length !== 2) continue;
    const [a, b] = entries.sort((x, y) => x.position - y.position);
    const loser = state.drivers[b.driverId];
    if (loser && loser.personality === 'ambitious') loser.morale = clamp(loser.morale - 1, 5, 100);
    void a;
  }

  // Penalties, bans, injuries and component grid penalties.
  for (const s of race.stewards) {
    const d = state.drivers[s.driverId];
    if (!d || s.points <= 0) continue;
    d.penaltyPoints += s.points;
    d.discipline.push({ season: state.season, round: result.round, division: result.division, description: `${s.reason} (${s.seconds}s)`, penaltyPoints: s.points });
    if (d.penaltyPoints >= 12) {
      d.raceBan = 1;
      d.penaltyPoints -= 12;
      addNews(state, {
        category: 'discipline',
        headline: fill(pickTemplate(state, 'ban', TEMPLATES.ban), { driver: driverName(d).toUpperCase() }),
        body: `${driverName(d)} has reached 12 penalty points and will miss the next ${cfg.name} race.`,
        division: result.division,
        driverIds: [d.id],
        importance: d.contract?.teamId === state.player.teamId ? 3 : 1,
      });
    }
  }
  for (const [driverId, weeks] of Object.entries(race.injuries)) {
    const d = state.drivers[driverId];
    if (!d) continue;
    const fitnessFactor = 1.2 - state.teams[d.contract?.teamId ?? '']?.facilities.fitness.level / 20 || 1;
    const out = Math.max(1, Math.round(weeks * fitnessFactor));
    d.injury = { weeksRemaining: out, description: 'Injured in a crash' };
    d.injuries.push({ season: state.season, week: state.week, description: `Crash at ${circuit.name}`, weeksOut: out });
    addNews(state, {
      category: 'injury',
      headline: fill(TEMPLATES.injury[0], { driver: driverName(d).toUpperCase(), weeks: out }),
      body: `${driverName(d)} was injured in a heavy crash at ${circuit.name} and is expected to be out for around ${out} week${out > 1 ? 's' : ''}.`,
      division: result.division,
      driverIds: [d.id],
      importance: d.contract?.teamId === state.player.teamId ? 3 : 1,
    });
  }
  if (cfg.tier >= 3) {
    for (const [driverId, type] of Object.entries(race.failures)) {
      if (type === 'engine' || type === 'gearbox') state.drivers[driverId].pendingGridPenalty = 5;
    }
  }
  // Banned drivers who missed this race serve their ban.
  for (const team of teamsInDivision(state, result.division)) {
    for (const id of team.raceDrivers) {
      const d = id ? state.drivers[id] : null;
      if (d && d.raceBan > 0 && !participants.has(d.id)) d.raceBan -= 1;
    }
  }

  // Teams: statistics and money.
  for (const team of teamsInDivision(state, result.division)) {
    const entries = result.entries.filter((e) => e.teamId === team.id);
    team.stats.races += 1;
    for (const e of entries) {
      team.stats.points += e.points;
      if (e.status === 'finished' && e.position === 1) team.stats.wins += 1;
      if (e.status === 'finished' && e.position <= 3) team.stats.podiums += 1;
      if (e.fastestLap) team.stats.fastestLaps += 1;
      if (e.driverId === result.poleDriverId) team.stats.poles += 1;
    }
    applyRaceFinances(state, team, entries, race, result);
  }

  generateRaceNews(state, result);
  checkTitleClinch(state, result.division);
}

function applyRaceFinances(state: GameState, team: Team, entries: RaceResultEntry[], race: RaceState, result: RaceResult): void {
  const cfg = DIVISIONS[team.division];
  const philosophy = team.isPlayer ? PHILOSOPHIES[state.player.philosophy] : null;
  postTransaction(state, team, 'operations', -cfg.raceOperationsCost * (philosophy?.operatingCosts ?? 1), `Race operations: round ${result.round}`);
  let prize = 0;
  for (const e of entries) if (e.status === 'finished') prize += cfg.racePrize[e.position - 1] ?? 0;
  postTransaction(state, team, 'raceBonus', prize, `Race prize money: round ${result.round}`);
  const damage = race.damageCosts[team.id] ?? 0;
  if (damage > 0) postTransaction(state, team, 'repairs', -damage * (philosophy?.repairCosts ?? 1), 'Crash damage repairs');
  // Driver personal backing paid per start.
  for (const e of entries) {
    const d = state.drivers[e.driverId];
    if (d && d.backing > 0 && d.contract?.teamId === team.id) postTransaction(state, team, 'driverFunding', d.backing / cfg.races, `${driverShortName(d)} personal sponsors`);
    // Contract performance bonuses paid to drivers.
    if (d?.contract?.teamId === team.id && e.status === 'finished') {
      if (e.position === 1 && d.contract.winBonus > 0) postTransaction(state, team, 'driverSalary', -d.contract.winBonus, `${driverShortName(d)} win bonus`);
      else if (e.position <= 3 && d.contract.podiumBonus > 0) postTransaction(state, team, 'driverSalary', -d.contract.podiumBonus, `${driverShortName(d)} podium bonus`);
    }
  }
  if (!team.isPlayer) {
    postTransaction(state, team, 'sponsor', aiSponsorIncomePerRace(state, team), 'Sponsorship income');
    return;
  }
  // Player sponsors: per-race payments and performance bonuses.
  const done = state.calendars[team.division].filter((e) => e.completed).length;
  const total = state.calendars[team.division].length;
  const season = seasonPerformance(state, team);
  const position = divisionStandings(state, team.division).constructors.findIndex((r) => r.id === team.id) + 1;
  for (const deal of team.sponsors) {
    if (deal.startSeason > state.season || deal.endSeason < state.season) continue;
    let pay = deal.perRace;
    for (const e of entries) {
      if (e.status !== 'finished') continue;
      if (e.position === 1) pay += deal.winBonus;
      else if (e.position <= 3) pay += deal.podiumBonus;
      if (e.points > 0) pay += deal.pointsBonus;
    }
    postTransaction(state, team, 'sponsor', pay, `${deal.name} (${deal.tier})`);
    const progress = expectationProgress(deal.expectation, position, season);
    const f = Math.max(0.15, done / total);
    const ratio = deal.expectation.type === 'constructorPosition' ? progress.ratio : progress.ratio / f;
    deal.satisfaction = clamp(deal.satisfaction + clamp((ratio - 1) * 7, -6, 5), 0, 100);
  }
}

export function seasonPerformance(state: GameState, team: Team): { wins: number; podiums: number; pointsFinishes: number; points: number; races: number } {
  const out = { wins: 0, podiums: 0, pointsFinishes: 0, points: 0, races: 0 };
  for (const ev of state.calendars[team.division]) {
    const r = state.results[ev.id];
    if (!r || r.season !== state.season) continue;
    out.races += 1;
    for (const e of r.entries) {
      if (e.teamId !== team.id) continue;
      out.points += e.points;
      if (e.status === 'finished' && e.position === 1) out.wins += 1;
      if (e.status === 'finished' && e.position <= 3) out.podiums += 1;
      if (e.points > 0) out.pointsFinishes += 1;
    }
  }
  return out;
}

function generateRaceNews(state: GameState, result: RaceResult): void {
  const cfg = DIVISIONS[result.division];
  const circuit = state.circuits[result.circuitId];
  const [first, second, third] = result.entries;
  const winner = state.drivers[first.driverId];
  const team = state.teams[first.teamId];
  const isPlayerDivision = playerTeam(state).division === result.division;
  const vars = {
    driver: driverName(winner),
    team: team.name,
    teamUpper: team.name.toUpperCase(),
    circuit: circuit.name,
    circuitShort: circuit.location.toUpperCase(),
    division: cfg.name,
    round: result.round,
    second: second ? driverName(state.drivers[second.driverId]) : '—',
    third: third ? driverName(state.drivers[third.driverId]) : '—',
    gap: second?.gap ?? '',
  };
  const playerEntries = result.entries.filter((e) => e.teamId === state.player.teamId);
  if (first.teamId === state.player.teamId) {
    addNews(state, {
      category: 'race',
      headline: fill(pickTemplate(state, 'pwin', TEMPLATES.playerWin), { ...vars, driver: driverName(winner).toUpperCase(), team: team.name.toUpperCase(), division: cfg.name.toUpperCase() }),
      body: fill(pickTemplate(state, 'wbody', TEMPLATES.winBody), vars),
      division: result.division,
      teamIds: [team.id],
      driverIds: [winner.id],
      importance: 3,
    });
  } else {
    addNews(state, {
      category: 'race',
      headline: fill(pickTemplate(state, 'win', TEMPLATES.winHeadline), { ...vars, driver: driverName(winner).toUpperCase(), team: team.name.toUpperCase(), division: cfg.name.toUpperCase() }),
      body: fill(pickTemplate(state, 'wbody', TEMPLATES.winBody), vars),
      division: result.division,
      teamIds: [team.id],
      driverIds: [winner.id],
      importance: isPlayerDivision ? 2 : result.division === 'F1' ? 2 : 1,
    });
  }
  if (winner.career.wins === 1 && first.teamId !== state.player.teamId) {
    addNews(state, { category: 'milestone', headline: fill(pickTemplate(state, 'maiden', TEMPLATES.maidenWin), { driver: driverName(winner).toUpperCase() }), body: `${driverName(winner)} won a race for the first time in their career at ${circuit.name}.`, division: result.division, driverIds: [winner.id], importance: 1 });
  }
  // Shock podium: a team projected in the bottom three finishing on the podium.
  for (const e of [first, second, third].filter(Boolean)) {
    const t = state.teams[e.teamId];
    if (e.status === 'finished' && projectedPosition(state, t) >= 8) {
      addNews(state, {
        category: 'race',
        headline: fill(pickTemplate(state, 'shock', TEMPLATES.shockPodium), { team: t.name.toUpperCase(), driver: driverName(state.drivers[e.driverId]).toUpperCase(), division: cfg.name.toUpperCase() }),
        body: `Against all expectations, ${driverName(state.drivers[e.driverId])} brought the ${t.name} car home in ${ordinal(e.position)} place at ${circuit.name}.`,
        division: result.division,
        teamIds: [t.id],
        driverIds: [e.driverId],
        importance: t.isPlayer ? 3 : 2,
      });
    }
  }
  if (playerEntries.length && first.teamId !== state.player.teamId) {
    const lines = playerEntries.map((e) => `${driverName(state.drivers[e.driverId])}: ${e.status === 'finished' ? ordinal(e.position) : e.gap} (from ${ordinal(e.grid)})`);
    const best = Math.min(...playerEntries.map((e) => (e.status === 'finished' ? e.position : 99)));
    addNews(state, {
      category: 'race',
      headline: best <= 3 ? `PODIUM FOR ${playerTeam(state).name.toUpperCase()} AT ${circuit.location.toUpperCase()}` : best <= 10 ? `${playerTeam(state).name.toUpperCase()} SCORE AT ${circuit.location.toUpperCase()}` : `TOUGH DAY FOR ${playerTeam(state).name.toUpperCase()} AT ${circuit.location.toUpperCase()}`,
      body: `Race report, round ${result.round}: ${lines.join('; ')}.${result.safetyCars ? ` The race saw ${result.safetyCars} safety car period${result.safetyCars > 1 ? 's' : ''}.` : ''}`,
      division: result.division,
      teamIds: [state.player.teamId],
      driverIds: playerEntries.map((e) => e.driverId),
      importance: 2,
    });
  }
  // The team principal's statement after notable weekends.
  if (playerEntries.length) {
    const best = Math.min(...playerEntries.map((e) => (e.status === 'finished' ? e.position : 99)));
    const dnfs = playerEntries.filter((e) => e.status !== 'finished').length;
    const pTeam = playerTeam(state);
    let quote: string | null = null;
    if (best === 1) quote = 'This is what we have been working for. Every single person in the factory earned this win.';
    else if (best <= 3) quote = 'A podium for a team our size is huge. We keep our feet on the ground and keep pushing.';
    else if (dnfs === playerEntries.length) quote = 'A painful day. We will analyse every failure and come back stronger.';
    if (quote) {
      addNews(state, { category: 'interview', headline: `${pTeam.principal.toUpperCase()}: "${quote.split('.')[0].toUpperCase()}"`, body: `${pTeam.principal}, Team Principal of ${pTeam.name}, after ${circuit.name}: "${quote}"`, division: result.division, teamIds: [pTeam.id], importance: 2 });
    }
  }
  // Career milestones.
  if (winner.career.wins > 1 && winner.career.wins % 10 === 0) {
    addNews(state, { category: 'milestone', headline: fill(TEMPLATES.milestone[0], { driver: driverName(winner).toUpperCase(), n: winner.career.wins }), body: `${driverName(winner)} has now won ${winner.career.wins} races.`, division: result.division, driverIds: [winner.id], importance: 1 });
  }
}

function checkTitleClinch(state: GameState, division: CalendarEvent['division']): void {
  const key = `clinch:${state.season}:${division}`;
  if (state.processed[key]) return;
  const { drivers } = divisionStandings(state, division);
  if (drivers.length < 2) return;
  const remaining = pointsRemaining(state, division);
  const [leader, second] = drivers;
  if (leader.points - second.points > remaining || remaining === 0) {
    state.processed[key] = true;
    const d = state.drivers[leader.id];
    addNews(state, {
      category: 'championship',
      headline: fill(pickTemplate(state, 'champ', TEMPLATES.champion), { driver: driverName(d).toUpperCase(), division: DIVISIONS[division].name.toUpperCase() }),
      body: `${driverName(d)} has an unassailable lead in the ${DIVISIONS[division].name} drivers' championship with ${leader.points} points.`,
      division,
      driverIds: [d.id],
      teamIds: leader.teamId ? [leader.teamId] : [],
      importance: leader.teamId === state.player.teamId ? 3 : division === 'F1' || division === playerTeam(state).division ? 2 : 1,
    });
  }
}

export function weekendEvent(state: GameState): CalendarEvent | null {
  return state.weekend ? findEvent(state, state.weekend.eventId) ?? null : null;
}

/** Expected driver strength for previews and predictions. */
export function entrantStrength(state: GameState, driverId: string, teamId: string, circuitId: string): number {
  const circuit = state.circuits[circuitId];
  return trackPerformance(state.teams[teamId].car, circuit) * 1.5 + overall(state.drivers[driverId]);
}

export { qualifyingWetness };
