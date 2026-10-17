import { DIVISIONS, pointsTable, type PointsSystem } from '../config/divisions';
import type { DivisionId, GameState, RaceResult, RaceResultEntry, StandingRow } from '../types';
import { allTeams } from '../selectors';
import { twistEffects } from '../season/twists';

/** Cars on a full grid of this division. */
export function gridSize(division: DivisionId): number {
  return DIVISIONS[division].teams * 2;
}

/** The points table a division's championship races use (the career's selected system). */
export function championshipPoints(state: Pick<GameState, 'settings'>, division: DivisionId, preset = state.settings.pointsPreset[division]): PointsSystem {
  return pointsTable(preset, gridSize(division), state.settings.customPoints);
}

/** Points for a classified finishing position. */
export function pointsForPosition(sys: PointsSystem, position: number): number {
  return sys.positions[position - 1] ?? 0;
}

/**
 * Assign championship points to a classified race. Only finishers score;
 * fastest-lap and pole bonuses follow the division's points system.
 */
export function assignPoints(entries: RaceResultEntry[], sys: PointsSystem, poleDriverId: string | null, fastestLapDriverId: string | null): void {
  for (const e of entries) {
    e.points = e.status === 'finished' ? sys.positions[e.position - 1] ?? 0 : 0;
    e.fastestLap = e.driverId === fastestLapDriverId;
    if (e.fastestLap && sys.fastestLap > 0 && e.status === 'finished' && e.position <= sys.fastestLapTopN) e.points += sys.fastestLap;
    if (e.driverId === poleDriverId && sys.pole > 0) e.points += sys.pole;
  }
}

function emptyRow(id: string, teamId?: string): StandingRow {
  return { id, teamId, points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, starts: 0, positions: [], best: null };
}

/** Count-back comparison: points, then wins, then seconds, thirds... */
export function compareRows(a: StandingRow, b: StandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  for (let p = 1; p <= 60; p++) {
    const ca = a.positions.filter((x) => x === p).length;
    const cb = b.positions.filter((x) => x === p).length;
    if (cb !== ca) return cb - ca;
  }
  return a.id.localeCompare(b.id);
}

export function computeStandingsFromResults(results: RaceResult[]): { drivers: StandingRow[]; constructors: StandingRow[] } {
  const drivers = new Map<string, StandingRow>();
  const teams = new Map<string, StandingRow>();
  for (const r of results) {
    for (const e of r.entries) {
      const d = drivers.get(e.driverId) ?? emptyRow(e.driverId, e.teamId);
      d.teamId = e.teamId;
      const t = teams.get(e.teamId) ?? emptyRow(e.teamId);
      for (const row of [d, t]) {
        row.points += e.points;
        row.starts += e.status === 'dns' ? 0 : 1;
        if (e.status === 'finished') {
          if (e.position === 1) row.wins += 1;
          if (e.position <= 3) row.podiums += 1;
          row.positions.push(e.position);
          row.best = row.best === null ? e.position : Math.min(row.best, e.position);
        } else if (e.status === 'dnf') {
          row.dnfs += 1;
        }
        if (e.fastestLap) row.fastestLaps += 1;
        if (e.driverId === r.poleDriverId) row.poles += 1;
      }
      drivers.set(e.driverId, d);
      teams.set(e.teamId, t);
    }
  }
  return {
    drivers: [...drivers.values()].sort(compareRows),
    constructors: [...teams.values()].sort(compareRows),
  };
}

export function seasonResults(state: GameState, division: DivisionId, season = state.season): RaceResult[] {
  return state.calendars[division]
    .filter((e) => e.completed)
    .map((e) => state.results[e.id])
    .filter((r): r is RaceResult => !!r && r.season === season);
}

/** Current standings for a division, including teams that have not scored. */
export function divisionStandings(state: GameState, division: DivisionId): { drivers: StandingRow[]; constructors: StandingRow[] } {
  const { drivers, constructors } = computeStandingsFromResults(seasonResults(state, division));
  const teamIds = allTeams(state).filter((t) => t.division === division).map((t) => t.id);
  for (const id of teamIds) if (!constructors.some((r) => r.id === id)) constructors.push(emptyRow(id));
  // Ensure every current race driver appears.
  for (const id of teamIds) {
    for (const dId of state.teams[id].raceDrivers) {
      if (dId && !drivers.some((r) => r.id === dId)) drivers.push(emptyRow(dId, id));
    }
  }
  // Teams no longer in the division (e.g. after a mid-season change) are dropped.
  const filtered = constructors.filter((r) => teamIds.includes(r.id));
  return { drivers: drivers.sort(compareRows), constructors: filtered.sort(compareRows) };
}

export function teamPosition(state: GameState, teamId: string): number {
  const team = state.teams[teamId];
  const { constructors } = divisionStandings(state, team.division);
  return constructors.findIndex((r) => r.id === teamId) + 1;
}

/** Races still to run, counting a double-points finale still to come twice. */
function racesToScore(state: GameState, division: DivisionId): number {
  const cal = state.calendars[division];
  const remaining = cal.filter((e) => !e.completed).length;
  const last = cal[cal.length - 1];
  const finale = last && !last.completed && twistEffects(state, division).doublePointsRound === last.round ? 1 : 0;
  return remaining + finale;
}

/** Maximum points still available to a single driver this season. */
export function pointsRemaining(state: GameState, division: DivisionId): number {
  const sys = championshipPoints(state, division);
  return racesToScore(state, division) * (sys.positions[0] + sys.fastestLap + sys.pole);
}

/** Maximum points still available to one team (its cars first and second in every race). */
export function teamPointsRemaining(state: GameState, division: DivisionId): number {
  const sys = championshipPoints(state, division);
  return racesToScore(state, division) * ((sys.positions[0] ?? 0) + (sys.positions[1] ?? 0) + sys.fastestLap + sys.pole);
}
