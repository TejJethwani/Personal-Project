/** Match engine data model. A MatchState is plain data and fully self-contained, so it can be saved mid-match. */
import type { Pos, Tactics } from '../types';
import type { RngState } from '../rng';

/** Per-player stat line indices. Every displayed statistic derives from these lines. */
export const S = {
  APP: 0, START: 1, SEC: 2, PLAY: 3, G: 4, A: 5, PENG: 6, PENM: 7, SH: 8, SOT: 9, XG: 10, XA: 11, KP: 12,
  PA: 13, PC: 14, DA: 15, DC: 16, TKA: 17, TKW: 18, INT: 19, BLK: 20, CLR: 21, AW: 22, AL: 23, FC: 24, FW: 25,
  YC: 26, RC: 27, OFF: 28, SV: 29, GC: 30, CS: 31, RAT: 32, RATN: 33, POTM: 34, OG: 35, BCM: 36, TCH: 37, LOST: 38,
} as const;
export const NSTAT = 39;
export const newLine = (): number[] => new Array(NSTAT).fill(0);
export function addLine(into: number[], line: number[]): void { for (let i = 0; i < NSTAT; i++) into[i] += line[i] || 0; }

export interface Rules {
  kind: 'nel' | 'reg';
  goalTarget: number; // NEL: first to N
  halfSec: number; // regulation half length (clock seconds)
  extraTime: boolean; // knockout: play extra time + penalties if level
  subs: number;
  starChange: boolean;
  starSec: number; // actual playing seconds
  offside: boolean;
}
export const REG_RULES: Rules = { kind: 'reg', goalTarget: 0, halfSec: 2700, extraTime: false, subs: 5, starChange: false, starSec: 0, offside: true };

export interface MPlayer {
  id: string; nm: string; num: number;
  t: 0 | 1;
  pos: Pos; line: number;
  bx: number; by: number; x: number; y: number;
  a: number[]; // effective attributes at kick-off
  m: number[]; // passive ability modifiers
  ovr: number; h: number;
  st: number; // stamina 0..100
  on: boolean; used: boolean; started: boolean;
  inC: number; outC: number; inP: number; outP: number;
  s: number[];
  fl: number; flEnd: number; flN: number; canFlow: boolean; boost: number[];
  run: number; runT: number; open: boolean; beat: number;
  yc: number; rc: boolean; inj: number;
  ab: { id: string; lv: number; evo?: string }[];
  abN: Record<string, number>;
  ego: number; agg: number;
  user: boolean; star: boolean;
  chem: number; trust: number; rival: boolean;
  foot: number; // 0 left, 1 right, 2 both
  streak: number; lostTo: number; ultN: number;
  req: number; // requesting the ball (steps)
  focus: number; // user defensive stance for the current possession
}

export interface MTeam {
  id: string; name: string; abbr: string; col: string; col2: string;
  on: number[]; bench: number[];
  subs: number;
  form: string; tac: Tactics;
  star: number; starState: number; starEnd: number; starFor: number;
  tau: number; // AI decision noise
  fam: number; // familiarity with the user's weapons 0..1
  nextSub: number;
  red: number;
}

export interface MEvent {
  c: number; // clock seconds
  k: string; // kind
  t: number; // team 0/1 or -1
  p: number; // player idx or -1
  q: number; // second player idx or -1
  v: number; // numeric payload (xG, etc.)
  x: string; // text
  i: number; // importance 0 routine, 1 notable, 2 key, 3 goal-level
  h?: number; // period
}

export interface Option {
  id: string;
  kind: string; // shoot | pass | through | cross | dribble | carry | hold | onetwo | run | press | tackle | ...
  label: string;
  detail: string;
  intent: string;
  risk: string;
  p: number; // success probability used by the simulation
  u: number; // AI utility
  tgt: number; // target player idx
  v: string; // variant
  ab: string; // ability id if weapon/ultimate
  sta: number;
  hot?: boolean; // highlighted as weapon / ultimate
}

