import { AI_PERSONALITIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { applyRuleset, divisionForLevel } from '../config/ruleset';
import { generateDriver, generateProspect, raceAgeFor } from '../drivers/generate';
import { Rng } from '../rng';
import { replenishStaffPool } from '../staff/staff';
import type { AIPersonality, EuroAssociationState, EuroClub, EuroLeague, EuropeState, GameState, LiveryPattern, NewCareerConfig } from '../types';
import { createBaseState, createPlayerTeam, generateTeamFromIdentity, type WorldBuild } from '../world/generate';
import { ASSOCIATIONS, ASSOCIATION_BY_ID, leagueWeekends, type AssociationSeed } from './data';
import { levelMeanPower, levelPowerSpread, rollDriverSplit } from './power';
import { buildEuroCalendars, homeCircuits, isEuropeanCircuit, leagueWeeks } from './schedule';

/**
 * A European League world: every association's clubs. The player's own
 * association is fully simulated (teams, drivers, staff, cars, money); the
 * other associations' clubs race on a quick model driven by their strength.
 */

const PALETTE = ['#e10600', '#0ea5e9', '#16a34a', '#f59e0b', '#7c3aed', '#db2777', '#0f172a', '#f8fafc', '#facc15', '#14b8a6', '#1d4ed8', '#b91c1c', '#ea580c', '#65a30d', '#9333ea', '#475569', '#0891b2', '#be123c', '#a16207', '#166534', '#1e3a8a', '#fb7185', '#a3a3a3', '#22d3ee'];
const LIVERIES: LiveryPattern[] = ['solid', 'stripe', 'split', 'arrow', 'halo', 'fade'];

function plain(s: string): string {
  return s.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
}

function shortCode(city: string, used: Set<string>): string {
  const p = plain(city) || 'CLB';
  const candidates = [p.slice(0, 3), p[0] + p.slice(2, 4), p[0] + p[1] + p[p.length - 1], p[0] + p.slice(-2)];
  for (const c of candidates) {
    if (c.length === 3 && !used.has(c)) {
      used.add(c);
      return c;
    }
  }
  for (let i = 2; i < 99; i++) {
    const c = `${p.slice(0, 2)}${i}`.slice(0, 3);
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  return p.slice(0, 3);
}

/** Club names for an association, biggest towns first. */
function clubNames(rng: Rng, assoc: AssociationSeed, count: number): { name: string; city: string }[] {
  const out: { name: string; city: string }[] = [];
  const used = new Set<string>();
  let round = 0;
  while (out.length < count && round < 12) {
    for (const city of assoc.cities) {
      if (out.length >= count) break;
      const patterns = rng.shuffle([...assoc.patterns]);
      const name = patterns.map((p) => p.replace('{city}', city)).find((n) => !used.has(n));
      if (!name) continue;
      used.add(name);
      out.push({ name, city });
    }
    round++;
  }
  return out;
}

function syntheticAssocCoef(rng: Rng, rank: number): number[] {
  const base = Math.max(1.6, 21 - 0.62 * (rank - 1));
  return Array.from({ length: 5 }, () => Math.round(base * (1 + rng.normal(0, 0.12)) * 100) / 100);
}

export function emptyEurope(assocId: string): EuropeState {
  return {
    playerAssocId: assocId,
    clubs: {},
    leagues: {},
    associations: {},
    fixtures: {},
    ties: {},
    continental: {},
    cups: {},
    events: [],
    guests: {},
    titleHolders: { CL: null, EL: null, ECL: null },
    history: [],
    carry: null,
  };
}

export function createEuroWorld(config: NewCareerConfig): GameState {
  const choice = config.european;
  if (!choice || !ASSOCIATION_BY_ID[choice.assocId]) throw new Error('Choose an association for a European League career.');
  const seed = (config.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const europe = emptyEurope(choice.assocId);
  applyRuleset({ mode: 'european', europe });
  const rng = Rng.from(seed, 'euroWorld');
  const state = createBaseState(config, seed);
  state.mode = 'european';
  state.europe = europe;
  state.id = `euro-${seed.toString(36)}-${Date.now().toString(36)}`;
  const build: WorldBuild = { state, ctx: { rng, ids: state, season: 1 } };
  const circuits = Object.values(state.circuits);
  const european = circuits.filter(isEuropeanCircuit);
  const personalities = Object.keys(AI_PERSONALITIES) as AIPersonality[];
  const playerAssoc = ASSOCIATION_BY_ID[choice.assocId];

  let clubCounter = 0;
  for (const [rankIdx, assoc] of ASSOCIATIONS.entries()) {
    const own = assoc.id === choice.assocId;
    const crng = Rng.from(seed, 'clubs', assoc.id);
    const total = assoc.levels.reduce((s, l) => s + l.teams, 0);
    const names = clubNames(crng, assoc, total);
    const home = homeCircuits(circuits, assoc.id);
    const venues = home.length ? home : european;
    const used = new Set<string>();
    let nameIdx = 0;
    assoc.levels.forEach((lvl, li) => {
      const level = li + 1;
      const division = divisionForLevel(level);
      const leagueId = `${assoc.id}-${level}`;
      const isPlayerLeague = own && level === assoc.levels.length;
      const slots = isPlayerLeague ? lvl.teams - 1 : lvl.teams;
      const strengths = crng.shuffle(Array.from({ length: slots }, (_, i) => (slots === 1 ? 0 : 1 - (2 * i) / (slots - 1))));
      const league: EuroLeague = { id: leagueId, assocId: assoc.id, level, name: lvl.name, short: lvl.short, clubIds: [], weeks: leagueWeeks(leagueWeekends(lvl.teams)), standings: {}, division: own ? division : null };
      for (let i = 0; i < slots; i++) {
        const { name, city } = names[nameIdx++] ?? { name: `${assoc.name} Racing ${nameIdx}`, city: assoc.name };
        const primary = crng.pick(PALETTE);
        const secondary = crng.pick(PALETTE.filter((c) => c !== primary));
        const club: EuroClub = {
          id: `c${++clubCounter}`,
          name,
          short: shortCode(city, used),
          assocId: assoc.id,
          level,
          power: 0,
          teamId: null,
          colors: { primary, secondary },
          livery: crng.pick(LIVERIES),
          homeCircuitId: venues[(nameIdx + crng.int(0, 3)) % venues.length].id,
          coef: [],
          honours: {},
          drivers: rollDriverSplit(crng),
        };
        if (own) {
          const team = generateTeamFromIdentity(build, division, { name, shortName: club.short, nationality: assoc.nationality, primary, secondary, livery: club.livery }, strengths[i], rng.pick(personalities), {
            driverNationality: (r) => (r.chance(0.45) ? assoc.nationality : undefined),
          });
          team.clubId = club.id;
          club.teamId = team.id;
          state.teams[team.id] = team;
        } else {
          club.power = Math.round((levelMeanPower(assoc.id, division) + strengths[i] * levelPowerSpread(division) + crng.normal(0, 1.8)) * 10) / 10;
        }
        europe.clubs[club.id] = club;
        league.clubIds.push(club.id);
        if (!own) league.standings[club.id] = { clubId: club.id, points: 0, wins: 0, podiums: 0, races: 0, best: null };
      }
      if (isPlayerLeague) {
        const player = createPlayerTeam(build, { ...config, nationality: assoc.nationality }, division);
        const club: EuroClub = {
          id: `c${++clubCounter}`,
          name: player.name,
          short: player.shortName,
          assocId: assoc.id,
          level,
          power: 0,
          teamId: player.id,
          colors: { ...player.colors },
          livery: player.livery,
          homeCircuitId: venues[crng.int(0, venues.length - 1)].id,
          coef: [],
          honours: {},
          drivers: [0, 0],
        };
        player.clubId = club.id;
        state.teams[player.id] = player;
        state.player.teamId = player.id;
        europe.clubs[club.id] = club;
        league.clubIds.push(club.id);
      }
      europe.leagues[leagueId] = league;
    });
    // Coefficients and last season's outcome, so year one has European places and holders.
    const coef = syntheticAssocCoef(crng, rankIdx + 1);
    const top = europe.leagues[`${assoc.id}-1`];
    const powerOf = (id: string) => {
      const c = europe.clubs[id];
      if (c.teamId) {
        const t = state.teams[c.teamId];
        return levelMeanPower(assoc.id, divisionForLevel(1)) + (t.reputation - DIVISIONS[t.division].typicalReputation) / 6;
      }
      return c.power;
    };
    const order = [...top.clubIds].sort((a, b) => powerOf(b) + crng.normal(0, 2.5) - (powerOf(a) + crng.normal(0, 2.5)));
    const cupPool = [...top.clubIds, ...(europe.leagues[`${assoc.id}-2`]?.clubIds.slice(0, 6) ?? [])];
    const cupWinner = crng.weighted(cupPool.map((id) => ({ item: id, weight: Math.exp((powerOf(id) - powerOf(order[0])) / 3) })));
    const leagueCupWinner = crng.weighted(top.clubIds.map((id) => ({ item: id, weight: Math.exp((powerOf(id) - powerOf(order[0])) / 3) })));
    const assocState: EuroAssociationState = { id: assoc.id, coef, rankHistory: [rankIdx + 1], last: { order, cupWinner, leagueCupWinner } };
    europe.associations[assoc.id] = assocState;
    // Club coefficients: regular European entrants carry points from past seasons.
    const places = rankIdx < 4 ? 7 : rankIdx < 8 ? 5 : rankIdx < 16 ? 4 : 3;
    const seasonBase = coef.reduce((s, x) => s + x, 0) / coef.length;
    order.forEach((id, k) => {
      const club = europe.clubs[id];
      club.coef = Array.from({ length: 5 }, () => (k < places + 1 && crng.chance(0.85 - k * 0.07) ? Math.round(Math.max(0, seasonBase * (1.5 - k * 0.12) * crng.range(0.6, 1.3)) * 10) / 10 : 0));
    });
  }

  // Title holders for year one: strong clubs from the strongest associations.
  const holder = (from: number, to: number, exclude: string[]): string => {
    const pool = ASSOCIATIONS.slice(from, to).flatMap((a) => europe.associations[a.id].last.order.slice(0, 4)).filter((id) => !exclude.includes(id) && !europe.clubs[id].teamId);
    const best = Math.max(...pool.map((id) => europe.clubs[id].power));
    return rng.weighted(pool.map((id) => ({ item: id, weight: Math.exp((europe.clubs[id].power - best) / 2) })));
  };
  europe.titleHolders.CL = holder(0, 6, []);
  europe.titleHolders.EL = holder(0, 10, [europe.titleHolders.CL]);
  europe.titleHolders.ECL = holder(4, 16, [europe.titleHolders.CL, europe.titleHolders.EL]);

  // Free agents and youth, weighted to local talent.
  const local = () => (rng.chance(0.4) ? playerAssoc.nationality : undefined);
  playerAssoc.levels.forEach((lvl, li) => {
    const division = divisionForLevel(li + 1);
    const cfg = DIVISIONS[division];
    const count = Math.round(lvl.teams * (0.9 + li * 0.35));
    for (let i = 0; i < count; i++) {
      const d = generateDriver(build.ctx, { targetOverall: cfg.driverRatingMean - 3 + rng.normal(0, cfg.driverRatingSd), age: raceAgeFor(rng, division), division, nationality: local() });
      state.drivers[d.id] = d;
    }
  });
  for (let i = 0; i < 60; i++) {
    const p = generateProspect(build.ctx, rng.range(0.4, 1.9));
    state.drivers[p.id] = p;
  }
  replenishStaffPool(state, rng);

  state.calendars = buildEuroCalendars(state, 1);
  const player = state.teams[state.player.teamId];
  for (const id of player.raceDrivers) if (id) state.player.scouting[id] = 100;
  return state;
}
