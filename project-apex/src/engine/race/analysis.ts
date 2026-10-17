import { DIVISIONS, type PointsSystem } from '../config/divisions';
import { RACE_TUNING, TIRE_TUNING } from '../config/tuning';
import type { CarRaceState, Circuit, GameState, RaceState, TireCompound } from '../types';
import { fuelPerLap, type RaceCommand } from './engine';
import { pitLossFor } from './strategy';
import { allowedCompounds, compoundPaceOffset, idealCompoundForWetness, isWetCompound, wearPenalty } from './tires';

/**
 * Live race analysis for the race screens: battles, tyre life, where a car
 * would rejoin after a stop, undercut chances, the weather radar and the
 * strategist's recommendations. Everything reads the race state only; nothing
 * here changes the simulation.
 */

export const running = (race: RaceState): CarRaceState[] => race.cars.filter((c) => c.status === 'running').sort((a, b) => a.position - b.position);

export interface Battle {
  ahead: CarRaceState;
  behind: CarRaceState;
  gap: number;
  /** Consecutive laps the two have run nose to tail. */
  laps: number;
  forPosition: number;
}

/** Cars within a second of the car ahead, with how long they have been together. */
export function liveBattles(race: RaceState, window = 1.0): Battle[] {
  if (race.lap === 0 || race.safetyCar.type !== 'none') return [];
  const order = running(race);
  const out: Battle[] = [];
  for (let i = 1; i < order.length; i++) {
    const behind = order[i];
    const ahead = order[i - 1];
    if (behind.interval > window || behind.pitThisLap || ahead.pitThisLap) continue;
    let laps = 0;
    for (let k = race.lapOrders.length - 1; k >= 0; k--) {
      const o = race.lapOrders[k];
      const ia = o.indexOf(ahead.driverId);
      if (ia < 0 || o[ia + 1] !== behind.driverId) break;
      laps++;
    }
    out.push({ ahead, behind, gap: behind.interval, laps, forPosition: ahead.position });
  }
  return out;
}

/** Average tyre wear per lap so far on this set, and laps left before the cliff. */
export function tyreLife(car: CarRaceState): { perLap: number; lapsToCliff: number; cliff: number } {
  const cliff = TIRE_TUNING.compounds[car.tire.compound].cliff;
  const perLap = car.tire.age > 0 ? car.tire.wear / car.tire.age : 2.5;
  const lapsToCliff = perLap > 0 ? Math.max(0, (cliff - car.tire.wear) / perLap) : 99;
  return { perLap, lapsToCliff, cliff };
}

/** Time a pit stop costs at this circuit for this race. */
export function pitLoss(race: RaceState, circuit: Circuit): number {
  return pitLossFor(circuit, race.baseLapTime) * (race.safetyCar.type === 'sc' ? 0.45 : race.safetyCar.type === 'vsc' ? 0.6 : 1);
}

/** Position a car would rejoin in if it pitted at the end of this lap. */
export function rejoinEstimate(race: RaceState, car: CarRaceState, circuit: Circuit): { position: number; behindOf: CarRaceState | null; aheadOf: CarRaceState | null } {
  const order = running(race);
  const after = car.gapToLeader + pitLoss(race, circuit);
  const others = order.filter((c) => c.driverId !== car.driverId);
  const idx = others.findIndex((c) => c.gapToLeader > after);
  const position = idx < 0 ? others.length + 1 : idx + 1;
  // behindOf: the car it would come out behind; aheadOf: the car it would come out in front of.
  return { position, behindOf: idx < 0 ? others[others.length - 1] ?? null : others[idx - 1] ?? null, aheadOf: idx < 0 ? null : others[idx] };
}

/** Fresh-tyre gain per lap if a car switched to `compound` now. */
export function freshTyreGain(race: RaceState, car: CarRaceState, compound: TireCompound): number {
  const scale = race.baseLapTime / 90;
  const wet = race.weather[Math.max(0, race.lap - 1)]?.wetness ?? 0;
  const now = wearPenalty(car.tire.compound, car.tire.wear, scale) + compoundPaceOffset(car.tire.compound, wet, scale);
  const fresh = wearPenalty(compound, 4, scale) + compoundPaceOffset(compound, wet, scale);
  return now - fresh;
}

export interface UndercutCall {
  target: CarRaceState;
  gap: number;
  gainPerLap: number;
  /** Laps of fresh-tyre pace needed to make up the stop and the gap. */
  lapsToPass: number;
  viable: boolean;
  /** Chance (0-1) the move works if the target pits a lap later. */
  chance: number;
}

