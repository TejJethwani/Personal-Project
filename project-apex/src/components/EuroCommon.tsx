import type { CalendarEvent, EuroFixture, EuroTie, GameState, RaceState } from '@/engine/types';
import { stageLabel } from '@/engine/europe/fixtures';
import { useStore } from '@/store/gameStore';
import { cn } from './ui';

/** A club's name with its colours; full teams open their profile. */
export function ClubName({ game, clubId, short, className, showAssoc = true }: { game: GameState; clubId: string | null | undefined; short?: boolean; className?: string; showAssoc?: boolean }) {
  const openTeam = useStore((s) => s.openTeam);
  const club = clubId ? game.europe?.clubs[clubId] : null;
  if (!club) return <span className="text-apex-dim">TBD</span>;
  const team = club.teamId ? game.teams[club.teamId] : null;
  const mine = team?.isPlayer;
  const body = (
    <>
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: club.colors.primary, boxShadow: `inset 0 0 0 1px ${club.colors.secondary}` }} />
      <span className={cn('truncate', mine && 'font-bold text-white')}>{short ? club.short : club.name}</span>
      {showAssoc && <span className="shrink-0 text-[10px] text-apex-dim">{club.assocId}</span>}
    </>
  );
  if (team && !team.guest)
    return (
      <button className={cn('inline-flex min-w-0 items-center gap-1.5 text-left hover:text-white hover:underline', className)} onClick={() => openTeam(team.id)}>
        {body}
      </button>
    );
  return <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>{body}</span>;
}

export function fixtureScore(fx: EuroFixture | undefined): string {
  if (!fx?.result) return '–';
  return `${fx.result.home}–${fx.result.away}`;
}

/** One knockout tie: legs, aggregate, extra race and shoot-out. */
export function TieRow({ game, tie, highlight }: { game: GameState; tie: EuroTie; highlight?: string }) {
  const europe = game.europe!;
  const fxs = tie.fixtures.map((id) => europe.fixtures[id]);
  const decider = tie.decider ? europe.fixtures[tie.decider] : null;
  const involved = highlight && (tie.home === highlight || tie.away === highlight);
  const openResult = useStore((s) => s.openResult);
  const legText = fxs.map((f, i) => (
    <button key={f.id} disabled={!f.eventId || !f.result} onClick={() => f.eventId && openResult(f.eventId)} className={cn('num', f.eventId && f.result && 'underline decoration-dotted hover:text-white')} title={`${fxs.length > 1 ? `Leg ${i + 1}` : 'Race'} · week ${f.week}${f.home === tie.home ? '' : ' (reverse venue)'}`}>
      {f.result ? (f.home === tie.home ? `${f.result.home}–${f.result.away}` : `${f.result.away}–${f.result.home}`) : `wk ${f.week}`}
    </button>
  ));
  return (
    <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', involved ? 'border-apex-red/50 bg-apex-red/[0.06]' : 'border-apex-line bg-apex-bg/40')}>
      <ClubName game={game} clubId={tie.home} className={cn(tie.winner === tie.home && 'font-semibold text-white', tie.winner && tie.winner !== tie.home && 'text-apex-dim')} />
      <div className="flex flex-col items-center text-[11px] text-apex-muted">
        <div className="flex gap-2">{legText}</div>
        {fxs.length > 1 && fxs.every((f) => f.result) && <div className="num text-xs font-bold text-white">agg {tie.aggregate[0]}–{tie.aggregate[1]}</div>}
        {decider && <div className="text-amber-300">extra race {decider.result ? (decider.home === tie.home ? `${decider.result.home}–${decider.result.away}` : `${decider.result.away}–${decider.result.home}`) : 'pending'}</div>}
        {tie.shootout && <div className="text-amber-300">shoot-out</div>}
      </div>
      <div className="flex justify-end">
        <ClubName game={game} clubId={tie.away} className={cn('justify-end', tie.winner === tie.away && 'font-semibold text-white', tie.winner && tie.winner !== tie.away && 'text-apex-dim')} />
      </div>
    </div>
  );
}

