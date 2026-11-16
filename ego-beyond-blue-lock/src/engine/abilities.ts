/**
 * Ability system: weapons, passives, ultimates, Flow, evolutions, hybrids, chemical
 * reactions and the custom ability builder.
 *
 * Every ability is expressed through a small set of mechanical modifiers (ModKeys) that the
 * match engine understands. Abilities never bypass the simulation: they shift probabilities
 * in specific contexts, cost stamina/Flow when actively triggered, and lose effectiveness as
 * opponents read repeated use.
 */
import type { AbilityRef, CustomAbility, Player } from './types';
import { A } from './attributes';

export const M = {
  SH_PLACED: 0, SH_POWER: 1, SH_LONG: 2, SH_HEAD: 3, SH_VOLLEY: 4, SH_ANGLE: 5, SH_FIRST: 6, SH_1V1: 7, SH_PRESS: 8, SH_WEAK: 9,
  RUN_BLIND: 10, RUN_BEHIND: 11, BOX_POS: 12, REBOUND: 13,
  DR_TIGHT: 14, DR_OPEN: 15, DR_SKILL: 16,
  PA_SHORT: 17, PA_THROUGH: 18, PA_LONG: 19, PA_CROSS: 20, PA_DISG: 21, ONE_TWO: 22,
  PRESS_RES: 23, HOLD: 24, TEMPO: 25,
  AERIAL: 26, TACKLE: 27, INTERCEPT: 28, READ: 29,
  FLOW_GAIN: 30, STA_SAVE: 31, LATE_STA: 32, COMPOSURE: 33, RIVAL: 34, BIGMATCH: 35, CHEM_GAIN: 36, LEARN: 37, INJ_RES: 38, VISION: 39, PACE: 40, ADAPT: 41,
} as const;
export type ModKey = keyof typeof M;
export const N_MODS = 42;

export interface ModInfo { name: string; unit: 'logit' | 'frac' | 'prob'; cost: number; text: string; counter: string; limit: string; max: number }
/** Human-readable catalogue of every supported mechanical effect (also drives the custom builder). */
export const MODS: Record<ModKey, ModInfo> = {
  SH_PLACED: { name: 'Placed finishing', unit: 'logit', cost: 3, max: 0.5, text: 'Raises the chance of scoring with placed shots inside the box.', counter: 'Keepers with elite positioning narrow the placement window.', limit: 'No effect on shots from outside the box.' },
  SH_POWER: { name: 'Power striking', unit: 'logit', cost: 3, max: 0.5, text: 'Raises the chance of scoring with power shots.', counter: 'Blocks: a close defender still gets a body in the way.', limit: 'Power shots miss the target more often.' },
  SH_LONG: { name: 'Long-range shooting', unit: 'logit', cost: 3, max: 0.6, text: 'Raises the chance of scoring from beyond 18 metres.', counter: 'Closing down quickly forces a blocked or rushed strike.', limit: 'Distance still drags the baseline chance down.' },
  SH_HEAD: { name: 'Headed finishing', unit: 'logit', cost: 2, max: 0.5, text: 'Raises the chance of scoring with headers.', counter: 'Winning the aerial duel denies the header entirely.', limit: 'Requires a cross or lofted delivery.' },
  SH_VOLLEY: { name: 'Airborne technique', unit: 'logit', cost: 2, max: 0.5, text: 'Raises the chance of scoring volleys and other strikes on airborne balls.', counter: 'Contact from a marker unbalances the strike.', limit: 'Only applies when the ball arrives off the ground.' },
  SH_ANGLE: { name: 'Tight-angle finishing', unit: 'logit', cost: 3, max: 0.6, text: 'Offsets the penalty for shooting from narrow angles using curve and outside-foot technique.', counter: 'A keeper covering the near post leaves only the far-post curler.', limit: 'Scales with how narrow the angle is; no bonus from central positions.' },
  SH_FIRST: { name: 'First-time striking', unit: 'logit', cost: 3, max: 0.65, text: 'Raises the chance of scoring when shooting first-time from an arriving ball.', counter: 'Cut the supply line: without a clean delivery there is nothing to hit.', limit: 'Only on balls that just arrived from a pass, cross or rebound.' },
  SH_1V1: { name: 'One-on-one finishing', unit: 'logit', cost: 2, max: 0.5, text: 'Raises the chance of beating the keeper when clean through.', counter: 'Keepers who stay big; recovering defenders adding pressure.', limit: 'Only applies when through on goal.' },
  SH_PRESS: { name: 'Shooting under pressure', unit: 'frac', cost: 3, max: 0.7, text: 'Removes part of the pressure penalty on shots.', counter: 'Blocks are unaffected.', limit: 'Does nothing when unmarked.' },
  SH_WEAK: { name: 'Weak-foot striking', unit: 'frac', cost: 2, max: 0.9, text: 'Removes part of the weak-foot penalty.', counter: 'None specific.', limit: 'Only matters when the ball falls to the weaker side.' },
  RUN_BLIND: { name: 'Blindside runs', unit: 'logit', cost: 3, max: 0.7, text: 'Raises the chance of losing your marker with runs behind their line of sight.', counter: 'Markers with high defensive awareness and deep defensive lines.', limit: 'A passer still has to see and execute the ball.' },
  RUN_BEHIND: { name: 'Runs in behind', unit: 'logit', cost: 3, max: 0.6, text: 'Improves timing on runs beyond the last defender and trims offside risk.', counter: 'A low block removes the space to run into.', limit: 'Needs space behind the defensive line.' },
  BOX_POS: { name: 'Box positioning', unit: 'logit', cost: 3, max: 0.55, text: 'Finds pockets of space inside the penalty area.', counter: 'Tight man-marking by strong markers.', limit: 'Only inside or on the edge of the box.' },
  REBOUND: { name: 'Rebound instinct', unit: 'prob', cost: 2, max: 0.25, text: 'Raises the chance of reaching rebounds and loose balls in the box first.', counter: 'Keepers who hold shots cleanly.', limit: 'Only triggers on parried or blocked shots.' },
  DR_TIGHT: { name: 'Close-quarters dribbling', unit: 'logit', cost: 3, max: 0.7, text: 'Raises take-on success when tightly marked or crowded.', counter: 'Doubling up; strong tacklers who stay on their feet.', limit: 'No bonus in open space.' },
  DR_OPEN: { name: 'Dribbling at speed', unit: 'logit', cost: 2, max: 0.6, text: 'Raises take-on and carry success in open space.', counter: 'Showing the dribbler wide into traffic.', limit: 'No bonus when the space is closed.' },
  DR_SKILL: { name: 'Skill moves', unit: 'logit', cost: 3, max: 0.7, text: 'Raises the success of skill-move take-ons.', counter: 'Each repeated move is easier to read.', limit: 'Failure loses the ball outright.' },
  PA_SHORT: { name: 'Short passing', unit: 'logit', cost: 2, max: 0.4, text: 'Raises short-pass accuracy.', counter: 'Man-marking the receiver.', limit: 'Short passes only.' },
  PA_THROUGH: { name: 'Through balls', unit: 'logit', cost: 3, max: 0.6, text: 'Raises through-ball accuracy.', counter: 'Deep defensive lines and sweeping keepers.', limit: 'Needs a runner.' },
  PA_LONG: { name: 'Long passing', unit: 'logit', cost: 2, max: 0.5, text: 'Raises accuracy of switches and long balls.', counter: 'Aerially dominant defenders.', limit: 'Long passes only.' },
  PA_CROSS: { name: 'Crossing', unit: 'logit', cost: 2, max: 0.7, text: 'Raises the quality of crosses and cut-backs.', counter: 'Defenders who win first contact.', limit: 'Wide deliveries only.' },
  PA_DISG: { name: 'Disguise', unit: 'frac', cost: 3, max: 0.6, text: 'Ignores part of the interception risk from defenders near the passing lane.', counter: 'Defenders with high tactical intelligence stop biting on the feint.', limit: 'Pressure on the passer is unaffected.' },
  ONE_TWO: { name: 'One-two combinations', unit: 'logit', cost: 2, max: 0.7, text: 'Raises the success of give-and-go combinations.', counter: 'Tracking the runner instead of the ball.', limit: 'Needs a nearby teammate; scales with chemistry.' },
  PRESS_RES: { name: 'Press resistance', unit: 'frac', cost: 3, max: 0.6, text: 'Ignores part of the pressure penalty on passes, holds and first touches.', counter: 'Fouls and two-man traps.', limit: 'Does not help shooting.' },
  HOLD: { name: 'Shielding', unit: 'logit', cost: 2, max: 0.7, text: 'Raises the chance of holding the ball up against a defender.', counter: 'Stronger centre-backs.', limit: 'Static: play does not progress on its own.' },
  TEMPO: { name: 'Tempo control', unit: 'logit', cost: 3, max: 0.6, text: 'A successful hold freezes nearby defenders, lowering pressure and opening runs for the next action.', counter: 'Aggressive pressing that never lets the carrier settle.', limit: 'Costs time; the defence can reset behind the ball.' },
  AERIAL: { name: 'Aerial duels', unit: 'logit', cost: 3, max: 0.8, text: 'Raises the chance of winning aerial duels.', counter: 'Blocking the run before the jump.', limit: 'Only on airborne balls.' },
  TACKLE: { name: 'Tackling', unit: 'logit', cost: 3, max: 0.7, text: 'Raises tackle success and lowers foul risk.', counter: 'Quick releases and one-touch play.', limit: 'A missed tackle still takes you out of the play.' },
  INTERCEPT: { name: 'Interceptions', unit: 'prob', cost: 3, max: 0.3, text: 'Raises the chance of cutting out passes in your lane.', counter: 'Disguised passing.', limit: 'Only when the pass travels near you.' },
  READ: { name: 'Reading the game', unit: 'logit', cost: 2, max: 0.5, text: 'Makes it harder for runners you mark to lose you.', counter: 'Pure pace.', limit: 'Only against your direct opponent.' },
  FLOW_GAIN: { name: 'Flow gain', unit: 'frac', cost: 3, max: 0.6, text: 'Builds the Flow meter faster.', counter: 'Flow still drains and each re-entry gets harder.', limit: 'Does not extend Flow duration.' },
  STA_SAVE: { name: 'Energy efficiency', unit: 'frac', cost: 2, max: 0.4, text: 'Reduces stamina drain.', counter: 'None.', limit: 'Active ability costs are unchanged.' },
  LATE_STA: { name: 'Late-game legs', unit: 'frac', cost: 2, max: 0.7, text: 'Removes part of the fatigue penalty in the later stages of a match.', counter: 'None.', limit: 'No effect early on.' },
  COMPOSURE: { name: 'Composure', unit: 'frac', cost: 3, max: 0.5, text: 'Removes part of the pressure penalty on every action.', counter: 'Physical contact still wins duels.', limit: 'Does nothing when unpressured.' },
  RIVAL: { name: 'Rival focus', unit: 'logit', cost: 2, max: 0.35, text: 'Bonus to every action when a declared rival is on the pitch.', counter: 'None.', limit: 'Requires a rival in the match.' },
  BIGMATCH: { name: 'Big-match temperament', unit: 'logit', cost: 2, max: 0.35, text: 'Bonus to every action in high-importance matches.', counter: 'None.', limit: 'Routine fixtures give nothing.' },
  CHEM_GAIN: { name: 'Chemistry growth', unit: 'frac', cost: 2, max: 1.2, text: 'Tactical chemistry with teammates builds faster.', counter: 'None.', limit: 'Still requires shared matches and sessions.' },
  LEARN: { name: 'Learning rate', unit: 'frac', cost: 2, max: 1.2, text: 'Learns observed abilities faster.', counter: 'None.', limit: 'Attribute requirements still apply.' },
  INJ_RES: { name: 'Injury resistance', unit: 'frac', cost: 2, max: 0.7, text: 'Lowers injury chance.', counter: 'None.', limit: 'Does not prevent fatigue.' },
  VISION: { name: 'Vision', unit: 'logit', cost: 3, max: 0.6, text: 'Improves key passes and reveals extra passing options.', counter: 'Compact shapes with no gaps to find.', limit: 'Execution still depends on passing technique.' },
  PACE: { name: 'Burst', unit: 'logit', cost: 3, max: 0.7, text: 'Bonus in foot races and when attacking space.', counter: 'A head start: defenders who drop early.', limit: 'Drains stamina when actively triggered.' },
  ADAPT: { name: 'Adaptation', unit: 'logit', cost: 2, max: 0.3, text: 'After losing a duel, the next attempt against the same opponent improves.', counter: 'Variety from the defender.', limit: 'Resets after a won duel.' },
};

