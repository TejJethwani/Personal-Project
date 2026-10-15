import { DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { applyRegulationReset, COMPONENT_KEYS, overallPace, rebaseCarForDivision } from '../car/car';
import { boardSeasonReview, canBeSacked } from '../board';
import { divisionStandings } from '../championship/standings';
import { ageDrivers } from '../drivers/development';
import { generateDriver, generateProspect, raceAgeFor } from '../drivers/generate';
import { computeOverall, driverName, overall } from '../drivers/ratings';
import { postTransaction, seasonTotals } from '../finance/ledger';
import { expectationProgress, generateSponsorOffer, refreshSponsorOffers } from '../finance/sponsors';
import { overdraftLimit } from '../finance/weekly';
import { placeDriver } from '../market/transfers';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { seasonPerformance } from '../race/weekend';
import { Rng } from '../rng';
import { playerTeam, teamsInDivision } from '../selectors';
import { ageStaff } from '../staff/market';
import { staffExpectedSalary, staffRating } from '../staff/staff';
import { academyCapacity } from '../team/facilities';
import type {
  DivisionId,
  DivisionSeasonHistory,
  GameState,
  RaceResult,
  RegulationNotice,
  SeasonAward,
  SeasonHistory,
  SeasonReviewSummary,
  Team,
} from '../types';
import { DIVISION_ORDER } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { buildAllCalendars } from './calendar';
import { computeDivisionMoves, type DivisionMove } from './promotion';
import { COMPONENT_INFO } from '../car/car';

export const POOL_TARGET = 255;

/** History keeps every classification but drops qualifying detail and rounds times. */
function compactResult(r: RaceResult): RaceResult {
  return {
    ...r,
    qualifying: [],
    entries: r.entries.map((e) => ({ ...e, time: e.time === null ? null : Math.round(e.time * 10) / 10, bestLap: e.bestLap === null ? null : Math.round(e.bestLap * 1000) / 1000 })),
  };
}

/** Regulation changes for next season are announced mid-season. */
export function announceRegulations(state: GameState): void {
  const key = `regs:${state.season}`;
  if (state.processed[key]) return;
  state.processed[key] = true;
  const rng = Rng.from(state.seed, 'regs', state.season);
  state.nextRegulations = DIVISION_ORDER.map((division) => {
    const roll = rng.next();
    const majorP = division === 'F1' ? 0.2 : 0.14;
    const magnitude: RegulationNotice['magnitude'] = roll < majorP ? 'major' : roll < majorP + 0.45 ? 'minor' : 'stable';
    const focus = magnitude === 'stable' ? null : rng.pick(COMPONENT_KEYS.filter((k) => k !== 'reliability'));
    const text =
      magnitude === 'major'
        ? `Sweeping new technical regulations for ${DIVISIONS[division].name}${focus ? `, focused on ${COMPONENT_INFO[focus].label.toLowerCase()}` : ''}. Expect the order to be shaken up.`
        : magnitude === 'minor'
          ? `Minor rule tweaks for ${DIVISIONS[division].name}${focus ? ` affecting ${COMPONENT_INFO[focus].label.toLowerCase()}` : ''}. Most of this year's development carries over.`
          : `Stable regulations for ${DIVISIONS[division].name}. Teams keep most of their development.`;
    return { division, season: state.season + 1, magnitude, focus, text };
  });
  const pDiv = playerTeam(state).division;
  for (const n of state.nextRegulations) {
    if (n.magnitude === 'stable' && n.division !== pDiv) continue;
    addNews(state, { category: 'regulation', headline: fill(TEMPLATES.regulation[0], { division: DIVISIONS[n.division].name.toUpperCase(), magnitude: n.magnitude.toUpperCase() }), body: n.text, division: n.division, importance: n.division === pDiv ? 2 : 1 });
  }
}

function engineeringStrength(state: GameState, team: Team, target: DivisionId): number {
  const cfg = DIVISIONS[target];
  const mid = (cfg.facilityRange[0] + cfg.facilityRange[1]) / 2;
  const fac = (team.facilities.engineering.level + team.facilities.aeroCenter.level + team.facilities.manufacturing.level + team.facilities.simulator.level) / 4;
  const td = staffRating(state, team, 'technicalDirector');
  return clamp(0.5 + ((fac - mid) / 4) * 0.5 + (td - cfg.staffRatingMean) / 60, 0, 1);
}

function awards(state: GameState, standings: Record<DivisionId, ReturnType<typeof divisionStandings>>): SeasonAward[] {
  const out: SeasonAward[] = [];
  for (const division of [...DIVISION_ORDER].reverse()) {
    const st = standings[division];
    const champ = st.drivers[0];
    const team = st.constructors[0];
    if (champ) out.push({ title: division === 'F1' ? 'World Champion' : `${DIVISIONS[division].name} Champion`, driverId: champ.id, teamId: champ.teamId, description: `${champ.points} points, ${champ.wins} wins` });
    if (team) out.push({ title: division === 'F1' ? "Constructors' World Champion" : `${DIVISIONS[division].name} Teams' Champion`, teamId: team.id, description: `${team.points} points` });
  }
  // Driver of the year: weighted by division.
  let best: { id: string; score: number; text: string } | null = null;
  for (const division of DIVISION_ORDER) {
    const tier = DIVISIONS[division].tier;
    standings[division].drivers.forEach((r, i) => {
      const score = tier * 30 + (21 - i) * 2 + r.wins;
      if (!best || score > best.score) best = { id: r.id, score, text: `P${i + 1} in ${DIVISIONS[division].name}, ${r.wins} wins` };
    });
  }
  if (best) out.push({ title: 'Driver of the Year', driverId: (best as { id: string }).id, description: (best as { text: string }).text });
  // Most improved.
  let improved: { id: string; delta: number } | null = null;
  for (const d of Object.values(state.drivers)) {
    if (d.retired) continue;
    const delta = computeOverall(d.attributes) - d.seasonStartOverall;
    if (!improved || delta > improved.delta) improved = { id: d.id, delta };
  }
  if (improved && improved.delta > 0) out.push({ title: 'Most Improved Driver', driverId: improved.id, description: `+${improved.delta} overall rating this season` });
  // Rookie of the year (first season of racing).
  if (state.season > 1) {
    let rookie: { id: string; score: number; text: string } | null = null;
    for (const division of DIVISION_ORDER) {
      const tier = DIVISIONS[division].tier;
      standings[division].drivers.forEach((r, i) => {
        const d = state.drivers[r.id];
        if (!d || d.career.seasons.length > 0 || r.starts < 3) return;
        const score = tier * 30 + (21 - i) * 2;
        if (!rookie || score > rookie.score) rookie = { id: r.id, score, text: `P${i + 1} in ${DIVISIONS[division].name}` };
      });
    }
    if (rookie) out.push({ title: 'Rookie of the Year', driverId: (rookie as { id: string }).id, description: (rookie as { text: string }).text });
  }
  return out;
}

/** Step 1: close the championship, pay prizes, review the season. */
export function finalizeSeason(state: GameState): SeasonReviewSummary {
  const key = `final:${state.season}`;
  assertRule(!state.processed[key], 'This season has already been finalised.');
  for (const d of DIVISION_ORDER) assertRule(state.calendars[d].every((e) => e.completed), `${DIVISIONS[d].name} still has races to run.`);
  state.processed[key] = true;
  const player = playerTeam(state);
  const standings = Object.fromEntries(DIVISION_ORDER.map((d) => [d, divisionStandings(state, d)])) as Record<DivisionId, ReturnType<typeof divisionStandings>>;
  const historyDivisions = {} as Record<DivisionId, DivisionSeasonHistory>;
  let prizeForPlayer = 0;

  for (const division of DIVISION_ORDER) {
    const st = standings[division];
    const cfg = DIVISIONS[division];
    const champDriver = st.drivers[0]?.id ?? null;
    const champTeam = st.constructors[0]?.id ?? null;
    if (champDriver) {
      const d = state.drivers[champDriver];
      d.career.championships[division] = (d.career.championships[division] ?? 0) + 1;
      const t = st.drivers[0].teamId ? state.teams[st.drivers[0].teamId] : null;
      if (t) t.stats.driverTitles += 1;
    }
    if (champTeam) {
      const t = state.teams[champTeam];
      t.stats.constructorTitles += 1;
      t.stats.constructorTitlesByDivision[division] = (t.stats.constructorTitlesByDivision[division] ?? 0) + 1;
      addNews(state, { category: 'championship', headline: fill(TEMPLATES.constructorChampion[0], { team: t.name.toUpperCase(), division: cfg.name.toUpperCase() }), body: `${t.name} are the ${cfg.name} teams' champions with ${st.constructors[0].points} points.`, division, teamIds: [t.id], importance: t.isPlayer ? 3 : division === 'F1' ? 2 : 1 });
    }
    // Driver season records.
    st.drivers.forEach((r, i) => {
      const d = state.drivers[r.id];
      if (!d) return;
      d.career.seasons.push({ season: state.season, year: state.year, division, teamId: r.teamId ?? null, position: i + 1, points: r.points, wins: r.wins, podiums: r.podiums, poles: r.poles, starts: r.starts, dnfs: r.dnfs, fastestLaps: r.fastestLaps, overall: computeOverall(d.attributes), champion: i === 0 });
    });
    // Prize money.
    st.constructors.forEach((r, i) => {
      const t = state.teams[r.id];
      const prize = cfg.prizeMoney[i] ?? 0;
      postTransaction(state, t, 'prize', prize, `${cfg.name} championship prize: P${i + 1}`);
      if (t.isPlayer) prizeForPlayer = prize;
    });
    const teamNames: Record<string, string> = {};
    for (const t of teamsInDivision(state, division)) teamNames[t.id] = t.name;
    historyDivisions[division] = {
      division,
      driverStandings: st.drivers.map((r) => ({ ...r, positions: [] })),
      constructorStandings: st.constructors.map((r) => ({ ...r, positions: [] })),
      championDriverId: champDriver,
      championTeamId: champTeam,
      results: state.calendars[division].map((e) => state.results[e.id]).filter(Boolean).map(compactResult),
      teamNames,
    };
  }

  // Player sponsors: final evaluation.
  const pStand = standings[player.division].constructors.findIndex((r) => r.id === player.id) + 1;
  const perf = seasonPerformance(state, player);
  const notes: string[] = [];
  for (const deal of [...player.sponsors]) {
    if (deal.startSeason > state.season) continue;
    const prog = expectationProgress(deal.expectation, pStand, perf);
    if (prog.met) {
      deal.satisfaction = clamp(deal.satisfaction + 15, 0, 100);
      if (deal.championshipBonus && pStand <= deal.championshipBonus.position) {
        postTransaction(state, player, 'sponsor', deal.championshipBonus.amount, `${deal.name} championship bonus`);
        notes.push(`${deal.name} paid a championship bonus.`);
      }
    } else {
      deal.satisfaction = clamp(deal.satisfaction - 20, 0, 100);
      player.reputation = clamp(player.reputation - 0.5, 1, 100);
    }
    if (deal.endSeason <= state.season) {
      player.sponsors = player.sponsors.filter((x) => x !== deal);
      if (deal.satisfaction >= 55) {
        const rng = Rng.from(state.seed, 'renewal', deal.name, state.season);
        const offer = generateSponsorOffer(state, player, rng, deal.tier);
        offer.name = deal.name;
        offer.industry = deal.industry;
        offer.perRace = roundMoney(Math.max(offer.perRace, deal.perRace * 1.08));
        offer.expiresAbsWeek += 12;
        state.player.sponsorOffers.push(offer);
        notes.push(`${deal.name} want to renew their partnership.`);
      } else notes.push(`${deal.name}'s contract has ended.`);
    } else if (deal.satisfaction < 25) {
      player.sponsors = player.sponsors.filter((x) => x !== deal);
      player.reputation = clamp(player.reputation - 1, 1, 100);
      notes.push(`${deal.name} terminated their deal after missed expectations.`);
      addNews(state, { category: 'sponsor', headline: `${deal.name.toUpperCase()} PULL OUT OF ${player.name.toUpperCase()} DEAL`, body: `Unhappy with results, ${deal.name} have activated a break clause in their contract.`, teamIds: [player.id], importance: 2 });
    } else if (!prog.met) {
      deal.perRace = roundMoney(deal.perRace * 0.88);
      notes.push(`${deal.name} cut payments by 12% after missed targets.`);
    }
  }

  const seasonAwards = awards(state, standings);
  const board = boardSeasonReview(state);

  // Reputation moves towards what this season's result deserves in this division.
  for (const division of DIVISION_ORDER) {
    const cfg = DIVISIONS[division];
    const spread = (cfg.reputationRange[1] - cfg.reputationRange[0]) / 9;
    standings[division].constructors.forEach((r, i) => {
      const t = state.teams[r.id];
      const target = cfg.typicalReputation + (5.5 - (i + 1)) * spread;
      let next = t.reputation + (target - t.reputation) * 0.35;
      if (i === 0) next += 2;
      t.reputation = clamp(next, 1, 99);
    });
  }

  // Team history (promotion flags set when moves are applied).
  for (const division of DIVISION_ORDER) {
    standings[division].constructors.forEach((r, i) => {
      const t = state.teams[r.id];
      t.history.push({ season: state.season, year: state.year, division, position: i + 1, points: r.points, wins: r.wins, podiums: r.podiums, poles: r.poles, reputation: Math.round(t.reputation), endCash: t.cash, champion: i === 0, promoted: false, relegated: false, drivers: t.raceDrivers.filter((x): x is string => !!x) });
    });
  }

  const entry: SeasonHistory = {
    season: state.season,
    year: state.year,
    divisions: historyDivisions,
    promotions: [],
    relegations: [],
    awards: seasonAwards,
    playerDivision: player.division,
    playerPosition: pStand,
    retirements: [],
  };
  state.history.push(entry);

  const moves = computeDivisionMoves(state);
  const promoted = moves.promotions.find((m) => m.teamId === player.id);
  const relegated = moves.relegations.find((m) => m.teamId === player.id);
  state.player.promotionOffer = promoted ? { to: promoted.to } : null;

  const expiring = Object.values(state.drivers).filter((d) => d.contract?.teamId === player.id && d.contract.endSeason <= state.season && !d.futureContract).map((d) => d.id);
  const summary: SeasonReviewSummary = {
    season: state.season,
    division: player.division,
    position: pStand,
    points: standings[player.division].constructors[pStand - 1]?.points ?? 0,
    champion: pStand === 1,
    promoted: !!promoted,
    relegated: !!relegated,
    newDivision: promoted?.to ?? relegated?.to ?? player.division,
    prizeMoney: prizeForPlayer,
    awards: seasonAwards,
    objectives: board.results,
    boardConfidence: player.boardConfidence,
    expiredDrivers: expiring,
    retirements: [],
    regulation: state.nextRegulations.find((n) => n.division === (promoted?.to ?? relegated?.to ?? player.division)) ?? null,
    notes,
  };
  state.lastSeasonReview = summary;
  state.phase = 'seasonReview';

  // Career-ending outcomes.
  if (canBeSacked(state) && player.boardConfidence < 12) {
    state.phase = 'gameOver';
    state.player.gameOverReason = `The board has lost confidence in your leadership (confidence ${Math.round(player.boardConfidence)}%). You have been dismissed as Team Principal of ${player.name}.`;
  }
  if (DIFFICULTIES[state.settings.difficulty].bankruptcyEndsCareer && player.cash < overdraftLimit(state, player)) {
    state.phase = 'gameOver';
    state.player.gameOverReason = `${player.name} is insolvent. With debts beyond the limit and no rescue available, the team has entered administration.`;
  }
  return summary;
}

function applyMove(state: GameState, move: DivisionMove, promoted: boolean, baselines: Record<DivisionId, number>): void {
  const team = state.teams[move.teamId];
  const rng = Rng.from(state.seed, 'move', team.id, state.season);
  team.division = move.to;
  rebaseCarForDivision(team.car, rng, baselines[move.to], engineeringStrength(state, team, move.to), promoted);
  const last = team.history[team.history.length - 1];
  if (promoted) {
    team.stats.promotions += 1;
    team.reputation = clamp(team.reputation + 5, 1, 99);
    const bonus = DIVISIONS[move.to].promotionBonus;
    if (bonus) postTransaction(state, team, 'promotion', bonus, `Promotion bonus: ${DIVISIONS[move.to].name}`);
    if (last) last.promoted = true;
    const tpl = team.isPlayer && move.to === 'F1' ? TEMPLATES.playerPromotionF1 : TEMPLATES.promotion;
    addNews(state, { category: 'promotion', headline: fill(pickTemplate(state, 'promo' + team.id, tpl), { team: team.name.toUpperCase(), to: DIVISIONS[move.to].name.toUpperCase() }), body: `${team.name} will race in ${DIVISIONS[move.to].name} next season after a successful ${DIVISIONS[move.from].name} campaign.`, division: move.to, teamIds: [team.id], importance: team.isPlayer ? 3 : 1 });
  } else {
    team.stats.relegations += 1;
    team.reputation = clamp(team.reputation - 5, 1, 99);
    if (last) last.relegated = true;
    addNews(state, { category: 'promotion', headline: fill(pickTemplate(state, 'releg' + team.id, TEMPLATES.relegation), { team: team.name.toUpperCase(), to: DIVISIONS[move.to].name.toUpperCase() }), body: `${team.name} finished in the relegation places and drop to ${DIVISIONS[move.to].name}.`, division: move.from, teamIds: [team.id], importance: team.isPlayer ? 3 : 1 });
  }
}

/** Step 2: apply promotions, regulations, contracts, ageing; open the off-season. */
export function beginOffseason(state: GameState, acceptPromotion = true): void {
  assertRule(state.phase === 'seasonReview', 'The season has not been finalised yet.');
  const key = `offseason:${state.season}`;
  assertRule(!state.processed[key], 'The off-season has already started.');
  state.processed[key] = true;
  const player = playerTeam(state);
  const declined = !acceptPromotion && state.player.promotionOffer ? [player.id] : [];
  const moves = computeDivisionMoves(state, declined);
  const hist = state.history[state.history.length - 1];
  hist.promotions = moves.promotions.map((m) => ({ teamId: m.teamId, from: m.from, to: m.to }));
  hist.relegations = moves.relegations.map((m) => ({ teamId: m.teamId, from: m.from, to: m.to }));
  if (declined.length) addNews(state, { category: 'promotion', headline: `${player.name.toUpperCase()} DECLINE PROMOTION`, body: `${player.name} have turned down the chance to move up, choosing to consolidate for another season.`, teamIds: [player.id], importance: 2 });

  // Regulation resets for every car, then rebase movers to their new division.
  const regs = Object.fromEntries(state.nextRegulations.map((n) => [n.division, n])) as Record<DivisionId, RegulationNotice>;
  const movers = new Set([...moves.promotions, ...moves.relegations].map((m) => m.teamId));
  const baselines = {} as Record<DivisionId, number>;
  for (const division of DIVISION_ORDER) {
    const notice = regs[division] ?? { division, season: state.season + 1, magnitude: 'stable', focus: null, text: '' };
    const staying = teamsInDivision(state, division).filter((t) => !movers.has(t.id));
    const all = teamsInDivision(state, division);
    const means = Object.fromEntries(COMPONENT_KEYS.map((k) => [k, all.reduce((s, t) => s + t.car.components[k], 0) / Math.max(1, all.length)])) as Record<(typeof COMPONENT_KEYS)[number], number>;
    for (const t of staying) applyRegulationReset(t.car, Rng.from(state.seed, 'reset', t.id, state.season), notice, 50, means, engineeringStrength(state, t, division));
    baselines[division] = staying.length ? staying.reduce((s, t) => s + overallPace(t.car), 0) / staying.length : 50;
  }
  for (const m of moves.promotions) applyMove(state, m, true, baselines);
  for (const m of moves.relegations) applyMove(state, m, false, baselines);

  // AI owners take surplus profits out of very cash-rich teams (an economic sink,
  // so parachute money from a higher division does not distort a series forever).
  for (const t of Object.values(state.teams)) {
    if (t.isPlayer) continue;
    const B = DIVISIONS[t.division].typicalBudget;
    if (t.cash > B * 1.6) postTransaction(state, t, 'other', -(t.cash - B * 1.6) * 0.3, 'Owner dividend');
  }

  // Finance summaries and ledger reset.
  for (const t of Object.values(state.teams)) {
    const totals = seasonTotals(t, state.season);
    t.financeHistory.push({ season: state.season, division: t.history.at(-1)?.division ?? t.division, revenue: totals.revenue, expenses: totals.expenses, profit: totals.revenue - totals.expenses, endCash: t.cash, byCategory: totals.byCategory });
    if (t.financeHistory.length > 60) t.financeHistory.shift();
    t.ledger = t.isPlayer ? t.ledger.filter((x) => x.season === state.season).slice(-400) : [];
    if (!t.isPlayer) t.rndHistory = t.rndHistory.slice(-8);
    t.cashHistory = [];
  }

  // New season.
  state.season += 1;
  state.year += 1;
  state.regulations = state.nextRegulations;
  state.nextRegulations = [];
  if (state.settings.pendingPointsPreset) {
    state.settings.pointsPreset = state.settings.pendingPointsPreset;
    state.settings.pendingPointsPreset = null;
  }

  const retirements = processContractsAndRetirements(state);
  hist.retirements = retirements;
  if (state.lastSeasonReview) state.lastSeasonReview.retirements = retirements;
  ageDrivers(state);
  ageStaff(state);
  renewStaffContracts(state);
  replenishDriverPool(state);

  state.results = {};
  state.calendars = buildAllCalendars(state, state.season);
  state.player.promotionOffer = null;
  state.player.seasonsPlayed += 1;
  state.player.negotiations = {};
  for (const t of Object.values(state.teams)) t.objectives = [];
  state.phase = 'offseason';
  state.week = -6;
  refreshSponsorOffers(state, true);
}

/** Contracts expire, pre-contracts activate, veterans retire. Returns retired driver ids. */
function processContractsAndRetirements(state: GameState): string[] {
  const season = state.season;
  const player = playerTeam(state);
  const activations: { driverId: string }[] = [];
  for (const d of Object.values(state.drivers)) {
    if (d.retired) continue;
    if (d.contract && d.contract.endSeason < season) {
      const team = state.teams[d.contract.teamId];
      // Academy prospects are kept on rolling deals while young.
      if (d.contract.role === 'academy' && d.age <= 18 && !d.futureContract) {
        d.contract.endSeason = season;
        continue;
      }
      if (team) {
        team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
        if (team.reserveDriverId === d.id) team.reserveDriverId = null;
        team.academyDriverIds = team.academyDriverIds.filter((id) => id !== d.id);
      }
      const leavingPlayer = team?.isPlayer && (!d.futureContract || d.futureContract.teamId !== team.id);
      d.transfers.push({ season, week: 0, fromTeamId: team?.id ?? null, toTeamId: null, fee: 0, type: 'expiry' });
      d.contract = null;
      if (leavingPlayer && team) addNews(state, { category: 'transfer', headline: `${driverName(d).toUpperCase()} LEAVES ${team.name.toUpperCase()}`, body: `${driverName(d)}'s contract has expired${d.futureContract ? ` and they join ${state.teams[d.futureContract.teamId]?.name}` : ''}.`, driverIds: [d.id], teamIds: [team.id], importance: 3 });
    }
    if (d.futureContract && d.futureContract.startSeason <= season && !d.contract) activations.push({ driverId: d.id });
  }
  for (const { driverId } of activations) {
    const d = state.drivers[driverId];
    const c = d.futureContract!;
    const team = state.teams[c.teamId];
    d.futureContract = null;
    if (!team) continue;
    let role = c.role;
    if (role === 'race' && !team.raceDrivers.includes(null)) role = team.reserveDriverId ? 'race' : 'reserve';
    if (role === 'race' && !team.raceDrivers.includes(null)) continue; // no room: becomes a free agent
    c.role = role;
    placeDriver(state, team, d, c);
  }
  // Retirements.
  const retired: string[] = [];
  for (const d of Object.values(state.drivers)) {
    if (d.retired) continue;
    const rng = Rng.from(state.seed, 'retire', d.id, season);
    const ovr = overall(d);
    let p = 0;
    if (d.age >= 34) p = (d.age - 33) * 0.12 + (d.contract ? 0 : 0.25) + (ovr < 55 ? 0.1 : 0);
    if (d.age >= 41) p = 1;
    const unemployed = !d.contract && !d.futureContract;
    if (unemployed && d.age >= 28) p = Math.max(p, 0.3 + (d.age - 28) * 0.05);
    if (unemployed && d.age >= 24 && ovr < 47) p = Math.max(p, 0.5);
    if (unemployed && d.age >= 19 && ovr < 42) p = Math.max(p, 0.6);
    if (unemployed && d.age >= 22 && ovr < 34) p = 1;
    if (d.futureContract && d.age < 41) p *= 0.2;
    if (p <= 0 || !rng.chance(p)) continue;
    const team = d.contract ? state.teams[d.contract.teamId] : null;
    if (team) {
      team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
      if (team.reserveDriverId === d.id) team.reserveDriverId = null;
      team.academyDriverIds = team.academyDriverIds.filter((id) => id !== d.id);
    }
    d.contract = null;
    d.futureContract = null;
    d.retired = true;
    d.retiredSeason = season - 1;
    d.transfers.push({ season, week: 0, fromTeamId: team?.id ?? null, toTeamId: null, fee: 0, type: 'retirement' });
    retired.push(d.id);
    const notable = d.career.wins >= 5 || Object.keys(d.career.championships).length > 0 || team?.id === player.id;
    if (notable) addNews(state, { category: 'milestone', headline: fill(pickTemplate(state, 'ret' + d.id, TEMPLATES.retirement), { driver: driverName(d).toUpperCase() }), body: `${driverName(d)} (${d.age}) retires after ${d.career.starts} starts, ${d.career.wins} wins and ${d.career.podiums} podiums.`, driverIds: [d.id], teamIds: team ? [team.id] : [], importance: team?.id === player.id ? 3 : 1 });
  }
  // Staff contracts.
  for (const s of Object.values(state.staff)) {
    if (!s.contract || s.contract.endSeason >= season) continue;
    const team = state.teams[s.contract.teamId];
    if (team && !team.isPlayer && s.rating >= DIVISIONS[team.division].staffRatingMean - 6 && s.age < 62) {
      s.contract = { teamId: team.id, salary: roundMoney(staffExpectedSalary(s.rating, team.division)), startSeason: season, endSeason: season + 1 };
      continue;
    }
    if (team) {
      team.staff[s.role] = null;
      if (team.isPlayer) addNews(state, { category: 'transfer', headline: `${s.firstName.toUpperCase()} ${s.lastName.toUpperCase()} LEAVES`, body: `${s.firstName} ${s.lastName}'s contract has expired. The role is now vacant.`, teamIds: [team.id], importance: 2 });
    }
    s.contract = null;
  }
  return retired;
}

function renewStaffContracts(state: GameState): void {
  for (const s of Object.values(state.staff)) {
    if (!s.contract) continue;
    const team = state.teams[s.contract.teamId];
    if (team) s.history.push({ season: state.season, teamId: team.id, division: team.division });
  }
}

/** New talent enters the sport every year; the player's academy produces its own trialists. */
function replenishDriverPool(state: GameState): void {
  const rng = Rng.from(state.seed, 'rookies', state.season);
  const ctx = { rng, ids: state, season: state.season };
  const active = () => Object.values(state.drivers).filter((d) => !d.retired).length;
  let prospects = Math.max(10, Math.min(34, 290 - active()));
  while (prospects-- > 0) {
    const p = generateProspect(ctx, rng.range(0, 1.6));
    state.drivers[p.id] = p;
  }
  let guard = 0;
  while (active() < POOL_TARGET && guard++ < 200) {
    const division = rng.weighted<DivisionId>([
      { item: 'F5', weight: 5 },
      { item: 'F4', weight: 4 },
      { item: 'F3', weight: 3 },
      { item: 'F2', weight: 2 },
      { item: 'F1', weight: 1 },
    ]);
    const cfg = DIVISIONS[division];
    const d = generateDriver(ctx, { targetOverall: cfg.driverRatingMean - 3 + rng.normal(0, cfg.driverRatingSd), age: raceAgeFor(rng, division), division });
    state.drivers[d.id] = d;
  }
  // Academy intake for the player: well-scouted trialists.
  const player = playerTeam(state);
  const quality = (player.facilities.trainingAcademy.level - 1) / 3 + staffRating(state, player, 'academyDirector') / 45;
  const count = 1 + Math.floor(player.facilities.trainingAcademy.level / 4);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = generateProspect(ctx, quality);
    state.drivers[p.id] = p;
    state.player.scouting[p.id] = 70 + Math.min(25, player.facilities.scouting.level * 3);
    names.push(`${driverName(p)} (${p.age})`);
  }
  addNews(state, { category: 'academy', headline: 'ACADEMY TRIALISTS IMPRESS', body: `Your academy director recommends signing: ${names.join(', ')}. You have ${academyCapacity(state, player) - player.academyDriverIds.length} free academy place(s). Find them in the Driver Market under Youth Prospects.`, teamIds: [player.id], importance: 2 });
}
