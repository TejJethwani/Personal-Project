import { DIFFICULTIES, PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { nextId } from '../drivers/generate';
import { postTransaction } from '../finance/ledger';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { twistEffects } from '../season/twists';
import { Rng, stableNoise } from '../rng';
import { hasSpecialization, staffRating } from '../staff/staff';
import type { ComponentKey, CustomDelivery, GameState, RnDApproach, RnDCompletion, RnDOptions, RnDOutcome, RnDPhase, RnDProject, RnDScale, RnDTimeline, Team } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { carRating, COMPONENT_INFO, COMPONENT_KEYS, inRaceFrame } from './car';
import { allTeams } from '../selectors';

export const RND_SCALES: RnDScale[] = ['quick', 'minor', 'major', 'radical'];
export const RND_SCALE_LABELS: Record<RnDScale, string> = { quick: 'Quick fix', minor: 'Minor update', major: 'Major package', radical: 'Radical concept' };
export const RND_APPROACHES: RnDApproach[] = ['safe', 'balanced', 'ambitious'];
export const RND_APPROACH_LABELS: Record<RnDApproach, string> = { safe: 'Safe', balanced: 'Balanced', ambitious: 'Ambitious' };
export const RND_TIMELINES: RnDTimeline[] = ['normal', 'rush'];
export const RND_TIMELINE_LABELS: Record<RnDTimeline, string> = { normal: 'Normal', rush: 'Rush' };
export const DEFAULT_RND_OPTIONS: RnDOptions = { approach: 'balanced', timeline: 'normal' };

const AERO_GROUP: ComponentKey[] = ['aerodynamics', 'cornering', 'straightLine', 'cooling'];
const MECH_GROUP: ComponentKey[] = ['chassis', 'suspension', 'braking', 'tireEfficiency'];
const PU_GROUP: ComponentKey[] = ['powerUnit', 'reliability'];

export function engineeringCapacity(state: GameState, team: Team): number {
  const td = staffRating(state, team, 'technicalDirector');
  return 1 + Math.floor((team.facilities.engineering.level + 1) / 2) + (td >= 70 ? 1 : 0);
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
  approach: RnDApproach;
  timeline: RnDTimeline;
  cost: number;
  weeks: number;
  expectedGain: number;
  risk: number;
  capacity: number;
}

/** Average rating of a component across the team's series. */
export function fieldComponentMean(state: GameState, team: Team, component: ComponentKey): number {
  const field = allTeams(state).filter((t) => t.division === team.division);
  return field.reduce((s, t) => s + t.car.components[component], 0) / Math.max(1, field.length);
}

/**
 * Diminishing returns. Catching up with the field is easier than stretching a
 * lead (`lead` = rating above the series average), gains fade gradually above
 * 65 towards the top of the scale, and repeated upgrades to the same
 * component this season return less.
 */
export function diminishing(rating: number, devLevel: number, lead = 0): number {
  const relative = clamp(1 - lead / 45, 0.4, 1.15);
  const limit = clamp((100 - rating) / 35, 0.03, 1);
  return (relative * limit) / (1 + 0.4 * devLevel);
}

/**
 * How much rating a team gets from its engineering: Technical Director,
 * facilities, specialisms, philosophy and the season's twists. The player's
 * car keeps every upgrade on every difficulty, so only AI teams get the bigger
 * upgrades that make up for winter rule changes on Realistic and Hardcore.
 */
function developmentEfficiency(state: GameState, team: Team, component: ComponentKey): number {
  const td = staffRating(state, team, 'technicalDirector');
  const philosophy = team.isPlayer ? PHILOSOPHIES[state.player.philosophy] : null;
  const upgradeScale = team.isPlayer ? 1 : DIFFICULTIES[state.settings.difficulty].carDevelopment.upgradeScale;
  return (0.68 + td / 190) * facilityMultiplier(team, component) * tdSpecBonus(state, team, component) * (philosophy?.rndGain ?? 1) * upgradeScale * twistEffects(state, team.division).rndGain;
}

/** What R&D money buys in this team's series, with its manufacturing and the season's twists. */
function developmentCostScale(state: GameState, team: Team): number {
  return DIVISIONS[team.division].rndCostScale * (1.15 - team.facilities.manufacturing.level * 0.03) * twistEffects(state, team.division).rndCost;
}

/** How long a build takes against the standard schedule (manufacturing, Technical Director, philosophy). */
function developmentDuration(state: GameState, team: Team): number {
  const td = staffRating(state, team, 'technicalDirector');
  const philosophy = team.isPlayer ? PHILOSOPHIES[state.player.philosophy] : null;
  return (1.18 - team.facilities.manufacturing.level * 0.025 - td / 450) * (philosophy?.rndDuration ?? 1);
}

/**
 * The rating diminishing returns are judged at. A lower tier on a one-scale
 * ruleset tapers as if its own field were the top of the scale, so a whole
 * league cannot develop its way into the one above.
 */
function taperRating(team: Team, rating: number): number {
  return Math.max(rating, inRaceFrame(rating, team.division));
}

export function quoteProject(state: GameState, team: Team, component: ComponentKey, scale: RnDScale, options: RnDOptions = DEFAULT_RND_OPTIONS): ProjectQuote {
  const cfg = ECONOMY_TUNING.rnd[scale];
  const approach = ECONOMY_TUNING.rndApproach[options.approach];
  const timeline = ECONOMY_TUNING.rndTimeline[options.timeline];
  const td = staffRating(state, team, 'technicalDirector');
  const manufacturing = team.facilities.manufacturing.level;
  const cost = roundMoney(cfg.cost * developmentCostScale(state, team) * approach.cost * timeline.cost);
  const weeks = Math.max(1, Math.round(cfg.weeks * developmentDuration(state, team) * timeline.weeks));
  const rating = team.car.components[component];
  const lead = rating - fieldComponentMean(state, team, component);
  const expectedGain = Math.round(cfg.gain * approach.gain * developmentEfficiency(state, team, component) * diminishing(taperRating(team, rating), team.car.developmentLevel[component], lead) * 100) / 100;
  const risk = clamp(cfg.risk * (1.3 - manufacturing * 0.04 - td / 320) * approach.risk * timeline.risk, 0.02, 0.75);
  return { component, scale, approach: options.approach, timeline: options.timeline, cost, weeks, expectedGain, risk, capacity: cfg.capacity };
}

/** Whether a component is already being developed (by a package or a custom upgrade). */
export function componentInDevelopment(team: Team, component: ComponentKey): boolean {
  return team.rnd.some((p) => (p.custom ? (p.custom.gains[component] ?? 0) > 0 : p.component === component));
}

export function canStartProject(state: GameState, team: Team, component: ComponentKey, scale: RnDScale, options: RnDOptions = DEFAULT_RND_OPTIONS): { ok: boolean; reason?: string; quote: ProjectQuote } {
  const quote = quoteProject(state, team, component, scale, options);
  if (state.phase === 'seasonReview' || state.phase === 'gameOver') return { ok: false, reason: 'Development is frozen until the new season.', quote };
  if (componentInDevelopment(team, component)) return { ok: false, reason: `A ${COMPONENT_INFO[component].label} project is already running.`, quote };
  if (capacityUsed(team) + quote.capacity > engineeringCapacity(state, team)) return { ok: false, reason: 'Not enough engineering capacity. Upgrade the Engineering Department or wait for a project to finish.', quote };
  if (team.cash < quote.cost) return { ok: false, reason: 'Not enough cash.', quote };
  return { ok: true, quote };
}

export function startProject(state: GameState, teamId: string, component: ComponentKey, scale: RnDScale, options: RnDOptions = DEFAULT_RND_OPTIONS): RnDProject {
  const team = state.teams[teamId];
  assertRule(team, 'Unknown team.');
  assertRule(COMPONENT_KEYS.includes(component), 'Unknown component.');
  assertRule(RND_SCALES.includes(scale) && RND_APPROACHES.includes(options.approach) && RND_TIMELINES.includes(options.timeline), 'Unknown project options.');
  const check = canStartProject(state, team, component, scale, options);
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
    approach: options.approach,
    timeline: options.timeline,
  };
  team.rnd.push(project);
  postTransaction(state, team, 'development', -q.cost, `${RND_SCALE_LABELS[scale]} (${RND_APPROACH_LABELS[options.approach].toLowerCase()}${options.timeline === 'rush' ? ', rushed' : ''}): ${COMPONENT_INFO[component].label}`);
  return project;
}

