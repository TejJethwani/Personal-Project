import { championshipPoints, computeStandingsFromResults, pointsRemaining, seasonResults, teamPointsRemaining } from '../championship/standings';
import { driverShortName } from '../drivers/ratings';
import type { CalendarEvent, GameState, RaceLogEntry, RaceResult, RaceState, TireCompound } from '../types';
import { pitLossFor } from './strategy';

/**
 * Post-race report: who gained most, the driver of the race, how the
 * championships moved, every pit stop and stint, the incidents and how the
 * player's strategy played out. Read from the classified result and the race
 * record only.
 */

export interface StintSummary {
  compound: TireCompound;
  from: number;
  to: number;
}

export interface ChampionshipMove {
  id: string;
  before: number;
  after: number;
  points: number;
  gained: number;
}

export interface RaceReport {
  gainers: { driverId: string; teamId: string; gained: number; grid: number; position: number }[];
  driverOfTheRace: { driverId: string; teamId: string; reason: string } | null;
  stops: { driverId: string; teamId: string; stops: number; stints: StintSummary[]; position: number; finished: boolean }[];
  incidents: RaceLogEntry[];
  drivers: ChampionshipMove[];
  constructors: ChampionshipMove[];
  playerStrategy: { driverId: string; plannedStops: number; actualStops: number; pitTime: number; stints: StintSummary[]; position: number; grid: number }[];
  winnerStrategy: { driverId: string; stints: StintSummary[] } | null;
}

function stintsOf(race: RaceState, driverId: string): StintSummary[] {
  const car = race.cars.find((c) => c.driverId === driverId);
  if (!car) return [];
  const end = car.retiredLap ?? race.totalLaps;
  return car.stints.filter((s) => s.fromLap <= end).map((s) => ({ compound: s.compound, from: s.fromLap, to: Math.min(end, s.toLap ?? end) }));
}

function moves(before: { id: string; points: number }[], after: { id: string; points: number }[]): ChampionshipMove[] {
  const b = new Map(before.map((r, i) => [r.id, { pos: i + 1, points: r.points }]));
  return after.map((r, i) => {
    const prev = b.get(r.id);
    return { id: r.id, before: prev?.pos ?? 0, after: i + 1, points: r.points, gained: r.points - (prev?.points ?? 0) };
  });
}

export function raceReport(state: GameState, event: CalendarEvent, result: RaceResult, race: RaceState): RaceReport {
  const finished = result.entries.filter((e) => e.status === 'finished');
  const gainers = finished
    .map((e) => ({ driverId: e.driverId, teamId: e.teamId, gained: e.grid - e.position, grid: e.grid, position: e.position }))
    .filter((g) => g.gained > 0)
    .sort((a, b) => b.gained - a.gained || a.position - b.position)
    .slice(0, 5);

  // Driver of the race: places gained, weighted towards the front, a win from off pole, the fastest lap.
  let dotr: RaceReport['driverOfTheRace'] = null;
  let bestScore = -Infinity;
  const n = result.entries.length;
  for (const e of finished) {
    const score = (e.grid - e.position) * 1.6 + (n - e.position) * 0.35 + (e.position === 1 ? 4 : 0) + (e.fastestLap ? 1.5 : 0) + (e.position <= 3 && e.grid > 6 ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      const gained = e.grid - e.position;
      const reason = e.position === 1 ? (e.grid === 1 ? 'Lights to flag from pole' : `Won from P${e.grid}`) : gained > 0 ? `P${e.grid} to P${e.position}: ${gained} places gained` : `P${e.position} from P${e.grid}`;
      dotr = { driverId: e.driverId, teamId: e.teamId, reason: `${reason}${e.fastestLap ? ', and the fastest lap' : ''}.` };
    }
  }

  const playerTeam = state.player.teamId;
  const top = result.entries.slice(0, 10).map((e) => e.driverId);
  const mine = result.entries.filter((e) => e.teamId === playerTeam).map((e) => e.driverId);
  const stops = result.entries
    .filter((e) => top.includes(e.driverId) || mine.includes(e.driverId))
    .map((e) => ({ driverId: e.driverId, teamId: e.teamId, stops: e.pitStops, stints: stintsOf(race, e.driverId), position: e.position, finished: e.status === 'finished' }));

  const incidents = race.log.filter((l) => ['crash', 'collision', 'failure', 'penalty'].includes(l.type) || (l.type === 'mistake' && l.key));

  // Championship movement: standings without this race, then with it (championship races only).
  let drivers: ChampionshipMove[] = [];
  let constructors: ChampionshipMove[] = [];
  if (!result.competition && !event.pointsPreset) {
    const all = seasonResults(state, event.division);
    const before = computeStandingsFromResults(all.filter((r) => r.eventId !== result.eventId));
    const after = computeStandingsFromResults(all);
    drivers = moves(before.drivers, after.drivers);
    constructors = moves(before.constructors, after.constructors);
  }

  const circuit = state.circuits[result.circuitId];
  const loss = pitLossFor(circuit, race.baseLapTime);
  const playerStrategy = race.cars
    .filter((c) => c.teamId === playerTeam)
    .map((c) => ({ driverId: c.driverId, plannedStops: c.plan.stops.length, actualStops: c.pitStops, pitTime: Math.round(c.pitStops * loss * 10) / 10, stints: stintsOf(race, c.driverId), position: result.entries.find((e) => e.driverId === c.driverId)?.position ?? c.position, grid: c.grid }));
  const winner = result.entries[0];
  return {
    gainers,
    driverOfTheRace: dotr,
    stops,
    incidents,
    drivers,
    constructors,
    playerStrategy,
    winnerStrategy: winner ? { driverId: winner.driverId, stints: stintsOf(race, winner.driverId) } : null,
  };
}