/** Turn a margin in seconds into a chance, allowing for the noise of a real lap. */
const chanceOf = (margin: number, spread = 0.4) => Math.round((1 / (1 + Math.exp(-margin / spread))) * 100) / 100;

/** Can pitting now jump the car ahead once it pits too? */
export function undercut(race: RaceState, car: CarRaceState): UndercutCall | null {
  const order = running(race);
  const idx = order.indexOf(car);
  const target = idx > 0 ? order[idx - 1] : null;
  if (!target) return null;
  const compound = nextDryCompound(race, car);
  const gain = freshTyreGain(race, car, compound) - freshTyreGain(race, target, compound) * 0.15;
  if (gain <= 0.05) return { target, gap: car.interval, gainPerLap: Math.max(0, gain), lapsToPass: 99, viable: false, chance: 0 };
  // The target loses the same stop time later; the undercut has to make up the gap in the laps
  // until the target pits (about two laps of an in-lap and out-lap).
  const lapsToPass = car.interval / gain;
  return { target, gap: car.interval, gainPerLap: gain, lapsToPass, viable: lapsToPass <= 2.5 && target.pitStops <= car.pitStops, chance: target.pitStops <= car.pitStops ? chanceOf(gain * 2 - car.interval) : 0 };
}

export interface OvercutCall {
  target: CarRaceState;
  gap: number;
  /** Time the target would lose rejoining in traffic, per lap. */
  trafficLoss: number;
  /** Time lost per lap staying out on these tyres instead of fresh ones. */
  tyreLoss: number;
  chance: number;
  reason: string;
}

/**
 * Staying out while the car ahead pits. With no out-lap penalty in the
 * simulation, an overcut only works if the car ahead rejoins in traffic and is
 * held up while this car runs in clean air on tyres that still have pace.
 */
export function overcut(race: RaceState, car: CarRaceState, circuit: Circuit): OvercutCall | null {
  const order = running(race);
  const idx = order.indexOf(car);
  const target = idx > 0 ? order[idx - 1] : null;
  if (!target || race.safetyCar.type !== 'none') return null;
  const rejoin = rejoinEstimate(race, target, circuit);
  const blocker = rejoin.behindOf && rejoin.behindOf.driverId !== car.driverId ? rejoin.behindOf : null;
  const gapToBlocker = blocker ? target.gapToLeader + pitLoss(race, circuit) - blocker.gapToLeader : 99;
  const trafficLoss = blocker && gapToBlocker < 1.2 ? 0.6 : 0;
  const tyreLoss = Math.max(0, freshTyreGain(race, car, nextDryCompound(race, car)));
  const margin = (trafficLoss - tyreLoss) * 2 - car.interval;
  const reason = trafficLoss > 0 ? 'the car ahead would rejoin in traffic' : 'no traffic to hold the car ahead up';
  return { target, gap: car.interval, trafficLoss, tyreLoss, chance: trafficLoss > 0 ? chanceOf(margin) : 0, reason };
}

/** Average of the last few clean laps (no pit stop, no safety car), or null. */
export function recentPace(race: RaceState, car: CarRaceState, laps = 3): number | null {
  const pits = new Set(car.stints.map((s) => s.toLap).filter((l): l is number => l !== null));
  const clean = car.history.filter((h) => !pits.has(h.lap) && !race.scLaps.includes(h.lap) && h.lap > 1).slice(-laps);
  return clean.length ? clean.reduce((s, h) => s + h.lapTime, 0) / clean.length : null;
}

export interface PaceRow {
  car: CarRaceState;
  label: string;
  pace: number | null;
  /** Seconds per lap faster (+) or slower (-) than the car being compared. */
  delta: number | null;
}

/** This car's recent pace against the leader, the car ahead and the car behind. */
export function paceComparison(race: RaceState, car: CarRaceState): PaceRow[] {
  const order = running(race);
  const idx = order.indexOf(car);
  const mine = recentPace(race, car);
  const rows: PaceRow[] = [];
  const add = (c: CarRaceState | undefined, label: string) => {
    if (!c || c.driverId === car.driverId) return;
    const p = recentPace(race, c);
    rows.push({ car: c, label, pace: p, delta: mine !== null && p !== null ? p - mine : null });
  };
  add(order[0], 'Leader');
  if (idx > 1) add(order[idx - 1], 'Ahead');
  add(order[idx + 1], 'Behind');
  return rows;
}

