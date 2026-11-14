/**
 * International football: squad selection, the U-20 World Cup that follows the NEL,
 * summer tournaments (World Cup every four years, continental championships in between)
 * and friendlies in international breaks.
 * Qualifying campaigns are not simulated: tournament fields are chosen from nation strength.
 */
import type { Competition, Game, Player, Pos } from './types';
import { ovr, POS_LINE } from './attributes';
import { clamp, hashStr } from './rng';
import { rngOf, genPlayer } from './worldgen';
import { NATIONS } from './data/nations';
import { mkComp, scheduleGroups, addFixture, dayOf, END, BREAK_WEEKS, seasonLabel, tableOf, compFixtures } from './competitions';
import { addNews, milestone } from './util';
import { relOf } from './relationships';
import { winnerId } from './match/setup';

const SHAPE: [Pos[], number][] = [[['GK'], 3], [['CB'], 4], [['LB', 'LM'], 2], [['RB', 'RM'], 2], [['DM'], 2], [['CM'], 3], [['AM', 'SS'], 2], [['LW'], 2], [['RW'], 1], [['ST'], 2]];

function byNation(g: Game, maxAge: number): Record<string, Player[]> {
  const w = g.world;
  const map: Record<string, Player[]> = {};
  for (const id in w.players) {
    const p = w.players[id];
    if (p.retired || w.season - p.born > maxAge) continue;
    (map[p.nat] ??= []).push(p);
  }
  return map;
}

/** Pick a 23-man squad. Thin pools are topped up with home-based players from outside the simulated leagues. */
export function selectSquad(g: Game, nat: string, u20: boolean, pool?: Player[], force?: string[]): string[] {
  const w = g.world;
  const rng = rngOf(w);
  const maxAge = u20 ? 20 : 99;
  const cands = (pool ?? byNation(g, maxAge)[nat] ?? []).filter((p) => w.season - p.born <= maxAge && p.inj < 21);
  const score = (p: Player) => ovr(p) + (p.form - 6.6) * 1.2 + p.rep * 0.04 + ((hashStr(p.id + nat + w.season) % 100) / 100 - 0.5) * 2.4;
  const sorted = [...cands].sort((a, b) => score(b) - score(a));
  const chosen: Player[] = [];
  const used = new Set<string>();
  for (const id of force ?? []) { const p = w.players[id]; if (p && !used.has(id)) { chosen.push(p); used.add(id); } }
  const str = NATIONS[nat]?.str ?? 68;
  for (const [poss, n] of SHAPE) {
    let have = chosen.filter((p) => poss.includes(p.pos)).length;
    for (const p of sorted) { if (have >= n) break; if (used.has(p.id) || !poss.includes(p.pos)) continue; chosen.push(p); used.add(p.id); have++; }
    while (have < n) {
      const target = u20 ? clamp(str - 15 + rng.normal() * 2.5, 52, 80) : clamp(str - 6 + rng.normal() * 2.5, 55, 88);
      const p = genPlayer(w, rng, { nat, pos: poss[0], ovr: target, age: u20 ? rng.range(17, 20) : undefined, origin: 'pool' });
      chosen.push(p); used.add(p.id); have++;
    }
  }
  for (const p of sorted) { if (chosen.length >= 23) break; if (!used.has(p.id) && p.pos !== 'GK') { chosen.push(p); used.add(p.id); } }
  const ids = chosen.slice(0, Math.max(23, (force ?? []).length)).map((p) => p.id);
  if (u20) w.nations[nat].u20squad = ids; else w.nations[nat].squad = ids;
  // genuine omissions make news: a clearly better player left out by the coach's preference
  if (!u20) {
    const out = sorted.find((p) => !used.has(p.id) && p.pos !== 'GK' && ovr(p) >= 84);
    const weakest = chosen.filter((p) => p.pos !== 'GK').sort((a, b) => ovr(a) - ovr(b))[0];
    if (out && weakest && ovr(out) >= ovr(weakest) + 3 && POS_LINE[out.pos] === POS_LINE[weakest.pos]) addNews(g, 'intl', `${NATIONS[nat].name}: ${out.name} left out`, `${w.nations[nat].coach} prefers ${weakest.name} (${ovr(weakest)}) to ${out.name} (${ovr(out)}) — a selection that will be debated.`, { imp: 1, pids: [out.id] });
  }
  return ids;
}