export interface Fx { k: ModKey; v: number; per: number }
export type ActCtx = 'shot_first' | 'shot_long' | 'shot_box' | 'shot_angle' | 'shot_air' | 'run' | 'dribble_tight' | 'dribble_open' | 'dribble_skill' | 'pass_through' | 'pass_any' | 'cross' | 'hold' | 'aerial' | 'tackle' | 'intercept' | 'onetwo';

export interface AbilityDef {
  id: string;
  kind: 'weapon' | 'passive' | 'ultimate';
  name: string;
  tags: string[];
  desc: string;
  req: string;
  reqAttr?: [number, number][];
  fx: Fx[];
  act?: { name: string; ctx: ActCtx; fx: Fx[]; sta: number; desc: string };
  cost: string;
  counter: string;
  limits: string;
  rarity: number; // 1 common .. 5 one-of-a-kind
  evo?: { id: string; name: string; desc: string; fx: Fx[] }[];
  lines: string[];
  ult?: string;
  custom?: boolean;
}

const f = (k: ModKey, v: number, per: number): Fx => ({ k, v, per });

export const WEAPONS: AbilityDef[] = [
  {
    id: 'direct_shot', kind: 'weapon', name: 'Direct Shot', tags: ['shoot'], rarity: 3,
    desc: 'Explosive first-time shooting. You strike the arriving ball without a settling touch, before the defence and keeper are set.',
    req: 'A pass, cross or rebound must arrive at your feet within shooting range.', reqAttr: [[A.FIN, 70], [A.FTO, 62]],
    fx: [f('SH_FIRST', 0.3, 0.07)],
    act: { name: 'Direct Shot', ctx: 'shot_first', fx: [f('SH_FIRST', 0.32, 0.06), f('SH_POWER', 0.1, 0.03)], sta: 4, desc: 'Hit it first time with full commitment.' },
    cost: 'Triggered: 4 stamina.', counter: 'Deny the delivery. A defender who blocks the passing lane or steps across the first touch removes the trigger entirely.',
    limits: 'Only works on a ball that has just arrived. Weak-foot deliveries lose accuracy. Each trigger in a match is easier for the defence to read.',
    evo: [
      { id: 'chain_direct', name: 'Chain Direct', desc: 'Either foot, any body shape: removes most of the weak-foot penalty on direct shots.', fx: [f('SH_WEAK', 0.4, 0.08), f('SH_FIRST', 0.1, 0.02)] },
      { id: 'impact_direct', name: 'Impact Direct', desc: 'Maximum swing speed: direct shots keep their threat from distance.', fx: [f('SH_LONG', 0.25, 0.05), f('SH_POWER', 0.15, 0.03)] },
    ],
    lines: ['{n} doesn\'t take a touch — DIRECT SHOT!', 'First time! {n} hits it before anyone can react!', '{n} meets it on the half-turn and lets fly without breaking stride!'],
  },
  {
    id: 'blindside', kind: 'weapon', name: 'Blindside Movement', tags: ['move'], rarity: 3,
    desc: 'Runs that begin behind a defender\'s line of sight, arriving in space they never saw you leave for.',
    req: 'Off the ball in the middle or attacking third while a teammate has possession.', reqAttr: [[A.POS, 70], [A.ACC, 60]],
    fx: [f('RUN_BLIND', 0.35, 0.08)],
    act: { name: 'Blindside Run', ctx: 'run', fx: [f('RUN_BLIND', 0.38, 0.07)], sta: 3, desc: 'Vanish off your marker\'s shoulder.' },
    cost: 'Triggered: 3 stamina.', counter: 'Markers with high defensive awareness, and deep defensive lines that keep you in front of them.',
    limits: 'A teammate must see and deliver the pass. Low trust or chemistry means the run is often ignored.',
    evo: [
      { id: 'ghost_step', name: 'Ghost Step', desc: 'Double movement: the first run is a decoy.', fx: [f('RUN_BLIND', 0.2, 0.04), f('BOX_POS', 0.15, 0.03)] },
      { id: 'shadow_line', name: 'Shadow Line', desc: 'Blindside runs stay onside more reliably.', fx: [f('RUN_BEHIND', 0.3, 0.05)] },
    ],
    lines: ['Where did {n} come from?! Nobody tracked that run!', '{n} ghosts in on the blindside!', 'The marker checks his shoulder — too late, {n} is gone.'],
  },
  {
    id: 'tight_dribble', kind: 'weapon', name: 'Tight-Space Dribbling', tags: ['dribble'], rarity: 3,
    desc: 'Micro-touches and a low centre of gravity let you escape when surrounded.',
    req: 'On the ball with at least one defender tight to you.', reqAttr: [[A.DRI, 72], [A.AGI, 66]],
    fx: [f('DR_TIGHT', 0.35, 0.08)],
    act: { name: 'Phone-Booth Dribble', ctx: 'dribble_tight', fx: [f('DR_TIGHT', 0.38, 0.07)], sta: 5, desc: 'Wriggle out of the crowd.' },
    cost: 'Triggered: 5 stamina.', counter: 'Double teams and strong tacklers who refuse to commit early.',
    limits: 'No benefit in open space. Failure usually means losing the ball in a dangerous area.',
    evo: [
      { id: 'needle_thread', name: 'Needle Threader', desc: 'Beat the press, then release: bonus to the next pass after a tight escape.', fx: [f('PA_SHORT', 0.2, 0.04), f('PRESS_RES', 0.15, 0.03)] },
      { id: 'box_dancer', name: 'Box Dancer', desc: 'Tight dribbles inside the area create a cleaner shot.', fx: [f('SH_PRESS', 0.3, 0.05)] },
    ],
    lines: ['{n} wriggles through a gap that wasn\'t there!', 'Three around {n}… and somehow still on the ball!', 'Tiny touches, tiny spaces — {n} escapes!'],
  },
  {
    id: 'box_predator', kind: 'weapon', name: 'Predatory Box Positioning', tags: ['move', 'shoot'], rarity: 2,
    desc: 'An instinct for where the ball will drop inside the penalty area.',
    req: 'Inside or arriving in the penalty area.', reqAttr: [[A.POS, 72], [A.REA, 66]],
    fx: [f('BOX_POS', 0.3, 0.07), f('REBOUND', 0.08, 0.02)],
    act: { name: 'Instinct Finish', ctx: 'shot_box', fx: [f('SH_PLACED', 0.28, 0.05)], sta: 2, desc: 'Trust the instinct: finish early.' },
    cost: 'Triggered: 2 stamina.', counter: 'Tight man-marking from strong markers; keepers who hold shots and kill rebounds.',
    limits: 'Outside the box this weapon does nothing.',
    evo: [
      { id: 'fox', name: 'Fox in the Box', desc: 'Even stronger rebound instinct.', fx: [f('REBOUND', 0.1, 0.02), f('SH_FIRST', 0.12, 0.03)] },
      { id: 'six_yard', name: 'Six-Yard King', desc: 'Close-range finishing under contact.', fx: [f('SH_PRESS', 0.3, 0.05)] },
    ],
    lines: ['{n} is exactly where a striker should be!', 'Right place, right time — that\'s no accident from {n}.', '{n} smells it first!'],
  },
  {
    id: 'long_cannon', kind: 'weapon', name: 'Long-Range Cannon', tags: ['shoot'], rarity: 3,
    desc: 'Power shooting from distance that forces defences to step out and leave space behind.',
    req: 'On the ball 18–32 metres from goal with a sight of it.', reqAttr: [[A.SHP, 74], [A.LSH, 70]],
    fx: [f('SH_LONG', 0.35, 0.08), f('SH_POWER', 0.1, 0.03)],
    act: { name: 'Cannon Shot', ctx: 'shot_long', fx: [f('SH_LONG', 0.4, 0.07)], sta: 5, desc: 'Unload from range.' },
    cost: 'Triggered: 5 stamina.', counter: 'Close the shooter down early: a tight defender turns the cannon into a blocked shot.',
    limits: 'Distance still lowers the baseline chance; expect more misses than goals.',
    evo: [
      { id: 'knuckle', name: 'Knuckle Strike', desc: 'Unpredictable flight: keepers struggle to hold it, more rebounds.', fx: [f('SH_LONG', 0.15, 0.03), f('SH_POWER', 0.15, 0.03)] },
      { id: 'mid_sniper', name: 'Mid-Range Sniper', desc: 'Precision over power from the edge of the box.', fx: [f('SH_PLACED', 0.2, 0.04), f('SH_PRESS', 0.15, 0.03)] },
    ],
    lines: ['{n} from distance… what a HIT!', 'He\'s a long way out — {n} doesn\'t care!', '{n} winds up from range!'],
  },
  {
    id: 'disguised_pass', kind: 'weapon', name: 'Disguised Passing', tags: ['pass'], rarity: 3,
    desc: 'Eyes one way, ball the other. Defenders in the lane react to the wrong pass.',
    req: 'On the ball with a passing option.', reqAttr: [[A.VIS, 72], [A.SPA, 70]],
    fx: [f('PA_DISG', 0.25, 0.06), f('PA_THROUGH', 0.15, 0.04)],
    act: { name: 'No-Look Pass', ctx: 'pass_through', fx: [f('PA_THROUGH', 0.36, 0.07)], sta: 2, desc: 'Sell the fake, slide the real one.' },
    cost: 'Triggered: 2 stamina.', counter: 'Tactically intelligent defenders stop reacting to body shape after seeing it a few times.',
    limits: 'Pressure on you is not reduced; a rushed disguise is still a rushed pass.',
    evo: [
      { id: 'magician', name: 'Magician\'s Weight', desc: 'Passes arrive perfectly weighted for a first-time finish.', fx: [f('VISION', 0.25, 0.05)] },
      { id: 'switchblade', name: 'Switchblade', desc: 'Disguise extends to long diagonal switches.', fx: [f('PA_LONG', 0.3, 0.05)] },
    ],
    lines: ['{n} looks left and plays it right — beautiful!', 'Nobody read that pass. Nobody.', 'A disguised ball from {n} splits them open!'],
  },
  {
    id: 'aerial_dom', kind: 'weapon', name: 'Aerial Domination', tags: ['aerial'], rarity: 2,
    desc: 'Timing, leap and upper-body strength make every high ball yours.',
    req: 'A cross, corner or lofted ball arriving near you.', reqAttr: [[A.JUM, 72], [A.HEA, 70]],
    fx: [f('AERIAL', 0.4, 0.09), f('SH_HEAD', 0.2, 0.05)],
    act: { name: 'Tower Header', ctx: 'aerial', fx: [f('AERIAL', 0.4, 0.07)], sta: 4, desc: 'Attack the ball at its highest point.' },
    cost: 'Triggered: 4 stamina.', counter: 'Block the run before the jump, or keep the ball on the ground.',
    limits: 'Useless when your team plays everything to feet.',
    evo: [
      { id: 'hang_time', name: 'Hang Time', desc: 'Directed headers: better accuracy.', fx: [f('SH_HEAD', 0.25, 0.05)] },
      { id: 'knockdown', name: 'Knock-Down Artist', desc: 'Win it and lay it off: second balls fall to teammates.', fx: [f('HOLD', 0.2, 0.04), f('AERIAL', 0.15, 0.03)] },
    ],
    lines: ['{n} climbs above everyone!', 'What a leap from {n}!', '{n} owns the airspace!'],
  },
  {
    id: 'curve_finish', kind: 'weapon', name: 'Curve & Trivela Finishing', tags: ['shoot'], rarity: 4,
    desc: 'Bend it with the instep or whip it with the outside of the boot: narrow angles become shooting chances.',
    req: 'A shot from a wide or narrow angle.', reqAttr: [[A.FIN, 70], [A.BCO, 70]],
    fx: [f('SH_ANGLE', 0.35, 0.08), f('SH_PLACED', 0.08, 0.02)],
    act: { name: 'Bending Finish', ctx: 'shot_angle', fx: [f('SH_ANGLE', 0.38, 0.07)], sta: 3, desc: 'Curl it around the keeper.' },
    cost: 'Triggered: 3 stamina.', counter: 'A keeper who covers the near post and a defender showing you onto your weaker side.',
    limits: 'No bonus from central positions.',
    evo: [
      { id: 'banana', name: 'Banana Curve', desc: 'Curled shots keep their threat from longer range.', fx: [f('SH_LONG', 0.25, 0.05)] },
      { id: 'trivela', name: 'Pure Trivela', desc: 'Outside-foot technique removes weak-side problems.', fx: [f('SH_WEAK', 0.4, 0.08)] },
    ],
    lines: ['{n} bends it… oh, that is WICKED!', 'Outside of the boot from {n}!', 'The curl on that from {n}!'],
  },
  {
    id: 'tempo_control', kind: 'weapon', name: 'Tempo Manipulation', tags: ['mind', 'pass'], rarity: 4,
    desc: 'Slow the game to a walk, then snap it forward. Defenders freeze on your rhythm.',
    req: 'On the ball and able to hold it.', reqAttr: [[A.BCO, 70], [A.DEC, 70]],
    fx: [f('TEMPO', 0.3, 0.07), f('PRESS_RES', 0.1, 0.03)],
    act: { name: 'Freeze Frame', ctx: 'hold', fx: [f('TEMPO', 0.36, 0.07)], sta: 2, desc: 'Stop. Wait. Make them wait with you.' },
    cost: 'Triggered: 2 stamina.', counter: 'Relentless pressing never lets you put a foot on the ball.',
    limits: 'Slowing play lets the defence reset its shape behind the ball.',
    evo: [
      { id: 'metronome', name: 'Metronome', desc: 'Team-mates time their runs to your rhythm.', fx: [f('VISION', 0.2, 0.04), f('PA_THROUGH', 0.15, 0.03)] },
      { id: 'gear_shift', name: 'Gear Shift', desc: 'Explode out of the pause.', fx: [f('DR_OPEN', 0.3, 0.05)] },
    ],
    lines: ['{n} puts a foot on it… and the whole game waits.', 'Everything slows around {n}.', '{n} dictates the rhythm here.'],
  },
  {
    id: 'press_resist', kind: 'weapon', name: 'Press Resistance', tags: ['mind', 'dribble'], rarity: 2,
    desc: 'Receive on the half-turn, ride contact and play out of traps.',
    req: 'On the ball under pressure.', reqAttr: [[A.BCO, 70], [A.BAL, 64]],
    fx: [f('PRESS_RES', 0.3, 0.06), f('HOLD', 0.2, 0.05)],
    act: { name: 'Roll Out', ctx: 'dribble_tight', fx: [f('DR_TIGHT', 0.25, 0.05), f('PRESS_RES', 0.15, 0.03)], sta: 3, desc: 'Turn away from the trap.' },
    cost: 'Triggered: 3 stamina.', counter: 'Tactical fouls and two-man traps.',
    limits: 'Helps you keep the ball, not hurt them with it.',
    evo: [
      { id: 'pivot', name: 'Pivot Master', desc: 'Escape and switch play.', fx: [f('PA_LONG', 0.25, 0.05)] },
      { id: 'magnet', name: 'Press Magnet', desc: 'Drawing pressure frees team-mates.', fx: [f('VISION', 0.2, 0.04), f('PA_SHORT', 0.15, 0.03)] },
    ],
    lines: ['Pressed from both sides — {n} just rolls away from it.', '{n} is unpressable right now.', 'They hunt {n} and come away with nothing.'],
  },
  {
    id: 'speed_burst', kind: 'weapon', name: 'Explosive Acceleration', tags: ['pace', 'dribble'], rarity: 3,
    desc: 'A standing-start burst that turns any half-metre into a footrace you win.',
    req: 'Space ahead of you, on or off the ball.', reqAttr: [[A.ACC, 80], [A.SPD, 76]],
    fx: [f('PACE', 0.35, 0.08), f('DR_OPEN', 0.2, 0.05), f('RUN_BEHIND', 0.15, 0.04)],
    act: { name: 'Burst', ctx: 'dribble_open', fx: [f('DR_OPEN', 0.4, 0.07)], sta: 7, desc: 'Knock it past and go.' },
    cost: 'Triggered: 7 stamina. The most expensive weapon to spam.', counter: 'Defenders who drop early and deny the space; deep lines.',
    limits: 'Heavy stamina cost. Useless in crowded areas.',
    evo: [
      { id: 'afterburner', name: 'Afterburner', desc: 'Top speed holds through contact.', fx: [f('PACE', 0.2, 0.04), f('HOLD', 0.15, 0.03)] },
      { id: 'stop_start', name: 'Stop-Start', desc: 'Change of pace unbalances markers in tighter areas.', fx: [f('DR_TIGHT', 0.25, 0.05)] },
    ],
    lines: ['{n} hits the afterburners!', 'Nobody is catching {n}!', 'Pure pace from {n} — goodbye!'],
  },
  {
    id: 'panoramic', kind: 'weapon', name: 'Panoramic Vision', tags: ['mind', 'pass'], rarity: 5,
    desc: 'You process the whole pitch at once: where every player is and where they will be.',
    req: 'Always partially active; fully triggered on the ball.', reqAttr: [[A.VIS, 76], [A.TIQ, 76], [A.DEC, 74]],
    fx: [f('VISION', 0.3, 0.07), f('PA_THROUGH', 0.1, 0.03), f('READ', 0.1, 0.03)],
    act: { name: 'Full-Field Read', ctx: 'pass_any', fx: [f('VISION', 0.22, 0.05), f('PA_DISG', 0.15, 0.03)], sta: 2, desc: 'See it all, pick the best line.' },
    cost: 'Triggered: 2 stamina.', counter: 'Compact shapes with no gaps to find; physical disruption before you can lift your head.',
    limits: 'Seeing the pass is not the same as executing it — technique still decides.',
    evo: [
      { id: 'predictive', name: 'Predictive Eye', desc: 'Anticipate turnovers: stronger interceptions and second balls.', fx: [f('INTERCEPT', 0.1, 0.02), f('REBOUND', 0.06, 0.02)] },
      { id: 'conductor', name: 'Conductor', desc: 'Your reads sharpen your own movement.', fx: [f('BOX_POS', 0.2, 0.04), f('RUN_BLIND', 0.15, 0.03)] },
    ],
    lines: ['{n} saw that three moves ago.', 'How did {n} even see that?', '{n} is reading this game like a map.'],
  },
  {
    id: 'two_footed', kind: 'weapon', name: 'Ambidextrous Striking', tags: ['shoot'], rarity: 3,
    desc: 'No weak side. Defenders cannot show you one way.',
    req: 'Any shot or pass on the weaker foot.', reqAttr: [[A.WFT, 70]],
    fx: [f('SH_WEAK', 0.5, 0.1), f('SH_PLACED', 0.08, 0.02)],
    act: { name: 'Either-Foot Finish', ctx: 'shot_box', fx: [f('SH_PLACED', 0.2, 0.05), f('SH_PRESS', 0.15, 0.03)], sta: 1, desc: 'Take it on whichever foot it falls to.' },
    cost: 'Triggered: 1 stamina.', counter: 'Nothing specific — which is the point. Good positioning from the keeper still applies.',
    limits: 'Adds consistency rather than raw power.',
    evo: [
      { id: 'mirror', name: 'Mirror Technique', desc: 'Dribble either way with equal comfort.', fx: [f('DR_TIGHT', 0.2, 0.04), f('DR_SKILL', 0.15, 0.03)] },
      { id: 'two_gun', name: 'Twin Barrels', desc: 'Fake with one foot, shoot with the other.', fx: [f('SH_1V1', 0.3, 0.05)] },
    ],
    lines: ['On the weaker foot — if {n} even has one!', '{n} switches feet and finishes anyway!', 'Left, right, it makes no difference to {n}.'],
  },
  {
    id: 'shield', kind: 'weapon', name: 'Body Shield & Hold-Up', tags: ['aerial', 'mind'], rarity: 2,
    desc: 'Back to goal, defender on your shoulder, ball glued to your feet.',
    req: 'On the ball with a defender in contact.', reqAttr: [[A.STR, 76], [A.BAL, 66]],
    fx: [f('HOLD', 0.4, 0.08), f('AERIAL', 0.1, 0.03)],
    act: { name: 'Pin & Hold', ctx: 'hold', fx: [f('HOLD', 0.4, 0.07)], sta: 4, desc: 'Pin the centre-back and wait for runners.' },
    cost: 'Triggered: 4 stamina.', counter: 'Stronger defenders, or a second man nicking it from the blind side.',
    limits: 'Holding does not progress play by itself.',
    evo: [
      { id: 'spin', name: 'Roll the Defender', desc: 'Spin off the contact into space.', fx: [f('DR_TIGHT', 0.25, 0.05)] },
      { id: 'wall', name: 'The Wall', desc: 'Lay-offs from the hold are cleaner.', fx: [f('ONE_TWO', 0.3, 0.05)] },
    ],
    lines: ['{n} holds off the centre-back like he isn\'t there.', 'Strong from {n}! Great hold-up play.', '{n} pins the defender and waits.'],
  },
  {
    id: 'one_touch', kind: 'weapon', name: 'One-Touch Combination', tags: ['pass', 'move'], rarity: 3,
    desc: 'Give-and-go football at a speed that removes defenders from the game.',
    req: 'A teammate within combination range.', reqAttr: [[A.SPA, 70], [A.FTO, 70]],
    fx: [f('ONE_TWO', 0.4, 0.08), f('PA_SHORT', 0.1, 0.03)],
    act: { name: 'Wall Pass', ctx: 'onetwo', fx: [f('ONE_TWO', 0.4, 0.07)], sta: 3, desc: 'Bounce it and go.' },
    cost: 'Triggered: 3 stamina.', counter: 'Track the runner, not the ball.',
    limits: 'Depends on the partner: low chemistry or a poor first touch breaks the move.',
    evo: [
      { id: 'hotline', name: 'Hotline', desc: 'Combinations with high-chemistry partners get an extra bonus.', fx: [f('ONE_TWO', 0.2, 0.04), f('CHEM_GAIN', 0.2, 0.05)] },
      { id: 'third_man', name: 'Third-Man Run', desc: 'Combinations end with you arriving in the box.', fx: [f('BOX_POS', 0.2, 0.04)] },
    ],
    lines: ['One-two! {n} is through!', 'Give and go — textbook from {n}!', '{n} bounces it off his partner and bursts clear!'],
  },
  {
    id: 'ball_hunter', kind: 'weapon', name: 'Ball-Winning Hunter', tags: ['defend'], rarity: 2,
    desc: 'Aggressive, well-timed challenges that take the ball and the momentum.',
    req: 'An opponent carrying the ball near you.', reqAttr: [[A.TAC, 72], [A.STR, 66]],
    fx: [f('TACKLE', 0.35, 0.08)],
    act: { name: 'Hunt', ctx: 'tackle', fx: [f('TACKLE', 0.36, 0.07)], sta: 5, desc: 'Commit to winning it now.' },
    cost: 'Triggered: 5 stamina.', counter: 'Quick releases and one-touch play leave you lunging at air.',
    limits: 'A missed tackle removes you from the play; foul risk never reaches zero.',
    evo: [
      { id: 'clean_steal', name: 'Clean Steal', desc: 'Win it and keep it: counter-attacks start with you.', fx: [f('PA_LONG', 0.2, 0.04), f('TACKLE', 0.1, 0.02)] },
      { id: 'enforcer', name: 'Enforcer', desc: 'Physical dominance in every duel.', fx: [f('HOLD', 0.2, 0.04), f('AERIAL', 0.2, 0.04)] },
    ],
    lines: ['{n} wins it! What a tackle!', 'Crunching but clean from {n}.', '{n} hunts the ball down!'],
  },
  {
    id: 'interceptor', kind: 'weapon', name: 'Lane Reading', tags: ['defend', 'mind'], rarity: 3,
    desc: 'You defend the pass, not the player — stepping into lanes a beat early.',
    req: 'An opponent pass travelling near you.', reqAttr: [[A.INT, 72], [A.DAW, 70]],
    fx: [f('INTERCEPT', 0.1, 0.025), f('READ', 0.2, 0.05)],
    act: { name: 'Jump the Lane', ctx: 'intercept', fx: [f('INTERCEPT', 0.12, 0.025)], sta: 3, desc: 'Gamble on the pass you expect.' },
    cost: 'Triggered: 3 stamina.', counter: 'Disguised passing punishes the gamble.',
    limits: 'Stepping out leaves space behind you if you guess wrong.',
    evo: [
      { id: 'sweeper', name: 'Sweeper Sense', desc: 'Cover behind team-mates.', fx: [f('READ', 0.25, 0.05)] },
      { id: 'launch', name: 'Launch Pad', desc: 'Interceptions become instant forward passes.', fx: [f('PA_THROUGH', 0.2, 0.04), f('PA_LONG', 0.15, 0.03)] },
    ],
    lines: ['Read like a book by {n}!', '{n} steps in — he knew exactly where that was going.', 'Intercepted! {n} was a move ahead.'],
  },
  {
    id: 'feint_master', kind: 'weapon', name: 'Elastic Feints', tags: ['dribble'], rarity: 4,
    desc: 'A library of skill moves executed at full speed.',
    req: 'One-on-one with a defender.', reqAttr: [[A.SKL, 74], [A.DRI, 74]],
    fx: [f('DR_SKILL', 0.4, 0.09), f('DR_TIGHT', 0.1, 0.03)],
    act: { name: 'Signature Move', ctx: 'dribble_skill', fx: [f('DR_SKILL', 0.4, 0.07)], sta: 5, desc: 'Show them something they haven\'t seen.' },
    cost: 'Triggered: 5 stamina.', counter: 'Patience. Defenders who stay on their feet, and repeated use, blunt it.',
    limits: 'High variance: failure is a clean loss of possession.',
    evo: [
      { id: 'emperor', name: 'One-on-One Emperor', desc: 'Beating a man opens a cleaner shot.', fx: [f('SH_PRESS', 0.25, 0.05), f('SH_ANGLE', 0.15, 0.03)] },
      { id: 'street', name: 'Street Rhythm', desc: 'Unpredictable rhythm: opponents read you more slowly.', fx: [f('ADAPT', 0.15, 0.03), f('DR_SKILL', 0.12, 0.02)] },
    ],
    lines: ['{n} with the feint — the defender is on the floor!', 'Oh, that is filthy from {n}!', '{n} sends him the wrong way entirely!'],
  },
  {
    id: 'whip_cross', kind: 'weapon', name: 'Whipped Delivery', tags: ['pass'], rarity: 2,
    desc: 'Flat, fast crosses into the corridor between keeper and defenders.',
    req: 'In a wide area of the attacking third.', reqAttr: [[A.CRO, 74]],
    fx: [f('PA_CROSS', 0.4, 0.09), f('PA_LONG', 0.1, 0.03)],
    act: { name: 'Whip It In', ctx: 'cross', fx: [f('PA_CROSS', 0.4, 0.07)], sta: 3, desc: 'Early, hard and flat.' },
    cost: 'Triggered: 3 stamina.', counter: 'Block the cross at source or win first contact.',
    limits: 'Needs a runner attacking the box.',
    evo: [
      { id: 'cutback', name: 'Cut-Back King', desc: 'Low pull-backs to the penalty spot.', fx: [f('VISION', 0.2, 0.04), f('PA_SHORT', 0.15, 0.03)] },
      { id: 'dead_ball', name: 'Dead-Ball Specialist', desc: 'Set-piece delivery and free kicks.', fx: [f('SH_LONG', 0.2, 0.04), f('PA_CROSS', 0.15, 0.03)] },
    ],
    lines: ['What a ball in from {n}!', '{n} whips it across the six-yard box!', 'Wicked delivery from {n}!'],
  },
  {
    id: 'trap_genius', kind: 'weapon', name: 'Gravity Trap', tags: ['shoot', 'mind'], rarity: 5,
    desc: 'Impossible first touches. Any ball, any height, killed dead exactly where you want it.',
    req: 'A lofted or driven ball arriving at you.', reqAttr: [[A.FTO, 80], [A.BCO, 78]],
    fx: [f('SH_VOLLEY', 0.2, 0.05), f('BOX_POS', 0.1, 0.03), f('PRESS_RES', 0.15, 0.04)],
    act: { name: 'Kill Touch', ctx: 'shot_air', fx: [f('SH_VOLLEY', 0.35, 0.07), f('SH_PLACED', 0.12, 0.03)], sta: 4, desc: 'Trap it out of the air and finish in one motion.' },
    cost: 'Triggered: 4 stamina.', counter: 'Physical contact in the air; denying the lofted service.',
    limits: 'Needs an airborne delivery to show its best.',
    evo: [
      { id: 'fake_volley', name: 'Fake Volley', desc: 'Shape to shoot, trap, then finish.', fx: [f('SH_1V1', 0.25, 0.05), f('SH_PRESS', 0.2, 0.04)] },
      { id: 'pillow', name: 'Pillow Touch', desc: 'First touches escape pressure.', fx: [f('PRESS_RES', 0.2, 0.04), f('DR_TIGHT', 0.15, 0.03)] },
    ],
    lines: ['The touch from {n}… the ball just STOPS.', 'How has {n} controlled that?!', '{n} kills it dead out of the sky!'],
  },
  {
    id: 'counter_run', kind: 'weapon', name: 'Counter Sprint', tags: ['pace', 'move'], rarity: 2,
    desc: 'The first three seconds after a turnover belong to you.',
    req: 'Off the ball as your team wins possession with space ahead.', reqAttr: [[A.SPD, 76], [A.POS, 66]],
    fx: [f('RUN_BEHIND', 0.35, 0.08), f('PACE', 0.15, 0.04)],
    act: { name: 'Break', ctx: 'run', fx: [f('RUN_BEHIND', 0.38, 0.07)], sta: 6, desc: 'Go before they can reorganise.' },
    cost: 'Triggered: 6 stamina.', counter: 'Rest defence: teams that keep players behind the ball.',
    limits: 'Against a set low block there is no space to break into.',
    evo: [
      { id: 'lone_wolf', name: 'Lone Wolf', desc: 'Finish breakaways yourself.', fx: [f('SH_1V1', 0.3, 0.05)] },
      { id: 'pack_leader', name: 'Pack Leader', desc: 'Lead the break and square it.', fx: [f('PA_SHORT', 0.2, 0.04), f('VISION', 0.15, 0.03)] },
    ],
    lines: ['{n} is away on the counter!', 'Look at {n} go!', '{n} breaks at pace!'],
  },
  {
    id: 'lob_master', kind: 'weapon', name: 'Chip & Lob Artist', tags: ['pass', 'shoot'], rarity: 3,
    desc: 'You see the space above the defence. Lofted passes and chipped finishes drop exactly where you want them.',
    req: 'A lofted pass over a defensive line, or a keeper off his line.', reqAttr: [[A.LPA, 70], [A.VIS, 68]],
    fx: [f('PA_LONG', 0.3, 0.07), f('SH_1V1', 0.15, 0.04)],
    act: { name: 'Feather Lob', ctx: 'pass_any', fx: [f('PA_LONG', 0.35, 0.06)], sta: 2, desc: 'Drop it over the top with perfect weight.' },
    cost: 'Triggered: 2 stamina.', counter: 'Deep defensive lines and sweeper keepers who claim anything over the top.', limits: 'Lofted balls arrive slowly and are harder for the receiver to control.',
    evo: [{ id: 'rainmaker', name: 'Rainmaker', desc: 'Lobbed through balls are harder to defend.', fx: [f('PA_THROUGH', 0.25, 0.05)] }, { id: 'panenka', name: 'Audacity', desc: 'Chipped finishes when clean through.', fx: [f('SH_1V1', 0.3, 0.05)] }],
    lines: ['{n} lifts it over everyone — inch perfect!', 'What vision from {n}, dropping it over the top!'],
  },
  {
    id: 'dead_ball', kind: 'weapon', name: 'Dead-Ball Sniper', tags: ['shoot', 'pass'], rarity: 3,
    desc: 'Free kicks, corners and strikes from a standing ball are your territory.',
    req: 'A free kick in range, a set-piece delivery or a long-range strike.', reqAttr: [[A.LSH, 72], [A.CRO, 68]],
    fx: [f('SH_LONG', 0.25, 0.06), f('PA_CROSS', 0.25, 0.06)],
    act: { name: 'Whipped Free Kick', ctx: 'shot_long', fx: [f('SH_LONG', 0.38, 0.07)], sta: 3, desc: 'Up and over the wall.' },
    cost: 'Triggered: 3 stamina.', counter: 'Not conceding fouls around the box.', limits: 'Depends on winning set pieces.',
    evo: [{ id: 'knuckleball', name: 'Knuckleball', desc: 'More power from range.', fx: [f('SH_POWER', 0.25, 0.05)] }, { id: 'corner_king', name: 'Corner King', desc: 'Deliveries find heads.', fx: [f('PA_CROSS', 0.25, 0.05)] }],
    lines: ['{n} stands over it… and bends it beautifully!', 'That is a specialist at work — {n}!'],
  },
  {
    id: 'acro_volley', kind: 'weapon', name: 'Acrobatic Volley', tags: ['shoot'], rarity: 4,
    desc: 'Any ball in the air is a shooting chance: side volleys, hooks and overhead strikes.',
    req: 'An airborne ball arriving in or around the box.', reqAttr: [[A.VOL, 74], [A.AGI, 70]],
    fx: [f('SH_VOLLEY', 0.4, 0.09)],
    act: { name: 'Flying Volley', ctx: 'shot_air', fx: [f('SH_VOLLEY', 0.4, 0.07)], sta: 5, desc: 'Meet it in mid-air.' },
    cost: 'Triggered: 5 stamina.', counter: 'Contact in the air; keeping deliveries on the ground.', limits: 'Only on airborne balls.',
    evo: [{ id: 'bicycle', name: 'Bicycle Specialist', desc: 'High balls become overhead kicks.', fx: [f('SH_VOLLEY', 0.2, 0.04), f('AERIAL', 0.15, 0.03)] }, { id: 'half_volley', name: 'Half-Volley Hammer', desc: 'Bouncing balls from distance.', fx: [f('SH_LONG', 0.25, 0.05)] }],
    lines: ['{n} throws himself at it — what a volley!', 'Out of the air from {n}!'],
  },
  {
    id: 'cut_inside', kind: 'weapon', name: 'Cut-Inside Curler', tags: ['dribble', 'shoot'], rarity: 3,
    desc: 'Receive wide, drive inside onto your stronger foot and curl for the far corner.',
    req: 'Carrying the ball from a wide area toward the box.', reqAttr: [[A.DRI, 72], [A.FIN, 68]],
    fx: [f('SH_ANGLE', 0.25, 0.06), f('DR_OPEN', 0.2, 0.05)],
    act: { name: 'Inside Cut', ctx: 'dribble_open', fx: [f('DR_OPEN', 0.35, 0.06)], sta: 4, desc: 'Chop inside the full-back.' },
    cost: 'Triggered: 4 stamina.', counter: 'Full-backs who show you down the line.', limits: 'Predictable when it is your only move.',
    evo: [{ id: 'far_post', name: 'Far-Post Finder', desc: 'The curler itself gets sharper.', fx: [f('SH_ANGLE', 0.2, 0.04), f('SH_PLACED', 0.15, 0.03)] }, { id: 'inverted_creator', name: 'Inverted Creator', desc: 'Cut inside and slide a pass instead.', fx: [f('PA_THROUGH', 0.25, 0.05)] }],
    lines: ['{n} cuts inside… you know what is coming!', 'Onto the stronger foot goes {n}!'],
  },
  {
    id: 'shadow_mark', kind: 'weapon', name: 'Shadow Marking', tags: ['defend'], rarity: 3,
    desc: 'You become your opponent\'s shadow. He cannot lose you and cannot turn.',
    req: 'Marking a runner or a player receiving the ball.', reqAttr: [[A.MAR, 74], [A.DAW, 70]],
    fx: [f('READ', 0.4, 0.08), f('TACKLE', 0.12, 0.03)],
    act: { name: 'Lockdown', ctx: 'tackle', fx: [f('TACKLE', 0.3, 0.06)], sta: 4, desc: 'Step in the moment he receives.' },
    cost: 'Triggered: 4 stamina.', counter: 'Pure pace and one-touch combinations.', limits: 'Marks one opponent, not a zone.',
    evo: [{ id: 'eraser', name: 'Eraser', desc: 'Your man disappears from the game.', fx: [f('READ', 0.25, 0.05)] }, { id: 'front_foot', name: 'Front-Foot Defender', desc: 'Nick the ball before it arrives.', fx: [f('INTERCEPT', 0.1, 0.02)] }],
    lines: ['{n} has not given him a yard all night.', '{n} is living in his pocket.'],
  },
  {
    id: 'overlap_engine', kind: 'weapon', name: 'Overlap Engine', tags: ['pace', 'pass'], rarity: 2,
    desc: 'Relentless runs around the outside, ending in a delivery.',
    req: 'A wide position with a teammate inside you.', reqAttr: [[A.STA, 76], [A.CRO, 68]],
    fx: [f('RUN_BEHIND', 0.2, 0.05), f('PA_CROSS', 0.25, 0.06), f('STA_SAVE', 0.08, 0.02)],
    act: { name: 'Overlap & Deliver', ctx: 'cross', fx: [f('PA_CROSS', 0.35, 0.06)], sta: 4, desc: 'Arrive at speed and cross first time.' },
    cost: 'Triggered: 4 stamina.', counter: 'Wingers who track back.', limits: 'Leaves space behind you.',
    evo: [{ id: 'underlap', name: 'Underlap', desc: 'Arrive in the half-space instead.', fx: [f('BOX_POS', 0.2, 0.04)] }, { id: 'marathon', name: 'Marathon Lungs', desc: 'You can do it all match.', fx: [f('STA_SAVE', 0.12, 0.03), f('LATE_STA', 0.2, 0.04)] }],
    lines: ['{n} comes flying around the outside!', 'Another overlapping run from {n} — he never stops.'],
  },
  {
    id: 'half_turn', kind: 'weapon', name: 'Half-Turn Receiver', tags: ['mind', 'dribble'], rarity: 3,
    desc: 'You receive between the lines already facing forward, turning pressure into progress.',
    req: 'Receiving a pass with an opponent close behind.', reqAttr: [[A.FTO, 74], [A.AGI, 66]],
    fx: [f('PRESS_RES', 0.25, 0.05), f('DR_TIGHT', 0.15, 0.04), f('PA_THROUGH', 0.12, 0.03)],
    act: { name: 'Turn Out', ctx: 'dribble_tight', fx: [f('DR_TIGHT', 0.35, 0.06)], sta: 3, desc: 'Let it run across your body and go.' },
    cost: 'Triggered: 3 stamina.', counter: 'Defenders who foul early or stay touch-tight.', limits: 'Needs the pass into feet.',
    evo: [{ id: 'between_lines', name: 'Between the Lines', desc: 'Turn and release runners.', fx: [f('PA_THROUGH', 0.25, 0.05)] }, { id: 'drive_on', name: 'Drive On', desc: 'Turn and carry at the back line.', fx: [f('DR_OPEN', 0.25, 0.05)] }],
    lines: ['{n} takes it on the half-turn and he is away!', 'One touch and {n} has turned the whole midfield.'],
  },
  {
    id: 'quarterback', kind: 'weapon', name: 'Quarterback Passing', tags: ['pass', 'mind'], rarity: 3,
    desc: 'Sixty-metre diagonals and raking switches that change the point of attack in one action.',
    req: 'Time on the ball in your own half or midfield.', reqAttr: [[A.LPA, 76], [A.VIS, 72]],
    fx: [f('PA_LONG', 0.45, 0.09), f('VISION', 0.12, 0.03)],
    act: { name: 'Diagonal Switch', ctx: 'pass_any', fx: [f('PA_LONG', 0.4, 0.07)], sta: 2, desc: 'Hit the far side first time.' },
    cost: 'Triggered: 2 stamina.', counter: 'Pressing the passer; wide players who win headers.', limits: 'Needs time and space to set.',
    evo: [{ id: 'launch_code', name: 'Launch Code', desc: 'Long balls in behind are deadlier.', fx: [f('PA_THROUGH', 0.25, 0.05)] }, { id: 'tempo_setter', name: 'Tempo Setter', desc: 'Short game sharpens too.', fx: [f('PA_SHORT', 0.2, 0.04), f('PRESS_RES', 0.1, 0.02)] }],
    lines: ['{n} sprays it sixty metres onto a team-mate\'s chest!', 'What a range of passing from {n}.'],
  },
  {
    id: 'ice_finisher', kind: 'weapon', name: 'One-on-One Assassin', tags: ['shoot'], rarity: 3,
    desc: 'Clean through on goal, you never rush. Keepers go down first.',
    req: 'Through on goal or a clear sight of it inside the box.', reqAttr: [[A.COM, 74], [A.FIN, 72]],
    fx: [f('SH_1V1', 0.45, 0.09), f('SH_PRESS', 0.15, 0.04)],
    act: { name: 'Cold Finish', ctx: 'shot_box', fx: [f('SH_PLACED', 0.25, 0.05), f('SH_1V1', 0.2, 0.04)], sta: 2, desc: 'Wait for him to commit, then roll it past.' },
    cost: 'Triggered: 2 stamina.', counter: 'Recovering defenders who force a rushed shot.', limits: 'Does little for crowded-box finishing.',
    evo: [{ id: 'round_keeper', name: 'Round the Keeper', desc: 'Take it past him.', fx: [f('DR_SKILL', 0.2, 0.04), f('SH_1V1', 0.15, 0.03)] }, { id: 'near_post', name: 'Near-Post Snap', desc: 'Early finishes catch keepers unset.', fx: [f('SH_FIRST', 0.25, 0.05)] }],
    lines: ['{n} waits… waits… and slots it. Ice cold.', 'One-on-one — and {n} never looked like missing.'],
  },
  {
    id: 'press_predator', kind: 'weapon', name: 'Pressing Predator', tags: ['defend', 'pace'], rarity: 3,
    desc: 'You hunt the first bad touch. Opponents feel you before they see you.',
    req: 'An opponent receiving or carrying in midfield or their own half.', reqAttr: [[A.ACC, 74], [A.STA, 74], [A.INT, 64]],
    fx: [f('INTERCEPT', 0.07, 0.02), f('TACKLE', 0.2, 0.05), f('PACE', 0.12, 0.03)],
    act: { name: 'Pressing Trap', ctx: 'intercept', fx: [f('INTERCEPT', 0.11, 0.025)], sta: 4, desc: 'Bait the pass, then pounce.' },
    cost: 'Triggered: 4 stamina.', counter: 'Press-resistant midfielders and long balls over the press.', limits: 'Expensive over ninety minutes.',
    evo: [{ id: 'counter_press', name: 'Counter-Press', desc: 'Win it back seconds after losing it.', fx: [f('TACKLE', 0.2, 0.04), f('FLOW_GAIN', 0.1, 0.03)] }, { id: 'steal_score', name: 'Steal & Score', desc: 'Turnovers high up become shots.', fx: [f('SH_FIRST', 0.2, 0.04), f('SH_1V1', 0.15, 0.03)] }],
    lines: ['{n} smells the heavy touch and pounces!', 'Hunted down by {n}!'],
  },
  {
    id: 'chaos_dribble', kind: 'weapon', name: 'Chaos Dribble', tags: ['dribble', 'mind'], rarity: 5,
    desc: 'No pattern, no tell. Even you do not know what comes next, so defenders cannot either.',
    req: 'One-on-one against any defender.', reqAttr: [[A.SKL, 78], [A.AGI, 74], [A.BAL, 70]],
    fx: [f('DR_SKILL', 0.3, 0.07), f('ADAPT', 0.12, 0.03), f('FLOW_GAIN', 0.1, 0.03)],
    act: { name: 'Improvise', ctx: 'dribble_skill', fx: [f('DR_SKILL', 0.42, 0.07)], sta: 6, desc: 'Make it up as you go.' },
    cost: 'Triggered: 6 stamina.', counter: 'Covering defenders: the first man may be beaten but the second is waiting.', limits: 'High variance and tiring.',
    evo: [{ id: 'joy', name: 'Pure Joy', desc: 'Every beaten man feeds Flow.', fx: [f('FLOW_GAIN', 0.2, 0.04)] }, { id: 'unreadable', name: 'Unreadable', desc: 'Repeated use is much harder to read.', fx: [f('ADAPT', 0.15, 0.03), f('DR_TIGHT', 0.15, 0.03)] }],
    lines: ['Nobody knows what {n} will do next — including {n}!', 'Chaos! {n} dances through on instinct alone!'],
  },
  // ── new weapons ──
  {
    id: 'rabona_cross', kind: 'weapon', name: 'Rabona Delivery', tags: ['pass', 'cross'], rarity: 4,
    desc: 'You whip crosses in with the wrong foot wrapped behind the standing leg: the keeper reads the body, the ball goes elsewhere.',
    req: 'Crossing from a wide area or delivering a free kick into the box.', reqAttr: [[A.CRO, 76], [A.BCO, 70], [A.AGI, 62]],
    fx: [f('PA_CROSS', 0.25, 0.06), f('PA_DISG', 0.15, 0.04)],
    act: { name: 'Rabona Cross', ctx: 'cross', fx: [f('PA_CROSS', 0.4, 0.07), f('PA_DISG', 0.25, 0.05)], sta: 4, desc: 'Wrap the wrong foot round and bend it into the corridor.' },
    cost: 'Triggered: 4 stamina.', counter: 'A full-back who shows you outside before you can set your feet.', limits: 'Only for crosses and wide deliveries.',
    evo: [{ id: 'rabona_curl', name: 'Corridor of Doubt', desc: 'Crosses arrive where keeper and defender both hesitate.', fx: [f('PA_CROSS', 0.2, 0.04)] }, { id: 'rabona_flair', name: 'Showman', desc: 'Flair feeds Flow.', fx: [f('FLOW_GAIN', 0.15, 0.03)] }],
    lines: ['A RABONA cross from {n}! Wrapped round the standing leg!', '{n} with the rabona — and it lands on a sixpence!'],
  },
  {
    id: 'phantom_feint', kind: 'weapon', name: 'Phantom Feint', tags: ['dribble', 'mind'], rarity: 4,
    desc: 'A shoulder, a glance, a fake first step: the defender commits to a move you never make.',
    req: 'Tight one-on-one with a defender in front of you.', reqAttr: [[A.DRI, 76], [A.AGI, 72], [A.BAL, 66]],
    fx: [f('DR_TIGHT', 0.25, 0.06), f('ADAPT', 0.1, 0.03)],
    act: { name: 'Phantom Step', ctx: 'dribble_tight', fx: [f('DR_TIGHT', 0.42, 0.07)], sta: 5, desc: 'Sell the fake, then go the other way.' },
    cost: 'Triggered: 5 stamina.', counter: 'Patient defenders who refuse to commit.', limits: 'Loses power against the same defender over a match.',
    evo: [{ id: 'double_phantom', name: 'Double Phantom', desc: 'Two fakes in one movement.', fx: [f('DR_TIGHT', 0.2, 0.04), f('DR_SKILL', 0.1, 0.03)] }, { id: 'phantom_shot', name: 'Feint to Finish', desc: 'The fake opens the shooting lane.', fx: [f('SH_PRESS', 0.15, 0.03)] }],
    lines: ['{n} sold him a ghost! The defender is still going the wrong way!', 'Phantom Feint — {n} never even touched the ball!'],
  },
  {
    id: 'meteor_volley', kind: 'weapon', name: 'Meteor Volley', tags: ['shoot'], rarity: 4,
    desc: 'You meet falling balls with a full, clean swing. The ball leaves your foot like it was fired.',
    req: 'A cross, clearance or lofted ball dropping to you around the box.', reqAttr: [[A.VOL, 76], [A.SHP, 74], [A.BAL, 64]],
    fx: [f('SH_VOLLEY', 0.25, 0.06), f('SH_POWER', 0.12, 0.03)],
    act: { name: 'Meteor Strike', ctx: 'shot_air', fx: [f('SH_VOLLEY', 0.42, 0.07), f('SH_POWER', 0.2, 0.04)], sta: 6, desc: 'Full swing, laces, out of the sky.' },
    cost: 'Triggered: 6 stamina.', counter: 'Defenders who close you before the ball drops; balls that bounce first.', limits: 'Only for balls in the air.',
    evo: [{ id: 'meteor_range', name: 'Long-Range Meteor', desc: 'Volleys from outside the box keep their power.', fx: [f('SH_LONG', 0.15, 0.03)] }, { id: 'meteor_calm', name: 'Still Head', desc: 'Volleys stay on target under pressure.', fx: [f('SH_PRESS', 0.15, 0.03)] }],
    lines: ['METEOR VOLLEY! {n} hit that out of the sky!', '{n} catches it on the full — what a strike!'],
  },
  {
    id: 'last_line', kind: 'weapon', name: 'Last-Line Read', tags: ['defend', 'mind'], rarity: 3,
    desc: 'You read the final pass before it is played and step into the lane: the striker never receives it.',
    req: 'Defending in your own third as the opponent looks for the final ball.', reqAttr: [[A.INT, 74], [A.POS, 62], [A.DAW, 70]],
    fx: [f('INTERCEPT', 0.1, 0.03), f('READ', 0.15, 0.04)],
    act: { name: 'Lane Steal', ctx: 'intercept', fx: [f('INTERCEPT', 0.14, 0.03), f('READ', 0.2, 0.04)], sta: 4, desc: 'Step into the passing lane at the last moment.' },
    cost: 'Triggered: 4 stamina.', counter: 'Quick one-twos and dribblers who never pass.', limits: 'Does nothing against shots and dribbles.',
    evo: [{ id: 'launch', name: 'Steal and Launch', desc: 'Interceptions start counters.', fx: [f('PA_LONG', 0.15, 0.03)] }, { id: 'organiser', name: 'Organiser', desc: 'Your reading lifts the whole line.', fx: [f('READ', 0.15, 0.03)] }],
    lines: ['{n} read that pass a second before it was played!', 'Cut out by {n} — the last line holds!'],
  },
];

