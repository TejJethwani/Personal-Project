/**
 * Competitions: calendar slots, fixture generation (round robin, groups, knockouts),
 * tables computed directly from results, and stage progression.
 * League tables are never stored — they are always derived from played fixtures.
 */
import type { Competition, Fixture, Game, Stage, World } from './types';
import { Rng } from './rng';
import { rngOf } from './worldgen';
import { teamName, winnerId } from './match/setup';

// ───────────────────────────── calendar ─────────────────────────────
export const MID = 2, END = 5;
export const BREAK_WEEKS = [6, 11, 15, 33];
export const dayOf = (week: number, dow: number) => (week - 1) * 7 + dow;
export const weekOf = (day: number) => Math.floor(day / 7) + 1;
export const SEASON_DAYS = 364;
export const SEASON_END_DAY = dayOf(45, 0); // season awards / wrap-up
/** The summer tournament opens two weeks after the season ends, leaving room for the Team of the Season Cup. */
export const SUMMER_TOURNAMENT_DAY = dayOf(48, 1);
const END_WEEKS = Array.from({ length: 41 }, (_, i) => i + 2).filter((w) => !BREAK_WEEKS.includes(w)); // 37 weekends
export const LEAGUE_SLOTS: Record<number, number[]> = {
  38: [...END_WEEKS.map((w) => dayOf(w, END)), dayOf(20, MID)].sort((a, b) => a - b),
  34: END_WEEKS.filter((w) => w <= 41 && w !== 21 && w !== 22).map((w) => dayOf(w, END)),
  46: [...END_WEEKS.map((w) => dayOf(w, END)), ...[3, 4, 10, 17, 19, 21, 22, 25, 26].map((w) => dayOf(w, MID))].sort((a, b) => a - b),
};
export const CUP_DAYS = [8, 13, 18, 23, 27, 31, 36].map((w) => dayOf(w, MID));
export const CUP_FINAL_DAY = dayOf(43, END);
export const CONT_GROUP_DAYS = [5, 7, 9, 12, 14, 16, 22, 25].map((w) => dayOf(w, MID));
/** play-off (2 legs), round of 16, quarter-finals, semi-finals */
export const CONT_KO_DAYS = [28, 30, 32, 34, 35, 37, 39, 41].map((w) => dayOf(w, MID));
export const CONT_FINAL_DAY = dayOf(44, END);
export const PLAYOFF_DAYS = [dayOf(43, MID), dayOf(44, END)];
export const WINDOWS = { summerEnd: dayOf(5, 0), winterStart: dayOf(22, 0), winterEnd: dayOf(26, 0), summerStart: dayOf(45, 0) };
export function windowOpen(w: World): boolean {
  if (w.phase === 'nel') return w.day >= 35;
  return w.day < WINDOWS.summerEnd || (w.day >= WINDOWS.winterStart && w.day < WINDOWS.winterEnd) || w.day >= WINDOWS.summerStart;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function baseDate(phase: 'nel' | 'pro', season: number): Date {
  if (phase === 'nel') return new Date(Date.UTC(season, 4, 5)); // Monday 5 May of the baseline year
  const d = new Date(Date.UTC(season, 7, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
export function dateOf(phase: 'nel' | 'pro', season: number, day: number): Date {
  const d = baseDate(phase, season);
  d.setUTCDate(d.getUTCDate() + day);
  return d;
}
export function fmtDate(w: { phase: 'nel' | 'pro'; season: number }, day: number, long = false): string {
  const d = dateOf(w.phase, w.season, day);
  const s = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return long ? `${DOW[(d.getUTCDay() + 6) % 7]} ${s} ${d.getUTCFullYear()}` : s;
}
export function monthOf(w: World, day: number): number { return dateOf(w.phase, w.season, day).getUTCMonth(); }
export function monthName(m: number): string { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m]; }
export function seasonLabel(s: number): string { return `${s}/${String((s + 1) % 100).padStart(2, '0')}`; }

// ───────────────────────────── fixtures ─────────────────────────────
export function addFixture(w: World, f: Omit<Fixture, 'id' | 'played' | 's'>): Fixture {
  const fx: Fixture = { ...f, id: `f${w.nextId++}`, s: w.season, played: false };
  w.fixtures[fx.id] = fx;
  (w.sched[fx.day] ??= []).push(fx.id);
  cache.delete(w);
  return fx;
}

/**
 * Circle-method round robin. Returns rounds of [home, away] pairs; odd team counts give one team a rest each round.
 * Home and away alternate: in every pairing, home goes to the side that was away last time (then to the side with
 * fewer home games), so nobody plays long runs at home or on the road. The second half mirrors the first.
 */
export function roundRobin(teams: string[], double: boolean, rng: Rng): [string, string][][] {
  const list = rng.shuffle([...teams]);
  if (list.length % 2) list.push('');
  const n = list.length;
  const pairs: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const rd: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) { const a = list[i], b = list[n - 1 - i]; if (a && b) rd.push([a, b]); }
    pairs.push(rd);
    list.splice(1, 0, list.pop()!);
  }
  const homes: Record<string, number> = {}, last: Record<string, number> = {}, run: Record<string, number> = {};
  const want = (t: string) => (last[t] === -1 ? 2 + (run[t] ?? 0) : last[t] === 1 ? -2 - (run[t] ?? 0) : 0) - (homes[t] ?? 0) * 0.1;
  const rounds = pairs.map((rd) => rd.map(([a, b]) => {
    const [h, aw] = want(a) >= want(b) ? [a, b] : [b, a];
    for (const [t, v] of [[h, 1], [aw, -1]] as const) { run[t] = last[t] === v ? (run[t] ?? 0) + 1 : 1; last[t] = v; if (v === 1) homes[t] = (homes[t] ?? 0) + 1; }
    return [h, aw] as [string, string];
  }));
  if (double) return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [string, string]))];
  return rounds;
}

