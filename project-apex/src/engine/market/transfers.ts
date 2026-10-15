import { AI_PERSONALITIES, DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { driverName, marketValue, overall } from '../drivers/ratings';
import { postTransaction } from '../finance/ledger';
import { addNews, fill, pickTemplate, TEMPLATES } from '../news/news';
import { academyCapacity } from '../team/facilities';
import type { Contract, Driver, DriverOffer, GameState, Team } from '../types';
import { assertRule, roundMoney } from '../util';
import { makeContract } from '../world/generate';
import { evaluateDriverOffer, type OfferEvaluation } from './negotiation';

export const MAX_CONTRACT_YEARS = 5;

/** Remaining salary owed on a contract, counting the unplayed part of this season. */
export function remainingSalary(state: GameState, c: Contract): number {
  const seasonFraction = state.phase === 'season' || state.phase === 'weekend' ? Math.max(0, 1 - state.week / 44) : 1;
  if (c.startSeason > state.season) return c.salary * (c.endSeason - c.startSeason + 1);
  const future = Math.max(0, c.endSeason - state.season);
  return c.salary * (seasonFraction + future);
}

export function severanceCost(state: GameState, d: Driver): number {
  if (!d.contract) return 0;
  const team = state.teams[d.contract.teamId];
  const factor = team?.isPlayer ? DIFFICULTIES[state.settings.difficulty].severance : 0.5;
  return roundMoney(remainingSalary(state, d.contract) * factor + (d.futureContract && d.futureContract.teamId === d.contract.teamId ? d.futureContract.salary * factor : 0));
}

/** Contracts for next season held by a team (race seats). */
export function nextSeasonRaceContracts(state: GameState, team: Team): Driver[] {
  const next = state.season + 1;
  return Object.values(state.drivers).filter((d) => {
    if (d.retired) return false;
    if (d.futureContract?.teamId === team.id && d.futureContract.role === 'race') return true;
    return !d.futureContract && d.contract?.teamId === team.id && d.contract.role === 'race' && d.contract.endSeason >= next;
  });
}

function detachFromTeam(state: GameState, d: Driver): void {
  if (!d.contract) return;
  const team = state.teams[d.contract.teamId];
  if (team) {
    team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
    if (team.reserveDriverId === d.id) team.reserveDriverId = null;
    team.academyDriverIds = team.academyDriverIds.filter((id) => id !== d.id);
  }
  d.contract = null;
}

/** Attach a driver with a fresh contract to a team in the given role. */
export function placeDriver(state: GameState, team: Team, d: Driver, contract: Contract, seatIndex?: 0 | 1): void {
  assertRule(contract.teamId === team.id, 'Contract/team mismatch.');
  if (d.contract && d.contract.teamId !== team.id) detachFromTeam(state, d);
  else if (d.contract) {
    // Same team, role change: clear old slot.
    team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
    if (team.reserveDriverId === d.id) team.reserveDriverId = null;
    team.academyDriverIds = team.academyDriverIds.filter((id) => id !== d.id);
  }
  d.contract = contract;
  if (contract.role === 'race') {
    const idx = seatIndex ?? (team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : -1);
    assertRule(idx === 0 || idx === 1, 'No free race seat.');
    assertRule(team.raceDrivers[idx] === null, 'That race seat is occupied.');
    team.raceDrivers[idx] = d.id;
  } else if (contract.role === 'reserve') {
    assertRule(team.reserveDriverId === null, 'The reserve seat is occupied.');
    team.reserveDriverId = d.id;
  } else {
    assertRule(team.academyDriverIds.length < academyCapacity(state, team), 'The academy is full.');
    team.academyDriverIds.push(d.id);
  }
}

export interface BuyoutQuote {
  fee: number;
  willing: boolean;
  reason: string;
}

/** Fee another team wants to release a contracted driver. */
export function buyoutQuote(state: GameState, buyer: Team, d: Driver): BuyoutQuote {
  if (!d.contract) return { fee: 0, willing: true, reason: 'Free agent' };
  const owner = state.teams[d.contract.teamId];
  if (owner.id === buyer.id) return { fee: 0, willing: false, reason: 'Already your driver' };
  const base = d.contract.releaseClause > 0 ? d.contract.releaseClause : remainingSalary(state, d.contract) * 1.2 + marketValue(d) * 0.5;
  let fee = base;
  let willing = true;
  let reason = 'Fee covers the remaining contract and market value.';
  if (!owner.isPlayer) {
    const mates = owner.raceDrivers.filter((id) => id && id !== d.id).map((id) => state.drivers[id!]);
    const isLead = d.contract.role === 'race' && mates.every((m) => overall(m) <= overall(d));
    const ruthless = owner.aiPersonality ? AI_PERSONALITIES[owner.aiPersonality].ruthlessness : 0.5;
    if (isLead && d.contract.releaseClause === 0) {
      fee *= 1.6;
      reason = 'Their lead driver: they demand a premium.';
      if (DIVISIONS[owner.division].tier >= DIVISIONS[buyer.division].tier && ruthless < 0.5) {
        willing = false;
        reason = `${owner.name} will not sell their lead driver to a rival at the same level.`;
      }
    }
    if (d.morale < 40) {
      fee *= 0.8;
      reason += ' The driver is unsettled, which lowers the price.';
    }
    if (d.contract.role === 'academy') fee = Math.max(fee * 0.4, DIVISIONS[owner.division].academyCostPerDriver * 3);
  }
  return { fee: roundMoney(fee), willing, reason };
}

export interface SigningOptions {
  /** When the seat is taken: what to do with the displaced driver. */
  displace?: 'reserve' | 'release';
}

export interface SigningResult extends OfferEvaluation {
  signed: boolean;
  fee: number;
}

function validateOffer(state: GameState, team: Team, d: Driver, offer: DriverOffer): void {
  assertRule(!d.retired, 'That driver has retired.');
  assertRule(Number.isFinite(offer.salary) && offer.salary >= 0, 'Salary must be a positive amount.');
  assertRule(Number.isInteger(offer.years) && offer.years >= 1 && offer.years <= MAX_CONTRACT_YEARS, `Contract length must be 1-${MAX_CONTRACT_YEARS} seasons.`);
  assertRule(offer.signingBonus >= 0 && offer.winBonus >= 0 && offer.podiumBonus >= 0, 'Bonuses cannot be negative.');
  assertRule(state.phase !== 'seasonReview' && state.phase !== 'gameOver', 'The transfer market is closed right now.');
  if (offer.startNextSeason) {
    assertRule(state.phase === 'season' || state.phase === 'weekend', 'Pre-contracts for next season can only be agreed during the season.');
    assertRule(!d.futureContract, `${driverName(d)} has already agreed terms for next season.`);
    if (d.contract && d.contract.teamId !== team.id) assertRule(d.contract.endSeason <= state.season, `${driverName(d)} is under contract beyond this season. Negotiate a buyout instead.`);
    if (offer.role === 'race') {
      const held = nextSeasonRaceContracts(state, team).filter((x) => x.id !== d.id);
      assertRule(held.length < 2, 'You already have two race drivers under contract for next season.');
    }
  }
  if (offer.role === 'academy') {
    assertRule(d.age <= 19, 'Only drivers aged 19 or younger can join the academy.');
    assertRule(!offer.startNextSeason, 'Academy places start immediately.');
  }
  if (offer.role === 'race' && !offer.startNextSeason) assertRule(d.age >= 16, 'Drivers must be at least 16 to race.');
  const upfront = offer.signingBonus;
  assertRule(team.cash >= upfront, 'Not enough cash for the signing bonus.');
}

/**
 * Make an offer to a driver. On acceptance the contract is executed
 * immediately (or as a pre-contract for next season).
 */
export function offerContract(state: GameState, teamId: string, offer: DriverOffer, opts: SigningOptions = {}): SigningResult {
  const team = state.teams[teamId];
  const d = state.drivers[offer.driverId];
  assertRule(team && d, 'Unknown team or driver.');
  validateOffer(state, team, d, offer);
  const isExtension = d.contract?.teamId === team.id;
  let fee = 0;
  if (!isExtension && d.contract && !offer.startNextSeason && !(d.contract.endSeason < state.season)) {
    const q = buyoutQuote(state, team, d);
    assertRule(q.willing, q.reason);
    fee = q.fee;
    assertRule(team.cash >= fee + offer.signingBonus, `Not enough cash for the ${fee.toLocaleString()} buyout plus signing bonus.`);
  }
  // Seat checks before asking the driver (no point agreeing terms for a seat that does not exist).
  if (!offer.startNextSeason && offer.role === 'race' && !(isExtension && d.contract?.role === 'race')) {
    const seat = offer.seatIndex ?? (team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : undefined);
    assertRule(seat !== undefined || opts.displace, 'Both race seats are occupied. Choose a seat and what to do with the current driver.');
  }
  if (!offer.startNextSeason && offer.role === 'reserve' && !(isExtension && d.contract?.role === 'reserve')) {
    assertRule(team.reserveDriverId === null || opts.displace, 'The reserve seat is occupied.');
  }
  if (offer.role === 'academy' && !isExtension) assertRule(team.academyDriverIds.length < academyCapacity(state, team), 'The academy is full. Upgrade the Driver Training Academy for more places.');

  const evaluation = evaluateDriverOffer(state, team, d, offer);
  if (evaluation.response !== 'accept') return { ...evaluation, signed: false, fee };
  executeSigning(state, team, d, offer, fee, opts);
  return { ...evaluation, signed: true, fee };
}

export function executeSigning(state: GameState, team: Team, d: Driver, offer: DriverOffer, fee: number, opts: SigningOptions = {}): void {
  const fromTeam = d.contract ? state.teams[d.contract.teamId] : null;
  const isExtension = fromTeam?.id === team.id;
  const start = offer.startNextSeason ? state.season + 1 : state.season;
  const contract = makeContract(state, start, team.id, offer.role, offer.salary, offer.years, offer.status, {
    signingBonus: offer.signingBonus,
    winBonus: offer.winBonus,
    podiumBonus: offer.podiumBonus,
    releaseClause: offer.releaseClause ?? 0,
    signedSeason: state.season,
    signedWeek: state.week,
  });
  if (fee > 0 && fromTeam) {
    postTransaction(state, team, 'buyout', -fee, `Buyout: ${driverName(d)}`);
    postTransaction(state, fromTeam, 'transferIncome', fee, `Sold: ${driverName(d)}`);
  }
  if (offer.signingBonus > 0) postTransaction(state, team, 'signingBonus', -offer.signingBonus, `Signing bonus: ${driverName(d)}`);

  if (offer.startNextSeason) {
    d.futureContract = contract;
  } else if (isExtension && d.contract!.role === offer.role) {
    // Renegotiation: new terms replace the current deal from now.
    contract.startSeason = d.contract!.startSeason;
    contract.endSeason = state.season + offer.years - (state.phase === 'season' || state.phase === 'weekend' ? 0 : 1);
    if (contract.endSeason < state.season) contract.endSeason = state.season;
    d.contract = contract;
  } else {
    // New role or new team: make room if needed.
    if (offer.role === 'race') {
      let seat = offer.seatIndex ?? (team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : 0);
      if (isExtension) {
        team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
        if (team.reserveDriverId === d.id) team.reserveDriverId = null;
        team.academyDriverIds = team.academyDriverIds.filter((id) => id !== d.id);
        seat = offer.seatIndex ?? (team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : 0);
      }
      const occupant = team.raceDrivers[seat];
      if (occupant && occupant !== d.id) displaceDriver(state, team, state.drivers[occupant], opts.displace ?? 'reserve');
    } else if (offer.role === 'reserve' && team.reserveDriverId && team.reserveDriverId !== d.id) {
      releaseDriver(state, team.reserveDriverId, team.id);
    }
    if (isExtension) d.contract = null;
    placeDriver(state, team, d, contract, offer.role === 'race' ? (offer.seatIndex ?? (team.raceDrivers[0] === null ? 0 : 1)) : undefined);
  }
  d.transfers.push({ season: state.season, week: state.week, fromTeamId: isExtension ? team.id : fromTeam?.id ?? null, toTeamId: team.id, fee, type: isExtension ? 'extension' : fee > 0 ? 'buyout' : offer.role === 'academy' ? 'academy' : 'signing' });
  d.morale = Math.min(100, d.morale + 6);
  if (team.isPlayer) state.player.scouting[d.id] = 100;
  if (!isExtension || offer.startNextSeason) {
    const star = overall(d) >= DIVISIONS[team.division].driverRatingMean + 6;
    const tpl = star ? TEMPLATES.bigSigning : TEMPLATES.signing;
    if (offer.role === 'race' && (team.isPlayer || star || team.division === 'F1')) {
      addNews(state, {
        category: 'transfer',
        headline: fill(pickTemplate(state, 'sign', tpl), { driver: driverName(d).toUpperCase(), team: team.name.toUpperCase(), years: offer.years }),
        body: `${driverName(d)} (${d.age}, rated ${overall(d)}) has signed a ${offer.years}-season contract with ${team.name}${offer.startNextSeason ? ', starting next season' : ''}${fee > 0 ? ` after a ${formatFee(fee)} buyout from ${fromTeam?.name}` : ''}.`,
        division: team.division,
        teamIds: [team.id, ...(fromTeam && fromTeam.id !== team.id ? [fromTeam.id] : [])],
        driverIds: [d.id],
        importance: team.isPlayer ? 3 : star ? 2 : 1,
      });
    }
  }
}

function formatFee(v: number): string {
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`;
}

/** Move a race driver out of their seat (to reserve or released). */
export function displaceDriver(state: GameState, team: Team, d: Driver, mode: 'reserve' | 'release'): void {
  if (mode === 'reserve' && team.reserveDriverId === null) {
    team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
    team.reserveDriverId = d.id;
    if (d.contract) d.contract.role = 'reserve';
    d.morale = Math.max(5, d.morale - 15);
    return;
  }
  releaseDriver(state, d.id, team.id);
}

/** Terminate a contract, paying severance. */
export function releaseDriver(state: GameState, driverId: string, teamId: string): number {
  const d = state.drivers[driverId];
  const team = state.teams[teamId];
  assertRule(d && team, 'Unknown driver or team.');
  assertRule(d.contract?.teamId === team.id || d.futureContract?.teamId === team.id, `${driverName(d)} is not under contract with ${team.name}.`);
  let cost = 0;
  if (d.contract?.teamId === team.id) {
    cost = severanceCost(state, d);
    detachFromTeam(state, d);
  }
  if (d.futureContract?.teamId === team.id) {
    cost += roundMoney(d.futureContract.salary * (team.isPlayer ? DIFFICULTIES[state.settings.difficulty].severance : 0.5) * 0.5);
    d.futureContract = null;
  }
  if (cost > 0) postTransaction(state, team, 'severance', -cost, `Severance: ${driverName(d)}`);
  d.transfers.push({ season: state.season, week: state.week, fromTeamId: team.id, toTeamId: null, fee: cost, type: 'release' });
  d.morale = Math.max(5, d.morale - 12);
  if (team.isPlayer || team.division === 'F1') {
    addNews(state, { category: 'transfer', headline: fill(pickTemplate(state, 'rel', TEMPLATES.release), { team: team.name.toUpperCase(), driver: driverName(d).toUpperCase() }), body: `${team.name} have terminated ${driverName(d)}'s contract${cost > 0 ? `, paying ${formatFee(cost)} in compensation` : ''}.`, division: team.division, teamIds: [team.id], driverIds: [d.id], importance: team.isPlayer ? 2 : 1 });
  }
  return cost;
}

