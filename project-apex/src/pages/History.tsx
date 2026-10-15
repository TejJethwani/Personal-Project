import { Crown } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIVISIONS } from '@/engine/config/divisions';
import { computeRecords, hallOfFame } from '@/engine/history/records';
import { playerTeam } from '@/engine/selectors';
import type { DivisionId } from '@/engine/types';
import { DIVISION_ORDER } from '@/engine/types';
import { DivisionBadge, DriverLink, Flag, TeamLink } from '@/components/common';
import { Badge, Button, Empty, Panel, SectionTitle, Segmented, Tabs } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';

export function HistoryPage() {
  const [tab, setTab] = useState<'seasons' | 'team' | 'records' | 'hof'>('seasons');
  return (
    <div className="space-y-5">
      <SectionTitle sub="Every season, every champion, every record: from Season 1 onward.">History</SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'seasons', label: 'Seasons' },
          { id: 'team', label: 'Our story' },
          { id: 'records', label: 'Records' },
          { id: 'hof', label: 'Hall of Fame' },
        ]}
      />
      {tab === 'seasons' && <Seasons />}
      {tab === 'team' && <OurStory />}
      {tab === 'records' && <Records />}
      {tab === 'hof' && <HallOfFame />}
    </div>
  );
}

function Seasons() {
  const game = useGame();
  const openResult = useStore((s) => s.openResult);
  const [open, setOpen] = useState<number | null>(game.history.at(-1)?.season ?? null);
  const [div, setDiv] = useState<DivisionId>('F1');
  if (game.history.length === 0) return <Empty>No completed seasons yet. History is written at the end of each season.</Empty>;
  const h = game.history.find((x) => x.season === open);
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <div className="space-y-2">
        {[...game.history].reverse().map((s) => {
          const f1 = s.divisions.F1;
          return (
            <button key={s.season} onClick={() => setOpen(s.season)} className={`panel w-full p-3 text-left ${open === s.season ? 'border-apex-red' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold uppercase">
                  Season {s.season} <span className="text-apex-muted">({s.year})</span>
                </span>
                <span className="text-xs text-apex-muted">
                  You: <DivisionBadge division={s.playerDivision} /> P{s.playerPosition}
                </span>
              </div>
              <div className="mt-1 text-xs text-apex-muted">
                F1 champion: {f1.championDriverId ? `${game.drivers[f1.championDriverId]?.firstName} ${game.drivers[f1.championDriverId]?.lastName}` : '—'} · {f1.championTeamId ? f1.teamNames[f1.championTeamId] : ''}
              </div>
            </button>
          );
        })}
      </div>
      {h && (
        <div className="space-y-4">
          <Panel title={`Season ${h.season} champions`}>
            <table className="table-apex">
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Drivers' champion</th>
                  <th>Teams' champion</th>
                </tr>
              </thead>
              <tbody>
                {[...DIVISION_ORDER].reverse().map((d) => (
                  <tr key={d}>
                    <td>
                      <DivisionBadge division={d} />
                    </td>
                    <td>{h.divisions[d].championDriverId ? <DriverLink driver={game.drivers[h.divisions[d].championDriverId!]} /> : '—'}</td>
                    <td>{h.divisions[d].championTeamId ? h.divisions[d].teamNames[h.divisions[d].championTeamId!] ?? '—' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {h.promotions.map((p) => (
                <Badge key={p.teamId} tone="green">
                  ▲ {game.teams[p.teamId]?.name} → {p.to}
                </Badge>
              ))}
              {h.relegations.map((p) => (
                <Badge key={p.teamId} tone="red">
                  ▼ {game.teams[p.teamId]?.name} → {p.to}
                </Badge>
              ))}
            </div>
          </Panel>
          {h.awards.length > 0 && (
            <Panel title="Awards">
              <div className="grid gap-2 md:grid-cols-2">
                {h.awards.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Crown size={14} className="text-yellow-300" />
                    <span className="text-apex-muted">{a.title}:</span>
                    {a.driverId ? <DriverLink driver={game.drivers[a.driverId]} /> : a.teamId ? <TeamLink team={game.teams[a.teamId]} /> : null}
                    <span className="text-xs text-apex-dim">{a.description}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Final standings" actions={<Segmented value={div} onChange={setDiv} options={DIVISION_ORDER.map((d) => ({ value: d, label: d }))} />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <table className="table-apex">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {h.divisions[div].driverStandings.slice(0, 20).map((r, i) => (
                    <tr key={r.id}>
                      <td className="num font-bold">{i + 1}</td>
                      <td>
                        <DriverLink driver={game.drivers[r.id]} />
                      </td>
                      <td className="num">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="table-apex">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Team</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {h.divisions[div].constructorStandings.map((r, i) => (
                    <tr key={r.id} className={r.id === game.player.teamId ? 'bg-apex-red/[0.08]' : ''}>
                      <td className="num font-bold">{i + 1}</td>
                      <td>{h.divisions[div].teamNames[r.id] ?? game.teams[r.id]?.name}</td>
                      <td className="num">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {h.divisions[div].results.map((r) => (
                <Button key={r.eventId} size="xs" variant="ghost" onClick={() => openResult(r.eventId)}>
                  R{r.round} {game.circuits[r.circuitId].location}
                </Button>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function OurStory() {
  const game = useGame();
  const team = playerTeam(game);
  const data = team.history.map((h) => ({ season: `S${h.season}`, tier: DIVISIONS[h.division].tier * 10 + (11 - h.position), position: h.position, division: h.division, reputation: h.reputation }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {[
          ['Seasons', team.history.length],
          ['Race wins', team.stats.wins],
          ['Podiums', team.stats.podiums],
          ['Poles', team.stats.poles],
          ['Team titles', team.stats.constructorTitles],
          ['Promotions', team.stats.promotions],
        ].map(([k, v]) => (
          <div key={k as string} className="panel p-4">
            <div className="label">{k}</div>
            <div className="num text-3xl font-black">{v}</div>
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <Panel title="The climb (division and finishing position)">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
                <XAxis dataKey="season" stroke="#5c6372" fontSize={11} />
                <YAxis stroke="#5c6372" fontSize={11} domain={[0, 50]} ticks={[5, 15, 25, 35, 45]} tickFormatter={(v) => ['F5', 'F4', 'F3', 'F2', 'F1'][Math.floor(v / 10)] ?? ''} />
                <Tooltip contentStyle={{ background: '#121419', border: '1px solid #262a33' }} formatter={(_v, _n, p) => [`${p.payload.division} P${p.payload.position}`, 'Result']} />
                <Line type="stepAfter" dataKey="tier" stroke="#e10600" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
      <Panel title="Season by season">
        {team.history.length === 0 ? (
          <Empty>Your first season is under way.</Empty>
        ) : (
          <table className="table-apex">
            <thead>
              <tr>
                <th>Season</th>
                <th>Series</th>
                <th>Pos</th>
                <th>Points</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>Drivers</th>
                <th>Reputation</th>
                <th>Cash</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...team.history].reverse().map((h) => (
                <tr key={h.season}>
                  <td>
                    S{h.season} <span className="text-apex-dim">({h.year})</span>
                  </td>
                  <td>
                    <DivisionBadge division={h.division} />
                  </td>
                  <td className={h.champion ? 'font-bold text-yellow-300' : ''}>P{h.position}</td>
                  <td>{h.points}</td>
                  <td>{h.wins}</td>
                  <td>{h.podiums}</td>
                  <td className="text-xs">{h.drivers.map((id) => game.drivers[id]?.lastName).join(', ')}</td>
                  <td>{h.reputation}</td>
                  <td>{money(h.endCash)}</td>
                  <td>
                    {h.promoted && <Badge tone="green">Promoted</Badge>}
                    {h.relegated && <Badge tone="red">Relegated</Badge>}
                    {h.champion && <Badge tone="gold">Champions</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Records() {
  const game = useGame();
  const [div, setDiv] = useState<DivisionId | 'all'>('F1');
  const tables = computeRecords(game, div);
  return (
    <div className="space-y-4">
      <Segmented value={div} onChange={setDiv} options={[...DIVISION_ORDER.map((d) => ({ value: d as DivisionId | 'all', label: d })), { value: 'all', label: 'All series' }]} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <Panel key={t.title} title={t.title}>
            <div className="mb-2 text-xs text-apex-muted">{t.description}</div>
            {t.entries.length === 0 ? (
              <div className="text-sm text-apex-dim">No record set yet.</div>
            ) : (
              <ol className="space-y-1">
                {t.entries.map((e, i) => (
                  <li key={`${e.id}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="num w-5 text-apex-muted">{i + 1}</span>
                    {e.kind === 'driver' ? <DriverLink driver={game.drivers[e.id]} /> : <TeamLink team={game.teams[e.id]} />}
                    <span className="flex-1 truncate text-right text-xs text-apex-dim">{e.detail}</span>
                    <span className="num w-8 text-right font-bold">{e.value}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

function HallOfFame() {
  const game = useGame();
  const list = hallOfFame(game);
  if (list.length === 0) return <Empty>The Hall of Fame awaits its first legend: a Formula 1 world champion, a ten-time F1 winner or a three-time champion at any level.</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {list.map((h) => (
        <div key={h.driverId} className="panel relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-yellow-400/10 blur-xl" />
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-yellow-300" />
            <DriverLink driver={game.drivers[h.driverId]} className="font-display text-lg font-bold uppercase" flag={false} />
            <Flag code={h.nationality} />
            {h.retired && <Badge>Retired</Badge>}
          </div>
          <div className="mt-2 text-sm text-yellow-100/90">{h.citation}</div>
          <div className="mt-1 text-xs text-apex-muted">
            {h.wins} career wins · {h.podiums} podiums
          </div>
        </div>
      ))}
    </div>
  );
}