export const PASSIVES: AbilityDef[] = [
  { id: 'spatial', kind: 'passive', name: 'Spatial Awareness', tags: ['mind'], rarity: 3, desc: 'A constant mental map of space around you.', req: 'Always active.', fx: [f('VISION', 0.15, 0.04), f('BOX_POS', 0.1, 0.03), f('READ', 0.1, 0.03)], cost: 'None.', counter: 'Compact defences leave less space to perceive.', limits: 'Small, broad bonuses rather than one decisive edge.', lines: ['{n} always seems to have a metre nobody else has.'] },
  { id: 'ice_veins', kind: 'passive', name: 'Pressure Composure', tags: ['mind'], rarity: 2, desc: 'Your pulse does not change when defenders close in.', req: 'Active whenever you are under pressure.', fx: [f('COMPOSURE', 0.25, 0.06), f('SH_PRESS', 0.2, 0.05)], cost: 'None.', counter: 'Physical contact still wins duels.', limits: 'No effect when unmarked.', lines: ['Ice cold from {n}.'] },
  { id: 'adaptive', kind: 'passive', name: 'Adaptive Learning', tags: ['mind'], rarity: 4, desc: 'You study what beats you and absorb what you see.', req: 'Always active.', fx: [f('LEARN', 0.4, 0.15), f('ADAPT', 0.1, 0.03)], cost: 'None.', counter: 'Varied defending slows the adaptation.', limits: 'Learning still needs exposure, practice and compatible attributes.', lines: ['{n} has figured him out now.'] },
  { id: 'second_ball', kind: 'passive', name: 'Second-Ball Instinct', tags: ['move'], rarity: 2, desc: 'You move before the rebound exists.', req: 'Loose balls and rebounds near you.', fx: [f('REBOUND', 0.12, 0.03)], cost: 'None.', counter: 'Keepers who hold shots.', limits: 'Only matters when the ball breaks loose.', lines: ['{n} reacts first to the loose ball!'] },
  { id: 'weak_foot', kind: 'passive', name: 'Weak-Foot Confidence', tags: ['shoot'], rarity: 2, desc: 'You never hesitate on your weaker side.', req: 'Any action on the weaker foot.', fx: [f('SH_WEAK', 0.45, 0.1)], cost: 'None.', counter: 'None.', limits: 'Only relevant on the weaker side.', lines: ['Weaker foot? {n} didn\'t even think about it.'] },
  { id: 'rival_focus', kind: 'passive', name: 'Rivalry-Driven Focus', tags: ['mind'], rarity: 3, desc: 'A rival on the pitch sharpens everything.', req: 'A declared rival is playing in the match.', fx: [f('RIVAL', 0.18, 0.04), f('FLOW_GAIN', 0.1, 0.03)], cost: 'None.', counter: 'None.', limits: 'Does nothing in matches without a rival.', lines: ['{n} has been waiting for this match-up.'] },
  { id: 'late_engine', kind: 'passive', name: 'Late-Game Stamina Management', tags: ['pace'], rarity: 2, desc: 'You pace yourself and finish matches stronger than you start them.', req: 'Later stages of a match.', fx: [f('LATE_STA', 0.35, 0.08), f('STA_SAVE', 0.08, 0.02)], cost: 'None.', counter: 'None.', limits: 'No benefit early in games.', lines: ['{n} still has plenty in the tank.'] },
  { id: 'catalyst', kind: 'passive', name: 'Chemistry Catalyst', tags: ['mind'], rarity: 3, desc: 'You tune into team-mates quickly.', req: 'Shared matches and chemistry sessions.', fx: [f('CHEM_GAIN', 0.5, 0.15)], cost: 'None.', counter: 'None.', limits: 'Chemistry still requires time together.', lines: ['{n} and his partner are on the same wavelength.'] },
  { id: 'iron_body', kind: 'passive', name: 'Iron Body', tags: ['pace'], rarity: 2, desc: 'Durable frame, quick recovery.', req: 'Always active.', fx: [f('INJ_RES', 0.35, 0.08), f('STA_SAVE', 0.05, 0.02)], cost: 'None.', counter: 'None.', limits: 'Does not prevent fatigue.', lines: ['{n} bounces straight back up.'] },
  { id: 'big_stage', kind: 'passive', name: 'Big-Stage Temperament', tags: ['mind'], rarity: 3, desc: 'The bigger the occasion, the better you play.', req: 'High-importance matches.', fx: [f('BIGMATCH', 0.18, 0.04)], cost: 'None.', counter: 'None.', limits: 'Routine fixtures give nothing.', lines: ['{n} was made for nights like this.'] },
  { id: 'flow_seeker', kind: 'passive', name: 'Flow Seeker', tags: ['mind'], rarity: 3, desc: 'You chase the edge of your ability on purpose.', req: 'Always active.', fx: [f('FLOW_GAIN', 0.25, 0.06)], cost: 'None.', counter: 'Flow still drains, and each re-entry in a match is harder.', limits: 'Does not lengthen Flow.', lines: ['{n} is building towards something.'] },
  { id: 'tireless', kind: 'passive', name: 'Tireless Engine', tags: ['pace'], rarity: 2, desc: 'Efficient movement, endless running.', req: 'Always active.', fx: [f('STA_SAVE', 0.18, 0.04)], cost: 'None.', counter: 'None.', limits: 'Triggered ability costs are unchanged.', lines: ['{n} has not stopped running.'] },
];

