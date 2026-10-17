import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { divisionAbove, DIVISIONS, pointsSummary } from '@/engine/config/divisions';
import { championshipPoints, computeStandingsFromResults, divisionStandings, seasonResults } from '@/engine/championship/standings';
import { driverName } from '@/engine/drivers/ratings';
import { licensingChecks, promotionPicture } from '@/engine/season/promotion';
import { playerTeam } from '@/engine/selectors';
import type { DivisionId } from '@/engine/types';
import { activeDivisions, divisionShort } from '@/engine/config/ruleset';
import { DivisionBadge, DriverLink, TeamLink } from '@/components/common';
import { Badge, Button, cn, Panel, SectionTitle, Segmented, Tabs } from '@/components/ui';
import { useGame, useStore } from '@/store/gameStore';
import { CircuitGuide } from '@/components/CircuitGuide';
import { FormStrip, TeamStandings } from '@/components/LeagueTable';
import { recentForm } from '@/engine/championship/form';

export function ChampionshipPage() {
  const game = useGame();
  const team = playerTeam(game);
  const [division, setDivision] = useState<DivisionId>(team.division);
  const [tab, setTab] = useState<'drivers' | 'teams' | 'calendar' | 'promotion' | 'progress' | 'circuits'>('drivers');
  const cfg = DIVISIONS[division];
  return (
    <div className="space-y-5">
      <SectionTitle
        sub={`${cfg.name}: ${cfg.races} rounds · points: ${pointsSummary(championshipPoints(game, division))}`}
        right={<Segmented value={division} onChange={setDivision} options={activeDivisions(game).map((d) => ({ value: d, label: divisionShort(d) }))} />}
      >
        Championship
      </SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'drivers', label: 'Drivers' },
          { id: 'teams', label: 'Teams' },
          { id: 'progress', label: 'Points progression' },
          { id: 'calendar', label: 'Calendar & results' },
          { id: 'promotion', label: division === 'F1' ? 'Relegation' : 'Promotion' },
          { id: 'circuits', label: 'Circuits' },
        ]}
      />
      {tab === 'circuits' && <CircuitGuide game={game} division={division} />}
      {tab === 'drivers' && <DriverTable division={division} />}
      {tab === 'teams' && <TeamStandings division={division} />}
      {tab === 'progress' && <Progression division={division} />}
      {tab === 'calendar' && <Calendar division={division} />}
      {tab === 'promotion' && <Promotion division={division} />}
    </div>
  );
}