/** Swap seat order or change a contracted driver's role within the team. */
export function setDriverRole(state: GameState, teamId: string, driverId: string, role: 'race' | 'reserve', seatIndex?: 0 | 1): void {
  const team = state.teams[teamId];
  const d = state.drivers[driverId];
  assertRule(team && d && d.contract?.teamId === team.id, 'Driver is not under contract with this team.');
  assertRule(d.contract.role !== 'academy', 'Promote academy drivers with a new contract.');
  if (role === 'race') {
    assertRule(d.age >= 16, 'Drivers must be at least 16 to race.');
    const seat = seatIndex ?? (team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : undefined);
    assertRule(seat !== undefined, 'Both race seats are occupied. Choose which seat to swap.');
    const occupant = team.raceDrivers[seat];
    if (team.reserveDriverId === d.id) team.reserveDriverId = null;
    team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
    if (occupant && occupant !== d.id) {
      // The occupant takes the vacated reserve role.
      const o = state.drivers[occupant];
      if (team.reserveDriverId === null) {
        team.reserveDriverId = occupant;
        o.contract!.role = 'reserve';
        o.morale = Math.max(5, o.morale - 12);
      } else {
        const other = seat === 0 ? 1 : 0;
        assertRule(team.raceDrivers[other] === null, 'No room for the displaced driver.');
        team.raceDrivers[other] = occupant;
      }
    }
    team.raceDrivers[seat] = d.id;
    d.contract.role = 'race';
  } else {
    assertRule(team.reserveDriverId === null || team.reserveDriverId === d.id, 'The reserve seat is occupied.');
    team.raceDrivers = team.raceDrivers.map((id) => (id === d.id ? null : id)) as Team['raceDrivers'];
    team.reserveDriverId = d.id;
    d.contract.role = 'reserve';
    d.morale = Math.max(5, d.morale - 10);
  }
}

export function swapRaceSeats(state: GameState, teamId: string): void {
  const team = state.teams[teamId];
  team.raceDrivers = [team.raceDrivers[1], team.raceDrivers[0]];
}

export function setDriverStatus(state: GameState, teamId: string, driverId: string, status: Contract['status']): void {
  const d = state.drivers[driverId];
  assertRule(d?.contract?.teamId === teamId && d.contract.role === 'race', 'Only race drivers have a status.');
  const before = d.contract.status;
  d.contract.status = status;
  if (before === 'number1' && status !== 'number1') d.morale = Math.max(5, d.morale - 12);
  if (status === 'number2' && before !== 'number2') d.morale = Math.max(5, d.morale - 8);
  if (status === 'number1' && before !== 'number1') d.morale = Math.min(100, d.morale + 8);
}
