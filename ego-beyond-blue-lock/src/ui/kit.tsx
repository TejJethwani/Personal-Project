/** Shared UI primitives: icons, avatar, badges, tables, tabs, modal. All artwork is original SVG/CSS. */
import { useMemo, useState, type ReactNode } from 'react';
import type { Appearance, Game, Player } from '../engine/types';
import { ovr } from '../engine/attributes';
import { lookFor } from '../engine/career';
import { NATIONS } from '../engine/data/nations';
import { nav } from '../store/game';
import { hashStr } from '../engine/rng';

const ICONS: Record<string, string> = {
  hub: 'M3 11 12 3l9 8v10h-6v-6H9v6H3z', player: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4.4 3.6-7 8-7s8 2.6 8 7z', weapon: 'M13 2 4 14h6l-1 8 9-12h-6z',
  training: 'M2 9h3v6H2zm17 0h3v6h-3zM6 7h3v10H6zm9 0h3v10h-3zM9 11h6v2H9z', squad: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 19c0-3 2.7-5 6-5s6 2 6 5zm12.5 0c0-1.7-.6-3-1.6-4 .9-.6 2-1 3.1-1 3.3 0 6 2 6 5z',
  people: 'M4 4h16v12H9l-5 4z', match: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4 3.5 2.5-1.3 4h-4.4l-1.3-4zM4.3 11l2.5-1.8 1.3 4-1.6 2.2L4 14.6zm15.4 0 .3 3.6-2.5.8-1.6-2.2 1.3-4zM9.5 17h5l1 2.4a8 8 0 0 1-7 0z',
  bids: 'M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z', table: 'M3 4h18v4H3zm0 6h18v4H3zm0 6h18v4H3z', stats: 'M3 20h18v2H3zM5 10h3v8H5zm5-6h3v14h-3zm5 9h3v5h-3z',
  award: 'M7 3h10v4a5 5 0 0 1-4 4.9V15h3v2H8v-2h3v-3.1A5 5 0 0 1 7 7zm-4 1h3v2a3 3 0 0 0 1 2.2A4 4 0 0 1 3 6zm15 0h3v2a4 4 0 0 1-4 2.2A3 3 0 0 0 18 6zM6 19h12v2H6z',
  transfer: 'M4 7h12l-3-3 1.4-1.4L20 8l-5.6 5.4L13 12l3-3H4zm16 10H8l3 3-1.4 1.4L4 16l5.6-5.4L11 12l-3 3h12z', news: 'M3 4h14v16H5a2 2 0 0 1-2-2zm16 4h2v10a2 2 0 0 1-2 2zM6 7h8v4H6zm0 6h8v1.6H6zm0 3h8v1.6H6z',
  history: 'M12 3a9 9 0 1 1-8.5 6h2.2A7 7 0 1 0 12 5v3L7.5 4.5 12 1zm-1 5h2v4.4l3 1.8-1 1.7-4-2.4z', settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 2.3-2.2-.4a7 7 0 0 0-.7-1.7l1.3-1.8-1.8-1.8-1.8 1.3a7 7 0 0 0-1.7-.7L13.7 3h-2.5l-.4 2.2a7 7 0 0 0-1.7.7L7.300 4.600 5.500 6.400l1.300 1.800a7 7 0 0 0-.7 1.700L3 10.300v2.500l2.200.4c.2.6.4 1.200.7 1.700L4.600 16.700l1.800 1.800 1.800-1.300c.5.3 1.100.5 1.700.7l.4 2.200h2.500l.4-2.200a7 7 0 0 0 1.700-.7l1.800 1.300 1.800-1.800-1.300-1.800c.3-.5.5-1.100.7-1.700l2.200-.4z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z', play: 'M7 4v16l13-8z', flag: 'M5 3h2v18H5zm3 1h11l-2.500 4L19 12H8z', save: 'M4 3h13l3 3v15H4zm3 2v5h9V5zm0 9v5h10v-5z',
};
export function Icon({ n, s = 18 }: { n: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flex: 'none' }}><path d={ICONS[n] ?? ICONS.hub} /></svg>;
}

