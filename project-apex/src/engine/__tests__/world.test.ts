import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { carRating } from '../car/car';
import { overall } from '../drivers/ratings';
import { playerTeam, raceDrivers, teamsInDivision } from '../selectors';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame } from './helpers';

describe('world generation', () => {
  it('creates a complete, valid universe', () => {
    const s = makeGame(4242);
    expect(Object.values(s.drivers).filter((d) => !d.retired).length).toBeGreaterThanOrEqual(250);
    for (const d of DIVISION_ORDER) expect(teamsInDivision(s, d)).toHaveLength(10);
    expect(validateState(s)).toEqual([]);
    expect(Object.keys(s.circuits).length).toBeGreaterThanOrEqual(40);
  });

  it('starts the player in Formula 5 with two drivers and a car that is not overpowered', () => {
    const s = makeGame(4243);
    const team = playerTeam(s);
    expect(team.division).toBe('F5');
    expect(raceDrivers(s, team)).toHaveLength(2);
    const field = teamsInDivision(s, 'F5').map((t) => carRating(t.car)).sort((a, b) => b - a);
    expect(field.indexOf(carRating(team.car))).toBeGreaterThanOrEqual(3);
    expect(team.cash).toBeLessThan(DIVISIONS.F5.typicalBudget);
    const best = Math.max(...Object.values(s.drivers).filter((d) => d.contract && s.teams[d.contract.teamId].division === 'F5').map(overall));
    for (const d of raceDrivers(s, team)) expect(overall(d)).toBeLessThan(best);
  });

  it('divisions get progressively stronger', () => {
    const s = makeGame(4244);
    const avg = (d: (typeof DIVISION_ORDER)[number]) => {
      const ds = teamsInDivision(s, d).flatMap((t) => raceDrivers(s, t));
      return ds.reduce((a, x) => a + overall(x), 0) / ds.length;
    };
    for (let i = 1; i < DIVISION_ORDER.length; i++) expect(avg(DIVISION_ORDER[i])).toBeGreaterThan(avg(DIVISION_ORDER[i - 1]));
  });
});
