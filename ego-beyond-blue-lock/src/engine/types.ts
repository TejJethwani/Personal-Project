/**
 * Core entity types. Everything here is plain JSON-serialisable data: the whole `Game`
 * object is what gets written to IndexedDB and exported as a save file.
 * All entities use permanent string IDs that survive transfers and season rollovers.
 */
import type { RngState } from './rng';

export const SCHEMA_VERSION = 3;
export const BASELINE_SEASON = 2025; // "2025/26" baseline (approximate, fictional results)

export type Pos = 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LM' | 'RM' | 'LW' | 'RW' | 'SS' | 'ST';
export type Foot = 'L' | 'R' | 'B';
export type Origin = 'user' | 'bluelock' | 'nelyouth' | 'master' | 'world' | 'real' | 'fict' | 'regen' | 'pool';
export type SquadRole = 'star' | 'key' | 'rotation' | 'prospect' | 'development';
export type Canon = 'canon' | 'likely' | 'uncertain' | 'original';

export interface Personality {
  ego: number; // self-belief / selfishness
  temper: number; // 0 calm .. 100 fiery
  loyal: number;
  amb: number; // ambition
  prof: number; // professionalism
  social: number;
}

export interface AbilityRef {
  id: string;
  lv: number; // 1..5
  xp: number; // progress toward next level
  evo?: string; // chosen evolution branch id
}

export interface Contract {
  club: string;
  wage: number; // EUR per week
  from: number; // season signed
  until: number; // last season covered (contract ends after this season)
  role: SquadRole;
  clause?: number; // release clause EUR
  goalBonus?: number; // EUR per goal
  appBonus?: number; // EUR per appearance
  signOn?: number; // EUR
  loanFrom?: string; // parent club when on loan
}

export interface HistRow {
  s: number; // season
  club: string;
  clubName: string;
  comp: string;
  compName: string;
  ap: number; st: number; min: number;
  g: number; a: number;
  rt: number; // average rating * 100
  mom: number; cs: number; yc: number; rc: number;
  ovr: number; // OVR at the end of the spell
}

export interface Player {
  id: string;
  name: string;
  sn: string; // short display name
  nick?: string;
  nat: string;
  nat2?: string[];
  born: number; // birth year; age = season - born
  pos: Pos;
  pos2: Pos[];
  foot: Foot;
  h: number; // cm
  w: number; // kg
  num: number;
  a: number[]; // 36 attributes, see attributes.ts
  pot: number;
  club: string | null;
  con: Contract | null;
  rep: number; // 0..100 reputation
  pers: Personality;
  style: string;
  ab: AbilityRef[];
  origin: Origin;
  canon?: Canon;
  note?: string;
  notable?: boolean;
  retired?: number;
  // condition (temporary, never part of OVR)
  fit: number; sharp: number; form: number; morale: number;
  inj: number; injName?: string;
  susp: number; yel: number;
  dev: number; // development accumulator (fractions of OVR)
  ss: Record<string, number[]>; // current-season stat line per competition id
  hist: HistRow[];
  awards: string[];
  caps: number; ig: number;
  hair?: string; // optional authored hair colour for avatars
  nelTeam?: string;
  joined?: number; // season joined current club
  lastMove?: number; // absDay of last transfer
  u20?: boolean;
}

export interface Tactics {
  form: string;
  press: number; line: number; tempo: number; width: number; direct: number;
}

export interface Manager {
  id: string;
  name: string;
  nat: string;
  style: string;
  rep: number;
  since: number;
}

export interface ClubSeason { s: number; comp: string; compName: string; pos: number; pts: number; w: number; d: number; l: number; gf: number; ga: number; note?: string }
export interface Trophy { s: number; comp: string; name: string }
export interface RecordEntry { v: number; pid: string; name: string; s: number; club?: string; clubName?: string }

export interface Club {
  id: string;
  name: string;
  sn: string;
  abbr: string;
  nat: string;
  league: string | null;
  tier: number;
  rep: number;
  col: [string, string];
  budget: number; // EUR transfer budget
  tac: Tactics;
  style: string;
  mgr: Manager;
  fac: number; // training facilities 1..10
  youth: number; // 1..10
  squad: string[];
  nel?: boolean;
  parent?: string;
  master?: string;
  identity?: string;
  hist: ClubSeason[];
  trophies: Trophy[];
  rec: Record<string, RecordEntry>;
  goalsAll: Record<string, number>; // all-time (save era) goals by player id
  expect: number;
  dormant?: boolean;
}

export type CompKind = 'league' | 'cup' | 'continental' | 'nel' | 'intl' | 'playoff' | 'friendly';

