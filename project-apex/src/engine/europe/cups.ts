import { DIVISIONS } from '../config/divisions';
import { postTransaction } from '../finance/ledger';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import type { CupState, EuroFixture, EuroTie, GameState } from '../types';
import { clamp, roundMoney } from '../util';
import { clubCoefficient } from './coefficients';
import { ASSOCIATION_BY_ID } from './data';
import { competitionName, createTie, hooks, playerClubId, stageLabel, tieLoser } from './fixtures';
import { clubField, quickRace } from './power';
import { EURO_WEEKS, homeCircuits, isEuropeanCircuit } from './schedule';

/**
 * Domestic cups. The player's association plays its cup (every club of every
 * level), its league cup (the top two levels) and its super cup (champion
 * against cup winner) race by race. Other associations' cups are settled by
 * the quick model in one go; only their winners matter for European places.
 */

export function stageForField(n: number): string {
  if (n <= 2) return 'final';
  if (n <= 4) return 'sf';
  if (n <= 8) return 'qf';
  if (n <= 16) return 'r16';
  if (n <= 32) return 'r32';
  if (n <= 64) return 'r64';
  return 'prelim';
}

function roundsNeeded(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
}

/** Seeding for byes: higher level first, then last season's league order, then coefficient. */
function cupSeedOrder(state: GameState, clubIds: string[]): string[] {
  const europe = state.europe!;
  const lastPos = new Map<string, number>();
  for (const a of Object.values(europe.associations)) a.last.order.forEach((id, i) => lastPos.set(id, i));
  return [...clubIds].sort((a, b) => {
    const ca = europe.clubs[a];
    const cb = europe.clubs[b];
    return ca.level - cb.level || (lastPos.get(a) ?? 99) - (lastPos.get(b) ?? 99) || clubCoefficient(state, cb) - clubCoefficient(state, ca) || a.localeCompare(b);
  });
}

function cupVenue(state: GameState, assocId: string | null, seedKey: string): string {
  const circuits = Object.values(state.circuits);
  const home = assocId ? homeCircuits(circuits, assocId) : [];
  const pool = home.length ? home : circuits.filter(isEuropeanCircuit);
  return Rng.from(state.seed, 'cupVenue', seedKey, state.season).pick(pool).id;
}

function drawCupRound(state: GameState, cup: CupState): void {
  const europe = state.europe!;
  const round = cup.rounds.length;
  const alive = cupSeedOrder(state, cup.alive);
  const n = alive.length;
  const target = 2 ** Math.floor(Math.log2(n));
  const ties = n === target ? n / 2 : n - target;
  const playing = alive.slice(n - ties * 2);
  const rng = Rng.from(state.seed, 'cupDraw', cup.id, state.season, round);
  const drawn = rng.shuffle(playing);
  // A small first round that only trims the field to a power of two is a preliminary round.
  const stage = n === target ? stageForField(n) : ties * 2 < n / 2 ? 'prelim' : stageForField(target * 2);
  const week = cup.weeks[Math.min(round, cup.weeks.length - 1)];
  const venue = stage === 'final' ? cupVenue(state, cup.assocId, cup.id) : undefined;
  const ids: string[] = [];
  for (let i = 0; i < drawn.length; i += 2) {
    let [home, away] = [drawn[i], drawn[i + 1]];
    // The lower-level club hosts, as in football's cup traditions.
    if (europe.clubs[away].level > europe.clubs[home].level) [home, away] = [away, home];
    ids.push(createTie(state, cup.kind === 'ESC' ? 'ESC' : cup.kind, stage, home, away, [week], venue).id);
  }
  cup.rounds.push(ids);
}

function newCup(state: GameState, id: string, kind: CupState['kind'], assocId: string | null, entrants: string[], weekList: readonly number[]): CupState {
  const rounds = roundsNeeded(entrants.length);
  const cup: CupState = {
    id,
    kind,
    assocId,
    name: competitionName(state, kind === 'ESC' ? 'ESC' : kind, assocId),
    entrants: [...entrants],
    rounds: [],
    weeks: weekList.slice(Math.max(0, weekList.length - rounds)),
    alive: [...entrants],
    winner: null,
    runnerUp: null,
  };
  state.europe!.cups[id] = cup;
  return cup;
}

/** Super cup pairing: champion against cup winner (runner-up if the champion did the double). */
function superCupPair(state: GameState, assocId: string): [string, string] | null {
  const last = state.europe!.associations[assocId].last;
  const champion = last.order[0];
  if (!champion) return null;
  const other = last.cupWinner && last.cupWinner !== champion ? last.cupWinner : last.order[1];
  return other ? [champion, other] : null;
}