/** Options a stored project was started with (older saves default to balanced, normal). */
export function projectOptions(p: RnDProject): RnDOptions {
  return { approach: p.approach ?? 'balanced', timeline: p.timeline ?? 'normal' };
}

export function cancelProject(state: GameState, teamId: string, projectId: string): void {
  const team = state.teams[teamId];
  const p = team?.rnd.find((x) => x.id === projectId);
  assertRule(p, 'Unknown project.');
  // Sunk costs are lost; capacity is freed.
  team.rnd = team.rnd.filter((x) => x.id !== projectId);
}

// ---------------------------------------------------------------------------
// Custom upgrades
// ---------------------------------------------------------------------------

export const CUSTOM_DELIVERIES: CustomDelivery[] = ['standard', 'express'];
export const CUSTOM_DELIVERY_LABELS: Record<CustomDelivery, string> = { standard: 'Standard', express: 'Express' };

export interface CustomUpgradeQuote {
  /** Points each component will gain (asks beyond 99 or the per-project limit are trimmed). */
  gains: Partial<Record<ComponentKey, number>>;
  totalPoints: number;
  cost: number;
  weeks: number;
  capacity: number;
  delivery: CustomDelivery;
  /** Car rating once the upgrade is fitted. */
  ratingAfter: number;
}