/** Extra lap time the current tyres will cost over the coming laps at the present wear rate. */
export function degradationForecast(race: RaceState, car: CarRaceState, laps = 6): { lap: number; loss: number }[] {
  const scale = race.baseLapTime / 90;
  const { perLap } = tyreLife(car);
  const base = wearPenalty(car.tire.compound, car.tire.wear, scale);
  const out: { lap: number; loss: number }[] = [];
  for (let k = 1; k <= laps && race.lap + k <= race.totalLaps; k++) {
    out.push({ lap: race.lap + k, loss: Math.round((wearPenalty(car.tire.compound, Math.min(100, car.tire.wear + perLap * k), scale) - base) * 100) / 100 });
  }
  return out;
}

/** The pit window: earliest sensible lap and the lap the tyres fall away. */
export function pitWindow(race: RaceState, car: CarRaceState): { open: number; close: number; toFlag: boolean } {
  const life = tyreLife(car);
  const remaining = race.totalLaps - race.lap;
  const close = Math.min(race.totalLaps - 1, race.lap + Math.max(1, Math.floor(life.lapsToCliff)));
  const planned = car.plan.stops[car.pitStops]?.lap;
  const open = Math.max(race.lap + 1, Math.min(close, planned ? planned - 2 : close - 4));
  return { open, close, toFlag: life.lapsToCliff >= remaining };
}

/** Battery forecast under the current ERS mode. */
export function ersForecast(car: CarRaceState): { perLap: number; lapsToEmpty: number | null; lapsToFull: number | null } {
  const perLap = RACE_TUNING.ersCharge[car.instructions.ers] ?? 0;
  return {
    perLap,
    lapsToEmpty: perLap < 0 ? Math.max(0, Math.floor(car.ers / -perLap)) : null,
    lapsToFull: perLap > 0 ? Math.max(0, Math.ceil((100 - car.ers) / perLap)) : null,
  };
}

function nextDryCompound(race: RaceState, car: CarRaceState): TireCompound {
  const planned = car.plan.stops[car.pitStops]?.compound;
  const allowed = allowedCompounds(race.division);
  if (planned && allowed.includes(planned)) return planned;
  return allowed.includes('medium') ? 'medium' : allowed[0];
}

export interface RadarLap {
  lap: number;
  rain: number;
  wetness: number;
}

/** Short-range weather radar: the next few laps' rain and track wetness. */
export function weatherRadar(race: RaceState, laps = 8): RadarLap[] {
  const out: RadarLap[] = [];
  for (let l = race.lap + 1; l <= Math.min(race.totalLaps, race.lap + laps); l++) {
    const w = race.weather[l - 1];
    if (w) out.push({ lap: l, rain: w.rain, wetness: w.wetness });
  }
  return out;
}

/** Championship points each running position would score if the race ended now. */
export function livePoints(race: RaceState, sys: PointsSystem): Map<string, number> {
  const out = new Map<string, number>();
  running(race).forEach((c, i) => out.set(c.driverId, sys.positions[i] ?? 0));
  return out;
}

export interface Recommendation {
  id: string;
  text: string;
  severity: 'info' | 'warn' | 'urgent';
  command?: RaceCommand;
  action?: string;
}

