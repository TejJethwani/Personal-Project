/**
 * Attribute model. One consistent 1–99 scale for NEL and professional football.
 * OVR is ALWAYS computed from attributes with position-specific weights — it is never
 * stored independently, so a displayed OVR can never contradict the attribute sheet.
 */
import type { Player, Pos } from './types';
import { Rng, clamp } from './rng';

export const A = {
  FIN: 0, SHP: 1, LSH: 2, VOL: 3, POS: 4, COM: 5, PEN: 6,
  SPA: 7, LPA: 8, VIS: 9, CRO: 10,
  BCO: 11, DRI: 12, FTO: 13,
  ACC: 14, SPD: 15, AGI: 16, BAL: 17,
  STR: 18, STA: 19, JUM: 20, HEA: 21,
  TAC: 22, MAR: 23, INT: 24, DAW: 25,
  REA: 26, DEC: 27, TIQ: 28,
  WFT: 29, SKL: 30,
  GKD: 31, GKH: 32, GKR: 33, GKP: 34, GKK: 35,
} as const;
export const N_OUT = 31; // outfield attributes
export const N_ATTR = 36;

export interface AttrDef { key: string; name: string; group: string; desc: string }
export const ATTRS: AttrDef[] = [
  { key: 'FIN', name: 'Finishing', group: 'Shooting', desc: 'Accuracy and placement of shots inside the box. The main driver of beating the keeper from good positions.' },
  { key: 'SHP', name: 'Shot Power', group: 'Shooting', desc: 'How hard the ball is struck. Makes power shots and long-range efforts harder to save.' },
  { key: 'LSH', name: 'Long Shots', group: 'Shooting', desc: 'Accuracy from outside the box. Governs efforts from 18 metres and beyond.' },
  { key: 'VOL', name: 'Volleys', group: 'Shooting', desc: 'Technique when striking the ball out of the air, including improvised finishes.' },
  { key: 'POS', name: 'Positioning', group: 'Attacking Mind', desc: 'Off-ball attacking movement: finding space, timing runs and staying onside.' },
  { key: 'COM', name: 'Composure', group: 'Attacking Mind', desc: 'Resistance to pressure. Reduces the penalty applied to actions when defenders are close.' },
  { key: 'PEN', name: 'Penalties', group: 'Shooting', desc: 'Conversion of penalty kicks.' },
  { key: 'SPA', name: 'Short Passing', group: 'Passing', desc: 'Accuracy of ground passes over short and medium distances.' },
  { key: 'LPA', name: 'Long Passing', group: 'Passing', desc: 'Accuracy of switches, long balls and lofted through passes.' },
  { key: 'VIS', name: 'Vision', group: 'Passing', desc: 'Seeing and weighting passes into space. Improves through balls and key-pass quality.' },
  { key: 'CRO', name: 'Crossing', group: 'Passing', desc: 'Quality of deliveries from wide areas and set pieces.' },
  { key: 'BCO', name: 'Ball Control', group: 'Technique', desc: 'Keeping the ball under control while moving and under contact.' },
  { key: 'DRI', name: 'Dribbling', group: 'Technique', desc: 'Beating opponents with the ball at your feet.' },
  { key: 'FTO', name: 'First Touch', group: 'Technique', desc: 'Quality of the receiving touch. Affects first-time actions and escaping pressure.' },
  { key: 'ACC', name: 'Acceleration', group: 'Pace', desc: 'Speed over the first few metres. Decides short races and separation on runs.' },
  { key: 'SPD', name: 'Sprint Speed', group: 'Pace', desc: 'Top speed over distance. Decides foot races in open space.' },
  { key: 'AGI', name: 'Agility', group: 'Pace', desc: 'How quickly the body changes direction. Helps dribbling and acrobatic finishes.' },
  { key: 'BAL', name: 'Balance', group: 'Pace', desc: 'Staying upright through contact and awkward body positions.' },
  { key: 'STR', name: 'Strength', group: 'Physical', desc: 'Winning shoulder-to-shoulder duels, shielding and holding the ball up.' },
  { key: 'STA', name: 'Stamina', group: 'Physical', desc: 'How slowly match fatigue builds. Tired players lose effectiveness in every action.' },
  { key: 'JUM', name: 'Jumping', group: 'Physical', desc: 'Leap height for aerial duels.' },
  { key: 'HEA', name: 'Heading', group: 'Physical', desc: 'Accuracy and power of headers.' },
  { key: 'TAC', name: 'Tackling', group: 'Defending', desc: 'Winning the ball cleanly in a challenge without fouling.' },
  { key: 'MAR', name: 'Marking', group: 'Defending', desc: 'Staying tight to a runner and denying space.' },
  { key: 'INT', name: 'Interceptions', group: 'Defending', desc: 'Reading and cutting out passes.' },
  { key: 'DAW', name: 'Defensive Awareness', group: 'Defending', desc: 'Defensive positioning and anticipation of danger.' },
  { key: 'REA', name: 'Reactions', group: 'Mental', desc: 'Speed of response to loose balls, rebounds and sudden events.' },
  { key: 'DEC', name: 'Decision-Making', group: 'Mental', desc: 'Choosing the right option. For AI players this directly controls choice quality.' },
  { key: 'TIQ', name: 'Tactical Intelligence', group: 'Mental', desc: 'Understanding of team shape and instructions. Drives tactical discipline and manager trust.' },
  { key: 'WFT', name: 'Weak-Foot Proficiency', group: 'Skill', desc: 'How little quality is lost when the action falls on the weaker foot.' },
  { key: 'SKL', name: 'Skill Proficiency', group: 'Skill', desc: 'Repertoire and execution of skill moves and feints.' },
  { key: 'GKD', name: 'GK Diving', group: 'Goalkeeping', desc: 'Reach and spring when diving for shots.' },
  { key: 'GKH', name: 'GK Handling', group: 'Goalkeeping', desc: 'Holding shots rather than parrying into danger.' },
  { key: 'GKR', name: 'GK Reflexes', group: 'Goalkeeping', desc: 'Reaction saves from close range.' },
  { key: 'GKP', name: 'GK Positioning', group: 'Goalkeeping', desc: 'Narrowing angles and being set for the shot.' },
  { key: 'GKK', name: 'GK Kicking', group: 'Goalkeeping', desc: 'Distribution quality from hands and feet.' },
];
export const ATTR_GROUPS = ['Shooting', 'Attacking Mind', 'Passing', 'Technique', 'Pace', 'Physical', 'Defending', 'Mental', 'Skill'];

