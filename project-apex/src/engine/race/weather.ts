import { Rng } from '../rng';
import type { Circuit, RaceWeatherLap, WeatherForecastEntry } from '../types';
import { clamp } from '../util';

export interface EventWeather {
  race: RaceWeatherLap[];
  qualiWetness: number;
  practiceWetness: number;
  airTemp: number;
}

/**
 * Generate the actual weather for an event. It is fixed by the world seed and
 * event id, so replaying a weekend always produces the same conditions; only
 * the forecast the teams see is uncertain.
 */
export function generateEventWeather(seed: number, eventId: string, circuit: Circuit, laps: number): EventWeather {
  const rng = Rng.from(seed, 'weather', eventId);
  const seasonal = rng.range(0.7, 1.35);
  const rainChance = clamp(circuit.rainChance * seasonal, 0, 0.75);
  const baseTemp = circuit.baseTrackTemp + rng.normal(0, 4);
  const cells: { start: number; end: number; intensity: number }[] = [];
  if (rng.chance(rainChance)) {
    const count = rng.chance(0.3) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const start = rng.range(-0.15, 0.85);
      const length = rng.range(0.08, 0.5);
      cells.push({ start, end: start + length, intensity: rng.range(0.25, 1) });
    }
  }
  let wetness = rng.chance(rainChance * 0.3) ? rng.range(0.35, 0.85) : 0;
  const race: RaceWeatherLap[] = [];
  for (let lap = 1; lap <= laps; lap++) {
    const f = lap / laps;
    let rain = 0;
    for (const c of cells) {
      if (f >= c.start && f <= c.end) {
        const edge = Math.min(f - c.start, c.end - f) / Math.max(0.02, (c.end - c.start) * 0.25);
        rain = Math.max(rain, c.intensity * clamp(edge, 0.25, 1));
      }
    }
    const trackTemp = baseTemp - rain * 9 - wetness * 4;
    if (rain > 0.05) wetness += rain * 0.17 * (0.55 + rain * 0.5) * (30 / Math.max(15, laps)) ** 0.5;
    else wetness -= (0.04 + clamp(trackTemp - 18, 0, 25) * 0.0022) * (30 / Math.max(15, laps)) ** 0.5;
    wetness = clamp(wetness, 0, 1);
    race.push({ rain: Math.round(rain * 100) / 100, wetness: Math.round(wetness * 1000) / 1000, trackTemp: Math.round(trackTemp * 10) / 10 });
  }
  const qualiWet = rng.chance(rainChance * 0.85) ? rng.range(0.25, 0.9) : 0;
  const practiceWet = rng.chance(rainChance * 0.7) ? rng.range(0.2, 0.8) : 0;
  return { race, qualiWetness: qualiWet, practiceWetness: practiceWet, airTemp: Math.round(baseTemp - 8) };
}

/**
 * Forecast with uncertainty. `accuracy` (0..1) comes from the strategy
 * department and head strategist; better teams read the radar better.
 */
export function forecastFor(seed: number, eventId: string, teamId: string, weather: EventWeather, accuracy: number): WeatherForecastEntry[] {
  const rng = Rng.from(seed, 'forecast', eventId, teamId);
  const n = weather.race.length;
  const segments: WeatherForecastEntry[] = [];
  const cuts = [0, 1 / 3, 2 / 3, 1];
  for (let s = 0; s < 3; s++) {
    const from = Math.floor(cuts[s] * n);
    const to = Math.max(from + 1, Math.floor(cuts[s + 1] * n));
    const slice = weather.race.slice(from, to);
    const rainLaps = slice.filter((l) => l.rain > 0.08).length / Math.max(1, slice.length);
    const peak = Math.max(0, ...slice.map((l) => l.rain));
    const truth = rainLaps > 0 ? 0.55 + rainLaps * 0.4 : 0.06;
    const noise = rng.normal(0, 0.28 * (1 - accuracy) + 0.04);
    const p = clamp(truth + noise, 0, 0.97);
    const condition = p > 0.6 ? (peak > 0.6 ? 'heavyRain' : 'lightRain') : p > 0.3 ? 'cloudy' : 'dry';
    segments.push({ from: cuts[s], rainProbability: Math.round(p * 100) / 100, condition });
  }
  return segments;
}

export function weatherLabel(rain: number, wetness: number): string {
  if (rain > 0.6) return 'Heavy rain';
  if (rain > 0.1) return 'Light rain';
  if (wetness > 0.5) return 'Wet track';
  if (wetness > 0.15) return 'Damp, drying';
  return 'Dry';
}
