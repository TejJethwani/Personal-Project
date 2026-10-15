import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { canStartProject, engineeringCapacity, quoteProject, startProject, diminishing } from '../car/rnd';
import { freeSponsorTiers, negotiateSponsor, refreshSponsorOffers, signSponsor } from '../finance/sponsors';
import { applyWeeklyFinances, financialForecast } from '../finance/weekly';
import { finalizeSeason } from '../season/seasonEnd';
import { playerTeam } from '../selectors';
import { canUpgradeFacility, facilityUpgradeCost, startFacilityUpgrade } from '../team/facilities';
import { makeGame, playSeason } from './helpers';

describe('finances', () => {
  it('the ledger reconciles with the bank balance', () => {
    const s = makeGame(40);
    const team = playerTeam(s);
    const start = team.cash;
    s.phase = 'season';
    for (let i = 0; i < 5; i++) {
      s.week++;
      applyWeeklyFinances(s, team);
    }
    const sum = team.ledger.reduce((a, t) => a + t.amount, 0);
    expect(team.cash).toBe(start + sum);
    expect(team.cash).toBeLessThan(start);
  });

  it('salaries reduce the money available for development', () => {
    const a = makeGame(41);
    const b = makeGame(41);
    a.phase = b.phase = 'season';
    const ta = playerTeam(a);
    const tb = playerTeam(b);
    for (const id of tb.raceDrivers) b.drivers[id!].contract!.salary *= 10;
    for (let i = 0; i < 10; i++) {
      a.week++;
      b.week++;
      applyWeeklyFinances(a, ta);
      applyWeeklyFinances(b, tb);
    }
    expect(tb.cash).toBeLessThan(ta.cash);
    expect(financialForecast(b, tb).projectedEndCash).toBeLessThan(financialForecast(a, ta).projectedEndCash);
  });

  it('sponsor slots are limited and negotiations consume patience', () => {
    const s = makeGame(42);
    refreshSponsorOffers(s, true);
    const team = playerTeam(s);
    const offer = s.player.sponsorOffers[0];
    const before = offer.patience;
    negotiateSponsor(s, offer.id, 'moreBase');
    const still = s.player.sponsorOffers.find((o) => o.id === offer.id);
    if (still) expect(still.patience).toBe(before - 1);
    // Fill all title slots then expect a refusal.
    let guard = 0;
    while (freeSponsorTiers(team, s.season).includes('title') && guard++ < 20) {
      const t = s.player.sponsorOffers.find((o) => o.tier === 'title');
      if (!t) {
        refreshSponsorOffers(s, true);
        s.week += 1;
        continue;
      }
      signSponsor(s, t.id);
    }
    const extra = { ...s.player.sponsorOffers[0], id: 'manual', tier: 'title' as const };
    s.player.sponsorOffers.push(extra);
    expect(() => signSponsor(s, 'manual')).toThrow(/slot/);
  });

  it('prize money cannot be collected twice', () => {
    const s = makeGame(43);
    playSeason(s);
    expect(s.phase).toBe('seasonReview');
    expect(() => finalizeSeason(s)).toThrow();
    const prizeTx = playerTeam(s).ledger.filter((t) => t.category === 'prize');
    expect(prizeTx).toHaveLength(1);
  });
});

describe('car development', () => {
  it('charges the cost, uses capacity and completes after the stated weeks', () => {
    const s = makeGame(50);
    s.phase = 'season';
    const team = playerTeam(s);
    const q = quoteProject(s, team, 'aerodynamics', 'minor');
    const cash = team.cash;
    const before = team.car.components.aerodynamics;
    startProject(s, team.id, 'aerodynamics', 'minor');
    expect(team.cash).toBe(cash - q.cost);
    expect(() => startProject(s, team.id, 'aerodynamics', 'minor')).toThrow(/already running/);
    // Fill capacity.
    const cap = engineeringCapacity(s, team);
    let used = 1;
    for (const k of ['chassis', 'braking', 'suspension', 'powerUnit'] as const) {
      if (used >= cap) break;
      startProject(s, team.id, k, 'minor');
      used++;
    }
    expect(canStartProject(s, team, 'cooling', 'minor').ok).toBe(false);
    for (let w = 0; w < q.weeks + 4; w++) {
      s.week++;
      // progress via the weekly processor for R&D only
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    }
    return import('../car/rnd').then(({ progressProjects }) => {
      for (let w = 0; w < q.weeks + 4; w++) progressProjects(s, team);
      expect(team.rnd).toHaveLength(0);
      expect(team.rndHistory.length).toBeGreaterThanOrEqual(1);
      expect(team.car.components.aerodynamics).toBeGreaterThan(before - 0.0001);
    });
  });

  it('has diminishing returns', () => {
    expect(diminishing(80, 0)).toBeLessThan(diminishing(50, 0));
    expect(diminishing(50, 3)).toBeLessThan(diminishing(50, 0));
  });

  it('facility upgrades cost money and take time', () => {
    const s = makeGame(51);
    const team = playerTeam(s);
    team.cash = 10_000_000;
    const cost = facilityUpgradeCost(team.facilities.simulator.level + 1);
    startFacilityUpgrade(s, team.id, 'simulator');
    expect(team.cash).toBe(10_000_000 - cost);
    expect(team.facilities.simulator.upgrade).not.toBeNull();
    expect(canUpgradeFacility(team, 'simulator').ok).toBe(false);
    expect(DIVISIONS.F1.typicalBudget).toBeGreaterThan(DIVISIONS.F5.typicalBudget * 50);
  });
});
