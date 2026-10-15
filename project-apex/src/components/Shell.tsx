import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CarFront,
  ChevronRight,
  Flag as FlagIcon,
  History,
  LayoutDashboard,
  Loader2,
  Newspaper,
  Settings,
  Trophy,
  UserSearch,
  Users,
  Wallet,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { teamPosition } from '@/engine/championship/standings';
import { advanceBlocker, advanceToNextEvent, advanceWeek } from '@/engine/season/advance';
import { nextEventFor } from '@/engine/season/calendar';
import { playerTeam } from '@/engine/selectors';
import { money, ordinal, weekLabel } from '@/lib/format';
import { useGame, useStore, type Page } from '@/store/gameStore';
import { DivisionBadge, TeamDot } from './common';
import { Button, cn } from './ui';

const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'hq', label: 'Headquarters', icon: LayoutDashboard },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'market', label: 'Driver Market', icon: UserSearch },
  { id: 'car', label: 'Car Development', icon: CarFront },
  { id: 'race', label: 'Race Center', icon: FlagIcon },
  { id: 'championship', label: 'Championship', icon: Trophy },
  { id: 'finances', label: 'Finances', icon: Wallet },
  { id: 'staff', label: 'Staff & Facilities', icon: Building2 },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function useContinue(): { label: string; hint: string; run: () => void; disabled: boolean; fast?: () => void } {
  const game = useGame();
  const act = useStore((s) => s.act);
  const setPage = useStore((s) => s.setPage);
  const team = playerTeam(game);
  const blocker = advanceBlocker(game);
  const afterAdvance = (stopped: string) => {
    if (stopped === 'race') setPage('race');
    if (stopped === 'seasonEnd') setPage('seasonReview');
  };
  switch (game.phase) {
    case 'weekend':
      return { label: 'Race Weekend', hint: 'Go to the Race Center', run: () => setPage('race'), disabled: false };
    case 'seasonReview':
      return { label: 'Season Review', hint: 'Review the season and continue', run: () => setPage('seasonReview'), disabled: false };
    case 'gameOver':
      return { label: 'Career Over', hint: game.player.gameOverReason ?? '', run: () => setPage('hq'), disabled: true };
    case 'offseason':
      return {
        label: 'Next Week',
        hint: blocker ?? 'Advance the off-season transfer window by one week',
        disabled: !!blocker,
        run: () => act((g) => afterAdvance(advanceWeek(g).stoppedFor)),
      };
    case 'preseason':
      return {
        label: 'Start Season',
        hint: blocker ?? `Begin the ${DIVISIONS[team.division].name} season`,
        disabled: !!blocker,
        run: () => act((g) => afterAdvance(advanceWeek(g).stoppedFor)),
      };
    default: {
      const ev = nextEventFor(game, team.division);
      return {
        label: ev ? 'Advance to Race' : 'Continue',
        hint: blocker ?? (ev ? `Simulate to ${game.circuits[ev.circuitId].location} (week ${ev.week})` : 'Advance one week'),
        disabled: !!blocker,
        run: () => act((g) => afterAdvance(advanceToNextEvent(g).stoppedFor)),
        fast: () => act((g) => afterAdvance(advanceWeek(g).stoppedFor)),
      };
    }
  }
}

function ContinueButton() {
  const c = useContinue();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void) => {
    setBusy(true);
    // Let the spinner paint before the (synchronous) simulation runs.
    setTimeout(() => {
      fn();
      setBusy(false);
    }, 20);
  };
  return (
    <div className="flex items-center gap-1.5">
      {c.fast && (
        <Button variant="secondary" size="md" disabled={c.disabled || busy} title="Advance a single week" onClick={() => run(c.fast!)}>
          +1 Week
        </Button>
      )}
      <Button variant="primary" size="lg" disabled={c.disabled || busy} title={c.hint} onClick={() => run(c.run)} className="min-w-[170px]">
        {busy ? <Loader2 className="animate-spin" size={16} /> : null}
        {c.label}
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}

