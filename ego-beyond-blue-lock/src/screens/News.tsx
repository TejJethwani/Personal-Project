import { useState } from 'react';
import type { Game, News } from '../engine/types';
import { Trophy } from '../ui/Trophy';
import { seasonLabel } from '../engine/competitions';
import { fmtEur } from '../engine/util';
import { S } from '../engine/match/model';
import { Card, Chip, Empty, Tabs, Rating, PlayerLink, ConfirmButton, PlayerAvatar, ClubBadge } from '../ui/kit';
import { retire } from '../engine/actions';
import { act, nav } from '../store/game';
import { OvrChart } from './Player';

/** Weekly / monthly recognitions written to the timeline by older saves: kept out of the career story. */
export const ROUTINE = /^(Team of the (Week|Round|Month)|Player of the (Week|Round)|Goal of the Month)\b/;
const CATS: [string, string][] = [['all', 'All'], ['me', 'About you'], ['match', 'Matches'], ['transfer', 'Transfers'], ['paper', 'Newspaper'], ['award', 'Awards'], ['club', 'Clubs'], ['world', 'World'], ['intl', 'International']];
const KICK: Record<string, string> = { match: 'Match report', transfer: 'Transfers', award: 'Awards', nel: 'Neo Egoist League', bid: 'The market', world: 'World football', club: 'Club news', intl: 'International', rivalry: 'Rivalry', career: 'Profile', injury: 'Fitness', manager: 'Dugout', record: 'Records', youth: 'Academy', paper: 'Analysis' };
type Paper = { id: string; name: string; tag: string; cls: string; boost: Partial<Record<string, number>>; only?: (g: Game, n: News) => boolean; kicker?: Record<string, string> };
/** Four papers, four voices: the broadsheet, the red-top tabloid, the Japanese egoist daily and the European weekly. */
const PAPERS: Paper[] = [
  { id: 'touchline', name: 'The Touchline', tag: 'Football, properly. Since the first whistle.', cls: 'broad', boost: { paper: 1, match: 0.5 } },
  { id: 'express', name: 'GOAL EXPRESS', tag: 'The loudest back page in football', cls: 'tabloid', boost: { transfer: 2, rivalry: 2.5, bid: 1.5, injury: 1.5, manager: 1.5, career: 1 }, kicker: { transfer: 'Done deal', rivalry: 'War of words', injury: 'Blow', manager: 'Sack race', award: 'Crowned', match: 'Matchday', paper: 'Exclusive', career: 'Exclusive', club: 'Inside the club', world: 'Shock' } },
  { id: 'bls', name: 'Blue Lock Sports', tag: 'ブルーロック・スポーツ · The egoist daily from Tokyo', cls: 'jp', boost: { nel: 2.5, intl: 1.5, rivalry: 1.5, career: 1 }, only: (g, n) => !!n.me || n.cat === 'nel' || n.cat === 'intl' || !!n.pids?.some((id) => g.world.players[id]?.origin === 'bluelock' || g.world.players[id]?.nat === 'JPN'), kicker: { match: '試合 · Match', transfer: '移籍 · Transfer', award: '受賞 · Award', rivalry: 'ライバル · Rivalry', nel: 'NEL', intl: '日本代表 · Japan', career: '独占 · Exclusive', paper: '分析 · Analysis' } },
  { id: 'monde', name: 'Le Monde du Football', tag: 'Le jeu mondial · The world game, every week', cls: 'euro', boost: { world: 2, award: 2, intl: 1.5, club: 1, record: 1.5 }, kicker: { world: 'Le monde', award: 'Les trophées', intl: 'Les sélections', club: 'Les clubs', transfer: 'Le mercato', match: 'Le match', record: 'Les records', paper: "L'analyse" } },
];
const VERB_KEEP = new Set(['can', 'will', 'could', 'would', 'should', 'must', 'may', 'might', 'did', 'had', 'was']);
const verb3 = (v: string) => /ed$/.test(v) || VERB_KEEP.has(v.toLowerCase()) ? v : /(s|sh|ch|x|o)$/.test(v) ? v + 'es' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : v + 's';
/** Newspapers never talk to the reader as "you": "You win: Ballon d'Or" becomes "Yoichi Isagi wins the Ballon d'Or". */
export function thirdPerson(t: string, name: string): string {
  return t
    .replace(/^You win: (.+)$/, (_, a: string) => `${name} wins ${/^the /i.test(a) ? '' : 'the '}${a}`)
    .replace(/^You are in the (.+)$/, `${name} named in the $1`)
    .replace(/\b([Yy])ou are\b/g, `${name} is`).replace(/\b[Yy]ou were\b/g, `${name} was`).replace(/\b[Yy]ou have\b/g, `${name} has`).replace(/\b[Yy]ou've\b/g, `${name} has`).replace(/\b[Yy]ou'll\b/g, `${name} will`)
    .replace(/\bYour\b/g, `${name}'s`).replace(/\byour\b/g, `${name}'s`).replace(/\byourself\b/g, 'himself')
    .replace(/\b[Yy]ou ([a-z]+)\b/g, (m: string, v: string) => (['the', 'a', 'an', 'and', 'or', 'on', 'in', 'to', 'out', 'back', 'again', 'off', 'up', 'all'].includes(v) ? `${name} ${v}` : `${name} ${verb3(v)}`))
    .replace(/\b[Yy]ou\b/g, name);
}
const shout = (t: string) => t.toUpperCase().replace(/!*$/, '!');
function headline(p: Paper, n: News, name: string): string {
  const t = thirdPerson(n.title, name);
  if (p.cls === 'tabloid') return shout(t);
  return t;
}
/** An illustrated "photo" for a story: the player, the club's colours, or the trophy. */
function Photo({ g, n, big }: { g: Game; n: News; big?: boolean }) {
  const w = g.world;
  const pid = n.pids?.find((id) => w.players[id]) ?? (n.me ? g.career.pid : undefined);
  const p = pid ? w.players[pid] : null;
  const club = n.clubs?.find((id) => w.clubs[id]) ?? (p?.club ?? undefined);
  const col = club && w.clubs[club] ? w.clubs[club].col : ['#2b3a55', '#c9d6ea'];
  const h = big ? 230 : 120;
  const award = n.cat === 'award' && /Ballon|Boot|Glove|Kopa|Yashin|Player of|Trophy|Award/i.test(n.title);
  return (
    <figure className={`nphoto ${big ? 'big' : ''}`} style={{ height: h, background: `radial-gradient(120% 90% at 30% 20%, ${col[1]}55, transparent 60%), linear-gradient(160deg, ${col[0]}, #101318 85%)` }}>
      <div className="lights" aria-hidden="true" />
      {award && <div className="tro"><Trophy kind={/Ballon/i.test(n.title) ? 'ballon' : /Boot|Müller|Shoe/i.test(n.title) ? 'boot' : /Glove|Yashin/i.test(n.title) ? 'glove' : 'player'} size={big ? 90 : 50} /></div>}
      {p ? <div className="sub"><PlayerAvatar g={g} p={p} size={big ? 170 : 92} /></div> : club ? <div className="sub crest"><ClubBadge g={g} id={club} lg /></div> : <div className="sub crest"><Trophy kind="cup" size={big ? 90 : 50} /></div>}
      {n.cat === 'transfer' && n.clubs && n.clubs.length > 0 && <div className="to"><span>→</span><ClubBadge g={g} id={n.clubs[n.clubs.length - 1]} /></div>}
      <figcaption>{p ? `${p.name}${p.club && w.clubs[p.club] ? ` · ${w.clubs[p.club].name}` : ''}` : club && w.clubs[club] ? w.clubs[club].name : 'Archive photo'}</figcaption>
    </figure>
  );
}
/** The news as newspapers: one edition a week per paper, a lead story with a photo and columns. Old editions keep only the stories about you. */
export function NewsScreen({ g }: { g: Game }) {
  const w = g.world;
  const me = w.players[g.career.pid];
  const [cat, setCat] = useState('all');
  const [pid, setPid] = useState('touchline');
  const paper = PAPERS.find((x) => x.id === pid) ?? PAPERS[0];
  const weekOf = (n: { s: number; day: number }) => n.s * 100 + Math.floor(n.day / 7);
  const weeks = [...new Set(w.news.map(weekOf))].sort((a, b) => b - a);
  const [wk, setWk] = useState<number | null>(null);
  const cur = wk != null && weeks.includes(wk) ? wk : weeks[0];
  const inCat = (n: News) => (cat === 'all' ? true : cat === 'me' ? n.me : cat === 'club' ? n.cat === 'club' || n.cat === 'manager' : cat === 'world' ? ['world', 'record', 'youth'].includes(n.cat) : n.cat === cat);
  const score = (n: News) => n.imp + (paper.boost[n.cat] ?? 0) + (n.me ? 0.6 : 0) + (paper.cls === 'tabloid' && /€\d{3}|\d{3}m|record|sacked|row|fires back/i.test(n.title + n.body) ? 1 : 0);
  const list = w.news.filter((n) => weekOf(n) === cur && inCat(n) && (!paper.only || paper.only(g, n))).sort((a, b) => score(b) - score(a) || b.id - a.id);
  const lead = list[0];
  const idx = weeks.indexOf(cur);
  const name = me.name, sn = me.sn || me.name;
  const kick = (n: News) => paper.kicker?.[n.cat] ?? KICK[n.cat] ?? n.cat;
  return (
    <>
      <div className="pagehead"><div><h1>Newspapers</h1><div className="sub">Four papers, one edition a week each. When a season ends, only the stories about you are kept in the archive.</div></div>
        <span className="row wrap gap6"><button className="btn sm" disabled={idx >= weeks.length - 1} onClick={() => setWk(weeks[idx + 1])}>◀ Older</button><select value={cur ?? ''} onChange={(e) => setWk(+e.target.value)} aria-label="Edition">{weeks.map((x) => { const first = w.news.find((n) => weekOf(n) === x); return <option key={x} value={x}>{first?.date ?? x} · {seasonLabel(Math.floor(x / 100))}</option>; })}</select><button className="btn sm" disabled={idx <= 0} onClick={() => setWk(weeks[idx - 1])}>Newer ▶</button></span></div>
      <div className="paper-stand">{PAPERS.map((x) => <button key={x.id} className={`ps ${x.cls} ${x.id === pid ? 'on' : ''}`} onClick={() => setPid(x.id)}><b>{x.name}</b><span>{x.tag}</span></button>)}</div>
      <div className="row wrap mb">{CATS.map(([k, l]) => <button key={k} className={`btn sm ${cat === k ? 'pri' : ''}`} onClick={() => setCat(k)}>{l}</button>)}</div>
      {lead ? <div className={`npaper ${paper.cls}`}>
        <div className="mast"><h1>{paper.name}</h1><div className="tagl">{paper.tag}</div><div className="sub"><span>{lead.date}</span><span>{seasonLabel(lead.s)} · Edition {weeks.length - idx}</span><span>{list.length} stories</span></div></div>
        <div className="lead"><Photo g={g} n={lead} big /><div><div className="kick">{kick(lead)}</div><h2>{headline(paper, lead, name)}</h2><p>{thirdPerson(lead.body, sn)}</p></div></div>
        <div className="cols">{list.slice(1, 40).map((n, i) => <article key={n.id} className={n.me ? 'me' : ''}>{(i < 3 || i % 4 === 0) && (n.pids?.length || n.clubs?.length || n.me) ? <Photo g={g} n={n} /> : null}<div className="kick">{kick(n)} · {n.date}</div><h5>{headline(paper, n, name)}</h5><p>{thirdPerson(n.body, sn)}</p>{n.pids && n.pids.length > 0 && <p style={{ marginTop: 4 }}>{n.pids.slice(0, 3).map((id) => g.world.players[id] ? <span key={id} style={{ marginRight: 8 }}><PlayerLink g={g} id={id} /></span> : null)}</p>}</article>)}</div>
      </div> : <Empty>{paper.only ? `${paper.name} has nothing about you, Blue Lock or Japan this week.` : 'No stories in this edition for that section.'}</Empty>}
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
