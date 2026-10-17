import { generateCar, overallPace, COMPONENT_KEYS } from '../car/car';
import { DIVISIONS, raceLapsFor } from '../config/divisions';
import { divisionForLevel, levelOfDivision } from '../config/ruleset';
import { generateDriver, nextId, raceAgeFor } from '../drivers/generate';
import { randomName } from '../drivers/generate';
import { overall } from '../drivers/ratings';
import { Rng } from '../rng';
import { playerTeam } from '../selectors';
import type { CalendarEvent, DivisionId, EuroClub, EuroCompetition, EuroFixture, EuroTie, FixtureKind, FixtureResult, GameState, H2HCar, RaceResult, Team } from '../types';
import { clamp } from '../util';
import { baseTeam, makeContract } from '../world/generate';
import { ASSOCIATION_BY_ID } from './data';
import { associationPace, clubField, DRIVER_REFERENCE, DRIVER_WEIGHT, fieldPaceMean, LEVEL_PACE, quickLap, quickRace } from './power';

/**
 * Head-to-head races. Cup and continental fixtures are two-team races: both
 * cars of each club, scored 4-3-2-1. The club with more race points wins the
 * race; equal totals are a draw. Knockout ties are decided on aggregate race
 * points, then by an extra race, then by a qualifying shoot-out.
 *
 * Races involving the player's team run on the full race engine (the player
 * manages the weekend); all others run on the quick model.
 */

export const H2H_POINTS = [4, 3, 2, 1];

export const playerClubId = (state: GameState): string | undefined => playerTeam(state).clubId;

export function competitionName(state: GameState, competition: EuroCompetition, assocId?: string | null): string {
  const assoc = assocId ? ASSOCIATION_BY_ID[assocId] : ASSOCIATION_BY_ID[state.europe?.playerAssocId ?? ''];
  switch (competition) {
    case 'CL':
      return 'Apex Champions League';
    case 'EL':
      return 'Apex Europa League';
    case 'ECL':
      return 'Apex Conference League';
    case 'ESC':
      return 'Apex European Super Cup';
    case 'cup':
      return assoc?.cupName ?? 'Cup';
    case 'leagueCup':
      return assoc?.leagueCupName ?? 'League Cup';
    case 'superCup':
      return assoc?.superCupName ?? 'Super Cup';
    default:
      return 'League';
  }
}

