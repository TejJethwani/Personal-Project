import { describe, expect, it } from 'vitest';
import { applyRegulationReset, COMPONENT_KEYS, generateCar, REGULATION_CEILING, seriesShiftFor } from '../car/car';
import { DIVISIONS } from '../config/divisions';
import { generateSponsorOffer } from '../finance/sponsors';
import { simulateEventRace } from '../race/weekend';
import { Rng } from '../rng';
import { beginOffseason } from '../season/seasonEnd';
import { playerTeam, teamsInDivision } from '../selectors';
import { STAFF_POOL_PER_ROLE, STAFF_ROLES, staffExpectedSalary } from '../staff/staff';
import type { ComponentKey, GameState, RegulationNotice } from '../types';
import { makeGame, playOffseason, playSeason } from './helpers';

const flat = (v: number) => Object.fromEntries(COMPONENT_KEYS.map((k) => [k, v])) as Record<ComponentKey, number>;

describe('car development carries over', () => {
  it('no car loses rating over the winter while its series is below the regulation ceiling', () => {
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

  it('above the ceiling every car in the series slows by the same amount and the order holds', () => {
    const notice: RegulationNotice = { division: 'F1', season: 2, magnitude: 'stable', focus: null, text: '' };
    const fast = generateCar(new Rng(1), 50, 0);
    const slow = generateCar(new Rng(2), 50, 0);
    fast.components = flat(80);
    slow.components = flat(72);
    const mean = flat(76);
    const shift = seriesShiftFor(mean);
    expect(shift.aerodynamics).toBeCloseTo(76 - REGULATION_CEILING);
    applyRegulationReset(fast, new Rng(3), notice, mean, 0.4, shift);
    applyRegulationReset(slow, new Rng(4), notice, mean, 0.4, shift);
    for (const k of COMPONENT_KEYS) {
      expect(fast.components[k]).toBeGreaterThan(slow.components[k]);
      expect(fast.components[k]).toBeGreaterThanOrEqual(80 - shift[k]);
    }
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
