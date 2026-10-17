import { DIFFICULTIES, FINANCIAL_STARTS, PHILOSOPHIES } from './config/difficulty';
import { DIVISIONS } from './config/divisions';
import { teamPosition } from './championship/standings';
import { projectedPosition } from './finance/sponsors';
import { seasonPerformance } from './race/weekend';
import { playerTeam } from './selectors';
import type { BoardObjective, GameState, Team } from './types';
import { clamp } from './util';

export function setSeasonObjectives(state: GameState): BoardObjective[] {
  const team = playerTeam(state);
  team.objectives = objectivesFor(state, team, state.player.philosophy);
  return team.objectives;
}

/** What the board of this team would ask of its principal this season. */
export function objectivesFor(state: GameState, team: Team, philosophy: GameState['player']['philosophy']): BoardObjective[] {
  const cfg = DIVISIONS[team.division];
  const p = projectedPosition(state, team);
  const objectives: BoardObjective[] = [];
  const id = (s: string) => `${state.season}-${s}`;
  // Thresholds scale with the size of the field (ten teams in Classic, up to twenty in a European league).
  const danger = Math.round(cfg.teams * 0.7);
  if (team.division === 'F1') {
    const title = state.mode === 'european' ? `Win the ${cfg.name}` : 'Win the Constructors\' World Championship';
    if (p <= 2) objectives.push({ id: id('title'), description: title, type: 'championship', target: 1, importance: 'critical' });
    else objectives.push({ id: id('pos'), description: `Finish P${Math.max(1, p - 1)} or better in the constructors' championship`, type: 'constructorPosition', target: Math.max(1, p - 1), importance: 'major' });
    if (p >= danger && cfg.relegationSlots > 0) objectives.push({ id: id('stay'), description: `Avoid relegation (finish above the bottom ${cfg.relegationSlots})`, type: 'avoidRelegation', target: cfg.teams - cfg.relegationSlots, importance: 'critical' });
  } else {
    const slots = Math.max(1, cfg.promotionSlots);
    if (p <= slots + 1) objectives.push({ id: id('promo'), description: `Win promotion to ${DIVISIONS[nextDivision(team)].name}`, type: 'promotion', target: slots, importance: 'critical' });
    else objectives.push({ id: id('pos'), description: `Finish P${Math.max(2, p - 1)} or better in the teams' championship`, type: 'constructorPosition', target: Math.max(2, p - 1), importance: 'major' });
    if (cfg.relegationSlots > 0 && p >= danger) objectives.push({ id: id('stay'), description: 'Avoid relegation', type: 'avoidRelegation', target: cfg.teams - cfg.relegationSlots, importance: 'critical' });
  }
  if (p <= 4) objectives.push({ id: id('wins'), description: `Win at least ${p <= 2 ? 3 : 1} race${p <= 2 ? 's' : ''}`, type: 'wins', target: p <= 2 ? 3 : 1, importance: 'minor' });
  else objectives.push({ id: id('pod'), description: 'Score at least one podium', type: 'podiums', target: 1, importance: 'minor' });
  if (philosophy === 'financial') objectives.push({ id: id('profit'), description: 'Make a profit this season', type: 'profit', target: 0, importance: 'major' });
  else objectives.push({ id: id('cash'), description: 'End the season with a positive bank balance', type: 'cashAbove', target: 0, importance: 'major' });
  return objectives;
}

function nextDivision(team: Team) {
  const order = ['F5', 'F4', 'F3', 'F2', 'F1'] as const;
  return order[Math.min(4, DIVISIONS[team.division].tier + 1)];
}

export function objectiveStatus(state: GameState, team: Team, o: BoardObjective, final = false): { met: boolean; text: string } {
  const pos = teamPosition(state, team.id);
  const perf = seasonPerformance(state, team);
  switch (o.type) {
    case 'championship':
      return { met: pos === 1, text: `Currently P${pos}` };
    case 'promotion':
      return { met: pos <= o.target, text: `Currently P${pos}` };
    case 'constructorPosition':
      return { met: pos <= o.target, text: `Currently P${pos}` };
    case 'avoidRelegation':
      return { met: pos <= o.target, text: `Currently P${pos}` };
    case 'wins':
      return { met: perf.wins >= o.target, text: `${perf.wins}/${o.target} wins` };
    case 'podiums':
      return { met: perf.podiums >= o.target, text: `${perf.podiums}/${o.target} podiums` };
    case 'cashAbove':
      return { met: team.cash >= o.target, text: final ? 'Final balance' : 'Current balance' };
    case 'profit': {
      const ledger = team.ledger.filter((t) => t.season === state.season);
      const profit = ledger.reduce((s, t) => s + t.amount, 0);
      return { met: profit >= 0, text: profit >= 0 ? 'In profit' : 'Running at a loss' };
    }
  }
}

const IMPORTANCE_WEIGHT = { critical: 18, major: 10, minor: 4 };

/** Season-end board review. Returns the confidence change. */
export function boardSeasonReview(state: GameState): { delta: number; results: { description: string; met: boolean }[] } {
  const team = playerTeam(state);
  const patience = PHILOSOPHIES[state.player.philosophy].boardPatience / FINANCIAL_STARTS[state.player.financialStart].boardPressure;
  let delta = 0;
  const results = team.objectives.map((o) => {
    const st = objectiveStatus(state, team, o, true);
    const w = IMPORTANCE_WEIGHT[o.importance];
    delta += st.met ? w * 0.7 : -w / patience;
    return { description: o.description, met: st.met };
  });
  team.boardConfidence = clamp(team.boardConfidence + delta, 0, 100);
  return { delta, results };
}

/** Small in-season drift after each race weekend. */
export function boardRaceUpdate(state: GameState): void {
  const team = playerTeam(state);
  const pos = teamPosition(state, team.id);
  const expected = projectedPosition(state, team);
  const patience = PHILOSOPHIES[state.player.philosophy].boardPatience;
  let delta = (expected - pos) * 0.35;
  if (team.cash < 0) delta -= 1.5 / patience;
  team.boardConfidence = clamp(team.boardConfidence + delta, 0, 100);
}

export function canBeSacked(state: GameState): boolean {
  return DIFFICULTIES[state.settings.difficulty].canBeSacked;
}
