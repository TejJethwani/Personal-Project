import { ordinal } from '../engine/util';
import { useState } from 'react';
import type { Game, Award } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { Card, Chip, ClubBadge, Empty, PlayerLink, Tabs } from '../ui/kit';
import { TotwPitch } from '../ui/Totw';
import { Trophy, kindForAward, kindForComp } from '../ui/Trophy';
import { VotesPanel } from './Ceremony';
import { NATIONS } from '../engine/data/nations';

function AwardCard({ g, a }: { g: Game; a: Award }) {
  return (
    <Card title={<span className="row gap6"><Trophy kind={kindForAward(a.type)} size={22} />{a.title}</span>} className={a.me ? 'hot' : ''} right={<span className="tiny muted">{a.compName} · {a.period}</span>}>
      {a.winner && <p><b className="gold">🏆 {a.winner.pid ? <PlayerLink g={g} id={a.winner.pid} full /> : a.winner.name}</b> <span className="muted">· {a.winner.clubName}</span><br /><span className="small">{a.winner.line}</span></p>}
      {a.xi && <><div className="tiny up muted" style={{ marginBottom: 6 }}>{a.form}</div><TotwPitch g={g} a={a} /></>}
      {a.noms && a.noms.length > 1 && (a.mode === 'rank' ? <ol className="small muted" start={2} style={{ margin: '4px 0', paddingLeft: 20 }}>{a.noms.slice(1, 6).map((n, i) => <li key={i}>{n.name} — {n.line}</li>)}</ol> : <div className="small muted">{a.winner ? 'Also shortlisted' : 'Nominees'}: {a.noms.slice(a.winner ? 1 : 0, 6).map((n) => `${n.name} (${n.line})`).join(' · ')}</div>)}
      <p className="tiny dim" style={{ marginTop: 6 }}>{a.why}</p>
    </Card>
  );
}
const ROUTINE = ['potw', 'totw', 'potr', 'totr', 'gotm', 'totm'];
export function Awards({ g }: { g: Game }) {
  const w = g.world;
  const [tab, setTab] = useState('honours');
  const [season, setSeason] = useState(w.season);
  const all = w.awardIds.map((id) => w.awards[id]).filter(Boolean).reverse();
  const seasons = [...new Set(all.map((a) => a.s))];
  const isMine = (a: Award) => a.winner?.pid === g.career.pid || !!a.xi?.some((x) => x.pid === g.career.pid);
  const honours = all.filter((a) => isMine(a) && !ROUTINE.includes(a.type));
  const routineMine = all.filter((a) => isMine(a) && ROUTINE.includes(a.type));
  const inSeason = all.filter((a) => a.s === season);
  const list = tab === 'honours' ? honours : tab === 'routine' ? routineMine : tab === 'week' ? inSeason.filter((a) => ROUTINE.includes(a.type) || a.type === 'potm') : tab === 'world' ? inSeason.filter((a) => a.comp === 'world') : tab === 'bdo' ? all.filter((a) => a.comp === 'bdo' && a.s === season) : inSeason.filter((a) => !ROUTINE.includes(a.type) && a.type !== 'potm' && a.comp !== 'world' && a.comp !== 'bdo');
  const counts = new Map<string, number>();
  for (const a of routineMine) counts.set(a.title, (counts.get(a.title) ?? 0) + 1);
  return (
    <>
      <div className="pagehead"><div><h1>Awards</h1><div className="sub">Career honours are kept apart from routine weekly and monthly recognition. Awards decided by one number are rankings; judged awards weigh several things.</div></div><div className="row"><Chip k="y">{honours.length} career honour{honours.length === 1 ? '' : 's'}</Chip><select value={season} onChange={(e) => setSeason(+e.target.value)} aria-label="Season">{(seasons.length ? seasons : [w.season]).map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}</select></div></div>
      <Tabs tabs={[['honours', 'Your honours'], ['routine', `Your weekly & monthly (${routineMine.length})`], ['week', 'Weekly & monthly'], ['season', 'Season & tournament'], ['world', 'World awards'], ['bdo', "Ballon d'Or"], ['archive', 'Archive']]} value={tab} onChange={setTab} />
      {tab === 'routine' && routineMine.length > 0 && <div className="row wrap gap6 mb">{[...counts.entries()].map(([t, n]) => <Chip key={t} k="b">{t} × {n}</Chip>)}</div>}
      {tab === 'archive' ? <Archive g={g} /> : tab === 'bdo' ? <BdoTab g={g} s={season} list={list} /> : list.length ? <div className="grid g2">{list.slice(0, tab === 'routine' ? 12 : 60).map((a) => <AwardCard key={a.id} g={g} a={a} />)}</div> : <Empty>{tab === 'honours' ? 'No career honours yet. Player of the Month, season awards, tournament awards and world awards appear here.' : tab === 'routine' ? 'No Team of the Week or similar selections yet.' : 'No awards in this category for the selected season yet.'}</Empty>}
    </>
  );
}