export const POSITIONS: Pos[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'SS', 'ST'];
export const OUTFIELD: Pos[] = ['ST', 'SS', 'LW', 'RW', 'AM', 'LM', 'RM', 'CM', 'DM', 'LB', 'RB', 'CB'];
export const POS_NAME: Record<Pos, string> = {
  GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back', DM: 'Defensive Midfielder', CM: 'Central Midfielder',
  AM: 'Attacking Midfielder', LM: 'Left Midfielder', RM: 'Right Midfielder', LW: 'Left Winger', RW: 'Right Winger', SS: 'Second Striker', ST: 'Striker',
};
/** 0 GK, 1 DEF, 2 MID, 3 ATT */
export const POS_LINE: Record<Pos, number> = { GK: 0, CB: 1, LB: 1, RB: 1, DM: 2, CM: 2, AM: 2, LM: 2, RM: 2, LW: 3, RW: 3, SS: 3, ST: 3 };

const W = (o: Partial<Record<keyof typeof A, number>>): number[] => {
  const w = new Array(N_ATTR).fill(0);
  let sum = 0;
  for (const k in o) { w[A[k as keyof typeof A]] = o[k as keyof typeof A]!; sum += o[k as keyof typeof A]!; }
  for (let i = 0; i < N_ATTR; i++) w[i] /= sum;
  return w;
};
const WING = { DRI: 13, ACC: 9, SPD: 9, AGI: 6, BCO: 9, FTO: 5, CRO: 8, FIN: 9, POS: 7, SPA: 5, VIS: 5, REA: 5, COM: 3, LSH: 3, DEC: 2, SKL: 2 };
const WIDEMID = { CRO: 11, DRI: 10, SPA: 8, ACC: 7, SPD: 8, STA: 7, BCO: 8, VIS: 6, FTO: 4, AGI: 4, POS: 5, FIN: 4, REA: 5, DEC: 4, LPA: 4, TIQ: 3, TAC: 2 };
const FB = { TAC: 10, MAR: 8, DAW: 8, INT: 8, SPD: 9, ACC: 7, STA: 9, CRO: 8, SPA: 6, BCO: 5, DRI: 4, REA: 6, TIQ: 5, DEC: 4, STR: 3 };

