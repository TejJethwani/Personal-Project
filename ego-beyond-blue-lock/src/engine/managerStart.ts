/** Starting a manager career: build the world, let the Neo Egoist League play out, then take charge of a club. */
import type { Game, ManagerState, Settings } from './types';
import { SCHEMA_VERSION } from './types';
import { createWorld, rngOf, newPlayer } from './worldgen';
import { baseCareer, defaultConfig } from './career';
import { initNel } from './nel';
import { step } from './sim';
import { appoint } from './manager';

export interface ManagerConfig { name: string; nat: string; club: string; seed: number; settings?: Settings }

/** Clubs you can take over at the start (every league club). */
export function startableClubs(g: Game): string[] { return Object.values(g.world.clubs).filter((c) => c.league && !c.nel && !c.dormant).map((c) => c.id); }

export function newManagerGame(cfg: ManagerConfig): Game {
  const w = createWorld(cfg.seed >>> 0);
  const rng = rngOf(w);
  const base = defaultConfig(cfg.seed);
  // the career object needs a player id; in manager mode it is a retired stand-in who never plays
  const ghost = newPlayer(w, rng, { name: cfg.name.trim() || 'The Manager', nat: cfg.nat, pos: 'CM', age: 38, ovr: 50, pot: 50, origin: 'regen', ab: [] });
  ghost.retired = w.season - 1; ghost.club = null; ghost.con = null; ghost.notable = false;
  const career = baseCareer({ ...base, name: cfg.name }, w, ghost, 50);
  career.flags.manager = 1;
  career.flags.nelSummarySeen = 1;
  const mgr: ManagerState = {
    name: cfg.name.trim() || 'The Manager', nat: cfg.nat, club: '', since: w.season, rep: 50, conf: 62, confLog: [], budget: 0, wageBudget: 0,
    obj: { pos: 10, text: '' }, sheet: null, autoPick: true, autoSubs: false, listed: [], releaseAtEnd: [], offers: [], msgs: [], nextId: 1,
    matches: [], deals: [], hist: [], trophies: [], sacked: false, jobs: [], unread: 0,
  };
  const g: Game = { schema: SCHEMA_VERSION, id: 'm' + Date.now().toString(36) + (cfg.seed % 1000), created: new Date().toISOString(), name: mgr.name, edited: false, settings: { ...(cfg.settings ?? base.settings), nel: { ...(cfg.settings ?? base.settings).nel } }, world: w, career, live: null, mgr };
  initNel(g);
  // the NEL and the summer play out without you; you arrive for the first professional season
  for (let guard = 0; guard < 4000 && w.phase === 'nel'; guard++) {
    const r = step(g);
    if (r === 'summary') g.career.flags.nelSummarySeen = 1;
  }
  const club = w.clubs[cfg.club];
  if (!club || !club.league || club.nel) throw new Error('Pick a league club to manage.');
  mgr.rep = Math.max(35, Math.min(80, club.rep - 8));
  appoint(g, club.id);
  g.career.digest = [];
  return g;
}
