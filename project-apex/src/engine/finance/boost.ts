import { playerTeam } from '../selectors';
import type { GameState } from '../types';
import { assertRule, roundMoney } from '../util';
import { postTransaction } from './ledger';

/**
 * Starting money options. A cash boost is extra money put in when the career
 * is created, on top of the team's own budget, recorded once in the ledger.
 * Sandbox money is a separate cheat: the bank is topped up whenever it runs
 * low, and the career is marked as a sandbox (no achievements).
 */

export const BOOST_PRESETS = [
  { id: 'none', label: 'No boost', amount: 0 },
  { id: 'small', label: 'Small boost', amount: 5_000_000 },
  { id: 'medium', label: 'Medium boost', amount: 25_000_000 },
  { id: 'large', label: 'Large boost', amount: 100_000_000 },
  { id: 'massive', label: 'Massive boost', amount: 500_000_000 },
] as const;

/** Largest custom boost accepted. */
export const MAX_CASH_BOOST = 5_000_000_000;

/** Balance the sandbox keeps the team at or above. */
export const SANDBOX_FLOOR = 1_000_000_000;

export function cashBoostProblem(amount: number): string | null {
  if (!Number.isFinite(amount)) return 'Enter an amount.';
  if (amount < 0) return 'A boost cannot be negative.';
  if (amount > MAX_CASH_BOOST) return `The most you can add is $${MAX_CASH_BOOST / 1_000_000_000} billion.`;
  return null;
}

/** Apply the starting money choices of a new career (called once, at creation). */
export function applyStartingMoney(state: GameState, cashBoost: number | undefined, sandbox: boolean | undefined): void {
  const team = playerTeam(state);
  const problem = cashBoostProblem(cashBoost ?? 0);
  assertRule(!problem, problem ?? '');
  const boost = roundMoney(cashBoost ?? 0);
  if (boost > 0) postTransaction(state, team, 'investor', boost, 'Starting cash boost');
  state.player.startingBoost = boost;
  if (sandbox) setSandboxMoney(state, true);
}

/** Switch sandbox money on or off. Once used, the career stays marked as a sandbox. */
export function setSandboxMoney(state: GameState, on: boolean): void {
  state.settings.sandboxMoney = on;
  if (on) {
    state.settings.sandboxUsed = true;
    sandboxTopUp(state);
  }
}

/** Sandbox money: refill the bank whenever it drops below the floor. */
export function sandboxTopUp(state: GameState): void {
  if (!state.settings.sandboxMoney) return;
  const team = state.teams[state.player.teamId];
  if (!team || team.cash >= SANDBOX_FLOOR) return;
  postTransaction(state, team, 'investor', SANDBOX_FLOOR - team.cash, 'Sandbox funds');
}