/** Position-specific OVR weights (each row sums to 1). */
export const POS_WEIGHTS: Record<Pos, number[]> = {
  ST: W({ FIN: 17, POS: 13, SHP: 7, COM: 7, HEA: 5, VOL: 3, BCO: 7, FTO: 5, DRI: 5, ACC: 6, SPD: 6, STR: 5, REA: 6, DEC: 3, LSH: 3, SPA: 2 }),
  SS: W({ FIN: 12, POS: 10, COM: 6, BCO: 9, FTO: 6, DRI: 9, SPA: 7, VIS: 7, ACC: 6, SPD: 4, AGI: 4, REA: 6, DEC: 4, LSH: 4, SHP: 4, VOL: 2 }),
  LW: W(WING), RW: W(WING),
  LM: W(WIDEMID), RM: W(WIDEMID),
  AM: W({ VIS: 12, SPA: 11, BCO: 10, DRI: 9, FTO: 7, POS: 7, COM: 5, FIN: 6, LSH: 5, AGI: 5, ACC: 5, REA: 6, DEC: 6, LPA: 4, TIQ: 2 }),
  CM: W({ SPA: 12, VIS: 9, LPA: 8, BCO: 9, FTO: 6, DEC: 8, TIQ: 7, STA: 7, REA: 6, DRI: 5, TAC: 5, INT: 5, COM: 4, POS: 3, LSH: 3, DAW: 3 }),
  DM: W({ TAC: 11, INT: 11, DAW: 9, MAR: 6, SPA: 9, LPA: 6, TIQ: 9, DEC: 8, STR: 6, STA: 7, REA: 6, BCO: 6, COM: 3, VIS: 3 }),
  CB: W({ MAR: 13, TAC: 13, DAW: 12, INT: 9, HEA: 8, STR: 9, JUM: 5, REA: 6, TIQ: 6, DEC: 5, COM: 4, SPD: 4, SPA: 3, ACC: 2, BCO: 1 }),
  LB: W(FB), RB: W(FB),
  GK: W({ GKD: 21, GKH: 18, GKR: 22, GKP: 21, GKK: 6, REA: 8, COM: 4 }),
};

export function ovrAt(a: number[], pos: Pos): number {
  const w = POS_WEIGHTS[pos];
  let s = 0;
  for (let i = 0; i < N_ATTR; i++) if (w[i]) s += w[i] * a[i];
  return s;
}
/** The displayed overall rating for a player at their primary position. */
export function ovr(p: { a: number[]; pos: Pos }): number {
  return Math.round(ovrAt(p.a, p.pos));
}
export function calcOvr(a: number[], pos: Pos): number {
  return Math.round(ovrAt(a, pos));
}

const FAMILY: Record<Pos, Pos[]> = {
  GK: [], CB: ['DM', 'LB', 'RB'], LB: ['RB', 'LM', 'CB'], RB: ['LB', 'RM', 'CB'], DM: ['CM', 'CB'], CM: ['DM', 'AM', 'LM', 'RM'],
  AM: ['CM', 'SS', 'LW', 'RW'], LM: ['RM', 'LW', 'LB', 'CM'], RM: ['LM', 'RW', 'RB', 'CM'], LW: ['RW', 'LM', 'SS', 'ST'], RW: ['LW', 'RM', 'SS', 'ST'],
  SS: ['ST', 'AM', 'LW', 'RW'], ST: ['SS', 'LW', 'RW'],
};
/** Rating of a player when used in a given position, including familiarity. */
export function fitAt(p: { a: number[]; pos: Pos; pos2: Pos[] }, pos: Pos): number {
  const raw = ovrAt(p.a, pos);
  if (p.pos === pos) return raw;
  if (pos === 'GK' || p.pos === 'GK') return raw * 0.5;
  // coaches judge by what they see: a player whose attributes suit another role can be used there,
  // with only a small cost for unfamiliarity (less within the same family of positions)
  if (p.pos2.includes(pos)) return raw * 0.99;
  if (FAMILY[p.pos].includes(pos)) return raw * 0.975;
  return raw * 0.95;
}

