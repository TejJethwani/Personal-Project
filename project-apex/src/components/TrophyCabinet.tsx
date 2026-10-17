import { Lock, Trophy } from 'lucide-react';
import { ACHIEVEMENTS, type AchievementTier } from '@/engine/achievements';
import type { GameState } from '@/engine/types';
import { DAILY_TROPHIES, loadProfile } from '@/lib/profile';
import { cn, Panel } from './ui';

const TIER_STYLE: Record<AchievementTier, string> = {
  bronze: 'border-orange-700/60 bg-orange-900/20 text-orange-200',
  silver: 'border-slate-400/50 bg-slate-400/10 text-slate-100',
  gold: 'border-amber-400/60 bg-amber-400/10 text-amber-100',
};

function TrophyTile({ title, description, tier, unlocked, note }: { title: string; description: string; tier: AchievementTier; unlocked: boolean; note?: string }) {
  return (
    <div className={cn('rounded-lg border p-3', unlocked ? TIER_STYLE[tier] : 'border-apex-line bg-apex-bg/40 text-apex-muted')}>
      <div className="flex items-center gap-2 font-semibold">
        {unlocked ? <Trophy size={15} /> : <Lock size={14} className="opacity-60" />}
        <span className={unlocked ? '' : 'opacity-80'}>{title}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">{tier}</span>
      </div>
      <div className="mt-1 text-xs opacity-85">{description}</div>
      {note && <div className="mt-1 text-[11px] opacity-70">{note}</div>}
    </div>
  );
}

/** Career achievements plus daily-challenge trophies kept across careers in this browser. */
export function TrophyCabinet({ game }: { game: GameState }) {
  const profile = loadProfile();
  const mine = game.player.achievements ?? {};
  const careerCount = ACHIEVEMENTS.filter((a) => mine[a.id]).length;
  return (
    <div className="space-y-5">
      <Panel title="This career" actions={<span className="text-xs text-apex-muted">{careerCount}/{ACHIEVEMENTS.length} unlocked</span>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ACHIEVEMENTS.map((a) => (
            <TrophyTile
              key={a.id}
              title={a.title}
              description={a.description}
              tier={a.tier}
              unlocked={!!mine[a.id]}
              note={mine[a.id] ? `Season ${mine[a.id].season}` : profile.achievements[a.id] ? 'Unlocked in another career' : undefined}
            />
          ))}
        </div>
      </Panel>
      <Panel title="Daily challenge trophies" actions={<span className="text-xs text-apex-muted">Streak record {profile.daily.bestStreak} days</span>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {DAILY_TROPHIES.map((t) => (
            <TrophyTile key={t.id} title={t.title} description={t.description} tier={t.tier} unlocked={t.check(profile)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
