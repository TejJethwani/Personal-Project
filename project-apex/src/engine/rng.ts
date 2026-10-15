/**
 * Deterministic, seedable pseudo-random number generation.
 *
 * Every random decision in the simulation flows through an `Rng`. The generator
 * state is a single uint32, so it can be stored inside the save file (world RNG)
 * or inside a race state (race RNG) and resumed exactly. Given the same seed and
 * the same sequence of calls, results are bit-for-bit identical on every run.
 */

/** FNV-1a 32-bit hash of a string; used to derive sub-seeds from labels. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine a numeric seed with any number of labels into a new uint32 seed. */
export function deriveSeed(seed: number, ...labels: (string | number)[]): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const label of labels) {
    h = Math.imul(h ^ hashString(String(label)), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}

export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  static from(seed: number, ...labels: (string | number)[]): Rng {
    return new Rng(deriveSeed(seed, ...labels));
  }

  /** mulberry32: returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next());
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Standard normal via Box-Muller. */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Normal, clamped to [min, max]. */
  normalClamped(mean: number, sd: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, this.normal(mean, sd)));
  }

  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) return items[0].item;
    let r = this.next() * total;
    for (const entry of items) {
      r -= Math.max(0, entry.weight);
      if (r <= 0) return entry.item;
    }
    return items[items.length - 1].item;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

/**
 * Stable per-entity noise in [-1, 1]. Used for "fog of war" estimates so that a
 * scouted value does not flicker between renders: the same inputs always give
 * the same offset.
 */
export function stableNoise(seed: number, ...labels: (string | number)[]): number {
  return (deriveSeed(seed, ...labels) / 4294967295) * 2 - 1;
}
