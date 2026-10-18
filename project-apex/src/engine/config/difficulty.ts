import type { AIPersonality, Difficulty, FinancialStart, Philosophy } from '../types';

/** What happens to car development over the winter. */
export interface CarDevelopmentRules {
  /** Share of a series' average gain kept at the rollover; below 1 the series is pulled back toward the regulation baseline. */
  fieldKept: number;
  /** Share of each car's advantage over its field kept under stable, minor and major rule changes. */
  carry: { stable: number; minor: number; major: number };
  /** Multiplier on the size of R&D upgrades (bigger when they do not last). */
  upgradeScale: number;
  /** Share of a promoted car's advantage over its old field that it keeps over its new field. */
  promotionCarry: number;
}

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  description: string;
  /** Multiplier on starting cash. */
  startingCash: number;
  /** Multiplier on mechanical failure rate for ALL teams (fair, world-wide). */
  reliabilityMultiplier: number;
  /** AI recruitment aggressiveness multiplier. */
  aiMarketAggression: number;
  /** How negative the player's cash may go before a crisis. Fraction of typical budget. */
  overdraftLimit: number;
  /** Board bailouts available per career (Infinity for casual). */
  bailouts: number;
  /** Severance as a fraction of remaining salary when releasing a driver. */
  severance: number;
  /** The board can sack the player when confidence collapses. */
  canBeSacked: boolean;
  /** Bankruptcy ends the career. */
  bankruptcyEndsCareer: boolean;
  /** Sponsor patience multiplier. */
  sponsorPatience: number;
  /** Multiplier on the value of sponsorship offers made to the player. */
  sponsorIncome: number;
  /** Driver salary demand multiplier. */
  salaryDemand: number;
  /** Car development over the winter for AI teams (the player's car keeps exactly what it was built to). */
  carDevelopment: CarDevelopmentRules;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  casual: {
    id: 'casual',
    label: 'Casual',
    description: 'Generous starting funds and sponsors, forgiving board, rescue loans whenever money runs out. Your car keeps every upgrade, season after season and through promotion. Learn the ropes.',
    startingCash: 1.6,
    reliabilityMultiplier: 0.75,
    aiMarketAggression: 0.8,
    overdraftLimit: 0.5,
    bailouts: Number.POSITIVE_INFINITY,
    severance: 0.35,
    canBeSacked: false,
    bankruptcyEndsCareer: false,
    sponsorPatience: 1.4,
    sponsorIncome: 1.8,
    carDevelopment: { fieldKept: 1, carry: { stable: 1, minor: 1, major: 1 }, upgradeScale: 1, promotionCarry: 1 },
    salaryDemand: 0.9,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'The intended experience. Money is tight, the board is patient, and one emergency rescue is available. Your car keeps every upgrade, season after season and through promotion.',
    startingCash: 1.0,
    reliabilityMultiplier: 1.0,
    aiMarketAggression: 1.0,
    overdraftLimit: 0.3,
    bailouts: 2,
    severance: 0.5,
    canBeSacked: false,
    bankruptcyEndsCareer: false,
    sponsorPatience: 1.0,
    sponsorIncome: 1.35,
    carDevelopment: { fieldKept: 1, carry: { stable: 1, minor: 1, major: 1 }, upgradeScale: 1, promotionCarry: 1 },
    salaryDemand: 1.0,
  },
  realistic: {
    id: 'realistic',
    label: 'Realistic',
    description: 'Sharper rivals, demanding sponsors and a board that will fire you if results and finances collapse. Winter rule changes take back part of every rival\'s development; your car keeps every upgrade.',
    startingCash: 0.85,
    reliabilityMultiplier: 1.15,
    aiMarketAggression: 1.2,
    overdraftLimit: 0.18,
    bailouts: 1,
    severance: 0.75,
    canBeSacked: true,
    bankruptcyEndsCareer: false,
    sponsorPatience: 0.85,
    sponsorIncome: 1.1,
    carDevelopment: { fieldKept: 0.5, carry: { stable: 0.9, minor: 0.8, major: 0.6 }, upgradeScale: 1.15, promotionCarry: 0.5 },
    salaryDemand: 1.08,
  },
  hardcore: {
    id: 'hardcore',
    label: 'Hardcore',
    description: 'Fragile cars, ruthless contract competition, no rescues. Insolvency ends your career. Rivals upgrade faster, but winter rule changes wipe out most of their development; your car keeps every upgrade.',
    startingCash: 0.7,
    reliabilityMultiplier: 1.4,
    aiMarketAggression: 1.4,
    overdraftLimit: 0.1,
    bailouts: 0,
    severance: 1.0,
    canBeSacked: true,
    bankruptcyEndsCareer: true,
    sponsorPatience: 0.7,
    sponsorIncome: 1.0,
    carDevelopment: { fieldKept: 0.2, carry: { stable: 0.82, minor: 0.7, major: 0.42 }, upgradeScale: 1.3, promotionCarry: 0.25 },
    salaryDemand: 1.15,
  },
};

