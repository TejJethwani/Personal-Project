import type { Circuit, Driver, DivisionId, GameState, Team } from './types';

export const playerTeam = (state: GameState): Team => state.teams[state.player.teamId];

/** Every managed team. Guest teams (a European club given a car for one race) are not part of the world. */
export const allTeams = (state: GameState): Team[] => Object.values(state.teams).filter((t) => !t.guest);

/** Every driver in the world, retired included; guest drivers are left out. */
export const allDrivers = (state: GameState): Driver[] => Object.values(state.drivers).filter((d) => !d.guest);

export const teamsInDivision = (state: GameState, division: DivisionId): Team[] =>
  allTeams(state)
    .filter((t) => t.division === division)
    .sort((a, b) => a.name.localeCompare(b.name));

export const activeDrivers = (state: GameState): Driver[] => allDrivers(state).filter((d) => !d.retired);

export function raceDrivers(state: GameState, team: Team): Driver[] {
  return team.raceDrivers.filter((id): id is string => !!id).map((id) => state.drivers[id]).filter(Boolean);
}

export function driverTeam(state: GameState, driver: Driver): Team | null {
  return driver.contract ? state.teams[driver.contract.teamId] ?? null : null;
}

export function driverDivision(state: GameState, driver: Driver): DivisionId | null {
  return driverTeam(state, driver)?.division ?? null;
}

export function isRaceDriver(state: GameState, driver: Driver): boolean {
  const team = driverTeam(state, driver);
  return !!team && team.raceDrivers.includes(driver.id);
}

export function teamDriversAll(state: GameState, team: Team): Driver[] {
  const ids = new Set<string>([...team.raceDrivers.filter(Boolean) as string[], ...(team.reserveDriverId ? [team.reserveDriverId] : []), ...team.academyDriverIds]);
  return [...ids].map((id) => state.drivers[id]).filter(Boolean);
}

export function freeAgents(state: GameState): Driver[] {
  return activeDrivers(state).filter((d) => !d.contract);
}

export const circuitOf = (state: GameState, circuitId: string): Circuit => state.circuits[circuitId];

export function teamColor(state: GameState, teamId: string | null | undefined): string {
  if (!teamId) return '#6b7280';
  return state.teams[teamId]?.colors.primary ?? '#6b7280';
}
