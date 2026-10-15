import { HeartPulse, Search, ShieldAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIVISIONS } from '@/engine/config/divisions';
import { ARCHETYPE_LABELS, ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, computeOverall, driverName, expectedSalary, marketValue, PERSONALITY_LABELS } from '@/engine/drivers/ratings';
import { estimateAll, estimateOverall, estimatePotential, scoutKnowledge, startScouting } from '@/engine/market/scouting';
import { buyoutQuote, releaseDriver, severanceCost } from '@/engine/market/transfers';
import { playerTeam } from '@/engine/selectors';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { DivisionBadge, Flag, FormDots, TeamLink } from './common';
import { Badge, Button, Modal, RatingBar, RatingPill, Stat, Tabs } from './ui';
import { useState } from 'react';

export function DriverProfileModal() {
  const id = useStore((s) => s.driverProfile);
  const open = useStore((s) => s.openDriver);
  return (
    <Modal open={!!id} onClose={() => open(null)} title="Driver Profile" width="max-w-5xl">
      {id && <DriverProfileBody driverId={id} />}
    </Modal>
  );
}

function DriverProfileBody({ driverId }: { driverId: string }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const openNegotiation = useStore((s) => s.openNegotiation);
  const close = useStore((s) => s.openDriver);
  const [tab, setTab] = useState<'overview' | 'career' | 'history'>('overview');
  const d = game.drivers[driverId];
  if (!d) return <div>Unknown driver.</div>;
  const team = d.contract ? game.teams[d.contract.teamId] : null;
  const me = playerTeam(game);
  const mine = d.contract?.teamId === me.id;
  const knowledge = scoutKnowledge(game, d);
  const est = estimateAll(game, d);
  const ovr = estimateOverall(game, d);
  const pot = estimatePotential(game, d);
  const scouting = game.player.scoutAssignments.find((a) => a.targetId === d.id);
  const q = !mine && d.contract ? buyoutQuote(game, me, d) : null;
  const future = d.futureContract ? game.teams[d.futureContract.teamId] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-apex-line2 font-display text-3xl font-black" style={{ background: team ? `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})` : '#1f232b' }}>
          <span className="drop-shadow">{d.firstName[0]}{d.lastName[0]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-3xl font-black uppercase">{driverName(d)}</h2>
            <Flag code={d.nationality} />
            {d.retired && <Badge tone="neutral">Retired S{d.retiredSeason}</Badge>}
            {d.injury && (
              <Badge tone="red">
                <HeartPulse size={11} /> Injured {d.injury.weeksRemaining}w
              </Badge>
            )}
            {d.raceBan > 0 && (
              <Badge tone="red">
                <ShieldAlert size={11} /> Banned
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-apex-muted">
            <span>Age {d.age}</span>·<span>{ARCHETYPE_LABELS[d.archetype]}</span>·<span>{PERSONALITY_LABELS[d.personality]}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {team ? (
              <>
                <TeamLink team={team} /> <DivisionBadge division={team.division} />
                <Badge tone={d.contract!.role === 'race' ? 'green' : d.contract!.role === 'reserve' ? 'amber' : 'purple'}>{d.contract!.role}</Badge>
                {d.contract!.role === 'race' && <Badge>{d.contract!.status === 'number1' ? 'No. 1 driver' : d.contract!.status === 'number2' ? 'No. 2 driver' : 'Equal status'}</Badge>}
              </>
            ) : (
              <Badge tone="blue">Free agent</Badge>
            )}
            {future && (
              <span className="text-xs text-apex-muted">
                Signed for {future.name} from S{d.futureContract!.startSeason}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="label">Overall</div>
            <RatingPill value={ovr.value} estimate={ovr} className="mt-1 px-3 py-1 text-2xl" />
          </div>
          <div className="text-center">
            <div className="label">Potential</div>
            <RatingPill value={pot.value} estimate={pot} className="mt-1 px-3 py-1 text-2xl" />
          </div>
        </div>
      </div>

      {!d.retired && (
        <div className="flex flex-wrap gap-2">
          {!mine && (
            <>
              <Button variant="primary" onClick={() => openNegotiation({ driverId: d.id, mode: d.age <= 19 && !d.contract ? 'academy' : 'sign' })}>
                {d.age <= 19 && !d.contract ? 'Offer academy place' : 'Make contract offer'}
              </Button>
              {d.age <= 19 && !d.contract && (
                <Button onClick={() => openNegotiation({ driverId: d.id, mode: 'sign' })}>Offer race/reserve deal</Button>
              )}
              {knowledge < 100 && (
                <Button disabled={!!scouting} onClick={() => act((g) => startScouting(g, d.id), { success: `Scouts assigned to ${driverName(d)}.` })}>
                  <Search size={14} /> {scouting ? `Scouting (${scouting.weeksRemaining}w)` : 'Scout driver'}
                </Button>
              )}
            </>
          )}
          {mine && (
            <>
              <Button variant="primary" onClick={() => openNegotiation({ driverId: d.id, mode: d.contract!.role === 'academy' ? 'promote' : 'extend' })}>
                {d.contract!.role === 'academy' ? 'Promote / new contract' : 'Renegotiate / extend'}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const cost = severanceCost(game, d);
                  if (confirm(`Release ${driverName(d)}? Severance: ${money(cost)}.`)) {
                    act((g) => releaseDriver(g, d.id, me.id), { success: `${driverName(d)} released.` });
                    close(null);
                  }
                }}
              >
                Release ({money(severanceCost(game, d))})
              </Button>
            </>
          )}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'career', label: 'Career' },
          { id: 'history', label: 'Records' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Attributes</span>
              <span className="text-xs text-apex-muted">{knowledge >= 100 ? 'Fully known' : `Scouting knowledge ${Math.round(knowledge)}%`}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {ATTRIBUTE_KEYS.map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-xs text-apex-muted">
                    <span>{ATTRIBUTE_LABELS[k]}</span>
                  </div>
                  <RatingBar value={est[k].value} low={est[k].exact ? undefined : est[k].low} high={est[k].exact ? undefined : est[k].high} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-apex-line p-4">
              <Stat label="Market value" value={money(marketValue(d))} />
              <Stat label={`Asking (${DIVISIONS[me.division].name})`} value={money(expectedSalary(d, me.division))} sub="per season" />
              <Stat label="Morale" value={`${Math.round(d.morale)}`} sub={d.morale >= 70 ? 'Happy' : d.morale <= 35 ? 'Unsettled' : 'Content'} />
              <Stat label="Confidence" value={`${Math.round(d.confidence)}`} />
              {d.contract && <Stat label="Salary" value={money(d.contract.salary)} sub={`until end of S${d.contract.endSeason}`} />}
              {d.backing > 0 && <Stat label="Personal backing" value={money(d.backing)} sub="per season" />}
              {q && <Stat label="Buyout fee" value={q.willing ? money(q.fee) : 'Not for sale'} sub={q.reason} />}
              <Stat label="Penalty points" value={d.penaltyPoints} sub="12 = race ban" />
            </div>
            <div className="rounded-lg border border-apex-line p-4">
              <div className="label mb-2">Recent form</div>
              {d.form.length ? <FormDots form={d.form} /> : <span className="text-sm text-apex-muted">No races yet</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'career' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-apex-line p-4 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Starts" value={d.career.starts} />
            <Stat label="Wins" value={d.career.wins} />
            <Stat label="Podiums" value={d.career.podiums} />
            <Stat label="Poles" value={d.career.poles} />
            <Stat label="Fastest laps" value={d.career.fastestLaps} />
            <Stat label="Points" value={d.career.points} />
            <Stat label="DNFs" value={d.career.dnfs} />
            <Stat label="Titles" value={Object.values(d.career.championships).reduce((a, b) => a + (b ?? 0), 0)} sub={Object.entries(d.career.championships).map(([k, v]) => `${v}× ${k}`).join(' · ') || '—'} />
          </div>
          <div className="text-[11px] text-apex-dim">Statistics are recorded from Season 1 of this universe.</div>
          {d.ratingHistory.length > 1 && (
            <div className="h-48 rounded-lg border border-apex-line p-3">
              <ResponsiveContainer>
                <LineChart data={[...d.ratingHistory, { season: game.season, overall: computeOverall(d.attributes) }]}>
                  <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
                  <XAxis dataKey="season" stroke="#5c6372" fontSize={11} tickFormatter={(v) => `S${v}`} />
                  <YAxis stroke="#5c6372" fontSize={11} domain={['dataMin - 3', 'dataMax + 3']} />
                  <Tooltip contentStyle={{ background: '#121419', border: '1px solid #262a33' }} labelFormatter={(v) => `Season ${v}`} />
                  <Line type="monotone" dataKey="overall" stroke="#e10600" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="table-apex">
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                <th>Series</th>
                <th>Pos</th>
                <th>Pts</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>Poles</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {[...d.career.seasons].reverse().map((s) => (
                <tr key={`${s.season}-${s.division}`}>
                  <td>
                    S{s.season} <span className="text-apex-dim">({s.year})</span>
                  </td>
                  <td>{s.teamId ? <TeamLink team={game.teams[s.teamId]} /> : '—'}</td>
                  <td>
                    <DivisionBadge division={s.division} />
                  </td>
                  <td className={s.champion ? 'font-bold text-yellow-300' : ''}>{s.position ?? '—'}{s.champion ? ' 🏆' : ''}</td>
                  <td>{s.points}</td>
                  <td>{s.wins}</td>
                  <td>{s.podiums}</td>
                  <td>{s.poles}</td>
                  <td>{s.overall}</td>
                </tr>
              ))}
              {d.career.seasons.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-apex-muted">
                    No completed seasons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <div className="label mb-2">Transfers</div>
            <ul className="space-y-1.5 text-sm">
              {[...d.transfers].reverse().slice(0, 15).map((t, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-apex-line/60 pb-1">
                  <span className="text-apex-muted">S{t.season}</span>
                  <span className="flex-1 truncate capitalize">
                    {t.type} {t.toTeamId ? `→ ${game.teams[t.toTeamId]?.shortName ?? '?'}` : t.fromTeamId ? `from ${game.teams[t.fromTeamId]?.shortName ?? '?'}` : ''}
                  </span>
                  {t.fee > 0 && <span className="text-apex-muted">{money(t.fee)}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label mb-2">Injuries</div>
            {d.injuries.length ? (
              <ul className="space-y-1 text-sm">
                {d.injuries.map((x, i) => (
                  <li key={i}>
                    S{x.season} W{x.week}: {x.description} ({x.weeksOut}w)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-apex-muted">Clean record.</p>
            )}
          </div>
          <div>
            <div className="label mb-2">Discipline</div>
            {d.discipline.length ? (
              <ul className="space-y-1 text-sm">
                {d.discipline.slice(-12).map((x, i) => (
                  <li key={i}>
                    S{x.season} {x.division} R{x.round}: {x.description} (+{x.penaltyPoints})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-apex-muted">No penalties.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
