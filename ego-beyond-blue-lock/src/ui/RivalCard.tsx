/** A declared rival, in full: the head-to-head record, every scoreline, and how your careers compare. */
import { ordinal } from '../engine/util';
import { useState } from 'react';
import type { Game, Player } from '../engine/types';
import { h2h } from '../engine/rivalry';
import { relLabel } from '../engine/relationships';
import { ovr } from '../engine/attributes';
import { S } from '../engine/match/model';
import { seasonLabel } from '../engine/competitions';
import { PlayerAvatar, PlayerLink, ClubLink, Ovr, Chip } from './kit';

function career(p: Player, season: number) {
  let g = 0, a = 0, ap = 0, sg = 0, sa = 0, sap = 0;
  for (const h of p.hist) { g += h.g; a += h.a; ap += h.ap; }
  for (const cid in p.ss) { const l = p.ss[cid]; g += l[S.G]; a += l[S.A]; ap += l[S.APP]; sg += l[S.G]; sa += l[S.A]; sap += l[S.APP]; }
  void season;
  return { g, a, ap, sg, sa, sap };
}
function bdoBest(g: Game, pid: string): string {
  let best = 0;
  for (const a of Object.values(g.world.awards)) if (a.type === 'world_player') { const i = (a.noms ?? []).findIndex((n) => n.pid === pid); if (i >= 0 && (!best || i + 1 < best)) best = i + 1; }
  return best ? `${ordinal(best)}` : '—';
}

