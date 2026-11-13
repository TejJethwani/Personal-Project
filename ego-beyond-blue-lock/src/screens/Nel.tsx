import { useState } from 'react';
import type { Game } from '../engine/types';
import { isBlueLock } from '../engine/nel';
import { fmtYenShort, ordinal, fmtWage } from '../engine/util';
import { ovr } from '../engine/attributes';
import { tableOf, compFixtures } from '../engine/competitions';
import { openOffers, ROLE_NAME } from '../engine/transfers';
import { S } from '../engine/match/model';
import { act, nav } from '../store/game';
import { Card, Chip, ClubLink, DataTable, Empty, Ovr, PlayerLink, Tabs, Rating, type Col } from '../ui/kit';
import type { BidState } from '../engine/types';

export function NelBids({ g }: { g: Game }) {
  const w = g.world;
  const [tab, setTab] = useState('bl');
  const [sel, setSel] = useState<string>(g.career.pid);
  const all = Object.values(w.nel.bids).sort((a, b) => b.top - a.top);
  const rows = (tab === 'bl' ? all.filter((b) => w.players[b.pid] && isBlueLock(g, w.players[b.pid])) : all).filter((b) => w.players[b.pid]);
  const N = g.settings.nel.topN;
  const cols: Col<BidState>[] = [
    { h: '#', n: true, get: (b) => { const i = rows.indexOf(b) + 1; return <b className={tab === 'bl' && i <= N && b.top > 0 ? 'good num' : 'num'}>{b.top > 0 ? i : '—'}</b>; }, sort: (b) => -b.top },
    { h: 'Move', get: (b) => { const d = b.prevRank && b.rank ? b.prevRank - b.rank : 0; return d > 0 ? <span className="good">▲{d}</span> : d < 0 ? <span className="bad">▼{-d}</span> : <span className="dim">–</span>; } },
    { h: 'Player', get: (b) => <PlayerLink g={g} id={b.pid} full />, sort: (b) => w.players[b.pid].sn },
    { h: 'Team', get: (b) => <ClubLink g={g} id={w.players[b.pid].nelTeam ?? ''} /> },
    { h: 'Pos', get: (b) => w.players[b.pid].pos },
    { h: 'OVR', n: true, get: (b) => <Ovr v={ovr(w.players[b.pid])} size="sm" />, sort: (b) => ovr(w.players[b.pid]) },
    { h: 'Top bid (¥ / year)', n: true, get: (b) => <b className="num gold">{fmtYenShort(b.top)}</b>, sort: (b) => b.top },
    { h: 'Change', n: true, get: (b) => { const h = b.hist[b.hist.length - 1]; return h && h.delta ? <span className={h.delta > 0 ? 'good' : 'bad'}>{h.delta > 0 ? '+' : '−'}{fmtYenShort(Math.abs(h.delta))}</span> : ''; }, sort: (b) => b.hist[b.hist.length - 1]?.delta ?? 0 },
    { h: 'Leading club', get: (b) => (b.topClub ? <ClubLink g={g} id={b.topClub} /> : <span className="dim">no bid</span>) },
    { h: 'Ratings by round', get: (b) => <span className="small">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ marginRight: 5 }}>{b.perf[i] ? <Rating v={b.perf[i]} /> : <span className="dim">·</span>}</span>)}</span> },
  ];
  const b = w.nel.bids[sel];
  const sp = w.players[sel];
  return (
    <>
      <div className="pagehead"><div><h1>NEL Bids & Rankings</h1><div className="sub">After every round, clubs bid an <b>annual salary in Japanese yen</b> for each player. This is separate from later transfer fees (EUR) and weekly wages (EUR). Round {w.nel.round}/5 complete.</div></div></div>
      <Tabs tabs={[['bl', `Blue Lock ranking (top ${N} go to the U-20 World Cup)`], ['all', 'All NEL players']]} value={tab} onChange={setTab} />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)' }}>
        <Card>{rows.length ? <DataTable rows={rows} cols={cols} rowKey={(x) => x.pid} isMe={(x) => x.pid === g.career.pid} onRow={(x) => setSel(x.pid)} max={120} /> : <Empty>No bids yet — they arrive after Round 1.</Empty>}
          {tab === 'bl' && !isBlueLock(g, w.players[g.career.pid]) && <p className="small warn mt">You are not Japan-eligible, so you are ranked in "All NEL players": finishing in the overall top {N} earns a U-20 call-up from your own nation.</p>}</Card>
        <Card title={sp ? `${sp.name} — why clubs are interested` : 'Details'}>
          {b && sp ? <>
            {b.bids.length ? b.bids.map((x) => <div key={x.club} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><div className="row between"><ClubLink g={g} id={x.club} /><b className="num gold">{fmtYenShort(x.amt)}</b></div><ul className="tiny muted" style={{ margin: '4px 0', paddingLeft: 18 }}>{x.why.slice(0, 5).map((y, i) => <li key={i}>{y}</li>)}</ul></div>) : <Empty>No club has bid yet. Clubs need to see a rated appearance.</Empty>}
            <h4 className="mt">Bid history</h4>
            <table><thead><tr><th>Round</th><th>Club</th><th className="n">Bid</th><th className="n">Change</th><th className="n">Rank</th></tr></thead><tbody>{b.hist.map((h) => <tr key={h.rd}><td>{h.rd}</td><td>{h.clubName || '—'}</td><td className="n num">{fmtYenShort(h.amt)}</td><td className={`n ${h.delta > 0 ? 'good' : h.delta < 0 ? 'bad' : ''}`}>{h.delta ? (h.delta > 0 ? '+' : '−') + fmtYenShort(Math.abs(h.delta)) : ''}</td><td className="n">{h.rank || '—'}</td></tr>)}</tbody></table>
            <p className="tiny dim mt">Valuation = ability, age and potential × multi-match performance (recency-weighted) × consistency × diminishing production × weapon rarity × a capped bonus for big moments, then adjusted per club for tactical fit, positional need and wealth. Bids move at most +40% / −25% per round.</p>
          </> : <Empty>Select a player.</Empty>}
        </Card>
      </div>
    </>
  );
}