export interface Decision {
  kind: 'ball' | 'offball' | 'defend' | 'penalty' | 'flow';
  title: string;
  ctx: string;
  options: Option[];
  imp: number;
}

export interface UserCtl {
  idx: number;
  mode: 'full' | 'key' | 'sim';
  thr: number; // importance threshold for prompts
  showP: boolean;
  forgive: number; // logit bonus on the user's actions (difficulty: decision forgiveness)
  autoFlow: boolean;
  instr: { stance: number; press: number; risk: number };
  egoBoost: number[]; // attribute indices boosted in Flow
  gain: { goal: number; key: number; dribble: number; duel: number; defend: number; challenge: number };
  lastSeq: number; // possession sequence of the last off-ball prompt
  lastDefSeq: number;
  decisions: number;
  selfish: number; unselfish: number; discipline: number; disciplineN: number;
  memo: Record<number, { pt: number; pf: number; at: number; af: number; ign: number; iIgn: number; dw: number; dl: number; fouled: number }>;
  combo: number; // idx of combo partner or -1
  reactions: Record<number, string>; // partner idx -> reaction name
  seen: Record<string, number>; // ability id -> times witnessed
  used: Record<string, number>; // own ability id -> times used
  dominion: number; // playSec until Field Dominion ends
  realism: number;
}

export interface MatchState {
  v: number;
  fid: string; comp: string; compName: string;
  rules: Rules;
  rng: RngState; crng: RngState;
  clock: number; // match clock in seconds (regulation); for NEL equals `play`
  play: number; // actual ball-in-play seconds
  period: number; // reg: 1,2 halves; 3,4 extra time; 5 penalties. NEL: always 1
  phase: string; // state-machine state label
  periodEnd: number; // clock at which the current period ends (0 = not yet announced)
  lost: number; // stoppage accumulated this half (seconds)
  score: [number, number];
  pens: [number, number] | null;
  agg: [number, number] | null; // first-leg aggregate (home, away of THIS match)
  ko: boolean;
  teams: [MTeam, MTeam];
  pl: MPlayer[];
  bx: number; by: number; // ball
  car: number; // carrier idx or -1
  poss: 0 | 1;
  arr: number; // 0 settled, 1 ground pass, 2 lofted, 3 cross, 4 through, 5 rebound, 6 loose
  bh: number; // ball height 0 ground, 1 mid, 2 high
  from: number; // passer idx for assist tracking
  seq: number; seqPasses: number; seqStart: number;
  restart: { k: number; t: 0 | 1; x: number; y: number } | null;
  stage: number;
  pending: Decision | null;
  choice: string | null;
  ev: MEvent[];
  goals: [number, 0 | 1, string, string, number, number, number][];
  done: boolean; winner: number;
  uc: UserCtl | null;
  imp: number; // match importance 0..1
  verb: number; // 0 silent, 1 key, 2 full
  steps: number;
  esc: number; // NEL escalation
  inj: { idx: number; days: number }[];
  subsLog: { c: number; t: number; off: number; on: number; star?: boolean }[];
  hold: number; // tempo freeze steps remaining for the team in possession
  note: string;
  press: number; nd: number; // cached pressure / nearest defender for the current step
  home0: boolean; neutral: boolean;
}

export const RUN = { NONE: 0, BEHIND: 1, BLIND: 2, SHORT: 3, NEAR: 4, FAR: 5, OVERLAP: 6, HOLD: 7, PRED: 8 } as const;
export const ARR = { SET: 0, GROUND: 1, LOFT: 2, CROSS: 3, THROUGH: 4, REBOUND: 5, LOOSE: 6 } as const;
export const RST = { KICKOFF: 1, GOALKICK: 2, THROW: 3, CORNER: 4, FREEKICK: 5, PENALTY: 6, GKHOLD: 7 } as const;
