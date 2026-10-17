import { Globe2, Medal, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { associationRanking, clubCoefficient, sum } from '@/engine/europe/coefficients';
import { berthsForRank, leaguePhaseTable, playerReached } from '@/engine/europe/continental';
import { ASSOCIATION_BY_ID, CONTINENTAL } from '@/engine/europe/data';
import { competitionName, playerClubId, stageLabel } from '@/engine/europe/fixtures';
import { liteTable } from '@/engine/europe/leagues';
import { EURO_WEEKS } from '@/engine/europe/schedule';
import { nextPlayerEvent } from '@/engine/europe/season';
import { divisionStandings } from '@/engine/championship/standings';
import { levelOfDivision } from '@/engine/config/ruleset';
import { DIVISIONS } from '@/engine/config/divisions';
import type { CalendarEvent, ContinentalCompetition, ContinentalState, CupState, EuroHonour, GameState } from '@/engine/types';
import { ClubName, StageHeading, TieRow } from '@/components/EuroCommon';
import { Badge, cn, Empty, Panel, SectionTitle, Segmented, Tabs } from '@/components/ui';
import { useGame, useStore } from '@/store/gameStore';

type Tab = 'overview' | ContinentalCompetition | 'cups' | 'associations' | 'honours';

export function EuropePage() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>('overview');
  if (!game.europe) return <Empty>European competitions belong to European League careers.</Empty>;
  return (
    <div className="space-y-5">
      <SectionTitle sub="Domestic cups and the three continental competitions. Head-to-head races score 4-3-2-1 per car. Knockout ties go to aggregate race points, then an extra race, then a qualifying shoot-out.">Europe &amp; Cups</SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'CL', label: 'Champions League' },
          { id: 'EL', label: 'Europa League' },
          { id: 'ECL', label: 'Conference League' },
          { id: 'cups', label: 'Domestic cups' },
          { id: 'associations', label: 'Coefficients' },
          { id: 'honours', label: 'Honours' },
        ]}
      />
      {tab === 'overview' && <Overview game={game} />}
      {(tab === 'CL' || tab === 'EL' || tab === 'ECL') && <CompetitionView game={game} id={tab} />}
      {tab === 'cups' && <CupsView game={game} />}
      {tab === 'associations' && <AssociationsView game={game} />}
      {tab === 'honours' && <HonoursView game={game} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function compStatus(game: GameState, comp: ContinentalState): string {
  const pc = playerClubId(game)!;
  const reached = playerReached(game, comp);
  if (!reached) return '';
  if (comp.stage === 'done') return reached === 'Winners' ? 'Winners!' : `Reached: ${reached}`;
  const europe = game.europe!;
  const stillIn = (() => {
    if (comp.stage === 'qualifying') return comp.qualifyingPool.includes(pc) || comp.direct.includes(pc);
    if (comp.stage === 'league') return comp.teams.includes(pc);
    const ties = comp.knockout[comp.stage as 'playoff'];
    return ties?.some((id) => [europe.ties[id].home, europe.ties[id].away].includes(pc) && europe.ties[id].winner !== (europe.ties[id].home === pc ? europe.ties[id].away : europe.ties[id].home));
  })();
  if (comp.stage === 'league' && comp.teams.includes(pc) && comp.fixtures.length) {
    const table = leaguePhaseTable(game, comp);
    const i = table.findIndex((r) => r.clubId === pc);
    return `League phase · P${i + 1} (${table[i].points} pts from ${table[i].played})`;
  }
  return stillIn ? `In the ${stageLabel(comp.stage === 'league' ? 'league' : comp.stage)}` : `Out: ${reached}`;
}

function eventLine(game: GameState, e: CalendarEvent) {
  const circuit = game.circuits[e.circuitId];
  const label = e.euro?.label ?? `${DIVISIONS[e.division].name} · Round ${e.round}`;
  const fx = e.euro?.fixtureId ? game.europe!.fixtures[e.euro.fixtureId] : null;
  const pc = playerClubId(game);
  return (
    <div key={e.id} className="flex items-center gap-3 border-b border-apex-line/60 py-1.5 text-sm last:border-0">
      <span className="num w-12 text-apex-muted">Wk {e.week}</span>
      <span className="min-w-0 flex-1 truncate">
        {label}
        {fx && pc && (
          <span className="text-apex-muted">
            {' '}
            · {fx.home === pc ? 'v' : '@'} <ClubName game={game} clubId={fx.home === pc ? fx.away : fx.home} />
          </span>
        )}
      </span>
      <span className="hidden truncate text-xs text-apex-muted sm:block">{circuit.location}</span>
    </div>
  );
}

function Overview({ game }: { game: GameState }) {
  const europe = game.europe!;
  const pc = playerClubId(game);
  const team = game.teams[game.player.teamId];
  const ranking = associationRanking(game);
  const rank = ranking.indexOf(europe.playerAssocId) + 1;
  const assoc = ASSOCIATION_BY_ID[europe.playerAssocId];
  const upcoming = useMemo(() => {
    const all = [...game.calendars[team.division], ...europe.events.filter((e) => e.teamIds?.includes(team.id))].filter((e) => !e.completed);
    return all.sort((a, b) => a.week - b.week || (a.euro?.competition === 'league' ? 1 : 0) - (b.euro?.competition === 'league' ? 1 : 0)).slice(0, 10);
  }, [game, team, europe.events]);
  const next = nextPlayerEvent(game);
  const mine = (['CL', 'EL', 'ECL'] as const).map((id) => europe.continental[id]).filter((c): c is ContinentalState => !!c && !!playerReached(game, c));
  const cups = Object.values(europe.cups).filter((c) => pc && c.entrants.includes(pc));
  const domesticInEurope = (['CL', 'EL', 'ECL'] as const).flatMap((id) => {
    const c = europe.continental[id];
    if (!c) return [];
    return [...new Set([...c.direct, ...c.qualifyingPool, ...c.teams])].filter((cid) => europe.clubs[cid]?.assocId === europe.playerAssocId).map((cid) => ({ cid, comp: c }));
  });
  const places = berthsForRank(rank);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <Panel title="Your competitions" icon={<Trophy size={15} className="text-apex-red" />}>
          {mine.length === 0 && cups.length === 0 ? (
            <p className="text-sm text-apex-muted">Your team is not in Europe this season. Finish high in the {DIVISIONS.F1.name} or win the {assoc.cupName} to qualify.</p>
          ) : (
            <div className="space-y-2">
              {mine.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-apex-line px-3 py-2" style={{ borderLeft: `3px solid ${CONTINENTAL[c.id].color}` }}>
                  <span className="font-semibold">{CONTINENTAL[c.id].name}</span>
                  <span className="text-right text-sm text-apex-muted">{compStatus(game, c)}</span>
                </div>
              ))}
              {cups.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-apex-line px-3 py-2">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-right text-sm text-apex-muted">{c.winner ? (c.winner === pc ? 'Winners!' : c.alive.includes(pc!) ? 'Final' : 'Knocked out') : c.alive.includes(pc!) ? `Still in · next round week ${c.weeks[Math.min(c.rounds.length, c.weeks.length - 1)]}` : 'Knocked out'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Your race calendar" actions={next ? <Badge tone="red">Next: week {next.week}</Badge> : undefined}>
          {upcoming.length ? upcoming.map((e) => eventLine(game, e)) : <p className="text-sm text-apex-muted">No races left this season.</p>}
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title={`${assoc.name} in Europe`} icon={<Globe2 size={15} className="text-sky-400" />}>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-apex-muted">Coefficient ranking</span>
            <span className="font-display text-3xl font-black">#{rank}</span>
          </div>
          <div className="mb-3 text-xs text-apex-muted">
            Places for next season:{' '}
            {(['CL', 'EL', 'ECL'] as const)
              .map((c) => {
                const n = places.filter((p) => p.comp === c);
                return n.length ? `${CONTINENTAL[c].short} ${n.length}${n.some((p) => !p.direct) ? ' (incl. qualifying)' : ''}` : null;
              })
              .filter(Boolean)
              .join(' · ')}
          </div>
          {domesticInEurope.length ? (
            <div className="space-y-1">
              {domesticInEurope.map(({ cid, comp }) => (
                <div key={`${comp.id}-${cid}`} className="flex items-center justify-between gap-2 text-sm">
                  <ClubName game={game} clubId={cid} showAssoc={false} />
                  <span className="text-xs text-apex-muted">
                    {CONTINENTAL[comp.id].short} · {comp.winner === cid ? 'Winners' : playerReachedFor(game, comp, cid)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-apex-muted">No clubs in Europe yet this season.</p>
          )}
        </Panel>
        <Panel title="Season dates">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-apex-muted">
            <span>Super cups</span>
            <span className="num text-right">weeks {EURO_WEEKS.superCup}–{EURO_WEEKS.europeanSuperCup}</span>
            <span>European qualifying</span>
            <span className="num text-right">weeks {EURO_WEEKS.qualifying.join(', ')}</span>
            <span>League phase</span>
            <span className="num text-right">weeks {EURO_WEEKS.leaguePhase[0]}–{EURO_WEEKS.leaguePhase[7]}</span>
            <span>Knockout play-offs</span>
            <span className="num text-right">weeks {EURO_WEEKS.playoff.join(', ')}</span>
            <span>Round of 16 · QF · SF</span>
            <span className="num text-right">weeks {EURO_WEEKS.r16[0]}–{EURO_WEEKS.sf[1]}</span>
            <span>Finals</span>
            <span className="num text-right">week {EURO_WEEKS.final}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function playerReachedFor(game: GameState, comp: ContinentalState, clubId: string): string {
  const europe = game.europe!;
  if (comp.runnerUp === clubId) return 'Final';
  for (const stage of ['final', 'sf', 'qf', 'r16', 'playoff'] as const) {
    const tie = comp.knockout[stage].map((id) => europe.ties[id]).find((t) => t.home === clubId || t.away === clubId);
    if (tie) return tie.winner && tie.winner !== clubId ? `Out in ${stageLabel(stage)}` : stageLabel(stage);
  }
  if (!comp.teams.length && comp.direct.includes(clubId)) return 'Direct to league phase';
  if (comp.teams.includes(clubId)) {
    if (comp.fixtures.length) {
      const pos = leaguePhaseTable(game, comp).findIndex((r) => r.clubId === clubId) + 1;
      return `League phase P${pos}`;
    }
    return 'League phase';
  }
  return comp.qualifyingPool.includes(clubId) ? (comp.stage === 'qualifying' ? 'In qualifying' : 'Qualifying') : 'Out in qualifying';
}

// ---------------------------------------------------------------------------

function CompetitionView({ game, id }: { game: GameState; id: ContinentalCompetition }) {
  const comp = game.europe!.continental[id];
  const [view, setView] = useState<'table' | 'matchdays' | 'knockout' | 'qualifying'>(() => (comp?.stage === 'qualifying' ? 'qualifying' : comp && ['playoff', 'r16', 'qf', 'sf', 'final', 'done'].includes(comp.stage) ? 'knockout' : 'table'));
  if (!comp) return <Empty>This competition starts with the season.</Empty>;
  const cfg = CONTINENTAL[id];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: cfg.color }} />
          <span className="font-display text-2xl font-black uppercase">{cfg.name}</span>
          {comp.winner && (
            <Badge tone="amber">
              Winners: <ClubName game={game} clubId={comp.winner} />
            </Badge>
          )}
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'qualifying', label: 'Qualifying' },
            { value: 'table', label: 'League phase' },
            { value: 'matchdays', label: 'Matchdays' },
            { value: 'knockout', label: 'Knockouts' },
          ]}
        />
      </div>
      <p className="text-xs text-apex-muted">
        36 clubs. Each plays {cfg.opponents} different opponents ({cfg.opponents / 2} at home, {cfg.opponents / 2} away), drawn from {cfg.pots} seeded pots. Positions 1–8 go to the Round of 16, 9–24 play two-legged knockout play-offs, and 25–36 are out. The final is a single race at a neutral circuit.
      </p>
      {view === 'qualifying' && <QualifyingView game={game} comp={comp} />}
      {view === 'table' && <LeagueTable game={game} comp={comp} />}
      {view === 'matchdays' && <Matchdays game={game} comp={comp} />}
      {view === 'knockout' && <Knockouts game={game} comp={comp} />}
    </div>
  );
}

function QualifyingView({ game, comp }: { game: GameState; comp: ContinentalState }) {
  const europe = game.europe!;
  const pc = playerClubId(game);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title={`Qualifying · ${comp.qualifiers} places`}>
        {comp.qualifyingRounds.length === 0 ? (
          <p className="text-sm text-apex-muted">No qualifying this season: every place was awarded directly.</p>
        ) : (
          comp.qualifyingRounds.map((round, i) => (
            <div key={i}>
              <StageHeading stage={`Round ${i + 1}`} weeks={`week ${europe.fixtures[europe.ties[round[0]]?.fixtures[0]]?.week ?? '?'}`} />
              <div className="space-y-1">
                {round.map((tid) => (
                  <TieRow key={tid} game={game} tie={europe.ties[tid]} highlight={pc} />
                ))}
              </div>
            </div>
          ))
        )}
      </Panel>
      <Panel title={`Direct entrants (${comp.direct.length})`}>
        <div className="grid gap-1 sm:grid-cols-2">
          {comp.direct.map((cid) => (
            <div key={cid} className="flex items-center justify-between gap-2 text-sm">
              <ClubName game={game} clubId={cid} />
              <span className="num text-[11px] text-apex-dim">{clubCoefficient(game, europe.clubs[cid]).toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function LeagueTable({ game, comp }: { game: GameState; comp: ContinentalState }) {
  const pc = playerClubId(game);
  if (!comp.teams.length || !comp.fixtures.length) return <Empty>The league phase draw is made in week {EURO_WEEKS.leaguePhase[0] - 1}, after qualifying.</Empty>;
  const table = leaguePhaseTable(game, comp);
  const potOf = new Map(comp.pots.flatMap((pot, i) => pot.map((cid) => [cid, i + 1])));
  return (
    <Panel bodyClass="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-apex-muted">
            <tr className="border-b border-apex-line">
              <th className="px-3 py-2">#</th>
              <th className="px-2 py-2">Club</th>
              <th className="px-2 py-2 text-center">Pot</th>
              <th className="px-2 py-2 text-right">P</th>
              <th className="px-2 py-2 text-right">W</th>
              <th className="px-2 py-2 text-right">D</th>
              <th className="px-2 py-2 text-right">L</th>
              <th className="px-2 py-2 text-right">RF</th>
              <th className="px-2 py-2 text-right">RA</th>
              <th className="px-2 py-2 text-right">RD</th>
              <th className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.clubId} className={cn('border-b border-apex-line/50', r.clubId === pc && 'bg-apex-red/[0.08]')}>
                <td className="px-3 py-1.5">
                  <span className={cn('num inline-block w-6 rounded text-center text-xs font-bold', i < 8 ? 'bg-emerald-500/20 text-emerald-300' : i < 24 ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-300')}>{i + 1}</span>
                </td>
                <td className="max-w-[220px] px-2 py-1.5">
                  <ClubName game={game} clubId={r.clubId} />
                </td>
                <td className="num px-2 py-1.5 text-center text-apex-muted">{potOf.get(r.clubId)}</td>
                <td className="num px-2 py-1.5 text-right">{r.played}</td>
                <td className="num px-2 py-1.5 text-right">{r.won}</td>
                <td className="num px-2 py-1.5 text-right">{r.drawn}</td>
                <td className="num px-2 py-1.5 text-right">{r.lost}</td>
                <td className="num px-2 py-1.5 text-right">{r.rf}</td>
                <td className="num px-2 py-1.5 text-right">{r.ra}</td>
                <td className="num px-2 py-1.5 text-right">{r.rf - r.ra > 0 ? `+${r.rf - r.ra}` : r.rf - r.ra}</td>
                <td className="num px-3 py-1.5 text-right font-bold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 px-3 py-2 text-[11px] text-apex-muted">
        <span className="text-emerald-300">■ Round of 16</span>
        <span className="text-amber-200">■ Knockout play-offs</span>
        <span className="text-red-300">■ Eliminated</span>
        <span>Ties: points, race-point difference, race points scored, wins, coefficient.</span>
      </div>
    </Panel>
  );
}

function Matchdays({ game, comp }: { game: GameState; comp: ContinentalState }) {
  const europe = game.europe!;
  const pc = playerClubId(game);
  const openResult = useStore((s) => s.openResult);
  const days = CONTINENTAL[comp.id].opponents;
  const firstOpen = Array.from({ length: days }, (_, i) => i + 1).find((d) => comp.fixtures.some((id) => europe.fixtures[id].matchday === d && !europe.fixtures[id].result)) ?? 1;
  const [md, setMd] = useState(firstOpen);
  if (!comp.fixtures.length) return <Empty>Fixtures appear after the league phase draw.</Empty>;
  const fixtures = comp.fixtures.map((id) => europe.fixtures[id]).filter((f) => f.matchday === md);
  return (
    <Panel title={`Matchday ${md} · week ${fixtures[0]?.week ?? ''}`} actions={<Segmented size="xs" value={md} onChange={setMd} options={Array.from({ length: days }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))} />}>
      <div className="grid gap-1.5 md:grid-cols-2">
        {fixtures.map((f) => (
          <div key={f.id} className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', f.home === pc || f.away === pc ? 'border-apex-red/50 bg-apex-red/[0.06]' : 'border-apex-line bg-apex-bg/40')}>
            <ClubName game={game} clubId={f.home} />
            <button disabled={!f.eventId || !f.result} onClick={() => f.eventId && openResult(f.eventId)} className={cn('num px-2 text-center font-bold', f.eventId && f.result && 'underline decoration-dotted')}>
              {f.result ? `${f.result.home}–${f.result.away}` : 'v'}
            </button>
            <div className="flex justify-end">
              <ClubName game={game} clubId={f.away} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Knockouts({ game, comp }: { game: GameState; comp: ContinentalState }) {
  const europe = game.europe!;
  const pc = playerClubId(game);
  const stages = (['playoff', 'r16', 'qf', 'sf', 'final'] as const).filter((s) => comp.knockout[s].length);
  if (!stages.length) return <Empty>The knockout bracket is set once the league phase ends (week {EURO_WEEKS.leaguePhase[CONTINENTAL[comp.id].opponents - 1] + 1}).</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[...stages].reverse().map((s) => (
        <Panel key={s} title={stageLabel(s)} actions={<span className="text-xs text-apex-muted">{s === 'final' ? `week ${EURO_WEEKS.final}` : `weeks ${EURO_WEEKS[s].join(' & ')}`}</span>}>
          <div className="space-y-1">
            {comp.knockout[s].map((tid) => (
              <TieRow key={tid} game={game} tie={europe.ties[tid]} highlight={pc} />
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CupBracket({ game, cup }: { game: GameState; cup: CupState }) {
  const europe = game.europe!;
  const pc = playerClubId(game);
  return (
    <Panel title={cup.name} actions={cup.winner ? <Badge tone="amber">Winners: {europe.clubs[cup.winner].name}</Badge> : <span className="text-xs text-apex-muted">{cup.entrants.length} entrants</span>}>
      {cup.rounds.length === 0 ? (
        <p className="text-sm text-apex-muted">Not drawn yet.</p>
      ) : (
        [...cup.rounds].reverse().map((round, i) => {
          const first = europe.ties[round[0]];
          const wk = first ? europe.fixtures[first.fixtures[0]]?.week : undefined;
          const mineOnly = round.length > 12;
          const shown = mineOnly ? round.filter((tid) => [europe.ties[tid].home, europe.ties[tid].away].includes(pc ?? '')) : round;
          return (
            <div key={i}>
              <StageHeading stage={first?.stage ?? 'round'} weeks={`week ${wk ?? '?'} · ${round.length} tie${round.length > 1 ? 's' : ''}`} />
              <div className="space-y-1">
                {shown.map((tid) => (
                  <TieRow key={tid} game={game} tie={europe.ties[tid]} highlight={pc} />
                ))}
                {mineOnly && <ExpandTies game={game} round={round} />}
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}

function ExpandTies({ game, round }: { game: GameState; round: string[] }) {
  const [open, setOpen] = useState(false);
  const europe = game.europe!;
  const pc = playerClubId(game);
  return open ? (
    <>
      {round
        .filter((tid) => ![europe.ties[tid].home, europe.ties[tid].away].includes(pc ?? ''))
        .map((tid) => (
          <TieRow key={tid} game={game} tie={europe.ties[tid]} />
        ))}
    </>
  ) : (
    <button className="text-xs text-apex-muted underline" onClick={() => setOpen(true)}>
      Show all {round.length} ties
    </button>
  );
}

function CupsView({ game }: { game: GameState }) {
  const europe = game.europe!;
  const pa = europe.playerAssocId;
  const cups = [europe.cups[`${pa}-cup`], europe.cups[`${pa}-leagueCup`], europe.cups[`${pa}-superCup`], europe.cups.ESC].filter((c): c is CupState => !!c);
  if (!cups.length) return <Empty>Cups are drawn when the season starts.</Empty>;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {cups.map((c) => (
        <CupBracket key={c.id} game={game} cup={c} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AssociationsView({ game }: { game: GameState }) {
  const europe = game.europe!;
  const ranking = associationRanking(game);
  const [selected, setSelected] = useState(europe.playerAssocId);
  const assoc = ASSOCIATION_BY_ID[selected];
  const setPage = useStore((s) => s.setPage);
  const leagues = Object.values(europe.leagues)
    .filter((l) => l.assocId === selected)
    .sort((a, b) => a.level - b.level);
  const [level, setLevel] = useState(1);
  const league = leagues.find((l) => l.level === level) ?? leagues[0];
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
      <Panel title="Association coefficients" bodyClass="p-0">
        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-apex-panel text-left text-[11px] uppercase tracking-wider text-apex-muted">
              <tr className="border-b border-apex-line">
                <th className="px-3 py-2">#</th>
                <th className="px-2 py-2">Association</th>
                <th className="px-2 py-2 text-right">Last 5 seasons</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Places</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((id, i) => {
                const a = europe.associations[id];
                const places = berthsForRank(i + 1);
                return (
                  <tr key={id} onClick={() => { setSelected(id); setLevel(1); }} className={cn('cursor-pointer border-b border-apex-line/50 hover:bg-white/[0.03]', id === selected && 'bg-sky-400/[0.08]', id === europe.playerAssocId && 'font-semibold')}>
                    <td className="num px-3 py-1.5 text-apex-muted">{i + 1}</td>
                    <td className="px-2 py-1.5">{ASSOCIATION_BY_ID[id].name}</td>
                    <td className="num px-2 py-1.5 text-right text-[11px] text-apex-muted">{a.coef.map((c) => c.toFixed(1)).join(' · ')}</td>
                    <td className="num px-2 py-1.5 text-right font-bold">{sum(a.coef).toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-[11px] text-apex-muted">
                      {(['CL', 'EL', 'ECL'] as const).map((c) => `${places.filter((p) => p.comp === c).length}`).join('/')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-[11px] text-apex-muted">Places: Champions / Europa / Conference League (including qualifying routes) for next season.</div>
      </Panel>
      <Panel title={`${assoc.name} · leagues`} actions={<Segmented size="xs" value={league?.level ?? 1} onChange={setLevel} options={leagues.map((l) => ({ value: l.level, label: `L${l.level}` }))} />}>
        {league && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{league.name}</span>
              <span className="text-xs text-apex-muted">
                {league.clubIds.length} clubs · {league.weeks.length} weekends
              </span>
            </div>
            {league.division ? (
              <FullLeagueTable game={game} division={league.division} onOpen={() => setPage('championship')} />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {liteTable(league).map((r, i) => (
                    <tr key={r.clubId} className="border-b border-apex-line/40">
                      <td className="num w-8 py-1 text-apex-muted">{i + 1}</td>
                      <td className="max-w-[220px] py-1">
                        <ClubName game={game} clubId={r.clubId} showAssoc={false} />
                      </td>
                      <td className="num py-1 text-right text-apex-muted">{r.wins}W</td>
                      <td className="num py-1 text-right font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 text-xs text-apex-muted">
              Last season: champions <ClubName game={game} clubId={europe.associations[selected].last.order[0]} showAssoc={false} /> · {assoc.cupName} <ClubName game={game} clubId={europe.associations[selected].last.cupWinner} showAssoc={false} />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function FullLeagueTable({ game, division, onOpen }: { game: GameState; division: GameState['teams'][string]['division']; onOpen: () => void }) {
  const rows = divisionStandings(game, division).constructors;
  return (
    <div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={cn('border-b border-apex-line/40', game.teams[r.id]?.isPlayer && 'bg-apex-red/[0.08]')}>
              <td className="num w-8 py-1 text-apex-muted">{i + 1}</td>
              <td className="max-w-[220px] py-1">
                <ClubName game={game} clubId={game.teams[r.id]?.clubId} showAssoc={false} />
              </td>
              <td className="num py-1 text-right text-apex-muted">{r.wins}W</td>
              <td className="num py-1 text-right font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="mt-2 text-xs text-sky-300 underline" onClick={onOpen}>
        Full standings, drivers and calendar in Championship (level {levelOfDivision(division)})
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

const HONOUR_WEIGHT: Partial<Record<EuroHonour, number>> = { CL: 10, EL: 6, ECL: 4, ESC: 2, league: 5, cup: 3, leagueCup: 2, superCup: 1 };
const HONOUR_LABEL: Partial<Record<EuroHonour, string>> = { CL: 'Champions League', EL: 'Europa League', ECL: 'Conference League', ESC: 'Super Cup', league: 'League titles', cup: 'Cups', leagueCup: 'League cups', superCup: 'Super cups' };

function HonoursView({ game }: { game: GameState }) {
  const europe = game.europe!;
  const top = Object.values(europe.clubs)
    .map((c) => ({ c, score: Object.entries(c.honours).reduce((s, [k, n]) => s + (HONOUR_WEIGHT[k as EuroHonour] ?? 0) * (n ?? 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Panel title="Roll of honour" icon={<Medal size={15} className="text-amber-400" />}>
        {europe.history.length === 0 ? (
          <p className="text-sm text-apex-muted">The first European season is under way. Winners are recorded here.</p>
        ) : (
          <div className="space-y-3">
            {[...europe.history].reverse().map((h) => (
              <div key={h.season} className="rounded-md border border-apex-line p-3 text-sm">
                <div className="mb-1 font-display font-bold uppercase">
                  Season {h.season} · {h.year}
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(['CL', 'EL', 'ECL', 'ESC'] as const).map((k) =>
                    h.winners[k] ? (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-apex-muted">{competitionName(game, k).replace('Apex ', '')}</span>
                        <ClubName game={game} clubId={h.winners[k]!.winner} />
                      </div>
                    ) : null,
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-apex-muted">{ASSOCIATION_BY_ID[europe.playerAssocId].levels[0].name}</span>
                    <ClubName game={game} clubId={h.domestic[europe.playerAssocId]?.champion} showAssoc={false} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-apex-muted">{ASSOCIATION_BY_ID[europe.playerAssocId].cupName}</span>
                    <ClubName game={game} clubId={h.domestic[europe.playerAssocId]?.cup} showAssoc={false} />
                  </div>
                </div>
                {h.player.length > 0 && <div className="mt-1 text-xs text-apex-muted">Your team: {h.player.map((p) => `${competitionName(game, p.competition).replace('Apex ', '')}: ${p.reached}`).join(' · ')}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Most decorated clubs">
        {top.length === 0 ? (
          <p className="text-sm text-apex-muted">No trophies have been won yet.</p>
        ) : (
          <div className="space-y-1.5">
            {top.map(({ c }) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <ClubName game={game} clubId={c.id} />
                <span className="text-right text-[11px] text-apex-muted">
                  {Object.entries(c.honours)
                    .filter(([k, n]) => n && HONOUR_LABEL[k as EuroHonour])
                    .map(([k, n]) => `${n}× ${HONOUR_LABEL[k as EuroHonour]}`)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
