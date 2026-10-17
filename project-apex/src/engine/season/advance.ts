import { aiStaff, aiTry, aiWeekly } from '../ai/manager';
import { aiBidForPlayerDrivers, aiFillSeats, aiOffseasonRound } from '../ai/market';
import { boardRaceUpdate, canBeSacked, setSeasonObjectives } from '../board';
import { DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { progressProjects } from '../car/rnd';
import { divisionStandings } from '../championship/standings';
import { developDrivers } from '../drivers/development';
import { driverName, overall } from '../drivers/ratings';
import { maybeGenerateOpportunity } from '../events/opportunities';
import { postTransaction } from '../finance/ledger';
import { refreshSponsorOffers } from '../finance/sponsors';
import { applyWeeklyFinances, chargeEntryFee, overdraftLimit } from '../finance/weekly';
import { progressScouting } from '../market/scouting';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { closeWeekend, eventLineup, lineupIssues, simulateEventAutomatically, startPlayerWeekend } from '../race/weekend';
import { Rng } from '../rng';
import { allDrivers, allTeams, playerTeam, raceDrivers } from '../selectors';
import { FACILITY_INFO, progressFacilities } from '../team/facilities';
import type { GameState } from '../types';
import { DIVISION_ORDER } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { nextEventFor } from './calendar';
import { applyRuleset } from '../config/ruleset';
import { euroCompetitionsDone, euroSeasonStart, euroWeekRacing, euroWeekStart, nextPlayerEvent } from '../europe/season';
import { announceRegulations, finalizeSeason } from './seasonEnd';
import { sandboxTopUp } from '../finance/boost';
import { checkAchievements } from '../achievements';
import { ensureSeasonChallenges } from './challenges';
import { SEASON_TWISTS, seasonTwists } from './twists';

export interface AdvanceResult {
  stoppedFor: 'race' | 'seasonEnd' | 'decision' | 'preseason' | 'seasonStart' | 'week' | 'gameOver';
  message: string;
}

export function advanceBlocker(state: GameState): string | null {
  if (state.phase === 'gameOver') return 'Your career is over.';
  if (state.phase === 'weekend') return 'Finish the race weekend first.';
  if (state.phase === 'seasonReview') return 'Review the season and continue to the off-season.';
  if (state.phase === 'preseason' || state.phase === 'season') {
    const team = playerTeam(state);
    const lineup = eventLineup(state, team);
    const missing = lineup.find((s) => !s.driverId);
    if (missing) return `${missing.reason ?? 'A seat is empty'}: you need two available race drivers. Sign a race or reserve driver in the Driver Market.`;
  }
  if (state.phase === 'season') {
    const ev = nextPlayerEvent(state);
    if (ev && ev.week <= state.week) return 'Your race weekend is waiting in the Race Center.';
  }
  return null;
}

/** Advance the world by one week (or one off-season round). */
export function advanceWeek(state: GameState): AdvanceResult {
  applyRuleset(state);
  const blocker = advanceBlocker(state);
  assertRule(!blocker, blocker ?? '');
  if (state.phase === 'offseason') return offseasonWeek(state);
  if (state.phase === 'preseason') return startSeason(state);
  // In-season week.
  state.week += 1;
  processWeek(state);
  if (state.phase === 'gameOver') return { stoppedFor: 'gameOver', message: state.player.gameOverReason ?? 'Game over' };
  const ev = nextPlayerEvent(state);
  if (ev && ev.week <= state.week) {
    startPlayerWeekend(state, ev.id);
    return { stoppedFor: 'race', message: `${ev.euro && ev.euro.competition !== 'league' ? ev.euro.label : 'Race weekend'}: ${state.circuits[ev.circuitId].name}` };
  }
  if (allEventsDone(state) && state.week >= ECONOMY_TUNING.lastRaceWeek) {
    finalizeSeason(state);
    return { stoppedFor: 'seasonEnd', message: 'The season is over.' };
  }
  return { stoppedFor: 'week', message: `Week ${state.week}` };
}

function allEventsDone(state: GameState): boolean {
  return DIVISION_ORDER.every((d) => state.calendars[d].every((e) => e.completed)) && euroCompetitionsDone(state);
}

/** Keep advancing until something needs the player's attention. */
export function advanceToNextEvent(state: GameState): AdvanceResult {
  const opportunitiesBefore = state.player.opportunities.length;
  let guard = 0;
  let res: AdvanceResult = { stoppedFor: 'week', message: '' };
  while (guard++ < 60) {
    res = advanceWeek(state);
    if (res.stoppedFor !== 'week') return res;
    if (state.player.opportunities.length > opportunitiesBefore) return { stoppedFor: 'decision', message: 'A decision needs your attention.' };
    if (advanceBlocker(state)) return { stoppedFor: 'decision', message: advanceBlocker(state)! };
  }
  return res;
}

function startSeason(state: GameState): AdvanceResult {
  const team = playerTeam(state);
  assertRule(eventLineup(state, team).every((s) => !!s.driverId), 'You need two race drivers before the season can start.');
  for (const t of allTeams(state)) {
    if (!t.isPlayer) aiTry(() => aiFillSeats(state, t, 5, true));
    chargeEntryFee(state, t);
  }
  if (team.objectives.length === 0) setSeasonObjectives(state);
  ensureSeasonChallenges(state);
  state.phase = 'season';
  state.week = 0;
  if (state.europe) euroSeasonStart(state);
  const twists = seasonTwists(state, team.division);
  addNews(state, {
    category: 'regulation',
    headline: `SEASON TWIST${twists.length > 1 ? 'S' : ''}: ${twists.map((t) => SEASON_TWISTS[t].name.toUpperCase()).join(' + ')}`,
    body: `${DIVISIONS[team.division].name} season ${state.season}: ${twists.map((t) => `${SEASON_TWISTS[t].name}. ${SEASON_TWISTS[t].summary}`).join(' ')}`,
    division: team.division,
    teamIds: [team.id],
    importance: 3,
  });
  addNews(state, { category: 'board', headline: `SEASON ${state.season} BEGINS`, body: `${team.name} start the ${DIVISIONS[team.division].name} season. Board objectives: ${team.objectives.map((o) => o.description).join('; ')}.`, teamIds: [team.id], importance: 2 });
  seasonPredictions(state);
  return advanceWeek(state).stoppedFor === 'race' ? { stoppedFor: 'race', message: 'First race weekend!' } : { stoppedFor: 'seasonStart', message: `Season ${state.season} is under way.` };
}

function offseasonWeek(state: GameState): AdvanceResult {
  const round = state.week + 7;
  aiTry(() => aiOffseasonRound(state, round));
  if (round % 2 === 0) for (const t of allTeams(state)) if (!t.isPlayer && t.cash > 0) aiTry(() => aiStaff(state, t, Rng.from(state.seed, 'offStaff', t.id, state.season, round)));
  state.week += 1;
  if (state.week % 2 === 0) refreshSponsorOffers(state);
  if (state.week >= 0) {
    // Pre-season: every AI seat is filled, objectives are set.
    for (let pass = 0; pass < 3; pass++) {
      const short = allTeams(state).filter((t) => !t.isPlayer && t.raceDrivers.includes(null));
      if (!short.length) break;
      for (const t of short) aiTry(() => aiFillSeats(state, t, 6, true));
    }
    state.week = 0;
    state.phase = 'preseason';
    setSeasonObjectives(state);
    ensureSeasonChallenges(state);
    refreshSponsorOffers(state, true);
    const issues = lineupIssues(state, playerTeam(state));
    return { stoppedFor: 'preseason', message: issues.length ? `Pre-season. ${issues.join(' ')}` : 'Pre-season: final preparations before the first race.' };
  }
  return { stoppedFor: 'week', message: `Off-season: ${-state.week} week(s) until pre-season.` };
}

/** Everything that happens in the world during one in-season week. */
export function processWeek(state: GameState): void {
  const player = playerTeam(state);
  sandboxTopUp(state);
  checkAchievements(state);
  if (state.europe) euroWeekStart(state);
  for (const team of allTeams(state)) {
    applyWeeklyFinances(state, team);
    const done = progressFacilities(team);
    if (team.isPlayer) for (const k of done) addNews(state, { category: 'engineering', headline: `${FACILITY_INFO[k].label.toUpperCase()} UPGRADE COMPLETE`, body: `The ${FACILITY_INFO[k].label} is now level ${team.facilities[k].level}.`, teamIds: [team.id], importance: 2 });
    const projects = progressProjects(state, team);
    if (team.isPlayer) {
      for (const p of projects) {
        if (p.outcome === 'success') addNews(state, { category: 'engineering', headline: `UPGRADE DELIVERED: ${p.component.toUpperCase()}`, body: `The new parts pass testing: +${p.gain.toFixed(1)} ${p.component}.`, teamIds: [team.id], importance: 2 });
      }
    }
  }
  progressScouting(state);
  for (const d of allDrivers(state)) {
    if (d.injury) {
      d.injury.weeksRemaining -= 1;
      if (d.injury.weeksRemaining <= 0) {
        d.injury = null;
        if (d.contract?.teamId === player.id) addNews(state, { category: 'injury', headline: `${driverName(d).toUpperCase()} FIT AGAIN`, body: `${driverName(d)} has recovered and is available for selection.`, driverIds: [d.id], teamIds: [player.id], importance: 2 });
      }
    }
  }
  for (const team of allTeams(state)) aiWeekly(state, team);

  // Races in other divisions this week.
  for (const division of DIVISION_ORDER) {
    if (division === player.division) continue;
    for (const ev of state.calendars[division]) if (ev.week === state.week && !ev.completed) simulateEventAutomatically(state, ev);
  }
  if (state.europe) euroWeekRacing(state);

  if (state.week % 4 === 0) monthly(state);
  if (state.week === 30) announceRegulations(state);
  maybeGenerateOpportunity(state);
  aiBidForPlayerDrivers(state);
  previewNextRace(state);
  checkPlayerFinances(state);
  player.cashHistory.push({ week: state.week, cash: player.cash });
}

function monthly(state: GameState): void {
  // Races driven in the last four weeks build experience.
  const races: Record<string, number> = {};
  for (const division of DIVISION_ORDER) {
    for (const ev of state.calendars[division]) {
      if (!ev.completed || ev.week <= state.week - 4) continue;
      const r = state.results[ev.id];
      if (r) for (const e of r.entries) races[e.driverId] = (races[e.driverId] ?? 0) + 1;
    }
  }
  developDrivers(state, races);
  refreshSponsorOffers(state);
  driverInterview(state);
  contractReminders(state);
  titleFights(state);
}

/** Title fights and rivalries emerge from the standings. */
function titleFights(state: GameState): void {
  const player = playerTeam(state);
  for (const division of DIVISION_ORDER) {
    if (division !== 'F1' && division !== player.division) continue;
    const done = state.calendars[division].filter((e) => e.completed).length;
    if (done < Math.ceil(state.calendars[division].length / 2)) continue;
    const key = `rivalry:${state.season}:${division}`;
    if (state.processed[key]) continue;
    const [a, b] = divisionStandings(state, division).drivers;
    if (!a || !b || a.points === 0 || a.points - b.points > Math.max(8, a.points * 0.1)) continue;
    state.processed[key] = true;
    const da = state.drivers[a.id];
    const db = state.drivers[b.id];
    const sameTeam = a.teamId && a.teamId === b.teamId;
    addNews(state, {
      category: 'championship',
      headline: sameTeam ? `CIVIL WAR AT ${state.teams[a.teamId!].name.toUpperCase()}: ${da.lastName.toUpperCase()} VS ${db.lastName.toUpperCase()}` : `TITLE FIGHT: ${driverName(da).toUpperCase()} VS ${driverName(db).toUpperCase()}`,
      body: `Only ${a.points - b.points} points separate ${driverName(da)} and ${driverName(db)} at the top of the ${DIVISIONS[division].name} standings with ${state.calendars[division].length - done} rounds to go.${sameTeam ? ' The team-mates are barely speaking.' : ''}`,
      division,
      driverIds: [a.id, b.id],
      importance: a.teamId === player.id || b.teamId === player.id ? 3 : 2,
    });
  }
}

function driverInterview(state: GameState): void {
  const team = playerTeam(state);
  const rng = Rng.from(state.seed, 'interview', state.season, state.week);
  const drivers = raceDrivers(state, team);
  if (!drivers.length || !rng.chance(0.6)) return;
  const d = rng.pick(drivers);
  const pool = d.morale >= 68 ? TEMPLATES.quotesHappy : d.morale <= 38 ? TEMPLATES.quotesUnhappy : TEMPLATES.quotesNeutral;
  const quote = rng.pick(pool);
  addNews(state, { category: 'interview', headline: fill(TEMPLATES.interviewHappy[0], { quote: quote.split('.')[0], driver: driverName(d) }), body: `${driverName(d)} spoke to the media this week: "${quote}." Morale: ${Math.round(d.morale)}/100.`, driverIds: [d.id], teamIds: [team.id], importance: d.morale <= 38 ? 2 : 1 });
}

function contractReminders(state: GameState): void {
  const team = playerTeam(state);
  if (state.week < 20) return;
  for (const d of raceDrivers(state, team)) {
    if (d.contract && d.contract.endSeason <= state.season && !d.futureContract) {
      const key = `remind:${d.id}:${state.season}:${state.week >= 32 ? 2 : 1}`;
      if (state.processed[key]) continue;
      state.processed[key] = true;
      addNews(state, { category: 'board', headline: `CONTRACT: ${driverName(d).toUpperCase()} OUT OF CONTRACT AT SEASON END`, body: `${driverName(d)}'s deal expires after this season. Rival teams may sign them to a pre-contract. Open talks from the Drivers page.`, driverIds: [d.id], teamIds: [team.id], importance: 2 });
    }
  }
}

function previewNextRace(state: GameState): void {
  const team = playerTeam(state);
  const ev = nextEventFor(state, team.division);
  if (!ev || ev.week !== state.week + 1) return;
  const key = `preview:${ev.id}`;
  if (state.processed[key]) return;
  state.processed[key] = true;
  const circuit = state.circuits[ev.circuitId];
  const st = divisionStandings(state, team.division);
  const leader = st.drivers[0];
  const second = st.drivers[1];
  const leaderName = leader && leader.points > 0 ? driverName(state.drivers[leader.id]) : 'nobody yet';
  addNews(state, {
    category: 'preview',
    headline: fill(pickTemplate(state, 'prev', TEMPLATES.preview), { division: DIVISIONS[team.division].name.toUpperCase(), circuit: circuit.name.toUpperCase(), circuitShort: circuit.location.toUpperCase(), leader: leaderName.toUpperCase() }),
    body: fill(pickTemplate(state, 'prevb', TEMPLATES.previewBody), { leader: leaderName, division: DIVISIONS[team.division].name, margin: leader && second ? leader.points - second.points : 0, circuit: circuit.name, character: circuit.character, round: ev.round, points: leader?.points ?? 0 }),
    division: team.division,
    importance: 1,
  });
}

function seasonPredictions(state: GameState): void {
  for (const division of DIVISION_ORDER) {
    if (division !== 'F1' && division !== playerTeam(state).division) continue;
    const teams = allTeams(state).filter((t) => t.division === division);
    const ranked = teams.flatMap((t) => raceDrivers(state, t).map((d) => ({ d, score: overall(d) + t.car.components.aerodynamics * 0.4 + t.car.components.powerUnit * 0.4 + t.car.components.chassis * 0.4 })));
    ranked.sort((a, b) => b.score - a.score);
    if (!ranked[0]) continue;
    addNews(state, { category: 'championship', headline: fill(TEMPLATES.prediction[0], { leader: driverName(ranked[0].d).toUpperCase(), division: DIVISIONS[division].name.toUpperCase() }), body: `Pre-season testing suggests ${driverName(ranked[0].d)} is the favourite, ahead of ${ranked[1] ? driverName(ranked[1].d) : 'the field'}${ranked[2] ? ` and ${driverName(ranked[2].d)}` : ''}.`, division, importance: 1 });
  }
}

/** Overdraft handling: bailouts, administration and career-ending insolvency. */
function checkPlayerFinances(state: GameState): void {
  const team = playerTeam(state);
  const diff = DIFFICULTIES[state.settings.difficulty];
  const limit = overdraftLimit(state, team);
  if (team.cash >= 0) {
    team.bankruptWarnings = 0;
    return;
  }
  if (team.cash >= limit) {
    if (team.bankruptWarnings === 0) {
      team.bankruptWarnings = 1;
      addNews(state, { category: 'finance', headline: fill(pickTemplate(state, 'crisis', TEMPLATES.financialCrisis), { team: team.name.toUpperCase() }), body: `The bank balance is negative. Overdraft interest is now charged weekly. Limit before crisis: ${Math.round(-limit / 1000)}k.`, teamIds: [team.id], importance: 3 });
    }
    return;
  }
  if (state.player.bailoutsUsed < diff.bailouts) {
    state.player.bailoutsUsed += 1;
    const injection = roundMoney(-team.cash + DIVISIONS[team.division].typicalBudget * 0.12);
    postTransaction(state, team, 'investor', injection, 'Emergency rescue loan');
    team.boardConfidence = clamp(team.boardConfidence - 20, 0, 100);
    team.reputation = clamp(team.reputation - 3, 1, 100);
    addNews(state, { category: 'finance', headline: fill(TEMPLATES.rescue[0], { team: team.name.toUpperCase() }), body: `The board arranged an emergency injection of ${Math.round(injection / 1000)}k to keep ${team.name} alive. ${Number.isFinite(diff.bailouts) ? `Rescues remaining: ${diff.bailouts - state.player.bailoutsUsed}.` : ''}`, teamIds: [team.id], importance: 3 });
    return;
  }
  if (diff.bankruptcyEndsCareer) {
    state.phase = 'gameOver';
    state.player.gameOverReason = `${team.name} has run out of money. With no rescue available, the team has collapsed into administration.`;
    return;
  }
  team.boardConfidence = clamp(team.boardConfidence - 6, 0, 100);
  if (canBeSacked(state) && team.boardConfidence < 10) {
    state.phase = 'gameOver';
    state.player.gameOverReason = `With debts spiralling and no confidence left, the board has dismissed you.`;
  }
}

/** Complete the player's weekend and update the board's view. */
export function finishWeekendAndContinue(state: GameState): void {
  applyRuleset(state);
  closeWeekend(state);
  boardRaceUpdate(state);
  // European League weeks can hold several races: the next one starts straight away.
  if (state.europe) {
    const next = nextPlayerEvent(state);
    if (next && next.week <= state.week) {
      startPlayerWeekend(state, next.id);
      return;
    }
  }
  if (allEventsDone(state)) {
    // Fast-forward any idle weeks to the end of the season.
    finalizeSeason(state);
  }
}

/** Holiday mode: the assistant manages race weekends until the season ends. */
export function holidayToSeasonEnd(state: GameState, autoplayWeekend: (s: GameState) => void): void {
  let guard = 0;
  while ((state.phase === 'season' || state.phase === 'weekend' || state.phase === 'preseason') && guard++ < 200) {
    if (state.phase === 'weekend') {
      autoplayWeekend(state);
      finishWeekendAndContinue(state);
      continue;
    }
    const b = advanceBlocker(state);
    if (b) break;
    advanceWeek(state);
  }
}

export { simulateEventAutomatically };