/** The Ballon d'Or of one season: the trophies of the night, the full top thirty and every ballot. */
function BdoTab({ g, s, list }: { g: Game; s: number; list: Award[] }) {
  const [ballots, setBallots] = useState(false);
  const a = list.find((x) => x.type === 'world_player');
  if (!a) return <Empty>No Ballon d'Or gala for {seasonLabel(s)} yet. The gala is held in late October and judges the whole previous season, summer tournament included. Pick another season above.</Empty>;
  if (ballots) return <Card><VotesPanel g={g} a={a} onClose={() => setBallots(false)} /></Card>;
  const me = g.career.pid;
  return (
    <div className="grid g2">
      <Card title={<span className="row gap6"><Trophy kind="ballon" size={26} />Ballon d'Or {seasonLabel(s)} — final ranking</span>} right={a.votes && <button className="btn sm" onClick={() => setBallots(true)}>🗳 Journalists' ballots</button>}>
        <table><thead><tr><th>#</th><th>Player</th><th>Club</th><th className="n">Points</th></tr></thead><tbody>
          {(a.noms ?? []).map((n, i) => <tr key={n.pid} className={n.pid === me ? 'me' : ''}><td>{i + 1}</td><td><PlayerLink g={g} id={n.pid} full /><div className="tiny muted">{n.line}</div></td><td className="small">{n.clubName}</td><td className="n"><b>{n.score}</b></td></tr>)}
        </tbody></table>
      </Card>
      <div className="col">{list.filter((x) => x !== a).map((x) => <AwardCard key={x.id} g={g} a={x} />)}</div>
    </div>
  );
}

