/**
 * IndexedDB persistence. Each save slot is one record; a lightweight `meta` store lists slots
 * without loading the full world. Falls back to an in-memory store if IndexedDB is unavailable.
 */
import type { Game } from '../engine/types';
import { summarize, migrate, validate, type SaveSummary } from '../engine/save';
import { currentUser, isAdmin } from './accounts';

export interface SlotMeta { owner?: string; slot: string; careerId: string; kind: 'auto' | 'manual'; label: string; updated: string; summary: SaveSummary; schema: number }
const DB = 'ego-beyond-blue-lock', VER = 1;
const mem = { saves: new Map<string, unknown>(), meta: new Map<string, SlotMeta>() };
let useMem = false;
export function storageMode(): 'indexeddb' | 'memory' { return useMem ? 'memory' : 'indexeddb'; }

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves'); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore, m: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((res, rej) => {
    const t = db.transaction(['saves', 'meta'], mode);
    let out: T | undefined;
    const rq = fn(t.objectStore('saves'), t.objectStore('meta'));
    if (rq) rq.onsuccess = () => { out = rq.result; };
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = () => { db.close(); rej(t.error); };
    t.onabort = () => { db.close(); rej(t.error); };
  }));
}

const SLOT_OF = new Map<string, { slot: string; owner?: string }>();
export async function saveGame(g: Game, kind: 'auto' | 'manual' = 'auto', label?: string): Promise<SlotMeta> {
  const owner = isAdmin() ? undefined : currentUser() ?? undefined;
  const base = kind === 'auto' ? `auto:${g.id}` : `manual:${g.id}:${Date.now()}`;
  // a career keeps the slot (and owner) it was loaded from; new careers belong to whoever is signed in
  const prev = SLOT_OF.get(g.id);
  const slot = kind === 'auto' && prev ? prev.slot : owner ? `u:${owner}:${base}` : base;
  const meta: SlotMeta = { owner: kind === 'auto' && prev ? prev.owner : owner, slot, careerId: g.id, kind, label: label ?? (kind === 'auto' ? 'Autosave' : 'Manual save'), updated: new Date().toISOString(), summary: summarize(g), schema: g.schema };
  try {
    if (useMem) throw new Error('mem');
    await tx('readwrite', (s, m) => { s.put(g, slot); m.put(meta, slot); });
  } catch {
    useMem = true;
    mem.saves.set(slot, JSON.parse(JSON.stringify(g)));
    mem.meta.set(slot, meta);
  }
  if (kind === 'auto') SLOT_OF.set(g.id, { slot, owner: meta.owner });
  return meta;
}
/** Saves visible to the signed-in account (guests see unowned saves; the administrator sees everything). */
export async function listSaves(all = false): Promise<SlotMeta[]> {
  let list: SlotMeta[];
  try { if (useMem) throw new Error('mem'); list = ((await tx<SlotMeta[]>('readonly', (_s, m) => m.getAll())) ?? []) as SlotMeta[]; }
  catch { useMem = true; list = [...mem.meta.values()]; }
  if (!all && !isAdmin()) { const me = currentUser() ?? undefined; list = list.filter((m) => (m.owner ?? undefined) === me); }
  return list.sort((a, b) => b.updated.localeCompare(a.updated));
}
/** Load a slot. Migrates old schemas and validates; throws a readable Error if the data is unusable. */
export async function loadGame(slot: string): Promise<Game> {
  let raw: unknown;
  try { if (useMem) throw new Error('mem'); raw = await tx<unknown>('readonly', (s) => s.get(slot)); }
  catch { useMem = true; raw = mem.saves.get(slot); if (raw) raw = JSON.parse(JSON.stringify(raw)); }
  if (!raw) throw new Error('That save slot is empty.');
  const g = migrate(raw as Record<string, unknown>);
  if (slot.includes('auto:')) SLOT_OF.set(g.id, { slot, owner: slot.startsWith('u:') ? slot.split(':')[1] : undefined });
  const problems = validate(g);
  if (problems.length) throw new Error('This save is damaged and cannot be loaded: ' + problems.slice(0, 2).join(' '));
  return g;
}
export async function deleteSave(slot: string): Promise<void> {
  try { if (useMem) throw new Error('mem'); await tx('readwrite', (s, m) => { s.delete(slot); m.delete(slot); }); }
  catch { useMem = true; mem.saves.delete(slot); mem.meta.delete(slot); }
}
