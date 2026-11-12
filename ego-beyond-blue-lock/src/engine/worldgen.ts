/**
 * World generation: clubs, managers, squads (baseline players + original fictional players),
 * NEL teams, plus shared helpers for creating players and valuing them.
 */
import type { AbilityRef, Club, Manager, Origin, Personality, Player, Pos, World, Canon, Contract, SquadRole } from './types';
import { BASELINE_SEASON } from './types';
import { Rng, clamp, seedState, hashStr } from './rng';
import { A, makeAttrs, ovr, POS_LINE, stylesFor, N_ATTR } from './attributes';
import { abilityDef, suggestWeapons, PASSIVES, ULTIMATES, XP_LEVELS } from './abilities';
import { NATIONS, NAME_POOLS, COACH_FIRST, COACH_LAST } from './data/nations';
import { LEAGUES, POOLS, NEL_TEAMS, STYLES_TAC } from './data/clubs';
import { REAL } from './data/realPlayers';
import { NEL_BLUELOCK, NEL_YOUTH, NEL_MASTERS, WORLD_EXTRA, type NelRow } from './data/nel';

export function rngOf(w: World): Rng { return new Rng(w.rng); }

export function shortName(name: string): string {
  const eq = name.indexOf('=');
  if (eq >= 0) return name.slice(eq + 1);
  const t = name.split(' ');
  if (t.length === 1) return name;
  const rest = t.slice(1).join(' ');
  return rest.length > 15 ? t[t.length - 1] : rest;
}

export function randomPers(rng: Rng, egoBase = 55): Personality {
  const r = (m: number, s = 18) => clamp(Math.round(m + rng.normal() * s), 1, 99);
  return { ego: r(egoBase), temper: r(50, 22), loyal: r(55), amb: r(62), prof: r(65), social: r(55, 20) };
}