/** Playing-style emphasis profiles used when distributing attributes. */
export const STYLES: Record<string, { name: string; for: Pos[]; up: (keyof typeof A)[]; down: (keyof typeof A)[] }> = {
  balanced: { name: 'Balanced', for: POSITIONS, up: [], down: [] },
  poacher: { name: 'Poacher', for: ['ST', 'SS'], up: ['FIN', 'POS', 'REA', 'COM'], down: ['SPA', 'LPA', 'CRO', 'STA'] },
  target: { name: 'Target Forward', for: ['ST'], up: ['STR', 'HEA', 'JUM', 'BAL'], down: ['ACC', 'AGI', 'DRI'] },
  speedster: { name: 'Speedster', for: ['ST', 'SS', 'LW', 'RW', 'LM', 'RM', 'LB', 'RB'], up: ['ACC', 'SPD', 'AGI'], down: ['STR', 'HEA', 'LPA', 'VIS'] },
  dribbler: { name: 'Dribbler', for: ['LW', 'RW', 'AM', 'SS', 'LM', 'RM', 'ST'], up: ['DRI', 'AGI', 'BCO', 'SKL', 'BAL'], down: ['STR', 'HEA', 'TAC'] },
  playmaker: { name: 'Playmaker', for: ['AM', 'CM', 'SS', 'DM', 'LM', 'RM', 'LW', 'RW'], up: ['VIS', 'SPA', 'LPA', 'DEC', 'FTO'], down: ['STR', 'HEA', 'SPD'] },
  shooter: { name: 'Sharpshooter', for: ['ST', 'SS', 'AM', 'LW', 'RW', 'CM'], up: ['SHP', 'LSH', 'FIN', 'VOL'], down: ['TAC', 'MAR', 'CRO'] },
  engine: { name: 'Box-to-Box Engine', for: ['CM', 'DM', 'LM', 'RM', 'LB', 'RB'], up: ['STA', 'TAC', 'INT', 'STR', 'REA'], down: ['SKL', 'FIN', 'VOL'] },
  anchor: { name: 'Anchor', for: ['DM', 'CB', 'CM'], up: ['INT', 'DAW', 'TIQ', 'STR', 'MAR'], down: ['ACC', 'DRI', 'FIN'] },
  stopper: { name: 'Stopper', for: ['CB', 'DM', 'LB', 'RB'], up: ['TAC', 'STR', 'HEA', 'JUM'], down: ['SPA', 'VIS', 'DRI'] },
  ballplayer: { name: 'Ball-Playing Defender', for: ['CB', 'LB', 'RB', 'DM'], up: ['SPA', 'LPA', 'BCO', 'COM', 'VIS'], down: ['HEA', 'JUM'] },
  complete: { name: 'Complete Forward', for: ['ST', 'SS'], up: ['FIN', 'BCO', 'SPA', 'STR', 'HEA'], down: ['TAC', 'MAR'] },
  wingback: { name: 'Attacking Full-Back', for: ['LB', 'RB', 'LM', 'RM'], up: ['CRO', 'ACC', 'SPD', 'STA', 'DRI'], down: ['HEA', 'STR', 'MAR'] },
  sweeper: { name: 'Sweeper Keeper', for: ['GK'], up: ['GKK', 'GKP', 'REA'], down: ['GKD'] },
  shotstopper: { name: 'Shot-Stopper', for: ['GK'], up: ['GKR', 'GKD'], down: ['GKK'] },
};
export function stylesFor(pos: Pos): string[] {
  return Object.keys(STYLES).filter((k) => STYLES[k].for.includes(pos));
}

/**
 * Nudge attributes until the rounded, position-weighted OVR equals `target`.
 * Only touches attributes that are not locked. Used by balanced creation, by the
 * world generator and by the "auto-rebalance" option in the creator.
 */
export function solveToTarget(a: number[], pos: Pos, target: number, locked?: Set<number>): number[] {
  const w = POS_WEIGHTS[pos];
  target = clamp(Math.round(target), 1, 99);
  const idx: number[] = [];
  for (let i = 0; i < N_ATTR; i++) if (w[i] > 0 && !(locked && locked.has(i))) idx.push(i);
  if (!idx.length) return a;
  idx.sort((x, y) => w[y] - w[x]);
  let cur = ovrAt(a, pos);
  let guard = 0;
  let k = 0;
  while (Math.abs(cur - target) > 0.44 && guard++ < 6000) {
    const up = cur < target;
    const gap = Math.abs(target - cur);
    let moved = false;
    for (let n = 0; n < idx.length; n++) {
      const i = idx[(k + n) % idx.length];
      // prefer small-weight attributes when we are close, to land exactly on the target
      if (gap < 0.6 && w[i] > gap + 0.5 && n < idx.length - 1) continue;
      if (up && a[i] < 99) { a[i]++; cur += w[i]; moved = true; k = (k + n + 1) % idx.length; break; }
      if (!up && a[i] > 1) { a[i]--; cur -= w[i]; moved = true; k = (k + n + 1) % idx.length; break; }
    }
    if (!moved) break;
    cur = ovrAt(a, pos); // recompute exactly: no accumulated floating-point drift near .5 boundaries
  }
  return a;
}

/**
 * Balanced attribute distribution for a position, style and target OVR.
 * Key attributes for the position sit above the target, irrelevant ones well below.
 */
