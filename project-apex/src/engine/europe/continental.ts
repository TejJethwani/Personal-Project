import { DIVISIONS } from '../config/divisions';
import { postTransaction } from '../finance/ledger';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import type { ContinentalCompetition, ContinentalState, EuroFixture, EuroTie, GameState } from '../types';
import { clamp, roundMoney } from '../util';
import { associationRanking, clubCoefficient } from './coefficients';
import { CONTINENTAL } from './data';
import { leaguePhaseDraw, type DrawTeam } from './draw';
import { competitionName, createFixture, createTie, hooks, playerClubId, pointsFor, stageLabel, tieLoser } from './fixtures';
import { EURO_WEEKS, isEuropeanCircuit } from './schedule';

/**
 * The three continental competitions: allocation of places by association
 * coefficient, qualifying knockouts down to exactly 36 clubs, a 36-club league
 * phase, knockout play-offs, two-legged rounds and a single-race final.
 */

export const CONTINENTAL_ORDER: ContinentalCompetition[] = ['CL', 'EL', 'ECL'];
export const TEAMS_PER_COMPETITION = 36;

interface Berth {
  comp: ContinentalCompetition;
  route: 'league' | 'cup';
  pos: number;
  direct: boolean;
}

const L = (comp: ContinentalCompetition, pos: number, direct: boolean): Berth => ({ comp, route: 'league', pos, direct });
const C = (comp: ContinentalCompetition, direct: boolean): Berth => ({ comp, route: 'cup', pos: 0, direct });

/** European places of an association by its coefficient rank. */
export function berthsForRank(rank: number): Berth[] {
  if (rank <= 4) return [L('CL', 1, true), L('CL', 2, true), L('CL', 3, true), L('CL', 4, true), L('EL', 5, true), C('EL', true), L('ECL', 6, true)];
  if (rank === 5) return [L('CL', 1, true), L('CL', 2, true), L('CL', 3, true), L('EL', 4, true), C('EL', true), L('ECL', 5, true)];
  if (rank <= 8) return [L('CL', 1, true), L('CL', 2, true), L('EL', 3, true), C('EL', true), L('ECL', 4, true)];
  if (rank <= 11) return [L('CL', 1, true), L('CL', 2, false), L('EL', 3, true), C('EL', true), L('ECL', 4, true)];
  if (rank <= 16) return [L('CL', 1, false), C('EL', false), L('EL', 2, false), L('ECL', 3, true)];
  if (rank <= 24) return [L('CL', 1, false), C('EL', false), L('ECL', 2, false), L('ECL', 3, false)];
  return [L('CL', 1, false), C('ECL', false), L('ECL', 2, false)];
}

export interface Allocation {
  direct: string[];
  pool: string[];
}