function strongest(conf: string | null, n: number, must: string[], rngSeed: number): string[] {
  const list = Object.values(NATIONS).filter((x) => !conf || x.conf === conf).map((x) => ({ id: x.id, s: x.str + ((hashStr(x.id + rngSeed) % 100) / 100) * 5 })).sort((a, b) => b.s - a.s).map((x) => x.id);
  const out = [...new Set([...must.filter((m) => NATIONS[m] && (!conf || NATIONS[m].conf === conf)), ...list])];
  return out.slice(0, n);
}

function drawGroups(g: Game, teams: string[], size = 4): string[][] {
  const rng = rngOf(g.world);
  const sorted = [...teams].sort((a, b) => (NATIONS[b]?.str ?? 0) - (NATIONS[a]?.str ?? 0));
  const G = Math.ceil(teams.length / size);
  const groups: string[][] = Array.from({ length: G }, () => []);
  for (let pot = 0; pot < size; pot++) {
    const slice = rng.shuffle(sorted.slice(pot * G, (pot + 1) * G));
    slice.forEach((t, i) => groups[i].push(t));
  }
  return groups;
}

/** The U-20 World Cup played between the NEL and the first professional season. */
export function setupU20WorldCup(g: Game): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  const teams = strongest(null, 16, ['JPN', me.nat, 'FRA', 'GER', 'ESP', 'ITA', 'ENG', 'BRA', 'ARG'], w.seed);
  const pools = byNation(g, 20);
  const selected = !!g.career.flags.u20;
  for (const t of teams) {
    if (t === 'JPN') {
      const force = [...(w.nel.top23 ?? [])].filter((id) => w.season - w.players[id].born <= 20);
      selectSquad(g, 'JPN', true, pools.JPN, force);
    } else selectSquad(g, t, true, pools[t], t === me.nat && selected ? [me.id] : []);
  }
  if (me.nat === 'JPN' && !selected) w.nations.JPN.u20squad = w.nations.JPN.u20squad!.filter((id) => id !== me.id);
  for (const t of teams) for (const id of w.nations[t].u20squad ?? []) w.players[id].u20 = true;
  const c = mkComp(w, { id: 'u20wc', name: 'U-20 World Cup', sn: 'U20 WC', kind: 'intl', teams, natTeams: true, u20: true, weekly: false });
  (c as Competition & { days?: number[] }).days = [52, 55, 58];
  scheduleGroups(w, c, drawGroups(g, teams), 1, [42, 45, 48], true, 2);
  if (selected) meetSquad(g, w.nations[me.nat].u20squad ?? []);
  addNews(g, 'intl', 'U-20 World Cup squads named', `Sixteen nations. Japan travel with the Blue Lock top ${w.nel.top23?.length ?? 23}.${selected ? ` You are in the ${NATIONS[me.nat].name} squad.` : ''}`, { imp: 2, me: selected });
  if (selected) milestone(g, 'intl', `Named in the ${NATIONS[me.nat].name} squad for the U-20 World Cup.`);
}

export function isCalledUp(g: Game): boolean {
  const me = g.world.players[g.career.pid];
  return !!g.world.nations[me.nat]?.squad?.includes(me.id);
}

function clearEdition(g: Game, id: string): void {
  // the previous edition's scoreboard stays visible until the next one is drawn
  const w = g.world;
  for (const fid of Object.keys(w.fixtures)) if (w.fixtures[fid].comp === id) delete w.fixtures[fid];
  for (const pid in w.players) if (w.players[pid].ss[id]) delete w.players[pid].ss[id];
}
/** Make sure the user has relationship entries with national-team colleagues. */
export function meetSquad(g: Game, squad: string[]): void {
  const me = g.career.pid;
  if (!squad.includes(me)) return;
  for (const id of squad) if (id !== me) { const r = relOf(g, id); r.flags.nat = 1; }
}

