import { useState } from 'react';
import type { Game, Offer } from '../engine/types';
import { openOffers, acceptOffer, rejectOffer, negotiate, NEGOTIATE, ROLE_NAME } from '../engine/transfers';
import { windowOpen, fmtDate, seasonLabel } from '../engine/competitions';
import { fmtEur, fmtWage } from '../engine/util';
import { marketValue } from '../engine/worldgen';
import { needsClub } from '../engine/sim';
import { ovr } from '../engine/attributes';
import { act, moment, toast } from '../store/game';
import { Card, Chip, ClubBadge, ClubLink, Empty, PlayerLink, Tabs, Kpi, Bar } from '../ui/kit';

function OfferCard({ g, o }: { g: Game; o: Offer }) {
  const w = g.world;
  const left = o.deadline - w.abs;
  const [talk, setTalk] = useState(false);
  return (
    <div className="card hot">
      <div className="row wrap between"><div className="row"><ClubBadge g={g} id={o.club} lg /><div><h2><ClubLink g={g} id={o.club} badge={false} /></h2><div className="small muted">{o.leagueName} · {o.kind === 'loan' ? 'Loan' : o.kind === 'renewal' ? 'Contract renewal' : o.kind === 'free' ? 'Free transfer' : o.kind === 'nel' ? 'First professional contract' : `Transfer — fee agreed ${fmtEur(o.fee)}`}</div></div></div>
        <div className="row wrap gap6"><Chip k="y">{ROLE_NAME[o.role]}</Chip><Chip k={left <= 3 ? 'r' : 'w'}>{left > 0 ? `${left} day${left > 1 ? 's' : ''} to decide` : 'Deadline today'}</Chip></div></div>
      {o.route && <p className="blue" style={{ marginTop: 8 }}><b>{o.route}</b></p>}
      {o.note && <p className="small muted">{o.note}</p>}
      <div className="grid g4 mt"><Kpi label="Wage" value={fmtWage(o.wage)} sub="EUR per week" /><Kpi label="Length" value={`${o.years} yr`} /><Kpi label="Continental" value={<span style={{ fontSize: 18 }}>{o.continental}</span>} /><Kpi label="Development" value={`${o.devScore}/10`} sub={o.dev} /></div>
      <div className="grid g2 mt">
        <div className="small"><p><b>Expected playing time:</b> {o.minutes}</p><p><b>Manager's plan:</b> {o.managerRole}</p><p><b>Bonuses:</b> signing {fmtEur(o.signOn)} · {fmtEur(o.goalBonus)} per goal · {fmtEur(o.appBonus)} per appearance{o.clause ? ` · release clause ${fmtEur(o.clause)}` : ''}</p></div>
        <div className="small"><b>Competition for your position ({o.position}):</b>{o.competition.length ? <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{o.competition.map((c) => <li key={c.name}>{c.name} — {c.pos}, {c.ovr} OVR, age {c.age}</li>)}</ul> : <p className="muted">Nobody established — the shirt is yours to lose.</p>}<span className="muted">You: {ovr(w.players[g.career.pid])} OVR.</span></div>
      </div>
      <div className="row small mt"><span className="muted" style={{ width: 110 }}>Club's interest</span><div className="grow"><Bar v={o.interest} kind={o.interest > 60 ? 'g' : o.interest > 35 ? 'w' : 'r'} /></div><span>{o.talks}/3 talks used</span></div>
      <div className="row wrap mt">
        <button className="btn pri" onClick={() => { const r = act((x) => acceptOffer(x, o.id)); if (r) { toast(r); if (o.kind !== 'renewal') moment('SIGNED', o.clubName); } }}>Accept</button>
        <button className="btn" onClick={() => setTalk((t) => !t)} disabled={o.talks >= 3}>Negotiate</button>
        <button className="btn danger" onClick={() => act((x) => rejectOffer(x, o.id))}>Reject</button>
        <span className="tiny muted">Or simply wait — the offer stays open until its deadline, though the club's interest is not guaranteed.</span>
      </div>
      {talk && <div className="row wrap mt">{NEGOTIATE.map((n) => <button key={n.id} className="btn sm" onClick={() => { const r = act((x) => negotiate(x, o.id, n.id)); if (r) toast(r); }}>{n.label}</button>)}</div>}
    </div>
  );
}

