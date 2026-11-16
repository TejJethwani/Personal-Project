/**
 * Trophy art. Hand-drawn SVG silhouettes modelled on the real trophies: the golden ball, the big-eared
 * European Cup, the tall Europa League cup, the Premier League crown, the Bundesliga salad bowl (Meisterschale),
 * the Hexagoal, the World Cup's spiralling figures and globe, and so on.
 */
import { useId, type ReactElement } from 'react';
import type { AwardType } from '../engine/types';
import { LEAGUES } from '../engine/data/clubs';

export type TKind = 'ballon' | 'ucl' | 'uel' | 'pl' | 'laliga' | 'bund' | 'seriea' | 'ligue1' | 'league' | 'facup' | 'cup' | 'wc' | 'euro' | 'copa' | 'cont' | 'boot' | 'glove' | 'kopa' | 'player' | 'nel' | 'xi' | 'coach' | 'club' | 'young';

const LEAGUE_K: Record<string, TKind> = { eng1: 'pl', esp1: 'laliga', ger1: 'bund', ita1: 'seriea', fra1: 'ligue1' };
export function kindForComp(id: string): TKind {
  if (LEAGUE_K[id]) return LEAGUE_K[id];
  if (id === 'ucl') return 'ucl'; if (id === 'uel') return 'uel';
  if (id === 'wc' || id === 'u20wc') return 'wc'; if (id === 'euro' || id === 'u21euro') return 'euro'; if (id === 'copa') return 'copa';
  if (id === 'afcon' || id === 'asian' || id === 'gold' || id === 'u20asian') return 'cont';
  if (id === 'engcup') return 'facup'; if (id === 'nel') return 'nel';
  if (LEAGUES.some((l) => l.cup === id)) return 'cup';
  if (LEAGUES.some((l) => l.id === id)) return 'league';
  return 'cup';
}
export function kindForAward(t: AwardType | string): TKind {
  if (t === 'world_player') return 'ballon'; if (t === 'kopa') return 'kopa';
  if (/glove|_gk|yashin/.test(t)) return 'glove';
  if (/boot|shoe|scorer|muller/.test(t)) return 'boot';
  if (/xi|tots|totw|totm|totr/.test(t)) return 'xi';
  if (/manager|cruyff/.test(t)) return 'coach';
  if (/club/.test(t)) return 'club';
  if (/young|ypots|breakout|kopa/.test(t)) return 'young';
  if (/nel_/.test(t)) return 'nel';
  return 'player';
}
const NAME_K: [RegExp, TKind][] = [[/Ballon/i, 'ballon'], [/Champions League/i, 'ucl'], [/Europa/i, 'uel'], [/Premier League/i, 'pl'], [/La ?Liga/i, 'laliga'], [/Bundesliga/i, 'bund'], [/Serie A/i, 'seriea'], [/Ligue 1/i, 'ligue1'], [/FA Cup/i, 'facup'], [/U-20 World Cup|World Cup/i, 'wc'], [/Euro/i, 'euro'], [/Copa Am/i, 'copa'], [/Africa|Asian|Gold Cup/i, 'cont'], [/Neo Egoist|NEL/i, 'nel'], [/Cup|Copa|Pokal|Coupe|Coppa|Beker|Taça/i, 'cup'], [/League|Liga|Eredivisie|Championship|Primeira/i, 'league']];
export function kindForName(n: string): TKind { for (const [re, k] of NAME_K) if (re.test(n)) return k; return 'cup'; }

