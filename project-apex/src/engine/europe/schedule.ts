import { CIRCUIT_ORDER } from '../data/circuits';
import { DIVISIONS, raceLapsFor } from '../config/divisions';
import { activeDivisions, levelOfDivision } from '../config/ruleset';
import { Rng } from '../rng';
import type { CalendarEvent, Circuit, DivisionId, GameState } from '../types';
import { DIVISION_ORDER } from '../types';

/**
 * The European League season. Domestic league weekends (two races each) are
 * spread through the year; continental matchdays, cup rounds and super cups
 * fill the weeks in between, the way midweek fixtures do in football.
 */
export const EURO_WEEKS = {
  superCup: 1,
  europeanSuperCup: 2,
  qualifying: [1, 3, 5],
  leaguePhase: [7, 9, 11, 13, 15, 17, 19, 21],
  playoff: [23, 25],
  r16: [27, 29],
  qf: [31, 33],
  sf: [35, 37],
  final: 39,
  cup: [6, 10, 14, 20, 28, 36],
  leagueCup: [8, 12, 16, 22, 30, 34],
} as const;

export const FIRST_LEAGUE_WEEK = 2;
export const LAST_LEAGUE_WEEK = 41;

/** Weeks of a league's race weekends, evenly spread. */
export function leagueWeeks(weekends: number): number[] {
  const span = LAST_LEAGUE_WEEK - FIRST_LEAGUE_WEEK;
  const out: number[] = [];
  for (let i = 0; i < weekends; i++) {
    let w = Math.round(FIRST_LEAGUE_WEEK + (weekends === 1 ? 0 : (i * span) / (weekends - 1)));
    if (out.length && w <= out[out.length - 1]) w = out[out.length - 1] + 1;
    out.push(w);
  }
  return out;
}

/** Circuit country codes of each association (the home nations share Britain's tracks). */
export function circuitCountry(assocId: string): string {
  return ({ ENG: 'GBR', SCO: 'GBR' } as Record<string, string>)[assocId] ?? assocId;
}

const EUROPE = new Set(['GBR', 'IRL', 'ESP', 'POR', 'FRA', 'BEL', 'NED', 'GER', 'ITA', 'AUT', 'SUI', 'MON', 'CZE', 'SVK', 'HUN', 'POL', 'SWE', 'NOR', 'DEN', 'FIN', 'EST', 'ISL', 'CRO', 'SLO', 'SRB', 'ROU', 'BUL', 'GRE', 'CYP', 'TUR', 'UKR', 'MLT', 'AZE']);

export const isEuropeanCircuit = (c: Circuit): boolean => EUROPE.has(c.country);

/** Circuits of an association's own country (may be none). */
export function homeCircuits(circuits: Circuit[], assocId: string): Circuit[] {
  const code = circuitCountry(assocId);
  return circuits.filter((c) => c.country === code);
}

/**
 * A season's venues for one league: the association's own circuits first, the
 * rest from around Europe, rotated every year so no two calendars repeat.
 */
export function leagueVenues(seed: number, season: number, assocId: string, level: number, weekends: number, circuits: Circuit[]): Circuit[] {
  const rng = Rng.from(seed, 'euroCalendar', season, assocId, level);
  const home = rng.shuffle(homeCircuits(circuits, assocId));
  const away = rng.shuffle(circuits.filter((c) => isEuropeanCircuit(c) && !home.includes(c)));
  const homeShare = Math.min(home.length, Math.ceil(weekends * 0.45));
  const chosen = [...home.slice(0, homeShare), ...away.slice(0, weekends - homeShare)];
  while (chosen.length < weekends) chosen.push(rng.pick([...home, ...away]));
  return chosen.sort((a, b) => (CIRCUIT_ORDER[a.id] ?? 0.5) - (CIRCUIT_ORDER[b.id] ?? 0.5));
}

/** Race distance of a league weekend's first and second race. */
export function leagueRaceLaps(division: DivisionId, circuitLaps: number, raceNo: 1 | 2): number {
  const full = raceLapsFor(division, circuitLaps);
  return Math.max(8, Math.round(full * (raceNo === 1 ? 0.75 : 0.55)));
}

/** The player's association: every league weekend as two calendar events. */
export function buildEuroCalendars(state: GameState, season: number): Record<DivisionId, CalendarEvent[]> {
  const out = Object.fromEntries(DIVISION_ORDER.map((d) => [d, [] as CalendarEvent[]])) as Record<DivisionId, CalendarEvent[]>;
  const europe = state.europe!;
  const circuits = Object.values(state.circuits);
  for (const division of activeDivisions(state)) {
    const level = levelOfDivision(division);
    const league = europe.leagues[`${europe.playerAssocId}-${level}`];
    const venues = leagueVenues(state.seed, season, europe.playerAssocId, level, league.weeks.length, circuits);
    league.weeks.forEach((week, i) => {
      const circuit = venues[i];
      const weekendId = `s${season}-${division}-w${i + 1}`;
      for (const raceNo of [1, 2] as const) {
        out[division].push({
          id: `${weekendId}-r${raceNo}`,
          division,
          round: i * 2 + raceNo,
          circuitId: circuit.id,
          week,
          completed: false,
          laps: leagueRaceLaps(division, circuit.laps, raceNo),
          euro: {
            competition: 'league',
            label: `${DIVISIONS[division].name} · Round ${i + 1}, Race ${raceNo}`,
            raceNo,
            weekendId,
            pairedEventId: raceNo === 2 ? `${weekendId}-r1` : `${weekendId}-r2`,
            gridRule: raceNo === 2 ? europe.race2Grid : undefined,
          },
        });
      }
    });
  }
  return out;
}