export interface PhilosophyConfig {
  id: Philosophy;
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  /** Multiplier on development of drivers aged 22 and under. */
  youthDevelopment: number;
  /** Multiplier on R&D gains. */
  rndGain: number;
  /** Multiplier on R&D duration. */
  rndDuration: number;
  /** Multiplier on sponsor values. */
  sponsorValue: number;
  /** Multiplier on running costs (operations, upkeep). */
  operatingCosts: number;
  /** Attraction bonus (utility) for young drivers / veterans / aggressive drivers. */
  youngDriverAppeal: number;
  veteranAppeal: number;
  aggressiveAppeal: number;
  /** Extra academy slots. */
  academySlots: number;
  /** Race overtake bonus and collision multiplier (trade-off). */
  overtakeBonus: number;
  collisionMultiplier: number;
  repairCosts: number;
  boardPatience: number;
  moraleBonus: number;
}

export const PHILOSOPHIES: Record<Philosophy, PhilosophyConfig> = {
  youth: {
    id: 'youth',
    label: 'Youth Development',
    summary: 'Find raw talent early and polish it into champions.',
    pros: ['+30% development for drivers aged 22 and under', '+1 academy place', 'Young drivers are drawn to the project'],
    cons: ['-10% sponsorship value (unproven line-ups)', 'Veterans are less interested in joining'],
    youthDevelopment: 1.3,
    rndGain: 1,
    rndDuration: 1,
    sponsorValue: 0.9,
    operatingCosts: 1,
    youngDriverAppeal: 0.35,
    veteranAppeal: -0.35,
    aggressiveAppeal: 0,
    academySlots: 1,
    overtakeBonus: 0,
    collisionMultiplier: 1,
    repairCosts: 1,
    boardPatience: 1.05,
    moraleBonus: 0,
  },
  engineering: {
    id: 'engineering',
    label: 'Engineering First',
    summary: 'The car is the star. Pour resources into the drawing office.',
    pros: ['+15% R&D upgrade gains', '-10% R&D project duration'],
    cons: ['-15% sponsorship value (little marketing)', 'Driver development -10%'],
    youthDevelopment: 0.9,
    rndGain: 1.15,
    rndDuration: 0.9,
    sponsorValue: 0.85,
    operatingCosts: 1,
    youngDriverAppeal: 0,
    veteranAppeal: 0,
    aggressiveAppeal: 0,
    academySlots: 0,
    overtakeBonus: 0,
    collisionMultiplier: 1,
    repairCosts: 1,
    boardPatience: 1,
    moraleBonus: 0,
  },
  financial: {
    id: 'financial',
    label: 'Financial Sustainability',
    summary: 'Spend wisely, never gamble the future of the team.',
    pros: ['-10% operating costs', '+10% sponsorship value', 'The board is more patient'],
    cons: ['R&D projects take 12% longer', 'Ambitious drivers see the team as unambitious'],
    youthDevelopment: 1,
    rndGain: 1,
    rndDuration: 1.12,
    sponsorValue: 1.1,
    operatingCosts: 0.9,
    youngDriverAppeal: 0,
    veteranAppeal: 0.1,
    aggressiveAppeal: -0.2,
    academySlots: 0,
    overtakeBonus: 0,
    collisionMultiplier: 1,
    repairCosts: 1,
    boardPatience: 1.25,
    moraleBonus: 0,
  },
  aggressive: {
    id: 'aggressive',
    label: 'Aggressive Racing',
    summary: 'Win at all costs. Every gap is an opportunity.',
    pros: ['Drivers attack harder: better overtaking odds', 'Racers with fire are attracted to the team'],
    cons: ['+20% collision risk', '+25% repair costs'],
    youthDevelopment: 1,
    rndGain: 1,
    rndDuration: 1,
    sponsorValue: 1,
    operatingCosts: 1,
    youngDriverAppeal: 0,
    veteranAppeal: -0.1,
    aggressiveAppeal: 0.4,
    academySlots: 0,
    overtakeBonus: 0.22,
    collisionMultiplier: 1.2,
    repairCosts: 1.25,
    boardPatience: 0.95,
    moraleBonus: 0,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced Management',
    summary: 'No extremes. A stable, well-run organisation.',
    pros: ['+5 driver morale baseline', 'Slightly more patient board'],
    cons: ['No specialist advantages'],
    youthDevelopment: 1.03,
    rndGain: 1.03,
    rndDuration: 1,
    sponsorValue: 1.02,
    operatingCosts: 1,
    youngDriverAppeal: 0.05,
    veteranAppeal: 0.05,
    aggressiveAppeal: 0.05,
    academySlots: 0,
    overtakeBonus: 0,
    collisionMultiplier: 1,
    repairCosts: 1,
    boardPatience: 1.1,
    moraleBonus: 5,
  },
};

