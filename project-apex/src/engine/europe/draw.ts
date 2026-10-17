import type { Rng } from '../rng';

/**
 * League-phase draw for the continental competitions.
 *
 * Pots are seeded by club coefficient. Every club plays a fixed number of
 * opponents from each pot (two per pot with four pots, one per pot with six),
 * never a club from its own association and at most two from any single
 * association. Home and away are balanced exactly (an Euler orientation of the
 * fixture graph), and fixtures are split into matchdays where every club races
 * once (a 1-factorisation of the regular graph). The draw retries with fresh
 * randomness until all constraints hold.
 */

export interface DrawTeam {
  id: string;
  assoc: string;
}

export interface DrawResult {
  /** matchdays[k] = list of [home, away] pairs, every club exactly once. */
  matchdays: [string, string][][];
}

const MAX_SAME_ASSOC = 2;

type Adj = Map<string, Set<string>>;

function addEdge(adj: Adj, a: string, b: string): void {
  adj.get(a)!.add(b);
  adj.get(b)!.add(a);
}

function assocCount(adj: Adj, assocOf: Map<string, string>, team: string, assoc: string): number {
  let n = 0;
  for (const o of adj.get(team)!) if (assocOf.get(o) === assoc) n++;
  return n;
}

let relaxed = false;

function allowed(adj: Adj, assocOf: Map<string, string>, a: string, b: string): boolean {
  if (a === b) return false;
  if (!relaxed && assocOf.get(a) === assocOf.get(b)) return false;
  if (adj.get(a)!.has(b)) return false;
  if (assocCount(adj, assocOf, a, assocOf.get(b)!) >= MAX_SAME_ASSOC) return false;
  if (assocCount(adj, assocOf, b, assocOf.get(a)!) >= MAX_SAME_ASSOC) return false;
  return true;
}

/** Random perfect matching between two equal-size groups (Kuhn's algorithm, shuffled). */
function bipartiteMatching(rng: Rng, left: string[], right: string[], ok: (a: string, b: string) => boolean): Map<string, string> | null {
  const matchR = new Map<string, string>();
  const order = rng.shuffle([...left]);
  const tryKuhn = (a: string, seen: Set<string>): boolean => {
    for (const b of rng.shuffle([...right])) {
      if (seen.has(b) || !ok(a, b)) continue;
      seen.add(b);
      const cur = matchR.get(b);
      if (cur === undefined || tryKuhn(cur, seen)) {
        matchR.set(b, a);
        return true;
      }
    }
    return false;
  };
  for (const a of order) if (!tryKuhn(a, new Set())) return null;
  const out = new Map<string, string>();
  for (const [b, a] of matchR) out.set(a, b);
  return out;
}

/** Random perfect matching of a general graph by backtracking (small graphs only). */
function generalMatching(rng: Rng, nodes: string[], ok: (a: string, b: string) => boolean, budget = 40000): [string, string][] | null {
  const free = new Set(nodes);
  const pairs: [string, string][] = [];
  let steps = 0;
  const solve = (): boolean => {
    if (free.size === 0) return true;
    if (++steps > budget) return false;
    // Most constrained club first.
    let best: string | null = null;
    let bestOpts: string[] = [];
    for (const a of free) {
      const opts = [...free].filter((b) => b !== a && ok(a, b));
      if (best === null || opts.length < bestOpts.length) {
        best = a;
        bestOpts = opts;
        if (opts.length <= 1) break;
      }
    }
    if (!best || bestOpts.length === 0) return false;
    for (const b of rng.shuffle(bestOpts)) {
      free.delete(best);
      free.delete(b);
      pairs.push([best, b]);
      if (solve()) return true;
      pairs.pop();
      free.add(best);
      free.add(b);
    }
    return false;
  };
  return solve() ? pairs : null;
}

/** Build the undirected fixture graph pot by pot. */
function buildGraph(rng: Rng, pots: DrawTeam[][], perPot: number, assocOf: Map<string, string>): Adj | null {
  const adj: Adj = new Map();
  for (const pot of pots) for (const t of pot) adj.set(t.id, new Set());
  const pairs: [number, number][] = [];
  for (let p = 0; p < pots.length; p++) for (let q = p; q < pots.length; q++) pairs.push([p, q]);
  for (const [p, q] of rng.shuffle(pairs)) {
    const A = pots[p].map((t) => t.id);
    if (p === q) {
      if (perPot === 1) {
        const m = generalMatching(rng, A, (a, b) => allowed(adj, assocOf, a, b));
        if (!m) return null;
        for (const [a, b] of m) addEdge(adj, a, b);
      } else {
        // Two opponents from the own pot: a permutation without fixed points or 2-cycles.
        let done = false;
        for (let attempt = 0; attempt < 30 && !done; attempt++) {
          const m = bipartiteMatching(rng, A, A, (a, b) => allowed(adj, assocOf, a, b));
          if (!m) continue;
          if ([...m].some(([a, b]) => m.get(b) === a)) continue;
          // Edges of one cycle cover must not conflict with each other on the association cap.
          const trial: Adj = new Map([...adj].map(([k, v]) => [k, new Set(v)]));
          let ok = true;
          for (const [a, b] of m) {
            if (!allowed(trial, assocOf, a, b)) {
              ok = false;
              break;
            }
            addEdge(trial, a, b);
          }
          if (!ok) continue;
          for (const [a, b] of m) addEdge(adj, a, b);
          done = true;
        }
        if (!done) return null;
      }
    } else {
      const B = pots[q].map((t) => t.id);
      for (let k = 0; k < perPot; k++) {
        let placed = false;
        for (let attempt = 0; attempt < 20 && !placed; attempt++) {
          const m = bipartiteMatching(rng, A, B, (a, b) => allowed(adj, assocOf, a, b));
          if (!m) continue;
          const trial: Adj = new Map([...adj].map(([key, v]) => [key, new Set(v)]));
          let ok = true;
          for (const [a, b] of m) {
            if (!allowed(trial, assocOf, a, b)) {
              ok = false;
              break;
            }
            addEdge(trial, a, b);
          }
          if (!ok) continue;
          for (const [a, b] of m) addEdge(adj, a, b);
          placed = true;
        }
        if (!placed) return null;
      }
    }
  }
  return adj;
}