export const ULTIMATES: AbilityDef[] = [
  {
    id: 'dead_angle_genesis', kind: 'ultimate', name: 'Dead Angle Genesis', tags: ['shoot'], rarity: 5, ult: 'dag',
    desc: 'You invent a finish from a position that should not contain one: scissor kicks, improvised volleys, reverse finishes and outside-foot shots from difficult angles or body shapes.',
    req: 'Flow State active. You must be in or near the box in a difficult situation: a narrow angle, an airborne ball, back to goal or heavy pressure.',
    fx: [], cost: 'Consumes 40% of remaining Flow time and 8 stamina.',
    counter: 'Physical contact that breaks your balance, keepers with elite reflexes, and simply denying you the ball in the box.',
    limits: 'Never a guaranteed goal. Success depends on technique (Volleys, Finishing, Agility, Balance), how well the ball height suits the chosen finish, defender pressure, distance and available space. Capped at a 60% chance.',
    lines: ['{n}… FROM THERE?! That angle does not exist!', 'IMPOSSIBLE! {n} creates a finish out of nothing!', '{n} twists in mid-air — DEAD ANGLE GENESIS!'],
  },
  {
    id: 'zero_frame', kind: 'ultimate', name: 'Zero-Frame Strike', tags: ['shoot'], rarity: 5, ult: 'zero',
    desc: 'A shot released with no back-lift and no warning. Blockers and keeper are still reading the previous frame.',
    req: 'Flow State active. On the ball within 24 metres of goal.', fx: [], cost: 'Consumes 40% of remaining Flow time and 7 stamina.',
    counter: 'A keeper already set on his line; forcing you onto the weaker foot.', limits: 'Cannot be blocked, but it is still a normal shot for accuracy: distance and angle apply in full.',
    lines: ['No back-lift at all — {n} just HITS it!', 'Nobody moved! {n} released that before anyone could blink!'],
  },
  {
    id: 'monster_trance', kind: 'ultimate', name: 'Monster Trance', tags: ['dribble'], rarity: 5, ult: 'trance',
    desc: 'A chained dribble through multiple defenders, each beat feeding the next.',
    req: 'Flow State active. On the ball in the attacking half with defenders ahead.', fx: [], cost: 'Consumes 40% of remaining Flow time and 10 stamina.',
    counter: 'Each successive defender is harder to beat; a covering defender who holds his ground ends the run.', limits: 'Up to three take-ons. One failure ends everything and loses the ball.',
    lines: ['{n} is dancing through ALL of them!', 'One… two… THREE! {n} is in a trance!'],
  },
  {
    id: 'puppet_master', kind: 'ultimate', name: 'Puppet-Master Pass', tags: ['pass'], rarity: 5, ult: 'puppet',
    desc: 'You move a defender with your body shape, then pass through the space he just left.',
    req: 'Flow State active. On the ball with a teammate making a forward run.', fx: [], cost: 'Consumes 40% of remaining Flow time and 5 stamina.',
    counter: 'No runner, no pass. Deep lines and sweeper keepers shrink the target space.', limits: 'The receiver must still finish. Offside remains possible.',
    lines: ['{n} moved the defender with his EYES!', 'A pass from another dimension by {n}!'],
  },
  {
    id: 'sky_tyrant', kind: 'ultimate', name: 'Sky Tyrant', tags: ['aerial'], rarity: 4, ult: 'sky',
    desc: 'A leap that begins early and hangs: you meet the ball above every defender.',
    req: 'Flow State active. A cross or lofted ball arriving in the box.', fx: [], cost: 'Consumes 40% of remaining Flow time and 8 stamina.',
    counter: 'Stop the cross. The header itself can still be saved.', limits: 'Only wins the duel; the finish is a normal header with a bonus.',
    lines: ['{n} is hanging in the air!', 'He\'s a full head above them — {n}!'],
  },
  {
    id: 'chain_reaction', kind: 'ultimate', name: 'Chain Reaction', tags: ['pass', 'move'], rarity: 4, ult: 'chain',
    desc: 'A chemical reaction made deliberate: a first-time combination with your best-connected teammate that ends with you facing goal.',
    req: 'Flow State active. A teammate with tactical chemistry of 55+ within combination range in the attacking half.', fx: [], cost: 'Consumes 40% of remaining Flow time and 6 stamina.',
    counter: 'Marking the partner out of the game.', limits: 'Scales directly with chemistry. Useless without a trusted partner on the pitch.',
    lines: ['{n} and his partner — they\'re reading each other\'s minds!', 'CHEMICAL REACTION! {n} is through!'],
  },
  {
    id: 'god_sprint', kind: 'ultimate', name: 'God Sprint', tags: ['pace'], rarity: 4, ult: 'sprint',
    desc: 'A full-pitch carry at a speed defenders cannot match.',
    req: 'Flow State active. On the ball in your own half or midfield with space ahead.', fx: [], cost: 'Consumes 40% of remaining Flow time and 14 stamina.',
    counter: 'A covering defender with comparable pace; tactical fouls.', limits: 'Huge stamina cost. Ends at the edge of the box — you still need a final action.',
    lines: ['{n} is GONE! Nobody can live with that pace!', 'From his own half! {n} just keeps going!'],
  },
  {
    id: 'iron_curtain', kind: 'ultimate', name: 'Iron Curtain', tags: ['defend'], rarity: 4, ult: 'curtain',
    desc: 'A last-ditch defensive action timed to perfection.',
    req: 'Flow State active. Defending near an opponent carrying the ball in your own third.', fx: [], cost: 'Consumes 40% of remaining Flow time and 8 stamina.',
    counter: 'Releasing the ball before the challenge arrives.', limits: 'One opponent, one moment. It does not stop the next attack.',
    lines: ['WHAT A CHALLENGE from {n}! Perfectly timed!', '{n} slams the door shut!'],
  },
  {
    id: 'field_dominion', kind: 'ultimate', name: 'Field Dominion', tags: ['mind'], rarity: 5, ult: 'dominion',
    desc: 'For a short window you see the true shape of the game: every option is revealed with its real probability and your reads improve.',
    req: 'Flow State active.', fx: [], cost: 'Consumes 40% of remaining Flow time and 4 stamina.',
    counter: 'Chaos: physical duels and loose balls are not improved.', limits: 'Lasts three minutes of playing time. Improves passing and movement decisions only.',
    lines: ['{n} is seeing everything right now.', 'Total command of the pitch from {n}.'],
  },
  {
    id: 'predator_eye', kind: 'ultimate', name: 'Predator\'s Eye', tags: ['move', 'shoot'], rarity: 4, ult: 'predator',
    desc: 'You lock onto the single most dangerous point in the box and arrive there first.',
    req: 'Flow State active. Off the ball as your team attacks the final third.', fx: [], cost: 'Consumes 40% of remaining Flow time and 6 stamina.',
    counter: 'A marker who physically blocks the run.', limits: 'You arrive unmarked, but someone still has to deliver the ball.',
    lines: ['{n} has found the one gap in the whole box!', 'The defence lost {n} for one second. That\'s all it takes.'],
  },
  {
    id: 'comet_drive', kind: 'ultimate', name: 'Comet Drive', tags: ['shoot'], rarity: 4, ult: 'comet',
    desc: 'A long-range strike hit so hard and so true that it burns a trail through the air, rising then dropping under the bar.',
    req: 'Flow State active. On the ball between 18 and 32 metres from goal.', fx: [], cost: 'Consumes 40% of remaining Flow time and 8 stamina.',
    counter: 'Closing the shooter down before he sets his body; a keeper standing high.', limits: 'Distance still matters: from 30 metres it is far from certain. Not available inside the box.',
    lines: ['From THIRTY METRES! {n} has set it on fire!', 'COMET DRIVE! The keeper never moved!'],
  },
  {
    id: 'bulldozer_charge', kind: 'ultimate', name: 'Bulldozer Charge', tags: ['dribble', 'pace'], rarity: 4, ult: 'charge',
    desc: 'You lower your shoulder and go through them, not round them: two defenders bounce off and you arrive in the box with the ball.',
    req: 'Flow State active. On the ball in the attacking half with a defender in front of you.', fx: [], cost: 'Consumes 40% of remaining Flow time and 9 stamina.',
    counter: 'Stronger defenders, and a second man arriving to double up.', limits: 'Strength against strength: a bigger defender stops it, and failure loses the ball.',
    lines: ['{n} is going THROUGH them! Two defenders on the floor!', 'Nobody can stop {n} — BULLDOZER CHARGE!'],
  },
  {
    id: 'crescent_strike', kind: 'ultimate', name: 'Crescent Strike', tags: ['shoot'], rarity: 5, ult: 'crescent',
    desc: 'A shot struck so far round the ball that it sets off metres wide of the post — the keeper lets it go — then hooks back in like a crescent moon.',
    req: 'Flow State active. On the ball between 14 and 30 metres from goal.', fx: [], cost: 'Consumes 40% of remaining Flow time and 7 stamina.',
    counter: 'Closing down his body shape before he wraps his foot round it; a keeper who refuses to trust the line.', limits: 'Still a shot: distance and pressure apply. Not available inside the six-yard box.',
    lines: ['That was going WIDE — and it has come back in! CRESCENT STRIKE!', '{n} bent it round the whole stadium!'],
  },
  {
    id: 'fk_sovereign', kind: 'ultimate', name: 'Free-Kick Sovereign', tags: ['shoot'], rarity: 4, ult: 'fk',
    desc: 'Over the wall, round the keeper, into the one corner nobody can reach: a dead ball becomes a goal.',
    req: 'Flow State active. A direct free kick within 32 metres.', fx: [], cost: 'Consumes 40% of remaining Flow time and 5 stamina.',
    counter: 'A big wall and a keeper who holds his position.', limits: 'Only from direct free kicks.',
    lines: ['Over the wall, in the top corner — FREE-KICK SOVEREIGN!', '{n} owns the dead ball. The keeper did not even dive!'],
  },
];

