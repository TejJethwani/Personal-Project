import { DIFFICULTIES } from '../config/difficulty';
import { DIVISIONS } from '../config/divisions';
import { generateDriver, nextId } from '../drivers/generate';
import { driverName, expectedSalary, marketValue, overall } from '../drivers/ratings';
import { postTransaction } from '../finance/ledger';
import { executeSigning } from '../market/transfers';
import { addNews } from '../news/news';
import { Rng } from '../rng';
import { currentAbsWeek } from '../season/calendar';
import { playerTeam, raceDrivers } from '../selectors';
import { generateStaff, STAFF_ROLE_INFO, STAFF_ROLES, staffExpectedSalary, staffRating } from '../staff/staff';
import { hireStaffMember } from '../staff/market';
import type { GameState, Opportunity, Team } from '../types';
import { assertRule, clamp, roundMoney } from '../util';

const money = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${Math.round(v / 1000)}k`);

/** Occasionally present the player with a decision arising from the world state. */
export function maybeGenerateOpportunity(state: GameState): Opportunity | null {
  if (state.phase !== 'season') return null;
  const now = currentAbsWeek(state);
  state.player.opportunities = state.player.opportunities.filter((o) => o.expiresAbsWeek >= now);
  if (state.player.opportunities.length >= 2) return null;
  const rng = Rng.from(state.seed, 'opportunity', state.season, state.week);
  if (!rng.chance(0.09)) return null;
  const team = playerTeam(state);
  const B = DIVISIONS[team.division].typicalBudget;
  const diff = DIFFICULTIES[state.settings.difficulty];
  const kinds: { item: Opportunity['kind']; weight: number }[] = [
    { item: 'investor', weight: team.cash < B * 0.15 && diff.id !== 'hardcore' ? 3 : 0.6 },
    { item: 'windTunnel', weight: 1.2 },
    { item: 'paySeat', weight: team.reserveDriverId ? 0 : 1.2 },
    { item: 'mediaDeal', weight: 1 },
    { item: 'engineerPoach', weight: 1 },
    { item: 'charity', weight: 0.8 },
    { item: 'testDay', weight: 1 },
  ];
  const kind = rng.weighted(kinds);
  const base = { id: nextId(state, 'op'), kind, expiresAbsWeek: now + 3 } as Opportunity;
  let op: Opportunity;
  switch (kind) {
    case 'investor': {
      const amount = roundMoney(B * rng.range(0.12, 0.22));
      op = { ...base, title: 'Investor approach', body: `A private equity group offers ${money(amount)} for a minority stake. They will expect results: board confidence will drop and future objectives will be judged more harshly.`, choices: [{ id: 'accept', label: `Accept ${money(amount)}`, description: '+cash, -10 board confidence' }, { id: 'decline', label: 'Decline', description: 'Keep full control' }], data: { amount } };
      break;
    }
    case 'windTunnel': {
      const cost = roundMoney(B * rng.range(0.015, 0.03));
      op = { ...base, title: 'Wind tunnel time for sale', body: `A rival team has surplus wind tunnel slots. Booking them for ${money(cost)} would give your aerodynamicists a valuable boost.`, choices: [{ id: 'accept', label: `Book for ${money(cost)}`, description: '+aerodynamics' }, { id: 'decline', label: 'Decline', description: '' }], data: { cost, gain: Math.round(rng.range(1.2, 2.4) * 10) / 10 } };
      break;
    }
    case 'paySeat': {
      const pay = roundMoney(B * rng.range(0.06, 0.12));
      op = { ...base, title: 'Pay driver proposal', body: `A wealthy family will pay ${money(pay)} this season if their child joins as your reserve driver. They are not quick.`, choices: [{ id: 'accept', label: 'Sign as reserve', description: `+${money(pay)}, weak reserve driver` }, { id: 'decline', label: 'Decline', description: '' }], data: { pay } };
      break;
    }
    case 'mediaDeal': {
      const fee = roundMoney(B * rng.range(0.02, 0.05));
      op = { ...base, title: 'Documentary crew', body: `A streaming service wants behind-the-scenes access for a season documentary, paying ${money(fee)}. The cameras may unsettle the drivers.`, choices: [{ id: 'accept', label: `Accept ${money(fee)}`, description: '+cash, +reputation, -driver morale' }, { id: 'decline', label: 'Decline', description: '' }], data: { fee } };
      break;
    }
    case 'engineerPoach': {
      const role = rng.pick(STAFF_ROLES.filter((r) => r !== 'academyDirector'));
      const current = staffRating(state, team, role);
      const rating = clamp(Math.round(current + rng.range(8, 16)), 25, 92);
      const salary = roundMoney(staffExpectedSalary(rating, team.division, role) * 1.05);
      const fee = roundMoney(salary * 0.6);
      op = { ...base, title: `${STAFF_ROLE_INFO[role].label} available`, body: `A rated ${STAFF_ROLE_INFO[role].label.toLowerCase()} (rating ${rating}) is unhappy at a rival and willing to join for ${money(salary)} per season plus a ${money(fee)} release fee.`, choices: [{ id: 'accept', label: 'Hire', description: `${money(fee)} fee, ${money(salary)}/season` }, { id: 'decline', label: 'Decline', description: '' }], data: { role, rating, salary, fee } };
      break;
    }
    case 'charity': {
      const cost = roundMoney(B * rng.range(0.008, 0.015));
      op = { ...base, title: 'Charity exhibition', body: `A children's hospital asks the team to headline a charity exhibition. It will cost ${money(cost)} but fans will love it.`, choices: [{ id: 'accept', label: 'Take part', description: '+reputation, +morale' }, { id: 'decline', label: 'Decline', description: '' }], data: { cost } };
      break;
    }
    case 'testDay':
    default: {
      const cost = roundMoney(B * rng.range(0.012, 0.025));
      op = { ...base, kind: 'testDay', title: 'Private test day', body: `A circuit offers an exclusive test day for ${money(cost)}. Mileage builds experience and confidence.`, choices: [{ id: 'accept', label: `Book for ${money(cost)}`, description: '+experience, +confidence for race drivers' }, { id: 'decline', label: 'Decline', description: '' }], data: { cost } };
      break;
    }
  }
  state.player.opportunities.push(op);
  return op;
}

