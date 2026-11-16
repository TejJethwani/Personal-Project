import { useState } from 'react';
import type { Game, Offer, Transfer } from '../engine/types';
import { LEAGUES } from '../engine/data/clubs';
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
      {(tab === 'world' || tab === 'known') && <TransferList g={g} known={tab === 'known'} moves={moves} />}
    </>
  );
}

type Sort = 'fee' | 'recent' | 'ovr' | 'age' | 'name';
/** The transfer market, filterable by fee, team, league, position, season and the people that matter to you. */
function TransferList({ g, known, moves }: { g: Game; known: boolean; moves: Transfer[] }) {
  const w = g.world, c = g.career, me = w.players[c.pid];
  const [sort, setSort] = useState<Sort>('fee');
  const [who, setWho] = useState(known ? 'known' : 'all');
  const [team, setTeam] = useState('');
  const [league, setLeague] = useState('');
  const [pos, setPos] = useState('');
  const [season, setSeason] = useState('all');
  const [minFee, setMinFee] = useState(known ? 0 : 5e6);
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const seasons = [...new Set(moves.map((t) => t.s))].sort((a, b) => b - a);
  const teams = [...new Set(moves.flatMap((t) => [t.from, t.to]).filter((x): x is string => !!x && !!w.clubs[x]))].sort((a, b) => w.clubs[a].name.localeCompare(w.clubs[b].name));
  const leagues = LEAGUES.map((l) => [l.id, l.name] as const);
  const rivals = new Set(c.rivals);
  const leagueOf = (id: string | null) => (id ? w.clubs[id]?.league ?? '' : '');
  const list = moves.filter((t) => {
    const p = w.players[t.pid];
    if (who === 'me' && t.pid !== me.id) return false;
    if (who === 'rivals' && !rivals.has(t.pid)) return false;
    if (who === 'known' && !(c.rel[t.pid] || p?.origin === 'bluelock' || t.pid === me.id)) return false;
    if (who === 'bluelock' && p?.origin !== 'bluelock') return false;
    if (who === 'young' && (!p || t.s - p.born > 21)) return false;
    if (who === 'myclub' && t.from !== me.club && t.to !== me.club) return false;
    if (team && t.from !== team && t.to !== team) return false;
    if (league && leagueOf(t.from) !== league && leagueOf(t.to) !== league) return false;
    if (pos && p?.pos !== pos) return false;
    if (season !== 'all' && t.s !== +season) return false;
    if (kind !== 'all' && t.type !== kind) return false;
    if (t.fee < minFee && !(minFee === 0)) return false;
    if (q && !`${t.name} ${t.fromName} ${t.toName}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const sorted = [...list].sort((a, b) => sort === 'fee' ? b.fee - a.fee || b.id - a.id : sort === 'recent' ? b.id - a.id : sort === 'ovr' ? b.ovr - a.ovr : sort === 'age' ? (w.players[b.pid]?.born ?? 0) - (w.players[a.pid]?.born ?? 0) : a.name.localeCompare(b.name));
  const total = list.reduce((x, t) => x + t.fee, 0);
  const tag = (t: Transfer) => t.pid === me.id ? <Chip k="b">you</Chip> : rivals.has(t.pid) ? <Chip k="r">rival</Chip> : w.players[t.pid]?.origin === 'bluelock' ? <Chip k="b">Blue Lock</Chip> : c.rel[t.pid] ? <Chip>known</Chip> : null;
  return (
    <Card>
      <div className="row wrap gap6 mb tr-filters">
        <input placeholder="Search player or club" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort"><option value="fee">Highest fee</option><option value="recent">Most recent</option><option value="ovr">Highest rated</option><option value="age">Youngest</option><option value="name">Name</option></select>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who"><option value="all">Everyone</option><option value="rivals">Your rivals</option><option value="known">People you know</option><option value="bluelock">Blue Lock players</option><option value="myclub">In or out of your club</option><option value="young">Aged 21 or under</option><option value="me">You</option></select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team"><option value="">Any team</option>{teams.map((id) => <option key={id} value={id}>{w.clubs[id].name}</option>)}</select>
        <select value={league} onChange={(e) => setLeague(e.target.value)} aria-label="League"><option value="">Any league</option>{leagues.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position"><option value="">Any position</option>{['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'SS', 'ST'].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season"><option value="all">All seasons</option>{seasons.map((x) => <option key={x} value={x}>{seasonLabel(x)}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type"><option value="all">All types</option><option value="transfer">Transfers</option><option value="loan">Loans</option><option value="free">Free transfers</option><option value="nel">NEL signings</option><option value="release">Releases</option></select>
        <select value={minFee} onChange={(e) => setMinFee(+e.target.value)} aria-label="Minimum fee"><option value={0}>Any fee</option><option value={5e6}>€5m+</option><option value={20e6}>€20m+</option><option value={50e6}>€50m+</option><option value={100e6}>€100m+</option></select>
      </div>
      <p className="small muted">{list.length} move{list.length === 1 ? '' : 's'} · {fmtEur(total)} in fees{list.length ? ` · record: ${[...list].sort((a, b) => b.fee - a.fee)[0].name} (${fmtEur([...list].sort((a, b) => b.fee - a.fee)[0].fee)})` : ''}</p>
      {sorted.length ? <div className="tw"><table><thead><tr><th>When</th><th>Player</th><th className="n">OVR</th><th>From</th><th>To</th><th>Type</th><th className="n">Fee</th></tr></thead><tbody>
        {sorted.slice(0, 200).map((t) => <tr key={t.id} className={t.pid === me.id ? 'me' : ''}><td className="nowrap small">{seasonLabel(t.s)} · {fmtDate({ phase: w.phase, season: t.s }, t.day)}</td><td><PlayerLink g={g} id={t.pid} full /> {tag(t)}</td><td className="n">{t.ovr}</td><td>{t.from && w.clubs[t.from] ? <ClubLink g={g} id={t.from} /> : t.fromName}</td><td><b>{t.to && w.clubs[t.to] ? <ClubLink g={g} id={t.to} /> : t.toName}</b></td><td className="small muted">{t.type}</td><td className="n num">{t.fee ? fmtEur(t.fee) : '—'}</td></tr>)}
      </tbody></table></div> : <Empty>No moves match these filters.</Empty>}
      <p className="tiny dim mt">Today: {fmtDate(w, w.day, true)}. Showing up to 200.</p>
    </Card>
  );
}
