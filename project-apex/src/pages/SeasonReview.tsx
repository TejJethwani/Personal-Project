import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, CheckCircle2, Crown, XCircle } from 'lucide-react';
import { DIFFICULTIES } from '@/engine/config/difficulty';
import { DIVISIONS } from '@/engine/config/divisions';
import { driverName } from '@/engine/drivers/ratings';
import { beginOffseason } from '@/engine/season/seasonEnd';
import { licensingChecks } from '@/engine/season/promotion';
import { playerTeam } from '@/engine/selectors';
import { DivisionBadge, DriverLink, TeamCar, TeamLink } from '@/components/common';
import { Badge, Button, Empty, Panel, SectionTitle, Stat } from '@/components/ui';
import { money, ordinal } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';
import { ChallengesPanel, SeasonTwistsPanel } from '@/components/SeasonFeatures';

/** What promotion does to the car at this difficulty. */
function carryText(difficulty: keyof typeof DIFFICULTIES): string {
  const carry = DIFFICULTIES[difficulty].carDevelopment.promotionCarry;
  if (carry >= 1) return 'Your car carries all of its development into the new series: its advantage over your current field becomes its advantage over the new one.';
  return `Your car is rebuilt to the new regulations and keeps about ${Math.round(carry * 100)}% of its advantage over the field.`;
}