export const XP_LEVELS = [0, 100, 240, 420, 660]; // total xp needed for levels 1..5
export const MAX_LEVEL = 5;

const defIndex: Record<string, AbilityDef> = {};
for (const d of [...WEAPONS, ...PASSIVES, ...ULTIMATES]) defIndex[d.id] = d;

/** Convert a saved custom ability into a full definition the engine can use. */
export function customToDef(c: CustomAbility): AbilityDef {
  const fx: Fx[] = c.fx.map((e) => ({ k: e.k as ModKey, v: e.v, per: e.v * 0.2 }));
  const base = c.kind === 'ultimate' ? ULTIMATES.find((u) => u.ult === c.fx[0]?.k) : undefined;
  if (base) return { ...base, id: c.id, name: c.name, desc: c.desc || base.desc, custom: true };
  const counters = [...new Set(c.fx.map((e) => MODS[e.k as ModKey]?.counter).filter(Boolean))];
  const limits = [...new Set(c.fx.map((e) => MODS[e.k as ModKey]?.limit).filter(Boolean))];
  return {
    id: c.id, kind: c.kind, name: c.name, tags: ['custom'], rarity: 4, custom: true,
    desc: c.desc || 'A custom ability built from supported mechanical effects.',
    req: c.act ? `Triggered in context: ${CTX_NAME[c.act.ctx as ActCtx] ?? c.act.ctx}. Passive effects are always on in their own contexts.` : 'Passive: applies whenever each effect\'s context occurs.',
    fx,
    act: c.act ? { name: c.name, ctx: c.act.ctx as ActCtx, fx: [{ k: c.act.k as ModKey, v: c.act.v, per: c.act.v * 0.18 }], sta: c.act.sta, desc: 'Trigger your custom weapon.' } : undefined,
    cost: c.act ? `Triggered: ${c.act.sta} stamina.` : 'None.',
    counter: counters.slice(0, 3).join(' ') || 'Varied defending.',
    limits: limits.slice(0, 3).join(' ') || 'Context dependent.',
    lines: ['{n} shows his own weapon — ' + c.name + '!', 'That is ' + c.name + ' from {n}!'],
  };
}