export interface FinancialStartConfig {
  id: FinancialStart;
  label: string;
  description: string;
  cashFactor: number;
  boardPressure: number;
  reputationBonus: number;
}

export const FINANCIAL_STARTS: Record<FinancialStart, FinancialStartConfig> = {
  shoestring: {
    id: 'shoestring',
    label: 'Shoestring',
    description: 'A garage, a van and a lot of hope. Minimal cash, but the board expects little.',
    cashFactor: 0.55,
    boardPressure: 0.8,
    reputationBonus: -2,
  },
  modest: {
    id: 'modest',
    label: 'Modest Backing',
    description: 'A small group of local investors. Enough to compete if you spend wisely.',
    cashFactor: 1,
    boardPressure: 1,
    reputationBonus: 0,
  },
  backed: {
    id: 'backed',
    label: 'Investor Backed',
    description: 'A wealthy backer funds the launch, and expects promotion quickly.',
    cashFactor: 1.6,
    boardPressure: 1.3,
    reputationBonus: 2,
  },
};

export interface AIPersonalityConfig {
  id: AIPersonality;
  label: string;
  description: string;
  /** Share of spare cash committed to R&D each decision. */
  rndAppetite: number;
  /** Preferred R&D scale weights. */
  rndScale: { quick: number; minor: number; major: number; radical: number };
  facilityAppetite: number;
  /** Cash reserve target as a fraction of typical budget. */
  reserve: number;
  /** Willingness to pay over market for drivers. */
  salaryPremium: number;
  youthFocus: number;
  /** Race strategy risk appetite (0 cautious .. 1 bold). */
  raceRisk: number;
  /** Likelihood to replace an underperforming driver. */
  ruthlessness: number;
}

export const AI_PERSONALITIES: Record<AIPersonality, AIPersonalityConfig> = {
  conservative: {
    id: 'conservative',
    label: 'Financially Conservative',
    description: 'Protects the bank balance above all else.',
    rndAppetite: 0.45,
    rndScale: { quick: 0.21, minor: 0.7, major: 0.28, radical: 0.02 },
    facilityAppetite: 0.4,
    reserve: 0.35,
    salaryPremium: 0.85,
    youthFocus: 0.3,
    raceRisk: 0.25,
    ruthlessness: 0.3,
  },
  recruiter: {
    id: 'recruiter',
    label: 'Aggressive Recruiter',
    description: 'Believes the right driver wins championships, and pays for them.',
    rndAppetite: 0.6,
    rndScale: { quick: 0.15, minor: 0.5, major: 0.42, radical: 0.08 },
    facilityAppetite: 0.45,
    reserve: 0.18,
    salaryPremium: 1.35,
    youthFocus: 0.2,
    raceRisk: 0.55,
    ruthlessness: 0.8,
  },
  engineering: {
    id: 'engineering',
    label: 'Engineering-Focused',
    description: 'The car comes first; drivers are interchangeable.',
    rndAppetite: 0.85,
    rndScale: { quick: 0.1, minor: 0.35, major: 0.5, radical: 0.15 },
    facilityAppetite: 0.75,
    reserve: 0.15,
    salaryPremium: 0.9,
    youthFocus: 0.3,
    raceRisk: 0.45,
    ruthlessness: 0.4,
  },
  youth: {
    id: 'youth',
    label: 'Youth Academy Specialist',
    description: 'Builds from within. Signs prospects early, promotes from the academy.',
    rndAppetite: 0.55,
    rndScale: { quick: 0.18, minor: 0.6, major: 0.35, radical: 0.05 },
    facilityAppetite: 0.6,
    reserve: 0.2,
    salaryPremium: 0.95,
    youthFocus: 0.95,
    raceRisk: 0.45,
    ruthlessness: 0.35,
  },
  gambler: {
    id: 'gambler',
    label: 'High-Risk Strategist',
    description: 'Radical upgrades, bold strategies, feast or famine.',
    rndAppetite: 0.8,
    rndScale: { quick: 0.06, minor: 0.2, major: 0.4, radical: 0.4 },
    facilityAppetite: 0.5,
    reserve: 0.08,
    salaryPremium: 1.1,
    youthFocus: 0.4,
    raceRisk: 0.9,
    ruthlessness: 0.6,
  },
  obsessive: {
    id: 'obsessive',
    label: 'Championship Obsessive',
    description: 'Every decision is about the title this year.',
    rndAppetite: 0.9,
    rndScale: { quick: 0.12, minor: 0.4, major: 0.45, radical: 0.15 },
    facilityAppetite: 0.55,
    reserve: 0.1,
    salaryPremium: 1.25,
    youthFocus: 0.15,
    raceRisk: 0.65,
    ruthlessness: 0.9,
  },
};
