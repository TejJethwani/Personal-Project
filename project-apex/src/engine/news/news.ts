import { nextId } from '../drivers/generate';
import { Rng } from '../rng';
import type { DivisionId, GameState, NewsCategory, NewsItem } from '../types';

const MAX_NEWS = 500;

export interface NewsInput {
  category: NewsCategory;
  headline: string;
  body: string;
  division?: DivisionId | null;
  teamIds?: string[];
  driverIds?: string[];
  importance?: 1 | 2 | 3;
}

export function addNews(state: GameState, input: NewsInput): NewsItem {
  const item: NewsItem = {
    id: nextId(state, 'n'),
    season: state.season,
    week: state.week,
    category: input.category,
    headline: input.headline,
    body: input.body,
    division: input.division ?? null,
    teamIds: input.teamIds ?? [],
    driverIds: input.driverIds ?? [],
    importance: input.importance ?? 1,
    read: false,
  };
  state.news.unshift(item);
  if (state.news.length > MAX_NEWS) state.news.length = MAX_NEWS;
  return item;
}

/** Fill `{key}` placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Pick a template deterministically for a context so reloading gives the same story. */
export function pickTemplate(state: GameState, label: string, templates: string[]): string {
  const rng = Rng.from(state.seed, 'news', label, state.season, state.week, state.news.length);
  return rng.pick(templates);
}

export const TEMPLATES = {
  winHeadline: [
    '{driver} TRIUMPHS AT {circuit}',
    'VICTORY FOR {driver} IN {circuitShort}',
    '{team} CELEBRATE AS {driver} WINS {division} ROUND {round}',
    '{driver} CONTROLS {circuitShort} TO TAKE THE WIN',
  ],
  winBody: [
    '{driver} took the chequered flag for {team} at {circuit}, finishing {gap} ahead of {second}. {third} completed the podium.',
    'A composed drive from {driver} delivered victory for {team}. {second} had to settle for second, {third} third.',
    '{driver} ({team}) won round {round} of the {division} season. {second} and {third} joined them on the podium.',
  ],
  maidenWin: [
    'MAIDEN VICTORY! {driver} WINS FOR THE FIRST TIME',
    'FIRST WIN AT LAST FOR {driver}',
  ],
  shockPodium: [
    '{team} SHOCKS THE GRID: {driver} STORMS TO THE PODIUM',
    'GIANT-KILLING! UNDERDOGS {team} ON THE {division} PODIUM',
  ],
  playerWin: [
    '{team} DELIVERS! {driver} WINS AT {circuitShort}',
    'ROAD TO GLORY: {team} TAKE VICTORY IN {division}',
    '{teamUpper} SHOCKS THE GRID: {driver} DELIVERS {division} VICTORY!',
  ],
  champion: [
    '{driver} IS THE {division} CHAMPION!',
    'TITLE SEALED: {driver} CROWNED {division} CHAMPION',
  ],
  constructorChampion: [
    '{team} WIN THE {division} TEAMS\' CHAMPIONSHIP',
  ],
  promotion: [
    'ROAD TO GLORY: {team} PROMOTED TO {to}',
    'UP AND AWAY! {team} EARN {to} PROMOTION',
  ],
  playerPromotionF1: [
    'ROAD TO GLORY: FORMER F5 MINNOWS {team} SECURE FORMULA 1 PROMOTION',
  ],
  relegation: [
    'HEARTBREAK FOR {team}: RELEGATED TO {to}',
    '{team} DROP TO {to} AFTER DIFFICULT SEASON',
  ],
  signing: [
    'CONFIRMED: {driver} JOINS {team}',
    '{team} SIGN {driver} ON A {years}-YEAR DEAL',
    'TRANSFER: {driver} MOVES TO {team}',
  ],
  bigSigning: [
    'TRANSFER BOMBSHELL: {driver} SIGNS FOR {team}',
    'SENSATION! {team} LAND STAR DRIVER {driver}',
  ],
  release: [
    '{team} PART WAYS WITH {driver}',
    '{driver} RELEASED BY {team}',
  ],
  refuseExtension: [
    'TRANSFER BOMBSHELL: {driver} REFUSES {team} CONTRACT EXTENSION',
  ],
  rumor: [
    'RUMOUR: {team} CIRCLING {driver}',
    'PADDOCK WHISPERS: {driver} LINKED WITH {team}',
    'IS {driver} ON THE WAY TO {team}?',
  ],
  rumorBody: [
    'With {driver}\'s contract running out at the end of the season, sources suggest {team} have opened talks.',
    'Several teams are monitoring {driver}, rated among the best in {division}. {team} are said to be the frontrunners.',
  ],
  breakthrough: [
    'ENGINEERING BREAKTHROUGH: {team} UNLOCK MAJOR {component} GAINS',
  ],
  rndFailure: [
    'ENGINEERING CRISIS: {team} {component} UPGRADE FAILS RELIABILITY TESTING',
    'SETBACK FOR {team} AS {component} PROJECT DISAPPOINTS',
  ],
  financialCrisis: [
    'FINANCIAL CRISIS AT {team}: BANK BALANCE IN THE RED',
    'ALARM BELLS AT {team} AS DEBTS MOUNT',
  ],
  rescue: [
    'RESCUE DEAL: NEW INVESTORS SAVE {team}',
  ],
  sponsor: [
    '{team} ANNOUNCE {sponsor} PARTNERSHIP',
    'NEW BACKER: {sponsor} JOINS {team}',
  ],
  injury: [
    'INJURY BLOW: {driver} SIDELINED FOR {weeks} WEEKS',
  ],
  ban: [
    'RACE BAN: {driver} HITS PENALTY-POINT LIMIT',
  ],
  retirement: [
    '{driver} ANNOUNCES RETIREMENT',
    'END OF AN ERA: {driver} HANGS UP THE HELMET',
  ],
  preview: [
    'PREVIEW: {division} HEADS TO {circuit}',
    'RACE PREVIEW: CAN ANYONE STOP {leader} AT {circuitShort}?',
  ],
  previewBody: [
    '{leader} leads the {division} championship by {margin} points heading to {circuit}. {character}',
    'Round {round} of the {division} season takes place at {circuit}. {character} Championship leader: {leader} ({points} pts).',
  ],
  interviewHappy: [
    '"{quote}" says {driver}',
  ],
  quotesHappy: [
    'The team is giving me everything I need. I truly believe we can fight for big results',
    'I have never felt this confident in a car. The atmosphere in the garage is fantastic',
    'We are building something special here. Watch this space',
  ],
  quotesUnhappy: [
    'Honestly, I expected more. Something has to change',
    'I am fully focused on my future. We will see what happens',
    'I have given this team everything. It is not being repaid',
  ],
  quotesNeutral: [
    'We take it race by race. There is work to do but the potential is there',
    'The car is improving. If we keep developing we will get there',
  ],
  regulation: [
    'REGULATIONS: {division} ANNOUNCES {magnitude} RULE CHANGES FOR NEXT SEASON',
  ],
  milestone: [
    'MILESTONE: {driver} CLAIMS CAREER WIN NUMBER {n}',
  ],
  prediction: [
    'CHAMPIONSHIP WATCH: {leader} THE MAN TO BEAT IN {division}',
  ],
  board: [
    'BOARD UPDATE: {team} DIRECTORS {mood}',
  ],
};
