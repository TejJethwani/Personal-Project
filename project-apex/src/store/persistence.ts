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
/** European League careers save to their own slots, never over a Classic career. */
export const EURO_MANUAL_SLOTS = ['euro-slot-1', 'euro-slot-2', 'euro-slot-3', 'euro-slot-4', 'euro-slot-5'];
export const EURO_AUTOSAVE_SLOT = 'euro-autosave';

export const isEuroSlot = (slot: string): boolean => slot.startsWith('euro-');
export const autosaveSlotFor = (state: Pick<GameState, 'mode'>): string => (state.mode === 'european' ? EURO_AUTOSAVE_SLOT : AUTOSAVE_SLOT);
export const manualSlotsFor = (state: Pick<GameState, 'mode'>): string[] => (state.mode === 'european' ? EURO_MANUAL_SLOTS : MANUAL_SLOTS);

export function slotLabel(slot: string): string {
  if (slot === AUTOSAVE_SLOT || slot === EURO_AUTOSAVE_SLOT) return 'Autosave';
  return slot.replace('euro-', '').replace('slot-', 'Slot ');
}

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

interface DownloadsApi {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

/**
 * Hosted on claude.ai the page runs in a sandbox that blocks script-started
 * downloads; there the host's `downloads` capability offers the file instead.
 * Resolves null when the page runs anywhere else.
 */
async function hostDownloads(): Promise<DownloadsApi | null> {
  const host = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (typeof host?.use !== 'function') return null;
  try {
    return (await host.use('downloads')) as DownloadsApi | null;
  } catch {
    return null;
  }
}

/** Offer the save as a JSON file. Resolves false if the player declined. */
export async function exportSave(state: GameState): Promise<boolean> {
  const data = serializeGame(state);
  const team = state.teams[state.player.teamId]?.shortName ?? 'APEX';
  const filename = `project-apex-${team}-S${state.season}-W${Math.max(0, state.week)}.json`;
  const blob = new Blob([data], { type: 'application/json' });
  const downloads = await hostDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob });
      return true;
    } catch (err) {
      if ((err as { code?: string }).code === 'declined') return false;
      throw new Error((err as { message?: string }).message ?? 'The save file could not be offered.');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export async function importSave(file: File): Promise<GameState> {
  const text = await file.text();
  return deserializeGame(text);
}

/** Test hook: reset the cached connection (used with fake-indexeddb). */
export function _resetDbForTests(): void {
  dbPromise = null;
}