export const STAGE_LABEL: Record<string, string> = {
  qualifying: 'Qualifying round',
  league: 'League phase',
  playoff: 'Knockout play-off',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
  r64: 'Round of 64',
  r32: 'Round of 32',
  prelim: 'Preliminary round',
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

function fixtureLabel(state: GameState, fx: EuroFixture): string {
  const name = competitionName(state, fx.competition, state.europe!.clubs[fx.home]?.assocId);
  if (fx.stage === 'league') return `${name} · Matchday ${fx.matchday}`;
  const leg = fx.kind === 'leg1' ? ' · Leg 1' : fx.kind === 'leg2' ? ' · Leg 2' : fx.kind === 'decider' ? ' · Decider' : '';
  return `${name} · ${stageLabel(fx.stage)}${leg}`;
}

// ---------------------------------------------------------------------------
// Guest teams: quick-model clubs given a car and drivers to race the player.
// ---------------------------------------------------------------------------

function driverMeanFor(club: EuroClub): number {
  return DIVISIONS[divisionForLevel(Math.min(club.level, 5))].driverRatingMean;
}

/** Car base rating that gives a guest its club's power in the frame of `division`. */
function guestCarBase(state: GameState, club: EuroClub, team: Team, division: DivisionId): number {
  const drivers = team.raceDrivers.map((id) => (id ? state.drivers[id] : null)).filter(Boolean);
  const avg = drivers.length ? drivers.reduce((s, d) => s + overall(d!), 0) / drivers.length : driverMeanFor(club);
  const playerPace = associationPace(state.europe!.playerAssocId);
  // In the frame of the division's developed field.
  return clamp(club.power - 50 + fieldPaceMean(state, division) - LEVEL_PACE[division] - playerPace - DRIVER_WEIGHT * (avg - DRIVER_REFERENCE), 18, 95);
}

/** Bring a guest team's car in line with its club's current strength for an event of `division`. */
export function syncGuest(state: GameState, team: Team, division: DivisionId): void {
  const club = state.europe!.clubs[team.clubId!];
  team.division = division;
  const target = guestCarBase(state, club, team, division);
  const delta = target - overallPace(team.car);
  for (const k of COMPONENT_KEYS) team.car.components[k] = Math.round(clamp(team.car.components[k] + delta, 10, 96) * 10) / 10;
}

function materialiseGuest(state: GameState, club: EuroClub, division: DivisionId): Team {
  const rng = Rng.from(state.seed, 'guest', club.id, state.season);
  const ctx = { rng, ids: state, season: state.season };
  const assoc = ASSOCIATION_BY_ID[club.assocId];
  const team = baseTeam(nextId(state, 't'), division, state.season);
  team.guest = true;
  team.clubId = club.id;
  team.name = club.name;
  team.shortName = club.short;
  team.nationality = assoc?.nationality ?? 'GBR';
  team.colors = { ...club.colors };
  team.livery = club.livery;
  const principal = randomName(rng, team.nationality);
  team.principal = `${principal.firstName} ${principal.lastName}`;
  team.aiPersonality = 'conservative';
  team.reputation = clamp(Math.round(40 + (club.power - 45) * 1.5), 5, 95);
  for (const f of Object.values(team.facilities)) f.level = 5;
  const mean = driverMeanFor(club);
  [0, 1].forEach((i) => {
    const d = generateDriver(ctx, { targetOverall: mean + club.drivers[i] * 1.5 + rng.normal(0, 1.5), age: raceAgeFor(rng, divisionForLevel(Math.min(club.level, 5))), division, nationality: rng.chance(0.6) ? team.nationality : undefined });
    d.guest = true;
    d.contract = makeContract(state, state.season, team.id, 'race', 0, 1, 'equal');
    state.drivers[d.id] = d;
    team.raceDrivers[i] = d.id;
  });
  team.car = generateCar(rng, 50, 1.6);
  state.teams[team.id] = team;
  state.europe!.guests[club.id] = team.id;
  syncGuest(state, team, division);
  return team;
}

/** The team that races for a club: its full team, or a guest built for this event. */
export function clubTeam(state: GameState, clubId: string, division: DivisionId): Team {
  const club = state.europe!.clubs[clubId];
  if (club.teamId && state.teams[club.teamId]) return state.teams[club.teamId];
  const guestId = state.europe!.guests[clubId];
  if (guestId && state.teams[guestId]) {
    syncGuest(state, state.teams[guestId], division);
    return state.teams[guestId];
  }
  return materialiseGuest(state, club, division);
}

/** Remove every guest team and driver (season rollover). */
export function clearGuests(state: GameState): void {
  for (const id of Object.values(state.europe!.guests)) {
    const team = state.teams[id];
    if (!team) continue;
    for (const d of team.raceDrivers) if (d) delete state.drivers[d];
    delete state.teams[id];
  }
  state.europe!.guests = {};
}

// ---------------------------------------------------------------------------
// Fixtures and ties
// ---------------------------------------------------------------------------

/** Division whose race format and pace frame a head-to-head race uses. */
function frameDivision(state: GameState, fx: EuroFixture): DivisionId {
  const clubs = [state.europe!.clubs[fx.home], state.europe!.clubs[fx.away]];
  const levels = clubs.filter((c) => c.teamId && !state.teams[c.teamId]?.guest).map((c) => levelOfDivision(state.teams[c.teamId!].division));
  // Against foreign clubs the race runs in the player's own frame.
  if (clubs.some((c) => !c.teamId)) return playerTeam(state).division;
  return divisionForLevel(Math.min(...levels));
}

function createPlayerEvent(state: GameState, fx: EuroFixture): void {
  const division = frameDivision(state, fx);
  const home = clubTeam(state, fx.home, division);
  const away = clubTeam(state, fx.away, division);
  const circuit = state.circuits[fx.circuitId];
  const event: CalendarEvent = {
    id: `eu-${fx.id}`,
    division,
    round: fx.matchday,
    circuitId: fx.circuitId,
    week: fx.week,
    completed: false,
    teamIds: [home.id, away.id],
    laps: Math.max(8, Math.round(raceLapsFor(division, circuit.laps) * 0.5)),
    pointsPreset: 'h2h',
    euro: { competition: fx.competition, label: fixtureLabel(state, fx), fixtureId: fx.id },
  };
  state.europe!.events.push(event);
  fx.eventId = event.id;
}

export interface FixtureSpec {
  competition: EuroCompetition;
  stage: string;
  matchday: number;
  week: number;
  home: string;
  away: string;
  circuitId: string;
  kind: FixtureKind;
  tieId?: string | null;
}

export function createFixture(state: GameState, spec: FixtureSpec): EuroFixture {
  const fx: EuroFixture = { id: nextId(state, 'fx'), ...spec, tieId: spec.tieId ?? null, result: null, eventId: null };
  state.europe!.fixtures[fx.id] = fx;
  const pc = playerClubId(state);
  if (pc && (fx.home === pc || fx.away === pc)) createPlayerEvent(state, fx);
  return fx;
}

/** A knockout tie of one race or two legs (the first leg at `home`). */
export function createTie(state: GameState, competition: EuroCompetition, stage: string, home: string, away: string, weeks: number[], venue?: string): EuroTie {
  const tie: EuroTie = { id: nextId(state, 'tie'), competition, stage, home, away, fixtures: [], decider: null, shootout: null, aggregate: [0, 0], winner: null };
  state.europe!.ties[tie.id] = tie;
  const clubs = state.europe!.clubs;
  if (weeks.length === 1) {
    const fx = createFixture(state, { competition, stage, matchday: 1, week: weeks[0], home, away, circuitId: venue ?? clubs[home].homeCircuitId, kind: 'single', tieId: tie.id });
    tie.fixtures.push(fx.id);
  } else {
    const leg1 = createFixture(state, { competition, stage, matchday: 1, week: weeks[0], home, away, circuitId: clubs[home].homeCircuitId, kind: 'leg1', tieId: tie.id });
    const leg2 = createFixture(state, { competition, stage, matchday: 2, week: weeks[1], home: away, away: home, circuitId: clubs[away].homeCircuitId, kind: 'leg2', tieId: tie.id });
    tie.fixtures.push(leg1.id, leg2.id);
  }
  return tie;
}

function scoreCars(cars: H2HCar[]): FixtureResult {
  let home = 0;
  let away = 0;
  for (const c of cars) {
    if (c.side === 'home') home += c.points;
    else away += c.points;
  }
  return { home, away, cars };
}

/** Quick-model result of a fixture. */
export function quickFixtureResult(state: GameState, fx: EuroFixture): FixtureResult {
  const rng = Rng.from(state.seed, 'fixture', fx.id);
  const clubs = state.europe!.clubs;
  const field = [fx.home, fx.away].map((id) => clubField(state, clubs[id]));
  const order = quickRace(rng, field, 0.045);
  const cars: H2HCar[] = order.map((c, i) => ({ side: c.clubId === fx.home ? 'home' : 'away', position: i + 1, points: c.dnf ? 0 : H2H_POINTS[i] ?? 0, dnf: c.dnf }));
  return scoreCars(cars);
}

/** Fixture result from a full-engine race. */
export function fixtureResultFromRace(_state: GameState, fx: EuroFixture, event: CalendarEvent, result: RaceResult): FixtureResult {
  const homeTeam = event.teamIds![0];
  const cars: H2HCar[] = result.entries.map((e) => ({ side: e.teamId === homeTeam ? 'home' : 'away', driverId: e.driverId, position: e.position, points: e.points, dnf: e.status !== 'finished' }));
  void fx;
  return scoreCars(cars);
}

/** Race points of one club in a fixture. */
export function pointsFor(fx: EuroFixture, clubId: string): number {
  if (!fx.result) return 0;
  return fx.home === clubId ? fx.result.home : fx.away === clubId ? fx.result.away : 0;
}

export type FixtureHook = (state: GameState, fx: EuroFixture) => void;
export type TieHook = (state: GameState, tie: EuroTie) => void;

/** Competition modules register what happens when a fixture or tie is settled. */
export const hooks: { fixture: FixtureHook[]; tie: TieHook[] } = { fixture: [], tie: [] };

function shootout(state: GameState, tie: EuroTie, decider: EuroFixture): { winner: string; laps: Record<string, number> } {
  // The fastest lap in the decider's qualifying session decides; the quick
  // model runs a flying lap per car when the decider was not on the full engine.
  const laps: Record<string, number> = {};
  const event = decider.eventId ? state.europe!.events.find((e) => e.id === decider.eventId) : null;
  const result = event ? state.results[event.id] : null;
  if (result && event) {
    for (const q of result.qualifying) {
      const side = q.teamId === event.teamIds![0] ? decider.home : decider.away;
      if (q.bestLap !== null && (laps[side] === undefined || q.bestLap < laps[side])) laps[side] = q.bestLap;
    }
    const [a, b] = [decider.home, decider.away];
    const winner = (laps[a] ?? 1e9) <= (laps[b] ?? 1e9) ? a : b;
    return { winner, laps };
  }
  const rng = Rng.from(state.seed, 'shootout', tie.id);
  const clubs = state.europe!.clubs;
  for (const id of [tie.home, tie.away]) {
    const f = clubField(state, clubs[id]);
    laps[id] = Math.max(quickLap(rng, f.power, f.drivers[0]), quickLap(rng, f.power, f.drivers[1]));
  }
  // Higher quick-lap score is faster; store as a pseudo lap time for display.
  const winner = laps[tie.home] >= laps[tie.away] ? tie.home : tie.away;
  const shown: Record<string, number> = {};
  for (const id of [tie.home, tie.away]) shown[id] = Math.round((90 - (laps[id] - 50) * 0.046) * 1000) / 1000;
  return { winner, laps: shown };
}

function settleTie(state: GameState, tie: EuroTie): void {
  const fxs = tie.fixtures.map((id) => state.europe!.fixtures[id]);
  if (fxs.some((f) => !f.result)) return;
  tie.aggregate = [fxs.reduce((s, f) => s + pointsFor(f, tie.home), 0), fxs.reduce((s, f) => s + pointsFor(f, tie.away), 0)];
  if (tie.aggregate[0] !== tie.aggregate[1]) {
    tie.winner = tie.aggregate[0] > tie.aggregate[1] ? tie.home : tie.away;
  } else if (!tie.decider) {
    const last = fxs[fxs.length - 1];
    const decider = createFixture(state, { competition: tie.competition, stage: tie.stage, matchday: fxs.length + 1, week: last.week, home: last.home, away: last.away, circuitId: last.circuitId, kind: 'decider', tieId: tie.id });
    tie.decider = decider.id;
    if (!decider.eventId) recordFixture(state, decider, quickFixtureResult(state, decider));
    return;
  } else {
    const decider = state.europe!.fixtures[tie.decider];
    if (!decider.result) return;
    const a = pointsFor(decider, tie.home);
    const b = pointsFor(decider, tie.away);
    if (a !== b) tie.winner = a > b ? tie.home : tie.away;
    else {
      tie.shootout = shootout(state, tie, decider);
      tie.winner = tie.shootout.winner;
    }
  }
  if (tie.winner) for (const h of hooks.tie) h(state, tie);
}

/** Store a fixture's result and settle its tie. Idempotent per fixture. */
export function recordFixture(state: GameState, fx: EuroFixture, result: FixtureResult): void {
  const key = `fixture:${fx.id}`;
  if (state.processed[key]) return;
  state.processed[key] = true;
  fx.result = result;
  for (const h of hooks.fixture) h(state, fx);
  if (fx.tieId) {
    const tie = state.europe!.ties[fx.tieId];
    if (fx.kind === 'decider') settleTie(state, tie);
    else if (!tie.winner) settleTie(state, tie);
  }
}

/** Run every background fixture due by this week. */
export function playBackgroundFixtures(state: GameState, week: number): void {
  const due = Object.values(state.europe!.fixtures).filter((f) => !f.result && !f.eventId && f.week <= week);
  due.sort((a, b) => a.week - b.week || (a.kind === 'decider' ? 1 : 0) - (b.kind === 'decider' ? 1 : 0));
  for (const fx of due) if (!fx.result) recordFixture(state, fx, quickFixtureResult(state, fx));
}

/** The player's race in a head-to-head event has finished. */
export function onPlayerFixtureRace(state: GameState, event: CalendarEvent, result: RaceResult): void {
  const fxId = event.euro?.fixtureId;
  if (!fxId) return;
  const fx = state.europe!.fixtures[fxId];
  if (!fx || fx.result) return;
  recordFixture(state, fx, fixtureResultFromRace(state, fx, event, result));
}

/** Winner of a tie, or null while undecided. */
export const tieWinner = (state: GameState, tieId: string): string | null => state.europe!.ties[tieId]?.winner ?? null;
export const tieLoser = (_state: GameState, tie: EuroTie): string | null => (tie.winner ? (tie.winner === tie.home ? tie.away : tie.home) : null);
