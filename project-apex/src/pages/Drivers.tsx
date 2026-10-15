import { ArrowLeftRight, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { setTraining } from '@/engine/actions';
import { DIVISIONS } from '@/engine/config/divisions';
import { divisionStandings } from '@/engine/championship/standings';
import { FOCUS_LABELS } from '@/engine/drivers/development';
import { ARCHETYPE_LABELS, ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, computeOverall, driverName, overall, PERSONALITY_LABELS } from '@/engine/drivers/ratings';
import { headToHead } from '@/engine/history/records';
import { releaseDriver, setDriverRole, setDriverStatus, severanceCost, swapRaceSeats } from '@/engine/market/transfers';
import { playerTeam } from '@/engine/selectors';
import { academyCapacity } from '@/engine/team/facilities';
import type { Driver, TrainingFocus, TrainingIntensity } from '@/engine/types';
import { DriverLink, Flag, FormDots } from '@/components/common';
import { Badge, Button, Empty, Panel, Progress, RatingBar, RatingPill, SectionTitle, Segmented, Select } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';

export function DriversPage() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const setPage = useStore((s) => s.setPage);
  const team = playerTeam(game);
  const race = team.raceDrivers.map((id) => (id ? game.drivers[id] : null));
  const reserve = team.reserveDriverId ? game.drivers[team.reserveDriverId] : null;
  const academy = team.academyDriverIds.map((id) => game.drivers[id]);
  const [a, b] = race;
  const h2h = a && b ? headToHead(game, a.id, b.id) : null;
  const incoming = Object.values(game.drivers).filter((d) => d.futureContract?.teamId === team.id && d.contract?.teamId !== team.id);

  return (
    <div className="space-y-6">
      <SectionTitle
        sub="Contracts, training, morale and career statistics for your drivers."
        right={
          <>
            <Button onClick={() => act((g) => swapRaceSeats(g, team.id))} disabled={!a || !b}>
              <ArrowLeftRight size={15} /> Swap car numbers
            </Button>
            <Button variant="primary" onClick={() => setPage('market')}>
              <UserPlus size={15} /> Driver Market
            </Button>
          </>
        }
      >
        Drivers
      </SectionTitle>

      <div className="grid gap-6 xl:grid-cols-2">
        {race.map((d, i) =>
          d ? (
            <DriverCard key={d.id} driver={d} seat={i as 0 | 1} />
          ) : (
            <Panel key={i} title={`Car ${i + 1}`}>
              <Empty>
                Seat empty. <button className="text-apex-red underline" onClick={() => setPage('market')}>Sign a driver</button>
                {reserve && (
                  <>
                    {' '}or{' '}
                    <button className="text-apex-red underline" onClick={() => act((g) => setDriverRole(g, team.id, reserve.id, 'race', i as 0 | 1), { success: `${driverName(reserve)} promoted to race seat.` })}>
                      promote {reserve.lastName}
                    </button>
                  </>
                )}
              </Empty>
            </Panel>
          ),
        )}
      </div>

      {h2h && h2h.races > 0 && a && b && (
        <Panel title="Team-mate head to head (all races together)">
          <div className="flex items-center gap-4">
            <span className="w-40 truncate text-right font-semibold">{driverName(a)}</span>
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-white/5">
              <div className="bg-apex-red" style={{ width: `${(h2h.aAhead / h2h.races) * 100}%` }} />
              <div className="bg-sky-500" style={{ width: `${(h2h.bAhead / h2h.races) * 100}%` }} />
            </div>
            <span className="w-40 truncate font-semibold">{driverName(b)}</span>
          </div>
          <div className="mt-1 text-center text-sm text-apex-muted">
            {h2h.aAhead} – {h2h.bAhead} in {h2h.races} races
          </div>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Reserve driver">
          {reserve ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DriverLink driver={reserve} className="font-semibold" />
                <div className="text-xs text-apex-muted">
                  Age {reserve.age} · {money(reserve.contract!.salary)}/yr until S{reserve.contract!.endSeason}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RatingPill value={overall(reserve)} />
                <Button size="sm" onClick={() => act((g) => setDriverRole(g, team.id, reserve.id, 'race', team.raceDrivers[0] === null ? 0 : team.raceDrivers[1] === null ? 1 : 1), { success: 'Line-up changed.' })}>
                  Promote to race seat
                </Button>
                <Button size="sm" variant="danger" onClick={async () => (await askConfirm(`Release ${driverName(reserve)} for ${money(severanceCost(game, reserve))}?`)) && act((g) => releaseDriver(g, reserve.id, team.id), { success: 'Reserve released.' })}>
                  Release
                </Button>
              </div>
            </div>
          ) : (
            <Empty>No reserve driver. A reserve races if a driver is injured or banned.</Empty>
          )}
          {incoming.length > 0 && (
            <div className="mt-4">
              <div className="label mb-2">Joining next season</div>
              {incoming.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <DriverLink driver={d} />
                  <span className="text-apex-muted">
                    {d.futureContract!.role} · {money(d.futureContract!.salary)}/yr · {d.futureContract!.endSeason - d.futureContract!.startSeason + 1} yr
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={`Academy (${academy.length}/${academyCapacity(game, team)})`} actions={<Button size="xs" variant="ghost" onClick={() => setPage('market')}>Scout prospects</Button>}>
          {academy.length === 0 ? (
            <Empty>No academy drivers. Sign young prospects from the Driver Market (Youth tab).</Empty>
          ) : (
            <table className="table-apex">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Age</th>
                  <th>Rating</th>
                  <th>Potential</th>
                  <th>Growth</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {academy.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <DriverLink driver={d} />
                    </td>
                    <td>{d.age}</td>
                    <td>
                      <RatingPill value={overall(d)} />
                    </td>
                    <td>
                      <RatingPill value={d.potential} />
                    </td>
                    <td className="text-xs">{computeOverall(d.attributes) - (d.ratingHistory[0]?.overall ?? computeOverall(d.attributes)) >= 0 ? '+' : ''}{computeOverall(d.attributes) - (d.ratingHistory[0]?.overall ?? computeOverall(d.attributes))}</td>
                    <td className="text-right">
                      <Button size="xs" onClick={() => useStore.getState().openNegotiation({ driverId: d.id, mode: 'promote' })} disabled={d.age < 16}>
                        Promote
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function DriverCard({ driver: d, seat }: { driver: Driver; seat: 0 | 1 }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const openNegotiation = useStore((s) => s.openNegotiation);
  const team = playerTeam(game);
  const st = divisionStandings(game, team.division).drivers;
  const pos = st.findIndex((r) => r.id === d.id) + 1;
  const row = st[pos - 1];
  const c = d.contract!;
  const expiring = c.endSeason <= game.season;
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-4 border-b border-apex-line p-4" style={{ background: `linear-gradient(100deg, ${team.colors.primary}33, transparent 60%)` }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-lg font-display text-2xl font-black" style={{ background: team.colors.primary, color: team.colors.secondary }}>
          {seat + 1}
        </div>
        <div className="min-w-0 flex-1">
          <DriverLink driver={d} className="font-display text-2xl font-bold uppercase" flag={false} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-apex-muted">
            <Flag code={d.nationality} /> Age {d.age} · {ARCHETYPE_LABELS[d.archetype]} · {PERSONALITY_LABELS[d.personality]}
            {d.injury && <Badge tone="red">Injured {d.injury.weeksRemaining}w</Badge>}
            {d.raceBan > 0 && <Badge tone="red">Banned</Badge>}
          </div>
        </div>
        <div className="flex gap-3 text-center">
          <div>
            <div className="label">OVR</div>
            <RatingPill value={overall(d)} className="text-xl" />
          </div>
          <div>
            <div className="label">POT</div>
            <RatingPill value={d.potential} className="text-xl" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          {ATTRIBUTE_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
              <span className="text-apex-muted">{ATTRIBUTE_LABELS[k]}</span>
              <RatingBar value={d.attributes[k]} />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="label">Morale</div>
              <Progress value={d.morale} color={d.morale < 35 ? '#ef4444' : d.morale < 60 ? '#f59e0b' : '#22c55e'} className="mt-1.5" />
            </div>
            <div>
              <div className="label">Confidence</div>
              <Progress value={d.confidence} color="#3b82f6" className="mt-1.5" />
            </div>
          </div>
          <div className="rounded-md border border-apex-line p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-apex-muted">Salary</span>
              <span className="font-semibold">{money(c.salary)}/season</span>
            </div>
            <div className="flex justify-between">
              <span className="text-apex-muted">Contract</span>
              <span className={expiring ? 'font-semibold text-amber-300' : ''}>until end of S{c.endSeason}{expiring ? ' (expiring)' : ''}</span>
            </div>
            {(c.winBonus > 0 || c.podiumBonus > 0) && (
              <div className="flex justify-between">
                <span className="text-apex-muted">Bonuses</span>
                <span>win {money(c.winBonus)} · podium {money(c.podiumBonus)}</span>
              </div>
            )}
            {d.futureContract && (
              <div className="mt-1 text-xs text-sky-300">
                {d.futureContract.teamId === team.id ? `Extended to S${d.futureContract.endSeason}` : `Signed for ${game.teams[d.futureContract.teamId].name} next season`}
              </div>
            )}
            <div className="mt-2">
              <div className="label mb-1">Status</div>
              <Segmented
                size="xs"
                value={c.status}
                onChange={(v) => act((g) => setDriverStatus(g, team.id, d.id, v))}
                options={[
                  { value: 'number1', label: 'No. 1' },
                  { value: 'equal', label: 'Equal' },
                  { value: 'number2', label: 'No. 2' },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <MiniStat label="Pos" value={row && row.points > 0 ? `P${pos}` : '—'} />
            <MiniStat label="Pts" value={row?.points ?? 0} />
            <MiniStat label="Wins" value={row?.wins ?? 0} />
            <MiniStat label="Podiums" value={row?.podiums ?? 0} />
          </div>
          <div>
            <div className="label mb-1">Form</div>
            <FormDots form={d.form} />
          </div>
          <div className="space-y-2">
            <div className="label">Training</div>
            <Segmented
              size="xs"
              value={d.training.intensity}
              onChange={(v: TrainingIntensity) => act((g) => setTraining(g, d.id, { intensity: v }))}
              options={[
                { value: 'light', label: 'Light', title: 'Slower growth, morale boost' },
                { value: 'normal', label: 'Normal' },
                { value: 'intense', label: 'Intense', title: 'Faster growth, injury risk, morale cost' },
              ]}
            />
            <Select<TrainingFocus> className="h-8 w-full text-xs" value={d.training.focus} onChange={(v) => act((g) => setTraining(g, d.id, { focus: v }))} options={(Object.keys(FOCUS_LABELS) as TrainingFocus[]).map((k) => ({ value: k, label: FOCUS_LABELS[k] }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => openNegotiation({ driverId: d.id, mode: 'extend' })}>
              {expiring ? 'Extend contract' : 'Renegotiate'}
            </Button>
            <Button size="sm" onClick={() => act((g) => setDriverRole(g, team.id, d.id, 'reserve'), { success: `${d.lastName} moved to reserve.` })} disabled={team.reserveDriverId !== null}>
              To reserve
            </Button>
            <Button size="sm" variant="danger" onClick={async () => (await askConfirm(`Release ${driverName(d)}? Severance ${money(severanceCost(game, d))}.`)) && act((g) => releaseDriver(g, d.id, team.id), { success: `${driverName(d)} released.` })}>
              Release
            </Button>
          </div>
          <div className="text-[11px] text-apex-dim">Development is tracked monthly. {DIVISIONS[team.division].name} race experience accelerates growth.</div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-white/[0.03] py-1.5">
      <div className="num text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-apex-muted">{label}</div>
    </div>
  );
}