/**
 * Price and schedule for raising any set of components by exact amounts in one
 * project. It costs what the same points would as a run of minor updates (each
 * step priced at the car as it stands when that step starts), plus a small
 * premium for delivering them exactly: the same diminishing returns apply, so
 * stretching a lead, very strong components and heavy development this season
 * all cost more per point.
 */
export function quoteCustomUpgrade(state: GameState, team: Team, requested: Partial<Record<ComponentKey, number>>, delivery: CustomDelivery = 'standard'): CustomUpgradeQuote {
  const tune = ECONOMY_TUNING.rndCustom;
  const ref = ECONOMY_TUNING.rnd.minor;
  const perPoint = (developmentCostScale(state, team) * ref.cost * tune.premium) / ref.gain;
  const loadPerPoint = ref.load / ref.gain;
  const gains: Partial<Record<ComponentKey, number>> = {};
  const after = { ...team.car.components };
  let cost = 0;
  let biggest = 0;
  for (const k of COMPONENT_KEYS) {
    const current = team.car.components[k];
    const gain = Math.round(clamp(Math.min(requested[k] ?? 0, tune.maxGain), 0, 99 - current) * 100) / 100;
    if (gain <= 0) continue;
    gains[k] = gain;
    after[k] = current + gain;
    biggest = Math.max(biggest, gain);
    const efficiency = developmentEfficiency(state, team, k);
    const mean = fieldComponentMean(state, team, k);
    let rating = current;
    let load = team.car.developmentLevel[k];
    for (let left = gain; left > 1e-9; ) {
      const step = Math.min(ref.gain, left);
      cost += (step * perPoint) / (efficiency * diminishing(taperRating(team, rating), load, rating - mean));
      rating += step;
      load += step * loadPerPoint;
      left -= step;
    }
  }
  const express = delivery === 'express';
  const weeks = express ? 1 : Math.max(1, Math.round((1 + biggest / tune.pointsPerWeek) * developmentDuration(state, team)));
  return {
    gains,
    totalPoints: Math.round(Object.values(gains).reduce((a, b) => a + (b ?? 0), 0) * 100) / 100,
    cost: roundMoney(cost * (express ? tune.expressCost : 1)),
    weeks,
    capacity: 1,
    delivery,
    ratingAfter: carRating({ components: after, developmentLevel: team.car.developmentLevel }),
  };
}

