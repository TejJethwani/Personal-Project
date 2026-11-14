import { useState } from 'react';
import type { Game, Award } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { Card, Chip, Empty, PlayerLink, Tabs } from '../ui/kit';
import { TotwPitch } from '../ui/Totw';

function AwardCard({ g, a }: { g: Game; a: Award }) {
  return (
    <Card title={a.title} className={a.me ? 'hot' : ''} right={<span className="tiny muted">{a.compName} · {a.period}</span>}>
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
  const list = tab === 'honours' ? honours : tab === 'routine' ? routineMine : tab === 'week' ? inSeason.filter((a) => ROUTINE.includes(a.type) || a.type === 'potm') : tab === 'world' ? inSeason.filter((a) => a.comp === 'world') : inSeason.filter((a) => !ROUTINE.includes(a.type) && a.type !== 'potm' && a.comp !== 'world');
  const counts = new Map<string, number>();
  for (const a of routineMine) counts.set(a.title, (counts.get(a.title) ?? 0) + 1);
  return (
    <>
      <div className="pagehead"><div><h1>Awards</h1><div className="sub">Career honours are kept apart from routine weekly and monthly recognition. Awards decided by one number are rankings; judged awards weigh several things.</div></div><div className="row"><Chip k="y">{honours.length} career honour{honours.length === 1 ? '' : 's'}</Chip><select value={season} onChange={(e) => setSeason(+e.target.value)} aria-label="Season">{(seasons.length ? seasons : [w.season]).map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}</select></div></div>
      <Tabs tabs={[['honours', 'Your honours'], ['routine', `Your weekly & monthly (${routineMine.length})`], ['week', 'Weekly & monthly'], ['season', 'Season & tournament'], ['world', 'World awards']]} value={tab} onChange={setTab} />
      {tab === 'routine' && routineMine.length > 0 && <div className="row wrap gap6 mb">{[...counts.entries()].map(([t, n]) => <Chip key={t} k="b">{t} × {n}</Chip>)}</div>}
      {list.length ? <div className="grid g2">{list.slice(0, tab === 'routine' ? 12 : 60).map((a) => <AwardCard key={a.id} g={g} a={a} />)}</div> : <Empty>{tab === 'honours' ? 'No career honours yet. Player of the Month, season awards, tournament awards and world awards appear here.' : tab === 'routine' ? 'No Team of the Week or similar selections yet.' : 'No awards in this category for the selected season yet.'}</Empty>}
    </>
  );
}