let customDefs: Record<string, AbilityDef> = {};
/** Register the active career's custom abilities so lookups resolve everywhere. */
export function registerCustom(list: CustomAbility[]): void {
  customDefs = {};
  for (const c of list) customDefs[c.id] = customToDef(c);
}
export function abilityDef(id: string): AbilityDef | undefined {
  return defIndex[id] ?? customDefs[id];
}

export const CTX_NAME: Record<ActCtx, string> = {
  shot_first: 'First-time shot', shot_long: 'Long-range shot', shot_box: 'Shot inside the box', shot_angle: 'Narrow-angle shot', shot_air: 'Airborne ball in the box',
  run: 'Off-ball run', dribble_tight: 'Take-on under pressure', dribble_open: 'Take-on in space', dribble_skill: 'Skill move', pass_through: 'Through ball', pass_any: 'Any pass', cross: 'Cross',
  hold: 'Hold-up play', aerial: 'Aerial duel', tackle: 'Tackle', intercept: 'Interception', onetwo: 'One-two',
};

/** Passive (always-on, contextual) modifier table for a set of abilities. */
/** How strongly each weapon level adds to its effect (levelling a weapon visibly raises the chances it produces). */
export const LV_SCALE = 1.8;
export function buildMods(ab: AbilityRef[], scale: number): number[] {
  const m = new Array(N_MODS).fill(0);
  for (const r of ab) {
    const d = abilityDef(r.id);
    if (!d) continue;
    for (const e of d.fx) m[M[e.k]] += (e.v + e.per * (r.lv - 1) * LV_SCALE) * scale;
    if (r.evo && d.evo) {
      const ev = d.evo.find((x) => x.id === r.evo);
      if (ev) for (const e of ev.fx) m[M[e.k]] += (e.v + e.per * Math.max(0, r.lv - 3)) * scale;
    }
  }
  // fractions are capped so stacked abilities can never remove a penalty completely
  for (const k in MODS) if (MODS[k as ModKey].unit === 'frac') m[M[k as ModKey]] = Math.min(m[M[k as ModKey]], 0.85);
  return m;
}