export function NelSummaryScreen({ g }: { g: Game }) {
  const w = g.world;
  const s = w.nel.summary;
  const [tab, setTab] = useState('eval');
  if (!s) return <Empty>The Neo Egoist League is still in progress.</Empty>;
  const me = w.players[g.career.pid];
  const offers = openOffers(g);
  const fs = compFixtures(w, 'nel');
  const stats = Object.values(w.players).filter((p) => p.ss.nel?.[S.APP] || p.hist.some((h) => h.comp === 'nel' && h.s === w.nel.summary!.table.length * 0 + w.season)).map((p) => ({ p, l: p.ss.nel })).filter((x) => x.l);
  const seen = () => act((x) => { x.career.flags.nelSummarySeen = 1; });
  return (
    <>
      <div className="hero mb"><div className="row wrap between">
        <div><div className="tiny up blue">Neo Egoist League — conclusion</div><h1>{w.clubs[s.champion]?.name} are champions</h1><p className="muted" style={{ marginTop: 6 }}>{s.selected ? '🔵 You are SELECTED for the U-20 World Cup.' : 'You are not in the U-20 World Cup squad. Your professional career starts regardless.'}</p></div>
        <div className="row"><div className="center"><span className={`ovr lg ${s.grade <= 'B' ? 't1' : s.grade === 'C' ? 't3' : 't5'}`}>{s.grade}</span><div className="tiny up muted">Your grade</div></div><div className="center"><span className="ovr lg t3" style={{ width: 150, fontSize: 30 }}>{fmtYenShort(s.myBid)}</span><div className="tiny up muted">Final bid · {s.myRank ? ordinal(s.myRank) : 'unranked'}</div></div></div>
      </div></div>
      <Tabs tabs={[['eval', 'Your evaluation'], ['table', 'Table & results'], ['rank', 'Final rankings'], ['stats', 'Player stats'], ['awards', 'Awards'], ['routes', `Career routes (${offers.length})`]]} value={tab} onChange={setTab} />
      {tab === 'eval' && <div className="grid g2"><Card title="Performance evaluation"><ul>{s.evalLines.map((l, i) => <li key={i} style={{ marginBottom: 6 }}>{l}</li>)}</ul></Card>
        <Card title="What happens next"><ol className="small"><li>Review the <b>career routes</b>: every contract your agent has secured. You must accept one before the professional season starts.</li><li>{s.selected ? 'Play the U-20 World Cup — performances there are watched too.' : 'The U-20 World Cup is simulated without you; the Blue Lock players who go will carry that into their careers.'}</li><li>The same save continues into the {w.season}/{String(w.season + 1).slice(2)} professional season with your attributes, abilities, relationships, rivalries, statistics and reputation intact.</li></ol><button className="btn pri" onClick={() => setTab('routes')}>See career routes</button></Card></div>}
      {tab === 'table' && <div className="grid g2"><Card title="Final table"><table><thead><tr><th>#</th><th>Team</th><th className="n">P</th><th className="n">W</th><th className="n">L</th><th className="n">GF</th><th className="n">GA</th><th className="n">Pts</th></tr></thead><tbody>{s.table.map((r, i) => <tr key={r.id} className={r.id === me.nelTeam ? 'me' : ''}><td>{i + 1}</td><td><ClubLink g={g} id={r.id} /></td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.l}</td><td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n num">{r.pts}</td></tr>)}</tbody></table></Card>
        <Card title="All ten results">{fs.length ? fs.map((f) => <div key={f.id} className="row between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}><span className="dim">R{f.rd}</span><span className="grow right">{w.clubs[f.h].sn}</span><b className="num">{f.sc?.[0]}–{f.sc?.[1]}</b><span className="grow">{w.clubs[f.a].sn}</span></div>) : tableOf(w, 'nel').length === 0 ? <Empty>Results archived.</Empty> : null}</Card></div>}
      {tab === 'rank' && <Card title="Final valuation ranking"><div className="tw" style={{ maxHeight: 560, overflowY: 'auto' }}><table><thead><tr><th>#</th><th>Player</th><th>NEL team</th><th className="n">Final bid (¥/yr)</th><th>Bidder</th><th>Blue Lock</th></tr></thead><tbody>{s.ranking.map((r) => <tr key={r.pid} className={r.pid === me.id ? 'me' : ''}><td>{r.rank}</td><td><PlayerLink g={g} id={r.pid} full /></td><td>{w.clubs[r.team]?.sn}</td><td className="n num gold">{fmtYenShort(r.amt)}</td><td>{r.club}</td><td>{r.bl ? (w.nel.top23?.includes(r.pid) ? <Chip k="g">Top {g.settings.nel.topN}</Chip> : <Chip>Missed</Chip>) : ''}</td></tr>)}</tbody></table></div></Card>}
      {tab === 'stats' && <Card title="NEL player statistics">{stats.length ? <DataTable rows={stats} rowKey={(x) => x.p.id} isMe={(x) => x.p.id === me.id} initial={3} cols={[
        { h: 'Player', get: (x) => <PlayerLink g={g} id={x.p.id} full /> }, { h: 'Team', get: (x) => w.clubs[x.p.nelTeam ?? '']?.sn ?? '' }, { h: 'Apps', n: true, get: (x) => x.l[S.APP], sort: (x) => x.l[S.APP] },
        { h: 'G', n: true, get: (x) => x.l[S.G], sort: (x) => x.l[S.G] }, { h: 'A', n: true, get: (x) => x.l[S.A], sort: (x) => x.l[S.A] }, { h: 'xG', n: true, get: (x) => x.l[S.XG].toFixed(1), sort: (x) => x.l[S.XG] },
        { h: 'Shots', n: true, get: (x) => x.l[S.SH], sort: (x) => x.l[S.SH] }, { h: 'KP', n: true, get: (x) => x.l[S.KP], sort: (x) => x.l[S.KP] }, { h: 'Tkl+Int', n: true, get: (x) => x.l[S.TKW] + x.l[S.INT], sort: (x) => x.l[S.TKW] + x.l[S.INT] },
        { h: 'Play min', n: true, get: (x) => Math.round(x.l[S.PLAY] / 60), sort: (x) => x.l[S.PLAY] }, { h: 'Rating', n: true, get: (x) => <Rating v={x.l[S.RATN] ? x.l[S.RAT] / x.l[S.RATN] : 0} />, sort: (x) => (x.l[S.RATN] ? x.l[S.RAT] / x.l[S.RATN] : 0) },
      ]} /> : <Empty>NEL statistics have been archived into each player's career history.</Empty>}</Card>}
      {tab === 'awards' && <div className="grid g2">{s.awards.map((id) => w.awards[id]).filter(Boolean).map((a) => <Card key={a.id} title={a.title} className={a.me ? 'hot' : ''}>{a.winner && <p><b className="gold">🏆 <PlayerLink g={g} id={a.winner.pid} full /></b> <span className="muted">· {a.winner.clubName}</span><br /><span className="small">{a.winner.line}</span></p>}{a.xi && <div className="small">{a.form}: {a.xi.map((x) => `${x.pos} ${x.name.split(' ').pop()}`).join(' · ')}</div>}{a.noms && a.noms.length > 1 && <p className="small muted">Finalists: {a.noms.slice(1).map((n) => n.name).join(', ')}</p>}<p className="tiny dim">{a.why}</p></Card>)}</div>}
      {tab === 'routes' && <><p className="muted small">These are your routes into professional football. Compare them fully — and negotiate — on the Transfers screen.</p><div className="grid g2">{offers.map((o) => <Card key={o.id} title={o.clubName} right={<Chip k="y">{ROLE_NAME[o.role]}</Chip>}><p className="blue small">{o.route}</p><p className="small">{o.leagueName} · {fmtWage(o.wage)} · {o.years} year{o.years > 1 ? 's' : ''} · Europe: {o.continental}</p><p className="small muted">{o.minutes}</p></Card>)}{!offers.length && <Empty>{me.club && !w.clubs[me.club]?.nel ? `You have signed for ${w.clubs[me.club].name}.` : 'No open offers.'}</Empty>}</div>
        <div className="row mt"><button className="btn pri big" onClick={() => { seen(); nav('transfers'); }}>Go to contract offers</button><button className="btn" onClick={() => { seen(); nav('hub'); }}>Back to hub</button></div></>}
    </>
  );
}
