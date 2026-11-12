/**
 * Deterministic seeded RNG (sfc32). The generator state is a plain 4-number array that
 * lives inside the save data, so reloading a save continues the exact same random stream
 * and never rerolls events that were already resolved.
 */
export type RngState = [number, number, number, number];

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix any number of integers / strings into a single uint32 seed. */
export function mixSeed(...parts: (number | string)[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    const v = typeof p === 'string' ? hashStr(p) : p >>> 0;
    h ^= v + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

export function seedState(seed: number): RngState {
  const s: RngState = [seed >>> 0, (seed ^ 0x9e3779b9) >>> 0, (seed * 2654435761) >>> 0, 1];
  const r = new Rng(s);
  for (let i = 0; i < 15; i++) r.next();
  return s;
}

export class Rng {
  s: RngState;
  constructor(state: RngState) {
    this.s = state;
  }
  static seeded(seed: number): Rng {
    return new Rng(seedState(seed));
  }
  /** float in [0, 1) */
  next(): number {
    const s = this.s;
    let a = s[0] | 0, b = s[1] | 0, c = s[2] | 0, d = s[3] | 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c >>> 0; s[3] = d >>> 0;
    return (t >>> 0) / 4294967296;
  }
  /** integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** integer in [a, b] inclusive */
  range(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  float(a: number, b: number): number {
    return a + this.next() * (b - a);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** approx normal(0,1) */
  normal(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const sig = (x: number) => 1 / (1 + Math.exp(-x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