export function actValue(r: AbilityRef, d: AbilityDef, scale: number): { k: number; v: number }[] {
  if (!d.act) return [];
  return d.act.fx.map((e) => ({ k: M[e.k], v: (e.v + e.per * (r.lv - 1) * LV_SCALE) * scale }));
}

/** A player can hold at most four weapons in a career; slots beyond the first are unlocked through progression. */
export const SLOTS = { weapon: 4, passive: 3, ultimate: 1 };

export function addXp(r: AbilityRef, amount: number): boolean {
  if (r.lv >= MAX_LEVEL) return false;
  r.xp += amount;
  let up = false;
  while (r.lv < MAX_LEVEL && r.xp >= XP_LEVELS[r.lv]) { r.lv++; up = true; }
  return up;
}
export function xpProgress(r: AbilityRef): { cur: number; need: number; pct: number } {
  if (r.lv >= MAX_LEVEL) return { cur: r.xp, need: r.xp, pct: 100 };
  const lo = XP_LEVELS[r.lv - 1], hi = XP_LEVELS[r.lv];
  return { cur: r.xp - lo, need: hi - lo, pct: Math.max(0, Math.min(100, ((r.xp - lo) / (hi - lo)) * 100)) };
}
export function levelLabel(lv: number): string {
  return ['', 'Awakened', 'Refined', 'Evolved', 'Mastered', 'Transcendent'][lv] ?? '';
}
export function usesPerMatch(lv: number): number {
  return 1 + Math.floor(lv / 3);
}

/** Does a player meet the attribute requirements for an ability? */
export function meetsReq(a: number[], d: AbilityDef): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const [i, min] of d.reqAttr ?? []) if (a[i] < min) missing.push(`${attrName(i)} ${min}+`);
  return { ok: missing.length === 0, missing };
}
import { ATTRS } from './attributes';
function attrName(i: number): string { return ATTRS[i].name; }

// ───────────────────────────── custom ability builder ─────────────────────────────