export interface Stage {
  type: 'rr' | 'ko';
  name: string;
  legs: number;
  groups?: string[][]; // rr
  ties?: { id: string; a: string; b: string; winner?: string }[]; // ko
  round: number; // comp round offset
  slots: number[]; // schedule days per round/leg
  done?: boolean;
  advance?: number; // rr: how many advance per group
  neutral?: boolean;
}

export interface CompSeason {
  s: number;
  champion?: string; championName?: string;
  runnerUp?: string;
  table?: { id: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }[];
  topScorer?: { pid: string; name: string; v: number; club: string };
  topAssist?: { pid: string; name: string; v: number; club: string };
  best?: { pid: string; name: string; club: string };
  promoted?: string[]; relegated?: string[];
}

export interface Competition {
  id: string;
  name: string;
  sn: string;
  kind: CompKind;
  nat?: string;
  tier?: number;
  rules: 'nel' | 'reg';
  teams: string[];
  season: number;
  stages: Stage[];
  cur: number; // current stage index
  rounds: number;
  done?: boolean;
  champion?: string;
  hist: CompSeason[];
  rec: Record<string, RecordEntry>;
  up?: number; playoff?: number; down?: number; // league movement slots
  natTeams?: boolean; // teams are nations
  u20?: boolean;
  weekly?: boolean; // weekly awards generated
  parent?: string; // playoff -> league
  qual?: Record<string, string[]>;
}

/** [minute, teamIdx, scorerId, assistId, flag(0 open,1 pen,2 own goal,3 free kick), spectacle 0..100, xG*100] */
export type GoalRec = [number, 0 | 1, string, string, number, number, number];

export interface Fixture {
  id: string;
  comp: string;
  s: number;
  rd: number;
  stg?: string;
  grp?: number;
  leg?: number;
  tie?: string;
  day: number;
  h: string;
  a: string;
  neutral?: boolean;
  ko?: boolean; // needs a winner on the day
  played: boolean;
  sc?: [number, number];
  pens?: [number, number];
  aet?: boolean;
  goals?: GoalRec[];
  potm?: string;
  lines?: Record<string, number[]>; // per-player stat lines (kept for user matches / tests)
  mins?: number; // match length in minutes (clock)
  playSec?: number; // actual ball-in-play seconds
  cards?: number;
}

export type AwardType =
  | 'potr' | 'totr' // NEL player / team of the round
  | 'potw' | 'totw' | 'potm' | 'gotm'
  | 'pots' | 'ypots' | 'tots' | 'boot' | 'playmaker' | 'glove'
  | 'nel_mvp' | 'nel_boot' | 'nel_xi' | 'nel_playmaker' | 'nel_glove' | 'nel_goal'
  | 'world_player' | 'world_young' | 'world_gk' | 'world_xi' | 'world_goal'
  | 'tourn_best' | 'tourn_boot' | 'champion'
  | 'totm' | 'def_s' | 'mid_s' | 'fwd_s' | 'signing_s'
  | 'golden_shoe' | 'world_def' | 'world_mid' | 'world_fwd' | 'world_scorer' | 'world_playmaker'
  | 'tourn_xi' | 'tourn_young' | 'tourn_glove'
  | 'potm_king' | 'dribbler' | 'ballwinner' | 'ironman' | 'manager_s' | 'breakout' | 'veteran'
  | 'world_manager' | 'world_club' | 'world_dribbler' | 'world_ballwinner' | 'world_veteran' | 'world_breakout' | 'world_potm';

export interface AwardNom { pid: string; name: string; club: string; clubName: string; line: string; score: number }
export interface AwardXI { pid: string; name: string; pos: Pos; club: string; clubName: string; rat: number }
export interface Award {
  id: string;
  type: AwardType;
  title: string;
  comp: string;
  compName: string;
  s: number;
  period: string;
  day: number;
  winner?: AwardNom;
  noms?: AwardNom[];
  xi?: AwardXI[];
  form?: string;
  why: string;
  /** 'rank' = decided by one published number (shown as a ranking); 'vote' = judged on several things (presented with suspense) */
  mode?: 'rank' | 'vote';
  me?: boolean; // involves the user
}

export type NewsCat = 'match' | 'transfer' | 'award' | 'nel' | 'bid' | 'world' | 'club' | 'intl' | 'rivalry' | 'career' | 'injury' | 'manager' | 'record' | 'youth' | 'paper';
export interface News {
  id: number;
  s: number;
  day: number;
  date: string;
  cat: NewsCat;
  title: string;
  body: string;
  pids?: string[];
  clubs?: string[];
  imp: number; // 1..3
  me?: boolean;
}

export interface Transfer {
  id: number;
  pid: string;
  name: string;
  from: string | null; fromName: string;
  to: string | null; toName: string;
  fee: number;
  type: 'transfer' | 'loan' | 'free' | 'loanEnd' | 'release' | 'youth' | 'nel' | 'retire';
  s: number;
  day: number;
  wage?: number;
  ovr: number;
}