/** Quick-model knockout of a whole bracket; returns winner and runner-up. */
function quickBracket(state: GameState, key: string, entrants: string[]): { winner: string; runnerUp: string | null } {
  const europe = state.europe!;
  const rng = Rng.from(state.seed, 'quickCup', key, state.season);
  let alive = cupSeedOrder(state, entrants);
  let runnerUp: string | null = null;
  while (alive.length > 1) {
    const n = alive.length;
    const target = 2 ** Math.floor(Math.log2(n));
    const ties = n === target ? n / 2 : n - target;
    const byes = alive.slice(0, n - ties * 2);
    const playing = rng.shuffle(alive.slice(n - ties * 2));
    const winners: string[] = [];
    for (let i = 0; i < playing.length; i += 2) {
      const a = playing[i];
      const b = playing[i + 1];
      const order = quickRace(rng, [clubField(state, europe.clubs[a]), clubField(state, europe.clubs[b])], 0.045);
      const score = (id: string) => order.reduce((s, c, idx) => s + (c.clubId === id && !c.dnf ? [4, 3, 2, 1][idx] : 0), 0);
      const sa = score(a);
      const sb = score(b);
      const w = sa === sb ? (order[0].clubId === a ? a : b) : sa > sb ? a : b;
      winners.push(w);
      if (n === 2) runnerUp = w === a ? b : a;
    }
    alive = cupSeedOrder(state, [...byes, ...winners]);
  }
  return { winner: alive[0], runnerUp };
}

export function startCups(state: GameState): void {
  const europe = state.europe!;
  const pa = europe.playerAssocId;
  for (const assocId of Object.keys(europe.associations)) {
    const leagues = Object.values(europe.leagues).filter((l) => l.assocId === assocId).sort((a, b) => a.level - b.level);
    const all = leagues.flatMap((l) => l.clubIds);
    const pair = superCupPair(state, assocId);
    if (assocId === pa) {
      newCup(state, `${assocId}-cup`, 'cup', assocId, all, EURO_WEEKS.cup);
      drawCupRound(state, europe.cups[`${assocId}-cup`]);
      const lcEntrants = leagues.filter((l) => l.level <= 2).flatMap((l) => l.clubIds);
      newCup(state, `${assocId}-leagueCup`, 'leagueCup', assocId, lcEntrants, EURO_WEEKS.leagueCup);
      drawCupRound(state, europe.cups[`${assocId}-leagueCup`]);
      if (pair) {
        newCup(state, `${assocId}-superCup`, 'superCup', assocId, pair, [EURO_WEEKS.superCup]);
        drawCupRound(state, europe.cups[`${assocId}-superCup`]);
      }
    } else {
      // Recorded now, settled at the domestic cup final week.
      newCup(state, `${assocId}-cup`, 'cup', assocId, all, [EURO_WEEKS.cup[EURO_WEEKS.cup.length - 1]]);
      if (pair) {
        const cup = newCup(state, `${assocId}-superCup`, 'superCup', assocId, pair, [EURO_WEEKS.superCup]);
        const r = quickBracket(state, cup.id, pair);
        settleCup(state, cup, r.winner, r.runnerUp);
      }
    }
  }
  const { CL, EL, ECL } = europe.titleHolders;
  const escPair = CL && EL && CL !== EL ? [CL, EL] : CL && ECL && CL !== ECL ? [CL, ECL] : null;
  if (escPair) {
    const cup = newCup(state, 'ESC', 'ESC', null, escPair, [EURO_WEEKS.europeanSuperCup]);
    cup.name = competitionName(state, 'ESC');
    drawCupRound(state, cup);
  }
}

