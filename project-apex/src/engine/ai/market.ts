import { AI_PERSONALITIES, DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { generateDriver, raceAgeFor } from '../drivers/generate';
import { aspirationTier, driverName, expectedSalary, overall } from '../drivers/ratings';
import { createTransferBid } from '../events/opportunities';
import { evaluateDriverOffer } from '../market/negotiation';
import { buyoutQuote, executeSigning, nextSeasonRaceContracts, releaseDriver } from '../market/transfers';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { Rng } from '../rng';
import { activeDrivers, raceDrivers } from '../selectors';
import { academyCapacity } from '../team/facilities';
import type { Driver, DriverOffer, GameState, Team } from '../types';
import { roundMoney } from '../util';

function personality(team: Team) {
  return AI_PERSONALITIES[team.aiPersonality ?? 'conservative'];
}

/** Largest salary the AI team will commit to one driver. */
export function aiMaxSalary(_state: GameState, team: Team): number {
  const B = DIVISIONS[team.division].typicalBudget;
  const p = personality(team);
  return Math.max(DIVISIONS[team.division].salaryFactor * 12_000, Math.min(Math.max(0, team.cash) * 0.3 + B * 0.05, B * 0.16) * p.salaryPremium);
}

/** How much an AI team values a candidate (higher is better). */
export function aiCandidateValue(team: Team, d: Driver): number {
  const p = personality(team);
  const ovr = overall(d);
  const youth = d.age <= 22 ? (d.potential - ovr) * 0.45 * p.youthFocus : 0;
  const agePenalty = d.age >= 34 ? (d.age - 33) * 1.5 : 0;
  const backing = (d.backing / DIVISIONS[team.division].typicalBudget) * 30 * (team.aiPersonality === 'conservative' ? 1.5 : 1);
  return ovr + youth - agePenalty + backing;
}

function tryAiSign(state: GameState, team: Team, d: Driver, role: 'race' | 'reserve' | 'academy', startNextSeason: boolean, round: number, allowBuyout: boolean): boolean {
  const aggression = DIFFICULTIES[state.settings.difficulty].aiMarketAggression;
  const p = personality(team);
  const max = aiMaxSalary(state, team) * (role === 'reserve' ? 0.4 : 1);
  let salary = role === 'academy' ? 0 : roundMoney(expectedSalary(d, team.division) * Math.min(1.25, p.salaryPremium * (0.95 + round * 0.04) * aggression) * (role === 'reserve' ? 0.42 : 1));
  if (salary > max) salary = roundMoney(max);
  const years = d.age <= 22 ? 2 : d.age >= 32 ? 1 : 2 + (round % 2);
  const offer: DriverOffer = {
    driverId: d.id,
    role,
    salary,
    years,
    signingBonus: 0,
    winBonus: 0,
    podiumBonus: 0,
    status: 'equal',
    startNextSeason,
  };
  let fee = 0;
  if (d.contract && d.contract.teamId !== team.id && !startNextSeason) {
    if (!allowBuyout) return false;
    const q = buyoutQuote(state, team, d);
    if (!q.willing || q.fee > Math.max(0, team.cash) * 0.4) return false;
    fee = q.fee;
  }
  let ev = evaluateDriverOffer(state, team, d, offer, false);
  if (ev.response === 'counter' && ev.counter) {
    const ask = ev.counter.salary;
    if (ask <= max * 1.05) {
      offer.salary = ask;
      if (ev.counter.status) offer.status = ev.counter.status;
      ev = evaluateDriverOffer(state, team, d, offer, false);
    }
  }
  if (ev.response !== 'accept') return false;
  if (role === 'race' && !startNextSeason && team.raceDrivers[0] !== null && team.raceDrivers[1] !== null) return false;
  if (role === 'reserve' && team.reserveDriverId) return false;
  if (role === 'academy' && team.academyDriverIds.length >= academyCapacity(state, team)) return false;
  executeSigning(state, team, d, offer, fee);
  return true;
}

/** Free agents (and optionally buyout targets) suitable for a team, best first. */
function candidates(state: GameState, team: Team, opts: { includeContracted: boolean; forNextSeason: boolean; role: 'race' | 'reserve' }): Driver[] {
  const cfg = DIVISIONS[team.division];
  const floor = cfg.driverRatingMean - (opts.role === 'reserve' ? 14 : 10);
  return activeDrivers(state)
    .filter((d) => {
      if (d.age < 16 || d.contract?.teamId === team.id || d.futureContract) return false;
      if (overall(d) < floor) return false;
      if (!d.contract) return true;
      if (d.contract.role === 'academy') return false;
      if (opts.forNextSeason) return d.contract.endSeason <= state.season;
      if (!opts.includeContracted) return false;
      // Only poach from lower-tier or weaker teams.
      const owner = state.teams[d.contract.teamId];
      return DIVISIONS[owner.division].tier < cfg.tier || (owner.division === team.division && owner.reputation < team.reputation - 10);
    })
    .sort((a, b) => aiCandidateValue(team, b) - aiCandidateValue(team, a));
}

/** Fill empty seats for the current season. `desperate` guarantees a driver. */
export function aiFillSeats(state: GameState, team: Team, round: number, desperate: boolean): void {
  const p = personality(team);
  for (let seat = 0; seat < 2; seat++) {
    if (team.raceDrivers[seat] !== null) continue;
    // Promote a capable reserve or academy graduate first.
    const internal = [team.reserveDriverId, ...team.academyDriverIds].map((id) => (id ? state.drivers[id] : null)).filter((d): d is Driver => !!d && d.age >= 16 && overall(d) >= DIVISIONS[team.division].driverRatingMean - 7);
    internal.sort((a, b) => aiCandidateValue(team, b) - aiCandidateValue(team, a));
    if (internal[0] && (p.youthFocus > 0.6 || desperate || round >= 3)) {
      const d = internal[0];
      const offer: DriverOffer = { driverId: d.id, role: 'race', salary: roundMoney(expectedSalary(d, team.division)), years: 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: false, seatIndex: seat as 0 | 1 };
      if (evaluateDriverOffer(state, team, d, offer, false).response === 'accept') {
        executeSigning(state, team, d, offer, 0);
        continue;
      }
    }
    const list = candidates(state, team, { includeContracted: round >= 2 && (team.aiPersonality === 'recruiter' || team.aiPersonality === 'obsessive'), forNextSeason: false, role: 'race' });
    let signed = false;
    for (const d of list.slice(0, 8)) {
      if (tryAiSign(state, team, d, 'race', false, round, true)) {
        signed = true;
        break;
      }
    }
    if (!signed && desperate) emergencySign(state, team);
  }
}

/** Last resort so no car is ever left without a driver: sign the best willing free agent at any price, or a rookie. */
export function emergencySign(state: GameState, team: Team): void {
  const cfg = DIVISIONS[team.division];
  const seat = team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : -1;
  if (seat < 0) return;
  const pool = activeDrivers(state)
    .filter((d) => !d.contract && !d.futureContract && d.age >= 16)
    .sort((a, b) => Math.abs(overall(a) - (cfg.driverRatingMean - 4)) - Math.abs(overall(b) - (cfg.driverRatingMean - 4)));
  for (const d of pool.slice(0, 12)) {
    const salary = roundMoney(expectedSalary(d, team.division) * 1.3);
    const offer: DriverOffer = { driverId: d.id, role: 'race', salary, years: 1, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: false, seatIndex: seat as 0 | 1 };
    const ev = evaluateDriverOffer(state, team, d, offer, false);
    if (ev.response === 'accept' || (ev.response === 'counter' && ev.counter && ev.counter.salary < salary * 2.5)) {
      if (ev.counter) offer.salary = ev.counter.salary;
      executeSigning(state, team, d, offer, 0);
      return;
    }
  }
  // Nobody available: a young hopeful gets their chance.
  const rng = Rng.from(state.seed, 'emergency', team.id, state.season, state.week);
  const rookie = generateDriver({ rng, ids: state, season: state.season }, { targetOverall: cfg.driverRatingMean - 5 + rng.normal(0, 2), age: raceAgeFor(rng, team.division), division: team.division });
  state.drivers[rookie.id] = rookie;
  executeSigning(state, team, rookie, { driverId: rookie.id, role: 'race', salary: expectedSalary(rookie, team.division), years: 1, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: false, seatIndex: seat as 0 | 1 }, 0);
}

/** Make sure an injured or banned race driver can be replaced this weekend. */
export function aiEnsureSubstitute(state: GameState, team: Team): void {
  if (team.reserveDriverId) {
    const r = state.drivers[team.reserveDriverId];
    if (r && !r.injury && r.raceBan <= 0) return;
  }
  if (team.reserveDriverId) return; // reserve exists but is unavailable; keep it simple
  const cfg = DIVISIONS[team.division];
  // Most willing first: drivers whose ambition does not exceed this series, then by value.
  const willing = (d: Driver) => (aspirationTier(d) <= cfg.tier ? 1 : 0) + (d.age >= 33 ? 1 : 0);
  const pool = activeDrivers(state)
    .filter((d) => !d.contract && !d.futureContract && d.age >= 16 && !d.injury)
    .sort((a, b) => willing(b) - willing(a) || aiCandidateValue(team, b) - aiCandidateValue(team, a));
  for (const d of pool.slice(0, 12)) {
    if (tryAiSign(state, team, d, 'reserve', false, 4, false)) return;
  }
  // Short-term deal at the driver's asking price.
  for (const d of pool.slice(0, 30)) {
    const salary = roundMoney(expectedSalary(d, team.division) * 0.6);
    const offer: DriverOffer = { driverId: d.id, role: 'reserve', salary, years: 1, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'number2', startNextSeason: false };
    const ev = evaluateDriverOffer(state, team, d, offer, false);
    if (ev.response === 'accept' || (ev.response === 'counter' && ev.counter)) {
      if (ev.counter) offer.salary = ev.counter.salary;
      executeSigning(state, team, d, offer, 0);
      return;
    }
  }
  // Nobody available: a journeyman steps in on a one-year deal.
  const rng = Rng.from(state.seed, 'substitute', team.id, state.season, state.week);
  const sub = generateDriver({ rng, ids: state, season: state.season }, { targetOverall: cfg.driverRatingMean - 6 + rng.normal(0, 2), age: rng.int(24, 34), division: team.division, archetype: 'journeyman' });
  state.drivers[sub.id] = sub;
  executeSigning(state, team, sub, { driverId: sub.id, role: 'reserve', salary: roundMoney(expectedSalary(sub, team.division) * 0.5), years: 1, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'number2', startNextSeason: false }, 0);
}

/** Off-season transfer round for every AI team (best teams choose first). */
export function aiOffseasonRound(state: GameState, round: number): void {
  const rng = Rng.from(state.seed, 'offseasonRound', state.season, round);
  const teams = Object.values(state.teams)
    .filter((t) => !t.isPlayer)
    .sort((a, b) => b.reputation + rng.normal(0, 5) - (a.reputation + rng.normal(0, 5)));
  for (const team of teams) {
    aiFillSeats(state, team, round, false);
    if (!team.reserveDriverId && rng.chance(0.5)) {
      for (const d of candidates(state, team, { includeContracted: false, forNextSeason: false, role: 'reserve' }).slice(0, 4)) {
        if (tryAiSign(state, team, d, 'reserve', false, round, false)) break;
      }
    }
    const p = personality(team);
    if (team.academyDriverIds.length < academyCapacity(state, team) && rng.chance(p.youthFocus * 0.6)) {
      const prospects = activeDrivers(state)
        .filter((d) => !d.contract && d.age <= 17)
        .sort((a, b) => b.potential - a.potential);
      for (const d of prospects.slice(0, 3)) if (tryAiSign(state, team, d, 'academy', false, round, false)) break;
    }
  }
}

/** Mid-season planning: extensions, pre-contracts and the occasional ruthless replacement. */
export function aiInSeasonMarket(state: GameState, team: Team): void {
  if (state.week < 16) return;
  const rng = Rng.from(state.seed, 'aiMarket', team.id, state.season, state.week);
  const p = personality(team);
  const aggression = DIFFICULTIES[state.settings.difficulty].aiMarketAggression;
  if (!rng.chance(0.25 * aggression)) return;
  const nextContracts = nextSeasonRaceContracts(state, team);
  if (nextContracts.length >= 2) return;
  // Expiring drivers: extend the good ones.
  for (const d of raceDrivers(state, team)) {
    if (!d.contract || d.contract.endSeason > state.season || d.futureContract) continue;
    const field = Object.values(state.teams).filter((t) => t.division === team.division).flatMap((t) => raceDrivers(state, t));
    const rank = field.filter((x) => overall(x) > overall(d)).length;
    const keep = rank < field.length * 0.6 || (d.age <= 22 && d.potential >= overall(d) + 8);
    if (keep && nextSeasonRaceContracts(state, team).length < 2) {
      if (tryAiSign(state, team, d, 'race', true, 2, false)) continue;
      if (d.contract && d.morale < 50 && overall(d) >= DIVISIONS[team.division].driverRatingMean + 4) {
        addNews(state, { category: 'transfer', headline: fill(TEMPLATES.refuseExtension[0], { driver: driverName(d).toUpperCase(), team: team.name.toUpperCase() }), body: `${driverName(d)} has turned down a new deal from ${team.name}. Their contract expires at the end of the season.`, division: team.division, driverIds: [d.id], teamIds: [team.id], importance: team.division === 'F1' ? 2 : 1 });
      }
    }
  }
  if (nextSeasonRaceContracts(state, team).length >= 2) return;
  // Pre-contract a replacement (this is where the player's expiring drivers can be poached).
  const targets = candidates(state, team, { includeContracted: false, forNextSeason: true, role: 'race' });
  for (const d of targets.slice(0, 5)) {
    if (d.contract?.teamId === state.player.teamId && rng.chance(0.5)) {
      addNews(state, { category: 'rumor', headline: fill(pickTemplate(state, 'rumor', TEMPLATES.rumor), { team: team.name.toUpperCase(), driver: driverName(d).toUpperCase() }), body: fill(pickTemplate(state, 'rumorB', TEMPLATES.rumorBody), { driver: driverName(d), team: team.name, division: DIVISIONS[team.division].name }), division: team.division, driverIds: [d.id], teamIds: [team.id], importance: 2 });
    }
    if (tryAiSign(state, team, d, 'race', true, 1, false)) break;
  }
  // Ruthless teams replace a clearly underperforming driver mid-season.
  if (rng.chance(0.08 * p.ruthlessness) && state.week < 34) {
    const drivers = raceDrivers(state, team);
    if (drivers.length === 2) {
      const [a, b] = drivers;
      const weak = a.career.points < b.career.points ? a : b;
      const formAvg = weak.form.length ? weak.form.reduce((s, x) => s + x, 0) / weak.form.length : 10;
      if (formAvg > 14 && weak.morale < 45 && team.cash > DIVISIONS[team.division].typicalBudget * 0.15) {
        const free = candidates(state, team, { includeContracted: false, forNextSeason: false, role: 'race' }).filter((d) => !d.contract && overall(d) > overall(weak) + 3);
        if (free.length) {
          releaseDriver(state, weak.id, team.id);
          if (!tryAiSign(state, team, free[0], 'race', false, 3, false)) aiFillSeats(state, team, 3, true);
          addNews(state, { category: 'transfer', headline: `${team.name.toUpperCase()} AXE ${driverName(weak).toUpperCase()}`, body: `${team.name} have lost patience with ${driverName(weak)} after a run of poor results.`, division: team.division, driverIds: [weak.id], teamIds: [team.id], importance: 1 });
        }
      }
    }
  }
}

/** AI teams in higher divisions occasionally bid for the player's best driver. */
export function aiBidForPlayerDrivers(state: GameState): void {
  if (state.phase !== 'season' || state.week < 6 || state.week > 38) return;
  const rng = Rng.from(state.seed, 'bid', state.season, state.week);
  if (!rng.chance(0.05 * DIFFICULTIES[state.settings.difficulty].aiMarketAggression)) return;
  if (state.player.opportunities.some((o) => o.kind === 'transferBid')) return;
  const player = state.teams[state.player.teamId];
  const mine = raceDrivers(state, player).filter((d) => d.contract && d.contract.endSeason > state.season);
  const star = mine.sort((a, b) => overall(b) - overall(a))[0];
  if (!star) return;
  const bidders = Object.values(state.teams).filter(
    (t) => !t.isPlayer && DIVISIONS[t.division].tier > DIVISIONS[player.division].tier && overall(star) >= DIVISIONS[t.division].driverRatingMean - 3 && (t.aiPersonality === 'recruiter' || t.aiPersonality === 'obsessive' || t.aiPersonality === 'youth'),
  );
  if (!bidders.length) return;
  const bidder = rng.pick(bidders);
  const q = buyoutQuote(state, bidder, star);
  const fee = roundMoney(q.fee * rng.range(1.0, 1.4));
  if (fee > Math.max(0, bidder.cash) * 0.4) return;
  createTransferBid(state, bidder, star.id, fee);
}
