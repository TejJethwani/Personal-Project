/** Tiny app store: the Game object is mutated in place by the engine; a version counter drives re-renders. */
import { useSyncExternalStore } from 'react';
import type { Game } from '../engine/types';
import { saveGame } from '../storage/idb';
import { registerCustom } from '../engine/abilities';

export interface Route { name: string; id?: string; tab?: string }
interface UI { route: Route; toasts: { id: number; text: string; bad?: boolean }[]; busy: string; moment: { t1: string; t2?: string; kind?: string; id: number } | null; navOpen: boolean }
let game: Game | null = null;
let version = 0;
const ui: UI = { route: { name: 'menu' }, toasts: [], busy: '', moment: null, navOpen: false };
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

export function useStore(): { g: Game | null; ui: UI; v: number } {
  const v = useSyncExternalStore(subscribe, () => version);
  return { g: game, ui, v };
}
export function getGame(): Game | null { return game; }
export function setGame(g: Game | null): void { game = g; if (g) registerCustom(g.career.custom); emit(); }

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function autosave(now = false): void {
  if (!game) return;
  if (saveTimer) clearTimeout(saveTimer);
  const run = () => { saveTimer = null; if (game) saveGame(game, 'auto').catch(() => toast('Autosave failed — export your save from Settings.', true)); };
  if (now) run(); else saveTimer = setTimeout(run, 700);
}
/** Mutate the game through the engine, re-render, and autosave. */
export function act<T>(fn: (g: Game) => T, save = true): T | undefined {
  if (!game) return undefined;
  const r = fn(game);
  emit();
  if (save) autosave();
  return r;
}
export function refresh(): void { emit(); }

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, id, tab] = h.split('/');
  return { name: name || 'menu', id: id ? decodeURIComponent(id) : undefined, tab };
}
export function nav(name: string, id?: string, tab?: string): void {
  const h = '#/' + name + (id ? '/' + encodeURIComponent(id) : '') + (tab ? '/' + tab : '');
  ui.navOpen = false;
  if (location.hash !== h) location.hash = h; else { ui.route = { name, id, tab }; emit(); }
  document.querySelector('.main')?.scrollTo(0, 0);
}
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { ui.route = parseHash(); emit(); });
  ui.route = parseHash();
}
let tid = 1;
export function toast(text: string, bad = false): void {
  const id = tid++;
  ui.toasts.push({ id, text, bad });
  emit();
  setTimeout(() => { ui.toasts = ui.toasts.filter((t) => t.id !== id); emit(); }, 4200);
}
export function setBusy(s: string): void { ui.busy = s; emit(); }
export function moment(t1: string, t2?: string, kind?: string): void {
  const id = tid++;
  ui.moment = { t1, t2, kind, id };
  emit();
  setTimeout(() => { if (ui.moment?.id === id) { ui.moment = null; emit(); } }, 2200);
}
export function toggleNav(): void { ui.navOpen = !ui.navOpen; emit(); }