/** Every finished season: champions with their trophies, the headline awards, and all-time tables. */
function Archive({ g }: { g: Game }) {
  const w = g.world, me = g.career.pid;
  const seasons = [...w.archive].sort((x, y) => y.s - x.s);
  const [open, setOpen] = useState<number | null>(seasons[0]?.s ?? null);
  const [view, setView] = useState('seasons');
  // all-time trophy table, from every competition's history
  const clubT = new Map<string, { name: string; n: number; major: number; list: Record<string, number> }>();
  for (const c of Object.values(w.comps)) for (const h of c.hist) {
    if (!h.champion || c.kind === 'playoff' || c.kind === 'friendly' || c.id === 'nel') continue;
    const name = h.championName ?? w.clubs[h.champion]?.name ?? NATIONS[h.champion]?.name ?? h.champion;
    const e = clubT.get(h.champion) ?? { name, n: 0, major: 0, list: {} };
    e.n++; if (c.kind === 'continental' || c.kind === 'intl' || c.tier === 1) e.major++;
    e.list[c.name] = (e.list[c.name] ?? 0) + 1; clubT.set(h.champion, e);
  }
  const bdo = Object.values(w.awards).filter((a) => a.type === 'world_player').sort((x, y) => y.s - x.s);
  const bdoT = new Map<string, { name: string; wins: number; podiums: number; top10: number; pts: number }>();
  for (const a of bdo) (a.noms ?? []).forEach((n, i) => { const e = bdoT.get(n.pid) ?? { name: n.name, wins: 0, podiums: 0, top10: 0, pts: 0 }; if (i === 0) e.wins++; if (i < 3) e.podiums++; if (i < 10) e.top10++; e.pts += n.score; bdoT.set(n.pid, e); });
  const myHist = g.career.bdoHist ?? [];
  const HEAD = ['pots', 'boot', 'world_young', 'world_scorer', 'golden_shoe'];
  if (!seasons.length) return <Empty>The archive fills up as seasons finish: champions, awards and every Ballon d'Or ranking are kept here for good.</Empty>;
  return (
    <>
      <Tabs tabs={[['seasons', 'Season by season'], ['trophies', 'All-time trophy table'], ['bdo', "Ballon d'Or history"]]} value={view} onChange={setView} />
      {view === 'seasons' && <div className="col">{seasons.map((sa) => { const b = w.awards[`world_player:bdo:${sa.s}`]; const isOpen = open === sa.s; return (
        <Card key={sa.s} title={<button className="btn ghost sm" onClick={() => setOpen(isOpen ? null : sa.s)}>{isOpen ? '▾' : '▸'} {seasonLabel(sa.s)}</button>} right={<span className="small muted">{b ? <>Ballon d'Or: <b className="gold">{b.winner?.name}</b></> : "Ballon d'Or in October"}</span>}>
          <div className="arch-champs">{sa.champs.map((c) => <div key={c.comp} className={`arch-ch ${w.players[me]?.club === c.club ? 'me' : ''}`}><Trophy kind={kindForComp(c.comp)} size={36} title={c.compName} /><div><b>{c.clubName}</b><span>{c.compName}</span></div></div>)}
            {Object.values(w.comps).filter((c) => c.kind === 'intl' && !c.u20).flatMap((c) => c.hist.filter((h) => h.s === sa.s && h.champion).map((h) => <div key={c.id} className="arch-ch"><Trophy kind={kindForComp(c.id)} size={36} title={c.name} /><div><b>{h.championName}</b><span>{c.name}</span></div></div>))}</div>
          {isOpen && <div className="grid g2 mt">
            <div><h4>Headline awards</h4>{Object.values(w.awards).filter((a) => a.s === sa.s && (HEAD.includes(a.type) || a.comp === 'bdo') && a.winner).filter((a) => (a.type !== 'pots' && a.type !== 'boot') || /1$/.test(a.comp)).slice(0, 24).map((a) => <div key={a.id} className="row gap6 small" style={{ padding: '2px 0' }}><Trophy kind={kindForAward(a.type)} size={16} /><span className="muted" style={{ minWidth: 170 }}>{a.title}{a.comp !== 'world' && a.comp !== 'bdo' ? ` (${a.compName})` : ''}</span><b className={a.winner!.pid === me ? 'blue' : ''}>{a.winner!.name}</b></div>)}</div>
            <div><h4>Ballon d'Or {seasonLabel(sa.s)}</h4>{b ? <ol className="small" style={{ margin: 0, paddingLeft: 22 }}>{(b.noms ?? []).map((n) => <li key={n.pid} className={n.pid === me ? 'blue' : ''}><b>{n.name}</b> <span className="muted">· {n.clubName} · {n.score} pts</span></li>)}</ol> : <p className="small muted">The vote takes place in late October.</p>}</div>
          </div>}
        </Card>); })}</div>}
      {view === 'trophies' && <Card title="Most trophies since the career began"><table><thead><tr><th>#</th><th>Team</th><th className="n">Trophies</th><th className="n">Major</th><th>Won</th></tr></thead><tbody>
        {[...clubT.entries()].sort((x, y) => y[1].n - x[1].n || y[1].major - x[1].major).slice(0, 40).map(([id, e], i) => <tr key={id} className={w.players[me]?.club === id ? 'me' : ''}><td>{i + 1}</td><td><span className="row gap6"><ClubBadge g={g} id={id} />{e.name}</span></td><td className="n"><b>{e.n}</b></td><td className="n">{e.major}</td><td className="small muted">{Object.entries(e.list).map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · ')}</td></tr>)}
      </tbody></table></Card>}
      {view === 'bdo' && <div className="grid g2">
        <Card title="Winners">{bdo.length ? bdo.map((a) => <div key={a.id} className="row gap6" style={{ padding: '3px 0' }}><Trophy kind="ballon" size={20} /><span className="muted" style={{ width: 60 }}>{seasonLabel(a.s)}</span><b className={a.winner?.pid === me ? 'blue' : ''}>{a.winner?.name}</b><span className="small muted">{a.winner?.clubName} · {a.winner?.score} pts</span></div>) : <p className="small muted">No gala yet.</p>}</Card>
        <Card title="All-time Ballon d'Or table"><table><thead><tr><th>Player</th><th className="n">Wins</th><th className="n">Podiums</th><th className="n">Top 10</th><th className="n">Points</th></tr></thead><tbody>
          {[...bdoT.entries()].sort((x, y) => y[1].wins - x[1].wins || y[1].podiums - x[1].podiums || y[1].pts - x[1].pts).slice(0, 25).map(([pid, e]) => <tr key={pid} className={pid === me ? 'me' : ''}><td>{e.name}</td><td className="n"><b>{e.wins}</b></td><td className="n">{e.podiums}</td><td className="n">{e.top10}</td><td className="n">{e.pts}</td></tr>)}
        </tbody></table></Card>
        {myHist.length > 0 && <Card title="Your Ballon d'Or finishes">{myHist.map((h) => <div key={h.s} className="row gap6 small"><span className="muted" style={{ width: 60 }}>{seasonLabel(h.s)}</span><b>{h.rank ? `${ordinal(h.rank)}` : 'not shortlisted'}</b>{h.pts > 0 && <span className="muted">{h.pts} pts</span>}<span className="muted">· won by {h.winner}</span></div>)}</Card>}
      </div>}
    </>
  );
}
