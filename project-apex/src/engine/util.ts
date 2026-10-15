export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const round = (v: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};
export const sum = (values: number[]): number => values.reduce((s, v) => s + v, 0);
export const avg = (values: number[]): number => (values.length ? sum(values) / values.length : 0);
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Round money to a "human" figure: nearest 1k under 1M, nearest 10k above. */
export const roundMoney = (v: number): number => {
  const abs = Math.abs(v);
  const step = abs >= 10_000_000 ? 50_000 : abs >= 1_000_000 ? 10_000 : abs >= 100_000 ? 1_000 : 500;
  return Math.round(v / step) * step;
};

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

/** Throw a user-facing rule violation when `condition` is false. */
export function assertRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GameRuleError(message);
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
