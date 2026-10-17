import type { GameState, Team, TxCategory } from '../types';

export const REVENUE_CATEGORIES: TxCategory[] = ['prize', 'raceBonus', 'sponsor', 'driverFunding', 'investor', 'promotion', 'transferIncome'];

export const CATEGORY_LABELS: Record<TxCategory, string> = {
  prize: 'Prize money',
  raceBonus: 'Race prize money',
  sponsor: 'Sponsorship',
  driverFunding: 'Driver funding',
  investor: 'Investors',
  promotion: 'Promotion bonus',
  transferIncome: 'Transfer income',
  driverSalary: 'Driver salaries',
  staffSalary: 'Staff salaries',
  development: 'Car development',
  facilities: 'Facilities',
  operations: 'Race operations',
  buyout: 'Contract buyouts',
  repairs: 'Repairs',
  entry: 'Entry & licensing',
  signingBonus: 'Signing bonuses',
  severance: 'Severance',
  scouting: 'Scouting',
  academy: 'Academy',
  interest: 'Interest',
  other: 'Other',
};

/**
 * Every money movement goes through here so the ledger always reconciles
 * with the cash balance. Positive = income, negative = expense.
 */
export function postTransaction(state: GameState, team: Team, category: TxCategory, amount: number, label: string): void {
  if (!Number.isFinite(amount)) throw new Error(`Invalid transaction amount for ${team.name}: ${amount}`);
  const rounded = Math.round(amount);
  if (rounded === 0) return;
  team.cash += rounded;
  // AI teams keep a compact ledger: only the player's needs full line items, but
  // every team keeps season category totals for the economy tests.
  if (!team.isPlayer) {
    // One running total per category per season.
    for (let i = team.ledger.length - 1; i >= 0; i--) {
      const tx = team.ledger[i];
      if (tx.season !== state.season) break;
      if (tx.category === category) {
        tx.amount += rounded;
        tx.week = state.week;
        return;
      }
    }
  }
  team.ledger.push({ season: state.season, week: state.week, category, amount: rounded, label });
}

export function seasonTotals(team: Team, season: number): { revenue: number; expenses: number; byCategory: Partial<Record<TxCategory, number>> } {
  let revenue = 0;
  let expenses = 0;
  const byCategory: Partial<Record<TxCategory, number>> = {};
  for (const tx of team.ledger) {
    if (tx.season !== season) continue;
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    if (tx.amount >= 0) revenue += tx.amount;
    else expenses += -tx.amount;
  }
  return { revenue, expenses, byCategory };
}
