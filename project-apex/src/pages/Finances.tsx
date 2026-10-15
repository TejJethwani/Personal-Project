import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIVISIONS } from '@/engine/config/divisions';
import { ECONOMY_TUNING } from '@/engine/config/tuning';
import { teamPosition } from '@/engine/championship/standings';
import { CATEGORY_LABELS, REVENUE_CATEGORIES, seasonTotals } from '@/engine/finance/ledger';
import { describeExpectation, expectationProgress, negotiateSponsor, signSponsor, sponsorSlotsUsed, terminateSponsor, TIER_LABELS, type SponsorAsk } from '@/engine/finance/sponsors';
import { financialForecast, overdraftLimit } from '@/engine/finance/weekly';
import { seasonPerformance } from '@/engine/race/weekend';
import { playerTeam } from '@/engine/selectors';
import type { SponsorOffer, SponsorTier, TxCategory } from '@/engine/types';
import { Badge, Button, cn, Empty, Panel, Progress, SectionTitle, Stat, Tabs } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';

const tooltipStyle = { background: '#121419', border: '1px solid #262a33', fontSize: 12 };

export function FinancesPage() {
  const game = useGame();
  const [tab, setTab] = useState<'overview' | 'sponsors' | 'ledger'>('overview');
  const team = playerTeam(game);
  return (
    <div className="space-y-5">
      <SectionTitle sub={`${DIVISIONS[team.division].name} economy · typical team budget ${money(DIVISIONS[team.division].typicalBudget)} per season`}>Finances</SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'sponsors', label: 'Sponsorship', count: game.player.sponsorOffers.length },
          { id: 'ledger', label: 'Transactions' },
        ]}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'sponsors' && <Sponsors />}
      {tab === 'ledger' && <Ledger />}
    </div>
  );
}

