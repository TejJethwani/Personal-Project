import type { DivisionId, LiveryPattern } from '../types';

export interface TeamSeed {
  name: string;
  shortName: string;
  nationality: string;
  primary: string;
  secondary: string;
  livery: LiveryPattern;
}

/** Fictional constructors, grouped by their starting division. */
export const TEAM_SEEDS: Record<DivisionId, TeamSeed[]> = {
  F1: [
    { name: 'Valkyr Grand Prix', shortName: 'VAL', nationality: 'GBR', primary: '#0f172a', secondary: '#38bdf8', livery: 'arrow' },
    { name: 'Scuderia Corvino', shortName: 'COR', nationality: 'ITA', primary: '#b91c1c', secondary: '#fde047', livery: 'solid' },
    { name: 'Meridian Works', shortName: 'MER', nationality: 'GER', primary: '#a3a3a3', secondary: '#14b8a6', livery: 'fade' },
    { name: 'Aurelion Racing', shortName: 'AUR', nationality: 'FRA', primary: '#1d4ed8', secondary: '#f472b6', livery: 'split' },
    { name: 'Northstar F1 Team', shortName: 'NST', nationality: 'USA', primary: '#f8fafc', secondary: '#1e3a8a', livery: 'stripe' },
    { name: 'Kaizen Motorsport', shortName: 'KAI', nationality: 'JPN', primary: '#ffffff', secondary: '#dc2626', livery: 'halo' },
    { name: 'Ardent Engineering', shortName: 'ARD', nationality: 'GBR', primary: '#f97316', secondary: '#0f172a', livery: 'arrow' },
    { name: 'Helvetia Racing', shortName: 'HEL', nationality: 'SUI', primary: '#7f1d1d', secondary: '#e5e7eb', livery: 'stripe' },
    { name: 'Bravura GP', shortName: 'BRV', nationality: 'ESP', primary: '#15803d', secondary: '#facc15', livery: 'split' },
    { name: 'Orbital Racing', shortName: 'ORB', nationality: 'AUS', primary: '#6d28d9', secondary: '#22d3ee', livery: 'fade' },
  ],
  F2: [
    { name: 'Lindqvist Racing', shortName: 'LIN', nationality: 'SWE', primary: '#0369a1', secondary: '#fde68a', livery: 'stripe' },
    { name: 'Prisma Motorsport', shortName: 'PRI', nationality: 'NED', primary: '#ea580c', secondary: '#1e293b', livery: 'arrow' },
    { name: 'Carrera Junior', shortName: 'CAR', nationality: 'ITA', primary: '#be123c', secondary: '#f1f5f9', livery: 'solid' },
    { name: 'Vector Racing', shortName: 'VEC', nationality: 'GER', primary: '#111827', secondary: '#a3e635', livery: 'halo' },
    { name: 'Equinox GP', shortName: 'EQX', nationality: 'FRA', primary: '#4338ca', secondary: '#fbbf24', livery: 'split' },
    { name: 'Rapier Racing', shortName: 'RAP', nationality: 'GBR', primary: '#334155', secondary: '#f43f5e', livery: 'stripe' },
    { name: 'Tempesta Corse', shortName: 'TEM', nationality: 'ITA', primary: '#0e7490', secondary: '#f8fafc', livery: 'fade' },
    { name: 'Pacific Velocity', shortName: 'PAC', nationality: 'NZL', primary: '#065f46', secondary: '#e2e8f0', livery: 'arrow' },
    { name: 'Condor Motorsport', shortName: 'CDR', nationality: 'ARG', primary: '#78350f', secondary: '#38bdf8', livery: 'split' },
    { name: 'Saber Racing', shortName: 'SAB', nationality: 'USA', primary: '#9f1239', secondary: '#0f172a', livery: 'halo' },
  ],
  F3: [
    { name: 'Hartley Motorsport', shortName: 'HAR', nationality: 'GBR', primary: '#1e40af', secondary: '#fafafa', livery: 'stripe' },
    { name: 'Equipe Lumière', shortName: 'LUM', nationality: 'FRA', primary: '#fef3c7', secondary: '#1e3a8a', livery: 'solid' },
    { name: 'Rhein Racing', shortName: 'RHE', nationality: 'GER', primary: '#525252', secondary: '#facc15', livery: 'arrow' },
    { name: 'Vortex Racing', shortName: 'VOR', nationality: 'NED', primary: '#7c3aed', secondary: '#fb923c', livery: 'fade' },
    { name: 'Iberia Competición', shortName: 'IBE', nationality: 'ESP', primary: '#dc2626', secondary: '#fcd34d', livery: 'split' },
    { name: 'Granite Racing', shortName: 'GRA', nationality: 'AUS', primary: '#57534e', secondary: '#22c55e', livery: 'halo' },
    { name: 'Polaris Motorsport', shortName: 'POL', nationality: 'FIN', primary: '#e0f2fe', secondary: '#0c4a6e', livery: 'stripe' },
    { name: 'Samurai Racing', shortName: 'SAM', nationality: 'JPN', primary: '#18181b', secondary: '#ef4444', livery: 'arrow' },
    { name: 'Copperline GP', shortName: 'CPL', nationality: 'CAN', primary: '#b45309', secondary: '#0f172a', livery: 'solid' },
    { name: 'Alba Racing', shortName: 'ALB', nationality: 'IRL', primary: '#047857', secondary: '#fef9c3', livery: 'split' },
  ],
  F4: [
    { name: 'Kessler Junior Racing', shortName: 'KES', nationality: 'GER', primary: '#0f766e', secondary: '#f8fafc', livery: 'stripe' },
    { name: 'Torino Giovani', shortName: 'TOR', nationality: 'ITA', primary: '#1d4ed8', secondary: '#ef4444', livery: 'split' },
    { name: 'Northfield Motorsport', shortName: 'NOR', nationality: 'GBR', primary: '#166534', secondary: '#fde047', livery: 'solid' },
    { name: 'Maple Leaf Racing', shortName: 'MAP', nationality: 'CAN', primary: '#dc2626', secondary: '#ffffff', livery: 'halo' },
    { name: 'Pampas Racing', shortName: 'PAM', nationality: 'ARG', primary: '#60a5fa', secondary: '#ffffff', livery: 'stripe' },
    { name: 'Lusitano Motorsport', shortName: 'LUS', nationality: 'POR', primary: '#14532d', secondary: '#dc2626', livery: 'arrow' },
    { name: 'Danube Racing', shortName: 'DAN', nationality: 'AUT', primary: '#991b1b', secondary: '#f1f5f9', livery: 'fade' },
    { name: 'Copacabana Racing', shortName: 'COP', nationality: 'BRA', primary: '#facc15', secondary: '#15803d', livery: 'split' },
    { name: 'Bluewater Motorsport', shortName: 'BLU', nationality: 'AUS', primary: '#0284c7', secondary: '#fef08a', livery: 'arrow' },
    { name: 'Vistula Racing', shortName: 'VIS', nationality: 'POL', primary: '#f8fafc', secondary: '#be123c', livery: 'halo' },
  ],
  F5: [
    { name: 'Garage 47 Racing', shortName: 'G47', nationality: 'GBR', primary: '#334155', secondary: '#f59e0b', livery: 'stripe' },
    { name: 'Rookie Republic', shortName: 'ROO', nationality: 'USA', primary: '#2563eb', secondary: '#f8fafc', livery: 'arrow' },
    { name: 'Scuderia Piccola', shortName: 'PIC', nationality: 'ITA', primary: '#e11d48', secondary: '#fafaf9', livery: 'solid' },
    { name: 'Midnight Motorsport', shortName: 'MID', nationality: 'NED', primary: '#1e1b4b', secondary: '#a78bfa', livery: 'fade' },
    { name: 'Fjord Racing', shortName: 'FJO', nationality: 'NOR', primary: '#0891b2', secondary: '#f8fafc', livery: 'split' },
    { name: 'Tarmac Bandits', shortName: 'TAB', nationality: 'AUS', primary: '#ca8a04', secondary: '#1c1917', livery: 'halo' },
    { name: 'Cerro Racing', shortName: 'CER', nationality: 'MEX', primary: '#16a34a', secondary: '#dc2626', livery: 'stripe' },
    { name: 'Bohemia Motorsport', shortName: 'BOH', nationality: 'CZE', primary: '#7c2d12', secondary: '#fde68a', livery: 'arrow' },
    { name: 'Sakura Junior', shortName: 'SAK', nationality: 'JPN', primary: '#fbcfe8', secondary: '#1f2937', livery: 'split' },
  ],
};

