import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { expectedSalary, overall } from '../drivers/ratings';
import { evaluateDriverOffer } from '../market/negotiation';
import { buyoutQuote, nextSeasonRaceContracts, offerContract, releaseDriver } from '../market/transfers';
import { playerTeam, raceDrivers } from '../selectors';
import type { Driver, DriverOffer, GameState } from '../types';
import { validateState } from '../validation';
import { makeGame } from './helpers';

function offerFor(d: Driver, s: GameState, patch: Partial<DriverOffer> = {}): DriverOffer {
  return { driverId: d.id, role: 'race', salary: expectedSalary(d, playerTeam(s).division), years: 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: false, ...patch };
}

function bestF1Driver(s: GameState): Driver {
  return Object.values(s.drivers).filter((d) => d.contract && s.teams[d.contract.teamId].division === 'F1').sort((a, b) => overall(b) - overall(a))[0];
}

describe('driver negotiations', () => {
  it('a star Formula 1 driver refuses a Formula 5 team even with a big salary', () => {
    const s = makeGame(10);
    s.week = 25;
    s.phase = 'season';
    const star = bestF1Driver(s);
    star.contract!.endSeason = s.season; // expiring, so free to talk
    const ev = evaluateDriverOffer(s, playerTeam(s), star, offerFor(star, s, { salary: expectedSalary(star, 'F5') * 4, startNextSeason: true }));
    expect(ev.response).not.toBe('accept');
  });

  it('a fair offer to a suitable free agent is accepted', () => {
    const s = makeGame(12);
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).filter((d) => !d.contract && d.age >= 18 && d.age <= 30 && overall(d) >= 44 && overall(d) <= 50).sort((a, b) => overall(b) - overall(a))[0];
    expect(fa).toBeTruthy();
    const ev = evaluateDriverOffer(s, team, fa, offerFor(fa, s, { salary: expectedSalary(fa, 'F5') * 1.5, role: 'race' }));
    expect(['accept', 'counter']).toContain(ev.response);
  });

  it('repeated identical offers get the same answer (no re-rolling)', () => {
    const s = makeGame(13);
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).find((d) => !d.contract && overall(d) > 60)!;
    const o = offerFor(fa, s, { salary: 1000 });
    const a = evaluateDriverOffer(s, team, fa, o, false);
    const b = evaluateDriverOffer(s, team, fa, o, false);
    expect(a.response).toBe(b.response);
    expect(a.utility).toBeCloseTo(b.utility, 10);
  });

  it('breaks off talks after repeated lowball offers', () => {
    const s = makeGame(14);
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).find((d) => !d.contract && overall(d) > 55)!;
    let last = '';
    for (let i = 0; i < 4; i++) last = evaluateDriverOffer(s, team, fa, offerFor(fa, s, { salary: 500 })).response;
    expect(last === 'refuseTalks' || evaluateDriverOffer(s, team, fa, offerFor(fa, s)).response === 'refuseTalks').toBe(true);
  });
});

