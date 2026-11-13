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

const SKIN = ['#fbe3cf', '#f6d7bd', '#eec39a', '#d9a273', '#c68b59', '#a9683c', '#8b5a36', '#5c3a22'];
export const HAIR_COLS = ['#141414', '#3b2a1e', '#7a4a22', '#c58a3c', '#e9d27a', '#e8e8ee', '#c1272d', '#1e6bd6', '#2a9d8f', '#d14c9a', '#7b2bff', '#ff7a1a'];
const EYE_COLS = ['#2b2b2b', '#5a3a1e', '#1e6bd6', '#2a9d8f', '#8a8f98', '#b3122f', '#d8a31a', '#7b2bff'];
const BGS = ['#0a1122', '#0b2a4a', '#2a0b2e', '#0b2e22', '#3a1010', '#2c2a10'];
export const LOOK_OPTIONS: [keyof Appearance, string, number | string[]][] = [
  ['skin', 'Skin tone', 8], ['face', 'Face shape', ['Oval', 'Broad', 'Narrow', 'Square jaw', 'Sharp chin']], ['hair', 'Hair style', ['Short', 'Spiky', 'Long', 'Bowl', 'Side tail', 'Buzz cut', 'Mohawk', 'Curly', 'Swept', 'Wild', 'Twin spikes', 'Centre part', 'Top knot', 'Afro', 'Slick back', 'Bald']],
  ['hair2', 'Hair streak', ['None', 'White', 'Gold', 'Red', 'Blue', 'Green', 'Pink']], ['eyes', 'Eye shape', ['Round', 'Narrow', 'Wide', 'Almond', 'Sharp', 'Sleepy', 'Fierce']], ['eyeCol', 'Eye colour', 8],
  ['brows', 'Eyebrows', ['Flat', 'Angry', 'Raised', 'Thick', 'Thin arched']], ['nose', 'Nose', ['Soft', 'Straight', 'Wide', 'Pointed']], ['mouth', 'Mouth', ['Smile', 'Neutral', 'Frown', 'Grin', 'Smirk', 'Open']], ['ears', 'Ears', ['Regular', 'Small', 'Large']],
  ['beard', 'Facial hair', ['None', 'Stubble', 'Goatee', 'Full beard', 'Moustache']], ['mark', 'Face detail', ['None', 'Scar', 'Freckles', 'Nose strip', 'Eye black', 'Beauty mark']],
  ['acc', 'Accessory', ['None', 'White headband', 'Glasses', 'Team headband', 'Earring', 'Bandana']], ['bg', 'Portrait background', 6],
];
const STREAK = ['', '#f1f1f1', '#ffd166', '#e63946', '#3da9fc', '#2ee59d', '#ff70a6'];
const HAIR: ((c: string) => ReactNode)[] = [
  (c) => <path d="M22 44c-3-22 9-32 28-32s31 10 28 32c-4-12-10-17-28-17S26 32 22 44z" fill={c} />,
  (c) => <path d="M20 46c-4-10 0-20 4-24l-2-9 9 5 5-10 6 9 8-9 4 10 9-6-1 10c5 5 9 13 6 24-5-13-9-18-26-18S25 33 20 46z" fill={c} />,
  (c) => <path d="M19 74c-5-34 4-62 31-62s36 28 31 62l-6-2c3-22 1-40-25-40S22 50 25 72z" fill={c} />,
  (c) => <path d="M20 58c-4-28 6-46 30-46s34 18 30 46c-2-16-8-28-30-28S22 42 20 58z" fill={c} />,
  (c) => <><path d="M22 44c-3-22 9-32 28-32s31 10 28 32c-4-12-10-17-28-17S26 32 22 44z" fill={c} /><path d="M70 22c12 2 16 14 12 30-2-10-6-18-14-24z" fill={c} /></>,
  (c) => <path d="M24 40c-1-18 10-26 26-26s27 8 26 26c-4-9-10-13-26-13s-22 4-26 13z" fill={c} opacity=".85" />,
  (c) => <path d="M42 30c-2-12 2-22 8-24 6 2 10 12 8 24-4-3-12-3-16 0zM24 42c0-8 4-13 9-15-2 5-2 10-1 14zM76 42c0-8-4-13-9-15 2 5 2 10 1 14z" fill={c} />,
  (c) => <path d="M18 46c-3-8 0-16 5-19-2-7 4-13 10-12 2-6 10-8 15-4 5-5 14-3 16 3 7-1 13 5 11 12 5 4 7 12 4 20-3-10-8-18-29-18S22 36 18 46z" fill={c} />,
  (c) => <><path d="M26 42c-2-20 8-29 24-29s26 9 24 29c-3-8-6-10-10-12-10 2-22 2-30-2-4 3-6 7-8 14z" fill={c} /><path d="M30 20c8-6 22-8 34-4-10 0-22 2-34 4z" fill="#fff" opacity=".12" /></>,
  (c) => <path d="M18 50c-6-12 2-22 6-25-4-10 6-16 12-11 0-8 12-10 15-3 6-6 16-2 14 6 8-2 14 6 10 13 6 5 8 14 5 22l-8-10c-6-10-12-13-22-13s-18 3-24 12z" fill={c} />,
  (c) => <path d="M22 44c-2-12 2-20 6-24l-6-14 14 8 14-10 14 10 14-8-6 14c4 4 8 12 6 24-5-12-10-16-28-16S27 32 22 44z" fill={c} />,
  (c) => <path d="M21 52c-4-26 8-40 29-40s33 14 29 40c-2-12-6-20-12-24-6 2-10 2-17-2-7 4-11 4-17 2-6 4-10 12-12 24z" fill={c} />,
  (c) => <><path d="M24 42c-1-18 10-27 26-27s27 9 26 27c-4-9-10-13-26-13s-22 4-26 13z" fill={c} /><circle cx="50" cy="11" r="8" fill={c} /></>,
  (c) => <path d="M14 46a36 34 0 1 1 72 0c-4-12-12-20-36-20S18 34 14 46z" fill={c} />,
  (c) => <path d="M23 46c-3-24 9-33 27-33s30 9 27 33c-3-10-6-14-12-17-9 3-21 3-30 0-6 3-9 7-12 17z" fill={c} />,
  () => null,
];
/** Original layered-SVG avatar. NPC looks are generated deterministically from the player's id. */
export function Avatar({ look, size = 64, kit = '#1ea7ff', hair }: { look: Appearance; size?: number; kit?: string; hair?: string }) {
  const skin = SKIN[look.skin % SKIN.length];
  const hc = hair ?? HAIR_COLS[look.hairCol % HAIR_COLS.length];
  const ec = EYE_COLS[look.eyeCol % EYE_COLS.length];
  const ft = look.face % 5;
  const fw = [26, 29, 23, 27, 25][ft];
  const ey = look.eyes % 7;
  const br = look.brows % 5, mo = look.mouth % 6, no = (look.nose ?? 0) % 4, beard = (look.beard ?? 0) % 5, mark = (look.mark ?? 0) % 6, acc = look.acc % 6;
  const earR = [7, 5, 9][(look.ears ?? 0) % 3];
  const streak = STREAK[(look.hair2 ?? 0) % STREAK.length];
  const eyeRy = [4.5, 3, 5.5, 3.8, 3.4, 2.6, 4][ey], eyeRx = [6.5, 6.5, 6.5, 5.5, 6.5, 6.5, 7][ey];
  const face = ft === 3 ? <path d={`M${50 - fw} 44c0-16 10-26 ${fw}-26s${fw} 10 ${fw} 26v10c0 12-10 24-${fw} 24s-${fw}-12-${fw}-24z`} fill={skin} /> : ft === 4 ? <path d={`M${50 - fw} 42c0-15 10-24 ${fw}-24s${fw} 9 ${fw} 24c0 14-8 28-${fw} 37-${fw - 8}-9-${fw}-23-${fw}-37z`} fill={skin} /> : <ellipse cx="50" cy="48" rx={fw} ry="30" fill={skin} />;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Player portrait">
      <rect width="100" height="100" fill={BGS[(look.bg ?? 0) % BGS.length]} />
      <path d="M0 100 30 82h40l30 18z" fill={kit} /><path d="M40 82h20l-10 9z" fill="#fff" opacity=".85" />
      <rect x="43" y="68" width="14" height="16" fill={skin} /><rect x="43" y="74" width="14" height="6" fill="#000" opacity=".12" />
      <ellipse cx={50 - fw} cy="50" rx="4" ry={earR} fill={skin} /><ellipse cx={50 + fw} cy="50" rx="4" ry={earR} fill={skin} />
      {face}
      {beard === 1 && <path d={`M${50 - fw + 3} 58q${fw - 3} 30 ${2 * fw - 6} 0q-2 18-${fw - 3} 20t-${fw - 3}-20z`} fill={hc} opacity=".28" />}
      {beard === 2 && <path d="M43 70q7 12 14 0q-1 8-7 9t-7-9z" fill={hc} />}
      {beard === 3 && <path d={`M${50 - fw + 2} 54q2 26 ${fw - 2} 26t${fw - 2}-26q-6 12-${fw - 2} 12t-${fw - 2}-12z`} fill={hc} />}
      {beard === 4 && <path d="M41 63q9-5 18 0q-9 3-18 0z" fill={hc} />}
      {[-1, 1].map((s) => <g key={s} transform={`translate(${50 + s * 11} 49)`}>
        <ellipse rx={eyeRx} ry={eyeRy} fill="#fff" />
        <circle r={ey === 1 || ey === 5 ? 2.6 : 3.4} fill={ec} /><circle r="1.4" fill="#000" /><circle cx="1.2" cy="-1.2" r=".9" fill="#fff" />
        {(ey === 4 || ey === 6) && <path d={`M${-7 * s} -3 ${7 * s} -6`} stroke="#111" strokeWidth="1.6" />}
        {ey === 5 && <path d="M-7 -1.500h14" stroke={skin} strokeWidth="3.4" />}
        {ey === 6 && <path d={`M${7 * s} 3 ${-4 * s} 4`} stroke="#111" strokeWidth="1" />}
        <path d={br === 0 ? 'M-7 -8h14' : br === 1 ? `M${-7 * s} -6 ${7 * s} -10` : br === 2 ? `M${-7 * s} -10 ${7 * s} -7` : br === 3 ? 'M-7 -8h14' : 'M-7 -8q7 -4 14 0'} stroke={hc === '#e8e8ee' ? '#9aa0ad' : hc} strokeWidth={br === 3 ? 4.2 : br === 4 ? 1.6 : 2.6} strokeLinecap="round" fill="none" />
        {mark === 4 && <path d="M-6 8h12" stroke="#111" strokeWidth="2.6" strokeLinecap="round" />}
      </g>)}
      <path d={['M48 58q2 3 4 0', 'M50 52v6h3', 'M46 58q4 4 8 0', 'M50 52l-3 7h5'][no]} stroke="#000" strokeOpacity=".32" fill="none" strokeWidth="1.4" strokeLinecap="round" />
      <path d={['M43 66q7 4 14 0', 'M43 67h14', 'M43 68q7 -3 14 0', 'M44 65q6 7 12 0z', 'M44 67q8 2 13 -3', 'M45 65q5 8 10 0q-5 -2 -10 0z'][mo]} stroke="#7a2f2f" strokeWidth="2" fill={mo === 3 ? '#fff' : mo === 5 ? '#4a1414' : 'none'} strokeLinecap="round" />
      {mark === 1 && <path d="M62 40l5 13M61 46l7-2" stroke="#b23a48" strokeWidth="1.5" strokeLinecap="round" />}
      {mark === 2 && <g fill="#000" opacity=".25">{[[38, 57], [42, 59], [35, 60], [58, 59], [62, 57], [65, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" />)}</g>}
      {mark === 3 && <rect x="44" y="53" width="12" height="4" rx="1.5" fill="#f1f1f1" />}
      {mark === 5 && <circle cx="60" cy="63" r="1.300" fill="#2b1a12" />}
      {HAIR[look.hair % HAIR.length](hc)}
      {streak && look.hair % HAIR.length !== 15 && <path d="M46 14q10 2 12 16q-8-8-16-9z" fill={streak} opacity=".95" />}
      {acc === 1 && <path d="M22 36h56v5H22z" fill="#fff" opacity=".9" />}
      {acc === 2 && <g fill="none" stroke="#dfe7ff" strokeWidth="1.8"><circle cx="39" cy="49" r="8.5" /><circle cx="61" cy="49" r="8.5" /><path d="M47.500 49h5" /></g>}
      {acc === 3 && <path d="M22 36h56v5H22z" fill={kit} stroke="#fff" strokeWidth=".6" />}
      {acc === 4 && <circle cx={50 + fw + 1} cy={57} r="2.2" fill="#ffd166" stroke="#fff" strokeWidth=".5" />}
      {acc === 5 && <><path d="M20 38q30-12 60 0v-8q-30-12-60 0z" fill="#c1272d" /><path d="M78 34l10 8-9 2z" fill="#c1272d" /></>}
    </svg>
  );
}
export function PlayerAvatar({ g, p, size = 48 }: { g: Game; p: Player; size?: number }) {
  const look = p.id === g.career.pid ? g.career.look : lookFor(p.id);
  const club = p.club ? g.world.clubs[p.club] : null;
  return <Avatar look={look} size={size} kit={club?.col[0] ?? '#31405f'} hair={p.id === g.career.pid ? undefined : p.hair} />;
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
