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

const SKIN = ['#f6d7bd', '#eec39a', '#d9a273', '#b9794c', '#8b5a36', '#5c3a22'];
export const HAIR_COLS = ['#141414', '#3b2a1e', '#7a4a22', '#c58a3c', '#e9d27a', '#e8e8ee', '#c1272d', '#1e6bd6', '#2a9d8f', '#d14c9a'];
const EYE_COLS = ['#2b2b2b', '#5a3a1e', '#1e6bd6', '#2a9d8f', '#8a8f98', '#b3122f'];
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
];
/** Original layered-SVG avatar. NPC looks are generated deterministically from the player's id. */
export function Avatar({ look, size = 64, kit = '#1ea7ff', hair }: { look: Appearance; size?: number; kit?: string; hair?: string }) {
  const skin = SKIN[look.skin % SKIN.length];
  const hc = hair ?? HAIR_COLS[look.hairCol % HAIR_COLS.length];
  const ec = EYE_COLS[look.eyeCol % EYE_COLS.length];
  const fw = [26, 28, 24][look.face % 3];
  const ey = look.eyes % 5;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Player portrait">
      <rect width="100" height="100" fill="#0a1122" />
      <path d="M0 100 30 82h40l30 18z" fill={kit} /><path d="M40 82h20l-10 9z" fill="#fff" opacity=".85" />
      <rect x="43" y="68" width="14" height="16" fill={skin} /><rect x="43" y="74" width="14" height="6" fill="#000" opacity=".12" />
      <ellipse cx="50" cy="48" rx={fw} ry="30" fill={skin} />
      <ellipse cx={50 - fw} cy="50" rx="4" ry="7" fill={skin} /><ellipse cx={50 + fw} cy="50" rx="4" ry="7" fill={skin} />
      {[-1, 1].map((s) => <g key={s} transform={`translate(${50 + s * 11} 49)`}>
        <ellipse rx={ey === 3 ? 5.5 : 6.5} ry={ey === 0 ? 4.5 : ey === 1 ? 3 : ey === 2 ? 5.5 : 3.8} fill="#fff" />
        <circle r={ey === 1 ? 2.8 : 3.4} fill={ec} /><circle r="1.4" fill="#000" /><circle cx="1.2" cy="-1.2" r=".9" fill="#fff" />
        {ey === 4 && <path d={`M${-7 * s} -3 ${7 * s} -6`} stroke="#111" strokeWidth="1.6" />}
        <path d={look.brows % 3 === 0 ? `M-7 -8h14` : look.brows % 3 === 1 ? `M${-7 * s} -6 ${7 * s} -10` : `M${-7 * s} -10 ${7 * s} -7`} stroke={hc} strokeWidth="2.6" strokeLinecap="round" />
      </g>)}
      <path d="M48 58q2 3 4 0" stroke="#000" strokeOpacity=".3" fill="none" strokeWidth="1.4" />
      <path d={['M43 66q7 4 14 0', 'M43 67h14', 'M43 68q7 -3 14 0', 'M44 65q6 7 12 0z'][look.mouth % 4]} stroke="#7a2f2f" strokeWidth="2" fill={look.mouth % 4 === 3 ? '#fff' : 'none'} strokeLinecap="round" />
      {HAIR[look.hair % HAIR.length](hc)}
      {look.acc === 1 && <path d="M22 36h56v5H22z" fill="#fff" opacity=".9" />}
      {look.acc === 2 && <g fill="none" stroke="#dfe7ff" strokeWidth="1.8"><circle cx="39" cy="49" r="8.5" /><circle cx="61" cy="49" r="8.5" /><path d="M47.500 49h5" /></g>}
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