export function canStartCustomUpgrade(state: GameState, team: Team, requested: Partial<Record<ComponentKey, number>>, delivery: CustomDelivery = 'standard'): { ok: boolean; reason?: string; quote: CustomUpgradeQuote } {
  const quote = quoteCustomUpgrade(state, team, requested, delivery);
  if (state.phase === 'seasonReview' || state.phase === 'gameOver') return { ok: false, reason: 'Development is frozen until the new season.', quote };
  if (quote.totalPoints <= 0) return { ok: false, reason: 'Choose at least one component with room to improve.', quote };
  const busy = (Object.keys(quote.gains) as ComponentKey[]).filter((k) => componentInDevelopment(team, k));
  if (busy.length) return { ok: false, reason: `Already being developed: ${busy.map((k) => COMPONENT_INFO[k].label).join(', ')}.`, quote };
  if (capacityUsed(team) + quote.capacity > engineeringCapacity(state, team)) return { ok: false, reason: 'Not enough engineering capacity. Upgrade the Engineering Department or wait for a project to finish.', quote };
  if (team.cash < quote.cost) return { ok: false, reason: 'Not enough cash.', quote };
  return { ok: true, quote };
}

/** The biggest equal amount (in steps of `step`) the team can afford on these components. */
export function maxAffordableCustomAmount(state: GameState, team: Team, components: ComponentKey[], delivery: CustomDelivery = 'standard', step = 0.5): number {
  const ask = (amount: number) => Object.fromEntries(components.map((k) => [k, amount]));
  const fits = (amount: number) => quoteCustomUpgrade(state, team, ask(amount), delivery).cost <= team.cash;
  let lo = 0;
  let hi = Math.round(ECONOMY_TUNING.rndCustom.maxGain / step);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid * step)) lo = mid;
    else hi = mid - 1;
  }
  return lo * step;
}

export function startCustomUpgrade(state: GameState, teamId: string, requested: Partial<Record<ComponentKey, number>>, delivery: CustomDelivery = 'standard'): RnDProject {
  const team = state.teams[teamId];
  assertRule(team, 'Unknown team.');
  assertRule(CUSTOM_DELIVERIES.includes(delivery), 'Unknown delivery option.');
  for (const [k, v] of Object.entries(requested)) assertRule(COMPONENT_KEYS.includes(k as ComponentKey) && Number.isFinite(v) && (v ?? 0) >= 0, 'Invalid upgrade amounts.');
  const check = canStartCustomUpgrade(state, team, requested, delivery);
  assertRule(check.ok, check.reason ?? 'Cannot start the upgrade.');
  const q = check.quote;
  const keys = Object.keys(q.gains) as ComponentKey[];
  const project: RnDProject = {
    id: nextId(state, 'rd'),
    component: keys[0],
    scale: 'minor',
    cost: q.cost,
    weeksTotal: q.weeks,
    weeksElapsed: 0,
    delayWeeks: 0,
    expectedGain: Math.max(...keys.map((k) => q.gains[k] ?? 0)),
    capacity: q.capacity,
    startedSeason: state.season,
    startedWeek: state.week,
    custom: { gains: q.gains, delivery },
  };
  team.rnd.push(project);
  postTransaction(state, team, 'development', -q.cost, `Custom upgrade${delivery === 'express' ? ' (express)' : ''}: ${customSummary(q.gains)}`);
  return project;
}