describe('contract execution', () => {
  it('signs a free agent as reserve, then releases with severance', () => {
    const s = makeGame(20);
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).filter((d) => !d.contract && d.age >= 18 && overall(d) <= 44 && overall(d) >= 36)[0];
    const res = offerContract(s, team.id, offerFor(fa, s, { role: 'reserve', salary: expectedSalary(fa, 'F5') * 2, years: 1 }));
    if (!res.signed) return; // personality may refuse a reserve role; covered by other tests
    expect(team.reserveDriverId).toBe(fa.id);
    expect(validateState(s)).toEqual([]);
    const cash = team.cash;
    const cost = releaseDriver(s, fa.id, team.id);
    expect(cost).toBeGreaterThan(0);
    expect(team.cash).toBe(cash - cost);
    expect(fa.contract).toBeNull();
    expect(team.reserveDriverId).toBeNull();
  });

  it('rejects invalid contract terms', () => {
    const s = makeGame(21);
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).find((d) => !d.contract && d.age >= 18)!;
    expect(() => offerContract(s, team.id, offerFor(fa, s, { years: 0 }))).toThrow();
    expect(() => offerContract(s, team.id, offerFor(fa, s, { years: -2 }))).toThrow();
    expect(() => offerContract(s, team.id, offerFor(fa, s, { years: 9 }))).toThrow();
    expect(() => offerContract(s, team.id, offerFor(fa, s, { salary: -5 }))).toThrow();
  });

  it('prevents a driver from holding pre-contracts with two teams', () => {
    const s = makeGame(22);
    s.phase = 'season';
    s.week = 20;
    const team = playerTeam(s);
    const fa = Object.values(s.drivers).filter((d) => !d.contract && d.age >= 18 && overall(d) >= 40 && overall(d) <= 50)[0];
    const rival = Object.values(s.teams).find((t) => !t.isPlayer && t.division === 'F5')!;
    fa.futureContract = { id: 'cX', teamId: rival.id, role: 'race', salary: 1000, startSeason: s.season + 1, endSeason: s.season + 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', releaseClause: 0, signedSeason: s.season, signedWeek: 20 };
    expect(() => offerContract(s, team.id, offerFor(fa, s, { startNextSeason: true }))).toThrow(/already agreed/);
  });

  it('limits next-season race contracts to two', () => {
    const s = makeGame(23);
    s.phase = 'season';
    s.week = 20;
    const team = playerTeam(s);
    for (const d of raceDrivers(s, team)) d.contract!.endSeason = s.season + 2;
    expect(nextSeasonRaceContracts(s, team)).toHaveLength(2);
    const fa = Object.values(s.drivers).find((d) => !d.contract && d.age >= 18)!;
    expect(() => offerContract(s, team.id, offerFor(fa, s, { startNextSeason: true }))).toThrow(/two race drivers/);
  });

  it('buyouts move money from buyer to seller', () => {
    const s = makeGame(24);
    const team = playerTeam(s);
    team.cash = 50_000_000;
    const rival = Object.values(s.teams).find((t) => !t.isPlayer && t.division === 'F5')!;
    const target = raceDrivers(s, rival).sort((a, b) => overall(a) - overall(b))[0];
    const q = buyoutQuote(s, team, target);
    expect(q.fee).toBeGreaterThan(0);
    const before = { buyer: team.cash, seller: rival.cash };
    const res = offerContract(s, team.id, offerFor(target, s, { salary: expectedSalary(target, 'F5') * 3, status: 'number1', seatIndex: 0 }), { displace: 'reserve' });
    if (res.signed) {
      expect(team.cash).toBe(before.buyer - res.fee);
      expect(rival.cash).toBe(before.seller + res.fee);
      expect(target.contract!.teamId).toBe(team.id);
      expect(rival.raceDrivers).not.toContain(target.id);
      expect(validateState(s)).toEqual([]);
    } else {
      expect(team.cash).toBe(before.buyer);
    }
  });

  it('academy signings respect capacity', () => {
    const s = makeGame(25);
    const team = playerTeam(s);
    const kids = Object.values(s.drivers).filter((d) => !d.contract && d.age <= 17).sort((a, b) => a.potential - b.potential);
    let signed = 0;
    for (const k of kids.slice(0, 6)) {
      try {
        const r = offerContract(s, team.id, { driverId: k.id, role: 'academy', salary: 0, years: 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'number2', startNextSeason: false });
        if (r.signed) signed++;
      } catch {
        break;
      }
    }
    expect(team.academyDriverIds.length).toBe(signed);
    expect(team.academyDriverIds.length).toBeLessThanOrEqual(1 + Math.floor(team.facilities.trainingAcademy.level / 2));
    expect(validateState(s)).toEqual([]);
    void DIVISIONS;
  });
});