export const BUILDER_BUDGET = { weapon: 10, passive: 6, ultimate: 0 };
/** Cost of an effect of magnitude v (fraction of its max). */
export function fxCost(k: ModKey, v: number): number {
  const info = MODS[k];
  return Math.round((info.cost * (v / info.max) * 2 + Number.EPSILON) * 10) / 10;
}
export function customCost(c: { fx: { k: string; v: number }[]; act?: { k: string; v: number } }): number {
  let t = 0;
  for (const e of c.fx) t += fxCost(e.k as ModKey, e.v);
  if (c.act) t += fxCost(c.act.k as ModKey, c.act.v) * 0.8;
  return Math.round(t * 10) / 10;
}
export function validateCustom(c: CustomAbility, unrestricted: boolean): string[] {
  const errs: string[] = [];
  if (!c.name.trim()) errs.push('Give the ability a name.');
  if (c.kind === 'ultimate') {
    if (!ULTIMATES.some((u) => u.ult === c.fx[0]?.k)) errs.push('Choose a base mechanic for the ultimate.');
    return errs;
  }
  if (!c.fx.length) errs.push('Add at least one effect.');
  for (const e of c.fx) {
    const info = MODS[e.k as ModKey];
    if (!info) errs.push(`Unknown effect ${e.k}.`);
    else if (e.v <= 0 || e.v > info.max + 1e-9) errs.push(`${info.name} must be between 0 and ${info.max}.`);
  }
  if (c.act) {
    const info = MODS[c.act.k as ModKey];
    if (!info) errs.push('Unknown triggered effect.');
    else if (c.act.v <= 0 || c.act.v > info.max + 1e-9) errs.push(`Triggered ${info.name} must be between 0 and ${info.max}.`);
    if (c.act.sta < 1) errs.push('A triggered effect must cost at least 1 stamina.');
  }
  if (!unrestricted && customCost(c) > BUILDER_BUDGET[c.kind]) errs.push(`Over budget: ${customCost(c)} / ${BUILDER_BUDGET[c.kind]} points.`);
  return errs;
}
/** Which contexts make sense for a triggered effect. */
export const ACT_CTX_FOR: Partial<Record<ModKey, ActCtx>> = {
  SH_FIRST: 'shot_first', SH_LONG: 'shot_long', SH_PLACED: 'shot_box', SH_POWER: 'shot_box', SH_ANGLE: 'shot_angle', SH_VOLLEY: 'shot_air', SH_HEAD: 'aerial',
  RUN_BLIND: 'run', RUN_BEHIND: 'run', DR_TIGHT: 'dribble_tight', DR_OPEN: 'dribble_open', DR_SKILL: 'dribble_skill', PA_THROUGH: 'pass_through', PA_CROSS: 'cross',
  HOLD: 'hold', TEMPO: 'hold', AERIAL: 'aerial', TACKLE: 'tackle', INTERCEPT: 'intercept', ONE_TWO: 'onetwo', VISION: 'pass_any', PA_SHORT: 'pass_any', PA_LONG: 'pass_any',
};

// ───────────────────────────── hybrids & chemical reactions ─────────────────────────────

const HYBRID_NAMES: Record<string, string> = {
  'blindside+direct_shot': 'Ghost Strike', 'direct_shot+panoramic': 'Calculated Impact', 'feint_master+speed_burst': 'Lightning Feint',
  'disguised_pass+tempo_control': 'Conductor\'s Baton', 'aerial_dom+shield': 'Colossus', 'curve_finish+long_cannon': 'Comet Curve',
  'box_predator+trap_genius': 'Dead-Stop Finish', 'one_touch+speed_burst': 'Slingshot', 'ball_hunter+interceptor': 'Lockdown',
  'counter_run+direct_shot': 'Breakaway Hammer', 'tight_dribble+two_footed': 'Mirror Dance', 'blindside+panoramic': 'Blind-Spot Architect',
};
/** Fuse two level-3+ weapons into a hybrid custom weapon (60% of each parent's passive effects). */
export function makeHybrid(a: AbilityDef, b: AbilityDef, id: string): CustomAbility {
  const key = [a.id, b.id].sort().join('+');
  const merged: Record<string, number> = {};
  for (const d of [a, b]) for (const e of d.fx) merged[e.k] = Math.min(MODS[e.k].max, (merged[e.k] ?? 0) + (e.v + e.per * 2) * 0.6);
  const act = a.act ?? b.act;
  return {
    id, kind: 'weapon', name: HYBRID_NAMES[key] ?? `${a.name.split(' ')[0]} × ${b.name.split(' ')[0]}`,
    desc: `Hybrid of ${a.name} and ${b.name}: both ideas fused into one movement.`,
    fx: Object.entries(merged).map(([k, v]) => ({ k, v: Math.round(v * 100) / 100 })),
    act: act ? { k: act.fx[0].k, v: Math.min(MODS[act.fx[0].k].max, act.fx[0].v + 0.1), ctx: act.ctx, sta: act.sta + 1 } : undefined,
  };
}

const REACTIONS: [string, string, string][] = [
  ['move', 'pass', 'Hotline'], ['shoot', 'pass', 'Trigger Line'], ['dribble', 'move', 'Slipstream'], ['dribble', 'dribble', 'Dance Partners'],
  ['aerial', 'pass', 'Sky Bridge'], ['pace', 'pass', 'Launch Code'], ['shoot', 'shoot', 'Twin Fangs'], ['defend', 'pass', 'Turnover Engine'],
  ['mind', 'shoot', 'Blueprint'], ['mind', 'move', 'Shared Vision'], ['pace', 'move', 'Double Break'], ['dribble', 'shoot', 'Decoy & Dagger'],
];
/** Name of the chemical reaction between two tag sets (weapon archetypes). */
export function reactionName(mine: string[], theirs: string[]): string {
  for (const [x, y, name] of REACTIONS) {
    if ((mine.includes(x) && theirs.includes(y)) || (mine.includes(y) && theirs.includes(x))) return name;
  }
  return 'Resonance';
}
export function weaponTags(p: { ab: AbilityRef[] }): string[] {
  const t = new Set<string>();
  for (const r of p.ab) { const d = abilityDef(r.id); if (d && d.kind === 'weapon') d.tags.forEach((x) => t.add(x)); }
  return [...t];
}
export function mainWeapon(p: { ab: AbilityRef[] }): AbilityDef | undefined {
  for (const r of p.ab) { const d = abilityDef(r.id); if (d && d.kind === 'weapon') return d; }
  return undefined;
}
export function rarityOf(p: { ab: AbilityRef[] }): number {
  let r = 0;
  for (const x of p.ab) { const d = abilityDef(x.id); if (d && d.kind !== 'passive') r = Math.max(r, d.rarity + (x.lv - 1) * 0.25); }
  return r;
}

// ───────────────────────────── ego types & Flow ─────────────────────────────

export interface EgoType { id: string; name: string; desc: string; boost: number[]; gain: { goal: number; key: number; dribble: number; duel: number; defend: number; challenge: number } }
export const EGO_TYPES: EgoType[] = [
  { id: 'devourer', name: 'Devourer', desc: 'You exist to score. Flow builds fastest from shots and goals, and sharpens your finishing.', boost: [A.FIN, A.SHP, A.POS, A.COM, A.VOL, A.LSH], gain: { goal: 1.4, key: 0.7, dribble: 0.9, duel: 1, defend: 0.6, challenge: 1 } },
  { id: 'puppeteer', name: 'Puppeteer', desc: 'You control the match through others. Flow builds from key passes and sharpens vision and passing.', boost: [A.VIS, A.SPA, A.LPA, A.DEC, A.FTO, A.TIQ], gain: { goal: 0.8, key: 1.5, dribble: 0.8, duel: 0.9, defend: 0.8, challenge: 1 } },
  { id: 'monster', name: 'Monster', desc: 'Joy and instinct. Flow builds from take-ons and sharpens dribbling and agility.', boost: [A.DRI, A.AGI, A.BCO, A.SKL, A.BAL, A.ACC], gain: { goal: 1, key: 0.9, dribble: 1.5, duel: 1, defend: 0.6, challenge: 1 } },
  { id: 'king', name: 'King', desc: 'The pitch is yours and everyone else is a supporting act. Flow builds from won duels and solo actions; sharpens power and strength.', boost: [A.SHP, A.STR, A.FIN, A.DRI, A.COM, A.BAL], gain: { goal: 1.3, key: 0.5, dribble: 1.2, duel: 1.3, defend: 0.7, challenge: 1.1 } },
  { id: 'genius', name: 'Sleeping Genius', desc: 'Effortless talent that wakes when truly tested. Flow builds slowly — except against stronger opponents.', boost: [A.FTO, A.BCO, A.VOL, A.REA, A.FIN, A.AGI], gain: { goal: 0.9, key: 0.9, dribble: 0.9, duel: 0.9, defend: 0.7, challenge: 1.9 } },
  { id: 'hunter', name: 'Hunter', desc: 'You feed on taking the ball away. Flow builds from tackles and interceptions; sharpens defending.', boost: [A.TAC, A.INT, A.DAW, A.MAR, A.REA, A.STR], gain: { goal: 0.7, key: 0.8, dribble: 0.7, duel: 1.3, defend: 1.6, challenge: 1.1 } },
  { id: 'calculator', name: 'Calculator', desc: 'Adaptation is your ego. Balanced Flow gain and a broad, smaller boost to mental and technical attributes.', boost: [A.DEC, A.TIQ, A.POS, A.REA, A.FIN, A.SPA, A.VIS, A.COM], gain: { goal: 1.1, key: 1.1, dribble: 1, duel: 1, defend: 1, challenge: 1.2 } },
];
export function egoType(id: string): EgoType { return EGO_TYPES.find((e) => e.id === id) ?? EGO_TYPES[0]; }

export const FLOW = {
  max: 100,
  baseDuration: 330, // playing seconds
  boost: 8, // attribute points added to the ego type's boosted attributes
  reentryPenalty: 0.6, // gain multiplier after each Flow in a match
  crashStamina: 9,
  ultimateShare: 0.4,
  decayPerMin: 1.2,
};

export const PHILOSOPHIES = [
  { id: 'egoist', name: 'Egoist', desc: 'The striker who scores decides everything. You back yourself first.' },
  { id: 'collective', name: 'Collective', desc: 'Eleven as one. You value the right pass over the personal headline.' },
  { id: 'rational', name: 'Rationalist', desc: 'Football is solved with logic. Highest-probability action, every time.' },
  { id: 'entertainer', name: 'Entertainer', desc: 'If it is not beautiful, why play? You choose the creative option.' },
  { id: 'warrior', name: 'Warrior', desc: 'Outwork and outfight everyone. Effort is the first talent.' },
];
export const PERSONALITIES = [
  { id: 'calm', name: 'Calm', desc: 'Measured and hard to provoke.', pers: { ego: 55, temper: 20, loyal: 60, amb: 65, prof: 75, social: 55 } },
  { id: 'fiery', name: 'Fiery', desc: 'Emotional, confrontational, impossible to ignore.', pers: { ego: 80, temper: 85, loyal: 50, amb: 85, prof: 55, social: 60 } },
  { id: 'charismatic', name: 'Charismatic', desc: 'People gravitate to you. Friendships form quickly.', pers: { ego: 65, temper: 45, loyal: 60, amb: 70, prof: 65, social: 90 } },
  { id: 'lonewolf', name: 'Lone Wolf', desc: 'You earn respect, not friends.', pers: { ego: 85, temper: 50, loyal: 40, amb: 90, prof: 70, social: 20 } },
  { id: 'joker', name: 'Joker', desc: 'Loose in the dressing room, loose on the pitch.', pers: { ego: 60, temper: 40, loyal: 55, amb: 55, prof: 45, social: 85 } },
  { id: 'stoic', name: 'Stoic', desc: 'Relentlessly professional. Coaches trust you quickly.', pers: { ego: 50, temper: 15, loyal: 75, amb: 70, prof: 95, social: 40 } },
];
export const BACKSTORIES = [
  { id: 'unknown', name: 'Unknown High-Schooler', desc: 'Nobody had heard of you before the invitation arrived.', rep: 5 },
  { id: 'reject', name: 'Academy Reject', desc: 'Released at fifteen. You kept the letter.', rep: 10 },
  { id: 'street', name: 'Street Footballer', desc: 'Concrete pitches, older opponents, no referees.', rep: 8 },
  { id: 'prodigy', name: 'National Prodigy', desc: 'Youth internationals and magazine covers since you were twelve.', rep: 35 },
  { id: 'latebloomer', name: 'Late Bloomer', desc: 'You grew twenty centimetres in a year and everything changed.', rep: 12 },
  { id: 'returnee', name: 'Overseas Returnee', desc: 'Raised in a foreign academy, coming home to prove it counts.', rep: 25 },
];

/** Suggest weapons that suit an attribute sheet (used for NPC assignment and creator hints). */
export function suggestWeapons(a: number[], n = 3): AbilityDef[] {
  const scored = WEAPONS.map((w) => {
    let s = 0, cnt = 0;
    for (const [i, min] of w.reqAttr ?? []) { s += a[i] - min; cnt++; }
    return { w, s: cnt ? s / cnt : -99 };
  });
  return scored.sort((x, y) => y.s - x.s).slice(0, n).map((x) => x.w);
}

export function playerAbilityDefs(p: Player): { ref: AbilityRef; def: AbilityDef }[] {
  const out: { ref: AbilityRef; def: AbilityDef }[] = [];
  for (const r of p.ab) { const d = abilityDef(r.id); if (d) out.push({ ref: r, def: d }); }
  return out;
}
