import { openDB, type IDBPDatabase } from 'idb';
import { deserializeGame, saveMeta, serializeGame, type SaveMeta } from '@/engine/save/serialization';
import type { GameState } from '@/engine/types';

const DB_NAME = 'project-apex';
const STORE = 'saves';

export interface SaveRecord {
  slot: string;
  meta: SaveMeta;
  savedAt: number;
  size: number;
  data: string;
}

export type SaveSummary = Omit<SaveRecord, 'data'>;

export const MANUAL_SLOTS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'];
export const AUTOSAVE_SLOT = 'autosave';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'slot' });
      },
    });
  }
  return dbPromise;
}

export async function saveToSlot(slot: string, state: GameState): Promise<SaveSummary> {
  const data = serializeGame(state);
  const record: SaveRecord = { slot, meta: saveMeta(state), savedAt: Date.now(), size: data.length, data };
  await (await db()).put(STORE, record);
  const { data: _omit, ...summary } = record;
  return summary;
}

export async function loadFromSlot(slot: string): Promise<GameState> {
  const record = (await (await db()).get(STORE, slot)) as SaveRecord | undefined;
  if (!record) throw new Error('That save slot is empty.');
  return deserializeGame(record.data);
}

export async function listSaves(): Promise<SaveSummary[]> {
  const all = (await (await db()).getAll(STORE)) as SaveRecord[];
  return all.map(({ data: _d, ...rest }) => rest).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSlot(slot: string): Promise<void> {
  await (await db()).delete(STORE, slot);
}

/** Trigger a browser download of the save as JSON. */
export function exportSave(state: GameState): void {
  const data = serializeGame(state);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const team = state.teams[state.player.teamId]?.shortName ?? 'APEX';
  a.href = url;
  a.download = `project-apex-${team}-S${state.season}-W${Math.max(0, state.week)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function importSave(file: File): Promise<GameState> {
  const text = await file.text();
  return deserializeGame(text);
}

/** Test hook: reset the cached connection (used with fake-indexeddb). */
export function _resetDbForTests(): void {
  dbPromise = null;
}