interface TDef { id: string; name: string; conf: string | null; n: number; u20?: boolean }
/** Which international tournaments are played in the summer of a given year. */
export function tournamentsFor(year: number): TDef[] {
  const out: TDef[] = [];
  if (year % 4 === 2) out.push({ id: 'wc', name: `World Cup ${year}`, conf: null, n: 32 });
  if (year % 4 === 0) out.push({ id: 'euro', name: `European Championship ${year}`, conf: 'UEFA', n: 16 }, { id: 'copa', name: `Copa América ${year}`, conf: 'CONMEBOL', n: 8 });
  if (year % 4 === 3) out.push({ id: 'asian', name: `Asian Cup ${year}`, conf: 'AFC', n: 8 }, { id: 'afcon', name: `Africa Cup of Nations ${year}`, conf: 'CAF', n: 16 }, { id: 'gold', name: `Gold Cup ${year}`, conf: 'CONCACAF', n: 8 });
  if (year % 2 === 1) out.push({ id: 'u20wc', name: `U-20 World Cup ${year}`, conf: null, n: 16, u20: true });
  else out.push({ id: 'u20asian', name: `U-20 Asian Cup ${year}`, conf: 'AFC', n: 8, u20: true }, { id: 'u21euro', name: `U-21 European Championship ${year}`, conf: 'UEFA', n: 8, u20: true });
  return out;
}

/** Summer tournaments after the club season. Returns true if any were created. */
export function setupSummerTournament(g: Game): boolean {
  const w = g.world;
  const year = w.season + 1;
  const me = w.players[g.career.pid];
  const d0 = dayOf(46, 1);
  const defs = tournamentsFor(year);
  const senior = byNation(g, 99), young = byNation(g, 21);
  const busy = new Set<string>();
  for (const def of defs.filter((d) => !d.u20).concat(defs.filter((d) => d.u20))) {
    let teams: string[];
    if (def.id === 'wc') {
      teams = [];
      for (const [conf, n] of [['UEFA', 13], ['CONMEBOL', 5], ['CAF', 5], ['AFC', 5], ['CONCACAF', 4]] as const) teams.push(...strongest(conf, n, [me.nat], w.seed + year));
      teams = [...new Set(teams)].slice(0, 32);
      for (const extra of strongest(null, 40, [], w.seed + year)) { if (teams.length >= 32) break; if (!teams.includes(extra)) teams.push(extra); }
    } else {
      const must = def.id === 'u20wc' ? ['JPN', me.nat, 'FRA', 'GER', 'ESP', 'ENG', 'BRA', 'ARG'] : [me.nat];
      teams = strongest(def.conf, def.n, must, w.seed + year + (def.u20 ? 7 : 0));
      if (teams.length < 8) continue;
      teams = teams.slice(0, teams.length >= 32 ? 32 : teams.length >= 16 ? 16 : 8);
    }
    clearEdition(g, def.id);
    for (const t of teams) {
      if (def.u20) {
        const pool = (young[t] ?? []).filter((p) => !busy.has(p.id));
        selectSquad(g, t, true, pool);
      } else { for (const id of selectSquad(g, t, false, senior[t])) busy.add(id); }
    }
    const c = mkComp(w, { id: def.id, name: def.name, sn: def.name.replace(/ \d+$/, ''), kind: 'intl', teams, natTeams: true, u20: def.u20 });
    (c as Competition & { days?: number[] }).days = teams.length === 32 ? [d0 + 11, d0 + 15, d0 + 19, d0 + 23] : teams.length === 16 ? [d0 + 11, d0 + 15, d0 + 19] : [d0 + 11, d0 + 15];
    scheduleGroups(w, c, drawGroups(g, teams), 1, [d0, d0 + 3, d0 + 7], true, 2);
    announce(g, c);
  }
  return defs.length > 0;
}