export function makeAttrs(pos: Pos, target: number, style: string, rng: Rng, spread = 4): number[] {
  const w = POS_WEIGHTS[pos];
  const st = STYLES[style] ?? STYLES.balanced;
  const a = new Array(N_ATTR).fill(0);
  const isGk = pos === 'GK';
  for (let i = 0; i < N_ATTR; i++) {
    const gkAttr = i >= N_OUT;
    let off: number;
    if (gkAttr && !isGk) { a[i] = clamp(Math.round(8 + rng.next() * 10), 1, 99); continue; }
    if (w[i] >= 0.07) off = 3;
    else if (w[i] >= 0.03) off = 0;
    else if (w[i] > 0) off = -5;
    else off = isGk ? -40 : -16;
    // universal athletic / mental attributes never collapse completely for outfielders
    if (!isGk && w[i] === 0 && (i === A.STA || i === A.REA || i === A.COM || i === A.BAL || i === A.DEC || i === A.TIQ || i === A.BCO || i === A.SPA || i === A.ACC || i === A.SPD || i === A.AGI || i === A.STR || i === A.JUM || i === A.FTO)) off = -8;
    if (isGk && (i === A.SPA || i === A.LPA || i === A.STR || i === A.JUM || i === A.DEC || i === A.TIQ || i === A.BAL)) off = -22;
    if (i === A.WFT || i === A.SKL) off = Math.min(off + 6, -2) - 6 + rng.next() * 14;
    if (i === A.PEN) off = (w[A.FIN] > 0.05 ? -2 : -12) + rng.next() * 8;
    a[i] = target + off + rng.normal() * spread;
  }
  for (const k of st.up) a[A[k]] += 6;
  for (const k of st.down) a[A[k]] -= 5;
  for (let i = 0; i < N_ATTR; i++) a[i] = clamp(Math.round(a[i]), 1, 99);
  return solveToTarget(a, pos, target);
}

/** Convert a fractional OVR change into concrete attribute points (growth or decline). */
export function shiftOvr(p: Player, delta: number, rng: Rng, focus?: number[]): number[] {
  const w = POS_WEIGHTS[p.pos];
  const changed: number[] = [];
  const dir = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  let guard = 0;
  const cand: number[] = [];
  const wt: number[] = [];
  for (let i = 0; i < N_ATTR; i++) {
    if (p.pos !== 'GK' && i >= N_OUT) continue;
    let weight = w[i] > 0 ? 1 + w[i] * 12 : 0.25;
    if (focus && focus.includes(i)) weight *= 3;
    if (dir < 0) {
      // age-related decline hits pace and stamina first
      if (i === A.ACC || i === A.SPD || i === A.STA || i === A.AGI || i === A.JUM || i === A.REA) weight *= 3;
      if (i === A.TIQ || i === A.DEC || i === A.VIS || i === A.COM || i === A.PEN) weight *= 0.15;
    }
    cand.push(i); wt.push(weight);
  }
  while (remaining > 0 && guard++ < 400) {
    const i = rng.weighted(cand, wt);
    if ((dir > 0 && p.a[i] >= 99) || (dir < 0 && p.a[i] <= 1)) continue;
    p.a[i] += dir;
    changed.push(i);
    remaining -= w[i] > 0 ? w[i] : 0.012;
  }
  return changed;
}

export function strengths(p: { a: number[]; pos: Pos }, n = 5): number[] {
  const lim = p.pos === 'GK' ? N_ATTR : N_OUT;
  const idx = [...Array(lim).keys()].filter((i) => p.pos === 'GK' || i < N_OUT);
  return idx.sort((x, y) => p.a[y] - p.a[x]).slice(0, n);
}
export function weaknesses(p: { a: number[]; pos: Pos }, n = 4): number[] {
  const w = POS_WEIGHTS[p.pos];
  const idx = [...Array(N_ATTR).keys()].filter((i) => w[i] > 0.02);
  return idx.sort((x, y) => p.a[x] - p.a[y]).slice(0, n);
}
/** Positions ranked by how well the attribute sheet suits them. */
export function bestRoles(a: number[], isGk: boolean): { pos: Pos; ovr: number }[] {
  const list = (isGk ? (['GK'] as Pos[]) : OUTFIELD).map((pos) => ({ pos, ovr: Math.round(ovrAt(a, pos)) }));
  return list.sort((x, y) => y.ovr - x.ovr);
}

export function age(p: { born: number }, season: number): number {
  return season - p.born;
}
