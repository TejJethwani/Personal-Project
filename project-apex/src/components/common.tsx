import { useId } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { NATIONALITY_BY_CODE } from '@/engine/data/names';
import { driverName, driverShortName } from '@/engine/drivers/ratings';
import type { DivisionId, Driver, GameState, LiveryPattern, Team, TireCompound } from '@/engine/types';
import { useStore } from '@/store/gameStore';
import { cn } from './ui';

export function Flag({ code, className }: { code: string; className?: string }) {
  const n = NATIONALITY_BY_CODE[code];
  return (
    <span title={n?.name ?? code} className={cn('inline-flex h-4 min-w-[2rem] items-center justify-center rounded-sm border border-white/10 bg-white/[0.06] px-1 font-mono text-[9px] font-semibold tracking-wider text-apex-muted', className)}>
      {code}
    </span>
  );
}

export function TeamDot({ team, size = 10 }: { team: Team | undefined | null; size?: number }) {
  if (!team) return <span className="inline-block rounded-sm bg-apex-dim" style={{ width: size, height: size }} />;
  return <span className="inline-block shrink-0 rounded-sm" style={{ width: size, height: size, background: `linear-gradient(135deg, ${team.colors.primary} 55%, ${team.colors.secondary} 55%)`, boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }} />;
}

export function TeamLink({ team, short, className }: { team: Team | undefined | null; short?: boolean; className?: string }) {
  const open = useStore((s) => s.openTeam);
  if (!team) return <span className="text-apex-dim">Free agent</span>;
  return (
    <button onClick={() => open(team.id)} className={cn('inline-flex min-w-0 items-center gap-1.5 text-left hover:text-white hover:underline', team.isPlayer ? 'font-semibold text-white' : 'text-white/85', className)}>
      <TeamDot team={team} />
      <span className="truncate">{short ? team.shortName : team.name}</span>
    </button>
  );
}

export function DriverLink({ driver, short, className, flag = true }: { driver: Driver | undefined | null; short?: boolean; className?: string; flag?: boolean }) {
  const open = useStore((s) => s.openDriver);
  if (!driver) return <span className="text-apex-dim">—</span>;
  return (
    <button onClick={() => open(driver.id)} className={cn('inline-flex min-w-0 items-center gap-1.5 text-left hover:underline', className)}>
      {flag && <Flag code={driver.nationality} />}
      <span className="truncate">{short ? driverShortName(driver) : driverName(driver)}</span>
    </button>
  );
}

export function DivisionBadge({ division, className }: { division: DivisionId; className?: string }) {
  const tier = DIVISIONS[division].tier;
  const colors = ['#64748b', '#0ea5e9', '#22c55e', '#f59e0b', '#e10600'];
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 font-display text-xs font-bold tracking-wider text-white', className)} style={{ background: `${colors[tier]}33`, boxShadow: `inset 0 0 0 1px ${colors[tier]}88` }}>
      {DIVISIONS[division].short ?? division}
    </span>
  );
}

export function TireIcon({ compound, size = 18, wear }: { compound: TireCompound; size?: number; wear?: number }) {
  const info = TIRE_TUNING.compounds[compound];
  const letter = info.label[0];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold" title={`${info.label}${wear !== undefined ? ` · ${Math.round(wear)}% worn` : ''}`} style={{ width: size, height: size, border: `2px solid ${info.color}`, color: info.color, fontSize: size * 0.55, background: '#0b0c0f' }}>
      {letter}
    </span>
  );
}

export function FormDots({ form }: { form: number[] }) {
  return (
    <span className="inline-flex gap-0.5">
      {form.slice(-5).map((p, i) => (
        <span key={i} className={cn('inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold', p === 1 ? 'bg-yellow-400 text-black' : p <= 3 ? 'bg-emerald-500/80 text-black' : p <= 10 ? 'bg-white/15 text-white' : p >= 25 ? 'bg-red-700/70 text-white' : 'bg-white/5 text-apex-muted')}>
          {p >= 25 ? '×' : p}
        </span>
      ))}
    </span>
  );
}

export function Delta({ value, digits = 0, invert = false, suffix = '' }: { value: number; digits?: number; invert?: boolean; suffix?: string }) {
  const good = invert ? value < 0 : value > 0;
  if (Math.abs(value) < 10 ** -digits / 2) return <span className="text-apex-muted">–</span>;
  return (
    <span className={good ? 'text-emerald-400' : 'text-red-400'}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  );
}

/** Side-profile racing car with the team's livery. */
export function CarLivery({ primary, secondary, pattern, number, className, width = 260 }: { primary: string; secondary: string; pattern: LiveryPattern; number?: string | number; className?: string; width?: number }) {
  const id = useId().replace(/:/g, '');
  const body = 'M14 50 L40 46 L70 44 L96 34 L132 30 L150 22 L162 22 L170 31 L206 34 L228 38 L246 42 L250 50 L246 54 L14 56 Z';
  return (
    <svg viewBox="0 0 260 80" width={width} className={className} role="img" aria-label="Car livery preview">
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d={body} />
        </clipPath>
        <linearGradient id={`fade-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="1" stopColor={secondary} />
        </linearGradient>
        <linearGradient id={`shine-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="68" rx="118" ry="5" fill="#000" opacity="0.5" />
      {/* rear wing */}
      <rect x="236" y="20" width="16" height="5" rx="1" fill={secondary} />
      <rect x="240" y="24" width="4" height="22" fill="#1a1a1a" />
      {/* front wing */}
      <rect x="4" y="52" width="34" height="5" rx="1.5" fill={secondary} />
      <g clipPath={`url(#clip-${id})`}>
        <rect x="0" y="0" width="260" height="80" fill={pattern === 'fade' ? `url(#fade-${id})` : primary} />
        {pattern === 'stripe' && <rect x="0" y="40" width="260" height="6" fill={secondary} />}
        {pattern === 'split' && <rect x="130" y="0" width="130" height="80" fill={secondary} />}
        {pattern === 'arrow' && <path d="M0 58 L120 58 L170 30 L190 30 L140 58 L260 58 L260 80 L0 80 Z" fill={secondary} />}
        {pattern === 'halo' && (
          <>
            <path d="M0 48 L60 48 L60 56 L0 56 Z" fill={secondary} />
            <path d="M140 18 L180 18 L190 40 L150 40 Z" fill={secondary} />
          </>
        )}
        {pattern === 'solid' && <rect x="0" y="53" width="260" height="3" fill={secondary} />}
        <rect x="0" y="0" width="260" height="80" fill={`url(#shine-${id})`} />
      </g>
      {/* cockpit / halo */}
      <path d="M140 30 Q152 18 168 26" stroke="#0d0d0d" strokeWidth="4" fill="none" />
      <circle cx="155" cy="27" r="4.5" fill="#f5c542" stroke="#111" strokeWidth="1" />
      {number !== undefined && (
        <text x="110" y="47" fill={secondary} fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="12" textAnchor="middle">
          {number}
        </text>
      )}
      {/* wheels */}
      {[52, 214].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="54" r="13" fill="#111" stroke="#2a2a2a" strokeWidth="2" />
          <circle cx={cx} cy="54" r="5" fill="#3a3a3a" />
        </g>
      ))}
    </svg>
  );
}

export function TeamCar({ team, width }: { team: Team; width?: number }) {
  return <CarLivery primary={team.colors.primary} secondary={team.colors.secondary} pattern={team.livery} number={team.shortName} width={width} />;
}

export function teamById(state: GameState, id: string | null | undefined): Team | null {
  return id ? state.teams[id] ?? null : null;
}
