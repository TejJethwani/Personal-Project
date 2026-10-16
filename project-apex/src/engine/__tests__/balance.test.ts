import { describe, expect, it } from 'vitest';
import { applyRegulationReset, COMPONENT_KEYS, finishDevelopmentBoost, generateCar, rebaseCarForDivision } from '../car/car';
import { DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { quoteProject, RND_SCALES, startProject } from '../car/rnd';
import { generateSponsorOffer, rescaleSponsorDeals, signSponsor } from '../finance/sponsors';
import { simulateEventRace } from '../race/weekend';
import { Rng } from '../rng';
import { beginOffseason } from '../season/seasonEnd';
import { playerTeam, teamsInDivision } from '../selectors';
import { STAFF_POOL_PER_ROLE, STAFF_ROLES, staffExpectedSalary } from '../staff/staff';
import type { ComponentKey, GameState, RegulationNotice } from '../types';
import { makeGame, playOffseason, playSeason } from './helpers';

const flat = (v: number) => Object.fromEntries(COMPONENT_KEYS.map((k) => [k, v])) as Record<ComponentKey, number>;

describe('car development carries over', () => {
  it('on Casual and Standard no car loses rating over the winter', () => {
    const s = makeGame(301, { difficulty: 'casual' });
    playSeason(s);
    const before = new Map(teamsInDivision(s, 'F5').map((t) => [t.id, { ...t.car.components }]));
    beginOffseason(s, false);
    for (const t of teamsInDivision(s, 'F5')) {
      const old = before.get(t.id);
      if (!old) continue; // relegated in from F4: rebuilt to F5 rules
      for (const k of COMPONENT_KEYS) expect(t.car.components[k]).toBeGreaterThanOrEqual(old[k]);
    }
  });

  it('a car far ahead of its field keeps every point and its lead over the winter', () => {
    const notice: RegulationNotice = { division: 'F1', season: 2, magnitude: 'major', focus: 'aerodynamics', text: '' };
    const fast = generateCar(new Rng(1), 50, 0);
    const slow = generateCar(new Rng(2), 50, 0);
    fast.components = flat(90);
    slow.components = flat(70);
    const mean = flat(76);
    const rules = DIFFICULTIES.standard.carDevelopment;
    applyRegulationReset(fast, new Rng(3), notice, mean, 0.4, rules);
    applyRegulationReset(slow, new Rng(4), notice, mean, 0.4, rules);
    for (const k of COMPONENT_KEYS) {
      expect(fast.components[k]).toBeGreaterThanOrEqual(90);
      expect(slow.components[k]).toBeGreaterThanOrEqual(70);
      expect(fast.components[k]).toBeGreaterThan(slow.components[k]);
    }
  });
});

describe('car development by difficulty', () => {
  const pushAbove = (s: GameState, rating: number) => {
    for (const t of teamsInDivision(s, 'F5')) for (const k of COMPONENT_KEYS) t.car.components[k] = rating + (t.isPlayer ? 0 : (t.name.length % 5) - 2);
  };

  it('on Standard every car keeps its rating over the winter, however high', () => {
    const s = makeGame(306, { difficulty: 'standard' });
    playSeason(s);
    pushAbove(s, 85);
    const before = new Map(teamsInDivision(s, 'F5').map((t) => [t.id, { ...t.car.components }]));
    beginOffseason(s, false);
    for (const t of teamsInDivision(s, 'F5')) {
      const old = before.get(t.id);
      if (!old) continue;
      for (const k of COMPONENT_KEYS) expect(t.car.components[k]).toBeGreaterThanOrEqual(old[k]);
    }
  });

  it('on Hardcore winter rule changes take most development away from every team', () => {
    const s = makeGame(307, { difficulty: 'hardcore' });
    playSeason(s);
    pushAbove(s, 64);
    const me = playerTeam(s);
    const staying = teamsInDivision(s, 'F5').map((t) => t.id);
    beginOffseason(s, false);
    const after = staying.map((id) => s.teams[id]).filter((t) => t.division === 'F5');
    const mean = after.reduce((x, t) => x + t.car.components.chassis, 0) / after.length;
    expect(mean).toBeLessThan(58);
    if (me.division === 'F5') expect(me.car.components.chassis).toBeLessThan(64);
  });

  it('upgrades are bigger on the difficulties where they do not last', () => {
    const casual = makeGame(308, { difficulty: 'casual' });
    const hardcore = makeGame(308, { difficulty: 'hardcore' });
    const gain = (s: GameState) => quoteProject(s, playerTeam(s), 'aerodynamics', 'major').expectedGain;
    expect(gain(hardcore)).toBeGreaterThan(gain(casual) * 1.2);
  });
});

describe('promotion, boosts and upgrade costs', () => {
  it('on Casual and Standard a promoted car keeps its whole advantage over the field', () => {
    const car = generateCar(new Rng(5), 50, 0);
    car.components = flat(58);
    rebaseCarForDivision(car, new Rng(6), flat(50), flat(60), 0.5, true, DIFFICULTIES.standard.carDevelopment.promotionCarry);
    for (const k of COMPONENT_KEYS) expect(car.components[k]).toBeCloseTo(68, 5);
  });

  it('on Hardcore a promoted car keeps only part of its advantage', () => {
    const car = generateCar(new Rng(5), 50, 0);
    car.components = flat(58);
    rebaseCarForDivision(car, new Rng(6), flat(50), flat(60), 0.5, true, DIFFICULTIES.hardcore.carDevelopment.promotionCarry);
    const avg = COMPONENT_KEYS.reduce((x, k) => x + car.components[k], 0) / COMPONENT_KEYS.length;
    expect(avg).toBeLessThan(65);
    expect(avg).toBeGreaterThan(59);
  });

  it('the season-end boost rewards the top, helps the bottom and gives mid-table the least', () => {
    expect(finishDevelopmentBoost(1)).toBeGreaterThan(finishDevelopmentBoost(3));
    expect(finishDevelopmentBoost(10)).toBeGreaterThan(finishDevelopmentBoost(7));
    const middle = Math.min(finishDevelopmentBoost(5), finishDevelopmentBoost(6));
    for (let p = 1; p <= 10; p++) expect(finishDevelopmentBoost(p)).toBeGreaterThanOrEqual(middle);
    const s = makeGame(309, { difficulty: 'casual' });
    playSeason(s);
    const me = playerTeam(s);
    const pos = s.lastSeasonReview!.position;
    expect(s.lastSeasonReview!.developmentBoost).toBe(finishDevelopmentBoost(pos));
    const before = { ...me.car.components };
    beginOffseason(s, false);
    if (me.division === 'F5') for (const k of COMPONENT_KEYS) expect(me.car.components[k]).toBeGreaterThanOrEqual(before[k] + finishDevelopmentBoost(pos) - 0.01);
  });

  it('upgrade packages scale up to a big step, and the options trade gain for risk, time and money', () => {
    const s = makeGame(312);
    const me = playerTeam(s);
    const q = (scale: (typeof RND_SCALES)[number], approach: 'safe' | 'balanced' | 'ambitious' = 'balanced', timeline: 'normal' | 'rush' = 'normal') => quoteProject(s, me, 'aerodynamics', scale, { approach, timeline });
    const gains = RND_SCALES.map((sc) => q(sc).expectedGain);
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeGreaterThan(gains[i - 1]);
    expect(q('radical', 'ambitious').expectedGain).toBeGreaterThanOrEqual(8);
    expect(q('radical', 'ambitious').cost).toBeLessThan(DIVISIONS.F5.typicalBudget * 0.06);
    expect(q('major', 'safe').risk).toBeLessThan(q('major').risk);
    expect(q('major', 'ambitious').expectedGain).toBeGreaterThan(q('major').expectedGain);
    expect(q('major', 'ambitious').risk).toBeGreaterThan(q('major').risk);
    expect(q('major', 'balanced', 'rush').weeks).toBeLessThan(q('major').weeks);
    expect(q('major', 'balanced', 'rush').cost).toBeGreaterThan(q('major').cost);
    s.phase = 'season';
    me.cash = 10_000_000;
    const p = startProject(s, me.id, 'aerodynamics', 'radical', { approach: 'ambitious', timeline: 'rush' });
    expect(p.approach).toBe('ambitious');
    expect(p.timeline).toBe('rush');
  });

  it('Formula 1 upgrades are affordable for a newly promoted team', () => {
    const s = makeGame(310);
    const me = playerTeam(s);
    me.division = 'F1';
    me.facilities.manufacturing.level = 4;
    expect(quoteProject(s, me, 'aerodynamics', 'minor').cost).toBeLessThan(1_300_000);
    expect(quoteProject(s, me, 'aerodynamics', 'major').cost).toBeLessThan(4_000_000);
  });

  it('sponsor deals pay more after promotion, with targets eased', () => {
    const s = makeGame(311);
    const me = playerTeam(s);
    signSponsor(s, s.player.sponsorOffers.find((o) => o.tier === 'title')!.id);
    const deal = me.sponsors[0];
    deal.endSeason = s.season + 2;
    const before = deal.perRace;
    rescaleSponsorDeals(s, me, 'F5', 'F4');
    expect(deal.perRace).toBeGreaterThan(before * 1.4);
  });
});

describe('staff and drivers', () => {
  it('staff pay depends on role and series', () => {
    const coach = staffExpectedSalary(DIVISIONS.F5.staffRatingMean, 'F5', 'driverCoach');
    const td = staffExpectedSalary(DIVISIONS.F5.staffRatingMean, 'F5', 'technicalDirector');
    expect(coach).toBeLessThan(td);
    expect(coach).toBeLessThan(DIVISIONS.F5.typicalBudget * 0.03);
    expect(staffExpectedSalary(90, 'F1', 'technicalDirector')).toBeGreaterThan(1_000_000);
    expect(staffExpectedSalary(75, 'F1', 'driverCoach')).toBeLessThan(1_000_000);
  });

  it('the hiring pool is topped up every season', () => {
    const s = makeGame(302);
    playSeason(s);
    playOffseason(s);
    for (const role of STAFF_ROLES) {
      const free = Object.values(s.staff).filter((x) => !x.retired && !x.contract && x.role === role).length;
      expect(free).toBeGreaterThanOrEqual(STAFF_POOL_PER_ROLE - 3);
    }
  });

  it('the driver market starts with plenty of free agents', () => {
    const s = makeGame(303);
    const active = Object.values(s.drivers).filter((d) => !d.retired);
    expect(active.length).toBeGreaterThanOrEqual(300);
    expect(active.filter((d) => !d.contract && d.age >= 17).length).toBeGreaterThanOrEqual(85);
  });
});

describe('sponsorship', () => {
  it('easier difficulties attract bigger sponsorship offers', () => {
    const value = (difficulty: GameState['settings']['difficulty']) => {
      const s = makeGame(304, { difficulty });
      return generateSponsorOffer(s, playerTeam(s), Rng.from(9, 'offer'), 'title').perRace;
    };
    const casual = value('casual');
    const standard = value('standard');
    const hardcore = value('hardcore');
    expect(casual).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(hardcore);
  });
});

describe('race realism', () => {
  it('Formula 1 races have a realistic amount of overtaking and retirements', () => {
    const base = makeGame(305);
    let passes = 0;
    let dnfs = 0;
    const events = base.calendars.F1.slice(0, 8);
    for (const ev of events) {
      const s: GameState = JSON.parse(JSON.stringify(base));
      const { result, race } = simulateEventRace(s, s.calendars.F1.find((e) => e.id === ev.id)!);
      passes += race.passes?.total ?? 0;
      dnfs += result.entries.filter((e) => e.status !== 'finished').length;
    }
    expect(passes / events.length).toBeGreaterThan(20);
    expect(passes / events.length).toBeLessThan(80);
    expect(dnfs / events.length).toBeLessThan(4);
  });
});