export interface TitleDecided {
  kind: 'drivers' | 'teams';
  id: string;
  mine: boolean;
}

/**
 * Championships this race settled: before it the title was still open, after
 * it nobody can catch the leader with the points still available.
 */
export function titlesDecided(state: GameState, result: RaceResult): TitleDecided[] {
  if (result.competition) return [];
  const all = seasonResults(state, result.division);
  if (!all.some((r) => r.eventId === result.eventId)) return [];
  const before = computeStandingsFromResults(all.filter((r) => r.eventId !== result.eventId));
  const after = computeStandingsFromResults(all);
  const left = { drivers: pointsRemaining(state, result.division), teams: teamPointsRemaining(state, result.division) };
  const sys = championshipPoints(state, result.division);
  const perRace = { drivers: sys.positions[0] + sys.fastestLap + sys.pole, teams: (sys.positions[0] ?? 0) + (sys.positions[1] ?? 0) + sys.fastestLap + sys.pole };
  const out: TitleDecided[] = [];
  for (const kind of ['drivers', 'teams'] as const) {
    const [a, b] = after[kind === 'drivers' ? 'drivers' : 'constructors'];
    const [pa, pb] = before[kind === 'drivers' ? 'drivers' : 'constructors'];
    if (!a) continue;
    const settledNow = !b || a.points - b.points > left[kind];
    const settledBefore = !!pa && (!pb || pa.points - pb.points > left[kind] + perRace[kind]);
    if (settledNow && !settledBefore) {
      const mine = kind === 'drivers' ? state.drivers[a.id]?.contract?.teamId === state.player.teamId : a.id === state.player.teamId;
      out.push({ kind, id: a.id, mine });
    }
  }
  return out;
}

/** A sentence on how the player's strategy compared with the winner's. */
export function strategyVerdict(state: GameState, report: RaceReport): string[] {
  const out: string[] = [];
  const w = report.winnerStrategy;
  for (const p of report.playerStrategy) {
    const name = driverShortName(state.drivers[p.driverId]);
    const extra = p.actualStops - p.plannedStops;
    const plan = extra > 0 ? `${extra} more stop${extra > 1 ? 's' : ''} than planned` : extra < 0 ? `${-extra} fewer stop${extra < -1 ? 's' : ''} than planned` : 'the planned number of stops';
    const vsWinner = w && w.driverId !== p.driverId ? ` The winner stopped ${w.stints.length - 1} time${w.stints.length - 1 === 1 ? '' : 's'}.` : '';
    out.push(`${name}: P${p.grid} → P${p.position}, ${p.actualStops} stop${p.actualStops === 1 ? '' : 's'} (${plan}), about ${p.pitTime.toFixed(0)} s in the pit lane.${vsWinner}`);
  }
  return out;
}