/** "Aerodynamics +5.0" or "10 components, +5.0 each" or "3 components, +2.0 to +6.5". */
export function customSummary(gains: Partial<Record<ComponentKey, number>>): string {
  const entries = (Object.entries(gains) as [ComponentKey, number][]).filter(([, v]) => v > 0);
  if (entries.length === 1) return `${COMPONENT_INFO[entries[0][0]].label} +${entries[0][1].toFixed(1)}`;
  const values = entries.map(([, v]) => v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return `${entries.length} components, ${Math.abs(hi - lo) < 0.05 ? `+${hi.toFixed(1)} each` : `+${lo.toFixed(1)} to +${hi.toFixed(1)}`}`;
}

function completeCustomUpgrade(state: GameState, team: Team, p: RnDProject): RnDCompletion {
  const gains = p.custom!.gains;
  const car = team.car;
  for (const [k, gain] of Object.entries(gains) as [ComponentKey, number][]) {
    car.components[k] = Math.round(clamp(car.components[k] + gain, 1, 99) * 100) / 100;
    car.developmentLevel[k] += (gain * ECONOMY_TUNING.rnd.minor.load) / ECONOMY_TUNING.rnd.minor.gain;
  }
  team.rnd = team.rnd.filter((x) => x.id !== p.id);
  const completion: RnDCompletion = { id: p.id, component: p.component, scale: p.scale, outcome: 'success', gain: p.expectedGain, reliabilityLoss: 0, season: state.season, week: state.week, cost: p.cost, custom: gains };
  team.rndHistory.push(completion);
  if (team.rndHistory.length > 60) team.rndHistory.shift();
  if (team.isPlayer) {
    addNews(state, { category: 'engineering', headline: 'CUSTOM UPGRADE FITTED', body: `The custom upgrade is on the car: ${customSummary(gains)}. Car rating now ${carRating(car).toFixed(1)}.`, teamIds: [team.id], importance: 2 });
  }
  return completion;
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
    if (p.custom) {
      // Custom upgrades are built to a fixed specification: no delays, no surprises.
      if (p.weeksElapsed >= p.weeksTotal) done.push(completeCustomUpgrade(state, team, p));
      continue;
    }
    const rng = Rng.from(state.seed, 'rnd', p.id, p.weeksElapsed);
    const q = quoteProject(state, team, p.component, p.scale, projectOptions(p));
    // Manufacturing hiccups can delay a project once.
    if (p.delayWeeks === 0 && projectPhase(p) === 'manufacture' && rng.chance(q.risk * 0.18)) {
      p.delayWeeks = rng.int(1, 3);
      if (team.isPlayer) {
        addNews(state, { category: 'engineering', headline: `${COMPONENT_INFO[p.component].label.toUpperCase()} PROJECT DELAYED`, body: `Manufacturing problems have pushed back the ${COMPONENT_INFO[p.component].label} ${RND_SCALE_LABELS[p.scale].toLowerCase()} by ${p.delayWeeks} week${p.delayWeeks > 1 ? 's' : ''}.`, teamIds: [team.id], importance: 2 });
      }
    }
    if (p.weeksElapsed < p.weeksTotal + p.delayWeeks) continue;
    // Testing reveals the outcome.
    const breakthroughP = (0.07 + (p.scale === 'radical' ? 0.05 : 0) + td / 2000) * ECONOMY_TUNING.rndApproach[projectOptions(p).approach].breakthrough;
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
      reliabilityLoss = Math.round(rng.range(0.5, 1.75) * (p.scale === 'quick' ? 0.4 : p.scale === 'minor' ? 0.6 : p.scale === 'major' ? 1 : 1.5) * 10) / 10;
      // The player's car never loses rating: testing finds the weakness before the parts are fitted, so the gain falls short instead.
      if (team.isPlayer) {
        outcome = 'underwhelming';
        reliabilityLoss = 0;
      }
    } else if (roll < breakthroughP + q.risk * 1.5) {
      outcome = 'underwhelming';
      factor = rng.range(0.15, 0.5);
    }
    // Gains are re-evaluated at completion against the current car (rivals' rules changes, other upgrades).
    const gain = Math.round(q.expectedGain * factor * 100) / 100;
    const car = team.car;
    car.components[p.component] = Math.round(clamp(car.components[p.component] + gain, 1, 99) * 100) / 100;
    if (reliabilityLoss > 0) car.components.reliability = Math.round(clamp(car.components.reliability - reliabilityLoss, 1, 99) * 100) / 100;
    car.developmentLevel[p.component] += ECONOMY_TUNING.rnd[p.scale].load;
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