export function Trophy({ kind, size = 72, title }: { kind: TKind; size?: number; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const G = `g${uid}`, Sv = `s${uid}`, B = `b${uid}`, Bl = `l${uid}`, Gr = `r${uid}`;
  const g = `url(#${G})`, sv = `url(#${Sv})`, b = `url(#${B})`;
  const base = (w = 40, y = 112, fill = b) => <><rect x={50 - w / 2} y={y} width={w} height={14} rx={2} fill={fill} /><rect x={50 - w / 2 + 4} y={y - 6} width={w - 8} height={7} rx={1.5} fill={fill} /></>;
  const shine = (d: string) => <path d={d} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />;
  const body: Record<TKind, ReactElement> = {
    // golden ball on a dark plinth
    ballon: <><path d="M36 126h28l-4-18H40z" fill={b} /><rect x="44" y="96" width="12" height="13" fill={g} /><circle cx="50" cy="62" r="34" fill={`url(#${Gr})`} />
      <path d="M50 47l13 9-5 15H42l-5-15z" fill="none" stroke="#7a5a10" strokeOpacity=".55" strokeWidth="1.6" /><path d="M50 47V30M63 56l15-6M58 71l9 14M42 71l-9 14M37 56l-15-6" stroke="#7a5a10" strokeOpacity=".45" strokeWidth="1.4" />{shine('M30 50c3-10 10-17 20-20')}</>,
    // the big-eared cup
    ucl: <><path d="M33 14h34c0 22-4 46-12 62h-10C37 60 33 36 33 14z" fill={sv} /><ellipse cx="50" cy="14" rx="17" ry="4" fill="#dfe6ee" stroke="#8d98a8" />
      <path d="M34 22C12 18 6 40 14 56s22 20 30 14M66 22c22-4 28 18 20 34s-22 20-30 14" fill="none" stroke={sv} strokeWidth="6" strokeLinecap="round" />
      <rect x="45" y="76" width="10" height="22" fill={sv} /><path d="M36 98h28l4 10H32z" fill={sv} />{base(44, 116, sv)}{shine('M39 20c0 18 2 34 7 48')}</>,
    // tall, slim, flaring cup on a round base
    uel: <><path d="M30 10c8 4 14 4 20 4s12 0 20-4c-2 24-8 44-15 58h-10C38 54 32 34 30 10z" fill={sv} /><path d="M45 68h10l-2 28h-6z" fill={sv} /><ellipse cx="50" cy="104" rx="20" ry="7" fill={sv} /><ellipse cx="50" cy="118" rx="24" ry="8" fill={b} />{shine('M37 18c2 16 6 32 11 44')}</>,
    // silver cup with a gold crown on the lid
    pl: <><path d="M38 24l4-10 4 6 4-9 4 9 4-6 4 10z" fill={g} /><rect x="34" y="24" width="32" height="6" rx="2" fill={g} /><path d="M30 30h40c0 26-8 44-20 44S30 56 30 30z" fill={sv} />
      <path d="M30 36c-12 0-14 18-2 22M70 36c12 0 14 18 2 22" fill="none" stroke={sv} strokeWidth="5" /><rect x="45" y="74" width="10" height="18" fill={sv} />{base(42, 108)}<rect x="30" y="111" width="40" height="3" fill="#6b2bd6" />{shine('M36 36c0 14 4 26 10 32')}</>,
    // wide silver bowl on a short stem
    laliga: <><path d="M22 22h56c0 30-12 50-28 50S22 52 22 22z" fill={sv} /><ellipse cx="50" cy="22" rx="28" ry="6" fill="#dfe6ee" stroke="#8d98a8" /><path d="M44 72h12l3 24H41z" fill={sv} />{base(48, 110, sv)}{shine('M29 30c2 16 8 28 16 34')}</>,
    // the salad bowl: a silver plate with a ring of green stones, on a stand
    bund: <><circle cx="50" cy="56" r="40" fill={sv} /><circle cx="50" cy="56" r="31" fill="none" stroke="#9aa6b4" strokeWidth="2" /><circle cx="50" cy="56" r="20" fill="#c9d2dc" stroke="#8d98a8" />
      {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return <circle key={i} cx={50 + Math.cos(a) * 35.5} cy={56 + Math.sin(a) * 35.5} r="2.6" fill="#1f9d55" stroke="#0b5c2f" strokeWidth=".6" />; })}
      <path d="M40 96h20l4 14H36z" fill={b} />{base(46, 114)}{shine('M20 44c4-12 14-22 26-25')}</>,
    // conical silver cup over a sphere
    seriea: <><path d="M28 14h44L56 66H44z" fill={sv} /><ellipse cx="50" cy="14" rx="22" ry="5" fill="#dfe6ee" stroke="#8d98a8" /><circle cx="50" cy="78" r="13" fill={sv} /><rect x="46" y="90" width="8" height="10" fill={sv} />{base(42, 112)}<path d="M33 112h34v3H33z" fill="#2a8c3c" />{shine('M34 18l12 42')}</>,
    // six-faced silver trophy
    ligue1: <><path d="M32 12h36l6 40-12 46H38L26 52z" fill={sv} /><path d="M38 12l-4 40 4 46M62 12l4 40-4 46M50 12v86" stroke="#8d98a8" strokeWidth="1.4" fill="none" /><path d="M27 52h46" stroke="#8d98a8" strokeWidth="1.2" />{base(44, 112)}<rect x="32" y="114" width="12" height="3" fill="#1e40af" /><rect x="44" y="114" width="12" height="3" fill="#fff" /><rect x="56" y="114" width="12" height="3" fill="#dc2626" /></>,
    // classic two-handled silver cup
    league: <><path d="M28 20h44c0 28-10 46-22 46S28 48 28 20z" fill={sv} /><path d="M28 26C14 26 14 46 30 50M72 26c14 0 14 20-2 24" fill="none" stroke={sv} strokeWidth="5" /><rect x="45" y="66" width="10" height="24" fill={sv} />{base(42, 108)}{shine('M34 26c1 14 5 24 10 30')}</>,
    // lidded two-handled cup with a small finial and ribbons
    facup: <><circle cx="50" cy="10" r="4" fill={sv} /><path d="M36 20c4-6 24-6 28 0z" fill={sv} /><path d="M30 20h40c0 28-8 46-20 46S30 48 30 20z" fill={sv} />
      <path d="M30 26C16 22 14 46 32 48M70 26c14-4 16 20-2 22" fill="none" stroke={sv} strokeWidth="5" /><path d="M20 40l-4 30 6-4 3 6 2-30M80 40l4 30-6-4-3 6-2-30" fill="#c8102e" opacity=".9" />
      <rect x="45" y="66" width="10" height="22" fill={sv} />{base(42, 106)}{shine('M36 26c1 14 4 24 9 30')}</>,
    cup: <><path d="M28 18h44c0 30-10 48-22 48S28 48 28 18z" fill={g} /><path d="M28 24C12 24 12 46 30 50M72 24c16 0 16 22-2 26" fill="none" stroke={g} strokeWidth="5" /><rect x="45" y="66" width="10" height="24" fill={g} />{base(42, 108)}{shine('M34 24c1 14 5 26 10 32')}</>,
    // two figures spiralling up to hold the globe, green bands on the base
    wc: <><circle cx="50" cy="26" r="20" fill={`url(#${Gr})`} /><path d="M32 22c10 4 26 4 36 0M31 32c10 3 28 3 38 0M50 6c-8 8-8 32 0 40" fill="none" stroke="#7a5a10" strokeOpacity=".5" strokeWidth="1.4" />
      <path d="M34 40c-6 10 6 18 8 28s-6 20-4 30h24c2-10-6-20-4-30s14-18 8-28c-6 6-12 8-16 8s-10-2-16-8z" fill={g} /><path d="M40 52c6 8 14 12 22 4M42 76c4 6 12 6 16-2" fill="none" stroke="#7a5a10" strokeOpacity=".45" strokeWidth="1.6" />
      <path d="M34 98h32l2 8H32z" fill={g} /><rect x="32" y="106" width="36" height="5" fill="#1f7a3a" /><rect x="32" y="111" width="36" height="4" fill={g} /><rect x="32" y="115" width="36" height="5" fill="#1f7a3a" /><rect x="30" y="120" width="40" height="6" rx="1.5" fill={g} />{shine('M36 18c2-6 6-10 12-12')}</>,
    // tall silver amphora with small handles
    euro: <><path d="M38 8h24c-2 8-4 12-4 18 10 8 14 22 10 40-3 14-10 22-18 22s-15-8-18-22c-4-18 0-32 10-40 0-6-2-10-4-18z" fill={sv} /><path d="M34 26c-8 2-8 14 0 16M66 26c8 2 8 14 0 16" fill="none" stroke={sv} strokeWidth="4" /><rect x="45" y="88" width="10" height="12" fill={sv} />{base(40, 112)}{shine('M40 36c-4 14-2 28 6 40')}</>,
    // big silver cup on a tiered base with a finial
    copa: <><path d="M46 4h8l-1 8h-6z" fill={sv} /><path d="M26 16h48c0 26-10 44-24 44S26 42 26 16z" fill={sv} /><path d="M26 22C12 22 12 44 30 46M74 22c14 0 14 22-4 24" fill="none" stroke={sv} strokeWidth="5" /><rect x="45" y="60" width="10" height="14" fill={sv} /><path d="M36 74h28v10H36zM32 84h36v10H32z" fill={b} /><rect x="28" y="94" width="44" height="12" fill={b} /><rect x="24" y="106" width="52" height="16" rx="2" fill={b} />{shine('M32 22c1 14 5 24 10 30')}</>,
    cont: <><path d="M28 18h44c0 30-10 48-22 48S28 48 28 18z" fill={g} /><path d="M50 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#fff8d6" opacity=".9" /><path d="M28 24C12 24 12 46 30 50M72 24c16 0 16 22-2 26" fill="none" stroke={g} strokeWidth="5" /><rect x="45" y="66" width="10" height="24" fill={g} />{base(42, 108)}</>,
    // the golden boot
    boot: <><path d="M30 20h22l2 40c10 2 24 6 30 14 3 5 0 10-6 10H26c-4 0-6-3-5-7z" fill={g} /><path d="M30 30h22M30 40h23M31 50h23" stroke="#7a5a10" strokeOpacity=".5" strokeWidth="1.5" /><path d="M26 84v5M38 84v5M52 84v5M66 84v5M78 84v4" stroke={g} strokeWidth="4" strokeLinecap="round" />{base(56, 108)}{shine('M34 24l2 36')}</>,
    // the golden glove
    glove: <><path d="M30 92V50c0-4 6-4 6 0V30c0-5 7-5 7 0v-6c0-5 7-5 7 0v6c0-5 7-5 7 0v10c0-5 7-5 7 0v30c0 8-4 14-8 18v4z" fill={g} /><path d="M24 64c0-6 8-8 10-2l4 12" fill={g} /><path d="M36 50v-8M43 46V30M50 46V28M57 48V36" stroke="#7a5a10" strokeOpacity=".45" strokeWidth="1.4" /><rect x="30" y="92" width="36" height="8" fill={g} />{base(48, 112)}</>,
    // a golden ball rising from a spire
    kopa: <><path d="M44 100l2-44h8l2 44z" fill={g} /><circle cx="50" cy="40" r="20" fill={`url(#${Gr})`} /><path d="M50 30l7 5-3 8h-8l-3-8z" fill="none" stroke="#7a5a10" strokeOpacity=".5" strokeWidth="1.2" />{base(40, 112)}{shine('M38 34c2-6 6-10 12-12')}</>,
    // a golden figure on a pillar
    player: <><circle cx="50" cy="18" r="8" fill={g} /><path d="M40 30h20l6 22-8 2-2 32h-4l-2-22-2 22h-4l-2-32-8-2z" fill={g} /><rect x="38" y="86" width="24" height="18" fill={g} />{base(44, 112)}{shine('M45 33l-3 14')}</>,
    // Blue Lock's crystal
    nel: <><path d="M50 4l18 30-8 62H40l-8-62z" fill={`url(#${Bl})`} /><path d="M50 4v92M32 34h36M40 96l10-62 10 62" fill="none" stroke="#e0f2ff" strokeOpacity=".5" strokeWidth="1.2" />{base(44, 112)}<rect x="30" y="114" width="40" height="3" fill="#1ea7ff" /></>,
    // a gold shield with the eleven
    xi: <><path d="M50 8l34 10v36c0 26-16 42-34 50C32 96 16 80 16 54V18z" fill={g} />{[[50, 86], [30, 70], [44, 72], [56, 72], [70, 70], [36, 52], [50, 54], [64, 52], [34, 32], [50, 30], [66, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill="#fff8d6" />)}{base(40, 112)}</>,
    // a silver plaque with a tactics board
    coach: <><rect x="22" y="12" width="56" height="78" rx="6" fill={sv} /><rect x="28" y="18" width="44" height="62" rx="3" fill="#1f6f43" /><path d="M50 18v62M28 49h44" stroke="#e8f5ec" strokeOpacity=".7" strokeWidth="1.2" /><circle cx="50" cy="49" r="8" fill="none" stroke="#e8f5ec" strokeOpacity=".7" /><path d="M36 30l6 6M42 30l-6 6M58 62l6 6M64 62l-6 6" stroke="#fff" strokeWidth="2" />{base(44, 108)}</>,
    // a crest-shaped gold trophy
    club: <><path d="M50 8l30 8v30c0 24-14 40-30 48C34 86 20 70 20 46V16z" fill={g} /><path d="M50 22l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#fff8d6" opacity=".85" />{base(44, 110)}</>,
    // a rising star
    young: <><path d="M50 8l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill={g} /><rect x="46" y="66" width="8" height="30" fill={g} />{base(40, 112)}{shine('M44 22l4-8')}</>,
  };
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" role="img" aria-label={title ?? kind} className="trophy-svg">
      <defs>
        <linearGradient id={G} x1="0" x2="1"><stop offset="0" stopColor="#9a6c12" /><stop offset=".35" stopColor="#f6d77a" /><stop offset=".55" stopColor="#fff2b8" /><stop offset="1" stopColor="#a77a17" /></linearGradient>
        <linearGradient id={Sv} x1="0" x2="1"><stop offset="0" stopColor="#7d8896" /><stop offset=".4" stopColor="#eef2f7" /><stop offset=".6" stopColor="#ffffff" /><stop offset="1" stopColor="#8a96a5" /></linearGradient>
        <linearGradient id={B} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a2a30" /><stop offset="1" stopColor="#0d0d10" /></linearGradient>
        <linearGradient id={Bl} x1="0" x2="1"><stop offset="0" stopColor="#0b4a8a" /><stop offset=".5" stopColor="#7fd3ff" /><stop offset="1" stopColor="#0c3d75" /></linearGradient>
        <radialGradient id={Gr} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff6c8" /><stop offset=".45" stopColor="#f2c84b" /><stop offset="1" stopColor="#8a5f0c" /></radialGradient>
      </defs>
      {body[kind]}
    </svg>
  );
}
