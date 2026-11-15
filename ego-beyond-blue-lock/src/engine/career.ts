/** Career creation: turns a creator configuration into a new Game. */
import type { AbilityRef, Appearance, Career, CustomAbility, Foot, Game, Pos, Settings, World, Player } from './types';
import { SCHEMA_VERSION } from './types';
import { LOOKS } from './data/looks';
import { createWorld, rngOf, newPlayer, addToClub, assignNumbers } from './worldgen';
import { calcOvr, makeAttrs, solveToTarget, N_ATTR } from './attributes';
import { PERSONALITIES, registerCustom, abilityDef } from './abilities';
import { Rng, clamp, hashStr } from './rng';
import { initNel } from './nel';
import { relOf } from './relationships';
import { addNews, milestone } from './util';

export interface CareerConfig {
  seed: number;
  name: string; nick: string; nat: string; nat2: string[];
  age: number; h: number; w: number; foot: Foot; num: number;
  pos: Pos; pos2: Pos[];
  look: Appearance;
  personality: string; egoType: string; philosophy: string; backstory: string;
  rep: number;
  attrs: number[]; pot: number;
  weapons: string[]; passives: string[]; ultimate: string;
  custom: CustomAbility[];
  nelTeam: string;
  /** skip the NEL chapter and begin directly in professional football */
  skipNel?: boolean;
  /** club id to join when skipping ('' = let the game pick a club at your level) */
  proClub?: string;
  /** take over an existing NEL player (full name, e.g. 'Yoichi Isagi') instead of creating one */
  playAs?: string;
  settings: Settings;
}

export function defaultSettings(): Settings {
  return {
    difficulty: 1, injuries: 2, devSpeed: 1, realism: 1, freq: 1, canonChange: true, showProb: false, dynamicPot: true, autoFlow: false,
    matchSpeed: 1, reduceMotion: false, nel: { goalTarget: 3, starChange: true, starSec: 180, subs: 5, offside: true, topN: 23 }, mode: 'balanced',
  };
}

export const PRESETS = [
  { id: 'raw', name: 'Raw Prospect', ovr: 62, pot: 86, rep: 4, desc: 'Unpolished and unknown. You will start on the bench and fight for minutes.' },
  { id: 'academy', name: 'Academy Standout', ovr: 70, pot: 89, rep: 12, desc: 'A proper youth player with real tools. A squad option from day one.' },
  { id: 'contender', name: 'Blue Lock Contender', ovr: 78, pot: 93, rep: 22, desc: 'On the level of the project\'s core names. A likely starter.' },
  { id: 'generational', name: 'Generational Talent', ovr: 86, pot: 97, rep: 40, desc: 'Already among the best players in the league. Expect to be the system.' },
  { id: 'worldclass', name: 'Already World Class', ovr: 93, pot: 96, rep: 60, desc: 'A master-striker-level player in a youth league. You will dominate.' },
];

export function defaultLook(seed: number): Appearance {
  const r = Rng.seeded(seed);
  const L: Appearance = { skin: r.int(8), face: r.int(5), hair: r.int(16), hairCol: r.int(12), eyes: r.int(7), eyeCol: r.int(8), brows: r.int(5), mouth: r.int(6), acc: 0, beard: r.chance(0.2) ? 1 + r.int(4) : 0, mark: 0, hair2: 0, nose: r.int(4), ears: r.int(3), bg: 0 };
  // later additions draw from the generator afterwards so existing portraits keep their earlier features
  L.fringe = r.int(8); L.eyeSize = r.chance(0.6) ? 0 : 1 + r.int(2); L.cheek = r.chance(0.7) ? 0 : 1 + r.int(3); L.collar = r.int(6);
  if (r.chance(0.3)) L.hair = 16 + r.int(6);
  return L;
}
export function lookFor(id: string): Appearance { return defaultLook(hashStr(id)); }

export function defaultConfig(seed = Math.floor(Math.random() * 2 ** 31)): CareerConfig {
  const attrs = makeAttrs('ST', 78, 'poacher', Rng.seeded(seed));
  return {
    seed, name: '', nick: '', nat: 'JPN', nat2: [], age: 17, h: 178, w: 70, foot: 'R', num: 11, pos: 'ST', pos2: ['SS'],
    look: defaultLook(seed), personality: 'calm', egoType: 'devourer', philosophy: 'egoist', backstory: 'unknown', rep: 22,
    attrs, pot: 93, weapons: ['direct_shot'], passives: ['spatial', 'ice_veins'], ultimate: 'dead_angle_genesis', custom: [], nelTeam: 'nel_bastard', skipNel: false, proClub: '', settings: defaultSettings(),
  };
}

