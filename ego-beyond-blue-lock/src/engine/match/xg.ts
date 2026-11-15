/**
 * Simplified expected-goals model (documented, deterministic, context-based).
 *
 * xG is the probability that an AVERAGE finisher beats an AVERAGE goalkeeper from the same
 * shot context. It is a logistic function of shot geometry and situation:
 *
 *   logit(xG) = -0.55 + 1.60·θ − 0.10·d + Σ modifiers        (inside the penalty area)
 *   xG = 0.20·e^(−(d−18)/30)·(1 − 0.3·p)                   (outside the area: ≈0.20 at the edge, 0.12 at 22 m, 0.06 at 28 m, 0.03 at 34 m)
 *
 *   θ  = angle (radians) subtended by the goal mouth (7.32 m) from the shot location
 *   d  = distance (metres) from the shot location to the centre of the goal
 *
 * Modifiers (added to the logit):
 *   header                    −1.00
 *   volley / airborne strike  −0.35
 *   defender pressure p∈[0,1] −0.50·p   (only real, physical pressure — never the shooter's reputation)
 *   one-on-one with keeper    +1.25
 *   rebound                   +0.45
 *   cut-back / first-time on the ground from a pass  +0.35
 *   inside the six-yard area, foot  +0.35 (tap-in range)
 *
 * Fixed values: penalty 0.76; direct free kick uses the open-play formula with pressure 0.35 (the wall).
 *
 * Calibration targets (central, unpressured, foot): 4 m ≈ 0.82, 6 m ≈ 0.58, 11 m ≈ 0.31, 16 m ≈ 0.15,
 * 20 m ≈ 0.09, 25 m ≈ 0.05, 30 m ≈ 0.03. Under full pressure these drop to roughly 0.46 (6 m), 0.21 (11 m)
 * and 0.10 (16 m). A clean one-on-one from 11 m ≈ 0.6, a cut-back tap-in ≈ 0.85.
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
  // Outside the penalty area the model is deliberately generous (game feel): about 0.20 from the
  // edge of the box, fading slowly with distance, and only mildly reduced by pressure.
  if (g.d > 16.5) {
    let x = 0.2 * Math.exp(-(Math.max(17, g.d) - 17) / 9) * (1 - 0.45 * o.pressure);
    if (o.volley) x *= 0.8;
    if (o.header) x *= 0.3;
    if (o.oneOnOne) x *= 1.3;
    return logit(Math.min(0.3, Math.max(0.02, x)));
  }
  let l = -0.9 + 1.6 * g.theta - 0.1 * g.d;
  if (o.header) l -= 1.0;
  if (o.volley) l -= 0.35;
  l -= 0.5 * o.pressure;
  if (o.oneOnOne) l += 0.55;
  if (o.rebound) l += 0.45;
  if (o.cutback) l += 0.35;
  if (g.d < 5.5 && !o.header) l += 0.35;
  // inside the box a shot on a sensible angle is never worth less than a long shot
  // open-play chances inside the box are compressed into roughly 0.2–0.65: nothing in the box is hopeless, nothing is automatic
  const x = 1 / (1 + Math.exp(-l));
  return logit(o.header ? 0.07 + 0.48 * x : 0.13 + 0.5 * x);
}
export const PENALTY_XG = 0.76;
export const logistic = (l: number) => 1 / (1 + Math.exp(-l));
export const logit = (p: number) => Math.log(p / (1 - p));