/** AI team bids for one of the player's drivers. */
export function createTransferBid(state: GameState, bidder: Team, driverId: string, fee: number): Opportunity {
  const d = state.drivers[driverId];
  const op: Opportunity = {
    id: nextId(state, 'op'),
    kind: 'transferBid',
    title: `${bidder.name} bid for ${driverName(d)}`,
    body: `${bidder.name} (${DIVISIONS[bidder.division].name}) offer ${money(fee)} to buy out ${driverName(d)}'s contract. ${d.lastName} is keen on the move. Refusing may hurt morale.`,
    choices: [
      { id: 'accept', label: `Sell for ${money(fee)}`, description: 'The driver leaves immediately' },
      { id: 'decline', label: 'Reject the bid', description: 'Driver morale -10' },
    ],
    expiresAbsWeek: currentAbsWeek(state) + 2,
    data: { bidder: bidder.id, driverId, fee },
  };
  state.player.opportunities.push(op);
  addNews(state, { category: 'rumor', headline: `TRANSFER BID: ${bidder.name.toUpperCase()} WANT ${driverName(d).toUpperCase()}`, body: op.body, teamIds: [bidder.id, state.player.teamId], driverIds: [d.id], importance: 3 });
  return op;
}

export function resolveOpportunity(state: GameState, opportunityId: string, choiceId: string): string {
  const op = state.player.opportunities.find((o) => o.id === opportunityId);
  assertRule(op, 'That opportunity has expired.');
  assertRule(op.choices.some((c) => c.id === choiceId), 'Invalid choice.');
  const key = `opportunity:${op.id}`;
  assertRule(!state.processed[key], 'Already resolved.');
  const team = playerTeam(state);
  let message = 'Declined.';
  if (choiceId === 'accept') {
    const n = (k: string) => Number(op.data[k]);
    switch (op.kind) {
      case 'investor':
        postTransaction(state, team, 'investor', n('amount'), 'Investor stake');
        team.boardConfidence = clamp(team.boardConfidence - 10, 0, 100);
        message = `Investment received: ${money(n('amount'))}.`;
        break;
      case 'windTunnel':
        assertRule(team.cash >= n('cost'), 'Not enough cash.');
        postTransaction(state, team, 'development', -n('cost'), 'Rented wind tunnel time');
        team.car.components.aerodynamics = clamp(team.car.components.aerodynamics + n('gain'), 1, 99);
        message = `Aerodynamics improved by +${n('gain')}.`;
        break;
      case 'paySeat': {
        assertRule(!team.reserveDriverId, 'Your reserve seat is already filled.');
        const rng = Rng.from(state.seed, 'payDriver', op.id);
        const d = generateDriver({ rng, ids: state, season: state.season }, { targetOverall: DIVISIONS[team.division].driverRatingMean - 9, age: rng.int(17, 24), division: team.division, archetype: 'payDriver' });
        d.backing = 0;
        state.drivers[d.id] = d;
        executeSigning(state, team, d, { driverId: d.id, role: 'reserve', salary: 0, years: 1, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'number2', startNextSeason: false }, 0);
        postTransaction(state, team, 'driverFunding', n('pay'), `${driverName(d)} family funding`);
        message = `${driverName(d)} joins as reserve, bringing ${money(n('pay'))}.`;
        break;
      }
      case 'mediaDeal':
        postTransaction(state, team, 'other', n('fee'), 'Documentary rights');
        team.reputation = clamp(team.reputation + 1.5, 1, 100);
        for (const d of raceDrivers(state, team)) d.morale = clamp(d.morale - 4, 5, 100);
        message = 'The cameras are rolling.';
        break;
      case 'engineerPoach': {
        const role = op.data.role as (typeof STAFF_ROLES)[number];
        const rng = Rng.from(state.seed, 'poach', op.id);
        const s = generateStaff({ rng, ids: state, season: state.season }, role, n('rating'));
        state.staff[s.id] = s;
        assertRule(team.cash >= n('fee'), 'Not enough cash for the release fee.');
        postTransaction(state, team, 'buyout', -n('fee'), `Release fee: ${s.firstName} ${s.lastName}`);
        const res = hireStaffMember(state, team.id, s.id, n('salary'), 2);
        message = res.message;
        break;
      }
      case 'charity':
        assertRule(team.cash >= n('cost'), 'Not enough cash.');
        postTransaction(state, team, 'other', -n('cost'), 'Charity exhibition');
        team.reputation = clamp(team.reputation + 1, 1, 100);
        for (const d of raceDrivers(state, team)) d.morale = clamp(d.morale + 4, 5, 100);
        message = 'A wonderful day for everyone involved.';
        break;
      case 'testDay':
        assertRule(team.cash >= n('cost'), 'Not enough cash.');
        postTransaction(state, team, 'operations', -n('cost'), 'Private test day');
        for (const d of raceDrivers(state, team)) {
          d.attributes.experience = clamp(d.attributes.experience + 1.5, 1, 99);
          d.confidence = clamp(d.confidence + 8, 5, 95);
        }
        message = 'Valuable mileage for both drivers.';
        break;
      case 'transferBid': {
        const d = state.drivers[String(op.data.driverId)];
        const bidder = state.teams[String(op.data.bidder)];
        assertRule(d?.contract?.teamId === team.id, 'The driver is no longer yours.');
        const salary = expectedSalary(d, bidder.division);
        const seat = bidder.raceDrivers[0] === null ? 0 : bidder.raceDrivers[1] === null ? 1 : 1;
        executeSigning(state, bidder, d, { driverId: d.id, role: 'race', salary, years: 2, signingBonus: 0, winBonus: 0, podiumBonus: 0, status: 'equal', startNextSeason: false, seatIndex: seat as 0 | 1 }, n('fee'), { displace: 'reserve' });
        message = `${driverName(d)} sold to ${bidder.name} for ${money(n('fee'))}.`;
        break;
      }
    }
  } else if (op.kind === 'transferBid') {
    const d = state.drivers[String(op.data.driverId)];
    if (d) d.morale = clamp(d.morale - 10, 5, 100);
    message = 'Bid rejected.';
  }
  state.processed[key] = true;
  state.player.opportunities = state.player.opportunities.filter((o) => o.id !== op.id);
  return message;
}

/** Fair bid value for a driver (used by AI bidders). */
export function bidValue(state: GameState, driverId: string): number {
  const d = state.drivers[driverId];
  return roundMoney(marketValue(d) * 0.9 + overall(d) * 0);
}
