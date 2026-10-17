import type { Circuit, DivisionId, PaceComponentKey } from '../types';

/**
 * Circuit database. Characteristics are hand-tuned so tracks play differently:
 * power circuits reward straight-line speed and power units, street circuits
 * reward downforce, mechanical grip and driver skill, and so on.
 */
interface CircuitSeed {
  id: string;
  name: string;
  location: string;
  country: string;
  laps: number;
  lap: number;
  km: number;
  /** power, downforce, mechanical, braking demand 0..1 */
  p: number;
  d: number;
  m: number;
  b: number;
  od: number;
  tire: number;
  rain: number;
  temp: number;
  pit: number;
  sc: number;
  demand: number;
  type: Circuit['type'];
  tiers: DivisionId[];
  order: number;
  character: string;
  layout?: Circuit['layout'];
  /** Fuel intensity (full-throttle share); burn per lap scales with it and the lap length. */
  fuel?: number;
  alt?: number;
  vol?: number;
}

const SEEDS: CircuitSeed[] = [
  { id: 'sakhir', name: 'Sakhir International Circuit', location: 'Sakhir', country: 'BHR', laps: 57, lap: 93, km: 5.41, p: 0.6, d: 0.5, m: 0.5, b: 0.8, od: 0.3, tire: 1.25, rain: 0.02, temp: 38, pit: 22, sc: 0.8, demand: 0.4, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.02, character: 'Abrasive desert track with heavy braking zones. Tyre management under the floodlights.' },
  { id: 'jeddah', name: 'Jeddah Corniche Circuit', location: 'Jeddah', country: 'KSA', laps: 50, lap: 90, km: 6.17, p: 0.85, d: 0.4, m: 0.3, b: 0.5, od: 0.45, tire: 0.85, rain: 0.02, temp: 34, pit: 20, sc: 1.5, demand: 0.7, type: 'street', tiers: ['F1', 'F2'], order: 0.06, character: 'Blisteringly fast street circuit lined by walls. Safety cars are common.' },
  { id: 'melbourne', name: 'Albert Park Circuit', location: 'Melbourne', country: 'AUS', laps: 58, lap: 80, km: 5.28, p: 0.55, d: 0.55, m: 0.5, b: 0.6, od: 0.55, tire: 0.95, rain: 0.15, temp: 30, pit: 19, sc: 1.3, demand: 0.6, type: 'hybrid', tiers: ['F1', 'F2', 'F3'], order: 0.1, character: 'Semi-street parkland track. Green surface, quick changes in grip.' },
  { id: 'suzuka', name: 'Suzuka Circuit', location: 'Suzuka', country: 'JPN', laps: 53, lap: 91, km: 5.81, p: 0.5, d: 0.85, m: 0.5, b: 0.4, od: 0.6, tire: 1.2, rain: 0.25, temp: 28, pit: 22, sc: 0.9, demand: 0.75, type: 'permanent', tiers: ['F1', 'F2'], order: 0.14, character: 'Figure-of-eight classic. The Esses punish an unbalanced car.' },
  { id: 'shanghai', name: 'Shanghai International Circuit', location: 'Shanghai', country: 'CHN', laps: 56, lap: 95, km: 5.45, p: 0.65, d: 0.6, m: 0.45, b: 0.7, od: 0.35, tire: 1.05, rain: 0.15, temp: 29, pit: 23, sc: 0.9, demand: 0.45, type: 'permanent', tiers: ['F1'], order: 0.18, character: 'Long back straight and front-left tyre torture through turn one.' },
  { id: 'miami', name: 'Miami International Autodrome', location: 'Miami', country: 'USA', laps: 57, lap: 90, km: 5.41, p: 0.7, d: 0.5, m: 0.4, b: 0.6, od: 0.45, tire: 1.0, rain: 0.2, temp: 42, pit: 20, sc: 1.2, demand: 0.5, type: 'street', tiers: ['F1'], order: 0.22, character: 'Hot, slippery temporary circuit around the stadium.' },
  { id: 'imola', name: 'Autodromo Enzo e Dino Ferrari', location: 'Imola', country: 'ITA', laps: 63, lap: 77, km: 4.91, p: 0.55, d: 0.6, m: 0.55, b: 0.6, od: 0.75, tire: 1.0, rain: 0.25, temp: 27, pit: 28, sc: 1.1, demand: 0.65, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.26, character: 'Old-school, narrow and unforgiving. Track position is everything.' },
  { id: 'monaco', name: 'Circuit de Monaco', location: 'Monte Carlo', country: 'MON', laps: 78, lap: 73, km: 3.34, p: 0.1, d: 0.95, m: 0.9, b: 0.65, od: 0.97, tire: 0.6, rain: 0.15, temp: 35, pit: 19, sc: 1.4, demand: 0.95, type: 'street', tiers: ['F1', 'F2', 'F3'], order: 0.3, character: 'The jewel. Overtaking almost impossible; qualifying decides the race.' },
  { id: 'barcelona', name: 'Circuit de Barcelona-Catalunya', location: 'Montmeló', country: 'ESP', laps: 66, lap: 79, km: 4.66, p: 0.45, d: 0.85, m: 0.55, b: 0.4, od: 0.65, tire: 1.3, rain: 0.1, temp: 36, pit: 22, sc: 0.7, demand: 0.45, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.34, character: 'The ultimate aerodynamic test. Every team knows it, few master it.' },
  { id: 'montreal', name: 'Circuit Île Notre-Dame', location: 'Montréal', country: 'CAN', laps: 70, lap: 75, km: 4.36, p: 0.8, d: 0.3, m: 0.4, b: 0.9, od: 0.35, tire: 0.85, rain: 0.25, temp: 30, pit: 19, sc: 1.5, demand: 0.6, type: 'hybrid', tiers: ['F1'], order: 0.38, character: 'Stop-start island track. Brakes are hammered and the walls bite.' },
  { id: 'spielberg', name: 'Spielberg Ring', location: 'Spielberg', country: 'AUT', laps: 71, lap: 66, km: 4.32, p: 0.75, d: 0.45, m: 0.4, b: 0.75, od: 0.35, tire: 1.0, rain: 0.25, temp: 32, pit: 21, sc: 1.0, demand: 0.45, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.42, character: 'Short, punchy lap in the mountains. Tight midfield, lots of passing.' },
  { id: 'silverstone', name: 'Silverstone Circuit', location: 'Silverstone', country: 'GBR', laps: 52, lap: 88, km: 5.89, p: 0.6, d: 0.9, m: 0.45, b: 0.35, od: 0.4, tire: 1.25, rain: 0.35, temp: 26, pit: 21, sc: 1.0, demand: 0.6, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.46, character: 'High-speed sweeps. Maggotts and Becketts reward downforce.' },
  { id: 'spa', name: 'Circuit de Spa-Francorchamps', location: 'Stavelot', country: 'BEL', laps: 44, lap: 106, km: 7.0, p: 0.85, d: 0.6, m: 0.4, b: 0.5, od: 0.25, tire: 1.1, rain: 0.45, temp: 22, pit: 20, sc: 1.2, demand: 0.7, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.52, character: 'Forest legend. Rain on one side of the track, sun on the other.' },
  { id: 'hungaroring', name: 'Hungaroring', location: 'Mogyoród', country: 'HUN', laps: 70, lap: 78, km: 4.38, p: 0.25, d: 0.85, m: 0.7, b: 0.45, od: 0.85, tire: 1.05, rain: 0.15, temp: 40, pit: 21, sc: 0.8, demand: 0.55, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.56, character: 'Monaco without walls. Twisty, hot and hard on cooling.' },
  { id: 'zandvoort', name: 'Circuit Zandvoort', location: 'Zandvoort', country: 'NED', laps: 72, lap: 72, km: 4.26, p: 0.35, d: 0.85, m: 0.6, b: 0.35, od: 0.85, tire: 1.05, rain: 0.3, temp: 26, pit: 21, sc: 1.1, demand: 0.7, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.6, character: 'Banked corners in the dunes. Narrow and old-fashioned.' },
  { id: 'monza', name: 'Autodromo di Monza', location: 'Monza', country: 'ITA', laps: 53, lap: 82, km: 5.79, p: 1.0, d: 0.1, m: 0.35, b: 0.85, od: 0.2, tire: 0.85, rain: 0.15, temp: 32, pit: 24, sc: 1.0, demand: 0.4, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.64, character: 'The Temple of Speed. Low drag and power are everything.' },
  { id: 'baku', name: 'Baku City Circuit', location: 'Baku', country: 'AZE', laps: 51, lap: 103, km: 6.0, p: 0.9, d: 0.35, m: 0.6, b: 0.8, od: 0.3, tire: 0.8, rain: 0.05, temp: 30, pit: 20, sc: 1.6, demand: 0.8, type: 'street', tiers: ['F1', 'F2'], order: 0.68, character: 'Two-kilometre flat-out blast and a castle-section squeeze.' },
  { id: 'singapore', name: 'Marina Bay Street Circuit', location: 'Singapore', country: 'SGP', laps: 62, lap: 93, km: 4.94, p: 0.25, d: 0.85, m: 0.8, b: 0.8, od: 0.8, tire: 1.1, rain: 0.3, temp: 36, pit: 28, sc: 1.7, demand: 0.9, type: 'street', tiers: ['F1'], order: 0.72, character: 'Humid night race. Physically brutal and a safety-car magnet.' },
  { id: 'austin', name: 'Circuit of Austin', location: 'Austin', country: 'USA', laps: 56, lap: 96, km: 5.51, p: 0.6, d: 0.65, m: 0.6, b: 0.6, od: 0.4, tire: 1.15, rain: 0.15, temp: 34, pit: 21, sc: 1.0, demand: 0.55, type: 'permanent', tiers: ['F1'], order: 0.76, character: 'Bumpy, varied and borrowed from the classics.' },
  { id: 'mexico', name: 'Autódromo de la Ciudad', location: 'Mexico City', country: 'MEX', laps: 71, lap: 78, km: 4.3, p: 0.8, d: 0.6, m: 0.35, b: 0.6, od: 0.45, tire: 0.9, rain: 0.1, temp: 38, pit: 22, sc: 1.0, demand: 0.5, type: 'permanent', tiers: ['F1'], order: 0.8, character: 'Thin air at altitude. Cooling and power units struggle.' },
  { id: 'interlagos', name: 'Interlagos', location: 'São Paulo', country: 'BRA', laps: 71, lap: 71, km: 4.31, p: 0.6, d: 0.55, m: 0.55, b: 0.55, od: 0.35, tire: 1.0, rain: 0.4, temp: 32, pit: 21, sc: 1.3, demand: 0.7, type: 'permanent', tiers: ['F1', 'F2'], order: 0.84, character: 'Anti-clockwise drama bowl. Sudden storms rewrite races.' },
  { id: 'lasvegas', name: 'Las Vegas Strip Circuit', location: 'Las Vegas', country: 'USA', laps: 50, lap: 94, km: 6.2, p: 0.9, d: 0.3, m: 0.3, b: 0.6, od: 0.35, tire: 0.75, rain: 0.02, temp: 14, pit: 21, sc: 1.3, demand: 0.5, type: 'street', tiers: ['F1'], order: 0.88, character: 'Cold night, long straights, tyres that refuse to switch on.' },
  { id: 'lusail', name: 'Lusail International Circuit', location: 'Lusail', country: 'QAT', laps: 57, lap: 84, km: 5.42, p: 0.45, d: 0.8, m: 0.5, b: 0.35, od: 0.55, tire: 1.4, rain: 0.02, temp: 30, pit: 25, sc: 0.7, demand: 0.5, type: 'permanent', tiers: ['F1', 'F2'], order: 0.92, character: 'Flowing medium-speed corners. Tyres are on a knife edge.' },
  { id: 'yasmarina', name: 'Yas Marina Circuit', location: 'Abu Dhabi', country: 'UAE', laps: 58, lap: 86, km: 5.28, p: 0.65, d: 0.6, m: 0.55, b: 0.65, od: 0.5, tire: 0.95, rain: 0.02, temp: 32, pit: 22, sc: 0.7, demand: 0.45, type: 'permanent', tiers: ['F1', 'F2'], order: 0.97, character: 'Twilight finale. Titles have been won and lost here.' },
  { id: 'brandshatch', name: 'Brands Hatch', location: 'Kent', country: 'GBR', laps: 75, lap: 72, km: 3.91, p: 0.4, d: 0.6, m: 0.6, b: 0.5, od: 0.7, tire: 1.0, rain: 0.35, temp: 22, pit: 22, sc: 1.1, demand: 0.7, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.45, character: 'Roller-coaster natural amphitheatre. Paddock Hill bend separates the brave.' },
  { id: 'hockenheim', name: 'Hockenheimring', location: 'Hockenheim', country: 'GER', laps: 67, lap: 76, km: 4.57, p: 0.75, d: 0.5, m: 0.45, b: 0.75, od: 0.35, tire: 1.0, rain: 0.25, temp: 28, pit: 20, sc: 0.9, demand: 0.45, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.55, character: 'Stadium section and a long hairpin made for late-braking moves.' },
  { id: 'nurburgring', name: 'Nürburgring GP-Strecke', location: 'Nürburg', country: 'GER', laps: 60, lap: 88, km: 5.15, p: 0.55, d: 0.6, m: 0.55, b: 0.6, od: 0.45, tire: 1.0, rain: 0.4, temp: 20, pit: 21, sc: 1.0, demand: 0.55, type: 'permanent', tiers: ['F4', 'F3', 'F2'], order: 0.62, character: 'Eifel mountains weather lottery on a modern layout.' },
  { id: 'mugello', name: 'Mugello Circuit', location: 'Scarperia', country: 'ITA', laps: 59, lap: 78, km: 5.25, p: 0.6, d: 0.8, m: 0.45, b: 0.45, od: 0.7, tire: 1.25, rain: 0.15, temp: 30, pit: 22, sc: 1.0, demand: 0.7, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.4, character: 'Tuscan hills, fast changes of direction, gravel waiting.' },
  { id: 'vallelunga', name: 'Vallelunga', location: 'Campagnano', country: 'ITA', laps: 76, lap: 70, km: 4.09, p: 0.4, d: 0.55, m: 0.6, b: 0.55, od: 0.6, tire: 0.95, rain: 0.2, temp: 28, pit: 20, sc: 1.0, demand: 0.5, type: 'permanent', tiers: ['F5', 'F4'], order: 0.3, character: 'Compact Roman circuit, the classic junior-formula proving ground.' },
  { id: 'paulricard', name: 'Circuit Paul Ricard', location: 'Le Castellet', country: 'FRA', laps: 53, lap: 92, km: 5.84, p: 0.7, d: 0.6, m: 0.4, b: 0.5, od: 0.4, tire: 1.0, rain: 0.1, temp: 34, pit: 22, sc: 0.6, demand: 0.35, type: 'permanent', tiers: ['F5', 'F4', 'F3', 'F2'], order: 0.5, character: 'Blue-and-red run-off and the Mistral straight. Track limits galore.' },
  { id: 'magnycours', name: 'Magny-Cours', location: 'Nevers', country: 'FRA', laps: 70, lap: 75, km: 4.41, p: 0.5, d: 0.6, m: 0.6, b: 0.6, od: 0.6, tire: 1.0, rain: 0.2, temp: 28, pit: 21, sc: 0.9, demand: 0.45, type: 'permanent', tiers: ['F5', 'F4'], order: 0.58, character: 'Smooth surface and the Adelaide hairpin.' },
  { id: 'pau', name: 'Circuit de Pau-Ville', location: 'Pau', country: 'FRA', laps: 80, lap: 70, km: 2.76, p: 0.1, d: 0.7, m: 0.9, b: 0.7, od: 0.95, tire: 0.8, rain: 0.25, temp: 25, pit: 18, sc: 1.6, demand: 0.9, type: 'street', tiers: ['F5', 'F4', 'F3'], order: 0.2, character: 'Historic street race through the town. Walls everywhere.' },
  { id: 'estoril', name: 'Circuito do Estoril', location: 'Estoril', country: 'POR', laps: 70, lap: 82, km: 4.18, p: 0.55, d: 0.6, m: 0.55, b: 0.6, od: 0.5, tire: 1.1, rain: 0.1, temp: 30, pit: 21, sc: 0.9, demand: 0.5, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.7, character: 'Atlantic winds and a long, dusty main straight.' },
  { id: 'jerez', name: 'Circuito de Jerez', location: 'Jerez', country: 'ESP', laps: 69, lap: 80, km: 4.43, p: 0.4, d: 0.65, m: 0.6, b: 0.5, od: 0.65, tire: 1.15, rain: 0.05, temp: 34, pit: 21, sc: 0.8, demand: 0.5, type: 'permanent', tiers: ['F5', 'F4'], order: 0.15, character: 'Sunny Andalusian test track; hot asphalt chews tyres.' },
  { id: 'assen', name: 'TT Circuit Assen', location: 'Assen', country: 'NED', laps: 63, lap: 80, km: 4.54, p: 0.45, d: 0.7, m: 0.5, b: 0.4, od: 0.5, tire: 1.1, rain: 0.35, temp: 22, pit: 20, sc: 0.9, demand: 0.55, type: 'permanent', tiers: ['F5', 'F4'], order: 0.48, character: 'Cathedral of speed for bikes; flowing for cars too.' },
  { id: 'brno', name: 'Masaryk Circuit', location: 'Brno', country: 'CZE', laps: 57, lap: 92, km: 5.4, p: 0.55, d: 0.65, m: 0.55, b: 0.5, od: 0.45, tire: 1.0, rain: 0.25, temp: 26, pit: 21, sc: 0.8, demand: 0.5, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.66, character: 'Elevation changes through the Moravian woods.' },
  { id: 'anderstorp', name: 'Anderstorp Raceway', location: 'Anderstorp', country: 'SWE', laps: 70, lap: 79, km: 4.02, p: 0.7, d: 0.4, m: 0.5, b: 0.6, od: 0.45, tire: 0.95, rain: 0.3, temp: 22, pit: 20, sc: 0.8, demand: 0.45, type: 'permanent', tiers: ['F5', 'F4'], order: 0.52, character: 'Airfield straight and long looping corners.' },
  { id: 'knockhill', name: 'Knockhill', location: 'Fife', country: 'GBR', laps: 90, lap: 55, km: 2.07, p: 0.2, d: 0.5, m: 0.7, b: 0.5, od: 0.75, tire: 0.9, rain: 0.5, temp: 18, pit: 18, sc: 1.2, demand: 0.65, type: 'permanent', tiers: ['F5'], order: 0.6, character: 'Tiny Scottish hillside track. Blink and you miss a lap.' },
  { id: 'oultonpark', name: 'Oulton Park', location: 'Cheshire', country: 'GBR', laps: 65, lap: 84, km: 4.31, p: 0.35, d: 0.55, m: 0.75, b: 0.5, od: 0.75, tire: 1.0, rain: 0.4, temp: 20, pit: 21, sc: 1.2, demand: 0.8, type: 'permanent', tiers: ['F5', 'F4'], order: 0.35, character: 'Narrow, undulating parkland. Respect it or end in the trees.' },
  { id: 'lagunaseca', name: 'Laguna Seca Raceway', location: 'Monterey', country: 'USA', laps: 75, lap: 78, km: 3.6, p: 0.35, d: 0.6, m: 0.7, b: 0.55, od: 0.65, tire: 1.0, rain: 0.1, temp: 26, pit: 20, sc: 1.0, demand: 0.75, type: 'permanent', tiers: ['F5', 'F4', 'F3'], order: 0.78, character: 'The Corkscrew: a blind, plunging chicane.' },
  { id: 'roadamerica', name: 'Road America', location: 'Elkhart Lake', country: 'USA', laps: 45, lap: 112, km: 6.5, p: 0.85, d: 0.5, m: 0.5, b: 0.6, od: 0.3, tire: 0.95, rain: 0.3, temp: 28, pit: 21, sc: 1.1, demand: 0.6, type: 'permanent', tiers: ['F4', 'F3', 'F2'], order: 0.5, character: 'Four miles of Wisconsin countryside and slipstream battles.' },
  { id: 'fuji', name: 'Fuji Speedway', location: 'Oyama', country: 'JPN', laps: 66, lap: 85, km: 4.56, p: 0.8, d: 0.55, m: 0.45, b: 0.6, od: 0.4, tire: 1.0, rain: 0.35, temp: 26, pit: 21, sc: 1.0, demand: 0.5, type: 'permanent', tiers: ['F4', 'F3', 'F2'], order: 0.74, character: 'A kilometre-and-a-half straight beneath the mountain.' },
  { id: 'sepang', name: 'Sepang International Circuit', location: 'Sepang', country: 'MAS', laps: 56, lap: 95, km: 5.54, p: 0.65, d: 0.65, m: 0.5, b: 0.6, od: 0.35, tire: 1.25, rain: 0.45, temp: 40, pit: 22, sc: 0.9, demand: 0.5, type: 'permanent', tiers: ['F3', 'F2'], order: 0.82, character: 'Tropical heat and afternoon monsoons.' },
  { id: 'zolder', name: 'Circuit Zolder', location: 'Heusden-Zolder', country: 'BEL', laps: 70, lap: 80, km: 4.01, p: 0.45, d: 0.55, m: 0.6, b: 0.65, od: 0.65, tire: 1.0, rain: 0.35, temp: 22, pit: 20, sc: 1.0, demand: 0.55, type: 'permanent', tiers: ['F5', 'F4'], order: 0.25, character: 'Chicanes in the pine forest; braking stability rewarded.' },
  { id: 'panorama', name: 'Mount Panorama', location: 'Bathurst', country: 'AUS', laps: 45, lap: 120, km: 6.21, p: 0.8, d: 0.5, m: 0.6, b: 0.7, od: 0.5, tire: 1.0, rain: 0.25, temp: 24, pit: 22, sc: 1.7, demand: 0.9, type: 'hybrid', tiers: ['F4', 'F3'], order: 0.9, character: 'Public-road mountain climb. The Esses at the top are terrifying.' },
  { id: 'kyalami', name: 'Kyalami Circuit', location: 'Midrand', country: 'RSA', laps: 65, lap: 82, km: 4.53, p: 0.55, d: 0.6, m: 0.55, b: 0.55, od: 0.5, tire: 1.05, rain: 0.2, temp: 30, pit: 21, sc: 0.9, demand: 0.5, type: 'permanent', tiers: ['F4', 'F3', 'F2'], order: 0.05, character: 'High-altitude highveld circuit with a flowing rhythm.' },
  { id: 'portimao', name: 'Autódromo do Algarve', location: 'Portimão', country: 'POR', laps: 66, lap: 82, km: 4.65, p: 0.55, d: 0.65, m: 0.55, b: 0.5, od: 0.55, tire: 1.1, rain: 0.1, temp: 30, pit: 22, sc: 0.9, demand: 0.6, type: 'permanent', tiers: ['F4', 'F3', 'F2'], order: 0.86, character: 'Blind crests and dips: a roller-coaster in the Algarve.' },
  { id: 'macau', name: 'Guia Circuit', location: 'Macau', country: 'MAC', laps: 60, lap: 132, km: 6.12, p: 0.7, d: 0.5, m: 0.8, b: 0.8, od: 0.8, tire: 0.85, rain: 0.2, temp: 28, pit: 22, sc: 1.9, demand: 0.95, type: 'street', tiers: ['F4', 'F3'], order: 0.95, character: 'The legendary street race. Lisboa bend has ended many careers.' },
];