/** Balanced-mode attribute sheet for a position / OVR / style. Deterministic for a given seed. */
export function balancedAttrs(pos: Pos, target: number, style: string, seed: number): number[] {
  return makeAttrs(pos, target, style, Rng.seeded(seed));
}
/** Re-solve after the player nudged some attributes in balanced mode, keeping the chosen OVR. */
export function rebalance(attrs: number[], pos: Pos, target: number, locked: number[]): number[] {
  return solveToTarget(attrs.slice(), pos, target, new Set(locked));
}

export function validateConfig(c: CareerConfig): string[] {
  const e: string[] = [];
  if (!c.name.trim()) e.push('Enter a player name.');
  if (c.attrs.length !== N_ATTR) e.push('Attribute sheet is incomplete.');
  if (c.attrs.some((v) => !Number.isInteger(v) || v < 1 || v > 99)) e.push('Attributes must be whole numbers from 1 to 99.');

  if (c.pot < calcOvr(c.attrs, c.pos)) e.push('Potential cannot be lower than the current OVR.');
  if (!c.weapons.length) e.push('Choose a main weapon.');
  for (const id of [...c.weapons, ...c.passives, c.ultimate]) if (id && !abilityDef(id) && !c.custom.some((x) => x.id === id)) e.push(`Unknown ability: ${id}`);
  return e;
}

function baseCareer(cfg: CareerConfig, w: World, p: Player, o: number): Career {
  return {
    pid: p.id, look: cfg.look, egoType: cfg.egoType, philosophy: cfg.philosophy, personality: cfg.personality, backstory: cfg.backstory,
    mgrTrust: 50, discipline: 65, image: 0,
    plan: [{ type: 'technical', focus: 'shooting' }, { type: 'position' }, { type: 'weapon' }, { type: 'tactical' }, { type: 'recovery' }, { type: 'match' }, { type: 'recovery' }],
    intensity: 1, xp: new Array(N_ATTR).fill(0), xpSrc: {}, devLog: [], ovrLog: [{ s: w.season, day: 0, ovr: o }], learning: {}, reactions: [], custom: cfg.custom,
    rel: {}, people: {
      agent: { id: 'agent', name: 'Mirei Tanaka-Holt', role: 'agent', trait: 'pragmatic' },
      journo1: { id: 'journo1', name: 'Daniel Okonkwo', role: 'journalist', org: 'The Touchline', trait: 'fair' },
      journo2: { id: 'journo2', name: 'Claire Besson', role: 'journalist', org: 'Onze Mondial Daily', trait: 'provocative' },
      journo3: { id: 'journo3', name: 'Kenji Arakawa', role: 'journalist', org: 'Blue Lock TV', trait: 'hype' },
    },
    inbox: [], nextInteraction: 1, social: { week: -1, used: 0 }, offers: [], nextOffer: 1, matches: [], statHist: [], timeline: [], flags: {},
    instr: { stance: 1, press: 1, risk: 1 }, rivals: [], wages: 0, lastWageWeek: -1, digest: [],
  };
}
/** Start a career as an existing NEL player: his attributes, abilities, club and personality are kept as they are. */
function takeOver(cfg: CareerConfig, w: World, p: Player): Game {
  const club = w.clubs[p.nelTeam!];
  p.notable = true;
  const o = calcOvr(p.a, p.pos);
  const career = baseCareer(cfg, w, p, o);
  career.look = { ...lookFor(p.id), ...(LOOKS[p.name] ?? {}) };
  career.flags.playAs = 1;
  // weapons beyond the four-slot limit are not removed; an ultimate he already owns stays usable
  const g: Game = { schema: SCHEMA_VERSION, id: 'c' + Date.now().toString(36) + (cfg.seed % 1000), created: new Date().toISOString(), name: p.name, edited: false, settings: { ...cfg.settings, nel: { ...cfg.settings.nel } }, world: w, career, live: null };
  for (const id of club.squad) if (id !== p.id) relOf(g, id);
  relOf(g, club.mgr.id);
  initNel(g);
  milestone(g, 'start', `Took control of ${p.name} (${o}-rated ${p.pos}) at ${club.name} for the Neo Egoist League.`);
  addNews(g, 'nel', 'The Neo Egoist League begins', `Five clubs, ten matches, one ranking. Every performance will be valued in yen by the world's clubs — and only the top ${g.settings.nel.topN} of the Blue Lock ranking go to the U-20 World Cup. You are ${p.name} of ${club.name}.`, { imp: 3, me: true });
  return g;
}