function settleCup(state: GameState, cup: CupState, winner: string, runnerUp: string | null): void {
  const europe = state.europe!;
  cup.winner = winner;
  cup.runnerUp = runnerUp;
  cup.alive = [winner];
  const club = europe.clubs[winner];
  const honour = cup.kind === 'ESC' ? 'ESC' : cup.kind;
  club.honours[honour] = (club.honours[honour] ?? 0) + 1;
  if (club.teamId && state.teams[club.teamId] && !state.teams[club.teamId].guest) {
    const team = state.teams[club.teamId];
    const share = cup.kind === 'cup' ? 0.025 : cup.kind === 'leagueCup' ? 0.015 : cup.kind === 'ESC' ? 0.02 : 0.008;
    if (!state.processed[`cupPrize:${cup.id}:${state.season}`]) {
      state.processed[`cupPrize:${cup.id}:${state.season}`] = true;
      postTransaction(state, team, 'prize', roundMoney(DIVISIONS[team.division].typicalBudget * share), `${cup.name} winners`);
    }
    team.reputation = clamp(team.reputation + (cup.kind === 'cup' ? 2 : cup.kind === 'ESC' ? 2 : 1), 1, 99);
  }
  if (cup.assocId === europe.playerAssocId || cup.kind === 'ESC') {
    const pc = playerClubId(state);
    addNews(state, {
      category: 'championship',
      headline: `${club.name.toUpperCase()} WIN THE ${cup.name.toUpperCase()}`,
      body: `${club.name} lift the ${cup.name}${runnerUp ? `, beating ${europe.clubs[runnerUp].name} in the final` : ''}.`,
      teamIds: [club.teamId, runnerUp ? europe.clubs[runnerUp].teamId : null].filter((x): x is string => !!x && !!state.teams[x] && !state.teams[x].guest),
      importance: winner === pc || runnerUp === pc ? 3 : 2,
    });
  }
}

/** Draw the next round of every cup whose current round is complete. Called at the start of each week. */
export function progressCups(state: GameState): void {
  const europe = state.europe!;
  for (const cup of Object.values(europe.cups)) {
    if (cup.winner) continue;
    if (cup.assocId && cup.assocId !== europe.playerAssocId && cup.kind === 'cup') {
      if (state.week >= cup.weeks[0]) {
        const r = quickBracket(state, cup.id, cup.entrants);
        settleCup(state, cup, r.winner, r.runnerUp);
      }
      continue;
    }
    const current = cup.rounds[cup.rounds.length - 1];
    if (!current || current.some((id) => !europe.ties[id].winner)) continue;
    const losers = new Set(current.map((id) => tieLoser(state, europe.ties[id])));
    cup.alive = cup.alive.filter((id) => !losers.has(id));
    if (cup.alive.length === 1) {
      const final = europe.ties[current[0]];
      settleCup(state, cup, cup.alive[0], tieLoser(state, final));
      continue;
    }
    const nextWeek = cup.weeks[Math.min(cup.rounds.length, cup.weeks.length - 1)];
    if (state.week >= nextWeek - 3) drawCupRound(state, cup);
  }
}

function onCupFixture(state: GameState, fx: EuroFixture): void {
  if (fx.competition !== 'cup' && fx.competition !== 'leagueCup' && fx.competition !== 'superCup' && fx.competition !== 'ESC') return;
  const pc = playerClubId(state);
  if (!pc || (fx.home !== pc && fx.away !== pc) || !fx.result) return;
  const europe = state.europe!;
  const opp = fx.home === pc ? fx.away : fx.home;
  const mine = fx.home === pc ? fx.result.home : fx.result.away;
  const theirs = fx.home === pc ? fx.result.away : fx.result.home;
  const name = competitionName(state, fx.competition, europe.clubs[fx.home].assocId);
  addNews(state, { category: 'race', headline: `${name.toUpperCase()}: ${mine}–${theirs} AGAINST ${europe.clubs[opp].name.toUpperCase()}`, body: `${stageLabel(fx.stage)}${fx.kind === 'decider' ? ' (extra race)' : ''}: ${mine > theirs ? 'won' : mine === theirs ? 'level' : 'lost'} on race points.`, teamIds: [state.player.teamId], importance: 2 });
}

function onCupTie(state: GameState, tie: EuroTie): void {
  if (tie.competition !== 'cup' && tie.competition !== 'leagueCup') return;
  if (!tie.winner) return;
  const club = state.europe!.clubs[tie.winner];
  if (club?.teamId && state.teams[club.teamId] && !state.teams[club.teamId].guest && !state.processed[`cupRound:${tie.id}`]) {
    state.processed[`cupRound:${tie.id}`] = true;
    const team = state.teams[club.teamId];
    postTransaction(state, team, 'prize', roundMoney(DIVISIONS[team.division].typicalBudget * 0.004), `${competitionName(state, tie.competition)}: ${stageLabel(tie.stage)} won`);
  }
}

hooks.fixture.push(onCupFixture);
hooks.tie.push(onCupTie);

export const cupLabel = (state: GameState, cupId: string): string => state.europe!.cups[cupId]?.name ?? ASSOCIATION_BY_ID[cupId]?.cupName ?? cupId;
