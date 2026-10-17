/**
 * The commentary phrase library. Every line describes something the race
 * record shows; placeholders are filled from it ({a}, {b}, {c} drivers,
 * {p} position, {n} count, {g} gap, {t} time, {team}). Lines never use
 * pronouns for drivers. Big moments are written in capitals.
 */
export const LIBRARY = {
  // ---- The start ----
  start: [
    'LIGHTS OUT AND AWAY WE GO at {track}!',
    'LIGHTS OUT! {n} cars charge towards the first corner at {track}!',
    'And they are away! {n} cars, {laps} laps, one winner at {track}.',
    'LIGHTS OUT! The race at {track} is under way!',
  ],
  startWet: ['LIGHTS OUT on a soaking track at {track}! Spray everywhere!', 'Away they go in the wet at {track}: visibility is terrible!'],
  rocket: [
    'LIGHTS OUT! {A} GETS AN INCREDIBLE START: UP {n} PLACES!',
    'WHAT A LAUNCH FROM {A}! {n} places gained before the first braking zone!',
    'Sensational getaway by {a}, up {n} places on the opening lap!',
    '{a} has made up {n} places already. A rocket start!',
    '{a} threads the needle on lap one and gains {n} places!',
  ],
  bogged: ['{a} bogs down at the start and drops {n} places.', 'A poor launch from {a}: {n} places lost on the opening lap.', 'Trouble for {a} off the line, down {n} places.'],
  holeshot: ['{A} SNATCHES THE LEAD FROM {B} OFF THE LINE!', '{a} beats pole-sitter {b} into the first corner and leads!', 'The pole-sitter {b} is beaten away: {a} leads lap one!'],
  poleHold: ['{a} converts pole into the lead at the end of lap one.', 'A clean getaway from pole for {a}, who leads after lap one.', '{a} holds the lead from pole through the opening lap.'],
  sideBySide: ['{A} GOES SIDE BY SIDE WITH {B} THROUGH THE OPENING CORNERS!', '{a} and {b} wheel to wheel on the first lap, a tenth apart!', 'Nothing between {a} and {b} on lap one: side by side for P{p}!'],

  // ---- Passing ----
  lead: [
    'NEW LEADER! {A} PASSES {B}!',
    '{A} TAKES THE LEAD FROM {B}!',
    '{a} goes to the front, and {b} has no answer!',
    'Change at the top: {a} passes {b} to lead the race!',
    '{a} sweeps past {b}. We have a new race leader!',
    'There it is! {a} is through on {b} for the lead!',
  ],
  leadLate: ['{A} TAKES THE LEAD WITH {n} LAPS TO GO!', 'Late drama at the front: {a} passes {b} for the lead, {n} laps from home!', '{a} picks the perfect moment: past {b} into the lead with {n} laps left!'],
  lastLapWin: ['{A} HAS DONE IT! A LAST-LAP MOVE ON {B} FOR VICTORY!', 'UNBELIEVABLE! {A} PASSES {B} ON THE FINAL LAP TO LEAD!', '{A} STEALS IT ON THE LAST LAP! {B} IS DEVASTATED!'],
  podiumPass: ['{a} passes {b} for a podium place: P{p}!', 'Into the podium positions goes {a}, past {b} for P{p}.', '{a} gets by {b}. P{p} and a place on the podium for now.', 'Podium fight! {a} beats {b} to P{p}.'],
  pass: [
    '{a} passes {b} for P{p}.',
    '{a} makes the move on {b}: up to P{p}.',
    '{b} cannot hold off {a}, who takes P{p}.',
    'A clean pass: {a} gets by {b} for P{p}.',
    '{a} dives down the inside of {b}. P{p}.',
    '{a} wins the drag race with {b} for P{p}.',
    '{a} goes around the outside of {b}! P{p}.',
    'Late on the brakes, {a} gets past {b} for P{p}.',
    '{a} finds a way past {b} and moves up to P{p}.',
  ],
  passWet: ['{a} is brave in the spray and passes {b} for P{p}!', 'Master of the wet: {a} goes by {b} for P{p}.', '{a} takes a different line in the wet and passes {b}. P{p}.'],
  passLate: ['{a} passes {b} for P{p} with {n} laps to go!', 'Every place counts now: {a} gets by {b} for P{p}.', '{a} makes it stick on {b}, P{p} with the flag in sight.'],
  lastLapPass: ['LAST-LAP DRAMA! {A} SNATCHES P{p} FROM {B}!', '{a} saves the best for last: past {b} for P{p} on the final lap!', 'On the very last lap, {a} grabs P{p} from {b}!'],
  intoPoints: ['{a} moves into the points: P{p}!', 'P{p} for {a}, and that is a points-scoring position.', '{a} climbs into the points, past {b}.'],
  outOfPoints: ['{b} drops out of the points as {a} goes by.', '{a} pushes {b} out of the points.'],
  myGain: ['Great move by {a}! Up to P{p} for {team}.', '{team} gain a place: {a} passes {b} for P{p}.', '{a} gets the job done on {b}. P{p} for {team}.'],
  myLoss: ['{b} loses P{p} to {a}. A setback for {team}.', '{a} passes {b}, who drops a place for {team}.', '{team} lose a position: {a} gets by {b}.'],
  swap: ['{a} and {b} swap places again: {a} back to P{p}!', 'Back and forth: {a} retakes P{p} from {b}.', 'Neither will give an inch. {a} is back ahead of {b}.', 'And again! {a} repasses {b} for P{p}.'],
  defend: [
    '{a} holds off {b} for P{p}!',
    '{b} looks down the inside of {a} but has to back out.',
    'Superb defence from {a}: {b} stays behind.',
    '{b} attacks, {a} covers the line. P{p} stays with {a}.',
    '{a} closes the door on {b}!',
    '{b} tries the outside of {a}, but it is not enough.',
  ],
  defendLead: ['{A} HOLDS ON TO THE LEAD UNDER HUGE PRESSURE FROM {B}!', '{b} throws everything at {a}, but the leader holds firm!', 'The leader {a} survives another attack from {b}!'],

  // ---- Battles ----
  battle: [
    '{b} has been all over the back of {a} for {n} laps, fighting for P{p}.',
    'Still nothing between them: {a} and {b} have been nose to tail for {n} laps.',
    '{a} is defending hard against {b}. {n} laps of pressure for P{p}.',
    'This fight for P{p} has gone on for {n} laps. {b} keeps looking for a way past {a}.',
    '{n} laps and counting: {b} cannot find a way by {a} for P{p}.',
  ],
  threeWay: ['THREE-WAY BATTLE FOR P{p}! {A}, {B} AND {C} ARE COVERED BY {g} SECONDS!', 'A three-car train for P{p}: {a}, {b} and {c}, all within {g} seconds!', '{a} leads a three-way scrap for P{p} with {b} and {c} right behind.'],
  escape: ['{a} is pulling away: {g} seconds clear of {b}.', '{a} breaks the tow. The gap to {b} is now {g} seconds.', 'Lap after lap, {a} stretches the lead over {b}: {g} seconds.', '{a} is in a race of one: {g} seconds ahead of {b}.'],
  closing: ['{b} is reeling in {a}: the gap is down to {g} seconds!', '{b} has taken big chunks out of the lead. Only {g} seconds to {a} now!', 'The leader {a} is under threat: {b} is {g} seconds behind and closing.'],

  // ---- Timing ----
  fastest: ['Fastest lap of the race for {a}: {t}.', 'Purple sectors for {a}: a new fastest lap, {t}.', '{a} goes quickest of all with a {t}.', '{A} SETS A NEW FASTEST LAP: {t}!'],

  // ---- Pit lane ----
  pit: ['{a} pits from P{p}: {from} to {to} in {t} seconds.', 'In comes {a}: {t} seconds, {to} tyres fitted.', '{a} takes on {to} tyres. {t} seconds stationary.', 'Pit stop for {a} from P{p}: a {t}-second stop for {to}.'],
  pitSlow: ['A SLOW STOP FOR {A}! {t} SECONDS STATIONARY!', 'Problems in the pit box for {a}: {t} seconds, time lost.', 'Agony for {a}: a {t}-second stop!'],
  pitUnderSc: ['{a} takes the cheap stop under the safety car.', 'Smart call: {a} pits while the field is neutralised.', '{a} dives into the pits under caution for {to} tyres.'],
  pitPlayer: ['Box, box! {a} pits for {to} tyres: {t} seconds.', '{team} bring {a} in for {to} tyres. {t} seconds.'],

  // ---- Incidents ----
  crash: ['CRASH! {A} IS IN THE BARRIERS!', 'BIG ACCIDENT! {A} IS OUT OF THE RACE!', 'Disaster for {a}: into the wall and out!'],
  crashWet: ['{A} AQUAPLANES INTO THE BARRIER!', 'The conditions catch out {a}: a heavy crash in the wet!'],
  spin: ['{a} spins! Lots of time lost.', 'Round goes {a}! A spin costs places.', 'A half-spin for {a}, back on track but well down.'],
  lockup: ['{a} locks up into the braking zone and runs wide!', 'Smoke from the front tyres of {a}: a big lock-up!', '{a} brakes too late and runs wide.', 'Flat-spot alert: {a} locks up and loses time.'],
  wide: ['{a} runs wide and loses time.', 'Off the racing line goes {a}, a few tenths gone.', 'A moment for {a}: wide at the exit, time lost.'],
  collision: ['CONTACT! {A} AND {B} TOUCH!', 'They have touched! {a} and {b} make contact!', 'Wheel to wheel and into each other: {a} and {b}!'],
  puncture: ['PUNCTURE FOR {A}!', '{a} has a puncture: a long, slow lap back to the pits.', 'The tyre has gone on the car of {a}!'],
  failure: ['{A} IS OUT WITH A MECHANICAL FAILURE!', 'Smoke from the car of {a}: retirement!', 'Heartbreak for {a}: the car has failed.'],
  warning: ['Worrying signs for {a}: the team reports a {t} problem.', '{a} is nursing a {t} issue.'],

  // ---- Race control ----
  safetyCar: ['SAFETY CAR DEPLOYED: MASSIVE STRATEGIC OPPORTUNITY!', 'SAFETY CAR! The field will bunch up and the pit wall must decide!', 'SAFETY CAR! Every gap is gone. Who will gamble on a stop?'],
  vsc: ['VIRTUAL SAFETY CAR! Everyone slows down: a cheaper pit stop is on offer.', 'VSC deployed. The pit wall is doing its sums.'],
  restart: ['GREEN FLAG! {A} leads the restart!', 'Racing resumes, {a} leads them away!', 'The safety car is in. {a} controls the restart.'],

  // ---- Weather ----
  rainSoon: ['RAIN IS APPROACHING THE CIRCUIT! THE RADAR SHOWS SHOWERS WITHIN {n} LAPS!', 'Dark clouds are gathering: rain is due in about {n} laps.', 'The radar shows rain on the way: {n} laps out.'],
  rainStart: ['RAIN IS FALLING! The track is getting slippery!', 'Here comes the rain! Time to think about intermediates.', 'Spots of rain on the visors, and it is getting heavier!'],
  rainStop: ['The rain has stopped. A dry line will start to appear.', 'The rain is easing off: slicks will soon be the tyre.'],

  // ---- The run to the flag ----
  tenToGo: ['Ten laps to go. {a} leads.', 'Ten laps remaining, {a} out in front.', 'Into the final ten laps: {a} leads from {b}.'],
  fiveToGo: ['Five laps remaining, and {b} is the closest challenger.', 'Five to go: can {b} catch {a}?', 'Five laps left. {a} leads {b} by {g} seconds.'],
  finalThreeClose: ['FINAL THREE LAPS! THE LEADERS ARE SEPARATED BY {g} SECONDS!', 'THREE LAPS TO GO AND {A} LEADS {B} BY JUST {g} SECONDS!'],
  finalLap: ['FINAL LAP! {A} leads from {B}!', 'The last lap begins: {a} in front of {b}!', 'One lap to go! {a} leads the way.'],

  // ---- The finish ----
  win: ['CHEQUERED FLAG! {A} WINS AT {track}!', '{A} TAKES THE CHEQUERED FLAG! Victory at {track}!', 'And {a} wins at {track}!'],
  winDominant: ['{A} WINS IN DOMINANT FASHION, {g} SECONDS CLEAR!', 'A crushing win for {a}: {g} seconds ahead at the flag!'],
  winClose: ['{A} WINS BY JUST {g} SECONDS! WHAT A FINISH!', 'A PHOTO FINISH! {A} HOLDS ON BY {g} SECONDS!'],
  winFromBack: ['{A} WINS FROM P{p} ON THE GRID! WHAT A DRIVE!', 'From P{p} to victory: an incredible race from {a}!'],
  winMine: ['VICTORY FOR {TEAM}! {A} WINS AT {track}!', 'GET IN THERE! {A} WINS FOR {TEAM}!'],

  // ---- Championship ----
  titleLead: ['{A} IS NOW THE PROVISIONAL CHAMPIONSHIP LEADER!', 'As they run, {a} would lead the championship!', 'The championship lead is changing hands on the road: {a} on top for now!'],
} as const;

export type LibraryKey = keyof typeof LIBRARY;