export function tier(o: number): string { return o >= 88 ? 't1' : o >= 80 ? 't2' : o >= 70 ? 't3' : o >= 60 ? 't4' : 't5'; }
export function Ovr({ v, size }: { v: number; size?: 'sm' | 'lg' }) { return <span className={`ovr ${size ?? ''} ${tier(v)}`}>{v}</span>; }
export function ratingClass(r: number): string { return r >= 8 ? 'blue' : r >= 7 ? 'good' : r >= 6 ? '' : r > 0 ? 'bad' : 'dim'; }
export function Rating({ v }: { v: number }) { return <b className={`num ${ratingClass(v)}`}>{v > 0 ? v.toFixed(1) : '—'}</b>; }

export function Bar({ v, max = 100, kind = '', tall }: { v: number; max?: number; kind?: string; tall?: boolean }) {
  return <div className={`bar ${kind} ${tall ? 'tall' : ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemax={max}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} /></div>;
}
export function Chip({ k = '', children, title }: { k?: string; children: ReactNode; title?: string }) { return <span className={`chip ${k}`} title={title}>{children}</span>; }
export function Card({ title, children, className = '', right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return <section className={`card ${className}`}>{title && <h3>{title}<span className="grow" />{right}</h3>}{children}</section>;
}
export function Kpi({ label, value, sub, cls = '' }: { label: string; value: ReactNode; sub?: ReactNode; cls?: string }) {
  return <div className="kpi"><span>{label}</span><b className={cls}>{value}</b>{sub != null && <span style={{ textTransform: 'none', letterSpacing: 0 }}>{sub}</span>}</div>;
}
export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>)}</div>;
}
export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return <div className="modalbg" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }} role="dialog" aria-modal="true"><div className="modal" style={wide ? { maxWidth: 1000 } : undefined}>{children}</div></div>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="muted" style={{ padding: '18px 0' }}>{children}</p>; }

export function ClubBadge({ g, id, lg }: { g: Game; id: string; lg?: boolean }) {
  const c = g.world.clubs[id];
  const n = NATIONS[id];
  const col = c ? c.col : n ? ['#1e3a6e', '#e8eefc'] : ['#222', '#888'];
  const dark = (hex: string) => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 < 140; };
  return <span className={`badge ${lg ? 'lg' : ''}`} style={{ background: `linear-gradient(135deg, ${col[0]} 0 58%, ${col[1]} 58%)`, color: dark(col[0]) ? '#fff' : '#111' }} aria-hidden="true">{(c?.abbr ?? id).slice(0, 3)}</span>;
}
export function ClubLink({ g, id, badge = true }: { g: Game; id: string; badge?: boolean }) {
  const c = g.world.clubs[id];
  if (!c) return <span className="row gap6">{badge && <ClubBadge g={g} id={id} />}{NATIONS[id]?.name ?? '—'}</span>;
  return <button className="link row gap6" onClick={() => nav('club', id)}>{badge && <ClubBadge g={g} id={id} />}<span>{c.sn}</span></button>;
}
export function PlayerLink({ g, id, full }: { g: Game; id: string; full?: boolean }) {
  const p = g.world.players[id];
  if (!p) return <span className="muted">Former player</span>;
  return <button className="link" onClick={() => nav('player', id)}>{full ? p.name : p.sn}{id === g.career.pid ? ' ★' : ''}</button>;
}

const SKIN = ['#fbe3cf', '#f6d7bd', '#eec39a', '#d9a273', '#c68b59', '#a9683c', '#8b5a36', '#5c3a22', '#f3cdb4', '#3f2716'];
export const HAIR_COLS = ['#141414', '#3b2a1e', '#7a4a22', '#c58a3c', '#e9d27a', '#e8e8ee', '#c1272d', '#1e6bd6', '#2a9d8f', '#d14c9a', '#7b2bff', '#ff7a1a', '#5a6270', '#8fd3ff', '#9be15d', '#4b1d6b', '#ff9ecb', '#0d3b3a'];
const EYE_COLS = ['#2b2b2b', '#5a3a1e', '#1e6bd6', '#2a9d8f', '#8a8f98', '#b3122f', '#d8a31a', '#7b2bff', '#3df2ff', '#ff5fa2', '#6fbf3a', '#e8742a'];
const BGS = ['#0a1122', '#0b2a4a', '#2a0b2e', '#0b2e22', '#3a1010', '#2c2a10', '#14161c', '#1b2f5e', '#40204f', '#0f3d3d'];
const HAIR_NAMES = ['Short', 'Spiky', 'Long', 'Bowl', 'Ponytail', 'Buzz cut', 'Mohawk', 'Curly', 'Quiff', 'Wild', 'Twin spikes', 'Curtains', 'Top knot', 'Afro', 'Slick back', 'Bald', 'Locs', 'Man bun', 'Undercut', 'Mullet', 'Braids', 'Messy'];
/** [key, label, options, group] — the creator renders these grouped. */
export const LOOK_OPTIONS: [keyof Appearance, string, number | string[], string][] = [
  ['hair', 'Hair style', HAIR_NAMES, 'Hair'], ['fringe', 'Fringe / hairline', ['Natural', 'Straight bangs', 'Side part', 'Centre part', 'Widow\'s peak', 'Jagged bangs', 'Swept across', 'High forehead'], 'Hair'],
  ['hair2', 'Highlight', ['None', 'White', 'Gold', 'Red', 'Blue', 'Green', 'Pink', 'Black'], 'Hair'], ['beard', 'Facial hair', ['None', 'Stubble', 'Goatee', 'Full beard', 'Moustache', 'Chin strap', 'Soul patch'], 'Hair'],
  ['skin', 'Skin tone', 10, 'Head'], ['face', 'Face shape', ['Oval', 'Broad', 'Narrow', 'Square jaw', 'Sharp chin'], 'Head'], ['ears', 'Ears', ['Regular', 'Small', 'Large'], 'Head'], ['nose', 'Nose', ['Soft', 'Straight', 'Wide', 'Pointed'], 'Head'],
  ['eyes', 'Eye shape', ['Round', 'Narrow', 'Wide', 'Almond', 'Sharp', 'Sleepy', 'Fierce'], 'Eyes & mouth'], ['eyeSize', 'Eye size', ['Normal', 'Small', 'Large'], 'Eyes & mouth'], ['eyeCol', 'Eye colour', 12, 'Eyes & mouth'],
  ['brows', 'Eyebrows', ['Flat', 'Angry', 'Raised', 'Thick', 'Thin arched'], 'Eyes & mouth'], ['mouth', 'Mouth', ['Smile', 'Neutral', 'Frown', 'Grin', 'Smirk', 'Open'], 'Eyes & mouth'], ['cheek', 'Cheeks', ['Plain', 'Blush', 'Cheekbones', 'Dimples'], 'Eyes & mouth'],
  ['mark', 'Face detail', ['None', 'Scar', 'Freckles', 'Nose strip', 'Eye black', 'Beauty mark'], 'Extras'], ['acc', 'Accessory', ['None', 'White headband', 'Glasses', 'Team headband', 'Earring', 'Bandana', 'Two earrings', 'Eye patch', 'Face mask'], 'Extras'],
  ['collar', 'Shirt', ['V-neck', 'Crew neck', 'Collar', 'Stripes', 'Sash', 'Hoops'], 'Extras'], ['bg', 'Portrait background', 10, 'Extras'],
];
const STREAK = ['', '#f1f1f1', '#ffd166', '#e63946', '#3da9fc', '#2ee59d', '#ff70a6', '#111111'];

// ── hair: generated from the head geometry so it always fits every face width ──
const RY = 30, CY = 48;
const f1 = (v: number) => Math.round(v * 10) / 10;
/** Point on the head outline pushed outwards by `o`, at angle `deg` (0 = right, 90 = top, 180 = left). */
function hp(fw: number, deg: number, o: number): [number, number] { const a = (deg * Math.PI) / 180; return [50 + (fw + o) * Math.cos(a), CY - (RY + o) * Math.sin(a)]; }
const tri = (x: number) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1);
const bump = (d: number, c: number, w: number) => Math.exp(-(((d - c) / w) ** 2));
/** Outward volume of each style as a function of the angle around the head. */
function volume(style: number, d: number): number {
  switch (style) {
    case 1: return d > 18 && d < 162 ? 2.5 + 10 * tri((d - 18) / 24) : 2.5;
    case 2: case 11: case 16: case 19: case 20: return 4;
    case 3: return 5;
    case 5: return 1.1;
    case 6: return 0.6 + 13 * bump(d, 90, 13);
    case 7: return 6;
    case 8: return 3.5 + 10 * bump(d, 62, 26);
    case 9: return 4 + 9 * tri((d + 14) / 21) * (0.55 + 0.45 * Math.sin((d * Math.PI) / 180));
    case 10: return 3 + 14 * (bump(d, 126, 10) + bump(d, 54, 10));
    case 12: case 17: return 2.4;
    case 13: return 12;
    case 14: return 3;
    case 18: return 1 + 9 * bump(d, 90, 40);
    case 21: return 4 + 3.5 * tri((d + 5) / 13) + 4 * bump(d, 110, 20);
    default: return 3.2;
  }
}
/** Hairline height across the forehead, u from −1 (left temple) to 1 (right temple). */
function hairline(fr: number, u: number): number {
  const a = Math.abs(u);
  let y: number;
  switch (fr) {
    case 1: y = 41 + 9 * a ** 4; break;
    case 2: y = 35 - 6 * u + 15 * a ** 3; break;
    case 3: y = 30 + 13 * Math.min(1, a * 2.4) ** 0.7 + 6 * a ** 6; break;
    case 4: y = 31 + 18 * a ** 3 + 6 * Math.exp(-((u * 7) ** 2)); break;
    case 5: y = 38 + 10 * a ** 4 + 4.5 * tri(u * 3.5 + 0.25); break;
    case 6: y = 37 + 8 * u + 10 * a ** 4; break;
    case 7: y = 27 + 23 * a ** 2.4; break;
    default: y = 32 + 18 * a ** 3;
  }
  return Math.min(51, y);
}
function hairPaths(fw: number, style: number, fringe: number): { cap: string; top: string; back: ReactNode; capOpacity: number } | null {
  if (style === 15) return null;
  const T = style === 3 ? 196 : 186; // how far down the temples the hair reaches
  // scalp cap: over the top of the head, back along the hairline
  let cap = '';
  for (let d = T; d >= 180 - T; d -= 6) { const [x, y] = hp(fw, d, 1.4); cap += `${cap ? 'L' : 'M'}${f1(x)} ${f1(y)}`; }
  const tY = hp(fw, T, 1.4)[1];
  for (let k = 0; k <= 24; k++) { const u = 1 - k / 12; const x = 50 + u * (fw + 1.4); cap += `L${f1(x)} ${f1(Math.min(tY, hairline(style === 3 ? 1 : fringe, u) + (style === 3 ? 2 : 0)))}`; }
  cap += 'z';
  // silhouette: volume outside the head
  let top = '';
  for (let d = T; d >= 180 - T; d -= 3) { const [x, y] = hp(fw, d, volume(style, Math.max(0, Math.min(180, d)))); top += `${top ? 'L' : 'M'}${f1(x)} ${f1(y)}`; }
  for (let d = 180 - T; d <= T; d += 6) { const [x, y] = hp(fw, d, -1.5); top += `L${f1(x)} ${f1(y)}`; }
  top += 'z';
  const L = 50 - fw, R = 50 + fw;
  let back: ReactNode = null;
  if (style === 2) back = <path d={`M${L - 5} 46V86h${2 * fw + 10}V46z`} />;
  else if (style === 11) back = <path d={`M${L - 4} 46v18q4 6 9 0V46zM${R + 4} 46v18q-4 6-9 0V46z`} />;
  else if (style === 19) back = <path d={`M${L - 3} 48l-2 26 6-4 3 8 5-7 4 8h${2 * fw - 30}l4-8 5 7 3-8 6 4-2-26z`} />;
  else if (style === 4) back = <path d={`M${R - 2} 30q18 0 16 22q-1 16-7 26q-1-14-5-22q-4-10-8-14z`} />;
  else if (style === 13) back = <ellipse cx="50" cy="40" rx={fw + 15} ry="32" />;
  else if (style === 7) back = <>{Array.from({ length: 11 }, (_, i) => { const [x, y] = hp(fw, 190 - i * 20, 5); return <circle key={i} cx={f1(x)} cy={f1(y)} r="6.5" />; })}</>;
  else if (style === 16) back = <>{Array.from({ length: 9 }, (_, i) => { const x = L - 5 + (i * (2 * fw + 10)) / 8; return <rect key={i} x={f1(x - 2.6)} y="40" width="5.2" height={i > 2 && i < 6 ? 44 : 38 + (i % 2) * 5} rx="2.6" />; })}</>;
  else if (style === 20) back = <>{[L - 6, R + 6].map((x) => <g key={x}>{[50, 57, 64, 71, 78].map((y, i) => <circle key={y} cx={x + (i % 2 ? 1 : -1)} cy={y} r={4.4 - i * 0.35} />)}</g>)}</>;
  else if (style === 12) back = <><circle cx="50" cy={CY - RY - 8} r="8" /><rect x="47" y={CY - RY - 3} width="6" height="5" /></>;
  else if (style === 17) back = <circle cx="50" cy={CY - RY - 3} r="9.5" />;
  return { cap, top, back, capOpacity: style === 6 || style === 18 ? 0.38 : style === 5 ? 0.8 : 1 };
}

/** Everything the 3D match view needs to draw the same face as the portrait (same geometry, 100-unit space). */
export interface FaceSpec { skin: string; hair: string; fw: number; cap: string | null; top: string | null; capOp: number; long: boolean; big: boolean; knot: boolean; bald: boolean; eye: string; brows: number; beard: number; acc: number; mouth: number; kit?: string }
export function lookColours(look: Appearance, hair?: string): FaceSpec {
  const st = look.hair % HAIR_NAMES.length;
  const fw = [26, 29, 23, 27, 25][look.face % 5];
  const H = hairPaths(fw, st, (look.fringe ?? 0) % 8);
  return {
    skin: SKIN[look.skin % SKIN.length], hair: hair ?? look.hairHex ?? HAIR_COLS[look.hairCol % HAIR_COLS.length], fw,
    cap: H?.cap ?? null, top: H?.top ?? null, capOp: H?.capOpacity ?? 1,
    long: [2, 11, 16, 19, 20, 4].includes(st), big: st === 13 || st === 7, knot: st === 12 || st === 17, bald: st === 15,
    eye: EYE_COLS[look.eyeCol % EYE_COLS.length], brows: look.brows % 5, beard: (look.beard ?? 0) % 7, acc: look.acc % 9, mouth: look.mouth % 6,
  };
}
/** Original layered-SVG avatar. NPC looks are generated deterministically from the player's id. */
export function Avatar({ look, size = 64, kit = '#1ea7ff', hair }: { look: Appearance; size?: number; kit?: string; hair?: string }) {
  const skin = SKIN[look.skin % SKIN.length];
  const hc = hair ?? look.hairHex ?? HAIR_COLS[look.hairCol % HAIR_COLS.length];
  const ec = EYE_COLS[look.eyeCol % EYE_COLS.length];
  const ft = look.face % 5;
  const fw = [26, 29, 23, 27, 25][ft];
  const ey = look.eyes % 7;
  const br = look.brows % 5, mo = look.mouth % 6, no = (look.nose ?? 0) % 4, beard = (look.beard ?? 0) % 7, mark = (look.mark ?? 0) % 6, acc = look.acc % 9;
  const earR = [7, 5, 9][(look.ears ?? 0) % 3];
  const streak = STREAK[(look.hair2 ?? 0) % STREAK.length];
  const es = [1, 0.84, 1.18][(look.eyeSize ?? 0) % 3];
  const cheek = (look.cheek ?? 0) % 4, collar = (look.collar ?? 0) % 6;
  const eyeRy = [4.5, 3, 5.5, 3.8, 3.4, 2.6, 4][ey], eyeRx = [6.5, 6.5, 6.5, 5.5, 6.5, 6.5, 7][ey];
  const style = look.hair % HAIR_NAMES.length;
  const H = hairPaths(fw, style, (look.fringe ?? 0) % 8);
  const hs = shadeHex(hc, -0.28);
  const face = ft === 3 ? <path d={`M${50 - fw} 44c0-16 10-26 ${fw}-26s${fw} 10 ${fw} 26v10c0 12-10 24-${fw} 24s-${fw}-12-${fw}-24z`} fill={skin} /> : ft === 4 ? <path d={`M${50 - fw} 42c0-15 10-24 ${fw}-24s${fw} 9 ${fw} 24c0 14-8 28-${fw} 37-${fw - 8}-9-${fw}-23-${fw}-37z`} fill={skin} /> : <ellipse cx="50" cy="48" rx={fw} ry="30" fill={skin} />;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Player portrait">
      <rect width="100" height="100" fill={BGS[(look.bg ?? 0) % BGS.length]} />
      {H?.back && <g fill={hs}>{H.back}</g>}
      <path d="M0 100 30 82h40l30 18z" fill={kit} />
      {collar === 3 && <path d="M14 100l8-13h6l-7 13zM32 100l4-18h5l-2 18zM61 100l-2-18h5l4 18zM79 100l-7-13h6l8 13z" fill="#fff" opacity=".8" />}
      {collar === 4 && <path d="M26 84l8-2 40 18H56z" fill="#fff" opacity=".85" />}
      {collar === 5 && <path d="M16 91l7-4h54l7 4zM5 97l6-3h78l6 3z" fill="#fff" opacity=".75" />}
      {collar === 0 && <path d="M40 82h20l-10 9z" fill="#fff" opacity=".85" />}
      {collar === 1 && <path d="M39 82q11 8 22 0v3q-11 8-22 0z" fill="#fff" opacity=".85" />}
      {collar === 2 && <path d="M37 80l13 8 13-8 3 6-16 8-16-8z" fill="#fff" opacity=".9" />}
      <rect x="43" y="68" width="14" height="16" fill={skin} /><rect x="43" y="74" width="14" height="6" fill="#000" opacity=".12" />
      <ellipse cx={50 - fw} cy="50" rx="4" ry={earR} fill={skin} /><ellipse cx={50 + fw} cy="50" rx="4" ry={earR} fill={skin} />
      {face}
      {cheek === 1 && <g fill="#ff6b8a" opacity=".28"><ellipse cx={50 - fw * 0.58} cy="59" rx="5" ry="3" /><ellipse cx={50 + fw * 0.58} cy="59" rx="5" ry="3" /></g>}
      {cheek === 2 && <g stroke="#000" strokeOpacity=".18" strokeWidth="1.3" fill="none" strokeLinecap="round"><path d={`M${50 - fw + 4} 57q4 5 3 11`} /><path d={`M${50 + fw - 4} 57q-4 5-3 11`} /></g>}
      {cheek === 3 && <g stroke="#000" strokeOpacity=".22" strokeWidth="1.2" fill="none" strokeLinecap="round"><path d="M38 64q-2 3 0 6" /><path d="M62 64q2 3 0 6" /></g>}
      {beard === 1 && <path d={`M${50 - fw + 3} 58q${fw - 3} 30 ${2 * fw - 6} 0q-2 18-${fw - 3} 20t-${fw - 3}-20z`} fill={hc} opacity=".28" />}
      {beard === 2 && <path d="M43 70q7 12 14 0q-1 8-7 9t-7-9z" fill={hc} />}
      {beard === 3 && <path d={`M${50 - fw + 2} 54q2 26 ${fw - 2} 26t${fw - 2}-26q-6 12-${fw - 2} 12t-${fw - 2}-12z`} fill={hc} />}
      {beard === 4 && <path d="M41 63q9-5 18 0q-9 3-18 0z" fill={hc} />}
      {beard === 5 && <path d={`M${50 - fw + 1} 52q1 27 ${fw - 1} 27t${fw - 1}-27l-3 1q-2 21-${fw - 4} 21t-${fw - 4}-21z`} fill={hc} />}
      {beard === 6 && <path d="M47.500 70h5l-2.500 5z" fill={hc} />}
      {[-1, 1].map((s) => <g key={s} transform={`translate(${50 + s * 11} 49)`}>
        <g transform={`scale(${es})`}>
          <ellipse rx={eyeRx} ry={eyeRy} fill="#fff" />
          <circle r={ey === 1 || ey === 5 ? 2.6 : 3.4} fill={ec} /><circle r="1.4" fill="#000" /><circle cx="1.2" cy="-1.2" r=".9" fill="#fff" />
          {(ey === 4 || ey === 6) && <path d={`M${-7 * s} -3 ${7 * s} -6`} stroke="#111" strokeWidth="1.6" />}
          {ey === 5 && <path d="M-7 -1.500h14" stroke={skin} strokeWidth="3.4" />}
          {ey === 6 && <path d={`M${7 * s} 3 ${-4 * s} 4`} stroke="#111" strokeWidth="1" />}
        </g>
        <path d={br === 0 ? 'M-7 -8h14' : br === 1 ? `M${-7 * s} -6 ${7 * s} -10` : br === 2 ? `M${-7 * s} -10 ${7 * s} -7` : br === 3 ? 'M-7 -8h14' : 'M-7 -8q7 -4 14 0'} stroke={lumHex(hc) > 0.7 ? '#9aa0ad' : hc} strokeWidth={br === 3 ? 4.2 : br === 4 ? 1.6 : 2.6} strokeLinecap="round" fill="none" />
        {mark === 4 && <path d="M-6 8h12" stroke="#111" strokeWidth="2.6" strokeLinecap="round" />}
      </g>)}
      <path d={['M48 58q2 3 4 0', 'M50 52v6h3', 'M46 58q4 4 8 0', 'M50 52l-3 7h5'][no]} stroke="#000" strokeOpacity=".32" fill="none" strokeWidth="1.4" strokeLinecap="round" />
      {acc !== 8 && <path d={['M43 66q7 4 14 0', 'M43 67h14', 'M43 68q7 -3 14 0', 'M44 65q6 7 12 0z', 'M44 67q8 2 13 -3', 'M45 65q5 8 10 0q-5 -2 -10 0z'][mo]} stroke="#7a2f2f" strokeWidth="2" fill={mo === 3 ? '#fff' : mo === 5 ? '#4a1414' : 'none'} strokeLinecap="round" />}
      {mark === 1 && <path d="M62 40l5 13M61 46l7-2" stroke="#b23a48" strokeWidth="1.5" strokeLinecap="round" />}
      {mark === 2 && <g fill="#000" opacity=".25">{[[38, 57], [42, 59], [35, 60], [58, 59], [62, 57], [65, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" />)}</g>}
      {mark === 3 && <rect x="44" y="53" width="12" height="4" rx="1.5" fill="#f1f1f1" />}
      {mark === 5 && <circle cx="60" cy="63" r="1.300" fill="#2b1a12" />}
      {H && <>
        <path d={H.cap} fill={hc} opacity={H.capOpacity} />
        <path d={H.top} fill={hc} />
        {style === 14 && <g stroke={hs} strokeWidth="1" fill="none" opacity=".7"><path d={`M${50 - fw * 0.5} 30q${fw * 0.5}-9 ${fw}-0`} /><path d={`M${50 - fw * 0.7} 35q${fw * 0.7}-13 ${fw * 1.4} 0`} /></g>}
        {streak && (() => { const pts: string[] = []; for (let d = 122; d >= 100; d -= 3) { const [x, y] = hp(fw, d, volume(style, d) - 0.2); pts.push(`${f1(x)} ${f1(y)}`); } const [x1, y1] = hp(fw, 100, -9), [x2, y2] = hp(fw, 118, -9); return <path d={`M${pts.join('L')}L${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}z`} fill={streak} opacity=".95" />; })()}
      </>}
      {acc === 1 && <path d={`M${50 - fw - 1} 34h${2 * fw + 2}v5H${50 - fw - 1}z`} fill="#fff" opacity=".92" />}
      {acc === 2 && <g fill="none" stroke="#dfe7ff" strokeWidth="1.8"><circle cx="39" cy="49" r="8.5" /><circle cx="61" cy="49" r="8.5" /><path d="M47.500 49h5" /></g>}
      {acc === 3 && <path d={`M${50 - fw - 1} 34h${2 * fw + 2}v5H${50 - fw - 1}z`} fill={kit} stroke="#fff" strokeWidth=".6" />}
      {(acc === 4 || acc === 6) && <circle cx={50 + fw + 1} cy={57} r="2.2" fill="#ffd166" stroke="#fff" strokeWidth=".5" />}
      {acc === 6 && <circle cx={50 - fw - 1} cy={57} r="2.2" fill="#ffd166" stroke="#fff" strokeWidth=".5" />}
      {acc === 5 && <><path d={`M${50 - fw - 2} 38q${fw + 2}-12 ${2 * fw + 4} 0v-8q-${fw + 2}-12-${2 * fw + 4} 0z`} fill="#c1272d" /><path d={`M${50 + fw} 34l10 8-9 2z`} fill="#c1272d" /></>}
      {acc === 7 && <><path d={`M${50 - fw} 38L${50 + fw} 46`} stroke="#111" strokeWidth="1.6" /><ellipse cx="61" cy="49" rx="8" ry="6.5" fill="#111" /></>}
      {acc === 8 && <path d={`M${50 - fw + 3} 58q${fw - 3}-6 ${2 * fw - 6} 0q-1 16-${fw - 3} 18t-${fw - 3}-18z`} fill="#e8edf5" stroke="#aab3c2" strokeWidth=".6" />}
    </svg>
  );
}
function shadeHex(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function lumHex(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.3;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export function PlayerAvatar({ g, p, size = 48 }: { g: Game; p: Player; size?: number }) {
  const look = p.id === g.career.pid ? g.career.look : lookFor(p.id);
  const club = p.club ? g.world.clubs[p.club] : null;
  return <Avatar look={look} size={size} kit={club?.col[0] ?? '#31405f'} hair={p.id === g.career.pid && !g.career.flags.playAs ? undefined : p.hair} />;
}

export interface Col<T> { h: string; get: (r: T) => ReactNode; sort?: (r: T) => number | string; n?: boolean; title?: string; cls?: string }
/** Sortable table. */
export function DataTable<T>({ rows, cols, rowKey, onRow, isMe, initial, max = 200, dir = -1 }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; isMe?: (r: T) => boolean; initial?: number; max?: number; dir?: 1 | -1 }) {
  const [sort, setSort] = useState<{ i: number; d: 1 | -1 } | null>(initial != null ? { i: initial, d: dir } : null);
  const sorted = useMemo(() => {
    if (!sort || !cols[sort.i]?.sort) return rows;
    const f = cols[sort.i].sort!;
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.d; });
  }, [rows, sort, cols]);
  return (
    <div className="tw"><table><thead><tr>{cols.map((c, i) => <th key={i} title={c.title} className={`${c.n ? 'n' : ''} ${c.sort ? 's' : ''}`} onClick={c.sort ? () => setSort((s) => (s?.i === i ? { i, d: (s.d * -1) as 1 | -1 } : { i, d: -1 })) : undefined} aria-sort={sort?.i === i ? (sort.d === 1 ? 'ascending' : 'descending') : undefined}>{c.h}{sort?.i === i ? (sort.d === 1 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
      <tbody>{sorted.slice(0, max).map((r) => <tr key={rowKey(r)} className={`${isMe?.(r) ? 'me' : ''} ${onRow ? 'click' : ''}`} onClick={onRow ? () => onRow(r) : undefined}>{cols.map((c, i) => <td key={i} className={`${c.n ? 'n' : ''} ${c.cls ?? ''}`}>{c.get(r)}</td>)}</tr>)}</tbody></table></div>
  );
}
export function natName(id: string): string { return NATIONS[id]?.name ?? id; }
export function posColor(pos: string): string { return pos === 'GK' ? '#ffb020' : ['CB', 'LB', 'RB'].includes(pos) ? '#2ee59d' : ['DM', 'CM', 'AM', 'LM', 'RM'].includes(pos) ? '#7ad7ff' : '#ff6b8f'; }
export function Pos({ p }: { p: string }) { return <span className="num" style={{ color: posColor(p), fontSize: 14 }}>{p}</span>; }
export function playerOvr(p: Player): number { return ovr(p); }
export function seedOf(s: string): number { return hashStr(s); }

/** Two-step confirmation button (browser confirm() dialogs are unavailable in sandboxed frames). */
export function ConfirmButton({ label, confirm, onConfirm, className = 'btn sm danger', disabled }: { label: string; confirm: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  return armed
    ? <span className="row gap6"><button className={className} onClick={() => { setArmed(false); onConfirm(); }}>{confirm}</button><button className="btn sm ghost" onClick={() => setArmed(false)}>Cancel</button></span>
    : <button className={className} disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
}
