import type { GameState } from './types';
import { DIVISION_ORDER } from './types';

/**
 * Structural invariants that must hold after every action. Used by tests, by
 * save import, and as a debugging aid. Returns a list of problems (empty = valid).
 */
export function validateState(state: GameState): string[] {
  const problems: string[] = [];
  const seenRace = new Map<string, string>();
  for (const team of Object.values(state.teams)) {
    if (!Number.isFinite(team.cash)) problems.push(`${team.name}: invalid cash ${team.cash}`);
    if (!DIVISION_ORDER.includes(team.division)) problems.push(`${team.name}: invalid division`);
    const slotIds = [...team.raceDrivers.filter(Boolean), team.reserveDriverId, ...team.academyDriverIds].filter(Boolean) as string[];
    if (new Set(slotIds).size !== slotIds.length) problems.push(`${team.name}: a driver occupies two roles`);
    team.raceDrivers.forEach((id) => {
      if (!id) return;
      const d = state.drivers[id];
      if (!d) problems.push(`${team.name}: missing race driver ${id}`);
      else {
        if (d.retired) problems.push(`${team.name}: retired driver ${id} in a race seat`);
        if (d.contract?.teamId !== team.id) problems.push(`${team.name}: race driver ${d.lastName} has no contract with the team`);
        else if (d.contract.role !== 'race') problems.push(`${team.name}: ${d.lastName} in race seat with ${d.contract.role} contract`);
        if (seenRace.has(id)) problems.push(`${d.lastName} races for two teams`);
        seenRace.set(id, team.id);
      }
    });
    if (team.reserveDriverId) {
      const d = state.drivers[team.reserveDriverId];
      if (!d || d.contract?.teamId !== team.id || d.contract.role !== 'reserve') problems.push(`${team.name}: inconsistent reserve driver`);
    }
    for (const id of team.academyDriverIds) {
      const d = state.drivers[id];
      if (!d || d.contract?.teamId !== team.id || d.contract.role !== 'academy') problems.push(`${team.name}: inconsistent academy driver ${id}`);
    }
    for (const [role, id] of Object.entries(team.staff)) {
      if (!id) continue;
      const s = state.staff[id];
      if (!s || s.contract?.teamId !== team.id || s.role !== role) problems.push(`${team.name}: inconsistent ${role}`);
    }
    for (const p of team.rnd) {
      if (p.weeksElapsed < 0 || p.weeksTotal <= 0) problems.push(`${team.name}: invalid R&D project timing`);
    }
    for (const [k, c] of Object.entries(team.car.components)) {
      if (!Number.isFinite(c) || c < 0 || c > 100) problems.push(`${team.name}: invalid ${k} rating ${c}`);
    }
  }
  for (const d of Object.values(state.drivers)) {
    for (const c of [d.contract, d.futureContract]) {
      if (!c) continue;
      if (c.endSeason < c.startSeason) problems.push(`${d.lastName}: contract with negative duration`);
      if (!state.teams[c.teamId]) problems.push(`${d.lastName}: contract with unknown team`);
      if (c.salary < 0) problems.push(`${d.lastName}: negative salary`);
    }
    if (d.futureContract && d.contract && d.futureContract.startSeason <= d.contract.endSeason && d.futureContract.teamId !== d.contract.teamId) {
      problems.push(`${d.lastName}: overlapping contracts with two teams`);
    }
    if (d.contract) {
      const team = state.teams[d.contract.teamId];
      if (team) {
        const inSlot =
          (d.contract.role === 'race' && team.raceDrivers.includes(d.id)) ||
          (d.contract.role === 'reserve' && team.reserveDriverId === d.id) ||
          (d.contract.role === 'academy' && team.academyDriverIds.includes(d.id));
        if (!inSlot) problems.push(`${d.lastName}: contracted to ${team.name} as ${d.contract.role} but not in the line-up`);
      }
    }
    if (d.retired && (d.contract || d.futureContract)) problems.push(`${d.lastName}: retired but under contract`);
  }
  for (const s of Object.values(state.staff)) {
    if (s.contract) {
      const t = state.teams[s.contract.teamId];
      if (!t || t.staff[s.role] !== s.id) problems.push(`Staff ${s.lastName}: contract/team mismatch`);
    }
  }
  for (const division of DIVISION_ORDER) {
    const teams = Object.values(state.teams).filter((t) => t.division === division);
    if (teams.length !== 10) problems.push(`${division} has ${teams.length} teams`);
    for (const ev of state.calendars[division]) {
      const r = state.results[ev.id];
      if (ev.completed && !r) problems.push(`${ev.id}: completed without a result`);
      if (!ev.completed && r) problems.push(`${ev.id}: result for an incomplete event`);
      if (r) {
        const ids = r.entries.map((e) => e.driverId);
        if (new Set(ids).size !== ids.length) problems.push(`${ev.id}: duplicate driver in result`);
        if (r.entries.some((e) => e.points < 0)) problems.push(`${ev.id}: negative points`);
        r.entries.forEach((e, i) => {
          if (e.position !== i + 1) problems.push(`${ev.id}: classification out of order`);
        });
      }
    }
  }
  return problems;
}
