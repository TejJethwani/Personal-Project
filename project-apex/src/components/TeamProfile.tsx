import { AI_PERSONALITIES } from '@/engine/config/difficulty';
import { DIVISIONS } from '@/engine/config/divisions';
import { COMPONENT_INFO, COMPONENT_KEYS, carRating } from '@/engine/car/car';
import { estimateRivalComponent } from '@/engine/car/rnd';
import { overall } from '@/engine/drivers/ratings';
import { playerTeam } from '@/engine/selectors';
import { STAFF_ROLE_INFO, STAFF_ROLES, staffName } from '@/engine/staff/staff';
import { FACILITY_INFO, FACILITY_KEYS } from '@/engine/team/facilities';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { DivisionBadge, DriverLink, Flag, TeamCar } from './common';
import { Badge, Modal, RatingBar, RatingPill, Stat } from './ui';
import { heritageSummary } from '@/engine/world/heritage';

export function TeamProfileModal() {
  const id = useStore((s) => s.teamProfile);
  const open = useStore((s) => s.openTeam);
  return (
    <Modal open={!!id} onClose={() => open(null)} title="Team Profile" width="max-w-5xl">
      {id && <TeamBody teamId={id} />}
    </Modal>
  );
}

function TeamBody({ teamId }: { teamId: string }) {
  const game = useGame();
  const team = game.teams[teamId];
  const me = playerTeam(game);
  if (!team) return null;
  const mine = team.id === me.id;
  const drivers = [...team.raceDrivers, team.reserveDriverId].filter(Boolean).map((id) => game.drivers[id!]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5">
        <TeamCar team={team} width={220} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-3xl font-black uppercase">{team.name}</h2>
            <Flag code={team.nationality} />
            <DivisionBadge division={team.division} />
            {team.isPlayer && <Badge tone="solid">Your team</Badge>}
          </div>
          <div className="mt-1 text-sm text-apex-muted">
            Team principal {team.principal}
            {team.aiPersonality && ` · ${AI_PERSONALITIES[team.aiPersonality].label}`} · {team.heritage ? heritageSummary(team.heritage) : `Founded season ${team.foundedSeason}`}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Reputation" value={Math.round(team.reputation)} />
            <Stat label="Car rating" value={mine ? carRating(team.car).toFixed(1) : `~${Math.round(carRating(team.car) / 2) * 2}`} sub={mine ? undefined : 'estimated'} />
            <Stat label="Wins" value={team.stats.wins} />
            <Stat label="Titles" value={team.stats.constructorTitles} sub={Object.entries(team.stats.constructorTitlesByDivision).map(([k, v]) => `${v}× ${k}`).join(' ') || undefined} />
            <Stat label="Budget" value={mine ? money(team.cash) : '—'} sub={mine ? undefined : 'confidential'} />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div>
          <div className="label mb-2">Drivers</div>
          <div className="space-y-2">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-apex-line px-3 py-2">
                <DriverLink driver={d} />
                <div className="flex items-center gap-2">
                  {d.contract?.role === 'reserve' && <Badge>Reserve</Badge>}
                  <RatingPill value={overall(d)} />
                </div>
              </div>
            ))}
          </div>
          <div className="label mb-2 mt-4">Senior staff</div>
          <div className="space-y-1 text-sm">
            {STAFF_ROLES.map((r) => {
              const s = team.staff[r] ? game.staff[team.staff[r]!] : null;
              return (
                <div key={r} className="flex justify-between gap-2">
                  <span className="text-apex-muted">{STAFF_ROLE_INFO[r].label}</span>
                  <span className="truncate">{staffName(s)}{s && mine ? ` (${s.rating})` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="label mb-2">Car {mine ? '' : '(estimated)'}</div>
          <div className="space-y-1.5">
            {COMPONENT_KEYS.map((k) => {
              const e = estimateRivalComponent(game, me, team, k);
              return (
                <div key={k}>
                  <div className="text-xs text-apex-muted">{COMPONENT_INFO[k].label}</div>
                  <RatingBar value={e.value} low={e.uncertainty ? Math.round(e.value - e.uncertainty) : undefined} high={e.uncertainty ? Math.round(e.value + e.uncertainty) : undefined} />
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="label mb-2">Facilities</div>
          <div className="space-y-1 text-sm">
            {FACILITY_KEYS.map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-apex-muted">{FACILITY_INFO[k].label}</span>
                <span className="num font-semibold">L{team.facilities[k].level}</span>
              </div>
            ))}
          </div>
          <div className="label mb-2 mt-4">History</div>
          <table className="table-apex text-xs">
            <thead>
              <tr>
                <th>Season</th>
                <th>Series</th>
                <th>Pos</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {[...team.history].reverse().slice(0, 10).map((h) => (
                <tr key={h.season}>
                  <td>S{h.season}</td>
                  <td>
                    <DivisionBadge division={h.division} />
                  </td>
                  <td className={h.champion ? 'font-bold text-yellow-300' : ''}>
                    P{h.position} {h.promoted ? '▲' : h.relegated ? '▼' : ''}
                  </td>
                  <td>{h.points}</td>
                </tr>
              ))}
              {team.history.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-apex-muted">
                    First season in {DIVISIONS[team.division].name}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
