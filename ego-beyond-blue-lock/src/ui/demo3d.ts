/** A synthetic match moment used to preview 3D finishes and ultimate goal animations outside a match. */
import type { MatchState, Replay } from '../engine/match/model';

export function demoScene(name: string, o: Partial<Replay> = {}): { ms: MatchState; rp: Replay } {
  const pl: unknown[] = [];
  const pos: [number, number][] = [[4, 50], [22, 20], [20, 40], [20, 60], [22, 80], [45, 30], [42, 50], [45, 70], [78, 26], [84, 52], [80, 74]];
  const opp: [number, number][] = [[97, 50], [86, 22], [89, 42], [89, 60], [86, 80], [74, 32], [72, 52], [74, 70], [58, 28], [52, 50], [58, 72]];
  for (let t = 0; t < 2; t++) for (let i = 0; i < 11; i++) pl.push({ id: `demo${t}_${i}`, nm: t === 0 && i === 9 ? name : t === 0 ? `Mate ${i + 1}` : `Rival ${i + 1}`, num: i === 0 ? 1 : i + 1, t, line: i === 0 ? 0 : i < 5 ? 1 : i < 8 ? 2 : 3, user: t === 0 && i === 9, on: true, x: (t ? opp : pos)[i][0], y: (t ? opp : pos)[i][1] });
  const ms = { pl, teams: [{ name: 'Egoists', abbr: 'EGO', col: '#1ea7ff', col2: '#0b1f3a' }, { name: 'Rivals', abbr: 'RIV', col: '#e63946', col2: '#3a0b10' }] } as unknown as MatchState;
  const rp: Replay = { id: 11, min: 67, t: 0, sh: 9, as: 8, gk: 11, v: 'placed', d: 13, xg: 0.24, p: 0.41, res: 'goal', bx: 87.5, by: 52, fx: 78, fy: 26, high: false, gy: 0.7, gz: 0.75, pl: (pl as { x: number; y: number }[]).map((p, i) => [i, p.x, p.y] as [number, number, number]), sc: [1, 0], ...o };
  if (o.d != null && o.bx == null) rp.bx = 100 - o.d / 1.05;
  return { ms, rp };
}