function DriverTable({ division }: { division: DivisionId }) {
  const game = useGame();
  const st = divisionStandings(game, division);
  const leader = st.drivers[0]?.points ?? 0;
  const results = seasonResults(game, division);
  const scoring = championshipPoints(game, division).positions.length;
  return (
    <div className="panel overflow-x-auto">
      <table className="table-apex">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Driver</th>
            <th>Team</th>
            <th>Starts</th>
            <th>Wins</th>
            <th>Podiums</th>
            <th>Poles</th>
            <th>FL</th>
            <th>DNF</th>
            <th>Gap</th>
            <th className="text-right">Points</th>
            <th title="Last five races, oldest first">Last 5</th>
          </tr>
        </thead>
        <tbody>
          {st.drivers.map((r, i) => (
            <tr key={r.id} className={r.teamId === game.player.teamId ? 'bg-apex-red/[0.08]' : ''}>
              <td className="num font-bold">{i + 1}</td>
              <td>
                <DriverLink driver={game.drivers[r.id]} />
              </td>
              <td>{r.teamId && <TeamLink team={game.teams[r.teamId]} />}</td>
              <td>{r.starts}</td>
              <td>{r.wins}</td>
              <td>{r.podiums}</td>
              <td>{r.poles}</td>
              <td>{r.fastestLaps}</td>
              <td>{r.dnfs}</td>
              <td className="text-apex-muted">{i === 0 ? '—' : `−${leader - r.points}`}</td>
              <td className="num text-right text-base font-bold">{r.points}</td>
              <td>
                <FormStrip form={recentForm(results, r.id, 'driver', scoring)} game={game} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LINE_COLORS = ['#e10600', '#38bdf8', '#facc15', '#22c55e', '#a855f7', '#f97316'];

function Progression({ division }: { division: DivisionId }) {
  const game = useGame();
  const results = seasonResults(game, division);
  const final = divisionStandings(game, division).drivers.slice(0, 6).map((r) => r.id);
  const mine = game.teams[game.player.teamId].raceDrivers.filter((x): x is string => !!x && !final.includes(x));
  const ids = [...final, ...(game.teams[game.player.teamId].division === division ? mine : [])];
  const data = results.map((_, i) => {
    const st = computeStandingsFromResults(results.slice(0, i + 1)).drivers;
    const row: Record<string, number | string> = { round: `R${i + 1}` };
    for (const id of ids) row[id] = st.find((r) => r.id === id)?.points ?? 0;
    return row;
  });
  if (!data.length) return <Panel title="Points progression"><div className="text-sm text-apex-muted">No races completed yet.</div></Panel>;
  return (
    <Panel title="Points progression">
      <div className="h-80">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
            <XAxis dataKey="round" stroke="#5c6372" fontSize={11} />
            <YAxis stroke="#5c6372" fontSize={11} />
            <Tooltip contentStyle={{ background: '#121419', border: '1px solid #262a33' }} formatter={(v: number, name: string) => [v, driverName(game.drivers[name])]} />
            <Legend formatter={(v) => driverName(game.drivers[v])} wrapperStyle={{ fontSize: 12 }} />
            {ids.map((id, i) => (
              <Line key={id} type="monotone" dataKey={id} stroke={game.drivers[id]?.contract?.teamId === game.player.teamId ? '#ffffff' : LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={game.drivers[id]?.contract?.teamId === game.player.teamId ? 3 : 2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Calendar({ division }: { division: DivisionId }) {
  const game = useGame();
  const openResult = useStore((s) => s.openResult);
  return (
    <div className="panel overflow-x-auto">
      <table className="table-apex">
        <thead>
          <tr>
            <th>Rd</th>
            <th>Week</th>
            <th>Circuit</th>
            <th>Winner</th>
            <th>Pole</th>
            <th>Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {game.calendars[division].map((e) => {
            const r = game.results[e.id];
            const c = game.circuits[e.circuitId];
            return (
              <tr key={e.id} className={!e.completed && game.weekend?.eventId === e.id ? 'bg-apex-red/[0.08]' : ''}>
                <td className="num font-bold">{e.round}</td>
                <td className="text-apex-muted">W{e.week}</td>
                <td>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-apex-muted">{c.location}</div>
                </td>
                <td>{r ? <DriverLink driver={game.drivers[r.entries[0].driverId]} /> : <span className="text-apex-dim">—</span>}</td>
                <td>{r?.poleDriverId ? <DriverLink driver={game.drivers[r.poleDriverId]} short /> : <span className="text-apex-dim">—</span>}</td>
                <td className="space-x-1">
                  {r?.wet && <Badge tone="blue">Wet</Badge>}
                  {r && r.safetyCars > 0 && <Badge tone="amber">SC ×{r.safetyCars}</Badge>}
                </td>
                <td className="text-right">{r && <Button size="xs" variant="ghost" onClick={() => openResult(e.id)}>Results</Button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Promotion({ division }: { division: DivisionId }) {
  const game = useGame();
  const team = playerTeam(game);
  const rows = promotionPicture(game, division);
  const up = divisionAbove(division);
  const cfg = DIVISIONS[division];
  const mineChecks = up && team.division === division ? licensingChecks(game, team, up) : null;
  return (
    <div className="space-y-5">
      <Panel title="How promotion works">
        <p className="text-sm text-apex-muted">
          {up
            ? `The two highest-placed teams among the top four that hold a valid ${DIVISIONS[up].name} licence are promoted. An equal number of teams are relegated from ${DIVISIONS[up].name}. Promotion cannot be bought: you must finish high enough AND meet every licensing requirement at season end.`
            : 'Formula 1 is the summit. The bottom two teams are relegated to Formula 2 when two Formula 2 teams earn promotion.'}
          {cfg.relegationSlots > 0 && division !== 'F1' && ` The bottom ${cfg.relegationSlots} teams in ${cfg.name} risk relegation.`}
        </p>
      </Panel>
      {mineChecks && (
        <Panel title={`Your ${DIVISIONS[up!].name} licence`}>
          <div className="grid gap-2 md:grid-cols-2">
            {mineChecks.map((c) => (
              <div key={c.label} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', c.met ? 'border-emerald-700/50 bg-emerald-500/[0.06]' : 'border-red-800/60 bg-red-500/[0.06]')}>
                {c.met ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
                <span className="flex-1">{c.label}</span>
                <span className="text-xs text-apex-muted">{c.detail}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="panel overflow-x-auto">
        <table className="table-apex">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>Points</th>
              <th>Licence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className={r.teamId === team.id ? 'bg-apex-red/[0.08]' : ''}>
                <td className="num font-bold">{r.position}</td>
                <td>
                  <TeamLink team={game.teams[r.teamId]} />
                </td>
                <td className="num font-semibold">{r.points}</td>
                <td>{up ? r.eligible ? <Badge tone="green">Eligible</Badge> : <Badge tone="red" title={r.checks.filter((c) => !c.met).map((c) => c.label).join(', ')}>Not eligible</Badge> : '—'}</td>
                <td>
                  {r.status === 'promotion' && <Badge tone="green">▲ Promotion</Badge>}
                  {r.status === 'contender' && <Badge tone="amber">In contention</Badge>}
                  {r.status === 'relegation' && <Badge tone="red">▼ Relegation</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-apex-muted">
        <DivisionBadge division={division} /> Standings update after every round. Final decisions are made at the end of the season.
      </div>
    </div>
  );
}
