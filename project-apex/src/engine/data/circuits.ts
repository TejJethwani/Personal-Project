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
}));

export const CIRCUIT_ORDER: Record<string, number> = Object.fromEntries(SEEDS.map((s) => [s.id, s.order]));
