/** Small validated player actions used by the UI. */
import { POINTS_PRESETS } from './config/divisions';
import { playerTeam } from './selectors';
import type { Difficulty, DivisionId, GameSettings, TrainingFocus, TrainingIntensity } from './types';
import type { GameState } from './types';
import { assertRule } from './util';

export function setTraining(state: GameState, driverId: string, patch: { intensity?: TrainingIntensity; focus?: TrainingFocus }): void {
  const d = state.drivers[driverId];
  assertRule(d && d.contract?.teamId === state.player.teamId, 'You can only set training for your own drivers.');
  if (patch.intensity) {
    assertRule(['light', 'normal', 'intense'].includes(patch.intensity), 'Invalid intensity.');
    d.training.intensity = patch.intensity;
  }
  if (patch.focus) d.training.focus = patch.focus;
}

export function markNewsRead(state: GameState, ids: string[] | 'all'): void {
  for (const n of state.news) if (ids === 'all' || ids.includes(n.id)) n.read = true;
}

export function setDifficulty(state: GameState, difficulty: Difficulty): void {
  assertRule(['casual', 'standard', 'realistic', 'hardcore'].includes(difficulty), 'Invalid difficulty.');
  state.settings.difficulty = difficulty;
}

export function setPointsPreset(state: GameState, division: DivisionId, preset: string): void {
  assertRule(!!POINTS_PRESETS[preset], 'Unknown points system.');
  const pending = { ...(state.settings.pendingPointsPreset ?? state.settings.pointsPreset) };
  pending[division] = preset;
  state.settings.pendingPointsPreset = pending;
}

export function updateSettings(state: GameState, patch: Partial<Pick<GameSettings, 'autosave' | 'defaultRaceSpeed' | 'autoSkipAiWeekends'>>): void {
  Object.assign(state.settings, patch);
}

export function renameTeam(state: GameState, name: string): void {
  assertRule(name.trim().length >= 3, 'Team names need at least three characters.');
  playerTeam(state).name = name.trim().slice(0, 32);
}