/**
 * Second generation of venues: categories from ultra-short club tracks to
 * extreme-endurance mountain loops, street circuits, speed bowls, stop-and-go
 * braking tracks and changeable-weather coastlines. Many give the European
 * associations a home track of their own.
 */
const S = (id: string, name: string, location: string, country: string, km: number, avgKmh: number, x: Omit<CircuitSeed, 'id' | 'name' | 'location' | 'country' | 'km' | 'lap' | 'laps'> & { laps?: number }): CircuitSeed => ({
  id,
  name,
  location,
  country,
  km,
  lap: Math.round((km * 3600) / avgKmh),
  ...x,
  laps: x.laps ?? Math.max(20, Math.min(110, Math.round(305 / km))),
});

const NEW_SEEDS: CircuitSeed[] = [
  S('bosphorus', 'Bosphorus Park Circuit', 'Istanbul', 'TUR', 5.34, 212, { p: 0.7, d: 0.55, m: 0.45, b: 0.6, od: 0.4, tire: 1.15, rain: 0.15, temp: 33, pit: 22, sc: 1.0, demand: 0.6, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.3, layout: 'flowing', fuel: 1.05, character: 'Anticlockwise with a four-apex left-hander that shreds the front-right tyre. Rewards a balanced, well-cooled car.' }),
  S('alpenring', 'Alpenring Davos', 'Davos', 'SUI', 6.9, 185, { p: 0.45, d: 0.7, m: 0.75, b: 0.7, od: 0.7, tire: 1.05, rain: 0.3, temp: 18, pit: 24, sc: 1.4, demand: 0.9, type: 'hybrid', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.55, layout: 'mountain', alt: 1550, vol: 0.6, fuel: 0.95, character: 'Mountain road at 1,550 m. Thin air saps engines and cooling, the hairpins punish mistakes, and the weather turns in minutes.' }),
  S('fjordane', 'Fjordane Ring', 'Førde', 'NOR', 4.6, 190, { p: 0.5, d: 0.7, m: 0.6, b: 0.5, od: 0.55, tire: 0.95, rain: 0.5, temp: 16, pit: 21, sc: 1.2, demand: 0.7, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.6, layout: 'flowing', vol: 0.9, character: 'Between fjord and glacier. Showers roll in off the sea several times an afternoon, so tyre calls decide races.' }),
  S('jutland', 'Jutland Raceway', 'Herning', 'DEN', 2.1, 145, { p: 0.2, d: 0.5, m: 0.8, b: 0.7, od: 0.8, tire: 1.2, rain: 0.3, temp: 20, pit: 15, sc: 1.1, demand: 0.6, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.5, layout: 'kart', fuel: 0.9, laps: 110, character: 'Ultra-short club circuit: 52-second laps and constant traffic. Lapped cars arrive every few minutes.' }),
  S('attica', 'Attica Street Circuit', 'Athens', 'GRE', 5.1, 175, { p: 0.55, d: 0.7, m: 0.75, b: 0.8, od: 0.75, tire: 1.0, rain: 0.03, temp: 42, pit: 24, sc: 1.8, demand: 0.85, type: 'street', tiers: ['F1', 'F2', 'F3'], order: 0.62, layout: 'street', character: 'Scorching boulevards under the Acropolis. Walls everywhere, hot brakes and a safety car most years.' }),
  S('mazovia', 'Mazovia Speedway', 'Warsaw', 'POL', 5.6, 245, { p: 0.95, d: 0.2, m: 0.35, b: 0.8, od: 0.25, tire: 0.85, rain: 0.2, temp: 26, pit: 21, sc: 0.9, demand: 0.4, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.45, layout: 'speedway', fuel: 1.2, character: 'Flat-out speed bowl with chicanes. Power and slipstream rule, and fuel consumption is the highest of the year.' }),
  S('dalmatia', 'Dalmatia Coastal Circuit', 'Split', 'CRO', 4.9, 180, { p: 0.45, d: 0.75, m: 0.7, b: 0.65, od: 0.7, tire: 1.1, rain: 0.1, temp: 38, pit: 22, sc: 1.5, demand: 0.8, type: 'street', tiers: ['F2', 'F3', 'F4'], order: 0.58, layout: 'street', character: 'Harbour-front street track with stone walls and dusty off-line grip.' }),
  S('danube', 'Danube Ring', 'Novi Sad', 'SRB', 4.4, 175, { p: 0.7, d: 0.35, m: 0.5, b: 1.0, od: 0.45, tire: 0.95, rain: 0.2, temp: 30, pit: 21, sc: 1.1, demand: 0.55, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.5, layout: 'stopgo', character: 'Stop-and-go: long straights into first-gear hairpins. The heaviest braking track in Europe; brake failures are a real risk.' }),
  S('dnipro', 'Dnipro Autodrom', 'Dnipro', 'UKR', 5.9, 235, { p: 0.9, d: 0.3, m: 0.4, b: 0.65, od: 0.3, tire: 0.9, rain: 0.2, temp: 27, pit: 22, sc: 0.9, demand: 0.4, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.47, layout: 'speedway', fuel: 1.15, character: 'Wide riverside layout of long straights and fast kinks, built for slipstream battles.' }),
  S('tatra', 'Tatra Mountain Circuit', 'Poprad', 'SVK', 7.4, 175, { p: 0.5, d: 0.65, m: 0.8, b: 0.75, od: 0.65, tire: 1.05, rain: 0.35, temp: 17, pit: 25, sc: 1.5, demand: 0.95, type: 'hybrid', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.52, layout: 'mountain', alt: 950, vol: 0.5, character: 'Climbs through pine forest to 950 m and back down. Every lap takes two and a half minutes and a lot of courage.' }),
  S('karst', 'Karst Circuit', 'Postojna', 'SLO', 4.2, 178, { p: 0.25, d: 0.95, m: 0.7, b: 0.45, od: 0.85, tire: 1.3, rain: 0.25, temp: 28, pit: 21, sc: 0.9, demand: 0.7, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.42, layout: 'technical', character: 'High-downforce sequence of quick changes of direction over limestone. Aero efficiency pays, and overtaking is very hard.' }),
  S('rhodope', 'Rhodope Ring', 'Plovdiv', 'BUL', 4.7, 195, { p: 0.55, d: 0.6, m: 0.55, b: 0.55, od: 0.5, tire: 1.1, rain: 0.3, temp: 30, pit: 21, sc: 1.0, demand: 0.55, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.4, layout: 'flowing', vol: 0.5, character: 'Valley circuit where afternoon thunderstorms come off the mountains without warning.' }),
  S('limassol', 'Limassol Marina Street Circuit', 'Limassol', 'CYP', 3.4, 160, { p: 0.3, d: 0.8, m: 0.85, b: 0.75, od: 0.9, tire: 0.9, rain: 0.02, temp: 44, pit: 19, sc: 1.7, demand: 0.9, type: 'street', tiers: ['F3', 'F4', 'F5'], order: 0.66, layout: 'street', character: 'Tight, baking-hot marina streets. Qualifying is everything and the walls do not forgive.' }),
  S('lakeland', 'Lakeland Ring', 'Tampere', 'FIN', 4.3, 192, { p: 0.55, d: 0.65, m: 0.55, b: 0.45, od: 0.5, tire: 1.0, rain: 0.45, temp: 17, pit: 20, sc: 1.0, demand: 0.6, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.57, layout: 'flowing', vol: 0.8, character: 'Rolling forest circuit between lakes. Rain showers come and go, so the window for slicks keeps opening and closing.' }),
  S('kildare', 'Kildare Park', 'Naas', 'IRL', 3.9, 180, { p: 0.4, d: 0.6, m: 0.7, b: 0.6, od: 0.7, tire: 1.0, rain: 0.55, temp: 15, pit: 20, sc: 1.2, demand: 0.7, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.48, layout: 'technical', vol: 0.9, character: 'Green, bumpy parkland track where it rains on more days than not. Wet-weather skill is gold.' }),
  S('reykjanes', 'Reykjanes Lava Circuit', 'Keflavík', 'ISL', 5.2, 185, { p: 0.6, d: 0.55, m: 0.65, b: 0.5, od: 0.45, tire: 0.8, rain: 0.6, temp: 10, pit: 22, sc: 1.4, demand: 0.8, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.6, layout: 'flowing', vol: 1.0, character: 'Laid across black lava fields. Cold asphalt, Atlantic gales and squalls that can arrive three times in one race.' }),
  S('baltic', 'Baltic Forest Circuit', 'Pärnu', 'EST', 6.1, 228, { p: 0.85, d: 0.4, m: 0.45, b: 0.55, od: 0.35, tire: 0.95, rain: 0.35, temp: 19, pit: 21, sc: 0.9, demand: 0.5, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.55, layout: 'speedway', vol: 0.4, fuel: 1.1, character: 'Very fast pine-forest loop: long straights, sweeping bends and plenty of slipstreaming.' }),
  S('valletta', 'Valletta Harbour Circuit', 'Valletta', 'MLT', 2.6, 140, { p: 0.1, d: 0.85, m: 0.95, b: 0.8, od: 0.97, tire: 0.7, rain: 0.05, temp: 40, pit: 17, sc: 1.9, demand: 0.95, type: 'street', tiers: ['F3', 'F4', 'F5'], order: 0.64, layout: 'street', laps: 105, character: 'The tightest street circuit on the calendar: fortress walls, a tunnel and almost no overtaking.' }),
  S('carpathia', 'Carpathia Ring', 'Brașov', 'ROU', 6.3, 190, { p: 0.55, d: 0.7, m: 0.7, b: 0.7, od: 0.6, tire: 1.1, rain: 0.3, temp: 22, pit: 23, sc: 1.3, demand: 0.85, type: 'hybrid', tiers: ['F2', 'F3', 'F4'], order: 0.53, layout: 'mountain', alt: 700, vol: 0.4, character: 'Switchbacks and fast crests below the castle. Drivers who commit through the blind corners find time.' }),
  S('highlands', 'Highlands Circuit', 'Inverness', 'GBR', 4.8, 198, { p: 0.6, d: 0.65, m: 0.55, b: 0.45, od: 0.45, tire: 1.05, rain: 0.6, temp: 14, pit: 21, sc: 1.1, demand: 0.65, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.56, layout: 'flowing', vol: 1.0, character: 'Moorland circuit in the Scottish Highlands. Four seasons in one afternoon, and a pit wall that never stops guessing.' }),
  S('gotland', 'Gotland Ring', 'Visby', 'SWE', 12.4, 210, { p: 0.75, d: 0.55, m: 0.6, b: 0.55, od: 0.3, tire: 1.15, rain: 0.3, temp: 19, pit: 30, sc: 1.3, demand: 0.8, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.58, layout: 'endurance', vol: 0.5, fuel: 1.1, laps: 25, character: 'Extreme endurance: a 12.4 km lap of the island. Few laps, huge fuel loads and long pit lanes.' }),
  S('balaton', 'Balaton Circuit', 'Siófok', 'HUN', 4.0, 182, { p: 0.3, d: 0.9, m: 0.65, b: 0.5, od: 0.8, tire: 1.25, rain: 0.15, temp: 36, pit: 21, sc: 0.8, demand: 0.6, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.6, layout: 'technical', character: 'Hot lakeside circuit of medium-speed corners. Maximum downforce, heavy tyre wear and few places to pass.' }),
  S('moravia', 'Moravia Speedpark', 'Ostrava', 'CZE', 4.5, 178, { p: 0.65, d: 0.4, m: 0.5, b: 0.95, od: 0.4, tire: 0.95, rain: 0.25, temp: 26, pit: 21, sc: 1.0, demand: 0.55, type: 'permanent', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.44, layout: 'stopgo', character: 'Five heavy stops a lap from top speed. Brave late braking makes passes, and brakes cook in the heat.' }),
  S('grossglockner', 'Grossglockner Höhenring', 'Heiligenblut', 'AUT', 9.8, 170, { p: 0.45, d: 0.75, m: 0.8, b: 0.8, od: 0.55, tire: 1.1, rain: 0.35, temp: 12, pit: 28, sc: 1.6, demand: 1.0, type: 'hybrid', tiers: ['F1', 'F2', 'F3'], order: 0.6, layout: 'mountain', alt: 2000, vol: 0.7, fuel: 0.9, laps: 31, character: 'A 9.8 km alpine pass at 2,000 m: hairpins, glacier views, thin air and weather that changes at every summit.' }),
  S('montserrat', 'Montserrat Hill Circuit', 'Monistrol', 'ESP', 5.9, 180, { p: 0.45, d: 0.75, m: 0.75, b: 0.65, od: 0.65, tire: 1.15, rain: 0.15, temp: 30, pit: 22, sc: 1.2, demand: 0.85, type: 'hybrid', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.35, layout: 'mountain', alt: 650, character: 'Climbs the serrated mountain above Barcelona: blind crests, tight switchbacks and hot, abrasive tarmac.' }),
  S('nordring', 'Rheinland Nordring', 'Adenau', 'GER', 14.2, 195, { p: 0.7, d: 0.7, m: 0.8, b: 0.6, od: 0.4, tire: 1.2, rain: 0.35, temp: 18, pit: 32, sc: 1.5, demand: 1.0, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.5, layout: 'endurance', vol: 0.8, fuel: 1.05, laps: 22, character: 'The longest lap anywhere: 14.2 km and 160 corners. It can be raining at one end and dry at the other.' }),
  S('lyonstreet', 'Lyon Presqu’île Street Circuit', 'Lyon', 'FRA', 3.8, 168, { p: 0.35, d: 0.75, m: 0.85, b: 0.8, od: 0.85, tire: 0.9, rain: 0.2, temp: 30, pit: 20, sc: 1.7, demand: 0.9, type: 'street', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.4, layout: 'street', character: 'Right-angle corners between the Rhône and the Saône. Bumpy, narrow and safety-car prone.' }),
  S('povalley', 'Po Valley Autodrome', 'Cremona', 'ITA', 4.9, 250, { p: 1.0, d: 0.15, m: 0.3, b: 0.7, od: 0.2, tire: 0.8, rain: 0.15, temp: 31, pit: 21, sc: 0.9, demand: 0.35, type: 'permanent', tiers: ['F1', 'F2', 'F3', 'F4'], order: 0.62, layout: 'speedway', fuel: 1.25, character: 'Low-downforce speed bowl on the plain. Slipstream trains, last-lap drafts and thirsty engines.' }),
  S('friesland', 'Friesland Dunes Circuit', 'Leeuwarden', 'NED', 4.1, 190, { p: 0.45, d: 0.65, m: 0.6, b: 0.45, od: 0.55, tire: 1.05, rain: 0.45, temp: 18, pit: 20, sc: 1.0, demand: 0.6, type: 'permanent', tiers: ['F3', 'F4', 'F5'], order: 0.45, layout: 'technical', vol: 0.8, character: 'Coastal dunes, sand on the racing line and sea squalls. Crosswinds unsettle the cars in the fast corners.' }),
  S('ardennesclub', 'Ardennes Club Circuit', 'Mettet', 'BEL', 1.9, 140, { p: 0.2, d: 0.55, m: 0.8, b: 0.65, od: 0.8, tire: 1.1, rain: 0.45, temp: 18, pit: 14, sc: 1.2, demand: 0.65, type: 'permanent', tiers: ['F4', 'F5'], order: 0.5, layout: 'kart', vol: 0.6, laps: 110, character: 'Ultra-short club track with 49-second laps. The races are frantic, the traffic never ends and the rain comes often.' }),
  S('salforddocks', 'Salford Docks Street Circuit', 'Manchester', 'GBR', 3.6, 165, { p: 0.4, d: 0.7, m: 0.85, b: 0.8, od: 0.85, tire: 0.9, rain: 0.45, temp: 18, pit: 20, sc: 1.8, demand: 0.9, type: 'street', tiers: ['F2', 'F3', 'F4', 'F5'], order: 0.52, layout: 'street', vol: 0.5, character: 'Quayside street circuit of 90-degree corners. Wet patches and safety cars make it a lottery.' }),
  S('atlas', 'Atlas Mountain Circuit', 'Ifrane', 'MAR', 6.0, 200, { p: 0.65, d: 0.6, m: 0.6, b: 0.6, od: 0.45, tire: 1.2, rain: 0.05, temp: 38, pit: 22, sc: 1.1, demand: 0.75, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.25, layout: 'mountain', alt: 1650, character: 'High plateau circuit at 1,650 m: hot, thin air, overheating engines and abrasive tarmac.' }),
  S('patagonia', 'Patagonia Wind Circuit', 'El Calafate', 'ARG', 5.0, 205, { p: 0.6, d: 0.6, m: 0.55, b: 0.55, od: 0.45, tire: 1.05, rain: 0.4, temp: 14, pit: 21, sc: 1.1, demand: 0.6, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.9, layout: 'flowing', vol: 1.0, character: 'Wind-blasted steppe circuit at the end of the world. The weather can change several times in a lap.' }),
  S('outback', 'Outback Super Speedway', 'Alice Springs', 'AUS', 3.9, 240, { p: 0.95, d: 0.25, m: 0.35, b: 0.5, od: 0.25, tire: 1.4, rain: 0.02, temp: 50, pit: 18, sc: 0.8, demand: 0.4, type: 'permanent', tiers: ['F1', 'F2', 'F3'], order: 0.08, layout: 'speedway', fuel: 1.3, character: 'Desert speedway with 50 °C asphalt. Tyres blister, engines overheat and fuel runs short.' }),
  S('kyushu', 'Kyushu Harbour Street Circuit', 'Fukuoka', 'JPN', 4.6, 172, { p: 0.4, d: 0.8, m: 0.8, b: 0.7, od: 0.8, tire: 1.0, rain: 0.3, temp: 30, pit: 23, sc: 1.6, demand: 0.85, type: 'street', tiers: ['F1', 'F2'], order: 0.78, layout: 'street', character: 'Neon-lit harbour street race. Tight, technical and wet often enough to scramble the order.' }),
];