function Overview() {
  const game = useGame();
  const team = playerTeam(game);
  const totals = seasonTotals(team, game.season);
  const forecast = financialForecast(game, team);
  const cats = Object.entries(totals.byCategory)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k as TxCategory], value: v ?? 0, revenue: REVENUE_CATEGORIES.includes(k as TxCategory) }))
    .sort((a, b) => b.value - a.value);
  const cashData = team.cashHistory.map((c) => ({ week: `W${c.week}`, cash: Math.round(c.cash) }));
  const history = [...team.financeHistory.map((h) => ({ season: `S${h.season}`, profit: Math.round(h.profit), revenue: Math.round(h.revenue), expenses: -Math.round(h.expenses) })), { season: `S${game.season}*`, profit: Math.round(totals.revenue - totals.expenses), revenue: Math.round(totals.revenue), expenses: -Math.round(totals.expenses) }];
  const limit = overdraftLimit(game, team);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="panel p-4">
          <Stat label="Available cash" value={<span className={team.cash < 0 ? 'text-red-400' : ''}>{money(team.cash)}</span>} sub={`Overdraft limit ${money(limit)}`} />
        </div>
        <div className="panel p-4">
          <Stat label="Season revenue" value={money(totals.revenue)} />
        </div>
        <div className="panel p-4">
          <Stat label="Season expenses" value={money(totals.expenses)} />
        </div>
        <div className="panel p-4">
          <Stat label="Weekly running costs" value={money(forecast.weeklyBurn)} sub="salaries, upkeep, academy" />
        </div>
        <div className="panel p-4">
          <Stat label="Forecast end of season" value={<span className={forecast.projectedEndCash < 0 ? 'text-red-400' : 'text-emerald-300'}>{money(forecast.projectedEndCash)}</span>} sub={`${forecast.racesRemaining} races, ${forecast.weeksRemaining} weeks left`} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Bank balance this season">
          {cashData.length < 2 ? (
            <Empty>The chart fills in as the season progresses.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={cashData}>
                  <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="#5c6372" fontSize={11} />
                  <YAxis stroke="#5c6372" fontSize={11} tickFormatter={(v) => money(v)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="cash" stroke="#e10600" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Profit and loss by season">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={history}>
                <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
                <XAxis dataKey="season" stroke="#5c6372" fontSize={11} />
                <YAxis stroke="#5c6372" fontSize={11} tickFormatter={(v) => money(v)} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                <ReferenceLine y={0} stroke="#5c6372" />
                <Bar dataKey="revenue" fill="#22c55e" opacity={0.75} />
                <Bar dataKey="expenses" fill="#ef4444" opacity={0.75} />
                <Bar dataKey="profit">
                  {history.map((h, i) => (
                    <Cell key={i} fill={h.profit >= 0 ? '#38bdf8' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="This season by category">
          {cats.length === 0 ? (
            <Empty>No transactions yet.</Empty>
          ) : (
            <div className="space-y-1.5 text-sm">
              {cats.map((c) => (
                <div key={c.name} className="flex justify-between">
                  <span className="text-apex-muted">{c.name}</span>
                  <span className={c.value >= 0 ? 'text-emerald-300' : 'text-red-300'}>{money(c.value, { sign: true })}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Forecast to season end">
          <div className="space-y-1.5 text-sm">
            {forecast.breakdown.map((b) => (
              <div key={b.label} className="flex justify-between">
                <span className="text-apex-muted">{b.label}</span>
                <span className={b.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}>{money(b.amount, { sign: true })}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-apex-line pt-2 font-semibold">
              <span>Projected balance</span>
              <span>{money(forecast.projectedEndCash)}</span>
            </div>
            <p className="pt-2 text-xs text-apex-muted">R&amp;D projects and facility upgrades are paid when started and are not included.</p>
          </div>
        </Panel>
        <Panel title="Contract obligations">
          <table className="table-apex text-sm">
            <thead>
              <tr>
                <th>Season</th>
                <th>Drivers</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {forecast.obligations.map((o) => (
                <tr key={o.season}>
                  <td>S{o.season}</td>
                  <td>{money(o.drivers)}</td>
                  <td>{money(o.staff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-apex-muted">Salaries are paid weekly across the {ECONOMY_TUNING.weeksPerSeason}-week season.</p>
        </Panel>
      </div>
    </div>
  );
}

function Sponsors() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const startSeason = game.phase === 'offseason' || game.phase === 'seasonReview' ? game.season + 1 : game.season;
  const used = sponsorSlotsUsed(team, startSeason);
  const position = teamPosition(game, team.id);
  const perf = seasonPerformance(game, team);
  const tiers: SponsorTier[] = ['title', 'major', 'minor'];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => (
          <div key={t} className="panel p-4">
            <div className="label">{TIER_LABELS[t]}</div>
            <div className="num mt-1 text-2xl font-bold">
              {used[t]} / {ECONOMY_TUNING.sponsorSlots[t]}
            </div>
            <div className="text-xs text-apex-muted">slots filled</div>
          </div>
        ))}
      </div>
      <Panel title="Active partners">
        {team.sponsors.length === 0 ? (
          <Empty>No sponsors. Sign offers below: sponsorship is the main source of income.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {team.sponsors.map((d) => {
              const prog = expectationProgress(d.expectation, position, perf);
              return (
                <div key={d.name} className="rounded-lg border border-apex-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg font-bold uppercase">{d.name}</div>
                      <div className="text-xs text-apex-muted">
                        {d.industry} · {TIER_LABELS[d.tier]} · S{d.startSeason}–S{d.endSeason}
                      </div>
                    </div>
                    <Badge tone={d.risk === 'safe' ? 'green' : d.risk === 'highRisk' ? 'red' : 'amber'}>{d.risk === 'highRisk' ? 'High risk' : d.risk}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <Stat label="Per race" value={money(d.perRace)} />
                    <Stat label="Podium bonus" value={money(d.podiumBonus)} />
                    <Stat label="Win bonus" value={money(d.winBonus)} />
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between text-xs">
                      <span>{describeExpectation(d.expectation)}</span>
                      <span className={prog.met ? 'text-emerald-300' : 'text-amber-300'}>{prog.text}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="w-20 text-apex-muted">Satisfaction</span>
                      <Progress value={d.satisfaction} className="flex-1" color={d.satisfaction < 30 ? '#ef4444' : d.satisfaction < 60 ? '#f59e0b' : '#22c55e'} />
                      <span>{Math.round(d.satisfaction)}</span>
                    </div>
                    {d.championshipBonus && (
                      <div className="mt-1 text-xs text-apex-muted">
                        Championship bonus: {money(d.championshipBonus.amount)} for P{d.championshipBonus.position} or better
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-right">
                    <Button size="xs" variant="danger" onClick={async () => (await askConfirm(`End the ${d.name} deal early? Penalty ${money(d.perRace * 2)} and reputation loss.`)) && act((g) => terminateSponsor(g, d.name))}>
                      Terminate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel title="Offers on the table">
        {game.player.sponsorOffers.length === 0 ? (
          <Empty>No offers right now. New interest arrives every few weeks: results and reputation attract bigger brands.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {game.player.sponsorOffers.map((o) => (
              <OfferCard key={o.id} offer={o} slotFree={used[o.tier] < ECONOMY_TUNING.sponsorSlots[o.tier]} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function OfferCard({ offer: o, slotFree }: { offer: SponsorOffer; slotFree: boolean }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const [message, setMessage] = useState<string | null>(null);
  const races = DIVISIONS[playerTeam(game).division].races;
  const ask = (a: SponsorAsk) => {
    const r = act((g) => negotiateSponsor(g, o.id, a));
    if (r) setMessage(r.message);
  };
  const weeksLeft = o.expiresAbsWeek - (game.season * 52 + game.week);
  return (
    <div className={cn('rounded-lg border p-4', o.risk === 'highRisk' ? 'border-red-900/60' : 'border-apex-line')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg font-bold uppercase">{o.name}</div>
          <div className="text-xs text-apex-muted">
            {o.industry} · {TIER_LABELS[o.tier]} · {o.seasons} season{o.seasons > 1 ? 's' : ''} · expires in {Math.max(0, weeksLeft)} wk
          </div>
        </div>
        <Badge tone={o.risk === 'safe' ? 'green' : o.risk === 'highRisk' ? 'red' : 'amber'}>{o.risk === 'highRisk' ? 'High risk' : o.risk}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
        <Stat label="Per race" value={money(o.perRace)} sub={`${money(o.perRace * races)}/season`} />
        <Stat label="Signing" value={money(o.signingBonus)} />
        <Stat label="Podium" value={money(o.podiumBonus)} />
        <Stat label="Win" value={money(o.winBonus)} />
      </div>
      <div className="mt-2 text-xs">
        <span className="text-apex-muted">Expectation: </span>
        {describeExpectation(o.expectation)}
        {o.championshipBonus && <span className="text-apex-muted"> · bonus {money(o.championshipBonus.amount)} for P{o.championshipBonus.position}+</span>}
      </div>
      {message && <div className="mt-2 rounded bg-white/5 px-2 py-1 text-xs">{message}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => ask('moreBase')}>
          Ask more per race
        </Button>
        <Button size="xs" variant="ghost" onClick={() => ask('moreBonus')}>
          Ask bigger bonuses
        </Button>
        <Button size="xs" variant="ghost" onClick={() => ask('longer')}>
          Longer
        </Button>
        <Button size="xs" variant="ghost" onClick={() => ask('shorter')}>
          Shorter
        </Button>
        <span className="text-[11px] text-apex-dim">patience {o.patience}</span>
        <Button size="sm" variant="primary" className="ml-auto" disabled={!slotFree} title={slotFree ? '' : 'No free slot of this tier'} onClick={() => act((g) => signSponsor(g, o.id), { success: `${o.name} signed!` })}>
          Sign
        </Button>
      </div>
    </div>
  );
}

function Ledger() {
  const game = useGame();
  const team = playerTeam(game);
  const rows = [...team.ledger].reverse().slice(0, 250);
  return (
    <div className="panel max-h-[70vh] overflow-auto">
      <table className="table-apex">
        <thead>
          <tr>
            <th>When</th>
            <th>Category</th>
            <th>Description</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i}>
              <td className="text-apex-muted">
                S{t.season} {t.week > 0 ? `W${t.week}` : t.week === 0 ? 'Pre' : 'Off'}
              </td>
              <td>{CATEGORY_LABELS[t.category]}</td>
              <td>{t.label}</td>
              <td className={cn('num text-right font-semibold', t.amount >= 0 ? 'text-emerald-300' : 'text-red-300')}>{money(t.amount, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <Empty className="m-4">No transactions yet this season.</Empty>}
    </div>
  );
}