export function SeasonReview() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const setPage = useStore((s) => s.setPage);
  const review = game.lastSeasonReview;
  const team = playerTeam(game);
  if (!review || (game.phase !== 'seasonReview' && game.phase !== 'gameOver')) {
    return (
      <div className="space-y-4">
        <SectionTitle>Season Review</SectionTitle>
        <Empty>The season review appears when the final race of the season is complete.</Empty>
        <Button onClick={() => setPage('hq')}>Back to Headquarters</Button>
      </div>
    );
  }
  const offer = game.player.promotionOffer;
  const go = (accept: boolean) => {
    act((g) => beginOffseason(g, accept), { success: accept && offer ? `Welcome to ${DIVISIONS[offer.to].name}!` : 'The off-season transfer window is open.' });
    setPage('hq');
  };
  const from = DIVISIONS[review.division];
  const to = offer ? DIVISIONS[offer.to] : null;
  return (
    <div className="space-y-6">
      <SectionTitle sub={`${from.name} · Season ${review.season}`}>Season Review</SectionTitle>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-xl border border-apex-red/40 bg-apex-panel p-6 shadow-glow">
        <div className="pointer-events-none absolute inset-0 bg-apex-grad" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="label text-apex-red">Final classification</div>
            <div className="mt-1 font-display text-6xl font-black uppercase">{ordinal(review.position)}</div>
            <div className="text-lg text-white/80">
              in the {from.name} teams' championship · {review.points} points
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {review.champion && (
                <Badge tone="gold" className="px-3 py-1 text-xs">
                  <Crown size={12} /> Champions
                </Badge>
              )}
              {review.promoted && (
                <Badge tone="green" className="px-3 py-1 text-xs">
                  <ArrowUp size={12} /> Promotion earned
                </Badge>
              )}
              {review.relegated && (
                <Badge tone="red" className="px-3 py-1 text-xs">
                  <ArrowDown size={12} /> Relegated to {review.newDivision}
                </Badge>
              )}
              <Badge className="px-3 py-1 text-xs">Prize money {money(review.prizeMoney)}</Badge>
              {review.challenges && review.challenges.total > 0 && (
                <Badge tone={review.challenges.completed === review.challenges.total ? 'gold' : 'neutral'} className="px-3 py-1 text-xs">
                  Challenges {review.challenges.completed}/{review.challenges.total}
                </Badge>
              )}
              {review.developmentBoost !== undefined && (
                <Badge tone="blue" className="px-3 py-1 text-xs" title="Added to every area of the car when the off-season starts. Top finishers are rewarded, the bottom teams get catch-up help, mid-table gets the least.">
                  Car development boost +{review.developmentBoost.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>
          <TeamCar team={team} width={320} />
        </div>
      </motion.div>

      {game.phase === 'gameOver' && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">
          <div className="font-display text-3xl font-black uppercase text-red-300">Career over</div>
          <p className="mt-2">{game.player.gameOverReason}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Board review">
          <Stat label="Board confidence" value={`${Math.round(review.boardConfidence)}%`} />
          <ul className="mt-4 space-y-2">
            {review.objectives.map((o) => (
              <li key={o.description} className="flex items-start gap-2 text-sm">
                {o.met ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" /> : <XCircle size={16} className="mt-0.5 text-red-400" />}
                {o.description}
              </li>
            ))}
          </ul>
          {review.notes.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-apex-line pt-3 text-xs text-apex-muted">
              {review.notes.map((n) => (
                <div key={n}>• {n}</div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Awards">
          <ul className="space-y-2">
            {review.awards.map((a, i) => (
              <li key={i} className="text-sm">
                <div className="label">{a.title}</div>
                <div className="flex items-center gap-2">
                  {a.driverId ? <DriverLink driver={game.drivers[a.driverId]} /> : a.teamId ? <TeamLink team={game.teams[a.teamId]} /> : null}
                  <span className="text-xs text-apex-muted">{a.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Looking ahead">
          <div className="space-y-3 text-sm">
            {review.regulation && (
              <div>
                <div className="label">Regulations</div>
                <p>{review.regulation.text}</p>
              </div>
            )}
            <div>
              <div className="label">Contracts expiring</div>
              {review.expiredDrivers.length ? (
                review.expiredDrivers.map((id) => (
                  <div key={id}>
                    <DriverLink driver={game.drivers[id]} /> <span className="text-xs text-apex-muted">leaves unless re-signed in the off-season</span>
                  </div>
                ))
              ) : (
                <p className="text-apex-muted">None: your line-up is settled.</p>
              )}
            </div>
            <p className="text-xs text-apex-muted">Next: a six-week off-season transfer window. Rivals will sign free agents each week; act early for the best drivers.</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SeasonTwistsPanel game={game} division={review.newDivision} season={review.season + 1} title={`Next season's twists · ${DIVISIONS[review.newDivision].name}`} />
        <ChallengesPanel game={game} />
      </div>

      {game.phase === 'seasonReview' && (
        <div className="panel p-6">
          {offer && to ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex items-center gap-2">
                  <DivisionBadge division={review.division} /> → <DivisionBadge division={offer.to} />
                </div>
                <h2 className="mt-2 font-display text-3xl font-black uppercase">Promotion to {to.name}</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  {to.tagline}. {to.races} races. Typical team budget {money(to.typicalBudget)} (you have {money(team.cash)}). Entry fee {money(to.entryFee)}, race operations {money(to.raceOperationsCost)} per race, promotion bonus {money(to.promotionBonus)}. {carryText(game.settings.difficulty)} Sponsor deals carry over with higher payments. Drivers, staff, facilities and history come with you.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {licensingChecks(game, team, offer.to).map((c) => (
                    <Badge key={c.label} tone={c.met ? 'green' : 'red'}>
                      {c.met ? '✓' : '✗'} {c.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="lg" onClick={() => go(true)}>
                  Accept promotion
                </Button>
                <Button variant="ghost" onClick={async () => (await askConfirm('Decline promotion and stay in your current division?')) && go(false)}>
                  Decline and stay
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              {review.missedPromotion && (
                <div className="w-full rounded-lg border border-red-800/60 bg-red-500/[0.07] p-4 text-sm">
                  <div className="font-display text-lg font-bold uppercase text-red-200">Promotion denied: no {DIVISIONS[review.missedPromotion.to].name} licence</div>
                  <p className="mt-1 text-white/80">
                    You finished {ordinal(review.position)}, a promotion place, but a team must meet every {DIVISIONS[review.missedPromotion.to].name} licensing requirement at the end of the season. Missing:
                  </p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-100">
                    {review.missedPromotion.failed.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-apex-muted">Track your licence during the season under Championship → Promotion.</p>
                </div>
              )}
              <div className="text-sm text-white/80">
                {review.relegated ? `A painful season: ${team.name} will race in ${DIVISIONS[review.newDivision].name} next year.` : `${team.name} stays in ${from.name} for season ${review.season + 1}.`} {review.retirements.length > 0 && `${review.retirements.length} drivers retire from the sport.`}
              </div>
              <Button variant="primary" size="lg" onClick={() => go(true)}>
                Continue to off-season
              </Button>
            </div>
          )}
          {review.retirements.length > 0 && <div className="mt-3 text-xs text-apex-muted">Retiring: {review.retirements.slice(0, 8).map((id) => driverName(game.drivers[id])).join(', ')}</div>}
        </div>
      )}
    </div>
  );
}