export const SPONSOR_PREFIXES = [
  'Apex', 'Nova', 'Quantum', 'Helix', 'Stratus', 'Zenith', 'Atlas', 'Ember', 'Cobalt', 'Lumen', 'Onyx', 'Pulse', 'Vanta', 'Kinetic',
  'Solace', 'Arbor', 'Titan', 'Mistral', 'Crescent', 'Polar', 'Radiant', 'Summit', 'Verdant', 'Halcyon', 'Ironbridge', 'Bluefin',
  'Copperleaf', 'Northgate', 'Silverline', 'Redwood', 'Falcon', 'Aurora', 'Tidewater', 'Granite', 'Brightwave', 'Keystone',
];

export const SPONSOR_INDUSTRIES: { industry: string; suffixes: string[] }[] = [
  { industry: 'Energy Drinks', suffixes: ['Energy', 'Fuel Drinks', 'Charge'] },
  { industry: 'Telecoms', suffixes: ['Mobile', 'Telecom', 'Networks'] },
  { industry: 'Banking', suffixes: ['Bank', 'Capital', 'Financial'] },
  { industry: 'Technology', suffixes: ['Systems', 'Labs', 'Software', 'Computing'] },
  { industry: 'Logistics', suffixes: ['Logistics', 'Freight', 'Cargo'] },
  { industry: 'Lubricants', suffixes: ['Lubricants', 'Oils', 'Petroleum'] },
  { industry: 'Watches', suffixes: ['Watches', 'Chronographs', 'Timepieces'] },
  { industry: 'Apparel', suffixes: ['Apparel', 'Sportswear', 'Outfitters'] },
  { industry: 'Crypto', suffixes: ['Chain', 'Exchange', 'Tokens'] },
  { industry: 'Aviation', suffixes: ['Airways', 'Aerospace', 'Jets'] },
  { industry: 'Tyres & Parts', suffixes: ['Components', 'Parts', 'Bearings'] },
  { industry: 'Insurance', suffixes: ['Insurance', 'Assurance', 'Mutual'] },
  { industry: 'Media', suffixes: ['Media', 'Broadcasting', 'Studios'] },
  { industry: 'Construction', suffixes: ['Construction', 'Builders', 'Steel'] },
  { industry: 'Local Business', suffixes: ['Motors', 'Garage', 'Tyres', 'Hardware'] },
];
