import type { Game } from '../engine/types';
import { ovr } from '../engine/attributes';
import { nextStop, nextUserFixture, userSide } from '../engine/sim';
import { tableOf, fmtDate, seasonLabel } from '../engine/competitions';
import { teamName } from '../engine/match/setup';
import { pendingInteractions } from '../engine/interactions';
import { openOffers, ROLE_NAME } from '../engine/transfers';
import { fmtYenShort, fmtWage, ordinal } from '../engine/util';
import { weeklyGrowth } from '../engine/development';
import { S } from '../engine/match/model';
import { nav } from '../store/game';
import { TotwPitch, latestTotw, Paper } from '../ui/Totw';
import { continueGame } from '../ui/flow';
import { Bar, Card, Chip, ClubBadge, ClubLink, Kpi, Ovr, PlayerAvatar, Rating } from '../ui/kit';

export function Hub({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const stop = nextStop(g);
  const nf = nextUserFixture(g);
  const club = me.club ? w.clubs[me.club] : null;
  const leagueId = w.phase === 'nel' ? 'nel' : club?.league ?? '';
  const tab = leagueId && w.comps[leagueId] ? tableOf(w, leagueId) : [];
  const myPos = tab.findIndex((r) => r.id === me.club);
  const lo = Math.max(0, Math.min(myPos - 2, tab.length - 5));
  const pend = pendingInteractions(g), offers = openOffers(g);
  const bid = w.nel.bids[me.id];
  const last = c.matches[c.matches.length - 1];
  let ap = 0, gl = 0, as = 0, rt = 0, rn = 0;
  for (const k in me.ss) { const l = me.ss[k]; ap += l[S.APP]; gl += l[S.G]; as += l[S.A]; rt += l[S.RAT]; rn += l[S.RATN]; }
  const news = [...w.news].reverse().filter((n) => n.me || n.imp >= 2).slice(0, 6);
  return (
    <>
      <div className="hero mb">
        <div className="row wrap between">
          <div className="row"><PlayerAvatar g={g} p={me} size={84} /><div>
            <div className="tiny up blue">{w.phase === 'nel' ? 'Neo Egoist League' : seasonLabel(w.season)} · {fmtDate(w, w.day, true)}</div>
            <h1>{me.name}{me.nick ? <span className="muted" style={{ fontSize: 22 }}> "{me.nick}"</span> : null}</h1>
            <div className="row wrap gap6 mt" style={{ marginTop: 6 }}>{club && <ClubLink g={g} id={club.id} />}<Chip k="b">{me.pos}</Chip><Chip>Age {w.season - me.born}</Chip>{me.con && <Chip k="y">{ROLE_NAME[me.con.role]}</Chip>}{me.inj > 0 && <Chip k="r">Injured {me.inj}d</Chip>}{me.susp > 0 && <Chip k="r">Suspended</Chip>}{me.con?.loanFrom && <Chip k="w">On loan from {w.clubs[me.con.loanFrom]?.sn}</Chip>}</div>
          </div></div>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny up muted">Next</div>
            <div className="num" style={{ fontSize: 26 }}>{stop.label}</div>
            <div className="small muted mb">{stop.detail}</div>
            <button className="btn pri big pulse" onClick={() => continueGame()} disabled={stop.kind === 'retired'}>{stop.kind === 'match' ? 'Go to match' : stop.kind === 'none' ? 'Continue' : stop.label}</button>
          </div>
        </div>
      </div>
      {(pend.length > 0 || offers.length > 0 || Object.keys(c.flags).some((k) => k.startsWith('evo:'))) && <div className="row wrap mb">
        {pend.length > 0 && <button className="btn" onClick={() => nav('relationships', 'inbox')}>💬 {pend.length} interaction{pend.length > 1 ? 's' : ''} waiting</button>}
        {offers.length > 0 && <button className="btn" onClick={() => nav('transfers')}>📄 {offers.length} contract offer{offers.length > 1 ? 's' : ''}</button>}
        {Object.keys(c.flags).some((k) => k.startsWith('evo:')) && <button className="btn" onClick={() => nav('weapons')}>⚡ A weapon is ready to evolve</button>}
      </div>}
      <div className="grid g4 mb">
        <Card><div className="row"><Ovr v={ovr(me)} size="lg" /><div className="grow"><Kpi label="Potential" value={me.pot} /><div className="tiny muted mt">≈ {weeklyGrowth(g).toFixed(1)} attribute pts / week of training</div></div></div></Card>
        <Card><div className="col gap6"><div className="row between small"><span>Condition</span><b>{Math.round(me.fit)}%</b></div><Bar v={me.fit} kind={me.fit < 55 ? 'r' : me.fit < 75 ? 'w' : 'g'} /><div className="row between small"><span>Morale</span><b>{Math.round(me.morale)}</b></div><Bar v={me.morale} /><div className="row between small"><span>Match sharpness</span><b>{Math.round(me.sharp)}</b></div><Bar v={me.sharp} /></div></Card>
        <Card><div className="col gap6"><div className="row between small"><span>Coach trust</span><b>{Math.round(c.mgrTrust)}</b></div><Bar v={c.mgrTrust} kind={c.mgrTrust < 40 ? 'r' : ''} /><div className="row between small"><span>Tactical discipline</span><b>{Math.round(c.discipline)}%</b></div><Bar v={c.discipline} /><div className="row between small"><span>Reputation</span><b>{Math.round(me.rep)}</b></div><Bar v={me.rep} kind="e" /></div></Card>
        <Card><div className="grid g2"><Kpi label="Apps" value={ap} /><Kpi label="Goals" value={gl} /><Kpi label="Assists" value={as} /><Kpi label="Avg rating" value={rn ? (rt / rn).toFixed(2) : '—'} /></div>{me.con && <div className="tiny muted mt">{fmtWage(me.con.wage)} · contract to {me.con.until + 1}</div>}</Card>
      </div>
      <div className="grid g3">
        <Card title="Next match">
          {nf ? (() => { const side = userSide(g, nf)!; const opp = nf.h === side ? nf.a : nf.h; return <>
            <div className="row"><ClubBadge g={g} id={side} lg /><span className="num" style={{ fontSize: 22 }}>v</span><ClubBadge g={g} id={opp} lg /><div><b>{teamName(w, opp)}</b><div className="small muted">{w.comps[nf.comp]?.name}{nf.stg ? ` · ${nf.stg}` : ` · Round ${nf.rd}`}</div><div className="small">{fmtDate(w, nf.day, true)} · {nf.day - w.day === 0 ? 'today' : `in ${nf.day - w.day} day${nf.day - w.day > 1 ? 's' : ''}`}</div></div></div>
            {c.lastSel && <p className="tiny muted mt">Last selection: {c.lastSel.started ? 'started' : c.lastSel.inSquad ? 'on the bench' : 'left out'} — {c.lastSel.reasons[0]}</p>}
          </>; })() : <p className="muted">No fixture scheduled. {w.phase === 'nel' && w.nel.done ? 'The NEL is over — choose your professional club.' : ''}</p>}
          {last && <div className="mt small" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><span className="muted">Last: </span><b className={last.res === 'W' ? 'good' : last.res === 'L' ? 'bad' : ''}>{last.res} {last.sc[0]}–{last.sc[1]}</b> v {last.oppName} · you <Rating v={last.rat} />{last.line ? ` · ${last.line[S.G]}G ${last.line[S.A]}A` : ' · did not play'}</div>}
        </Card>
        <Card title={w.comps[leagueId]?.name ?? 'Table'} right={<button className="btn sm ghost" onClick={() => nav('competitions', leagueId)}>Full table</button>}>
          {tab.length ? <table><tbody>{tab.slice(lo, lo + 5).map((r) => <tr key={r.id} className={r.id === me.club ? 'me' : ''}><td className="n dim">{tab.indexOf(r) + 1}</td><td><ClubLink g={g} id={r.id} /></td><td className="n">{r.p}</td><td className="n">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="n num">{r.pts}</td></tr>)}</tbody></table> : <p className="muted">You are not in a league right now.</p>}
          {w.phase === 'nel' && <div className="mt row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><div><div className="tiny up muted">Your top bid (annual salary, yen)</div><b className="num gold" style={{ fontSize: 26 }}>{bid?.top ? fmtYenShort(bid.top) : 'No bid yet'}</b>{bid?.rank ? <span className="small muted"> · {ordinal(bid.rank)} overall</span> : null}</div><button className="btn sm" onClick={() => nav('bids')}>Rankings</button></div>}
        </Card>
        <Card title="Headlines" right={<button className="btn sm ghost" onClick={() => nav('news')}>All news</button>}>
          <div className="feed">{news.map((n) => <div key={n.id} className={`it i${n.imp}`} style={{ gridTemplateColumns: '54px 1fr' }}><span className="tiny dim">{n.date}</span><div><b className="small">{n.title}</b></div></div>)}</div>
        </Card>
      </div>
      {(() => { const tw = latestTotw(g, w.phase === 'nel' ? 'nel' : leagueId); const paper = [...w.news].reverse().filter((n) => n.cat === 'paper'); return (tw || paper.length > 0) && <div className="grid g2 mt">
        {tw && <Card title={`${tw.title} — ${tw.period}`} right={<span className="tiny muted">{tw.compName} · {tw.form}</span>} className={tw.me ? 'hot' : ''}><TotwPitch g={g} a={tw} />{tw.me && <p className="small blue mt">You made the eleven.</p>}</Card>}
        <Card title="This week's paper" right={<button className="btn sm ghost" onClick={() => nav('news')}>All editions</button>}><Paper items={paper} limit={3} /></Card>
      </div>; })()}
      {c.digest.length > 0 && <Card title="Since you last looked" className="mt"><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{[...new Set(c.digest)].slice(0, 8).map((d, i) => <li key={i}>{d}</li>)}</ul></Card>}
    </>
  );
}