export function genName(rng: Rng, nat: string): string {
  const pool = NAME_POOLS[NATIONS[nat]?.pool ?? 'en'] ?? NAME_POOLS.en;
  return `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
}

/** Market value in EUR. Exponential in ability, shaped by age, potential and contract. */
export function marketValue(p: Player, season: number): number {
  const o = ovr(p);
  const ag = season - p.born;
  let v = 1_000_000 * Math.pow(1.15, o - 60);
  let m = 1;
  if (ag <= 21) m = 1.25 + Math.max(0, p.pot - o) * 0.045;
  else if (ag <= 25) m = 1.15 + Math.max(0, p.pot - o) * 0.02;
  else if (ag <= 28) m = 1;
  else m = Math.max(0.08, 1 - (ag - 28) * 0.16);
  v *= m;
  if (p.pos === 'GK') v *= 0.7;
  if (p.con && p.con.until <= season) v *= 0.6;
  v *= 0.85 + p.rep / 400;
  return Math.max(25_000, Math.round(v / 10_000) * 10_000);
}
/** Weekly wage in EUR for a given ability at a club of a given reputation. */
export function wageFor(o: number, clubRep: number): number {
  const base = 2000 * Math.pow(1.13, o - 55);
  const mult = 0.45 + Math.pow(clubRep / 100, 2) * 0.8;
  return Math.max(400, Math.round((base * mult) / 100) * 100);
}
export function roleFor(rank: number): SquadRole {
  return rank <= 2 ? 'star' : rank <= 11 ? 'key' : rank <= 18 ? 'rotation' : 'prospect';
}

export function assignAbilities(a: number[], o: number, pos: Pos, rng: Rng, egoHint: number): AbilityRef[] {
  if (pos === 'GK' || o < 79) return [];
  const out: AbilityRef[] = [];
  const lv = o >= 90 ? 4 : o >= 87 ? 3 : o >= 83 ? 2 : 1;
  const sug = suggestWeapons(a, 4);
  const first = sug[rng.int(Math.min(2, sug.length))];
  out.push({ id: first.id, lv, xp: XP_LEVELS[lv - 1] });
  if (o >= 86) {
    const second = sug.find((w) => w.id !== first.id);
    if (second) out.push({ id: second.id, lv: Math.max(1, lv - 1), xp: XP_LEVELS[Math.max(0, lv - 2)] });
  }
  if (o >= 84) { const p = rng.pick(PASSIVES); out.push({ id: p.id, lv: Math.max(1, lv - 1), xp: XP_LEVELS[Math.max(0, lv - 2)] }); }
  if (o >= 90 || (o >= 88 && egoHint > 80)) {
    const tags = first.tags;
    const ults = ULTIMATES.filter((u) => u.tags.some((t) => tags.includes(t)));
    const u = ults.length ? rng.pick(ults) : rng.pick(ULTIMATES);
    out.push({ id: u.id, lv: Math.max(1, lv - 1), xp: XP_LEVELS[Math.max(0, lv - 2)] });
  }
  return out;
}

export interface PlayerSpec {
  name: string; sn?: string; nat: string; pos: Pos; pos2?: Pos[]; age: number; ovr: number; pot: number;
  origin: Origin; style?: string; ab?: AbilityRef[]; ego?: number; canon?: Canon; hair?: string; foot?: 'L' | 'R' | 'B';
}

export function newPlayer(w: World, rng: Rng, s: PlayerSpec): Player {
  const styles = stylesFor(s.pos);
  const style = s.style && styles.includes(s.style) ? s.style : rng.chance(0.35) ? 'balanced' : rng.pick(styles);
  const target = clamp(Math.round(s.ovr), 1, 99);
  const a = makeAttrs(s.pos, target, style, rng);
  const line = POS_LINE[s.pos];
  const tall = s.pos === 'GK' || s.pos === 'CB' ? 188 : s.pos === 'ST' ? 183 : 178;
  const h = clamp(Math.round(tall + rng.normal() * 5.5), 160, 204);
  const foot = s.foot ?? (s.pos === 'LB' || s.pos === 'LW' || s.pos === 'LM' ? (rng.chance(0.7) ? 'L' : 'R') : rng.chance(0.2) ? 'L' : rng.chance(0.04) ? 'B' : 'R');
  const pers = randomPers(rng, s.ego ?? (line === 3 ? 62 : 52));
  if (s.ego != null) pers.ego = s.ego;
  const o = Math.round(target);
  const p: Player = {
    id: 'p' + w.nextId++, name: s.name.split('=')[0], sn: s.sn ?? shortName(s.name), nat: s.nat, born: w.season - s.age,
    pos: s.pos, pos2: s.pos2 ?? [], foot, h, w: clamp(Math.round((h - 100) * 0.9 + rng.normal() * 4 + (a[A.STR] - 65) * 0.12), 55, 102), num: 0,
    a, pot: clamp(Math.max(s.pot, o), 1, 99), club: null, con: null,
    rep: clamp(Math.round((o - 52) * 2.25 + (s.origin === 'real' ? 4 : 0)), 1, 99), pers, style,
    ab: s.ab ?? assignAbilities(a, o, s.pos, rng, pers.ego), origin: s.origin, canon: s.canon, hair: s.hair || undefined,
    fit: 100, sharp: 70, form: 6.6, morale: 70, inj: 0, susp: 0, yel: 0, dev: 0, ss: {}, hist: [], awards: [], caps: 0, ig: 0,
  };
  if (o >= 84 || s.origin === 'bluelock' || s.origin === 'master' || s.origin === 'world') p.notable = true;
  w.players[p.id] = p;
  return p;
}

export function genPlayer(w: World, rng: Rng, o: { nat: string; pos: Pos; ovr: number; age?: number; pot?: number; origin?: Origin }): Player {
  const ageV = o.age ?? clamp(Math.round(25.5 + rng.normal() * 4.2), 17, 36);
  let pot = o.pot;
  if (pot == null) {
    if (ageV <= 21) pot = o.ovr + rng.range(4, 14);
    else if (ageV <= 25) pot = o.ovr + rng.range(1, 6);
    else pot = o.ovr + rng.range(0, 1);
  }
  return newPlayer(w, rng, { name: genName(rng, o.nat), nat: o.nat, pos: o.pos, age: ageV, ovr: o.ovr, pot: Math.min(99, pot), origin: o.origin ?? 'fict' });
}

export function parseAb(list: string[]): AbilityRef[] {
  const out: AbilityRef[] = [];
  for (const s of list) {
    const [id, lvS] = s.split(':');
    if (!abilityDef(id)) continue;
    const lv = clamp(+(lvS ?? 1) || 1, 1, 5);
    out.push({ id, lv, xp: XP_LEVELS[lv - 1] });
  }
  return out;
}

function fromRow(w: World, rng: Rng, r: NelRow, origin: Origin): Player {
  const p = newPlayer(w, rng, { name: r.name, sn: r.sn, nat: r.nat, pos: r.pos as Pos, pos2: r.pos2 as Pos[], age: r.age, ovr: r.ovr, pot: r.pot, origin, style: r.style, ab: parseAb(r.ab), ego: r.ego, canon: r.canon as Canon, hair: r.hair });
  p.notable = true;
  return p;
}

export function makeManager(w: World, rng: Rng, nat: string, rep: number, style: string): Manager {
  return { id: 'm' + w.nextId++, name: `${rng.pick(COACH_FIRST)} ${rng.pick(COACH_LAST)}`, nat, style, rep: clamp(Math.round(rep + rng.normal() * 6), 20, 99), since: w.season };
}

export function signContract(w: World, p: Player, c: Club, role?: SquadRole, years?: number, wage?: number): void {
  const o = ovr(p);
  const con: Contract = { club: c.id, wage: wage ?? wageFor(o, c.rep), from: w.season, until: w.season + (years ?? 1 + (hashStr(p.id) % 4)), role: role ?? 'rotation' };
  p.con = con;
}

export function addToClub(w: World, p: Player, c: Club): void {
  if (p.club && w.clubs[p.club]) { const old = w.clubs[p.club]; old.squad = old.squad.filter((x) => x !== p.id); }
  const fi = w.free.indexOf(p.id);
  if (fi >= 0) w.free.splice(fi, 1);
  p.club = c.id;
  if (!c.squad.includes(p.id)) c.squad.push(p.id);
  p.joined = w.season;
}

export function assignNumbers(w: World, c: Club, keep?: string): void {
  const used = new Set<number>();
  if (keep && w.players[keep]?.num) used.add(w.players[keep].num);
  const pref: Record<string, number[]> = { GK: [1, 13, 31], CB: [4, 5, 6, 15], LB: [3, 12], RB: [2, 22], DM: [6, 16, 14], CM: [8, 18, 23], AM: [10, 20], LM: [11, 17], RM: [7, 21], LW: [11, 17, 19], RW: [7, 21, 24], SS: [10, 9, 19], ST: [9, 19, 29] };
  const list = c.squad.map((id) => w.players[id]).filter(Boolean).sort((x, y) => ovr(y) - ovr(x));
  for (const p of list) {
    if (p.id === keep && p.num) continue;
    let n = (pref[p.pos] ?? []).find((x) => !used.has(x));
    if (!n) { n = 25; while (used.has(n)) n++; }
    p.num = n; used.add(n);
  }
}

const SQUAD_SHAPE: [Pos, number][] = [['GK', 3], ['CB', 4], ['LB', 2], ['RB', 2], ['DM', 2], ['CM', 3], ['AM', 1], ['LW', 2], ['RW', 2], ['ST', 3]];
const FOREIGN: Record<string, string[]> = {
  ENG: ['IRL', 'SCO', 'WAL', 'FRA', 'NED', 'BRA', 'NGA', 'POR', 'ESP', 'GER', 'DEN', 'JAM', 'USA', 'GHA', 'SEN', 'JPN', 'ARG', 'BEL', 'NOR', 'SWE'],
  ESP: ['ARG', 'BRA', 'FRA', 'POR', 'URU', 'COL', 'MAR', 'NED', 'SEN', 'CRO', 'MEX', 'JPN'],
  GER: ['AUT', 'SUI', 'FRA', 'NED', 'DEN', 'POL', 'CRO', 'TUR', 'JPN', 'USA', 'KOR', 'BEL', 'CZE', 'GHA'],
  ITA: ['ARG', 'FRA', 'BRA', 'SRB', 'CRO', 'NED', 'POL', 'NGA', 'SEN', 'DEN', 'SWE', 'ESP', 'ALB', 'SVN'],
  FRA: ['SEN', 'CIV', 'MLI', 'ALG', 'MAR', 'CMR', 'BRA', 'POR', 'BEL', 'GUI', 'COD', 'TUN', 'JPN', 'GHA'],
};

/** Top the squad up to a workable size with original fictional players. */
export function fillSquad(w: World, rng: Rng, c: Club, level: number, minSize = 24, youthOnly = false): void {
  const have: Record<string, number> = {};
  for (const id of c.squad) { const p = w.players[id]; if (p) have[p.pos] = (have[p.pos] ?? 0) + 1; }
  const wide = (have.LM ?? 0) + (have.RM ?? 0) + (have.SS ?? 0);
  const need: Pos[] = [];
  for (const [pos, n] of SQUAD_SHAPE) {
    let h = have[pos] ?? 0;
    if (pos === 'LW') h += Math.ceil(((have.LM ?? 0) + (have.SS ?? 0) / 2));
    if (pos === 'RW') h += Math.floor((have.RM ?? 0) + (have.SS ?? 0) / 2);
    for (let i = h; i < n; i++) need.push(pos);
  }
  void wide;
  while (c.squad.length + need.length < minSize) need.push(rng.pick(['CB', 'CM', 'ST', 'LW', 'RW', 'DM', 'LB', 'RB'] as Pos[]));
  const foreign = FOREIGN[c.nat] ?? FOREIGN.ENG;
  need.forEach((pos, i) => {
    const depth = (have[pos] ?? 0) + need.slice(0, i).filter((x) => x === pos).length;
    const young = youthOnly || rng.chance(0.22);
    let target = level - depth * 2.6 + rng.normal() * 2.2;
    if (pos === 'GK' && depth >= 1) target -= 3;
    const nat = rng.chance(0.6) ? c.nat : rng.pick(foreign);
    const p = young
      ? genPlayer(w, rng, { nat, pos, ovr: clamp(target - rng.range(5, 10), 40, 99), age: rng.range(17, 20) })
      : genPlayer(w, rng, { nat, pos, ovr: clamp(target, 40, 99) });
    addToClub(w, p, c);
  });
}

function parseReal(w: World, rng: Rng, c: Club): void {
  const src = REAL[c.id];
  if (!src) return;
  for (const e of src.split(';')) {
    const [name, pos, ageS, ovrS, potS, nat] = e.split(',');
    if (!name || !NATIONS[nat]) continue;
    const p = newPlayer(w, rng, { name, nat, pos: pos as Pos, age: +ageS, ovr: +ovrS, pot: +potS, origin: 'real' });
    addToClub(w, p, c);
  }
}

function makeClub(w: World, rng: Rng, row: string, id: string, nat: string, league: string | null, tier: number): Club {
  const [, name, sn, abbr, repS, c1, c2, style] = row.split('|');
  const rep = +repS;
  const st = STYLES_TAC[style] ?? STYLES_TAC.balanced;
  const c: Club = {
    id, name, sn, abbr, nat, league, tier, rep, col: [c1, c2],
    budget: Math.round((Math.pow(rep / 100, 6) * 250_000_000) / 100_000) * 100_000,
    tac: { form: rng.pick(st.form), press: st.press, line: st.line, tempo: st.tempo, width: st.width, direct: st.direct }, style,
    mgr: makeManager(w, rng, nat, rep, style), fac: clamp(Math.round(rep / 10 - 0.5 + rng.normal() * 0.7), 1, 10), youth: clamp(Math.round(rep / 11 + rng.normal() * 1.2), 1, 10),
    squad: [], hist: [], trophies: [], rec: {}, goalsAll: {}, expect: 0,
  };
  w.clubs[id] = c;
  return c;
}

export function finalizeSquad(w: World, c: Club): void {
  const list = c.squad.map((id) => w.players[id]).filter(Boolean).sort((x, y) => ovr(y) - ovr(x));
  list.forEach((p, i) => {
    if (!p.con || p.con.club !== c.id) signContract(w, p, c, w.season - p.born <= 20 && i > 13 ? 'prospect' : roleFor(i));
    else p.con.role = w.season - p.born <= 20 && i > 13 ? 'prospect' : roleFor(i);
  });
  assignNumbers(w, c);
}

/** Squad strength used for expectations: mean OVR of the best eleven-ish. */
export function clubStrength(w: World, c: Club): number {
  const o = c.squad.map((id) => w.players[id]).filter(Boolean).map(ovr).sort((a, b) => b - a).slice(0, 14);
  return o.length ? o.reduce((s, v) => s + v, 0) / o.length : 50;
}

export function createWorld(seed: number): World {
  const w: World = {
    seed, rng: seedState(seed), nextId: 1, newsId: 1, trId: 1, phase: 'nel', season: BASELINE_SEASON, day: 0, stage: 0, abs: 0,
    players: {}, clubs: {}, comps: {}, fixtures: {}, sched: {}, nations: {}, transfers: [], awards: {}, awardIds: [], news: [], log: [], done: {},
    nel: { teams: NEL_TEAMS.map((t) => t.id), round: 0, bids: {} },
    acc: { w: {}, m: {}, goals: {} }, rec: {}, archive: [], free: [], pool: {},
    baseline: '2025/26 baseline — squads approximated from memory, not live or verified data. All results are fictional.', events: [],
  };
  const rng = rngOf(w);
  for (const n of Object.values(NATIONS)) w.nations[n.id] = { id: n.id, pts: n.str, coach: `${rng.pick(COACH_FIRST)} ${rng.pick(COACH_LAST)}` };

  for (const L of LEAGUES) {
    for (const row of L.rows.trim().split('\n')) {
      const short = row.split('|')[0];
      const c = makeClub(w, rng, row, `${L.id}_${short}`, L.nat, L.id, L.tier);
      parseReal(w, rng, c);
      fillSquad(w, rng, c, 38 + c.rep * 0.5);
    }
  }
  for (const nat in POOLS) {
    w.pool[nat] = [];
    for (const row of POOLS[nat].rows.trim().split('\n')) {
      const c = makeClub(w, rng, row, `${nat.toLowerCase()}p_${row.split('|')[0]}`, nat, null, nat === 'ENG' ? 4 : 2);
      c.dormant = true;
      w.pool[nat].push(c.id);
    }
  }
  for (const x of WORLD_EXTRA) {
    const c = w.clubs[x.club];
    if (!c) continue;
    addToClub(w, fromRow(w, rng, x.row, x.row.bl ? 'bluelock' : 'world'), c);
  }
  // NEL teams
  for (const t of NEL_TEAMS) {
    const parent = w.clubs[t.parent];
    const st = STYLES_TAC[t.style];
    const c: Club = {
      id: t.id, name: t.name, sn: t.name, abbr: t.abbr, nat: t.nat, league: 'nel', tier: 0, rep: parent.rep, col: parent.col, budget: 0,
      tac: { form: st.form[0], press: st.press, line: st.line, tempo: st.tempo, width: st.width, direct: st.direct }, style: t.style,
      mgr: { id: 'm' + w.nextId++, name: NEL_MASTERS[t.id].name, nat: NEL_MASTERS[t.id].nat, style: t.style, rep: 95, since: w.season },
      fac: 10, youth: 10, squad: [], nel: true, parent: t.parent, identity: t.identity, hist: [], trophies: [], rec: {}, goalsAll: {}, expect: 3,
    };
    w.clubs[t.id] = c;
    const master = fromRow(w, rng, NEL_MASTERS[t.id], 'master');
    addToClub(w, master, parent);
    c.master = master.id;
    for (const r of NEL_BLUELOCK[t.id] ?? []) { const p = fromRow(w, rng, r, 'bluelock'); addToClub(w, p, c); p.nelTeam = t.id; }
    for (const r of NEL_YOUTH[t.id] ?? []) { const p = fromRow(w, rng, r, 'nelyouth'); addToClub(w, p, c); p.nelTeam = t.id; }
    // top up to a 20-player youth squad with clearly labelled original players
    const before = new Set(c.squad);
    fillNel(w, rng, c);
    for (const id of c.squad) if (!before.has(id)) { const p = w.players[id]; p.origin = 'nelyouth'; p.canon = 'original'; p.nelTeam = t.id; }
    for (const id of c.squad) { const p = w.players[id]; p.con = null; p.rep = clamp(Math.round((ovr(p) - 62) * 1.6 + (p.origin === 'bluelock' ? 6 : 0)), 3, 70); }
    assignNumbers(w, c);
  }
  for (const c of Object.values(w.clubs)) if (!c.nel && !c.dormant) finalizeSquad(w, c);
  return w;
}

function fillNel(w: World, rng: Rng, c: Club): void {
  const have: Record<string, number> = {};
  for (const id of c.squad) have[w.players[id].pos] = (have[w.players[id].pos] ?? 0) + 1;
  const need: Pos[] = [];
  if ((have.GK ?? 0) < 2) need.push('GK');
  const want: [Pos, number][] = [['CB', 3], ['LB', 1], ['RB', 1], ['DM', 1], ['CM', 2], ['LW', 1], ['RW', 1], ['ST', 2]];
  for (const [pos, n] of want) for (let i = have[pos] ?? 0; i < n; i++) need.push(pos);
  while (c.squad.length + need.length < 20) need.push(rng.pick(['CB', 'CM', 'LB', 'RB', 'DM'] as Pos[]));
  for (const pos of need) {
    const p = genPlayer(w, rng, { nat: c.nat, pos, ovr: 70 + rng.range(0, 6), age: rng.range(17, 19), pot: 80 + rng.range(0, 6), origin: 'nelyouth' });
    addToClub(w, p, c);
  }
}

/** Create squads for a dormant lower-division club the first time it enters the simulated pyramid. */
export function activatePoolClub(w: World, c: Club): void {
  const rng = rngOf(w);
  if (c.squad.length < 18) fillSquad(w, rng, c, 38 + c.rep * 0.5);
  c.dormant = false;
  finalizeSquad(w, c);
}

export function attrsFor(pos: Pos, target: number, style: string, seed: number): number[] {
  return makeAttrs(pos, target, style, Rng.seeded(seed));
}
export { N_ATTR };
