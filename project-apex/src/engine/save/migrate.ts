import { COMPONENT_KEYS, divisionCarBase } from '../car/car';
import { DIVISIONS } from '../config/divisions';
import { activeDivisions, applyRuleset, divisionForLevel } from '../config/ruleset';
import { addNews } from '../news/news';
import { leagueRaceLaps } from '../europe/schedule';
import { clubPower, DRIVER_WEIGHT, ELITE, eliteFactor, LEVEL_PACE } from '../europe/power';
import type { CalendarEvent, DivisionId, GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { SAVE_VERSION } from '../world/generate';

/**
 * Bring a save from an older version up to date. Every step only fills in
 * what is missing or retires what no longer exists, so a migrated career keeps
 * every result it has already raced.
 */
export function migrateState(state: GameState, fromVersion: number): GameState {
  applyRuleset(state);
  if (fromVersion < 2) {
    oneRacePerGameweek(state);
    expandedPointsNextSeason(state);
  }
  if (fromVersion < 3) oneRatingScale(state);
  state.version = SAVE_VERSION;
  return state;
}

/** How version 1 described a league race (two per weekend). */
interface LegacyLeagueMeta {
  competition: string;
  label: string;
  raceNo?: 1 | 2;
  weekendId?: string;
  pairedEventId?: string;
  gridRule?: string;
}

/**
 * Version 1 European League weekends had two shortened races. From now on a
 * gameweek is one full-distance race: second races not yet run are dropped,
 * the remaining gameweeks run the full distance and are renumbered. Races
 * already finished (and one under way) stay exactly as they were.
 */
function oneRacePerGameweek(state: GameState): void {
  if (!state.europe) return;
  delete (state.europe as { race2Grid?: unknown }).race2Grid;
  const live = state.weekend?.eventId;
  const locked = (ev: CalendarEvent) => ev.completed || ev.id === live;
  for (const d of DIVISION_ORDER) {
    const calendar = state.calendars[d];
    if (!calendar?.length) continue;
    const kept = calendar.filter((ev) => {
      const meta = ev.euro as LegacyLeagueMeta | undefined;
      return locked(ev) || meta?.competition !== 'league' || meta.raceNo !== 2;
    });
    let round = kept.filter(locked).length;
    for (const ev of kept) {
      const meta = ev.euro as LegacyLeagueMeta | undefined;
      if (locked(ev) || meta?.competition !== 'league') continue;
      round += 1;
      const gameweek = Number(meta.weekendId?.match(/-w(\d+)$/)?.[1] ?? round);
      ev.round = round;
      ev.laps = leagueRaceLaps(ev.division, state.circuits[ev.circuitId]?.laps ?? 50);
      ev.euro = { competition: 'league', label: `${DIVISIONS[ev.division].name} · Gameweek ${gameweek}` };
    }
    state.calendars[d] = kept;
  }
}

/**
 * European League careers scored only the top ten of a 40-car grid. They move
 * to the Expanded system from next season (this season's races keep the
 * points they were run under); a scoring change already queued is left alone.
 */
function expandedPointsNextSeason(state: GameState): void {
  if (state.mode !== 'european' || state.settings.pendingPointsPreset) return;
  const next = { ...state.settings.pointsPreset };
  const moved = activeDivisions(state).filter((d) => next[d] === 'modern');
  if (!moved.length) return;
  for (const d of moved) next[d] = 'expanded';
  state.settings.pendingPointsPreset = next;
  addNews(state, {
    category: 'regulation',
    headline: 'EXPANDED POINTS FROM NEXT SEASON',
    body: 'From next season the top three-quarters of every grid score: 50-45-41-38-35-32-29-27-25-22, then down to 1 point (30 scoring places on a 40-car grid). This season finishes under the current system. You can choose another system in Settings.',
    importance: 2,
  });
}

/** Level pace before version 3, when the tiers of an association were 6 points apart. */
const LEGACY_LEVEL_PACE: Record<DivisionId, number> = { F1: 0, F2: -6, F3: -12, F4: -18, F5: -24 };

/**
 * Version 3 rates every tier of a European League career on one scale and
 * gives each top flight an established elite. Cars move to their tier's base
 * (a re-labelling: league races run exactly as before), quick-model clubs
 * move to the wider gaps between levels, and the strongest quarter of every
 * top flight gets the elite's extra pace.
 */
function oneRatingScale(state: GameState): void {
  const europe = state.europe;
  if (state.mode !== 'european' || !europe) return;
  for (const team of Object.values(state.teams)) {
    const shift = divisionCarBase(team.division) - 50;
    if (!shift) continue;
    for (const k of COMPONENT_KEYS) team.car.components[k] = Math.round((team.car.components[k] + shift) * 100) / 100;
  }
  for (const club of Object.values(europe.clubs)) {
    if (club.teamId) continue;
    const d = divisionForLevel(club.level);
    club.power = Math.round((club.power + LEVEL_PACE[d] - LEGACY_LEVEL_PACE[d]) * 10) / 10;
  }
  for (const league of Object.values(europe.leagues)) {
    if (league.level !== 1) continue;
    const ranked = [...league.clubIds].sort((a, b) => clubPower(state, europe.clubs[b]) - clubPower(state, europe.clubs[a]));
    ranked.forEach((id, i) => {
      const elite = eliteFactor(ranked.length > 1 ? 1 - (2 * i) / (ranked.length - 1) : 0, 1);
      if (!elite) return;
      const club = europe.clubs[id];
      const team = club.teamId ? state.teams[club.teamId] : null;
      if (team && !team.guest) {
        if (team.isPlayer) return;
        for (const k of COMPONENT_KEYS) team.car.components[k] = Math.round(Math.min(99, team.car.components[k] + elite * ELITE.car) * 100) / 100;
        team.reputation = Math.min(99, Math.round(team.reputation + elite * ELITE.reputation));
      } else if (!team) {
        club.power = Math.round((club.power + elite * (ELITE.car + DRIVER_WEIGHT * ELITE.driver)) * 10) / 10;
      }
    });
  }
  addNews(state, {
    category: 'regulation',
    headline: 'ONE RATING SCALE FOR EVERY TIER',
    body: `Car ratings now show how far apart the tiers are: a ${DIVISIONS[divisionForLevel(1)].name} field is built around ${divisionCarBase(divisionForLevel(1))}, the level below around ${divisionCarBase(divisionForLevel(2))}. League races run exactly as before. The strongest clubs in every top flight now form an elite well clear of mid-table, and a promoted car only makes up part of the gap to its new league.`,
    importance: 2,
  });
}