export interface Memory {
  t: string; // type key
  s: number; d: number;
  txt: string;
  w: number; // weight, negative = bad blood
  fid?: string;
}

export interface Rel {
  resp: number; trust: number; friend: number; rival: number; chem: number;
  met: number; // absDay first met
  last: number; // absDay last interaction
  mem: Memory[];
  flags: Record<string, number>;
  uses: Record<string, number[]>; // interaction type -> absDays used
  shared: number; // matches played together
  vs: number; // matches against
}

export interface Person {
  id: string;
  name: string;
  role: 'coach' | 'agent' | 'journalist' | 'natcoach' | 'scout';
  org?: string;
  trait: string;
}

export interface InteractionOption {
  id: string;
  label: string;
  tone: 'humble' | 'confident' | 'ego' | 'team' | 'cold' | 'warm' | 'tactical' | 'neutral';
  hint?: string;
}

export interface Interaction {
  id: number;
  tpl: string;
  s: number; day: number; abs: number;
  expires: number; // absDay
  who: string; // person or player id
  whoName: string;
  place: string;
  title: string;
  body: string;
  options: InteractionOption[];
  ctx: Record<string, string | number>;
  blocking?: boolean;
  done?: { choice: string; label: string; result: string; effects: string[] };
}

export interface Offer {
  id: number;
  club: string; clubName: string;
  league: string; leagueName: string;
  kind: 'transfer' | 'loan' | 'renewal' | 'nel' | 'free';
  role: SquadRole;
  wage: number; years: number;
  fee: number; // fee agreed with current club (0 for free / NEL)
  signOn: number; goalBonus: number; appBonus: number; clause: number;
  managerRole: string;
  position: Pos;
  competition: { name: string; pos: Pos; ovr: number; age: number }[];
  continental: string;
  dev: string; devScore: number;
  minutes: string; // expected playing time
  route?: string; // NEL route label
  deadline: number; // absDay
  status: 'open' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  interest: number; // 0..100 how keen the club is
  talks: number; // negotiation rounds used
  note?: string;
  loanParent?: string;
}

export interface DevEntry { s: number; day: number; date: string; attr: number; delta: number; to: number; why: string[] }

export interface UserMatch {
  fid: string; s: number; day: number; date: string;
  comp: string; compName: string; rules: 'nel' | 'reg';
  club: string; opp: string; oppName: string; home: boolean;
  sc: [number, number]; pens?: [number, number];
  res: 'W' | 'D' | 'L';
  line: number[] | null; // null = did not play
  rat: number; potm: boolean;
  started: boolean;
  note?: string;
  feed?: string[]; // condensed key events
}

export interface Milestone { s: number; day: number; date: string; type: string; txt: string }

export interface SessionPlan { type: string; focus?: string; partner?: string; ability?: string }

export interface Appearance {
  skin: number; face: number; hair: number; hairCol: number; eyes: number; eyeCol: number; brows: number; mouth: number; acc: number;
  beard?: number; mark?: number; hair2?: number; nose?: number; ears?: number; bg?: number;
  fringe?: number; eyeSize?: number; cheek?: number; collar?: number;
  /** custom hair colour (#rrggbb); overrides hairCol when set */
  hairHex?: string;
}

export interface CustomAbility {
  id: string;
  kind: 'weapon' | 'passive' | 'ultimate';
  name: string;
  desc: string;
  fx: { k: string; v: number }[];
  act?: { k: string; v: number; ctx: string; sta: number };
}

export interface Reaction { id: string; with: string; withName: string; name: string; lv: number; uses: number; s: number }

export interface SelectionInfo { fid: string; started: boolean; inSquad: boolean; score: number; rivals: { name: string; score: number }[]; reasons: string[] }

export interface StatHist { s: number; club: string; clubName: string; comp: string; compName: string; rules: 'nel' | 'reg'; line: number[] }

export interface Career {
  pid: string;
  look: Appearance;
  egoType: string;
  philosophy: string;
  personality: string;
  backstory: string;
  mgrTrust: number;
  discipline: number; // tactical discipline 0..100 rolling
  image: number; // -100 humble .. 100 arrogant public image
  plan: SessionPlan[]; // 7 days, Monday first
  intensity: number; // 0 light, 1 normal, 2 intense
  xp: number[];
  xpSrc: Record<string, Record<string, number>>;
  devLog: DevEntry[];
  ovrLog: { s: number; day: number; ovr: number }[];
  learning: Record<string, { exposure: number; practice: number; from?: string }>;
  reactions: Reaction[];
  custom: CustomAbility[];
  rel: Record<string, Rel>;
  people: Record<string, Person>;
  inbox: Interaction[];
  nextInteraction: number;
  social: { week: number; used: number };
  offers: Offer[];
  nextOffer: number;
  matches: UserMatch[];
  statHist: StatHist[];
  timeline: Milestone[];
  flags: Record<string, number | string>;
  lastSel?: SelectionInfo;
  instr: { stance: number; press: number; risk: number }; // personal match instructions
  combo?: { with: string; until: number };
  rivals: string[];
  wages: number; // career earnings EUR
  lastWageWeek: number;
  nelRoute?: string;
  promise?: { role: SquadRole; club: string };
  digest: string[]; // last advance digest lines
  retiredNote?: string;
}

