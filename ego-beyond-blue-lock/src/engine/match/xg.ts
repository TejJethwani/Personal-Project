/**
 * Simplified expected-goals model (documented, deterministic, context-based).
 *
 * xG is the probability that an AVERAGE finisher beats an AVERAGE goalkeeper from the same
 * shot context. It is a logistic function of shot geometry and situation:
 *
 *   logit(xG) = -1.25 + 1.60·θ − 0.10·d + Σ modifiers
 *
 *   θ  = angle (radians) subtended by the goal mouth (7.32 m) from the shot location
 *   d  = distance (metres) from the shot location to the centre of the goal
 *
 * Modifiers (added to the logit):
 *   header                    −1.00
 *   volley / airborne strike  −0.35
 *   defender pressure p∈[0,1] −1.20·p
 *   one-on-one with keeper    +0.90
 *   rebound                   +0.30
 *   cut-back / first-time on the ground from a pass  +0.15
 *
 * Fixed values: penalty 0.76; direct free kick uses the open-play formula with pressure 0.35 (the wall).
 *
 * Calibration targets (central, unpressured, foot): 6 m ≈ 0.47, 11 m ≈ 0.22, 16 m ≈ 0.10,
 * 20 m ≈ 0.06, 25 m ≈ 0.035, 30 m ≈ 0.02.
 *
 * The simulation's actual scoring chance starts from this same logit and then adds the
 * shooter-vs-keeper skill difference and ability effects, so skilled finishers genuinely
 * outperform their xG while xG itself stays a neutral measure of chance quality.
 * xA is the xG of the shot created by a pass.
 */
export const PITCH_L = 105;
export const PITCH_W = 68;
const HALF_GOAL = 3.66;

export interface ShotGeo { d: number; theta: number }

/** ax: attack-frame x (100 = goal line being attacked), y: 0..100 across the pitch. */
export function shotGeo(ax: number, y: number): ShotGeo {
  const dx = Math.max(0.5, (100 - ax) * (PITCH_L / 100));
  const dy = (y - 50) * (PITCH_W / 100);
  const d = Math.sqrt(dx * dx + dy * dy);
  const a1 = Math.atan2(dy + HALF_GOAL, dx);
  const a2 = Math.atan2(dy - HALF_GOAL, dx);
  return { d, theta: Math.abs(a1 - a2) };
}

export function xgLogit(g: ShotGeo, o: { header?: boolean; volley?: boolean; pressure: number; oneOnOne?: boolean; rebound?: boolean; cutback?: boolean }): number {
  let l = -1.25 + 1.6 * g.theta - 0.1 * g.d;
  if (o.header) l -= 1.0;
  if (o.volley) l -= 0.35;
  l -= 1.2 * o.pressure;
  if (o.oneOnOne) l += 0.9;
  if (o.rebound) l += 0.3;
  if (o.cutback) l += 0.15;
  return l;
}
export const PENALTY_XG = 0.76;
export const logistic = (l: number) => 1 / (1 + Math.exp(-l));
export const logit = (p: number) => Math.log(p / (1 - p));