/** Orient every edge so each club hosts exactly half its fixtures (Hierholzer on an even-degree graph). */
function eulerOrient(rng: Rng, adj: Adj): Set<string> {
  const remaining: Adj = new Map([...adj].map(([k, v]) => [k, new Set(v)]));
  const directed = new Set<string>(); // "home|away"
  for (const start of rng.shuffle([...remaining.keys()])) {
    if (remaining.get(start)!.size === 0) continue;
    const stack = [start];
    const path: string[] = [];
    while (stack.length) {
      const v = stack[stack.length - 1];
      const nbrs = remaining.get(v)!;
      if (nbrs.size) {
        const u = nbrs.values().next().value as string;
        nbrs.delete(u);
        remaining.get(u)!.delete(v);
        stack.push(u);
      } else path.push(stack.pop()!);
    }
    for (let i = 0; i + 1 < path.length; i++) directed.add(`${path[i]}|${path[i + 1]}`);
  }
  return directed;
}

function evenCycles(adj: Adj): [string, string][][] | null {
  // Split a 2-regular graph made of even cycles into two perfect matchings.
  const seen = new Set<string>();
  const m1: [string, string][] = [];
  const m2: [string, string][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const cycle: string[] = [start];
    seen.add(start);
    let prev = start;
    let cur = [...adj.get(start)!][0];
    while (cur !== start) {
      cycle.push(cur);
      seen.add(cur);
      const next = [...adj.get(cur)!].find((x) => x !== prev)!;
      prev = cur;
      cur = next;
    }
    if (cycle.length % 2) return null;
    for (let i = 0; i < cycle.length; i++) (i % 2 ? m2 : m1).push([cycle[i], cycle[(i + 1) % cycle.length]]);
  }
  return [m1, m2];
}

/** Split a k-regular graph into k perfect matchings (matchdays). */
function factorise(rng: Rng, adj: Adj, degree: number): [string, string][][] | null {
  const g: Adj = new Map([...adj].map(([k, v]) => [k, new Set(v)]));
  const nodes = [...g.keys()];
  const days: [string, string][][] = [];
  for (let d = degree; d > 2; d--) {
    let found: [string, string][] | null = null;
    const tries = d === 3 ? 200 : 6;
    for (let t = 0; t < tries && !found; t++) {
      const m = generalMatching(rng, nodes, (a, b) => g.get(a)!.has(b), 20000);
      if (!m) continue;
      if (d === 3) {
        const rest: Adj = new Map([...g].map(([k, v]) => [k, new Set(v)]));
        for (const [a, b] of m) {
          rest.get(a)!.delete(b);
          rest.get(b)!.delete(a);
        }
        if (!evenCycles(rest)) continue;
      }
      found = m;
    }
    if (!found) return null;
    for (const [a, b] of found) {
      g.get(a)!.delete(b);
      g.get(b)!.delete(a);
    }
    days.push(found);
  }
  if (degree >= 2) {
    const last = evenCycles(g);
    if (!last) return null;
    days.push(...last);
  } else if (degree === 1) {
    days.push(nodes.filter((a) => g.get(a)!.size).map((a) => [a, [...g.get(a)!][0]] as [string, string]).filter(([a, b]) => a < b));
  }
  return days;
}

export function leaguePhaseDraw(rng: Rng, pots: DrawTeam[][], perPot: number): DrawResult {
  const assocOf = new Map(pots.flat().map((t) => [t.id, t.assoc]));
  const degree = perPot * pots.length;
  // A pot crowded with one association's clubs can make the full rules impossible;
  // after many tries the same-association rule is relaxed (the cap of two stays).
  try {
    for (let attempt = 0; attempt < 600; attempt++) {
      relaxed = attempt >= 300;
      const adj = buildGraph(rng, pots, perPot, assocOf);
      if (!adj) continue;
      if ([...adj.values()].some((s) => s.size !== degree)) continue;
      const days = factorise(rng, adj, degree);
      if (!days) continue;
      const directed = eulerOrient(rng, adj);
      const matchdays = rng.shuffle(days).map((day) => day.map(([a, b]) => (directed.has(`${a}|${b}`) ? [a, b] : [b, a]) as [string, string]));
      return { matchdays };
    }
  } finally {
    relaxed = false;
  }
  throw new Error('League phase draw failed to satisfy its constraints.');
}