export function StageHeading({ stage, weeks }: { stage: string; weeks?: string }) {
  return (
    <div className="label mb-1.5 mt-3 flex items-center justify-between first:mt-0">
      <span>{stageLabel(stage)}</span>
      {weeks && <span className="normal-case tracking-normal text-apex-dim">{weeks}</span>}
    </div>
  );
}

/** Head-to-head context for a cup or continental race: who, which stage, the tie so far. */
export function H2HBanner({ game, event }: { game: GameState; event: CalendarEvent }) {
  const europe = game.europe;
  const fx = europe && event.euro?.fixtureId ? europe.fixtures[event.euro.fixtureId] : null;
  if (!europe || !fx) return null;
  const tie = fx.tieId ? europe.ties[fx.tieId] : null;
  const pc = game.teams[game.player.teamId]?.clubId;
  const first = tie && tie.fixtures.length > 1 ? europe.fixtures[tie.fixtures[0]] : null;
  let note = fx.stage === 'league' ? `League phase, matchday ${fx.matchday}: 3 points for a win, 1 for a draw.` : '';
  if (fx.kind === 'leg1') note = 'First leg. The tie is decided on aggregate race points over both legs.';
  if (fx.kind === 'leg2' && first?.result && tie) {
    const [a, b] = [tie.home === first.home ? first.result.home : first.result.away, tie.home === first.home ? first.result.away : first.result.home];
    note = `Second leg. First leg: ${europe.clubs[tie.home].short} ${a}–${b} ${europe.clubs[tie.away].short}.`;
  }
  if (fx.kind === 'single') note = 'Single race. A draw on race points goes to an extra race, then a qualifying shoot-out.';
  if (fx.kind === 'decider' && tie) note = `Extra race: the tie is level at ${tie.aggregate[0]}–${tie.aggregate[1]}. A draw here is settled by the fastest lap in qualifying.`;
  return (
    <div className="rounded-xl border border-sky-400/30 bg-sky-400/[0.05] p-3">
      <div className="label mb-2 text-sky-300">{event.euro?.label}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ClubName game={game} clubId={fx.home} className={cn('font-display text-lg font-bold uppercase', fx.home === pc && 'text-white')} />
        <span className="num rounded bg-white/[0.06] px-3 py-1 text-lg font-black">{fx.result ? `${fx.result.home}–${fx.result.away}` : 'v'}</span>
        <div className="flex justify-end">
          <ClubName game={game} clubId={fx.away} className={cn('font-display text-lg font-bold uppercase', fx.away === pc && 'text-white')} />
        </div>
      </div>
      <p className="mt-2 text-xs text-apex-muted">{note} Each car scores 4-3-2-1 by finishing position; a retirement scores nothing.</p>
    </div>
  );
}

/** Live race points of each side in a head-to-head race. */
export function liveH2HScore(event: CalendarEvent, race: RaceState): { home: number; away: number } | null {
  if (event.pointsPreset !== 'h2h' || !event.teamIds) return null;
  const order = [...race.cars].sort((a, b) => a.position - b.position);
  let home = 0;
  let away = 0;
  let rank = 0;
  for (const c of order) {
    if (c.status !== 'running') continue;
    const pts = [4, 3, 2, 1][rank++] ?? 0;
    if (c.teamId === event.teamIds[0]) home += pts;
    else away += pts;
  }
  return { home, away };
}

export function H2HLiveScore({ game, event, race }: { game: GameState; event: CalendarEvent; race: RaceState }) {
  const score = liveH2HScore(event, race);
  const fx = game.europe && event.euro?.fixtureId ? game.europe.fixtures[event.euro.fixtureId] : null;
  if (!score || !fx) return null;
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-sky-400/30 bg-sky-400/[0.06] px-3 py-2 text-sm">
      <ClubName game={game} clubId={fx.home} short />
      <span className="num text-xl font-black">
        {score.home}–{score.away}
      </span>
      <ClubName game={game} clubId={fx.away} short />
      <span className="text-[11px] text-apex-muted">{race.finished ? 'final' : 'if the race ended now'}</span>
    </div>
  );
}
