/** Small validated player actions used by the UI. */
import { customPointsProblem, POINTS_PRESETS } from './config/divisions';
import { playerTeam } from './selectors';
import type { Difficulty, DivisionId, GameSettings, NewCareerConfig, TrainingFocus, TrainingIntensity } from './types';
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
  assertRule(!!POINTS_PRESETS[preset] && preset !== 'h2h', 'Unknown points system.');
  assertRule(preset !== 'custom' || !!(state.settings.pendingCustomPoints ?? state.settings.customPoints), 'Set up your custom points table first.');
  const pending = { ...(state.settings.pendingPointsPreset ?? state.settings.pointsPreset) };
  pending[division] = preset;
  state.settings.pendingPointsPreset = pending;
}

/** Edit the career's custom points table; like any scoring change it applies from next season. */
export function setCustomPoints(state: GameState, table: number[]): void {
  const clean = table.map((p) => Math.round(Number(p)));
  const problem = customPointsProblem(clean);
  assertRule(!problem, problem ?? '');
  state.settings.pendingCustomPoints = clean;
}

/** Scoring chosen when the career is created: applies to every championship straight away. */
export function applyPointsChoice(state: GameState, choice: NonNullable<NewCareerConfig['points']>): void {
  if (choice.system === 'custom') {
    const clean = (choice.custom ?? []).map((p) => Math.round(Number(p)));
    const problem = customPointsProblem(clean);
    assertRule(!problem, problem ?? '');
    state.settings.customPoints = clean;
  }
  if (choice.system === 'default') return;
  for (const d of Object.keys(state.settings.pointsPreset) as DivisionId[]) state.settings.pointsPreset[d] = choice.system;
}

export function updateSettings(state: GameState, patch: Partial<Pick<GameSettings, 'autosave' | 'defaultRaceSpeed' | 'autoSkipAiWeekends'>>): void {
  Object.assign(state.settings, patch);
}

export function renameTeam(state: GameState, name: string): void {
  assertRule(name.trim().length >= 3, 'Team names need at least three characters.');
  playerTeam(state).name = name.trim().slice(0, 32);
}