SEEDS.push(...NEW_SEEDS);

function weightsFor(s: CircuitSeed): Record<PaceComponentKey, number> {
  const raw: Record<PaceComponentKey, number> = {
    powerUnit: 0.08 + 0.17 * s.p,
    straightLine: 0.05 + 0.2 * s.p,
    aerodynamics: 0.08 + 0.18 * s.d,
    cornering: 0.06 + 0.11 * s.d + 0.08 * s.m,
    chassis: 0.12 + 0.05 * s.m,
    suspension: 0.05 + 0.15 * s.m,
    braking: 0.04 + 0.14 * s.b,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const out = {} as Record<PaceComponentKey, number>;
  for (const k of Object.keys(raw) as PaceComponentKey[]) out[k] = raw[k] / total;
  return out;
}

function sectorsFor(s: CircuitSeed): [number, number, number] {
  const a = 0.3 + ((s.id.charCodeAt(0) % 7) - 3) * 0.01;
  const b = 0.37 + ((s.id.charCodeAt(1) % 5) - 2) * 0.01;
  return [a, b, 1 - a - b];
}

export const CIRCUITS: Circuit[] = SEEDS.map((s) => ({
  id: s.id,
  name: s.name,
  location: s.location,
  country: s.country,
  laps: s.laps,
  baseLapTime: s.lap,
  lengthKm: s.km,
  weights: weightsFor(s),
  overtakingDifficulty: s.od,
  tireStress: s.tire,
  brakeStress: 0.6 + s.b * 0.8,
  rainChance: s.rain,
  baseTrackTemp: s.temp,
  pitLoss: s.pit,
  safetyCarRisk: s.sc,
  sectors: sectorsFor(s),
  driverDemand: s.demand,
  type: s.type,
  tiers: s.tiers,
  character: s.character,
  ...(s.layout ? { layout: s.layout } : {}),
  // Fuel per lap scales with lap length (a 5 km lap is the norm) and how much of it is full throttle.
  ...(s.fuel !== undefined || s.layout ? { fuelFactor: Math.round((s.km / 5) * (s.fuel ?? 1) * 100) / 100 } : {}),
  ...(s.alt ? { altitude: s.alt } : {}),
  ...(s.vol ? { weatherVolatility: s.vol } : {}),
}));

export const CIRCUIT_ORDER: Record<string, number> = Object.fromEntries(SEEDS.map((s) => [s.id, s.order]));

export interface CircuitTag {
  label: string;
  tone: 'red' | 'amber' | 'blue' | 'green' | 'neutral';
  title: string;
}

/** Category labels derived from a circuit's characteristics (works for every venue). */
export function circuitTags(c: Circuit): CircuitTag[] {
  const tags: CircuitTag[] = [];
  if (c.lengthKm < 2.5) tags.push({ label: 'Ultra-short', tone: 'neutral', title: 'Very short laps: constant traffic and lapping.' });
  else if (c.lengthKm < 3.8) tags.push({ label: 'Short', tone: 'neutral', title: 'Short lap, many laps.' });
  else if (c.lengthKm > 9) tags.push({ label: 'Extreme endurance', tone: 'amber', title: 'Very long lap: few laps, heavy fuel loads, long pit lane.' });
  else if (c.lengthKm > 6.2) tags.push({ label: 'Long', tone: 'neutral', title: 'Long lap.' });
  if (c.type === 'street') tags.push({ label: 'Street', tone: 'red', title: 'Walls: crashes and safety cars are likely.' });
  if ((c.altitude ?? 0) >= 500 || c.layout === 'mountain') tags.push({ label: `Mountain${c.altitude ? ` · ${c.altitude} m` : ''}`, tone: 'amber', title: 'Altitude strains engines and cooling; blind crests and hairpins.' });
  if (c.weights.straightLine + c.weights.powerUnit > 0.36) tags.push({ label: 'High-speed', tone: 'blue', title: 'Power and straight-line speed decide the lap.' });
  if (c.weights.aerodynamics + c.weights.cornering > 0.38) tags.push({ label: 'High-downforce', tone: 'blue', title: 'Aerodynamics and cornering grip decide the lap.' });
  if (c.brakeStress >= 1.3) tags.push({ label: 'Braking-heavy', tone: 'amber', title: 'Brake wear and failures; late braking wins places.' });
  if ((c.weatherVolatility ?? 0) >= 0.5 || c.rainChance >= 0.4) tags.push({ label: 'Mixed weather', tone: 'blue', title: 'Showers come and go: tyre calls decide races.' });
  const fuelIntensity = c.fuelFactor ? c.fuelFactor / (c.lengthKm / 5) : 1;
  if (fuelIntensity >= 1.15) tags.push({ label: 'Fuel-hungry', tone: 'amber', title: 'High fuel consumption: heavier cars and fuel saving.' });
  if (c.tireStress >= 1.25) tags.push({ label: 'Tyre-hungry', tone: 'amber', title: 'High tyre wear: more stops or careful driving.' });
  if (c.overtakingDifficulty >= 0.85) tags.push({ label: 'Overtaking very hard', tone: 'red', title: 'Track position is everything: qualify well.' });
  else if (c.overtakingDifficulty <= 0.3) tags.push({ label: 'Overtaking-friendly', tone: 'green', title: 'Slipstream and long straights: lots of passing.' });
  if (c.safetyCarRisk >= 1.6) tags.push({ label: 'Safety-car prone', tone: 'red', title: 'Safety cars are frequent: strategies get reshuffled.' });
  return tags;
}