export function newGame(cfg: CareerConfig): Game {
  const w = createWorld(cfg.seed >>> 0);
  const rng = rngOf(w);
  registerCustom(cfg.custom);
  const ab: AbilityRef[] = [];
  // one starting weapon; further weapons are unlocked in play and the ultimate starts dormant
  for (const id of cfg.weapons.slice(0, 1)) ab.push({ id, lv: 1, xp: 0 });
  for (const id of cfg.passives.slice(0, 3)) ab.push({ id, lv: 1, xp: 0 });
  const existing = cfg.playAs ? Object.values(w.players).find((x) => x.name === cfg.playAs && !!x.nelTeam && x.origin !== 'master') : undefined;
  if (existing) return takeOver(cfg, w, existing);
  const o = calcOvr(cfg.attrs, cfg.pos);
  const p = newPlayer(w, rng, { name: cfg.name.trim() || 'Player One', nat: cfg.nat, pos: cfg.pos, pos2: cfg.pos2.filter((x) => x !== cfg.pos), age: cfg.age, ovr: o, pot: cfg.pot, origin: 'user', ab, foot: cfg.foot });
  p.a = cfg.attrs.slice();
  p.pot = clamp(Math.max(cfg.pot, o), 1, 99);
  p.h = cfg.h; p.w = cfg.w; p.num = cfg.num;
  p.nick = cfg.nick.trim() || undefined;
  p.nat2 = cfg.nat2.filter((n) => n !== cfg.nat);
  p.rep = clamp(cfg.rep, 0, 99);
  p.notable = true;
  const pers = PERSONALITIES.find((x) => x.id === cfg.personality) ?? PERSONALITIES[0];
  p.pers = { ...pers.pers };
  const club = w.clubs[cfg.nelTeam] ?? w.clubs[w.nel.teams[0]];
  if (!cfg.skipNel) { addToClub(w, p, club); p.nelTeam = club.id; assignNumbers(w, club, p.id); }
  const career: Career = {
    pid: p.id, look: cfg.look, egoType: cfg.egoType, philosophy: cfg.philosophy, personality: cfg.personality, backstory: cfg.backstory,
    mgrTrust: 50, discipline: 65, image: cfg.personality === 'fiery' || cfg.personality === 'lonewolf' ? 20 : 0,
    plan: [{ type: 'technical', focus: 'shooting' }, { type: 'position' }, { type: 'weapon' }, { type: 'tactical' }, { type: 'recovery' }, { type: 'match' }, { type: 'recovery' }],
    intensity: 1, xp: new Array(N_ATTR).fill(0), xpSrc: {}, devLog: [], ovrLog: [{ s: w.season, day: 0, ovr: o }], learning: {}, reactions: [], custom: cfg.custom,
    rel: {}, people: {
      agent: { id: 'agent', name: 'Mirei Tanaka-Holt', role: 'agent', trait: 'pragmatic' },
      journo1: { id: 'journo1', name: 'Daniel Okonkwo', role: 'journalist', org: 'The Touchline', trait: 'fair' },
      journo2: { id: 'journo2', name: 'Claire Besson', role: 'journalist', org: 'Onze Mondial Daily', trait: 'provocative' },
      journo3: { id: 'journo3', name: 'Kenji Arakawa', role: 'journalist', org: 'Blue Lock TV', trait: 'hype' },
    },
    inbox: [], nextInteraction: 1, social: { week: -1, used: 0 }, offers: [], nextOffer: 1, matches: [], statHist: [], timeline: [], flags: {},
    instr: { stance: 1, press: 1, risk: 1 }, rivals: [], wages: 0, lastWageWeek: -1, digest: [],
  };
  if (cfg.ultimate) career.flags.ultPath = cfg.ultimate;
  const g: Game = { schema: SCHEMA_VERSION, id: 'c' + Date.now().toString(36) + (cfg.seed % 1000), created: new Date().toISOString(), name: p.name, edited: cfg.settings.mode === 'unrestricted' && false, settings: { ...cfg.settings, nel: { ...cfg.settings.nel } }, world: w, career, live: null };
  if (!cfg.skipNel) { for (const id of club.squad) if (id !== p.id) relOf(g, id); relOf(g, club.mgr.id); }
  initNel(g);
  if (cfg.skipNel) { g.career.flags.skippedNel = 1; milestone(g, 'start', `Turned professional directly as a ${o}-rated ${cfg.pos}, skipping the Neo Egoist League.`); return g; }
  milestone(g, 'start', `Arrived at ${club.name} for the Neo Egoist League as a ${o}-rated ${cfg.pos}.`);
  addNews(g, 'nel', 'The Neo Egoist League begins', `Five clubs, ten matches, one ranking. Every performance will be valued in yen by the world's clubs — and only the top ${g.settings.nel.topN} of the Blue Lock ranking go to the U-20 World Cup. ${p.name} starts at ${club.name}.`, { imp: 3, me: true });
  return g;
}
