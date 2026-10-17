import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { CIRCUIT_ORDER } from '../data/circuits';
import { Rng } from '../rng';
import type { CalendarEvent, Circuit, DivisionId, GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { buildEuroCalendars } from '../europe/schedule';

/** Build a season calendar for one division. Deterministic for (seed, season, division). */
export function buildDivisionCalendar(seed: number, season: number, division: DivisionId, circuits: Circuit[]): CalendarEvent[] {
  const rng = Rng.from(seed, 'calendar', season, division);
  const cfg = DIVISIONS[division];
  const pool = circuits.filter((c) => c.tiers.includes(division));
  const chosen = rng.shuffle([...pool]).slice(0, Math.min(cfg.races, pool.length));
  // Fill if a division has fewer eligible circuits than races (repeat venues).
  while (chosen.length < cfg.races) chosen.push(rng.pick(pool));
  chosen.sort((a, b) => (CIRCUIT_ORDER[a.id] ?? 0.5) - (CIRCUIT_ORDER[b.id] ?? 0.5));
  const first = ECONOMY_TUNING.firstRaceWeek + (division === 'F1' ? 0 : DIVISIONS[division].tier % 2);
  const last = ECONOMY_TUNING.lastRaceWeek;
  const span = last - first;
  const weeks: number[] = [];
  for (let i = 0; i < cfg.races; i++) {
    let w = Math.round(first + (cfg.races === 1 ? 0 : (i * span) / (cfg.races - 1)));
    if (weeks.length && w <= weeks[weeks.length - 1]) w = weeks[weeks.length - 1] + 1;
    weeks.push(Math.min(w, ECONOMY_TUNING.weeksPerSeason));
  }
  return chosen.map((c, i) => ({
    id: `s${season}-${division}-r${i + 1}`,
    division,
    round: i + 1,
    circuitId: c.id,
    week: weeks[i],
    completed: false,
  }));
}

export function buildAllCalendars(state: Pick<GameState, 'seed' | 'circuits'> & Partial<GameState>, season: number): Record<DivisionId, CalendarEvent[]> {
  if (state.mode === 'european' && state.europe) return buildEuroCalendars(state as GameState, season);
  const circuits = Object.values(state.circuits);
  const out = {} as Record<DivisionId, CalendarEvent[]>;
  for (const d of DIVISION_ORDER) out[d] = buildDivisionCalendar(state.seed, season, d, circuits);
  return out;
}

export function findEvent(state: GameState, eventId: string): CalendarEvent | undefined {
  for (const d of DIVISION_ORDER) {
    const e = state.calendars[d].find((ev) => ev.id === eventId);
    if (e) return e;
  }
  return state.europe?.events.find((ev) => ev.id === eventId);
}

export function nextEventFor(state: GameState, division: DivisionId): CalendarEvent | undefined {
  return state.calendars[division].find((e) => !e.completed);
}

export function eventsInWeek(state: GameState, week: number): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const d of DIVISION_ORDER) for (const e of state.calendars[d]) if (e.week === week) out.push(e);
  for (const e of state.europe?.events ?? []) if (e.week === week) out.push(e);
  return out;
}

export function absWeek(season: number, week: number): number {
  return season * (ECONOMY_TUNING.weeksPerSeason + 8) + week;
}

export const currentAbsWeek = (state: GameState): number => absWeek(state.season, state.week);