const cache = new WeakMap<World, { n: number; byComp: Map<string, Fixture[]> }>();
export function compFixtures(w: World, comp: string): Fixture[] {
  let c = cache.get(w);
  const n = Object.keys(w.fixtures).length;
  if (!c || c.n !== n) {
    c = { n, byComp: new Map() };
    for (const id in w.fixtures) { const f = w.fixtures[id]; let l = c.byComp.get(f.comp); if (!l) c.byComp.set(f.comp, (l = [])); l.push(f); }
    for (const l of c.byComp.values()) l.sort((a, b) => a.day - b.day || a.rd - b.rd);
    cache.set(w, c);
  }
  return c.byComp.get(comp) ?? [];
}
export function invalidateFixtures(w: World): void { cache.delete(w); }

export interface Row { id: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number; form: string[] }
/** League / group table, derived purely from played fixtures. */
export function tableOf(w: World, compId: string, grp?: number, teams?: string[]): Row[] {
  const comp = w.comps[compId];
  const rows = new Map<string, Row>();
  const list = teams ?? (grp != null && comp?.stages[0]?.groups ? comp.stages[0].groups[grp] : comp?.teams ?? []);
  for (const id of list) rows.set(id, { id, name: teamName(w, id), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  for (const f of compFixtures(w, compId)) {
    if (!f.played || !f.sc) continue;
    if (grp != null ? f.grp !== grp : f.grp == null && comp?.stages.length > 1 && comp.kind !== 'league') continue;
    const h = rows.get(f.h), a = rows.get(f.a);
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += f.sc[0]; h.ga += f.sc[1]; a.gf += f.sc[1]; a.ga += f.sc[0];
    if (f.sc[0] > f.sc[1]) { h.w++; a.l++; h.pts += 3; h.form.push('W'); a.form.push('L'); }
    else if (f.sc[0] < f.sc[1]) { a.w++; h.l++; a.pts += 3; a.form.push('W'); h.form.push('L'); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D'); }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name));
}
export function positionOf(w: World, compId: string, team: string): number {
  return tableOf(w, compId).findIndex((r) => r.id === team) + 1;
}

// ───────────────────────────── competition builders ─────────────────────────────
export function mkComp(w: World, o: Partial<Competition> & { id: string; name: string; sn: string; kind: Competition['kind'] }): Competition {
  const prev = w.comps[o.id];
  const c: Competition = {
    rules: 'reg', teams: [], season: w.season, stages: [], cur: 0, rounds: 0, hist: prev?.hist ?? [], rec: prev?.rec ?? {}, ...o,
    done: false, champion: undefined,
  } as Competition;
  w.comps[c.id] = c;
  return c;
}

export function scheduleLeague(w: World, c: Competition, days: number[], double = true): void {
  const rounds = roundRobin(c.teams, double, rngOf(w));
  c.rounds = rounds.length;
  c.stages = [{ type: 'rr', name: 'League', legs: double ? 2 : 1, round: 1, slots: days, groups: [c.teams.slice()] }];
  c.cur = 0;
  rounds.forEach((rd, i) => { for (const [h, a] of rd) addFixture(w, { comp: c.id, rd: i + 1, day: days[Math.min(i, days.length - 1)], h, a, neutral: c.kind === 'nel' || undefined }); });
}

export function scheduleGroups(w: World, c: Competition, groups: string[][], legs: number, days: number[], neutral: boolean, advance: number): void {
  const rng = rngOf(w);
  let maxR = 0;
  groups.forEach((g, gi) => {
    const rounds = roundRobin(g, legs === 2, rng);
    maxR = Math.max(maxR, rounds.length);
    rounds.forEach((rd, i) => { for (const [h, a] of rd) addFixture(w, { comp: c.id, rd: i + 1, stg: 'Group', grp: gi, day: days[Math.min(i, days.length - 1)], h, a, neutral }); });
  });
  c.stages = [{ type: 'rr', name: 'Group', legs, groups, round: 1, slots: days, advance, neutral }];
  c.cur = 0; c.rounds = maxR;
}

/**
 * Modern continental league phase: one table, every club plays `k` different opponents
 * (half at home, half away) instead of a full round robin.
 */
export function scheduleLeaguePhase(w: World, c: Competition, teams: string[], k: number, days: number[]): void {
  const rng = rngOf(w);
  const met = new Set<string>();
  const home: Record<string, number> = {};
  for (const t of teams) home[t] = 0;
  for (let r = 0; r < k; r++) {
    let pairs: [string, string][] = [];
    for (let attempt = 0; attempt < 200; attempt++) {
      const order = rng.shuffle([...teams]);
      pairs = [];
      const used = new Set<string>();
      let ok = true;
      for (const a of order) {
        if (used.has(a)) continue;
        const b = order.find((x) => x !== a && !used.has(x) && !met.has(a < x ? a + x : x + a));
        if (!b) { ok = false; break; }
        used.add(a); used.add(b);
        pairs.push(home[a] <= home[b] ? [a, b] : [b, a]);
      }
      if (ok) break;
    }
    for (const [h, a] of pairs) { met.add(h < a ? h + a : a + h); home[h]++; addFixture(w, { comp: c.id, rd: r + 1, stg: 'Group', grp: 0, day: days[Math.min(r, days.length - 1)], h, a }); }
  }
  c.stages = [{ type: 'rr', name: 'League phase', legs: 1, groups: [teams.slice()], round: 1, slots: days, advance: 24 }];
  c.cur = 0; c.rounds = k;
}

const KO_NAMES: Record<number, string> = { 1: 'Final', 2: 'Semi-final', 4: 'Quarter-final', 8: 'Round of 16', 16: 'Round of 32', 32: 'Round of 64' };
/** Add a knockout round. `pairs` are [home, away]; two-legged ties reverse for the second leg. */
export function scheduleKo(w: World, c: Competition, pairs: [string, string][], legs: number, days: number[], neutral: boolean, name?: string): void {
  const nm = name ?? KO_NAMES[pairs.length] ?? `Round (${pairs.length * 2})`;
  const rd = c.rounds + 1;
  const st: Stage = { type: 'ko', name: nm, legs, round: rd, slots: days, ties: [], neutral };
  pairs.forEach(([a, b], i) => {
    const tie = `${c.id}:${w.season}:${nm}:${i}`;
    st.ties!.push({ id: tie, a, b });
    if (legs === 2) {
      addFixture(w, { comp: c.id, rd, stg: nm, leg: 1, tie, day: days[0], h: b, a });
      addFixture(w, { comp: c.id, rd: rd + 1, stg: nm, leg: 2, tie, day: days[1], h: a, a: b, ko: true });
    } else addFixture(w, { comp: c.id, rd, stg: nm, tie, day: days[0], h: a, a: b, ko: true, neutral });
  });
  c.stages.push(st);
  c.cur = c.stages.length - 1;
  c.rounds = rd + legs - 1;
}

/** Knockout cup: a preliminary round trims the field to a power of two, strongest clubs get byes. */
export function startCup(w: World, c: Competition, days: number[], finalDay: number): void {
  const teams = [...c.teams].sort((a, b) => (w.clubs[b]?.rep ?? 0) - (w.clubs[a]?.rep ?? 0));
  let size = 1;
  while (size * 2 <= teams.length) size *= 2;
  const extra = teams.length - size;
  c.stages = []; c.rounds = 0; c.cur = 0;
  const totalRounds = Math.log2(size) + (extra > 0 ? 1 : 0);
  const useDays = [...days.slice(0, totalRounds - 1), finalDay];
  (c as Competition & { days?: number[] }).days = useDays;
  const rng = rngOf(w);
  if (extra > 0) {
    const low = rng.shuffle(teams.slice(teams.length - extra * 2));
    const pairs: [string, string][] = [];
    for (let i = 0; i < low.length; i += 2) pairs.push([low[i], low[i + 1]]);
    (c as Competition & { byes?: string[] }).byes = teams.slice(0, teams.length - extra * 2);
    scheduleKo(w, c, pairs, 1, [useDays[0]], false, 'Preliminary round');
  } else {
    (c as Competition & { byes?: string[] }).byes = [];
    drawKo(w, c, teams);
  }
}
function drawKo(w: World, c: Competition, teams: string[]): void {
  const cc = c as Competition & { days?: number[] };
  const rng = rngOf(w);
  const t = rng.shuffle([...teams]);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < t.length; i += 2) pairs.push([t[i], t[i + 1]]);
  const idx = c.stages.length;
  const day = cc.days?.[Math.min(idx, (cc.days?.length ?? 1) - 1)] ?? CUP_FINAL_DAY;
  scheduleKo(w, c, pairs, 1, [Math.max(day, w.day + 2)], pairs.length === 1);
}

export function tieWinner(w: World, compId: string, tie: string): string | null {
  const fs = compFixtures(w, compId).filter((f) => f.tie === tie);
  if (!fs.length || fs.some((f) => !f.played)) return null;
  if (fs.length === 1) return winnerId(fs[0]);
  const l2 = fs.find((f) => f.leg === 2)!, l1 = fs.find((f) => f.leg === 1)!;
  if (l2.pens) return l2.pens[0] > l2.pens[1] ? l2.h : l2.a;
  const hAgg = l2.sc![0] + l1.sc![1], aAgg = l2.sc![1] + l1.sc![0];
  return hAgg > aAgg ? l2.h : aAgg > hAgg ? l2.a : l2.h;
}

/**
 * Called after fixtures are played. If the current stage of a competition is complete,
 * build the next stage (or crown the champion). Returns competitions that just finished.
 */
export function progressComps(g: Game): Competition[] {
  const w = g.world;
  const finished: Competition[] = [];
  for (const id in w.comps) {
    const c = w.comps[id];
    if (c.done || c.season !== w.season || !c.stages.length) continue;
    const st = c.stages[c.cur];
    if (st.done) continue;
    const fs = compFixtures(w, id).filter((f) => (st.type === 'rr' ? f.stg === (c.kind === 'league' || c.kind === 'nel' ? undefined : 'Group') : f.stg === st.name));
    if (!fs.length || fs.some((f) => !f.played)) continue;
    st.done = true;
    const cc = c as Competition & { days?: number[]; byes?: string[] };
    if (st.type === 'rr') {
      if (c.kind === 'league' || c.kind === 'nel') { c.done = true; c.champion = tableOf(w, id)[0]?.id; finished.push(c); continue; }
      if (st.name === 'League phase') {
        // top 8 go straight to the round of 16; 9th–24th meet in a two-legged knockout play-off
        const tab = tableOf(w, id, 0);
        const n = Math.min(24, tab.length - (tab.length % 2));
        const direct = Math.min(8, Math.floor(n / 3));
        cc.byes = tab.slice(0, direct).map((r) => r.id);
        const po = tab.slice(direct, n).map((r) => r.id);
        const pp: [string, string][] = [];
        for (let i = 0; i < po.length / 2; i++) pp.push([po[i], po[po.length - 1 - i]]);
        const days = cc.days ?? [];
        scheduleKo(w, c, pp, 2, [days[0], days[1]], false, 'Knockout play-off');
        cc.days = days.slice(2);
        continue;
      }
      // groups → knockouts
      const adv = st.advance ?? 2;
      const tabs = st.groups!.map((_, gi) => tableOf(w, id, gi));
      const pairs: [string, string][] = [];
      const G = tabs.length;
      if (adv === 2) for (let i = 0; i < G; i++) pairs.push([tabs[i][0].id, tabs[(i + 1) % G][1].id]);
      else for (let i = 0; i + 1 < G; i += 2) pairs.push([tabs[i][0].id, tabs[i + 1][0].id]);
      const legs = c.kind === 'continental' ? 2 : 1;
      const days = cc.days ?? [];
      scheduleKo(w, c, pairs, legs, legs === 2 ? [days[0], days[1]] : [days[0]], c.kind !== 'continental');
      cc.days = days.slice(legs);
    } else {
      const winners = st.ties!.map((t) => (t.winner = tieWinner(w, id, t.id) ?? t.a));
      let pool = [...winners, ...(st.name === 'Preliminary round' ? cc.byes ?? [] : [])];
      if (st.name === 'Knockout play-off') { const b = cc.byes ?? []; pool = []; for (let i = 0; i < b.length; i++) { pool.push(b[i], winners[winners.length - 1 - i] ?? winners[i]); } }
      if (pool.length === 1) { c.done = true; c.champion = pool[0]; finished.push(c); continue; }
      if (c.kind === 'cup') { drawKo(w, c, pool); continue; }
      const pairs: [string, string][] = [];
      for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i], pool[i + 1]]);
      const last = pairs.length === 1;
      const legs = c.kind === 'continental' && !last ? 2 : 1;
      const days = cc.days ?? [];
      const d0 = Math.max(days[0] ?? w.day + 3, w.day + 2), d1 = Math.max(days[1] ?? d0 + 7, d0 + 3);
      scheduleKo(w, c, pairs, legs, legs === 2 ? [d0, d1] : [d0], c.kind !== 'playoff' || last);
      cc.days = days.slice(legs);
    }
  }
  return finished;
}

export function nextFixtureFor(w: World, team: string, fromDay = w.day): Fixture | null {
  let best: Fixture | null = null;
  for (const id in w.fixtures) {
    const f = w.fixtures[id];
    if (f.played || f.s !== w.season || f.day < fromDay || (f.h !== team && f.a !== team)) continue;
    if (!best || f.day < best.day) best = f;
  }
  return best;
}
export function teamFixtures(w: World, team: string): Fixture[] {
  const out: Fixture[] = [];
  for (const id in w.fixtures) { const f = w.fixtures[id]; if (f.h === team || f.a === team) out.push(f); }
  return out.sort((a, b) => a.day - b.day);
}
