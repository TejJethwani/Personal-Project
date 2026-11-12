/**
 * Commentary templates. Text is chosen with a separate cosmetic RNG stream, so wording can
 * never influence the simulation: outcomes are decided first, then described.
 */
import type { MatchState } from './model';
import { Rng } from '../rng';
import { abilityDef } from '../abilities';

const T: Record<string, string[]> = {
  pass: ['{a} finds {b}.', '{a} plays it into {b}.', '{a} to {b}.', 'Neat from {a}, on to {b}.', '{a} moves it to {b}.'],
  pass_long: ['{a} switches it long to {b}.', 'A raking ball from {a} picks out {b}.', '{a} goes direct — {b} brings it down.'],
  through: ['{a} threads it through for {b}!', 'What a ball from {a} — {b} is in behind!', '{a} slides {b} through on goal!', 'Lovely weight on that from {a}; {b} is away!'],
  cross_ok: ['{a} delivers — {b} gets there first!', 'Cross from {a}, met by {b}!', '{a} whips it in towards {b}!'],
  cutback: ['{a} pulls it back for {b}!', 'Cut-back from {a} — {b} is arriving!'],
  cross_fail: ['{a}\'s cross is headed clear by {b}.', '{b} rises to deal with the delivery from {a}.', 'Too close to the defender — {b} clears {a}\'s cross.'],
  pass_int: ['{b} reads it and intercepts {a}\'s pass.', 'Cut out by {b}!', '{a} gives it away; {b} steps in.', 'Loose from {a} — {b} picks it off.'],
  pass_out: ['{a} overhits it. Out of play.', 'That runs away from everyone. Throw-in.', '{a} gets it wrong and it rolls out.'],
  dribble_ok: ['{a} beats {b}!', '{a} skips past {b}!', '{a} leaves {b} behind!', 'Too quick for {b} — {a} is away from him.', '{a} drops the shoulder and goes by {b}.'],
  skill_ok: ['{a} with the feint — {b} is nowhere!', 'Oh, that\'s outrageous from {a}! {b} bought it completely.', '{a} makes {b} look silly!'],
  dribble_fail: ['{b} stands firm and takes it off {a}.', '{a} runs into {b}. Possession lost.', 'Good defending — {b} wins it from {a}.', '{b} times it well and dispossesses {a}.'],
  carry: ['{a} drives forward.', '{a} carries it into space.', '{a} strides on with it.'],
  hold: ['{a} holds it up.', '{a} shields it and waits for support.', '{a} puts a foot on it.'],
  hold_fail: ['{a} is muscled off it by {b}.', '{b} nicks it away from {a}.'],
  onetwo: ['One-two between {a} and {b}!', '{a} bounces it off {b} and keeps running!', 'Give-and-go — {a} is through the line!'],
  onetwo_fail: ['The one-two doesn\'t come off for {a}.', '{a} looks for the return but it\'s cut out.'],
  tackle: ['{a} wins it with a strong tackle on {b}.', 'Great challenge from {a}! {b} is dispossessed.', '{a} takes it cleanly from {b}.'],
  tackle_miss: ['{b} rides the challenge from {a}.', '{a} dives in — {b} skips away.'],
  foul: ['Foul by {a} on {b}. Free kick.', '{a} brings down {b}.', 'Late from {a}. {b} wins the free kick.'],
  yellow: ['Yellow card for {a}.', '{a} goes into the book.'],
  red: ['RED CARD! {a} is sent off!', '{a} has to go — it\'s a red!'],
  second_yellow: ['Second yellow — {a} is off!'],
  offside: ['Flag up. {a} is offside.', '{a} went a fraction early. Offside.'],
  shot_off: ['{a} shoots — wide.', '{a} drags it past the post.', 'Over the bar from {a}.', '{a} can\'t keep it down.', 'Off target from {a}.'],
  shot_post: ['OFF THE POST! {a} so close!', '{a} hits the woodwork!', 'The crossbar denies {a}!'],
  shot_block: ['{a}\'s shot is blocked by {b}.', '{b} throws himself in front of it!', 'Blocked! {b} gets a body in the way of {a}\'s effort.'],
  shot_save: ['Saved! {b} denies {a}.', '{a} forces a save from {b}.', 'Good hands from {b} to keep out {a}.', '{b} gets down well to stop {a}\'s shot.'],
  shot_save_big: ['WHAT A SAVE from {b}! {a} can\'t believe it!', '{b} with a stunning stop to deny {a}!', 'Point-blank — and {b} somehow keeps {a} out!'],
  goal: ['GOAL! {a} scores!', 'GOAL! {a} finds the net!', '{a} — GOAL!', 'It\'s in! {a} with the finish!', 'GOAL! No mistake from {a}!'],
  goal_long: ['GOAL! {a} from distance — what a strike!', 'A ROCKET from {a}! The keeper had no chance!', 'GOAL! {a} lets fly and it screams in!'],
  goal_head: ['GOAL! {a} powers in the header!', 'GOAL! {a} rises highest and nods it home!'],
  goal_volley: ['GOAL! {a} on the volley — unstoppable!', 'What technique! {a} volleys it in!'],
  goal_tap: ['GOAL! {a} can\'t miss from there.', 'GOAL! {a} with the simplest of finishes.'],
  goal_1v1: ['GOAL! {a} stays ice cold one-on-one!', 'GOAL! {a} rounds off the move with a calm finish past the keeper!'],
  goal_pen: ['GOAL! {a} converts the penalty.', '{a} sends the keeper the wrong way. GOAL!'],
  goal_fk: ['GOAL! {a} curls the free kick into the corner!', 'What a free kick from {a}!'],
  goal_late: ['GOAL! {a} — at the death!', 'LATE DRAMA! {a} scores!'],
  goal_win: ['{a} SCORES THE GOAL THAT ENDS IT!', 'THAT\'S THE THIRD! {a} wins it!', '{a}! The decisive goal — it\'s over!'],
  assist: ['Assist: {b}.', 'Made by {b}.', '{b} with the assist.'],
  pen_won: ['PENALTY! {a} is fouled in the box by {b}!', 'The referee points to the spot! {b} brought down {a}.'],
  pen_miss: ['{a} misses the penalty!', 'Saved! {b} guesses right and keeps out {a}\'s penalty!'],
  corner: ['Corner to {t}.', '{t} win a corner.'],
  corner_clear: ['The corner is cleared by {b}.', '{b} heads the corner away.'],
  rebound: ['The rebound falls to {a}!', '{a} is first to the loose ball!'],
  clear: ['{a} clears.', '{a} hacks it away.'],
  loose: ['{a} picks up the loose ball.', '{a} reacts first.'],
  sub: ['Substitution for {t}: {a} on, {b} off.'],
  star_on: ['STAR CHANGE! {a} enters for {t} — three minutes on the clock.', 'Here he comes. {a} is on for {t}. Three minutes to change everything.'],
  star_off: ['Time\'s up. {a} leaves the pitch — the Star Change window is over.'],
  inj: ['{a} is down and cannot continue.', '{a} pulls up — that looks like an injury.'],
  flow: ['{a} HAS ENTERED FLOW.', 'Something has changed in {a}\'s eyes. FLOW.', '{a} is in the zone — FLOW STATE.'],
  flow_end: ['{a}\'s Flow fades.', '{a} comes down from the peak.'],
  run_found: ['{b} spots the run of {a}.'],
  run_ignored: ['{a} was free — {b} didn\'t see it.', '{b} ignores the run of {a}.', '{a} throws his arms up; the pass never came from {b}.'],
  gk_hold: ['{a} gathers.', '{a} claims it.'],
  kickoff: ['{t} restart.'],
  reaction: ['CHEMICAL REACTION — {a} and {b} combine!', '{a} and {b} are on the same wavelength!'],
  intercept_user: ['{a} jumps the passing lane!'],
  press: ['{a} closes {b} down.'],
  contain: ['{a} jockeys {b}.'],
};

export function say(ms: MatchState, key: string, a = '', b = '', t = ''): string {
  if (ms.verb === 0) return '';
  const list = T[key];
  if (!list) return key;
  const r = new Rng(ms.crng);
  return list[r.int(list.length)].replace('{a}', a).replace('{b}', b).replace('{t}', t).replace('{a}', a);
}
export function abilityLine(ms: MatchState, id: string, name: string): string {
  if (ms.verb === 0) return '';
  const d = abilityDef(id);
  if (!d || !d.lines.length) return '';
  const r = new Rng(ms.crng);
  return d.lines[r.int(d.lines.length)].replace(/\{n\}/g, name);
}