/** The strategist's suggestions for one of the player's cars, from the live state. */
export function recommendations(state: GameState, race: RaceState, car: CarRaceState, circuit: Circuit): Recommendation[] {
  if (car.status !== 'running' || race.finished) return [];
  const out: Recommendation[] = [];
  const cfg = DIVISIONS[race.division];
  const remaining = race.totalLaps - race.lap;
  const radar = weatherRadar(race, 5);
  const wetNow = race.weather[Math.max(0, race.lap - 1)]?.wetness ?? 0;
  const wetSoon = Math.max(wetNow, ...radar.map((r) => r.wetness));
  const onWets = isWetCompound(car.tire.compound);
  const allowed = allowedCompounds(race.division);
  // Weather crossover.
  if (!onWets && wetSoon >= 0.25 && allowed.includes('intermediate')) {
    const target = idealCompoundForWetness(wetSoon);
    const lapsAway = radar.find((r) => r.wetness >= 0.22)?.lap;
    out.push({ id: 'wet', severity: wetNow >= 0.22 ? 'urgent' : 'warn', text: wetNow >= 0.22 ? 'The track is wet: slicks are losing seconds a lap.' : `Rain on the radar: the track turns wet around lap ${lapsAway}.`, command: { type: 'pit', compound: allowed.includes(target) ? target : 'intermediate' }, action: `Box for ${target === 'wet' ? 'full wets' : 'intermediates'}` });
  } else if (onWets && wetSoon < 0.18 && remaining > 4) {
    const dry = nextDryCompound(race, car);
    out.push({ id: 'dry', severity: 'warn', text: 'The track is drying: slicks will be faster within a lap or two.', command: { type: 'pit', compound: dry }, action: `Box for ${TIRE_TUNING.compounds[dry].label}` });
  }
  // Tyres.
  const life = tyreLife(car);
  if (!onWets && remaining > 3 && !car.pitRequest) {
    if (car.tire.wear >= life.cliff - 2) out.push({ id: 'cliff', severity: 'urgent', text: `Tyres are at ${Math.round(car.tire.wear)}% wear and over the cliff: the car is losing big time.`, command: { type: 'pit', compound: nextDryCompound(race, car) }, action: 'Box now' });
    else if (life.lapsToCliff < 4 && remaining > life.lapsToCliff + 2) out.push({ id: 'tyres', severity: 'warn', text: `About ${Math.max(1, Math.round(life.lapsToCliff))} laps left on these tyres before they fall away.`, command: { type: 'pit', compound: nextDryCompound(race, car) }, action: 'Plan the stop' });
    else if (car.instructions.tires !== 'preserve' && life.lapsToCliff < remaining && life.lapsToCliff < remaining * 0.6 && car.plan.stops.length <= car.pitStops) out.push({ id: 'preserve', severity: 'info', text: 'No stops left in the plan and the tyres will not last at this rate.', command: { type: 'tires', value: 'preserve' }, action: 'Preserve tyres' });
  }
  // Undercut.
  const uc = undercut(race, car);
  if (uc?.viable && remaining > 6 && !onWets) out.push({ id: 'undercut', severity: 'info', text: `Undercut on ${state.drivers[uc.target.driverId]?.lastName ?? 'the car ahead'}: fresh tyres are worth ${uc.gainPerLap.toFixed(1)} s a lap against a ${uc.gap.toFixed(1)} s gap.`, command: { type: 'pit', compound: nextDryCompound(race, car) }, action: 'Box to undercut' });
  // Safety car: cheap stop.
  if (race.safetyCar.type !== 'none' && remaining > 5 && !car.pitRequest && car.tire.wear > 30 && !onWets) out.push({ id: 'scstop', severity: 'warn', text: `${race.safetyCar.type === 'sc' ? 'Safety car' : 'Virtual safety car'}: a stop now costs far less time.`, command: { type: 'pit', compound: nextDryCompound(race, car) }, action: 'Box under caution' });
  // Fuel.
  if (cfg.fuelManagement) {
    const laps = car.fuel / fuelPerLap(cfg, circuit);
    if (laps < remaining * 0.99 && car.instructions.fuel !== 'lean') out.push({ id: 'fuel', severity: 'urgent', text: `Fuel for ${laps.toFixed(1)} laps with ${remaining} to go.`, command: { type: 'fuel', value: 'lean' }, action: 'Lean mix' });
    else if (laps > remaining * 1.04 && car.instructions.fuel === 'lean') out.push({ id: 'fuelrich', severity: 'info', text: 'Fuel margin is healthy again.', command: { type: 'fuel', value: 'standard' }, action: 'Standard mix' });
  }
  // Racing.
  const order = running(race);
  const idx = order.indexOf(car);
  const behind = order[idx + 1];
  const ahead = order[idx - 1];
  if (behind && behind.interval < 0.6 && !car.instructions.defend && behind.teamId !== car.teamId) out.push({ id: 'defend', severity: 'warn', text: `${state.drivers[behind.driverId]?.lastName} is ${behind.interval.toFixed(1)} s behind and looking for a way past.`, command: { type: 'defend', value: true }, action: 'Defend' });
  if (ahead && car.interval < 1.2 && ahead.teamId !== car.teamId && car.instructions.pace !== 'attack' && car.instructions.pace !== 'push' && car.tire.wear < life.cliff - 15) out.push({ id: 'attack', severity: 'info', text: `${state.drivers[ahead.driverId]?.lastName} is ${car.interval.toFixed(1)} s ahead: the tyres have something left to push.`, command: { type: 'pace', value: 'push' }, action: 'Push' });
  if (cfg.ers && ahead && car.interval < 1 && car.ers > 40 && car.instructions.ers !== 'overtake') out.push({ id: 'ers', severity: 'info', text: `Battery at ${Math.round(car.ers)}%: enough for an attack.`, command: { type: 'ers', value: 'overtake' }, action: 'Overtake mode' });
  if (car.warning && car.instructions.pace !== 'conserve') out.push({ id: 'nurse', severity: 'urgent', text: `${car.warning.type} warning: nurse the car to the flag.`, command: { type: 'pace', value: 'conserve' }, action: 'Conserve' });
  return out;
}
