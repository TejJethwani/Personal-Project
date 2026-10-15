import { PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { nextId } from '../drivers/generate';
import { postTransaction } from '../finance/ledger';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { Rng, stableNoise } from '../rng';
import { hasSpecialization, staffRating } from '../staff/staff';
import type { ComponentKey, GameState, RnDCompletion, RnDOutcome, RnDPhase, RnDProject, RnDScale, Team } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { COMPONENT_INFO, COMPONENT_KEYS } from './car';

export const RND_SCALES: RnDScale[] = ['minor', 'major', 'radical'];
export const RND_SCALE_LABELS: Record<RnDScale, string> = { minor: 'Minor update', major: 'Major package', radical: 'Radical concept' };

const AERO_GROUP: ComponentKey[] = ['aerodynamics', 'cornering', 'straightLine', 'cooling'];
const MECH_GROUP: ComponentKey[] = ['chassis', 'suspension', 'braking', 'tireEfficiency'];
const PU_GROUP: ComponentKey[] = ['powerUnit', 'reliability'];

export function engineeringCapacity(state: GameState, team: Team): number {
  const td = staffRating(state, team, 'technicalDirector');
  return 1 + Math.floor(team.facilities.engineering.level / 2) + (td >= 70 ? 1 : 0);
}

export function capacityUsed(team: Team): number {
  return team.rnd.reduce((s, p) => s + p.capacity, 0);
}

function tdSpecBonus(state: GameState, team: Team, component: ComponentKey): number {
  if (AERO_GROUP.includes(component) && hasSpecialization(state, team, 'technicalDirector', 'Aerodynamics')) return 1.1;
  if (MECH_GROUP.includes(component) && hasSpecialization(state, team, 'technicalDirector', 'Mechanical')) return 1.1;
  if (component === 'powerUnit' && hasSpecialization(state, team, 'technicalDirector', 'Power Unit')) return 1.12;
  if (component === 'reliability' && hasSpecialization(state, team, 'technicalDirector', 'Reliability')) return 1.12;
  return 1;
}

function facilityMultiplier(team: Team, component: ComponentKey): number {
  if (AERO_GROUP.includes(component)) return 0.82 + team.facilities.aeroCenter.level * 0.045;
  if (PU_GROUP.includes(component)) return 0.82 + (team.facilities.engineering.level + team.facilities.manufacturing.level) * 0.0225;
  return 0.82 + team.facilities.engineering.level * 0.045;
}

export interface ProjectQuote {
  component: ComponentKey;
  scale: RnDScale;
  cost: number;
  weeks: number;
  expectedGain: number;
  risk: number;
  capacity: number;
}

/** Diminishing returns: high ratings and repeated upgrades in one season yield less. */
export function diminishing(rating: number, devLevel: number): number {
  return ((100 - clamp(rating, 0, 99)) / 50) ** 1.15 / (1 + 0.32 * devLevel);
}

export function quoteProject(state: GameState, team: Team, component: ComponentKey, scale: RnDScale): ProjectQuote {
  const cfg = ECONOMY_TUNING.rnd[scale];
  const div = DIVISIONS[team.division];
  const td = staffRating(state, team, 'technicalDirector');
  const philosophy = team.isPlayer ? PHILOSOPHIES[state.player.philosophy] : null;
  const manufacturing = team.facilities.manufacturing.level;
  const cost = roundMoney(cfg.cost * div.rndCostScale * (1.15 - manufacturing * 0.03));
  const weeks = Math.max(2, Math.round(cfg.weeks * (1.18 - manufacturing * 0.025 - td / 450) * (philosophy?.rndDuration ?? 1)));
  const efficiency = (0.68 + td / 190) * facilityMultiplier(team, component) * tdSpecBonus(state, team, component) * (philosophy?.rndGain ?? 1);
  const expectedGain = Math.round(cfg.gain * efficiency * diminishing(team.car.components[component], team.car.developmentLevel[component]) * 100) / 100;
  const risk = clamp(cfg.risk * (1.3 - manufacturing * 0.04 - td / 320), 0.02, 0.6);
  return { component, scale, cost, weeks, expectedGain, risk, capacity: cfg.capacity };
}

export function canStartProject(state: GameState, team: Team, component: ComponentKey, scale: RnDScale): { ok: boolean; reason?: string; quote: ProjectQuote } {
  const quote = quoteProject(state, team, component, scale);
  if (state.phase === 'seasonReview' || state.phase === 'gameOver') return { ok: false, reason: 'Development is frozen until the new season.', quote };
  if (team.rnd.some((p) => p.component === component)) return { ok: false, reason: `A ${COMPONENT_INFO[component].label} project is already running.`, quote };
  if (capacityUsed(team) + quote.capacity > engineeringCapacity(state, team)) return { ok: false, reason: 'Not enough engineering capacity. Upgrade the Engineering Department or wait for a project to finish.', quote };
  if (team.cash < quote.cost) return { ok: false, reason: 'Not enough cash.', quote };
  return { ok: true, quote };
}

export function startProject(state: GameState, teamId: string, component: ComponentKey, scale: RnDScale): RnDProject {
  const team = state.teams[teamId];
  assertRule(team, 'Unknown team.');
  assertRule(COMPONENT_KEYS.includes(component), 'Unknown component.');
  const check = canStartProject(state, team, component, scale);
  assertRule(check.ok, check.reason ?? 'Cannot start project.');
  const q = check.quote;
  const project: RnDProject = {
    id: nextId(state, 'rd'),
    component,
    scale,
    cost: q.cost,
    weeksTotal: q.weeks,
    weeksElapsed: 0,
    delayWeeks: 0,
    expectedGain: q.expectedGain,
    capacity: q.capacity,
    startedSeason: state.season,
    startedWeek: state.week,
  };
  team.rnd.push(project);
  postTransaction(state, team, 'development', -q.cost, `${RND_SCALE_LABELS[scale]}: ${COMPONENT_INFO[component].label}`);
  return project;
}

export function cancelProject(state: GameState, teamId: string, projectId: string): void {
  const team = state.teams[teamId];
  const p = team?.rnd.find((x) => x.id === projectId);
  assertRule(p, 'Unknown project.');
  // Sunk costs are lost; capacity is freed.
  team.rnd = team.rnd.filter((x) => x.id !== projectId);
}

export function projectPhase(p: RnDProject): RnDPhase {
  const f = p.weeksElapsed / (p.weeksTotal + p.delayWeeks);
  if (f < 0.4) return 'design';
  if (f < 0.85) return 'manufacture';
  return 'testing';
}

/** Weekly progress of R&D; resolves completed projects. */
export function progressProjects(state: GameState, team: Team): RnDCompletion[] {
  const done: RnDCompletion[] = [];
  const td = staffRating(state, team, 'technicalDirector');
  for (const p of [...team.rnd]) {
    p.weeksElapsed += 1;
    const rng = Rng.from(state.seed, 'rnd', p.id, p.weeksElapsed);
    const q = quoteProject(state, team, p.component, p.scale);
    // Manufacturing hiccups can delay a project once.
    if (p.delayWeeks === 0 && projectPhase(p) === 'manufacture' && rng.chance(q.risk * 0.18)) {
      p.delayWeeks = rng.int(1, 3);
      if (team.isPlayer) {
        addNews(state, { category: 'engineering', headline: `${COMPONENT_INFO[p.component].label.toUpperCase()} PROJECT DELAYED`, body: `Manufacturing problems have pushed back the ${COMPONENT_INFO[p.component].label} ${RND_SCALE_LABELS[p.scale].toLowerCase()} by ${p.delayWeeks} week${p.delayWeeks > 1 ? 's' : ''}.`, teamIds: [team.id], importance: 2 });
      }
    }
    if (p.weeksElapsed < p.weeksTotal + p.delayWeeks) continue;
    // Testing reveals the outcome.
    const breakthroughP = 0.07 + (p.scale === 'radical' ? 0.05 : 0) + td / 2000;
    const roll = rng.next();
    let outcome: RnDOutcome = 'success';
    let factor = rng.range(0.8, 1.15);
    let reliabilityLoss = 0;
    if (roll < breakthroughP) {
      outcome = 'breakthrough';
      factor = rng.range(1.5, 2.1);
    } else if (roll < breakthroughP + q.risk * 0.5 && p.component !== 'reliability') {
      outcome = 'reliabilityCompromise';
      factor = rng.range(0.7, 1.0);
      reliabilityLoss = Math.round(rng.range(1, 3.5) * (p.scale === 'minor' ? 0.6 : p.scale === 'major' ? 1 : 1.5) * 10) / 10;
    } else if (roll < breakthroughP + q.risk * 1.5) {
      outcome = 'underwhelming';
      factor = rng.range(0.15, 0.5);
    }
    // Gains are re-evaluated at completion against the current car (rivals' rules changes, other upgrades).
    const gain = Math.round(q.expectedGain * factor * 100) / 100;
    const car = team.car;
    car.components[p.component] = Math.round(clamp(car.components[p.component] + gain, 1, 99) * 100) / 100;
    if (reliabilityLoss > 0) car.components.reliability = Math.round(clamp(car.components.reliability - reliabilityLoss, 1, 99) * 100) / 100;
    car.developmentLevel[p.component] += p.scale === 'minor' ? 1 : p.scale === 'major' ? 1.6 : 2.2;
    team.rnd = team.rnd.filter((x) => x.id !== p.id);
    const completion: RnDCompletion = { id: p.id, component: p.component, scale: p.scale, outcome, gain, reliabilityLoss, season: state.season, week: state.week, cost: p.cost };
    team.rndHistory.push(completion);
    if (team.rndHistory.length > 60) team.rndHistory.shift();
    done.push(completion);
    if (outcome === 'breakthrough' && (team.isPlayer || team.division === 'F1' || team.division === state.teams[state.player.teamId].division)) {
      addNews(state, { category: 'engineering', headline: fill(pickTemplate(state, 'bt', TEMPLATES.breakthrough), { team: team.name.toUpperCase(), component: COMPONENT_INFO[p.component].label.toUpperCase() }), body: `${team.name}'s ${COMPONENT_INFO[p.component].label} project has exceeded every target, delivering a gain of +${gain.toFixed(1)}.`, division: team.division, teamIds: [team.id], importance: team.isPlayer ? 3 : 1 });
    }
    if ((outcome === 'reliabilityCompromise' || outcome === 'underwhelming') && team.isPlayer) {
      addNews(state, {
        category: 'engineering',
        headline: fill(pickTemplate(state, 'rf', TEMPLATES.rndFailure), { team: team.name.toUpperCase(), component: COMPONENT_INFO[p.component].label.toUpperCase() }),
        body:
          outcome === 'reliabilityCompromise'
            ? `The new ${COMPONENT_INFO[p.component].label} parts bring +${gain.toFixed(1)} performance but testing revealed fragility: reliability -${reliabilityLoss.toFixed(1)}.`
            : `The ${COMPONENT_INFO[p.component].label} upgrade delivered only +${gain.toFixed(1)} (expected +${q.expectedGain.toFixed(1)}).`,
        teamIds: [team.id],
        importance: 2,
      });
    }
  }
  return done;
}

/**
 * What the player believes about a rival's car. Uncertainty shrinks with a
 * better engineering and strategy organisation (data analysis).
 */
export function estimateRivalComponent(state: GameState, viewer: Team, target: Team, component: ComponentKey): { value: number; uncertainty: number } {
  if (viewer.id === target.id) return { value: target.car.components[component], uncertainty: 0 };
  const uncertainty = Math.round((2 + 10 * (1 - (viewer.facilities.engineering.level + viewer.facilities.strategy.level) / 20)) * 10) / 10;
  const noise = stableNoise(state.seed, viewer.id, target.id, component, state.season, Math.floor(Math.max(0, state.week) / 4));
  return { value: Math.round((target.car.components[component] + noise * uncertainty * 0.6) * 10) / 10, uncertainty };
}
