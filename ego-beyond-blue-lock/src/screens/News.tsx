import { useState } from 'react';
import type { Game } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { fmtEur } from '../engine/util';
import { S } from '../engine/match/model';
import { Card, Chip, Empty, Tabs, Rating, PlayerLink, ConfirmButton } from '../ui/kit';
import { retire } from '../engine/actions';
import { act, nav } from '../store/game';
import { OvrChart } from './Player';

/** Weekly / monthly recognitions written to the timeline by older saves: kept out of the career story. */
export const ROUTINE = /^(Team of the (Week|Round|Month)|Player of the (Week|Round)|Goal of the Month)\b/;
const CATS: [string, string][] = [['all', 'All'], ['me', 'About you'], ['match', 'Matches'], ['transfer', 'Transfers'], ['paper', 'Newspaper'], ['award', 'Awards'], ['club', 'Clubs'], ['world', 'World'], ['intl', 'International']];
const KICK: Record<string, string> = { match: 'Match report', transfer: 'Transfers', award: 'Awards', nel: 'Neo Egoist League', bid: 'The market', world: 'World football', club: 'Club news', intl: 'International', rivalry: 'Rivalry', career: 'Profile', injury: 'Fitness', manager: 'Dugout', record: 'Records', youth: 'Academy', paper: 'Analysis' };
/** The news as a newspaper: one edition per week, a lead story and columns. Old editions keep only the stories about you. */
export function NewsScreen({ g }: { g: Game }) {
  const w = g.world;
  const [cat, setCat] = useState('all');
  const weekOf = (n: { s: number; day: number }) => n.s * 100 + Math.floor(n.day / 7);
  const weeks = [...new Set(w.news.map(weekOf))].sort((a, b) => b - a);
  const [wk, setWk] = useState<number | null>(null);
  const cur = wk != null && weeks.includes(wk) ? wk : weeks[0];
  const inCat = (n: (typeof w.news)[number]) => (cat === 'all' ? true : cat === 'me' ? n.me : cat === 'club' ? n.cat === 'club' || n.cat === 'manager' : cat === 'world' ? ['world', 'record', 'youth'].includes(n.cat) : n.cat === cat);
  const list = w.news.filter((n) => weekOf(n) === cur && inCat(n)).sort((a, b) => b.imp - a.imp || Number(b.me) - Number(a.me) || b.id - a.id);
  const lead = list[0];
  const idx = weeks.indexOf(cur);
  return (
    <>
      <div className="pagehead"><div><h1>The Touchline</h1><div className="sub">One edition a week. When a season ends, only the stories about you are kept in the archive.</div></div>
        <span className="row wrap gap6"><button className="btn sm" disabled={idx >= weeks.length - 1} onClick={() => setWk(weeks[idx + 1])}>◀ Older</button><select value={cur ?? ''} onChange={(e) => setWk(+e.target.value)} aria-label="Edition">{weeks.map((x) => { const first = w.news.find((n) => weekOf(n) === x); return <option key={x} value={x}>{first?.date ?? x} · {seasonLabel(Math.floor(x / 100))}</option>; })}</select><button className="btn sm" disabled={idx <= 0} onClick={() => setWk(weeks[idx - 1])}>Newer ▶</button></span></div>
      <div className="row wrap mb">{CATS.map(([k, l]) => <button key={k} className={`btn sm ${cat === k ? 'pri' : ''}`} onClick={() => setCat(k)}>{l}</button>)}</div>
      {lead ? <div className="npaper">
        <div className="mast"><h1>The Touchline</h1><div className="sub"><span>{lead.date}</span><span>{seasonLabel(lead.s)} · Edition {weeks.length - idx}</span><span>{list.length} stories</span></div></div>
        <div className="lead"><div className="kick">{KICK[lead.cat] ?? lead.cat}{lead.me ? ' · about you' : ''}</div><h2>{lead.title}</h2><p>{lead.body}</p></div>
        <div className="cols">{list.slice(1, 40).map((n) => <article key={n.id} className={n.me ? 'me' : ''}><div className="kick">{KICK[n.cat] ?? n.cat} · {n.date}</div><h5>{n.title}</h5><p>{n.body}</p>{n.pids && n.pids.length > 0 && <p style={{ marginTop: 4 }}>{n.pids.slice(0, 3).map((id) => g.world.players[id] ? <span key={id} style={{ marginRight: 8 }}><PlayerLink g={g} id={id} /></span> : null)}</p>}</article>)}</div>
      </div> : <Empty>No stories in this edition for that section.</Empty>}
    </>
  );
}