export function RivalCard({ g, id }: { g: Game; id: string }) {
  const w = g.world, c = g.career, me = w.players[c.pid], p = w.players[id];
  if (!p) return null;
  const [tab, setTab] = useState('overview');
  const r = c.rel[id];
  const h = h2h(g, id);
  const log = (c.rivalLog ?? []).filter((x) => x.rid === id);
  const n = log.length;
  const avg = (f: (x: (typeof log)[number]) => number) => (n ? log.reduce((s, x) => s + f(x), 0) / n : 0);
  const outscored = log.filter((x) => x.mg > x.hg).length, outscoredBy = log.filter((x) => x.hg > x.mg).length;
  const potmMe = log.filter((x) => x.potm === 1).length, potmHim = log.filter((x) => x.potm === 2).length;
  const big = [...log].sort((a, b) => (b.sc[0] - b.sc[1]) - (a.sc[0] - a.sc[1]));
  const bestWin = big[0] && big[0].sc[0] > big[0].sc[1] ? big[0] : null, worstLoss = big[big.length - 1] && big[big.length - 1].sc[0] < big[big.length - 1].sc[1] ? big[big.length - 1] : null;
  let streak = 0; for (let i = log.length - 1; i >= 0 && log[i].res === log[log.length - 1].res; i--) streak++;
  const cm = career(me, w.season), cr = career(p, w.season);
  const bar = (a: number, b: number) => { const t = a + b || 1; return <div className="rv-bar"><i style={{ width: `${(a / t) * 100}%` }} /><b style={{ width: `${(b / t) * 100}%` }} /></div>; };
  const row = (label: string, a: string | number, b: string | number, na?: number, nb?: number) => <div className="rv-row"><span className="a">{a}</span><span className="l">{label}{na != null && nb != null && bar(na, nb)}</span><span className="b">{b}</span></div>;
  return (
    <div className="card rv">
      <div className="rv-head">
        <div className="rv-side"><PlayerAvatar g={g} p={me} size={64} /><b>{me.sn || me.name}</b><span className="tiny muted">{me.club ? w.clubs[me.club]?.name : '—'}</span><Ovr v={ovr(me)} size="sm" /></div>
        <div className="rv-mid">
          <div className="tiny up muted">Head to head</div>
          <div className="rv-score"><span className="good">{h.w}</span><i>–</i><span>{h.d}</span><i>–</i><span className="bad">{h.l}</span></div>
          <div className="tiny muted">W – D – L in {h.n} meeting{h.n === 1 ? '' : 's'}</div>
          <div className="row gap4 wrap" style={{ justifyContent: 'center', marginTop: 4 }}><Chip k="e">{relLabel(r, true)}</Chip>{n > 1 && <Chip>{streak} {log[n - 1].res === 'W' ? 'win' : log[n - 1].res === 'D' ? 'draw' : 'defeat'}{streak > 1 ? 's' : ''} in a row</Chip>}</div>
        </div>
        <div className="rv-side"><PlayerAvatar g={g} p={p} size={64} /><b><PlayerLink g={g} id={id} /></b><span className="tiny muted">{p.club ? <ClubLink g={g} id={p.club} badge={false} /> : '—'}</span><Ovr v={ovr(p)} size="sm" /></div>
      </div>
      <div className="tabs" role="tablist" style={{ justifyContent: 'center' }}>{([['overview', 'Overview'], ['breakdown', `Breakdown${n ? ` (${n})` : ''}`], ['matches', 'All matches']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'breakdown' && <Breakdown g={g} log={log} rname={p.sn || p.name} />}
      {tab === 'overview' && <><div className="rv-stats">
        {row('Goals against each other', h.mg, h.rg, h.mg, h.rg)}
        {n > 0 && row('Assists', log.reduce((s, x) => s + x.ma, 0), log.reduce((s, x) => s + x.ha, 0), log.reduce((s, x) => s + x.ma, 0), log.reduce((s, x) => s + x.ha, 0))}
        {n > 0 && row('Average rating', avg((x) => x.mr).toFixed(2), avg((x) => x.hr).toFixed(2))}
        {row('Duels won (rating gap ≥ 0.4)', h.dw, h.dl, h.dw, h.dl)}
        {n > 0 && row('Matches outscoring the other', outscored, outscoredBy, outscored, outscoredBy)}
        {n > 0 && row('Player of the Match', potmMe, potmHim, potmMe, potmHim)}
        {row(`This season (${seasonLabel(w.season)}) goals / assists`, `${cm.sg} / ${cm.sa}`, `${cr.sg} / ${cr.sa}`, cm.sg, cr.sg)}
        {row('Career goals / assists', `${cm.g} / ${cm.a}`, `${cr.g} / ${cr.a}`, cm.g, cr.g)}
        {row("Best Ballon d'Or finish", bdoBest(g, me.id), bdoBest(g, id))}
        {row('Individual awards', me.awards.length, p.awards.length, me.awards.length, p.awards.length)}
      </div>
      {(bestWin || worstLoss) && <div className="row wrap gap6 small" style={{ justifyContent: 'center', margin: '6px 0' }}>{bestWin && <span className="chip g">Biggest win: {bestWin.sc[0]}–{bestWin.sc[1]} ({bestWin.comp}, {seasonLabel(bestWin.s)})</span>}{worstLoss && <span className="chip r">Heaviest defeat: {worstLoss.sc[0]}–{worstLoss.sc[1]} ({worstLoss.comp}, {seasonLabel(worstLoss.s)})</span>}</div>}
      </>}
      {tab === 'matches' && (n > 0 ? <div className="tw"><table className="rv-log"><thead><tr><th>Date</th><th>Competition</th><th>Match</th><th className="n">Score</th><th className="n">You</th><th className="n">{p.sn || p.name}</th></tr></thead><tbody>
        {[...log].reverse().map((x) => <tr key={x.fid}><td className="nowrap small">{x.date} {String(x.s).slice(2)}</td><td className="small muted">{x.comp}{x.stg && x.stg !== 'Group' ? ` · ${x.stg}` : ''}{x.decider ? ' · title decider' : ''}</td><td className="small">{x.home ? `${x.my} v ${x.his}` : `${x.his} v ${x.my}`}</td><td className="n"><span className={`res ${x.res}`}>{x.res}</span> <b>{x.sc[0]}–{x.sc[1]}</b>{x.pens ? <span className="tiny muted"> ({x.pens[0]}–{x.pens[1]} p)</span> : null}</td><td className="n small">{x.mg ? `⚽${x.mg > 1 ? '×' + x.mg : ''} ` : ''}{x.ma ? `🅰${x.ma > 1 ? '×' + x.ma : ''} ` : ''}<b>{x.mr.toFixed(1)}</b>{x.potm === 1 ? ' ★' : ''}</td><td className="n small">{x.hg ? `⚽${x.hg > 1 ? '×' + x.hg : ''} ` : ''}{x.ha ? `🅰${x.ha > 1 ? '×' + x.ha : ''} ` : ''}<b>{x.hr.toFixed(1)}</b>{x.potm === 2 ? ' ★' : ''}</td></tr>)}
      </tbody></table></div> : <p className="small muted center">No meetings recorded since the rivalry was declared. The first one sets the tone.</p>)}
      {r.mem.length > 0 && <p className="tiny muted center" style={{ marginTop: 6 }}>Latest: “{r.mem[r.mem.length - 1].txt}”</p>}
    </div>
  );
}

type Log = NonNullable<Game['career']['rivalLog']>;
const KIND: [string, string][] = [['league', 'League'], ['cup', 'Domestic cups'], ['continental', 'Europe'], ['intl', 'International'], ['nel', 'Neo Egoist League'], ['playoff', 'Play-offs'], ['friendly', 'Friendlies']];
/** The rivalry split by occasion: league, cups, Europe, internationals, NEL — and the big nights on their own. */
function Breakdown({ g, log, rname }: { g: Game; log: Log; rname: string }) {
  const w = g.world;
  const kindOf = (x: Log[number]) => x.kind ?? Object.values(w.comps).find((c) => c.name === x.comp)?.kind ?? 'friendly';
  const isKo = (x: Log[number]) => !!x.stg && x.stg !== 'Group' && kindOf(x) !== 'league';
  const groups: [string, Log][] = [
    ...KIND.map(([k, l]) => [l, log.filter((x) => kindOf(x) === k)] as [string, Log]),
    ['Finals', log.filter((x) => x.stg === 'Final')],
    ['Semi-finals', log.filter((x) => /Semi/i.test(x.stg ?? ''))],
    ['All knockout ties', log.filter(isKo)],
    ['Title deciders', log.filter((x) => x.decider)],
  ];
  const row = (l: string, xs: Log) => {
    const W = xs.filter((x) => x.res === 'W').length, D = xs.filter((x) => x.res === 'D').length, L = xs.filter((x) => x.res === 'L').length;
    const mg = xs.reduce((s, x) => s + x.mg, 0), hg = xs.reduce((s, x) => s + x.hg, 0), mr = xs.length ? xs.reduce((s, x) => s + x.mr, 0) / xs.length : 0, hr = xs.length ? xs.reduce((s, x) => s + x.hr, 0) / xs.length : 0;
    return <tr key={l} className={xs.length ? '' : 'dim'}><td>{l}</td><td className="n">{xs.length}</td><td className="n good">{W}</td><td className="n">{D}</td><td className="n bad">{L}</td><td className="n"><b>{mg}</b> – {hg}</td><td className="n">{xs.length ? `${mr.toFixed(2)} v ${hr.toFixed(2)}` : '—'}</td></tr>;
  };
  const big = log.filter((x) => x.stg === 'Final' || /Semi/i.test(x.stg ?? '') || x.decider).reverse();
  return (
    <div>
      <div className="tw"><table><thead><tr><th>Occasion</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">Goals (you – {rname})</th><th className="n">Avg rating</th></tr></thead><tbody>
        {groups.filter(([, xs], i) => xs.length || i < 4).map(([l, xs]) => row(l, xs))}
      </tbody></table></div>
      <h4 className="mt">Big occasions</h4>
      {big.length ? big.map((x) => <div key={x.fid} className="row gap6 small" style={{ padding: '3px 0' }}><span className={`chip ${x.res === 'W' ? 'g' : x.res === 'L' ? 'r' : ''}`}>{x.stg === 'Final' ? '🏆 Final' : x.decider ? '👑 Title decider' : '⚔ Semi-final'}</span><b>{x.sc[0]}–{x.sc[1]}{x.pens ? ` (${x.pens[0]}–${x.pens[1]} p)` : ''}</b><span className="muted">{x.comp} · {seasonLabel(x.s)}</span><span>you {x.mg}G {x.mr.toFixed(1)} · {rname} {x.hg}G {x.hr.toFixed(1)}</span></div>) : <p className="small muted">No finals, semi-finals or title deciders against each other yet.</p>}
    </div>
  );
}
