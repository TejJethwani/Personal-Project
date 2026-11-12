/**
 * Save integrity: schema versioning, migrations, validation of imported data and
 * JSON export/import. Corrupt or foreign files are rejected with a readable reason
 * instead of crashing the game.
 */
import type { Game } from './types';
import { SCHEMA_VERSION } from './types';
import { ovr, N_ATTR } from './attributes';
import { NSTAT } from './match/model';
import { seasonLabel } from './competitions';

export interface SaveSummary { name: string; ovr: number; pos: string; club: string; season: string; phase: string; edited: boolean; age: number }
export function summarize(g: Game): SaveSummary {
  const p = g.world.players[g.career.pid];
  const club = p.club ? g.world.clubs[p.club]?.name ?? '—' : p.retired ? 'Retired' : 'Free agent';
  return { name: p.name, ovr: ovr(p), pos: p.pos, club, season: g.world.phase === 'nel' ? 'Neo Egoist League' : seasonLabel(g.world.season), phase: g.world.phase, edited: g.edited, age: g.world.season - p.born };
}

type Migration = (g: Record<string, any>) => void;
/** migrations[n] upgrades a save from schema n to n+1. */
const MIGRATIONS: Record<number, Migration> = {
  1: (g) => { g.career.custom ??= []; g.career.reactions ??= []; },
  2: (g) => { g.world.events ??= []; g.world.pool ??= {}; g.career.digest ??= []; g.settings.nel ??= { goalTarget: 3, starChange: true, starSec: 180, subs: 5, offside: true, topN: 23 }; },
};
export function migrate(raw: Record<string, any>): Game {
  let v = Number(raw.schema);
  if (!Number.isInteger(v) || v < 1) throw new Error('This file has no valid schema version.');
  if (v > SCHEMA_VERSION) throw new Error(`This save was made with a newer version of the game (schema ${v}; this build understands up to ${SCHEMA_VERSION}).`);
  while (v < SCHEMA_VERSION) { const m = MIGRATIONS[v]; if (m) m(raw); v++; raw.schema = v; }
  return raw as Game;
}

/** Structural and referential validation. Returns a list of problems (empty = valid). */
export function validate(g: any): string[] {
  const e: string[] = [];
  const need = (cond: unknown, msg: string) => { if (!cond) e.push(msg); };
  if (!g || typeof g !== 'object') return ['Not a save file.'];
  need(typeof g.id === 'string', 'Missing career id.');
  need(g.settings && typeof g.settings === 'object', 'Missing settings.');
  need(g.career && typeof g.career === 'object', 'Missing career data.');
  const w = g.world;
  if (!w || typeof w !== 'object') return [...e, 'Missing world data.'];
  need(Array.isArray(w.rng) && w.rng.length === 4 && w.rng.every((x: unknown) => Number.isFinite(x)), 'Random generator state is missing or damaged.');
  need(Number.isInteger(w.season) && Number.isInteger(w.day), 'Calendar is damaged.');
  for (const k of ['players', 'clubs', 'comps', 'fixtures']) need(w[k] && typeof w[k] === 'object', `Missing ${k}.`);
  if (e.length) return e;
  const me = w.players[g.career?.pid];
  need(me, 'Your player is missing from the world.');
  let bad = 0;
  for (const id in w.players) {
    const p = w.players[id];
    if (!p || p.id !== id || !Array.isArray(p.a) || p.a.length !== N_ATTR || p.a.some((v: unknown) => typeof v !== 'number' || !(v >= 1 && v <= 99))) { bad++; continue; }
    if (p.club && !w.clubs[p.club]) bad++;
    for (const c in p.ss) if (!Array.isArray(p.ss[c]) || p.ss[c].length !== NSTAT) { bad++; break; }
  }
  need(bad === 0, `${bad} player record(s) are damaged.`);
  let badClub = 0;
  for (const id in w.clubs) { const c = w.clubs[id]; if (!c || !Array.isArray(c.squad) || c.squad.some((pid: string) => !w.players[pid])) badClub++; }
  need(badClub === 0, `${badClub} club record(s) reference missing players.`);
  let badFx = 0;
  for (const id in w.fixtures) { const f = w.fixtures[id]; if (!f || typeof f.h !== 'string' || typeof f.a !== 'string' || (f.played && (!Array.isArray(f.sc) || f.sc.length !== 2))) badFx++; else if (f.played && f.goals && f.goals.length !== f.sc[0] + f.sc[1]) badFx++; }
  need(badFx === 0, `${badFx} fixture record(s) are inconsistent.`);
  return e;
}

export function exportSave(g: Game): string {
  return JSON.stringify({ format: 'ego-beyond-blue-lock-save', exported: new Date().toISOString(), game: g });
}
/** Parse, migrate and validate an imported save. Throws an Error with a readable message on failure. */
export function importSave(text: string): Game {
  let raw: any;
  try { raw = JSON.parse(text); } catch { throw new Error('This file is not valid JSON — it may be corrupt or truncated.'); }
  if (!raw || typeof raw !== 'object') throw new Error('This file is not a save.');
  if (raw.format !== 'ego-beyond-blue-lock-save' || !raw.game) throw new Error('This file is not an EGO: Beyond Blue Lock save.');
  const g = migrate(raw.game);
  const problems = validate(g);
  if (problems.length) throw new Error('The save is damaged: ' + problems.slice(0, 3).join(' '));
  return g;
}
/** Deep copy through JSON — also proves a game state is fully serialisable. */
export function cloneGame(g: Game): Game { return JSON.parse(JSON.stringify(g)); }
