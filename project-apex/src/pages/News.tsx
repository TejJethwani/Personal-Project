import { useEffect, useState } from 'react';
import { markNewsRead } from '@/engine/actions';
import type { NewsCategory } from '@/engine/types';
import { DivisionBadge } from '@/components/common';
import { Badge, Button, cn, Empty, SectionTitle, Segmented } from '@/components/ui';
import { useGame, useStore } from '@/store/gameStore';

const GROUPS: { id: string; label: string; cats: NewsCategory[] | null }[] = [
  { id: 'all', label: 'All', cats: null },
  { id: 'team', label: 'My team', cats: null },
  { id: 'race', label: 'Racing', cats: ['race', 'preview', 'championship', 'milestone'] },
  { id: 'transfer', label: 'Transfers', cats: ['transfer', 'rumor'] },
  { id: 'eng', label: 'Engineering', cats: ['engineering', 'regulation'] },
  { id: 'biz', label: 'Business', cats: ['finance', 'sponsor', 'board', 'promotion'] },
  { id: 'people', label: 'People', cats: ['interview', 'injury', 'discipline', 'academy'] },
];

const CAT_TONE: Partial<Record<NewsCategory, 'red' | 'green' | 'amber' | 'blue' | 'purple' | 'gold' | 'neutral'>> = {
  race: 'red',
  transfer: 'blue',
  rumor: 'purple',
  engineering: 'amber',
  finance: 'green',
  championship: 'gold',
  promotion: 'gold',
  injury: 'red',
  regulation: 'amber',
};

export function NewsPage() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const [group, setGroup] = useState('all');
  const [important, setImportant] = useState(false);
  const g = GROUPS.find((x) => x.id === group)!;
  const items = game.news.filter((n) => {
    if (important && n.importance < 2) return false;
    if (group === 'team') return n.teamIds.includes(game.player.teamId) || n.driverIds.some((id) => game.drivers[id]?.contract?.teamId === game.player.teamId);
    return !g.cats || g.cats.includes(n.category);
  });
  useEffect(() => {
    // Opening the news page marks the top stories as read.
    const unread = game.news.slice(0, 40).filter((n) => !n.read).map((n) => n.id);
    if (unread.length) setTimeout(() => act((s) => markNewsRead(s, unread), { silent: true }), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-5">
      <SectionTitle
        sub="Stories generated from what actually happens in the simulation."
        right={
          <>
            <Segmented value={important ? 'top' : 'all'} onChange={(v) => setImportant(v === 'top')} options={[{ value: 'all', label: 'Everything' }, { value: 'top', label: 'Headlines' }]} />
            <Button size="sm" variant="ghost" onClick={() => act((s) => markNewsRead(s, 'all'))}>
              Mark all read
            </Button>
          </>
        }
      >
        News
      </SectionTitle>
      <div className="flex flex-wrap gap-1">
        {GROUPS.map((x) => (
          <button key={x.id} onClick={() => setGroup(x.id)} className={cn('rounded-full px-3 py-1 text-xs font-semibold', group === x.id ? 'bg-apex-red text-white' : 'bg-white/5 text-apex-muted hover:text-white')}>
            {x.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty>No stories here yet.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.slice(0, 120).map((n) => (
            <article key={n.id} className={cn('panel p-4', n.importance === 3 && 'border-apex-red/50', !n.read && 'ring-1 ring-apex-red/30')}>
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-apex-muted">
                <Badge tone={CAT_TONE[n.category] ?? 'neutral'}>{n.category}</Badge>
                {n.division && <DivisionBadge division={n.division} />}
                <span>
                  Season {n.season} · {n.week > 0 ? `Week ${n.week}` : n.week === 0 ? 'Pre-season' : 'Off-season'}
                </span>
                {!n.read && <span className="ml-auto h-2 w-2 rounded-full bg-apex-red" />}
              </div>
              <h3 className={cn('font-display font-bold uppercase leading-tight', n.importance === 3 ? 'text-xl' : 'text-base')}>{n.headline}</h3>
              <p className="mt-1.5 text-sm text-white/75">{n.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
