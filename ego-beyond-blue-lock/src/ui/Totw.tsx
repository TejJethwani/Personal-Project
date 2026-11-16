/** Team of the Week / Round / Month / Season drawn as a line-up on a pitch, and the newspaper card. */
import type { Award, Game, News } from '../engine/types';
import { nav } from '../store/game';
import { PlayerAvatar } from './kit';

const LINE: Record<string, number> = { GK: 0, CB: 1, LB: 1, RB: 1, DM: 2, CM: 2, LM: 2, RM: 2, AM: 3, LW: 3, RW: 3, SS: 3, ST: 4 };
const SIDE: Record<string, number> = { LB: 0, LM: 0, LW: 0, CB: 1, DM: 1, CM: 1, AM: 1, ST: 1, SS: 1, GK: 1, RB: 2, RM: 2, RW: 2 };

export function TotwPitch({ g, a, metric = 'rat' }: { g: Game; a: Pick<Award, 'xi' | 'title'>; metric?: 'rat' | 'ovr' }) {
  const xi = a.xi ?? [];
  // attacking midfielders / wingers share a line with the strikers when there are few of them
  const rows: (typeof xi)[] = [[], [], [], [], []];
  for (const x of xi) rows[LINE[x.pos] ?? 2].push(x);
  if (rows[3].length + rows[4].length <= 3) { rows[4] = [...rows[3], ...rows[4]]; rows[3] = []; }
  return (
    <div className="totw" role="img" aria-label={`${a.title}: ${xi.map((x) => x.name).join(', ')}`}>
      {rows.filter((r) => r.length).map((r, i) => <div key={i} className="ln">{[...r].sort((p, q) => (SIDE[p.pos] ?? 1) - (SIDE[q.pos] ?? 1)).map((x, k) => (
        <button key={x.pid + ':' + (x.s ?? '') + ':' + k} className={`pl link ${x.pid === g.career.pid ? 'me' : ''}`} onClick={() => nav('player', x.pid)} title={`${x.name} · ${x.clubName}`}>
          {g.world.players[x.pid] && <PlayerAvatar g={g} p={g.world.players[x.pid]} size={40} />}
          <span className="rt">{metric === 'ovr' ? (x.ovr ?? '–') : x.rat.toFixed(1)}</span>
          <span className="nm">{g.world.players[x.pid]?.sn ?? x.name}</span>
          <span className="cb">{x.pos} · {x.clubName}{metric === 'ovr' && x.s ? ` · ${x.s}/${String((x.s + 1) % 100).padStart(2, '0')}` : ''}</span>
        </button>))}</div>)}
    </div>
  );
}

/** Latest Team of the Week (or Round) for a competition. */
export function latestTotw(g: Game, comp: string): Award | null {
  const w = g.world;
  for (let i = w.awardIds.length - 1; i >= 0; i--) { const a = w.awards[w.awardIds[i]]; if (a && (a.type === 'totw' || a.type === 'totr') && a.comp === comp && a.xi?.length === 11) return a; }
  return null;
}

export function Paper({ items, limit = 4 }: { items: News[]; limit?: number }) {
  const list = items.slice(0, limit);
  if (!list.length) return <p className="muted small">The first edition is printed once the season is a few weeks old.</p>;
  return (
    <div className="paper">
      <div className="mast">The Touchline <span>{list[0].date}</span></div>
      {list.map((n, i) => <article key={n.id} className={i === 0 ? 'lead' : ''}><div className="dt">{n.date}</div><h5>{n.title}</h5><p>{n.body}</p></article>)}
    </div>
  );
}