export function History({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const [tab, setTab] = useState('time');
  const seasons = [...new Set(c.statHist.map((h) => h.s))].sort((a, b) => b - a);
  const myAwards = w.awardIds.map((id) => w.awards[id]).filter((a) => a && (a.winner?.pid === me.id || a.xi?.some((x) => x.pid === me.id)));
  const trophies = c.timeline.filter((t) => t.type === 'trophy' || t.type === 'promotion');
  const played = c.matches.filter((m) => m.line);
  const tg = played.reduce((s, m) => s + m.line![S.G], 0), ta = played.reduce((s, m) => s + m.line![S.A], 0);
  const icon: Record<string, string> = { start: '🚩', nel: '🔵', pro: '⚽', first: '✨', feat: '🔥', award: '🏆', trophy: '🏆', transfer: '✍️', contract: '📄', season: '📅', growth: '📈', ability: '⚡', rival: '⚔', intl: '🌍', promotion: '⬆', record: '📊', retire: '🏁' };
  return (
    <>
      <div className="pagehead"><div><h1>Career History</h1><div className="sub">{me.name} · {played.length} appearances · {tg} goals · {ta} assists · {myAwards.length} individual awards · {trophies.length} team honours · earnings {fmtEur(c.wages)}</div></div><span className="row wrap gap6">{me.retired != null ? <Chip k="r">Retired</Chip> : <ConfirmButton className="btn danger" label={`Retire (age ${w.season - me.born})`} confirm="Confirm retirement — ends the playable career" onConfirm={() => { act((x) => retire(x)); nav('hof'); }} />}<button className="btn" onClick={() => nav('hof')}>🏛 Hall of Fame</button></span></div>
      <Tabs tabs={[['time', 'Timeline'], ['seasons', 'Season by season'], ['honours', 'Honours'], ['dev', 'Development']]} value={tab} onChange={setTab} />
      {tab === 'time' && <Card>{c.timeline.length ? <div className="feed">{[...c.timeline].reverse().filter((t) => !ROUTINE.test(t.txt)).map((t, i) => <div key={i} className="it" style={{ gridTemplateColumns: '150px 1fr' }}><span className="tiny dim">{t.date}</span><div>{icon[t.type] ?? '•'} {t.txt}</div></div>)}</div> : <Empty>Your story starts with your first match.</Empty>}</Card>}
      {tab === 'seasons' && <Card>{seasons.length || Object.keys(me.ss).length ? <div className="tw"><table><thead><tr><th>Season</th><th>Club</th><th>Competition</th><th className="n">Apps</th><th className="n">G</th><th className="n">A</th><th className="n">POTM</th><th className="n">Rating</th></tr></thead><tbody>
        {Object.entries(me.ss).map(([cid, l]) => <tr key={'c' + cid} className="me"><td>{seasonLabel(w.season)} (now)</td><td>{w.clubs[me.club ?? '']?.name ?? ''}</td><td>{w.comps[cid]?.name ?? cid}</td><td className="n">{l[S.APP]}</td><td className="n num">{l[S.G]}</td><td className="n num">{l[S.A]}</td><td className="n">{l[S.POTM]}</td><td className="n"><Rating v={l[S.RATN] ? l[S.RAT] / l[S.RATN] : 0} /></td></tr>)}
        {[...c.statHist].reverse().map((h, i) => <tr key={i}><td>{seasonLabel(h.s)}</td><td>{h.clubName}</td><td>{h.compName}</td><td className="n">{h.line[S.APP]}</td><td className="n num">{h.line[S.G]}</td><td className="n num">{h.line[S.A]}</td><td className="n">{h.line[S.POTM]}</td><td className="n"><Rating v={h.line[S.RATN] ? h.line[S.RAT] / h.line[S.RATN] : 0} /></td></tr>)}
      </tbody></table></div> : <Empty>No completed competitions yet.</Empty>}</Card>}
      {tab === 'honours' && <div className="grid g2"><Card title="Team honours">{trophies.length ? trophies.map((t, i) => <p key={i}>🏆 {t.txt} <span className="dim small">{t.date}</span></p>) : <Empty>No trophies yet.</Empty>}</Card><Card title="Individual awards">{myAwards.length ? myAwards.reverse().map((a) => <p key={a.id} className="small">🏅 <b>{a.title}</b> — {a.compName}, {a.period} ({seasonLabel(a.s)})</p>) : <Empty>No awards yet.</Empty>}</Card>
        <Card title="Transfers"><div className="small col gap4">{w.transfers.filter((t) => t.pid === me.id).map((t) => <div key={t.id}>{seasonLabel(t.s)}: {t.fromName} → <b>{t.toName}</b> <span className="muted">({t.type}{t.fee ? `, ${fmtEur(t.fee)}` : ''})</span></div>)}{!w.transfers.some((t) => t.pid === me.id) && <span className="muted">None yet.</span>}</div></Card>
        <Card title="World champions by season">{w.archive.length ? [...w.archive].reverse().map((a) => <div key={a.s} className="small" style={{ marginBottom: 8 }}><b>{seasonLabel(a.s)}</b>: {a.champs.map((x) => `${x.compName} — ${x.clubName}`).join(' · ')}</div>) : <Empty>No completed seasons yet.</Empty>}</Card></div>}
      {tab === 'dev' && <Card title="Overall rating over your career"><OvrChart g={g} /></Card>}
    </>
  );
}