function TopBar() {
  const game = useGame();
  const team = playerTeam(game);
  const ev = nextEventFor(game, team.division);
  const pos = teamPosition(game, team.id);
  const c = useContinue();
  return (
    <header className="sticky top-0 z-30 border-b border-apex-line bg-apex-bg/95 backdrop-blur">
      <div className="flex h-16 items-center gap-5 px-5">
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-apex-red font-display text-lg font-black">A</div>
          <div className="hidden font-display text-lg font-black uppercase tracking-[0.18em] lg:block">
            Project <span className="text-apex-red">Apex</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 border-l border-apex-line pl-5">
          <TeamDot team={team} size={14} />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold uppercase tracking-wide">{team.name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-apex-muted">
              <DivisionBadge division={team.division} /> Season {game.season} · {game.year} · {weekLabel(game.season, game.week)}
            </div>
          </div>
        </div>
        <div className="ml-auto hidden items-center gap-6 xl:flex">
          <TopStat label="Budget" value={money(team.cash)} tone={team.cash < 0 ? 'text-red-400' : undefined} />
          <TopStat label="Reputation" value={`${Math.round(team.reputation)}`} />
          <TopStat label="Championship" value={game.phase === 'season' || game.phase === 'weekend' ? `P${pos}` : '—'} />
          <TopStat label="Next race" value={ev ? <span className="inline-block max-w-[180px] truncate align-bottom">{game.circuits[ev.circuitId].name.replace(/^(Circuit|Autodromo|Autódromo|Circuito) (de |do |di |of |del )?/i, '')}</span> : '—'} sub={ev ? (ev.week - game.week <= 0 ? 'This week' : `in ${ev.week - Math.max(0, game.week)} wk`) : undefined} />
        </div>
        <div className="ml-auto xl:ml-4" title={c.hint}>
          <ContinueButton />
        </div>
      </div>
      {c.disabled && game.phase !== 'gameOver' && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-1.5 text-xs text-amber-200">{c.hint}</div>
      )}
    </header>
  );
}

function TopStat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="text-right">
      <div className="label">{label}</div>
      <div className={cn('num text-lg font-bold leading-tight', tone)}>
        {value}
        {sub && <span className="ml-1 font-sans text-[11px] font-normal text-apex-muted">{sub}</span>}
      </div>
    </div>
  );
}

function Sidebar() {
  const game = useGame();
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const unread = game.news.filter((n) => !n.read && n.importance >= 2).length;
  return (
    <nav className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 flex-col border-r border-apex-line bg-apex-bg py-4 md:flex">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = page === item.id || (item.id === 'hq' && page === 'seasonReview');
        const pulse = item.id === 'race' && game.phase === 'weekend';
        return (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={cn('group relative mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors', active ? 'bg-white/[0.06] text-white' : 'text-apex-muted hover:bg-white/[0.03] hover:text-white')}
          >
            {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-apex-red" />}
            <Icon size={17} className={cn(active ? 'text-apex-red' : 'text-apex-dim group-hover:text-white', pulse && 'animate-pulseRed text-apex-red')} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'news' && unread > 0 && <span className="rounded bg-apex-red px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            {pulse && <span className="rounded bg-apex-red px-1.5 text-[10px] font-bold uppercase text-white">Live</span>}
          </button>
        );
      })}
      <div className="mt-auto px-5 pt-4 text-[10px] leading-relaxed text-apex-dim">
        {ordinal(game.player.seasonsPlayed + 1)} season in charge
        <br />
        {game.player.principalName}
      </div>
    </nav>
  );
}

function MobileNav() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-apex-line px-3 py-2 md:hidden">
      {NAV.map((n) => (
        <button key={n.id} onClick={() => setPage(n.id)} className={cn('whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold', page === n.id ? 'bg-apex-red text-white' : 'text-apex-muted')}>
          {n.label}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            onClick={() => dismiss(t.id)}
            className={cn(
              'pointer-events-auto cursor-pointer rounded-lg border px-4 py-3 text-sm shadow-panel backdrop-blur',
              t.kind === 'error' && 'border-red-800/70 bg-red-950/90 text-red-100',
              t.kind === 'success' && 'border-emerald-700/60 bg-emerald-950/90 text-emerald-100',
              t.kind === 'info' && 'border-apex-line2 bg-apex-panel/95 text-white',
            )}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function GameShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-apex-bg bg-carbon">
      <TopBar />
      <MobileNav />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
