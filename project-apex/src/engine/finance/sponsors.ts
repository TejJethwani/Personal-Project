import { DIFFICULTIES, PHILOSOPHIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { ECONOMY_TUNING } from '../config/tuning';
import { SPONSOR_INDUSTRIES, SPONSOR_PREFIXES } from '../data/teams';
import { overallPace } from '../car/car';
import { overall } from '../drivers/ratings';
import { nextId } from '../drivers/generate';
import { Rng } from '../rng';
import { currentAbsWeek } from '../season/calendar';
import { raceDrivers, teamsInDivision } from '../selectors';
import type { DivisionId, GameState, SponsorDeal, SponsorExpectation, SponsorOffer, SponsorRisk, SponsorTier, Team } from '../types';
import { assertRule, clamp, roundMoney } from '../util';
import { addNews } from '../news/news';
import { postTransaction } from './ledger';

export const TIER_LABELS: Record<SponsorTier, string> = { title: 'Title Partner', major: 'Major Partner', minor: 'Official Supplier' };

/** Team strength used for projections: car pace plus driver quality. */
export function teamStrength(state: GameState, team: Team): number {
  const drivers = raceDrivers(state, team);
  const dAvg = drivers.length ? drivers.reduce((s, d) => s + overall(d), 0) / drivers.length : 35;
  return overallPace(team.car) * 1.5 + dAvg;
}

/** Projected constructor position (1-based) from team strength. */
export function projectedPosition(state: GameState, team: Team): number {
  const rivals = teamsInDivision(state, team.division).map((t) => ({ id: t.id, s: teamStrength(state, t) }));
  rivals.sort((a, b) => b.s - a.s);
  return rivals.findIndex((r) => r.id === team.id) + 1;
}

/** Marketing appeal multiplier for a team (≈0.4 .. 2.2). */
export function sponsorAppeal(state: GameState, team: Team): number {
  const cfg = DIVISIONS[team.division];
  const rep = clamp(team.reputation / cfg.typicalReputation, 0.25, 2.5) ** 0.6;
  const last = team.history.at(-1);
  const pos = last && last.division === team.division ? last.position : projectedPosition(state, team);
  const perf = 1.18 - (pos - 1) * 0.04;
  let appeal = rep * perf;
  if (team.isPlayer) appeal *= PHILOSOPHIES[state.player.philosophy].sponsorValue;
  return clamp(appeal, 0.35, 2.4);
}

export function tierPerRaceValue(team: Team, tier: SponsorTier, appeal: number): number {
  const cfg = DIVISIONS[team.division];
  return (cfg.typicalBudget * ECONOMY_TUNING.sponsorShare[tier] * appeal) / cfg.races;
}

/** Income an AI team receives from its (abstracted) sponsor portfolio per race. */
export function aiSponsorIncomePerRace(state: GameState, team: Team): number {
  const appeal = sponsorAppeal(state, team);
  const slots = ECONOMY_TUNING.sponsorSlots;
  const full =
    tierPerRaceValue(team, 'title', appeal) * slots.title +
    tierPerRaceValue(team, 'major', appeal) * slots.major +
    tierPerRaceValue(team, 'minor', appeal) * slots.minor;
  return full * 0.93;
}

function sponsorName(rng: Rng): { name: string; industry: string } {
  const ind = rng.pick(SPONSOR_INDUSTRIES);
  return { name: `${rng.pick(SPONSOR_PREFIXES)} ${rng.pick(ind.suffixes)}`, industry: ind.industry };
}

function expectationFor(rng: Rng, projected: number, risk: SponsorRisk, races: number): SponsorExpectation {
  const roll = rng.next();
  const stretch = risk === 'safe' ? 1 : risk === 'standard' ? 0 : -1;
  if (roll < 0.45 || projected > 7) {
    return { type: 'constructorPosition', target: clamp(projected + stretch + (risk === 'safe' ? 1 : 0), 1, 10) };
  }
  if (roll < 0.7) {
    const podiums = Math.max(1, Math.round(((8 - projected) / 7) * races * 0.5) - stretch);
    return { type: 'podiums', target: podiums };
  }
  if (roll < 0.85 && projected <= 3) {
    return { type: 'wins', target: Math.max(1, Math.round(((4 - projected) / 3) * races * 0.3) - Math.min(0, stretch)) };
  }
  const pts = Math.max(2, Math.round(((11 - projected) / 10) * races * 1.2) - stretch * 2);
  return { type: 'pointsFinishes', target: Math.min(races * 2, pts) };
}

export function describeExpectation(e: SponsorExpectation): string {
  switch (e.type) {
    case 'constructorPosition':
      return `Finish P${e.target} or better in the constructors' championship`;
    case 'podiums':
      return `Score at least ${e.target} podium${e.target === 1 ? '' : 's'}`;
    case 'wins':
      return `Win at least ${e.target} race${e.target === 1 ? '' : 's'}`;
    case 'avgPoints':
      return `Average ${e.target} points per race`;
    case 'pointsFinishes':
      return `Record at least ${e.target} points finishes`;
  }
}

export function generateSponsorOffer(state: GameState, team: Team, rng: Rng, tier: SponsorTier): SponsorOffer {
  const appeal = sponsorAppeal(state, team);
  const cfg = DIVISIONS[team.division];
  const base = tierPerRaceValue(team, tier, appeal) * (team.isPlayer ? DIFFICULTIES[state.settings.difficulty].sponsorIncome : 1) * rng.range(0.85, 1.12);
  const risk: SponsorRisk = rng.weighted([
    { item: 'safe', weight: 4 },
    { item: 'standard', weight: 5 },
    { item: 'highRisk', weight: 2.5 },
  ]);
  const baseShare = risk === 'safe' ? 0.95 : risk === 'standard' ? 0.8 : 0.5;
  const bonusShare = risk === 'safe' ? 0.08 : risk === 'standard' ? 0.25 : 0.7;
  const seasonValue = base * cfg.races;
  const perRace = roundMoney(base * baseShare);
  const { name, industry } = sponsorName(rng);
  const projected = projectedPosition(state, team);
  const expectation = expectationFor(rng, projected, risk, cfg.races);
  const champPos = clamp(projected - (risk === 'highRisk' ? 1 : 0), 1, 10);
  const patience = Math.round(3 * DIFFICULTIES[state.settings.difficulty].sponsorPatience);
  return {
    id: nextId(state, 'sp'),
    name,
    industry,
    tier,
    risk,
    perRace,
    signingBonus: roundMoney(seasonValue * (risk === 'safe' ? 0.04 : 0.08) * rng.range(0.5, 1.2)),
    winBonus: roundMoney((seasonValue * bonusShare) / Math.max(2, cfg.races * 0.3)),
    podiumBonus: roundMoney((seasonValue * bonusShare) / Math.max(4, cfg.races * 0.9)),
    pointsBonus: roundMoney((seasonValue * bonusShare * 0.3) / cfg.races),
    championshipBonus: risk === 'safe' ? null : { position: champPos, amount: roundMoney(seasonValue * (risk === 'highRisk' ? 0.6 : 0.25)) },
    seasons: rng.weighted([
      { item: 1, weight: 4 },
      { item: 2, weight: 4 },
      { item: 3, weight: 2 },
    ]),
    expectation,
    expiresAbsWeek: currentAbsWeek(state) + rng.int(4, 9),
    patience,
    maxValue: seasonValue * rng.range(1.04, 1.22),
  };
}

export function sponsorSlotsUsed(team: Team, season: number): Record<SponsorTier, number> {
  const used: Record<SponsorTier, number> = { title: 0, major: 0, minor: 0 };
  for (const d of team.sponsors) if (d.endSeason >= season) used[d.tier] += 1;
  return used;
}

export function freeSponsorTiers(team: Team, season: number): SponsorTier[] {
  const used = sponsorSlotsUsed(team, season);
  return (['title', 'major', 'minor'] as SponsorTier[]).filter((t) => used[t] < ECONOMY_TUNING.sponsorSlots[t]);
}

/** Keep the player's offer list topped up; called every few weeks. */
export function refreshSponsorOffers(state: GameState, force = false): void {
  const team = state.teams[state.player.teamId];
  const now = currentAbsWeek(state);
  state.player.sponsorOffers = state.player.sponsorOffers.filter((o) => o.expiresAbsWeek >= now && o.patience > 0);
  const rng = Rng.from(state.seed, 'sponsors', state.season, state.week, state.player.sponsorOffers.length);
  const free = freeSponsorTiers(team, state.phase === 'offseason' ? state.season + 1 : state.season);
  const wanted = force ? 5 : 4;
  let guard = 0;
  while (state.player.sponsorOffers.length < wanted && guard++ < 10) {
    const tier = free.length && rng.chance(0.75) ? rng.pick(free) : rng.pick(['title', 'major', 'minor'] as SponsorTier[]);
    state.player.sponsorOffers.push(generateSponsorOffer(state, team, rng, tier));
  }
}

function offerSeasonValue(o: Pick<SponsorOffer, 'perRace'>, races: number): number {
  return o.perRace * races;
}

export function signSponsor(state: GameState, offerId: string): SponsorDeal {
  const team = state.teams[state.player.teamId];
  const offer = state.player.sponsorOffers.find((o) => o.id === offerId);
  assertRule(offer, 'That sponsorship offer is no longer available.');
  const startSeason = state.phase === 'offseason' || state.phase === 'seasonReview' ? state.season + 1 : state.season;
  const used = sponsorSlotsUsed(team, startSeason);
  assertRule(used[offer.tier] < ECONOMY_TUNING.sponsorSlots[offer.tier], `No free ${TIER_LABELS[offer.tier]} slot. End an existing deal first.`);
  const { expiresAbsWeek: _e, patience: _p, maxValue: _m, ...rest } = offer;
  const deal: SponsorDeal = { ...rest, startSeason, endSeason: startSeason + offer.seasons - 1, satisfaction: 60 };
  team.sponsors.push(deal);
  state.player.sponsorOffers = state.player.sponsorOffers.filter((o) => o.id !== offerId);
  postTransaction(state, team, 'sponsor', offer.signingBonus, `${offer.name} signing bonus`);
  return deal;
}

export type SponsorAsk = 'moreBase' | 'moreBonus' | 'longer' | 'shorter';

export interface SponsorNegotiationResult {
  accepted: boolean;
  message: string;
  offer?: SponsorOffer;
}

/** Ask the sponsor to improve the offer. Each ask costs patience. */
export function negotiateSponsor(state: GameState, offerId: string, ask: SponsorAsk): SponsorNegotiationResult {
  const team = state.teams[state.player.teamId];
  const offer = state.player.sponsorOffers.find((o) => o.id === offerId);
  assertRule(offer, 'That sponsorship offer is no longer available.');
  assertRule(offer.patience > 0, `${offer.name} has ended negotiations.`);
  const races = DIVISIONS[team.division].races;
  offer.patience -= 1;
  if (ask === 'longer' || ask === 'shorter') {
    const next = clamp(offer.seasons + (ask === 'longer' ? 1 : -1), 1, 4);
    if (next === offer.seasons) return { accepted: false, message: 'That term is not possible.', offer };
    offer.seasons = next;
    if (ask === 'longer') offer.perRace = roundMoney(offer.perRace * 0.97);
    return { accepted: true, message: `${offer.name} agrees to a ${next}-season term.`, offer };
  }
  const proposed = ask === 'moreBase' ? offer.perRace * 1.1 : offer.perRace;
  const proposedBonusFactor = ask === 'moreBonus' ? 1.2 : 1;
  const value = offerSeasonValue({ perRace: proposed }, races) + (offer.podiumBonus * proposedBonusFactor - offer.podiumBonus) * races * 0.3;
  if (value <= offer.maxValue) {
    offer.perRace = roundMoney(proposed);
    if (ask === 'moreBonus') {
      offer.podiumBonus = roundMoney(offer.podiumBonus * 1.2);
      offer.winBonus = roundMoney(offer.winBonus * 1.2);
      offer.pointsBonus = roundMoney(offer.pointsBonus * 1.2);
    }
    return { accepted: true, message: `${offer.name} accepts the improved terms.`, offer };
  }
  if (offer.patience <= 0) {
    state.player.sponsorOffers = state.player.sponsorOffers.filter((o) => o.id !== offerId);
    return { accepted: false, message: `${offer.name} walks away from the table.` };
  }
  return { accepted: false, message: `${offer.name} refuses. They will not go that high. (${offer.patience} attempt${offer.patience === 1 ? '' : 's'} left)`, offer };
}

export function terminateSponsor(state: GameState, dealName: string): void {
  const team = state.teams[state.player.teamId];
  const deal = team.sponsors.find((d) => d.name === dealName);
  assertRule(deal, 'Unknown sponsor deal.');
  const penalty = deal.perRace * 2;
  team.sponsors = team.sponsors.filter((d) => d !== deal);
  postTransaction(state, team, 'other', -penalty, `${deal.name} early termination`);
  team.reputation = clamp(team.reputation - 0.8, 1, 100);
}

/** Running progress towards a sponsor's expectation for the current season. */
export function expectationProgress(e: SponsorExpectation, position: number, stats: { wins: number; podiums: number; pointsFinishes: number; points: number; races: number }): { met: boolean; text: string; ratio: number } {
  switch (e.type) {
    case 'constructorPosition':
      return { met: position <= e.target, text: `Currently P${position} (target P${e.target})`, ratio: clamp((11 - position) / (11 - e.target), 0, 1.5) };
    case 'podiums':
      return { met: stats.podiums >= e.target, text: `${stats.podiums}/${e.target} podiums`, ratio: stats.podiums / e.target };
    case 'wins':
      return { met: stats.wins >= e.target, text: `${stats.wins}/${e.target} wins`, ratio: stats.wins / e.target };
    case 'avgPoints': {
      const avg = stats.races ? stats.points / stats.races : 0;
      return { met: avg >= e.target, text: `${avg.toFixed(1)} avg points (target ${e.target})`, ratio: avg / e.target };
    }
    case 'pointsFinishes':
      return { met: stats.pointsFinishes >= e.target, text: `${stats.pointsFinishes}/${e.target} points finishes`, ratio: stats.pointsFinishes / e.target };
  }
}

/**
 * Sponsors renegotiate when the team changes series: promotion clauses lift
 * per-race payments and bonuses (part of the way to the new series' rates) and
 * soften targets for the step up; relegation cuts them to the lower series.
 */
export function rescaleSponsorDeals(state: GameState, team: Team, from: DivisionId, to: DivisionId): void {
  const perRaceScale = (d: DivisionId) => DIVISIONS[d].typicalBudget / DIVISIONS[d].races;
  const ratio = perRaceScale(to) / perRaceScale(from);
  const promoted = ratio > 1;
  const factor = promoted ? 1 + (ratio - 1) * 0.6 : ratio;
  let changed = 0;
  for (const d of team.sponsors) {
    if (d.endSeason < state.season + 1) continue;
    d.perRace = roundMoney(d.perRace * factor);
    d.winBonus = roundMoney(d.winBonus * factor);
    d.podiumBonus = roundMoney(d.podiumBonus * factor);
    d.pointsBonus = roundMoney(d.pointsBonus * factor);
    if (d.championshipBonus) d.championshipBonus = { ...d.championshipBonus, amount: roundMoney(d.championshipBonus.amount * factor) };
    if (promoted) {
      const e = d.expectation;
      d.expectation = e.type === 'constructorPosition' ? { ...e, target: Math.max(e.target, 6) } : { ...e, target: Math.round(e.target * 0.5 * 10) / 10 };
    }
    changed++;
  }
  if (changed && team.isPlayer) {
    addNews(state, {
      category: 'sponsor',
      headline: promoted ? 'SPONSORS STEP UP AFTER PROMOTION' : 'SPONSORS CUT BACK AFTER RELEGATION',
      body: promoted
        ? `${changed} sponsor deal${changed > 1 ? 's' : ''} carry over into ${DIVISIONS[to].name} with payments raised by ${Math.round((factor - 1) * 100)}% and targets eased for the step up.`
        : `${changed} sponsor deal${changed > 1 ? 's' : ''} carry over into ${DIVISIONS[to].name}, with payments cut to ${Math.round(factor * 100)}% of their old value.`,
      teamIds: [team.id],
      importance: 2,
    });
  }
}
