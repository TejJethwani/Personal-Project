import { useState } from 'react';
import type { Game, Award } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { Card, Chip, Empty, PlayerLink, Tabs } from '../ui/kit';

function AwardCard({ g, a }: { g: Game; a: Award }) {
  return (
    <Card title={a.title} className={a.me ? 'hot' : ''} right={<span className="tiny muted">{a.compName} · {a.period}</span>}>
      {a.winner && <p><b className="gold">🏆 <PlayerLink g={g} id={a.winner.pid} full /></b> <span className="muted">· {a.winner.clubName}</span><br /><span className="small">{a.winner.line}</span></p>}
      {a.xi && <><div className="tiny up muted">{a.form}</div><div className="row wrap gap4" style={{ margin: '6px 0' }}>{a.xi.map((x) => <span key={x.pid} className={`chip ${x.pid === g.career.pid ? 'e' : ''}`}><b>{x.pos}</b> <PlayerLink g={g} id={x.pid} /> {x.rat.toFixed(1)}</span>)}</div></>}
      {a.noms && a.noms.length > 1 && <div className="small muted">{a.winner ? 'Other nominees' : 'Nominees'}: {a.noms.slice(a.winner ? 1 : 0).map((n) => `${n.name} (${n.line})`).join(' · ')}</div>}
      <p className="tiny dim" style={{ marginTop: 6 }}>{a.why}</p>
    </Card>
  );
}
export function Awards({ g }: { g: Game }) {
  const w = g.world;
  const [tab, setTab] = useState('mine');
  const [season, setSeason] = useState(w.season);
  const all = w.awardIds.map((id) => w.awards[id]).filter(Boolean).reverse();
  const seasons = [...new Set(all.map((a) => a.s))];
  const weekly = ['potw', 'totw', 'potr', 'totr'], monthly = ['potm', 'gotm'];
  const list = tab === 'mine' ? all.filter((a) => a.me) : all.filter((a) => a.s === season && (tab === 'week' ? weekly.includes(a.type) : tab === 'month' ? monthly.includes(a.type) : tab === 'world' ? a.comp === 'world' : !weekly.includes(a.type) && !monthly.includes(a.type) && a.comp !== 'world'));
  const mine = all.filter((a) => a.winner?.pid === g.career.pid || a.xi?.some((x) => x.pid === g.career.pid));
  return (
    <>
      <div className="pagehead"><div><h1>Awards</h1><div className="sub">Awards consider every eligible player in a competition, are position-aware, and affect reputation — never attributes.</div></div><div className="row"><Chip k="y">You have won {mine.length}</Chip><select value={season} onChange={(e) => setSeason(+e.target.value)} aria-label="Season">{(seasons.length ? seasons : [w.season]).map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}</select></div></div>
      <Tabs tabs={[['mine', 'Involving you'], ['week', 'Weekly / round'], ['month', 'Monthly'], ['season', 'Season & tournament'], ['world', 'World awards']]} value={tab} onChange={setTab} />
      {list.length ? <div className="grid g2">{list.slice(0, 60).map((a) => <AwardCard key={a.id} g={g} a={a} />)}</div> : <Empty>{tab === 'mine' ? 'Nothing yet. Team of the Round and Player of the Round are decided after every NEL round; weekly, monthly and season awards follow in professional football.' : 'No awards in this category for the selected season yet.'}</Empty>}
    </>
  );
}
