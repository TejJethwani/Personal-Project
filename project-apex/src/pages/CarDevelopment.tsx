import { FlaskConical, Gauge, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTIES } from '@/engine/config/difficulty';
import { DIVISIONS } from '@/engine/config/divisions';
import { COMPONENT_INFO, COMPONENT_KEYS, carRating, overallPace, PACE_COMPONENTS, trackPerformance } from '@/engine/car/car';
import { cancelProject, canStartProject, capacityUsed, engineeringCapacity, estimateRivalComponent, projectPhase, quoteProject, RND_SCALE_LABELS, RND_SCALES, startProject } from '@/engine/car/rnd';
import { playerTeam, teamsInDivision } from '@/engine/selectors';
import type { ComponentKey, RnDScale, Team } from '@/engine/types';
import { TeamDot, TeamLink } from '@/components/common';
import { Badge, Button, Empty, Panel, Progress, RatingBar, SectionTitle, Segmented, Select, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';

/** What the winter does to car development at this difficulty. */
function developmentRuleText(difficulty: keyof typeof DIFFICULTIES): string {
  const rules = DIFFICULTIES[difficulty].carDevelopment;
  const boost = ' At season end every team gets a development boost by championship position: the top teams are rewarded, the bottom teams get catch-up help, mid-table gets the least.';
  if (rules.playerNeverLoses) return `Your car keeps every upgrade season after season: its ratings never drop over the winter, and promotion carries its advantage over the field into the new series.${boost}`;
  const kept = Math.round(rules.carry.stable * 100);
  return `On ${DIFFICULTIES[difficulty].label} the winter rule changes take development away from every team: the series is pulled back toward the regulation baseline and each car keeps about ${kept}% of its advantage under stable rules (less under bigger changes). Upgrades are ${rules.upgradeScale}× bigger to make up for it.${boost}`;
}

function estimatedPace(game: ReturnType<typeof useGame>, viewer: Team, t: Team): { value: number; unc: number } {
  if (viewer.id === t.id) return { value: overallPace(t.car), unc: 0 };
  const parts = PACE_COMPONENTS.map((k) => estimateRivalComponent(game, viewer, t, k));
  const value = parts.reduce((s, p) => s + p.value, 0) / parts.length;
  return { value: value + (overallPace(t.car) - PACE_COMPONENTS.reduce((s, k) => s + t.car.components[k], 0) / PACE_COMPONENTS.length), unc: parts[0].uncertainty * 0.6 };
}

export function CarPage() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const cfg = DIVISIONS[team.division];
  const [component, setComponent] = useState<ComponentKey>('aerodynamics');
  const [scale, setScale] = useState<RnDScale>('minor');
  const quote = quoteProject(game, team, component, scale);
  const check = canStartProject(game, team, component, scale);
  const cap = engineeringCapacity(game, team);
  const used = capacityUsed(team);
  const rivals = teamsInDivision(game, team.division);
  const paces = rivals.map((t) => ({ t, ...estimatedPace(game, team, t) })).sort((a, b) => b.value - a.value);
  const maxPace = Math.max(...paces.map((p) => p.value + p.unc)) + 2;
  const minPace = Math.min(...paces.map((p) => p.value - p.unc)) - 2;
  const upcoming = game.calendars[team.division].filter((e) => !e.completed).slice(0, 8);
  const regNow = game.regulations.find((r) => r.division === team.division);
  const regNext = game.nextRegulations.find((r) => r.division === team.division);
  const avg = (k: ComponentKey) => rivals.reduce((s, t) => s + estimateRivalComponent(game, team, t, k).value, 0) / rivals.length;
  const best = (k: ComponentKey) => Math.max(...rivals.map((t) => estimateRivalComponent(game, team, t, k).value));

  return (
    <div className="space-y-6">
      <SectionTitle sub={`${cfg.name} technical regulations. Ratings are relative to the series' cars.`}>Car Development</SectionTitle>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Car performance" icon={<Gauge size={15} className="text-apex-red" />} actions={<span className="num text-2xl font-bold">{carRating(team.car).toFixed(1)}</span>}>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {COMPONENT_KEYS.map((k) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{COMPONENT_INFO[k].label}</span>
                  <span className="text-apex-muted">
                    avg {avg(k).toFixed(0)} · best {best(k).toFixed(0)}
                    {team.car.developmentLevel[k] > 0 && <Badge className="ml-1" tone="blue">+{team.car.developmentLevel[k].toFixed(1)} dev</Badge>}
                  </span>
                </div>
                <RatingBar value={team.car.components[k]} />
                <div className="text-[11px] text-apex-dim">{COMPONENT_INFO[k].effect}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Field comparison (estimated pace)">
          <div className="space-y-2">
            {paces.map(({ t, value, unc }) => {
              const left = ((value - unc - minPace) / (maxPace - minPace)) * 100;
              const width = ((unc * 2) / (maxPace - minPace)) * 100;
              const point = ((value - minPace) / (maxPace - minPace)) * 100;
              return (
                <div key={t.id} className="grid grid-cols-[140px_1fr_44px] items-center gap-2 text-sm">
                  <TeamLink team={t} short={false} className="truncate text-xs" />
                  <div className="relative h-4 rounded bg-white/[0.04]">
                    {unc > 0 && <div className="absolute inset-y-1 rounded bg-white/15" style={{ left: `${left}%`, width: `${width}%` }} />}
                    <div className="absolute top-0 h-4 w-1.5 -translate-x-1/2 rounded" style={{ left: `${point}%`, background: t.isPlayer ? '#e10600' : t.colors.primary, boxShadow: '0 0 0 1px rgba(255,255,255,0.3)' }} />
                  </div>
                  <span className="num text-right">{t.isPlayer ? value.toFixed(1) : `~${value.toFixed(0)}`}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-apex-muted">Rival data comes from GPS traces and timing. Uncertainty shrinks with better Engineering and Race Strategy departments.</p>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Start an R&D project" icon={<FlaskConical size={15} className="text-apex-red" />} actions={<span className="text-xs text-apex-muted">Capacity {used}/{cap}</span>}>
          <Progress value={(used / cap) * 100} className="mb-4" />
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label mb-1.5">Component</div>
                <Select<ComponentKey> value={component} onChange={setComponent} className="w-full" options={COMPONENT_KEYS.map((k) => ({ value: k, label: `${COMPONENT_INFO[k].label} (${team.car.components[k].toFixed(0)})` }))} />
              </div>
              <div>
                <div className="label mb-1.5">Scale</div>
                <Segmented value={scale} onChange={setScale} options={RND_SCALES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-apex-line bg-apex-bg/50 p-4 sm:grid-cols-4">
              <Stat label="Cost" value={money(quote.cost)} />
              <Stat label="Duration" value={`${quote.weeks} wk`} sub="design → build → test" />
              <Stat label="Expected gain" value={`+${quote.expectedGain.toFixed(1)}`} sub={`${COMPONENT_INFO[component].short}`} />
              <Stat label="Risk" value={`${Math.round(quote.risk * 100)}%`} sub={`uses ${quote.capacity} capacity`} />
            </div>
            <p className="text-xs text-apex-muted">
              Outcomes: success, underwhelming, breakthrough, or a reliability compromise found in testing. Repeated upgrades to the same area this season and already-strong components return less. Better Technical Director, Aero Center, Engineering and Manufacturing facilities improve gains, cost and risk.
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-amber-300">{!check.ok && check.reason}</span>
              <Button variant="primary" disabled={!check.ok} onClick={() => act((g) => startProject(g, team.id, component, scale), { success: `${RND_SCALE_LABELS[scale]} started on ${COMPONENT_INFO[component].label}.` })}>
                Start project ({money(quote.cost)})
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Active projects">
          {team.rnd.length === 0 ? (
            <Empty>No projects running. Idle engineers are wasted money.</Empty>
          ) : (
            <div className="space-y-3">
              {team.rnd.map((p) => {
                const total = p.weeksTotal + p.delayWeeks;
                const phase = projectPhase(p);
                return (
                  <div key={p.id} className="rounded-lg border border-apex-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">
                        {COMPONENT_INFO[p.component].label} <span className="text-xs text-apex-muted">· {RND_SCALE_LABELS[p.scale]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={phase === 'testing' ? 'purple' : phase === 'manufacture' ? 'amber' : 'blue'}>{phase}</Badge>
                        {p.delayWeeks > 0 && <Badge tone="red">delayed +{p.delayWeeks}w</Badge>}
                        <Button size="xs" variant="ghost" onClick={async () => (await askConfirm('Cancel this project? The money already spent is lost.')) && act((g) => cancelProject(g, team.id, p.id))}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <Progress value={(p.weeksElapsed / total) * 100} className="mt-2" />
                    <div className="mt-1 flex justify-between text-xs text-apex-muted">
                      <span>
                        Week {p.weeksElapsed}/{total}
                      </span>
                      <span>Expected +{p.expectedGain.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {team.rndHistory.length > 0 && (
            <div className="mt-5">
              <div className="label mb-2">Completed</div>
              <table className="table-apex text-xs">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Component</th>
                    <th>Scale</th>
                    <th>Outcome</th>
                    <th className="text-right">Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {[...team.rndHistory].reverse().slice(0, 12).map((r) => (
                    <tr key={r.id}>
                      <td>
                        S{r.season} W{r.week}
                      </td>
                      <td>{COMPONENT_INFO[r.component].label}</td>
                      <td className="capitalize">{r.scale}</td>
                      <td>
                        <Badge tone={r.outcome === 'breakthrough' ? 'purple' : r.outcome === 'success' ? 'green' : r.outcome === 'underwhelming' ? 'amber' : 'red'}>{r.outcome === 'reliabilityCompromise' ? 'reliability hit' : r.outcome}</Badge>
                      </td>
                      <td className="num text-right">
                        +{r.gain.toFixed(1)}
                        {r.reliabilityLoss > 0 && <span className="text-red-400"> / REL −{r.reliabilityLoss}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Track-by-track outlook">
          {upcoming.length === 0 ? (
            <Empty>No upcoming races.</Empty>
          ) : (
            <table className="table-apex">
              <thead>
                <tr>
                  <th>Rd</th>
                  <th>Circuit</th>
                  <th>Character</th>
                  <th>Our pace</th>
                  <th>Est. rank</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => {
                  const c = game.circuits[e.circuitId];
                  const mine = trackPerformance(team.car, c);
                  const rank = rivals.filter((t) => t.id !== team.id && trackPerformance(t.car, c) > mine).length + 1;
                  return (
                    <tr key={e.id}>
                      <td>{e.round}</td>
                      <td>{c.location}</td>
                      <td className="text-xs text-apex-muted">{c.weights.straightLine + c.weights.powerUnit > 0.36 ? 'Power' : c.weights.aerodynamics + c.weights.cornering > 0.38 ? 'Downforce' : 'Balanced'}</td>
                      <td className="num">{mine.toFixed(1)}</td>
                      <td>
                        <Badge tone={rank <= 3 ? 'green' : rank <= 6 ? 'amber' : 'red'}>~P{rank}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Regulations" icon={<ScrollText size={15} className="text-apex-red" />}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="label">This season</div>
              <p>{regNow?.text ?? `${cfg.name} inaugural regulations.`}</p>
            </div>
            <div>
              <div className="label">Next season</div>
              <p>{regNext ? regNext.text : 'Changes for next season are announced around week 30.'}</p>
            </div>
            <p className="text-xs text-apex-muted">{developmentRuleText(game.settings.difficulty)}</p>
            <div className="flex items-center gap-2 text-xs text-apex-muted">
              <TeamDot team={team} /> Development this season: {Object.values(team.car.developmentLevel).reduce((a, b) => a + b, 0).toFixed(1)} upgrade units
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
