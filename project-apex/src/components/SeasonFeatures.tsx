import { CheckCircle2, Flame, Shuffle, Swords, Target, XCircle } from 'lucide-react';
import { divisionStandings } from '@/engine/championship/standings';
import { DIVISIONS } from '@/engine/config/divisions';
import { SEASON_TWISTS, seasonTwists, twistEffects } from '@/engine/season/twists';
import { playerTeam } from '@/engine/selectors';
import type { CalendarEvent, DivisionId, GameState, SeasonChallenge } from '@/engine/types';
import { money } from '@/lib/format';
import { TeamLink } from './common';
import { Badge, Panel, Progress } from './ui';

/** The rule twists a series races under this season. */
export function SeasonTwistsPanel({ game, division, season, title }: { game: GameState; division: DivisionId; season?: number; title?: string }) {
  const twists = seasonTwists(game, division, season ?? game.season);
  return (
    <Panel title={title ?? `Season twists · ${DIVISIONS[division].name}`} icon={<Shuffle size={15} className="text-apex-red" />}>
      <div className="space-y-3">
        {twists.map((t) => (
          <div key={t} className="rounded-lg border border-apex-red/30 bg-apex-red/[0.06] p-3">
            <div className="font-display text-lg font-bold uppercase tracking-wide">{SEASON_TWISTS[t].name}</div>
            <p className="mt-0.5 text-sm text-white/80">{SEASON_TWISTS[t].summary}</p>
          </div>
        ))}
        <p className="text-[11px] text-apex-muted">Every season draws new twists for every series, so no two seasons race the same.</p>
      </div>
    </Panel>
  );
}

function rewardText(c: SeasonChallenge): string {
  return [money(c.reward.cash), `+${c.reward.reputation} rep`, c.reward.devBoost > 0 ? `+${c.reward.devBoost.toFixed(1)} car` : null].filter(Boolean).join(' · ');
}

/** This season's challenges and the head-to-head with the rival team. */
export function ChallengesPanel({ game }: { game: GameState }) {
  const team = playerTeam(game);
  const list = (game.player.challenges ?? []).filter((c) => c.season === game.season);
  const rival = game.player.rival && game.player.rival.season === game.season ? game.player.rival : null;
  const rivalTeam = rival ? game.teams[rival.teamId] : null;
  const standings = divisionStandings(game, team.division).constructors;
  const pos = (id: string) => standings.findIndex((r) => r.id === id) + 1;
  const pts = (id: string) => standings.find((r) => r.id === id)?.points ?? 0;
  return (
    <Panel title="Season challenges" icon={<Target size={15} className="text-apex-red" />} actions={list.length ? <span className="text-xs text-apex-muted">{list.filter((c) => c.completed).length}/{list.length} done</span> : undefined}>
      {list.length === 0 ? (
        <p className="text-sm text-apex-muted">Three challenges and a rival team are drawn when the season starts. Each one pays out in cash, reputation and car development.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="rounded-lg border border-apex-line bg-apex-bg/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {c.completed ? <CheckCircle2 size={15} className="text-emerald-400" /> : c.failed ? <XCircle size={15} className="text-red-400" /> : c.kind === 'beatRival' ? <Swords size={15} className="text-apex-red" /> : <Flame size={15} className="text-amber-400" />}
                    {c.title}
                  </div>
                  <div className="text-xs text-apex-muted">{c.description}</div>
                </div>
                <Badge tone={c.completed ? 'green' : c.failed ? 'red' : 'neutral'} className="shrink-0">
                  {c.completed ? 'Done' : c.failed ? 'Missed' : rewardText(c)}
                </Badge>
              </div>
              {!c.completed && !c.failed && c.target > 1 && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-apex-muted">
                  <Progress value={(c.progress / c.target) * 100} className="flex-1" />
                  {c.progress}/{c.target}
                </div>
              )}
              {c.kind === 'beatRival' && rivalTeam && (
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                  <div className="truncate">
                    <TeamLink team={team} /> <span className="text-apex-muted">P{pos(team.id) || '-'} · {pts(team.id)} pts</span>
                  </div>
                  <div className="num rounded bg-white/[0.06] px-2 text-center font-bold" title="Races where your best car finished ahead / behind theirs">
                    {rival!.ahead}–{rival!.behind}
                  </div>
                  <div className="truncate text-right">
                    <span className="text-apex-muted">
                      P{pos(rivalTeam.id) || '-'} · {pts(rivalTeam.id)} pts
                    </span>{' '}
                    <TeamLink team={rivalTeam} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Notes about this particular round under the season's twists. */
export function EventTwistNotes({ game, event }: { game: GameState; event: CalendarEvent }) {
  const fx = twistEffects(game, event.division);
  const notes: string[] = [];
  if (fx.doublePointsRound === event.round) notes.push('Double points: this finale pays twice the usual points.');
  if (fx.reverseGridRound === event.round) notes.push('Reverse grid: the top ten of qualifying start in reverse order.');
  const general = seasonTwists(game, event.division)
    .filter((t) => t !== 'doublePointsFinale' && t !== 'reverseGridRound')
    .map((t) => SEASON_TWISTS[t].name);
  if (!notes.length && !general.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-apex-red/30 bg-apex-red/[0.06] px-3 py-2 text-sm">
      <Shuffle size={14} className="text-apex-red" />
      {notes.map((n) => (
        <span key={n} className="font-semibold text-white">
          {n}
        </span>
      ))}
      {general.length > 0 && <span className="text-apex-muted">Season twists in force: {general.join(', ')}.</span>}
    </div>
  );
}
