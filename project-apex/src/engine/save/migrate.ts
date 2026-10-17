import { DIVISIONS } from '../config/divisions';
import { activeDivisions, applyRuleset } from '../config/ruleset';
import { addNews } from '../news/news';
import { leagueRaceLaps } from '../europe/schedule';
import type { CalendarEvent, GameState } from '../types';
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