/** Who goes where next season. Every club appears at most once across the three competitions. */
export function allocateEuropeanPlaces(state: GameState): Record<ContinentalCompetition, Allocation> {
  const europe = state.europe!;
  const ranking = associationRanking(state);
  const taken = new Set<string>();
  const out: Record<ContinentalCompetition, Allocation> = { CL: { direct: [], pool: [] }, EL: { direct: [], pool: [] }, ECL: { direct: [], pool: [] } };
  const place = (comp: ContinentalCompetition, id: string | null, direct: boolean) => {
    if (!id || taken.has(id)) return false;
    taken.add(id);
    (direct ? out[comp].direct : out[comp].pool).push(id);
    return true;
  };
  // Title holders: Champions and Europa League winners enter the Champions League, the Conference winner the Europa League.
  place('CL', europe.titleHolders.CL, true);
  place('CL', europe.titleHolders.EL, true);
  place('EL', europe.titleHolders.ECL, true);
  for (const comp of CONTINENTAL_ORDER) {
    ranking.forEach((assocId, i) => {
      const assoc = europe.associations[assocId];
      const order = assoc.last.order.filter((id) => europe.clubs[id]);
      for (const berth of berthsForRank(i + 1).filter((b) => b.comp === comp)) {
        let id: string | null = null;
        if (berth.route === 'cup' && assoc.last.cupWinner && !taken.has(assoc.last.cupWinner)) id = assoc.last.cupWinner;
        // A place already filled passes to the next club in the league table.
        else id = order.slice(berth.route === 'league' ? berth.pos - 1 : 0).find((c) => !taken.has(c)) ?? null;
        place(comp, id, berth.direct);
      }
    });
  }
  // Exactly 36 per competition: surplus direct entrants drop into qualifying.
  for (const comp of CONTINENTAL_ORDER) {
    const a = out[comp];
    const byCoef = (x: string, y: string) => clubCoefficient(state, europe.clubs[y]) - clubCoefficient(state, europe.clubs[x]);
    a.direct.sort(byCoef);
    while (a.direct.length > TEAMS_PER_COMPETITION) a.pool.push(a.direct.pop()!);
    a.pool.sort(byCoef);
    const needed = TEAMS_PER_COMPETITION - a.direct.length;
    if (a.pool.length < needed) {
      // Not enough qualifiers: the best remaining top-flight clubs are invited.
      const spare = ranking.flatMap((id) => europe.associations[id].last.order).filter((id) => !taken.has(id) && europe.clubs[id]);
      while (a.pool.length < needed && spare.length) {
        const id = spare.shift()!;
        taken.add(id);
        a.pool.push(id);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Season flow
// ---------------------------------------------------------------------------

function emptyComp(id: ContinentalCompetition, season: number): ContinentalState {
  return { id, season, direct: [], qualifyingPool: [], qualifiers: 0, qualifyingRounds: [], teams: [], pots: [], fixtures: [], stage: 'qualifying', knockout: { playoff: [], r16: [], qf: [], sf: [], final: [] }, winner: null, runnerUp: null };
}

export function startContinental(state: GameState): void {
  const europe = state.europe!;
  const alloc = allocateEuropeanPlaces(state);
  for (const id of CONTINENTAL_ORDER) {
    const comp = emptyComp(id, state.season);
    comp.direct = alloc[id].direct;
    comp.qualifyingPool = alloc[id].pool;
    comp.qualifiers = TEAMS_PER_COMPETITION - comp.direct.length;
    europe.continental[id] = comp;
    if (comp.qualifiers <= 0 || comp.qualifyingPool.length <= comp.qualifiers) {
      comp.teams = [...comp.direct, ...comp.qualifyingPool].slice(0, TEAMS_PER_COMPETITION);
      comp.stage = 'league';
    } else drawQualifyingRound(state, comp);
  }
  const pc = playerClubId(state);
  if (pc) {
    for (const id of CONTINENTAL_ORDER) {
      const comp = europe.continental[id]!;
      const direct = comp.direct.includes(pc);
      if (direct || comp.qualifyingPool.includes(pc)) {
        addNews(state, { category: 'championship', headline: `${competitionName(state, id).toUpperCase()}: ${direct ? 'STRAIGHT INTO THE LEAGUE PHASE' : 'QUALIFYING AWAITS'}`, body: direct ? `Your team enters the ${competitionName(state, id)} league phase. The draw follows the qualifying rounds.` : `Your team must come through ${competitionName(state, id)} qualifying: single-race knockout ties for ${comp.qualifiers} places.`, teamIds: [state.player.teamId], importance: 3 });
      }
    }
  }
}

function drawQualifyingRound(state: GameState, comp: ContinentalState): void {
  const europe = state.europe!;
  const round = comp.qualifyingRounds.length;
  const week = EURO_WEEKS.qualifying[Math.min(round, EURO_WEEKS.qualifying.length - 1)];
  const pool = [...comp.qualifyingPool].sort((a, b) => clubCoefficient(state, europe.clubs[b]) - clubCoefficient(state, europe.clubs[a]));
  const ties = Math.min(pool.length - comp.qualifiers, Math.floor(pool.length / 2));
  const playing = pool.slice(pool.length - ties * 2);
  const rng = Rng.from(state.seed, 'qualDraw', comp.id, state.season, round);
  const seeded = rng.shuffle(playing.slice(0, ties));
  const unseeded = rng.shuffle(playing.slice(ties));
  const ids: string[] = [];
  seeded.forEach((a, i) => {
    const b = unseeded[i];
    const [home, away] = rng.chance(0.5) ? [a, b] : [b, a];
    ids.push(createTie(state, comp.id, 'qualifying', home, away, [week]).id);
  });
  comp.qualifyingRounds.push(ids);
}

const tiesDone = (state: GameState, ids: string[]) => ids.every((id) => !!state.europe!.ties[id]?.winner);

function neutralVenue(state: GameState, comp: ContinentalCompetition): string {
  const rng = Rng.from(state.seed, 'finalVenue', comp, state.season);
  const pool = Object.values(state.circuits).filter(isEuropeanCircuit);
  return rng.pick(pool).id;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  rf: number;
  ra: number;
  points: number;
}

/** League-phase table: 3 points a win, 1 a draw; then race-point difference, race points scored, wins, coefficient. */
export function leaguePhaseTable(state: GameState, comp: ContinentalState): TableRow[] {
  const europe = state.europe!;
  const rows = new Map(comp.teams.map((id) => [id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, rf: 0, ra: 0, points: 0 }]));
  for (const fxId of comp.fixtures) {
    const fx = europe.fixtures[fxId];
    if (!fx?.result) continue;
    const h = rows.get(fx.home);
    const a = rows.get(fx.away);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.rf += fx.result.home;
    h.ra += fx.result.away;
    a.rf += fx.result.away;
    a.ra += fx.result.home;
    if (fx.result.home > fx.result.away) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (fx.result.away > fx.result.home) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points || y.rf - y.ra - (x.rf - x.ra) || y.rf - x.rf || y.won - x.won || clubCoefficient(state, europe.clubs[y.clubId]) - clubCoefficient(state, europe.clubs[x.clubId]) || x.clubId.localeCompare(y.clubId),
  );
}

function drawLeaguePhase(state: GameState, comp: ContinentalState): void {
  const europe = state.europe!;
  const cfg = CONTINENTAL[comp.id];
  const holder = europe.titleHolders[comp.id];
  const ranked = [...comp.teams].sort((a, b) => (a === holder ? -1 : b === holder ? 1 : clubCoefficient(state, europe.clubs[b]) - clubCoefficient(state, europe.clubs[a])));
  const potSize = TEAMS_PER_COMPETITION / cfg.pots;
  comp.pots = Array.from({ length: cfg.pots }, (_, p) => ranked.slice(p * potSize, (p + 1) * potSize));
  const pots: DrawTeam[][] = comp.pots.map((pot) => pot.map((id) => ({ id, assoc: europe.clubs[id].assocId })));
  const { matchdays } = leaguePhaseDraw(Rng.from(state.seed, 'leaguePhase', comp.id, state.season), pots, cfg.opponents / cfg.pots);
  matchdays.forEach((day, k) => {
    for (const [home, away] of day) {
      const fx = createFixture(state, { competition: comp.id, stage: 'league', matchday: k + 1, week: EURO_WEEKS.leaguePhase[k], home, away, circuitId: europe.clubs[home].homeCircuitId, kind: 'match' });
      comp.fixtures.push(fx.id);
    }
  });
  const pc = playerClubId(state);
  if (pc && comp.teams.includes(pc)) {
    const opponents = comp.fixtures.map((id) => europe.fixtures[id]).filter((f) => f.home === pc || f.away === pc).sort((a, b) => a.matchday - b.matchday);
    addNews(state, {
      category: 'championship',
      headline: `${cfg.name.toUpperCase()} DRAW: ${opponents.length} OPPONENTS CONFIRMED`,
      body: `League phase: ${opponents.map((f) => `MD${f.matchday} ${f.home === pc ? 'v' : '@'} ${europe.clubs[f.home === pc ? f.away : f.home].name}`).join(', ')}.`,
      teamIds: [state.player.teamId],
      importance: 3,
    });
  }
}

function knockoutTie(state: GameState, comp: ContinentalState, stage: 'playoff' | 'r16' | 'qf' | 'sf', better: string, worse: string): string {
  const weeks = EURO_WEEKS[stage];
  // The better-placed club hosts the second leg.
  return createTie(state, comp.id, stage, worse, better, [...weeks]).id;
}

/** Advance a competition when a stage is complete. Called at the start of every week. */
export function progressContinental(state: GameState, comp: ContinentalState): void {
  const europe = state.europe!;
  const week = state.week;
  if (comp.stage === 'qualifying') {
    const current = comp.qualifyingRounds[comp.qualifyingRounds.length - 1] ?? [];
    if (!tiesDone(state, current)) return;
    const losers = new Set(current.map((id) => tieLoser(state, europe.ties[id])).filter(Boolean) as string[]);
    comp.qualifyingPool = comp.qualifyingPool.filter((id) => !losers.has(id));
    if (comp.qualifyingPool.length <= comp.qualifiers || comp.qualifyingRounds.length >= EURO_WEEKS.qualifying.length) {
      const survivors = [...comp.qualifyingPool].sort((a, b) => clubCoefficient(state, europe.clubs[b]) - clubCoefficient(state, europe.clubs[a])).slice(0, comp.qualifiers);
      comp.teams = [...comp.direct, ...survivors];
      comp.stage = 'league';
    } else {
      drawQualifyingRound(state, comp);
      return;
    }
  }
  if (comp.stage === 'league') {
    if (!comp.fixtures.length) {
      if (week >= EURO_WEEKS.leaguePhase[0] - 1) drawLeaguePhase(state, comp);
      return;
    }
    if (comp.fixtures.some((id) => !europe.fixtures[id].result)) return;
    const table = leaguePhaseTable(state, comp);
    const pc = playerClubId(state);
    const playerPos = pc ? table.findIndex((r) => r.clubId === pc) + 1 : 0;
    for (let i = 8; i < 16; i++) comp.knockout.playoff.push(knockoutTie(state, comp, 'playoff', table[i].clubId, table[31 - i].clubId));
    comp.stage = 'playoff';
    if (playerPos > 0) {
      const text = playerPos <= 8 ? 'through to the Round of 16' : playerPos <= 24 ? 'into the knockout play-offs' : 'eliminated';
      addNews(state, { category: 'championship', headline: `${competitionName(state, comp.id).toUpperCase()}: P${playerPos} IN THE LEAGUE PHASE`, body: `The league phase is complete. Your team finished ${playerPos}th of 36 and goes ${text}.`, teamIds: [state.player.teamId], importance: 3 });
    }
    return;
  }
  const next: Record<string, 'r16' | 'qf' | 'sf' | 'final' | 'done'> = { playoff: 'r16', r16: 'qf', qf: 'sf', sf: 'final', final: 'done' };
  const stage = comp.stage as 'playoff' | 'r16' | 'qf' | 'sf' | 'final';
  if (!(stage in next)) return;
  if (!tiesDone(state, comp.knockout[stage])) return;
  const winners = comp.knockout[stage].map((id) => europe.ties[id].winner!);
  if (stage === 'final') {
    const tie = europe.ties[comp.knockout.final[0]];
    comp.winner = tie.winner;
    comp.runnerUp = tieLoser(state, tie);
    comp.stage = 'done';
    return;
  }
  const to = next[stage] as 'r16' | 'qf' | 'sf' | 'final';
  const firstWeek = to === 'final' ? EURO_WEEKS.final : EURO_WEEKS[to][0];
  if (week < firstWeek - 1) return;
  if (to === 'r16') {
    // League positions 1-8 meet the play-off winners: 1 v winner of 16/17 ... 8 v winner of 9/24.
    const table = leaguePhaseTable(state, comp);
    for (let i = 0; i < 8; i++) comp.knockout.r16.push(knockoutTie(state, comp, 'r16', table[i].clubId, winners[7 - i]));
  } else if (to === 'qf') {
    const w = winners;
    for (const [a, b] of [[0, 7], [3, 4], [1, 6], [2, 5]]) comp.knockout.qf.push(knockoutTie(state, comp, 'qf', w[a], w[b]));
  } else if (to === 'sf') {
    for (const [a, b] of [[0, 1], [2, 3]]) comp.knockout.sf.push(knockoutTie(state, comp, 'sf', winners[a], winners[b]));
  } else {
    comp.knockout.final.push(createTie(state, comp.id, 'final', winners[0], winners[1], [EURO_WEEKS.final], neutralVenue(state, comp.id)).id);
  }
  comp.stage = to;
}

/** Stage the player's club reached in a competition this season, or null. */
export function playerReached(state: GameState, comp: ContinentalState): string | null {
  const pc = playerClubId(state);
  const europe = state.europe!;
  if (!pc) return null;
  if (comp.winner === pc) return 'Winners';
  if (comp.runnerUp === pc) return 'Final';
  for (const stage of ['sf', 'qf', 'r16', 'playoff'] as const) {
    if (comp.knockout[stage].some((id) => [europe.ties[id].home, europe.ties[id].away].includes(pc))) return stageLabel(stage);
  }
  if (comp.teams.includes(pc)) return 'League phase';
  if (comp.qualifyingPool.includes(pc) || comp.qualifyingRounds.flat().some((id) => [europe.ties[id].home, europe.ties[id].away].includes(pc))) return 'Qualifying';
  return null;
}

// ---------------------------------------------------------------------------
// Prize money and reputation for teams the game runs in full
// ---------------------------------------------------------------------------

const PRIZE_UNIT: Record<ContinentalCompetition, number> = { CL: 0.01, EL: 0.0055, ECL: 0.0032 };
const STAGE_PRIZE: Record<string, number> = { qualifying: 0.3, playoff: 1, r16: 2, qf: 3, sf: 4, final: 5 };

function payClub(state: GameState, clubId: string, units: number, comp: ContinentalCompetition, label: string, key: string): void {
  const club = state.europe!.clubs[clubId];
  if (!club?.teamId) return;
  const team = state.teams[club.teamId];
  if (!team || team.guest || state.processed[key]) return;
  state.processed[key] = true;
  const amount = roundMoney(DIVISIONS[team.division].typicalBudget * PRIZE_UNIT[comp] * units);
  if (amount > 0) postTransaction(state, team, 'prize', amount, label);
}

function onContinentalFixture(state: GameState, fx: EuroFixture): void {
  if (fx.competition !== 'CL' && fx.competition !== 'EL' && fx.competition !== 'ECL') return;
  const comp = fx.competition;
  const name = competitionName(state, comp);
  if (fx.stage === 'league' && fx.result) {
    for (const side of [fx.home, fx.away]) {
      const mine = pointsFor(fx, side);
      const theirs = pointsFor(fx, side === fx.home ? fx.away : fx.home);
      if (mine > theirs) payClub(state, side, 1.2, comp, `${name}: league phase win`, `prize:${fx.id}:${side}`);
      else if (mine === theirs) payClub(state, side, 0.4, comp, `${name}: league phase draw`, `prize:${fx.id}:${side}`);
    }
  }
  const pc = playerClubId(state);
  if (pc && (fx.home === pc || fx.away === pc) && fx.result) {
    const europe = state.europe!;
    const opp = fx.home === pc ? fx.away : fx.home;
    const mine = pointsFor(fx, pc);
    const theirs = pointsFor(fx, opp);
    const team = state.teams[state.player.teamId];
    team.reputation = clamp(team.reputation + (mine > theirs ? 0.4 : mine === theirs ? 0.1 : -0.1) * CONTINENTAL[comp].prestige, 1, 99);
    addNews(state, {
      category: 'race',
      headline: `${CONTINENTAL[comp].short.toUpperCase()}: ${team.name.toUpperCase()} ${mine}–${theirs} ${europe.clubs[opp].name.toUpperCase()}`,
      body: `${fx.stage === 'league' ? `Matchday ${fx.matchday}` : stageLabel(fx.stage)}: ${mine > theirs ? 'a win' : mine === theirs ? 'a draw' : 'a defeat'} against ${europe.clubs[opp].name} on race points (4-3-2-1 per car).`,
      teamIds: [team.id],
      importance: 3,
    });
  }
}

function onContinentalTie(state: GameState, tie: EuroTie): void {
  if (tie.competition !== 'CL' && tie.competition !== 'EL' && tie.competition !== 'ECL') return;
  const comp = tie.competition;
  const name = competitionName(state, comp);
  const europe = state.europe!;
  if (tie.winner) {
    const units = STAGE_PRIZE[tie.stage] ?? 0;
    payClub(state, tie.winner, units, comp, `${name}: ${stageLabel(tie.stage)} won`, `prize:${tie.id}`);
    if (tie.stage === 'final') {
      const winner = europe.clubs[tie.winner];
      winner.honours[comp] = (winner.honours[comp] ?? 0) + 1;
      if (winner.teamId && state.teams[winner.teamId] && !state.teams[winner.teamId].guest) {
        const t = state.teams[winner.teamId];
        t.reputation = clamp(t.reputation + 6 * CONTINENTAL[comp].prestige + 2, 1, 99);
      }
      const runner = tieLoser(state, tie)!;
      addNews(state, {
        category: 'championship',
        headline: `${winner.name.toUpperCase()} WIN THE ${name.toUpperCase()}`,
        body: `${winner.name} beat ${europe.clubs[runner].name} ${Math.max(...tie.aggregate)}–${Math.min(...tie.aggregate)} on race points in the final${tie.shootout ? ' after a qualifying shoot-out' : tie.decider ? ' after an extra race' : ''}.`,
        teamIds: [winner.teamId, europe.clubs[runner].teamId].filter((x): x is string => !!x && !state.teams[x]?.guest),
        importance: winner.id === playerClubId(state) || runner === playerClubId(state) ? 3 : 2,
      });
    }
    const pc = playerClubId(state);
    if (pc && (tie.home === pc || tie.away === pc) && tie.stage !== 'final') {
      const won = tie.winner === pc;
      const opp = tie.home === pc ? tie.away : tie.home;
      const how = tie.shootout ? ' after a qualifying shoot-out' : tie.decider ? ' after an extra race' : '';
      addNews(state, { category: 'championship', headline: `${name.toUpperCase()}: ${won ? 'THROUGH' : 'KNOCKED OUT'}`, body: `${stageLabel(tie.stage)}: ${won ? 'your team beat' : 'your team lost to'} ${europe.clubs[opp].name} ${tie.aggregate[tie.home === pc ? 0 : 1]}–${tie.aggregate[tie.home === pc ? 1 : 0]} on aggregate${how}.`, teamIds: [state.player.teamId], importance: 3 });
    }
  }
}

hooks.fixture.push(onContinentalFixture);
hooks.tie.push(onContinentalTie);

/** League-phase entry money for the teams the game runs in full. */
export function payParticipation(state: GameState): void {
  for (const comp of Object.values(state.europe!.continental)) {
    if (!comp || comp.stage === 'qualifying' || !comp.teams.length) continue;
    for (const id of comp.teams) payClub(state, id, comp.id === 'CL' ? 8 : comp.id === 'EL' ? 6 : 5, comp.id, `${competitionName(state, comp.id)}: league phase entry`, `entry:${comp.id}:${state.season}:${id}`);
  }
}