export function Transfers({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const [tab, setTab] = useState('offers');
  const offers = openOffers(g);
  const must = needsClub(g);
  const moves = [...w.transfers].reverse().filter((t) => t.type !== 'youth' && t.type !== 'loanEnd');
  const known = moves.filter((t) => c.rel[t.pid] || w.players[t.pid]?.origin === 'bluelock');
  return (
    <>
      <div className="pagehead"><div><h1>Transfers & Contracts</h1><div className="sub">Transfer window: <b className={windowOpen(w) ? 'good' : 'muted'}>{windowOpen(w) ? 'OPEN' : 'closed'}</b> · fees and values in EUR, wages in EUR per week (NEL bids were annual salaries in yen).</div></div></div>
      {must && <div className="card hot mb"><b className="warn">You must accept a contract before the calendar can continue.</b></div>}
      <div className="grid g4 mb">
        <Card><Kpi label="Your club" value={<span style={{ fontSize: 20 }}>{me.club ? w.clubs[me.club]?.name : 'Free agent'}</span>} sub={me.con ? `${ROLE_NAME[me.con.role]}${me.con.loanFrom ? ` · on loan from ${w.clubs[me.con.loanFrom]?.sn}` : ''}` : w.clubs[me.club ?? '']?.nel ? 'NEL registration (no pro contract yet)' : ''} /></Card>
        <Card><Kpi label="Wage" value={me.con ? fmtWage(me.con.wage) : '—'} sub={me.con ? `Contract ends summer ${me.con.until + 1}${me.con.clause ? ` · clause ${fmtEur(me.con.clause)}` : ''}` : ''} /></Card>
        <Card><Kpi label="Market value" value={fmtEur(marketValue(me, w.season))} sub="estimated transfer value" /></Card>
        <Card><Kpi label="Career earnings" value={fmtEur(c.wages)} sub={c.flags.wantOut ? 'You have asked to leave' : 'wages and bonuses'} /></Card>
      </div>
      <Tabs tabs={[['offers', `Offers (${offers.length})`], ['past', 'Past offers'], ['world', 'Transfer news'], ['known', 'People you know']]} value={tab} onChange={setTab} />
      {tab === 'offers' && (offers.length ? <div className="col">{offers.map((o) => <OfferCard key={o.id} g={g} o={o} />)}</div> : <Empty>No offers on the table. Interest comes from performances, potential, reputation, tactical fit and what clubs need — mostly while a window is open. You can ask your agent or manager for a move through Relationships.</Empty>)}
      {tab === 'past' && <Card>{c.offers.filter((o) => o.status !== 'open').length ? <table><thead><tr><th>Club</th><th>Type</th><th>Role</th><th className="n">Wage</th><th>Outcome</th></tr></thead><tbody>{[...c.offers].reverse().filter((o) => o.status !== 'open').slice(0, 40).map((o) => <tr key={o.id}><td>{o.clubName}</td><td>{o.kind}</td><td>{ROLE_NAME[o.role]}</td><td className="n">{fmtWage(o.wage)}</td><td><Chip k={o.status === 'accepted' ? 'g' : o.status === 'rejected' ? 'r' : ''}>{o.status}</Chip></td></tr>)}</tbody></table> : <Empty>Nothing yet.</Empty>}</Card>}
      {(tab === 'world' || tab === 'known') && <Card>{(tab === 'world' ? moves : known).length ? <div className="tw"><table><thead><tr><th>When</th><th>Player</th><th className="n">OVR</th><th>From</th><th>To</th><th>Type</th><th className="n">Fee</th></tr></thead><tbody>
        {(tab === 'world' ? moves.filter((t) => t.fee >= 5e6 || t.type === 'nel' || t.pid === me.id) : known).slice(0, 120).map((t) => <tr key={t.id} className={t.pid === me.id ? 'me' : ''}><td className="nowrap small">{seasonLabel(t.s)}</td><td><PlayerLink g={g} id={t.pid} full /></td><td className="n">{t.ovr}</td><td>{t.fromName}</td><td><b>{t.toName}</b></td><td className="small muted">{t.type}</td><td className="n num">{t.fee ? fmtEur(t.fee) : '—'}</td></tr>)}
      </tbody></table></div> : <Empty>No moves yet.</Empty>}<p className="tiny dim mt">Today: {fmtDate(w, w.day, true)}.</p></Card>}
    </>
  );
}
