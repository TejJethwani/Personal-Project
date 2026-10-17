import { AlertTriangle, CalendarDays, CheckCircle2, CircleAlert, Cloud, CloudRain, Info, Sun, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { objectiveStatus } from '@/engine/board';
import { divisionAbove, DIVISIONS } from '@/engine/config/divisions';
import { licensingChecks } from '@/engine/season/promotion';
import { carRating } from '@/engine/car/car';
import { capacityUsed, engineeringCapacity } from '@/engine/car/rnd';
import { divisionStandings } from '@/engine/championship/standings';
import { driverName, overall } from '@/engine/drivers/ratings';
import { resolveOpportunity } from '@/engine/events/opportunities';
import { freeSponsorTiers } from '@/engine/finance/sponsors';
import { financialForecast } from '@/engine/finance/weekly';
import { eventLaps } from '@/engine/config/divisions';
import { lineupIssues } from '@/engine/race/weekend';
import { nextPlayerEvent } from '@/engine/europe/season';
import { findEvent } from '@/engine/season/calendar';
import { circuitTags } from '@/engine/data/circuits';
import { H2HBanner } from '@/components/EuroCommon';
import { playerTeam, raceDrivers, teamsInDivision } from '@/engine/selectors';
import { STAFF_ROLE_INFO, STAFF_ROLES } from '@/engine/staff/staff';
import type { GameState } from '@/engine/types';
import { DivisionBadge, DriverLink, FormDots, TeamCar, TeamLink } from '@/components/common';
import { Badge, Button, Panel, Progress, RatingPill, SectionTitle, Stat } from '@/components/ui';
import { money, ordinal } from '@/lib/format';
import { useGame, useStore, type Page } from '@/store/gameStore';
import { useContinue } from '@/components/Shell';
import { ChallengesPanel, SeasonTwistsPanel } from '@/components/SeasonFeatures';

interface AlertItem {
  level: 'critical' | 'warning' | 'info';
  text: string;
  page?: Page;
}

function computeAlerts(game: GameState): AlertItem[] {
  const team = playerTeam(game);
  const out: AlertItem[] = [];
  for (const issue of lineupIssues(game, team)) out.push({ level: issue.includes('cannot start') ? 'critical' : 'warning', text: issue, page: 'market' });
  if (team.cash < 0) out.push({ level: 'critical', text: `Bank balance is negative (${money(team.cash)}). Overdraft interest is accruing.`, page: 'finances' });
  else {
    const f = financialForecast(game, team);
    if (f.projectedEndCash < 0 && (game.phase === 'season' || game.phase === 'preseason')) out.push({ level: 'warning', text: `Forecast: ${money(f.projectedEndCash)} at season end. Find sponsors or cut costs.`, page: 'finances' });
  }
  if (game.phase === 'season' && game.week >= 14) {
    for (const d of raceDrivers(game, team)) {
      if (d.contract && d.contract.endSeason <= game.season && !d.futureContract) out.push({ level: game.week >= 30 ? 'warning' : 'info', text: `${driverName(d)}'s contract expires at the end of the season.`, page: 'drivers' });
    }
  }
  const vacancies = STAFF_ROLES.filter((r) => !team.staff[r]);
  if (vacancies.length) out.push({ level: 'info', text: `Vacant staff roles: ${vacancies.map((r) => STAFF_ROLE_INFO[r].label).join(', ')}.`, page: 'staff' });
  if ((game.phase === 'season' || game.phase === 'preseason') && capacityUsed(team) < engineeringCapacity(game, team) && game.week < 40) out.push({ level: 'info', text: `Engineering capacity available (${capacityUsed(team)}/${engineeringCapacity(game, team)} in use). Start an R&D project.`, page: 'car' });
  // In the promotion fight without a licence for the series above.
  const up = divisionAbove(team.division);
  if (up && game.phase === 'season') {
    const { constructors } = divisionStandings(game, team.division);
    const pos = constructors.findIndex((r) => r.id === team.id) + 1;
    const missing = licensingChecks(game, team, up).filter((c) => !c.met);
    if (pos >= 1 && pos <= 4 && constructors[0].points > 0 && missing.length) {
      out.push({ level: 'warning', text: `You are P${pos}, in the promotion fight, but you cannot go up without a ${DIVISIONS[up].name} licence. Missing: ${missing.map((c) => c.label).join(', ')}.`, page: 'championship' });
    }
  }
  const free = freeSponsorTiers(team, game.season);
  if (free.length && game.player.sponsorOffers.length) out.push({ level: 'info', text: `Open sponsorship slots: ${[...new Set(free)].join(', ')}. ${game.player.sponsorOffers.length} offer(s) waiting.`, page: 'finances' });
  return out;
}

const LEVEL_ICON = { critical: XCircle, warning: AlertTriangle, info: Info };

export function Headquarters() {
  const game = useGame();
  const setPage = useStore((s) => s.setPage);
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const cfg = DIVISIONS[team.division];
  const ev = nextPlayerEvent(game);
  const alerts = computeAlerts(game);
  const standings = divisionStandings(game, team.division);
  const myPos = standings.constructors.findIndex((r) => r.id === team.id) + 1;
  const rivals = teamsInDivision(game, team.division);
  const avgCar = rivals.reduce((s, t) => s + carRating(t.car), 0) / rivals.length;
  const forecast = financialForecast(game, team);
  const recent = game.calendars[team.division].filter((e) => e.completed).slice(-3).reverse();
  const cont = useContinue();
  const drivers = raceDrivers(game, team);

  return (
    <div className="space-y-6">
      <SectionTitle sub={`${cfg.name} · Season ${game.season} (${game.year}) · ${game.player.principalName}, Team Principal`}>Headquarters</SectionTitle>

      {game.phase === 'gameOver' && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">
          <div className="font-display text-3xl font-black uppercase text-red-300">Career over</div>
          <p className="mt-2 text-red-100">{game.player.gameOverReason}</p>
          <p className="mt-2 text-sm text-apex-muted">You can still browse your history, or start a new career from Settings.</p>
        </div>
      )}

      {game.phase === 'preseason' && (
        <div className="relative overflow-hidden rounded-xl border border-apex-red/40 bg-apex-panel p-6 shadow-glow">
          <div className="pointer-events-none absolute inset-0 bg-apex-grad" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="label text-apex-red">Season {game.season} briefing</div>
              <h2 className="mt-1 font-display text-3xl font-black uppercase">{cfg.name}: {cfg.tagline}</h2>
              <p className="mt-2 max-w-2xl text-sm text-apex-muted">
                {cfg.races} races. Budget {money(team.cash)}. Your car is rated {carRating(team.car).toFixed(1)} against a field average of {avgCar.toFixed(1)}. Line-up: {drivers.map((d) => `${driverName(d)} (${overall(d)})`).join(' and ') || 'no drivers signed!'}.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {team.objectives.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-md border border-apex-line bg-apex-bg/60 px-3 py-2 text-sm">
                    <Badge tone={o.importance === 'critical' ? 'red' : o.importance === 'major' ? 'amber' : 'neutral'}>{o.importance}</Badge>
                    {o.description}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-apex-muted">Prepare now: sign sponsors (Finances), hire staff (Staff &amp; Facilities), start R&amp;D (Car Development) and sign drivers (Driver Market). Press <b className="text-white">{cont.label}</b> when ready.</p>
            </div>
            <TeamCar team={team} width={300} />
          </div>
        </div>
      )}

      {game.player.opportunities.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {game.player.opportunities.map((op) => (
            <div key={op.id} className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2">
                <Badge tone="amber">Decision</Badge>
                <span className="font-display text-lg font-bold uppercase">{op.title}</span>
              </div>
              <p className="mt-2 text-sm text-white/85">{op.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {op.choices.map((c) => (
                  <Button key={c.id} size="sm" variant={c.id === 'accept' ? 'primary' : 'secondary'} title={c.description} onClick={() => act((g) => resolveOpportunity(g, op.id, c.id), { success: (m) => m })}>
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {game.phase !== 'gameOver' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SeasonTwistsPanel game={game} division={team.division} />
          <ChallengesPanel game={game} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Next event" icon={<CalendarDays size={15} className="text-apex-red" />} className="xl:col-span-2">
          {ev ? (
            <NextEvent eventId={ev.id} />
          ) : game.phase === 'seasonReview' ? (
            <div className="flex items-center justify-between">
              <span>The season is complete.</span>
              <Button variant="primary" onClick={() => setPage('seasonReview')}>
                Season review
              </Button>
            </div>
          ) : (
            <div className="text-sm text-apex-muted">No events scheduled. Off-season transfer window is open.</div>
          )}
        </Panel>
        <Panel title="Alerts" icon={<CircleAlert size={15} className="text-apex-red" />}>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 size={16} /> Everything is in order.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => {
                const Icon = LEVEL_ICON[a.level];
                return (
                  <li key={i}>
                    <button onClick={() => a.page && setPage(a.page)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5">
                      <Icon size={15} className={a.level === 'critical' ? 'mt-0.5 shrink-0 text-red-400' : a.level === 'warning' ? 'mt-0.5 shrink-0 text-amber-400' : 'mt-0.5 shrink-0 text-sky-400'} />
                      <span>{a.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Board objectives" actions={<span className="text-xs text-apex-muted">Confidence {Math.round(team.boardConfidence)}%</span>}>
          <Progress value={team.boardConfidence} color={team.boardConfidence < 30 ? '#ef4444' : team.boardConfidence < 55 ? '#f59e0b' : '#22c55e'} className="mb-4" />
          {team.objectives.length === 0 ? (
            <div className="text-sm text-apex-muted">Objectives are set in pre-season.</div>
          ) : (
            <ul className="space-y-2.5">
              {team.objectives.map((o) => {
                const st = objectiveStatus(game, team, o);
                return (
                  <li key={o.id} className="flex items-start gap-2 text-sm">
                    {st.met ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-apex-dim" />}
                    <div>
                      <div>{o.description}</div>
                      <div className="text-xs text-apex-muted">
                        {st.text} · <span className="uppercase">{o.importance}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title={`${cfg.name} standings`} actions={<Button size="xs" variant="ghost" onClick={() => setPage('championship')}>Full table</Button>}>
          <table className="table-apex">
            <tbody>
              {standings.constructors.slice(0, 6).map((r, i) => (
                <tr key={r.id} className={r.id === team.id ? 'bg-apex-red/[0.08]' : ''}>
                  <td className="num w-8 font-bold">{i + 1}</td>
                  <td>
                    <TeamLink team={game.teams[r.id]} />
                  </td>
                  <td className="num text-right font-semibold">{r.points}</td>
                </tr>
              ))}
              {myPos > 6 && (
                <tr className="bg-apex-red/[0.08]">
                  <td className="num font-bold">{myPos}</td>
                  <td>
                    <TeamLink team={team} />
                  </td>
                  <td className="num text-right font-semibold">{standings.constructors[myPos - 1].points}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Team snapshot">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Car rating" value={carRating(team.car).toFixed(1)} sub={`Field avg ${avgCar.toFixed(1)}`} />
            <Stat label="Reputation" value={Math.round(team.reputation)} sub={`${cfg.name} typical ${cfg.typicalReputation}`} />
            <Stat label="Cash" value={money(team.cash)} sub={`Weekly burn ${money(forecast.weeklyBurn)}`} />
            <Stat label="Projected end" value={money(forecast.projectedEndCash)} sub="cash at season end" />
          </div>
          <div className="mt-4 space-y-2">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <DriverLink driver={d} />
                <div className="flex items-center gap-2">
                  <FormDots form={d.form} />
                  <RatingPill value={overall(d)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent results">
          {recent.length === 0 ? (
            <div className="text-sm text-apex-muted">No races completed this season.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => {
                const r = game.results[e.id];
                const mine = r.entries.filter((x) => x.teamId === team.id);
                return (
                  <button key={e.id} onClick={() => useStore.getState().openResult(e.id)} className="flex w-full items-center justify-between rounded-md border border-apex-line px-3 py-2 text-left text-sm hover:border-apex-line2">
                    <span>
                      R{e.round} · {game.circuits[e.circuitId].location}
                      <span className="ml-2 text-xs text-apex-muted">won by {driverName(game.drivers[r.entries[0].driverId])}</span>
                    </span>
                    <span className="flex gap-2">
                      {mine.map((m) => (
                        <Badge key={m.driverId} tone={m.status !== 'finished' ? 'red' : m.position <= 3 ? 'gold' : m.points > 0 ? 'green' : 'neutral'}>
                          {game.drivers[m.driverId].lastName} {m.status === 'finished' ? ordinal(m.position) : 'DNF'}
                        </Badge>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Latest news" actions={<Button size="xs" variant="ghost" onClick={() => setPage('news')}>All news</Button>}>
          <ul className="space-y-2.5">
            {game.news.filter((n) => n.importance >= 2).slice(0, 5).map((n) => (
              <li key={n.id} className="border-l-2 border-apex-red/60 pl-3">
                <div className="text-sm font-semibold leading-snug">{n.headline}</div>
                <div className="text-xs text-apex-muted">
                  S{n.season} · {n.week > 0 ? `Week ${n.week}` : 'Off-season'} {n.division && <DivisionBadge division={n.division} className="ml-1 scale-90" />}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function WeatherIcon({ p }: { p: number }): ReactNode {
  if (p > 0.6) return <CloudRain size={18} className="text-sky-400" />;
  if (p > 0.3) return <Cloud size={18} className="text-apex-muted" />;
  return <Sun size={18} className="text-yellow-300" />;
}

function NextEvent({ eventId }: { eventId: string }) {
  const game = useGame();
  const setPage = useStore((s) => s.setPage);
  const team = playerTeam(game);
  const ev = findEvent(game, eventId)!;
  const c = game.circuits[ev.circuitId];
  const h2h = !!ev.euro && ev.euro.competition !== 'league';
  const laps = eventLaps(ev, c.laps);
  const live = game.weekend?.eventId === ev.id;
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_auto]">
      <div>
        {h2h ? (
          <H2HBanner game={game} event={ev} />
        ) : (
          <div className="flex items-center gap-2">
            <DivisionBadge division={ev.division} />
            <span className="label">{ev.euro ? `${ev.euro.label} · Week ${ev.week}` : `Round ${ev.round} of ${game.calendars[team.division].length} · Week ${ev.week}`}</span>
          </div>
        )}
        <div className="mt-1 font-display text-3xl font-black uppercase">{c.name}</div>
        <div className="text-sm text-apex-muted">
          {c.location} · {c.lengthKm.toFixed(2)} km · {laps} laps · {c.type}
        </div>
        <p className="mt-3 max-w-xl text-sm text-white/80">{c.character}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {circuitTags(c).map((t) => (
            <Badge key={t.label} tone={t.tone} title={t.title}>
              {t.label}
            </Badge>
          ))}
          <Badge>Overtaking {c.overtakingDifficulty > 0.7 ? 'very hard' : c.overtakingDifficulty > 0.45 ? 'moderate' : 'easy'}</Badge>
          <Badge tone="blue">Rain risk {Math.round(c.rainChance * 100)}%</Badge>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between gap-3">
        {live && game.weekend && (
          <div className="flex gap-3">
            {game.weekend.forecast.map((f, i) => (
              <div key={i} className="flex flex-col items-center rounded-md border border-apex-line px-2 py-1 text-[11px]">
                <WeatherIcon p={f.rainProbability} />
                {Math.round(f.rainProbability * 100)}%
              </div>
            ))}
          </div>
        )}
        {live ? (
          <Button variant="primary" size="lg" onClick={() => setPage('race')}>
            Enter race weekend
          </Button>
        ) : (
          <div className="text-right text-sm text-apex-muted">{ev.week - Math.max(0, game.week)} week(s) away</div>
        )}
      </div>
    </div>
  );
}
