import { DIVISIONS } from '../config/divisions';
import type { GameState } from '../types';
import { validateState } from '../validation';
import { SAVE_VERSION } from '../world/generate';
import { hashString } from '../rng';
import { migrateState } from './migrate';

export const SAVE_FORMAT = 'project-apex-save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  checksum: string;
  meta: SaveMeta;
  state: GameState;
}

export interface SaveMeta {
  teamName: string;
  division: string;
  season: number;
  year: number;
  week: number;
  principal: string;
  difficulty: string;
  /** Career mode (absent in older saves = Classic). */
  mode?: 'career' | 'european';
  /** League name for European League careers. */
  league?: string;
  /** Sandbox money has been used in this career. */
  sandbox?: boolean;
}

export function saveMeta(state: GameState): SaveMeta {
  const team = state.teams[state.player.teamId];
  const european = state.mode === 'european';
  return {
    teamName: team?.name ?? 'Unknown',
    division: team?.division ?? 'F5',
    season: state.season,
    year: state.year,
    week: state.week,
    principal: state.player.principalName,
    difficulty: state.settings.difficulty,
    mode: european ? 'european' : 'career',
    ...(european && team ? { league: DIVISIONS[team.division].name } : {}),
    ...(state.settings.sandboxUsed ? { sandbox: true } : {}),
  };
}

function checksumOf(json: string): string {
  return hashString(json).toString(16).padStart(8, '0');
}

export function serializeGame(state: GameState): string {
  state.savedAt = Date.now();
  const stateJson = JSON.stringify(state);
  const envelope = { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: state.savedAt, checksum: checksumOf(stateJson), meta: saveMeta(state) };
  // Embed the already-serialised state to avoid stringifying twice.
  return `${JSON.stringify(envelope).slice(0, -1)},"state":${stateJson}}`;
}

export class SaveFormatError extends Error {}

/** Parse, verify and migrate a save. Throws SaveFormatError with a readable message. */
export function deserializeGame(text: string): GameState {
  let parsed: SaveEnvelope;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveFormatError('The file is not valid JSON.');
  }
  if (!parsed || parsed.format !== SAVE_FORMAT) throw new SaveFormatError('This is not a PROJECT APEX save file.');
  if (typeof parsed.version !== 'number' || parsed.version > SAVE_VERSION) throw new SaveFormatError(`Unsupported save version ${parsed.version}.`);
  // Verify the save exactly as written, then bring it up to date.
  const sum = checksumOf(JSON.stringify(parsed.state));
  if (sum !== parsed.checksum) throw new SaveFormatError('The save file is corrupted or has been modified (checksum mismatch).');
  const state = migrateState(parsed.state, parsed.version);
  const problems = validateState(state);
  if (problems.length) throw new SaveFormatError(`The save failed validation: ${problems.slice(0, 3).join('; ')}`);
  return state;
}