export interface NelRules {
  goalTarget: number;
  starChange: boolean;
  starSec: number;
  subs: number;
  offside: boolean;
  topN: number;
}

export interface Settings {
  difficulty: number; // 0 rookie, 1 pro, 2 elite, 3 egoist
  injuries: number; // 0 off, 1 low, 2 normal, 3 high
  devSpeed: number; // multiplier
  realism: number; // 0 grounded, 1 balanced, 2 anime
  freq: number; // 0 low, 1 standard, 2 high
  canonChange: boolean;
  showProb: boolean;
  dynamicPot: boolean;
  autoFlow: boolean;
  matchSpeed: number;
  reduceMotion: boolean;
  /** touch controls: tap team-mates / swipe runs directly on the pitch */
  touch?: boolean;
  nel: NelRules;
  mode: 'balanced' | 'unrestricted';
}

export interface Bid { club: string; clubName: string; amt: number; rd: number; why: string[] }
export interface BidState {
  pid: string;
  top: number; // current top bid in JPY (annual salary)
  topClub: string;
  bids: Bid[]; // current live bids
  hist: { rd: number; amt: number; club: string; clubName: string; rank: number; delta: number; why: string[] }[];
  rank: number; prevRank: number;
  perf: number[]; // rating per round (0 = did not play)
  moments: number;
}

export interface NelState {
  teams: string[];
  round: number; // rounds completed
  bids: Record<string, BidState>;
  done?: boolean;
  top23?: string[];
  summary?: NelSummary;
  canonHits?: number;
}

export interface NelSummary {
  table: { id: string; name: string; p: number; w: number; l: number; gf: number; ga: number; pts: number }[];
  champion: string;
  ranking: { pid: string; name: string; team: string; amt: number; club: string; rank: number; bl: boolean }[];
  myRank: number; myBid: number; myBlRank: number;
  selected: boolean;
  eligible: boolean;
  evalLines: string[];
  grade: string;
  awards: string[];
}

/** World Cup qualifying: one or more groups per confederation, played in the international breaks of the season before a World Cup. */
export interface WcqGroup { conf: string; name: string; teams: string[]; tab: Record<string, number[]>; rounds: [string, string][][]; next: number; slots: number }
export interface WcqState { year: number; groups: WcqGroup[]; done: boolean; qualified: string[]; counted: Record<string, number>; breaks: number }
export interface NationState {
  id: string;
  pts: number; // ranking points (rolling strength)
  squad?: string[];
  u20squad?: string[];
  coach: string;
}

export interface LogEntry { abs: number; s: number; day: number; k: string; m: string }

export interface SeasonArchive {
  s: number;
  champs: { comp: string; compName: string; club: string; clubName: string }[];
  awards: string[];
  moves: string[];
}

export interface World {
  wcq?: WcqState;
  seed: number;
  rng: RngState;
  nextId: number; newsId: number; trId: number;
  phase: 'nel' | 'pro';
  season: number;
  day: number; // day within the current phase calendar
  stage: 0 | 1 | 2; // 0 morning pending, 1 awaiting user match, 2 day complete
  abs: number; // monotonic day counter since career start
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  comps: Record<string, Competition>;
  fixtures: Record<string, Fixture>;
  sched: Record<number, string[]>;
  nations: Record<string, NationState>;
  transfers: Transfer[];
  awards: Record<string, Award>;
  awardIds: string[];
  news: News[];
  log: LogEntry[];
  done: Record<string, number>; // idempotency keys
  nel: NelState;
  acc: { w: Record<string, Record<string, number[]>>; m: Record<string, Record<string, number[]>>; goals: Record<string, { fid: string; pid: string; name: string; club: string; min: number; spec: number; desc: string }[]> };
  rec: Record<string, RecordEntry>;
  archive: SeasonArchive[];
  free: string[];
  pool: Record<string, string[]>; // dormant lower-division club ids per country
  baseline: string;
  keepLines?: boolean; // tests: keep every fixture's stat lines
  events: { key: string; day: number; data?: string }[]; // scheduled world events for the current season
}

export interface Game {
  schema: number;
  id: string;
  created: string;
  name: string;
  edited: boolean;
  settings: Settings;
  world: World;
  career: Career;
  live: unknown | null; // serialised MatchState for an in-progress interactive match
}