function announce(g: Game, c: Competition): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  const sq = (c.u20 ? w.nations[me.nat]?.u20squad : w.nations[me.nat]?.squad) ?? [];
  const inSquad = c.teams.includes(me.nat) && sq.includes(me.id);
  if (inSquad) meetSquad(g, sq);
  addNews(g, 'intl', `${c.name}: squads announced`, `${c.teams.length} nations.${c.teams.includes(me.nat) ? (inSquad ? ` You are in the ${NATIONS[me.nat].name} squad.` : ` ${NATIONS[me.nat].name} have named their squad without you.`) : ''}`, { imp: 2, me: c.teams.includes(me.nat) });
  if (inSquad) milestone(g, 'intl', `Selected by ${NATIONS[me.nat].name} for the ${c.name}.`);
}

/** A friendly for the user's nation in each international break (only if called up). */
export function scheduleBreakFriendlies(g: Game): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  if (!NATIONS[me.nat]) return;
  const c = mkComp(w, { id: 'intlf', name: 'International Friendlies', sn: 'Friendly', kind: 'friendly', teams: [], natTeams: true });
  c.stages = [];
  void c;
  for (const wk of BREAK_WEEKS) w.events.push({ key: 'intlbreak', day: dayOf(wk, 0) });
}
export function breakFriendly(g: Game): void {
  const w = g.world;
  const me = w.players[g.career.pid];
  const rng = rngOf(w);
  const pools = byNation(g, 99);
  const squad = selectSquad(g, me.nat, false, pools[me.nat]);
  const called = squad.includes(me.id);
  if (called) meetSquad(g, squad);
  if (!called) { if (ovr(me) >= (NATIONS[me.nat].str - 8)) addNews(g, 'intl', `${NATIONS[me.nat].name} squad announced — you miss out`, `${w.nations[me.nat].coach} has not picked you for this international window.`, { imp: 1, me: true }); return; }
  const opps = Object.values(NATIONS).filter((n) => n.id !== me.nat && Math.abs(n.str - NATIONS[me.nat].str) <= 10);
  const opp = rng.pick(opps.length ? opps : Object.values(NATIONS)).id;
  selectSquad(g, opp, false, pools[opp]);
  const home = rng.chance(0.5);
  addFixture(w, { comp: 'intlf', rd: 1, day: w.day + END, h: home ? me.nat : opp, a: home ? opp : me.nat });
  if (!g.career.flags.firstCall) { g.career.flags.firstCall = 1; milestone(g, 'intl', `First senior call-up for ${NATIONS[me.nat].name}.`); }
  addNews(g, 'intl', `Called up by ${NATIONS[me.nat].name}`, `${w.nations[me.nat].coach} names you in the squad to face ${NATIONS[opp].name}.`, { imp: 2, me: true });
  g.career.flags.intlCamp = w.abs;
}

/** Wrap up a finished international tournament: champion, history, ranking points. */
export function finishTournament(g: Game, c: Competition): void {
  const w = g.world;
  const champ = c.champion;
  if (!champ || !NATIONS[champ]) return;
  const fin = compFixtures(w, c.id).filter((f) => f.stg === 'Final')[0];
  const ru = fin ? (winnerId(fin) === fin.h ? fin.a : fin.h) : undefined;
  c.hist.push({ s: w.season, champion: champ, championName: NATIONS[champ].name, runnerUp: ru });
  w.nations[champ].pts = clamp(w.nations[champ].pts + 2, 40, 99);
  const me = w.players[g.career.pid];
  const mine = (c.u20 ? w.nations[champ].u20squad : w.nations[champ].squad)?.includes(me.id);
  addNews(g, 'intl', `${NATIONS[champ].name} win the ${c.name}`, `${ru ? `They beat ${NATIONS[ru].name} in the final${fin?.pens ? ' on penalties' : ''}. ` : ''}`, { imp: 3, me: !!mine });
  for (const id of (c.u20 ? w.nations[champ].u20squad : w.nations[champ].squad) ?? []) { const p = w.players[id]; if (p) p.rep = clamp(p.rep + (c.u20 ? 3 : 6), 0, 99); }
  if (mine) milestone(g, 'trophy', `Won the ${c.name} with ${NATIONS[champ].name}.`);
  void tableOf; void seasonLabel;
}
