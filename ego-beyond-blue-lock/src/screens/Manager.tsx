/** Manager mode screens: setup, hub, squad & tactics, transfers, match day (watch live with subs and tactics), board & career. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game, Player, Pos, Tactics } from '../engine/types';
import type { MatchState } from '../engine/match/model';
import { S } from '../engine/match/model';
import { NATIONS } from '../engine/data/nations';
import { LEAGUES, FORMATIONS, STYLES_TAC } from '../engine/data/clubs';
import { ovr, fitAt } from '../engine/attributes';
import { marketValue } from '../engine/worldgen';
import { fmtEur, ordinal } from '../engine/util';
import { fmtDate, seasonLabel, tableOf } from '../engine/competitions';
import { clockLabel } from '../engine/match/rules';
import { teamName, teamInfo, pickSheet, available } from '../engine/match/setup';
import { advance as advMatch, managerSub, ratingOf } from '../engine/match/engine';
import { userFixtureToday, startUserMatch, finishUserMatch, nextUserFixture, userSide } from '../engine/sim';
import { mgrClub, validSheet, assistantSheet, askingPrice, wageDemand, bid, windowOpen, toggleListed, toggleReleaseAtEnd, releaseNow, releaseCost, renew, renewDemand, acceptOfferFor, rejectOfferFor, takeJob, resign, wageBill, squadLevel, mgrSide, expectedFinish } from '../engine/manager';
import { newManagerGame } from '../engine/managerStart';
import { saveGame } from '../storage/idb';
import { act, autosave, nav, refresh, setGame, toast, setBusy } from '../store/game';
import { continueGame } from '../ui/flow';
import { LongSimModal } from '../ui/LongSim';
import { LivePitch } from '../ui/LivePitch';
import { Bar, Card, Chip, ClubBadge, ConfirmButton, Empty, Kpi, Modal, PlayerAvatar, PlayerLink, Rating, Tabs, Ovr } from '../ui/kit';
import { Scoreboard, StatTable, Ratings } from './Match';

const natList = Object.values(NATIONS).sort((a, b) => a.name.localeCompare(b.name));
const eurM = (v: number) => fmtEur(v);

// ───────────────────────────── new manager career ─────────────────────────────
export function MgrCreate() {
  const [name, setName] = useState('');
  const [nat, setNat] = useState('JPN');
  const [lg, setLg] = useState('eng1');
  const [club, setClub] = useState('');
  const [busy, setB] = useState(false);
  const L = LEAGUES.find((x) => x.id === lg)!;
  const rows = L.rows.trim().split('\n').map((r) => { const [short, nm, , abbr, rep, c1, c2, style] = r.split('|'); return { id: `${L.id}_${short}`, name: nm, abbr, rep: +rep, c1, c2, style }; }).sort((a, b) => b.rep - a.rep);
  const start = async () => {
    if (!club) { toast('Pick a club to manage.', true); return; }
    setB(true); setBusy('Building the world and playing out the Neo Egoist League…');
    await new Promise((r) => setTimeout(r, 40));
    try { const g = newManagerGame({ name: name.trim() || 'The Manager', nat, club, seed: (Date.now() % 2147483647) >>> 0 }); await saveGame(g, 'auto'); setGame(g); setBusy(''); nav('mhub'); }
    catch (e) { console.error(e); setBusy(''); setB(false); toast('Could not start the career: ' + (e as Error).message, true); }
  };
  const diff = (rep: number) => rep >= 90 ? ['Title or bust', 'r'] : rep >= 84 ? ['Top four expected', 'w'] : rep >= 78 ? ['Europe expected', 'y'] : rep >= 72 ? ['Mid-table', 'b'] : ['Survival fight', 'g'];
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}>
      <div className="topbar"><button className="btn sm ghost" onClick={() => nav('menu')}>← Menu</button><h3 className="grow">New manager career</h3><button className="btn pri" disabled={busy || !club} onClick={start}>{busy ? 'Starting…' : 'Take the job'}</button></div>
      <div className="page" style={{ maxWidth: 1180 }}>
        <div className="grid g2 mb">
          <section className="card"><h3>You</h3><div className="grid g2">
            <label className="f">Name<input value={name} maxLength={28} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jinpachi Ego" autoFocus /></label>
            <label className="f">Nationality<select value={nat} onChange={(e) => setNat(e.target.value)}>{natList.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
          </div><p className="small muted mt">You start in the {seasonLabel(2025)} season. The Neo Egoist League and the U-20 World Cup are played out first; the Blue Lock graduates are then on the market like everyone else.</p></section>
          <section className="card"><h3>How it works</h3><ul className="small" style={{ paddingLeft: 18, margin: 0 }}><li>Pick the eleven, the bench and the tactics — or let your assistant do it.</li><li>Buy, sell, release and renew contracts within a transfer budget and a wage budget.</li><li>Watch matches live and make substitutions and tactical changes, or quick-sim them.</li><li>The board sets a target. Miss it badly and you are sacked — then pick a new job.</li></ul></section>
        </div>
        <Tabs tabs={LEAGUES.map((x) => [x.id, x.name] as [string, string])} value={lg} onChange={(v) => { setLg(v); setClub(''); }} />
        <div className="grid gauto">
          {rows.map((r) => { const [d, k] = diff(r.rep); return (
            <button key={r.id} className={`opt ${club === r.id ? 'hot' : ''}`} onClick={() => setClub(r.id)} style={{ padding: '10px 12px' }}>
              <span className="row gap6"><span className="mgr-crest" style={{ background: `linear-gradient(135deg, ${r.c1} 50%, ${r.c2} 50%)` }}>{r.abbr}</span><b style={{ fontSize: 17 }}>{r.name}</b></span>
              <span className="row wrap gap4 mt"><Chip k={k}>{d}</Chip><Chip>Reputation {r.rep}</Chip><Chip>{STYLES_TAC[r.style]?.name ?? r.style}</Chip></span>
            </button>); })}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── hub ─────────────────────────────
function ConfBar({ v }: { v: number }) { return <div className="row gap6"><div className="grow"><Bar v={v} kind={v >= 60 ? 'g' : v >= 35 ? 'w' : 'r'} tall /></div><b className="num" style={{ width: 44, textAlign: 'right' }}>{Math.round(v)}%</b></div>; }
export function MgrHub({ g }: { g: Game }) {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const [long, setLong] = useState(false);
  useEffect(() => { if (m.unread) act((x) => { x.mgr!.unread = 0; }, false); }, []);
  if (!c) return <MgrBoard g={g} />;
  const nf = nextUserFixture(g);
  const tab = c.league ? tableOf(w, c.league) : [];
  const pos = tab.findIndex((r) => r.id === c.id) + 1;
  const around = tab.slice(Math.max(0, pos - 4), Math.max(0, pos - 4) + 7);
  const open = m.offers.filter((o) => o.status === 'open');
  const last = m.matches.slice(-6).reverse();
  return (
    <>
      <div className="hero mb mgr-hero" style={{ borderColor: c.col[0] }}>
        <div className="row wrap" style={{ gap: 18 }}>
          <ClubBadge g={g} id={c.id} lg />
          <div className="grow"><div className="tiny up blue">{seasonLabel(w.season)} · {fmtDate(w, w.day, true)}</div><h1>{c.name}</h1><div className="small muted">Manager: <b>{m.name}</b> · {NATIONS[m.nat]?.name} · reputation {Math.round(m.rep)} · in charge since {seasonLabel(m.since)}</div></div>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny up muted">Next</div>
            <div className="num" style={{ fontSize: 24 }}>{nf ? `${nf.h === c.id ? 'v' : '@'} ${teamName(w, nf.h === c.id ? nf.a : nf.h)} · ${nf.day - w.day <= 0 ? 'today' : nf.day - w.day === 1 ? 'tomorrow' : `in ${nf.day - w.day} days`}` : 'No fixture'}</div>
            <div className="small muted mb">{nf ? w.comps[nf.comp]?.name : ''}</div>
            <button className="btn pri big pulse" onClick={() => continueGame()}>Continue</button>
            <div style={{ marginTop: 6 }}><button className="btn sm ghost" onClick={() => setLong(true)}>⏩ Sim several years…</button></div>
            {long && <LongSimModal g={g} onClose={() => setLong(false)} />}
          </div>
        </div>
      </div>
      <div className="grid g4 mb">
        <Card title="Board confidence"><ConfBar v={m.conf} /><p className="small muted" style={{ marginTop: 6 }}>Target: <b>{m.obj.text}</b> (around {ordinal(m.obj.pos)}).</p></Card>
        <Card title="League position"><Kpi label={w.comps[c.league ?? '']?.name ?? ''} value={pos ? ordinal(pos) : '—'} sub={pos ? `${tab[pos - 1].pts} pts from ${tab[pos - 1].p}` : ''} /></Card>
        <Card title="Transfer budget"><Kpi label={windowOpen(w) ? 'Window open' : 'Window closed'} value={eurM(m.budget)} sub={`Wages ${eurM(wageBill(w, c))}/${eurM(m.wageBudget)} a week`} /></Card>
        <Card title="Squad"><Kpi label={`${c.squad.length} players`} value={squadLevel(w, c).toFixed(1)} sub="average OVR of the best 15" /></Card>
      </div>
      <div className="grid g3 mb">
        <Card title="Inbox" right={<span className="tiny muted">{m.msgs.length} message{m.msgs.length === 1 ? '' : 's'}</span>}>
          {open.length > 0 && <div className="mb">{open.map((o) => { const p = w.players[o.pid]; return p ? <div key={o.id} className="mgr-offer"><b>{w.clubs[o.from]?.name}</b> offer <b className="gold">{eurM(o.fee)}</b> for <PlayerLink g={g} id={p.id} /> <span className="tiny muted">(value {eurM(marketValue(p, w.season))})</span><div className="row gap6 mt"><button className="btn sm pri" onClick={() => { const e = act((x) => acceptOfferFor(x, o.id)); if (e) toast(e, true); else toast(`${p.name} sold.`); }}>Accept</button><button className="btn sm ghost" onClick={() => act((x) => rejectOfferFor(x, o.id))}>Reject</button></div></div> : null; })}</div>}
          <div className="mgr-msgs">{m.msgs.slice(0, 12).map((x) => <div key={x.id} className={`mgr-msg k-${x.kind}`}><span className="tiny dim">{x.date}</span><b>{x.title}</b><span className="small muted">{x.body}</span></div>)}{!m.msgs.length && <Empty>No messages.</Empty>}</div>
        </Card>
        <Card title={w.comps[c.league ?? '']?.name ?? 'League'} right={<button className="btn sm ghost" onClick={() => nav('competitions', c.league ?? undefined)}>Full table</button>}>
          <table><tbody>{around.map((r) => { const i = tab.indexOf(r) + 1; return <tr key={r.id} className={r.id === c.id ? 'me' : ''}><td className="dim">{i}</td><td><span className="row gap6"><ClubBadge g={g} id={r.id} />{w.clubs[r.id]?.sn}</span></td><td className="n">{r.p}</td><td className="n">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="n num">{r.pts}</td></tr>; })}</tbody></table>
        </Card>
        <Card title="Recent results">{last.length ? last.map((x) => <div key={x.fid} className="row between small" style={{ padding: '3px 0', borderBottom: '1px solid var(--line)' }}><span className={`num ${x.res === 'W' ? 'good' : x.res === 'L' ? 'bad' : ''}`} style={{ width: 18 }}>{x.res}</span><span className="grow">{x.home ? 'v' : '@'} {x.oppName} <span className="tiny dim">{x.compName}</span></span><b className="num">{x.sc[0]}–{x.sc[1]}{x.pens ? '*' : ''}</b><span className={`tiny ${x.conf >= 0 ? 'good' : 'bad'}`} style={{ width: 40, textAlign: 'right' }} title="Board confidence change">{x.conf >= 0 ? '+' : ''}{x.conf}</span></div>) : <Empty>No matches yet.</Empty>}</Card>
      </div>
      <div className="row wrap gap6"><button className="btn" onClick={() => nav('msquad')}>Squad & tactics</button><button className="btn" onClick={() => nav('mtransfers')}>Transfer market</button><button className="btn" onClick={() => nav('calendar')}>Calendar</button><button className="btn" onClick={() => nav('mboard')}>Board & career</button></div>
    </>
  );
}

// ───────────────────────────── squad & tactics ─────────────────────────────
const TAC_KEYS: [keyof Tactics, string, string, string][] = [['press', 'Pressing', 'Sit off', 'Press high'], ['line', 'Defensive line', 'Deep', 'High'], ['tempo', 'Tempo', 'Patient', 'Fast'], ['width', 'Width', 'Narrow', 'Wide'], ['direct', 'Passing', 'Short', 'Direct']];
export function TacticSliders({ tac, onChange }: { tac: Tactics; onChange: (t: Tactics) => void }) {
  return <div className="col" style={{ gap: 10 }}>{TAC_KEYS.map(([k, label, lo, hi]) => <label key={k} className="f"><span className="row between"><b>{label}</b><span className="tiny muted">{lo} ← {Math.round((tac[k] as number) * 100)} → {hi}</span></span><input type="range" min={0.1} max={0.95} step={0.05} value={tac[k] as number} onChange={(e) => onChange({ ...tac, [k]: +e.target.value })} aria-label={label} /></label>)}</div>;
}
export function MgrSquad({ g }: { g: Game }) {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const [tab, setTab] = useState('team');
  if (!c) return <MgrBoard g={g} />;
  const sheet = validSheet(g);
  const sl = FORMATIONS[sheet.form];
  const squad = c.squad.map((id) => w.players[id]).filter(Boolean).sort((a, b) => (a.pos === 'GK' ? 0 : 1) - (b.pos === 'GK' ? 0 : 1) || ovr(b) - ovr(a));
  const setSheet = (xi: string[], bench: string[], form = sheet.form) => act((x) => { x.mgr!.sheet = { form, xi, bench }; x.mgr!.autoPick = false; });
  // a new shape: the best eleven for it (you can still change any slot afterwards)
  const changeForm = (form: string) => act((x) => { x.world.clubs[c.id].tac.form = form; x.mgr!.sheet = assistantSheet(x); x.mgr!.sheet.form = form; x.mgr!.autoPick = false; });
  const swapIn = (k: number, id: string) => { const xi = [...sheet.xi]; const bench = sheet.bench.filter((b) => b !== id); const j = xi.indexOf(id); if (j >= 0) xi[j] = xi[k]; else if (xi[k] && !bench.includes(xi[k])) bench.unshift(xi[k]); xi[k] = id; setSheet(xi, bench.slice(0, 9)); };
  const toggleBench = (id: string) => { const b = sheet.bench.includes(id) ? sheet.bench.filter((x) => x !== id) : [...sheet.bench, id].slice(0, 9); setSheet(sheet.xi, b); };
  const status = (p: Player) => p.inj > 0 ? <Chip k="r">Injured {p.inj}d</Chip> : p.susp > 0 ? <Chip k="r">Suspended</Chip> : p.fit < 70 ? <Chip k="w">Tired {Math.round(p.fit)}%</Chip> : null;
  return (
    <>
      <div className="pagehead"><div><h1>Squad & tactics</h1><div className="sub">{c.name} · {c.squad.length} players · {m.autoPick ? 'the assistant picks the team before each match' : 'you pick the team'}</div></div>
        <div className="row gap6"><button className={`btn ${m.autoPick ? 'pri' : ''}`} onClick={() => act((x) => { x.mgr!.autoPick = !x.mgr!.autoPick; if (!x.mgr!.autoPick) x.mgr!.sheet = assistantSheet(x); })}>{m.autoPick ? '🤖 Assistant picks' : '✋ I pick'}</button>{!m.autoPick && <button className="btn" onClick={() => act((x) => { x.mgr!.sheet = assistantSheet(x); })}>Use the assistant's eleven</button>}</div></div>
      <Tabs tabs={[['team', 'Team sheet'], ['tac', 'Tactics'], ['players', 'Players & contracts']]} value={tab} onChange={setTab} />
      {tab === 'team' && <div className="grid g2">
        <Card title={`Starting eleven — ${sheet.form}`} right={<select value={sheet.form} onChange={(e) => changeForm(e.target.value)} aria-label="Formation">{Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}</select>}>
          <div className="mgr-pitch">
            {sl.map((s, k) => { const p = w.players[sheet.xi[k]]; return (
              <div key={k} className="mgr-slot" style={{ left: `${(s[2] as number)}%`, bottom: `${Math.min(92, (s[1] as number) * 1.05 + 2)}%` }}>
                <span className="tiny">{s[0]}</span>
                <select value={sheet.xi[k] ?? ''} onChange={(e) => swapIn(k, e.target.value)} aria-label={`Slot ${s[0]}`}>
                  {squad.filter((q) => ((s[0] as string) === 'GK') === (q.pos === 'GK') || q.id === sheet.xi[k]).sort((a, b) => fitAt(b, s[0] as Pos) - fitAt(a, s[0] as Pos)).map((q) => <option key={q.id} value={q.id} disabled={!available(q)}>{q.sn} {Math.round(fitAt(q, s[0] as Pos))}{q.pos !== s[0] ? ` (${q.pos})` : ''}{!available(q) ? ' ✚' : ''}</option>)}
                </select>
                {p && <b className="num">{ovr(p)}</b>}
              </div>); })}
          </div>
          {m.autoPick && <p className="tiny muted mt">This is your assistant's current pick. Change any slot to take over selection yourself.</p>}
        </Card>
        <Card title={`Bench (${sheet.bench.length}/9)`}>
          <table><tbody>{squad.filter((p) => !sheet.xi.includes(p.id)).map((p) => <tr key={p.id} className={sheet.bench.includes(p.id) ? 'me' : ''}><td><input type="checkbox" checked={sheet.bench.includes(p.id)} disabled={!available(p)} onChange={() => toggleBench(p.id)} aria-label={`Bench ${p.name}`} /></td><td><span className="row gap6"><PlayerAvatar g={g} p={p} size={24} /><PlayerLink g={g} id={p.id} /></span></td><td>{p.pos}</td><td className="n num">{ovr(p)}</td><td>{status(p)}</td></tr>)}</tbody></table>
        </Card>
      </div>}
      {tab === 'tac' && <div className="grid g2">
        <Card title="Team instructions"><TacticSliders tac={c.tac} onChange={(t) => act((x) => { x.world.clubs[c.id].tac = { ...t, form: x.world.clubs[c.id].tac.form }; })} /></Card>
        <Card title="Presets"><div className="grid g2">{Object.entries(STYLES_TAC).filter(([k]) => !['rational', 'athletic', 'creative', 'strategic', 'dualace'].includes(k)).map(([k, s]) => <button key={k} className="opt" onClick={() => act((x) => { const tc = x.world.clubs[c.id]; tc.tac = { form: tc.tac.form, press: s.press, line: s.line, tempo: s.tempo, width: s.width, direct: s.direct }; })}><b>{s.name}</b><span className="tiny muted">press {Math.round(s.press * 100)} · line {Math.round(s.line * 100)} · tempo {Math.round(s.tempo * 100)}</span></button>)}</div>
          <p className="small muted mt">Low lines and five at the back crowd your box; high pressing wins the ball higher up but tires players. Changes apply from the next match — you can also change them during a match.</p></Card>
      </div>}
      {tab === 'players' && <Card>
        <div className="tw"><table><thead><tr><th>Player</th><th>Pos</th><th className="n">Age</th><th className="n">OVR</th><th className="n">POT</th><th className="n">Fit</th><th className="n">Apps</th><th className="n">G</th><th className="n">A</th><th className="n">Contract</th><th className="n">Wage/wk</th><th className="n">Value</th><th>Actions</th></tr></thead><tbody>
          {squad.map((p) => { let ap = 0, gl = 0, as = 0; for (const k in p.ss) { ap += p.ss[k][S.APP]; gl += p.ss[k][S.G]; as += p.ss[k][S.A]; } const listed = m.listed.includes(p.id), leaving = m.releaseAtEnd.includes(p.id); return (
            <tr key={p.id}><td><span className="row gap6"><PlayerAvatar g={g} p={p} size={26} /><PlayerLink g={g} id={p.id} />{listed && <Chip k="w">Listed</Chip>}{leaving && <Chip k="r">Leaving</Chip>}{status(p)}</span></td><td>{p.pos}</td><td className="n">{w.season - p.born}</td><td className="n"><Ovr v={ovr(p)} size="sm" /></td><td className="n">{p.pot}</td><td className="n">{Math.round(p.fit)}</td><td className="n">{ap}</td><td className="n">{gl}</td><td className="n">{as}</td>
              <td className="n">{p.con?.loanFrom ? 'Loan' : p.con ? seasonLabel(p.con.until) : '—'}</td><td className="n">{eurM(p.con?.wage ?? 0)}</td><td className="n">{eurM(marketValue(p, w.season))}</td>
              <td><span className="row gap4 wrap">
                <button className="btn sm ghost" onClick={() => act((x) => toggleListed(x, p.id))}>{listed ? 'Unlist' : 'List'}</button>
                {!p.con?.loanFrom && <button className="btn sm ghost" title={`He asks ${eurM(renewDemand(g, p))}/wk`} onClick={() => { const e = act((x) => renew(x, p.id, 2)); toast(e || `${p.name} extends by two years.`, !!e); }}>Renew</button>}
                {!p.con?.loanFrom && <button className="btn sm ghost" onClick={() => act((x) => toggleReleaseAtEnd(x, p.id))}>{leaving ? 'Keep' : 'Let go in summer'}</button>}
                <ConfirmButton label="Release" confirm={`Pay ${eurM(releaseCost(g, p))}?`} onConfirm={() => { const e = act((x) => releaseNow(x, p.id)); toast(e || `${p.name} released.`, !!e); }} />
              </span></td></tr>); })}
        </tbody></table></div>
        <p className="tiny muted mt">Contracts that run out are renewed automatically at the end of the season unless you mark the player "let go in summer". Releasing now pays half of what is left on his contract. Listed players attract offers from other clubs while the window is open.</p>
      </Card>}
    </>
  );
}

// ───────────────────────────── transfers ─────────────────────────────
function OfferModal({ g, p, onClose }: { g: Game; p: Player; onClose: () => void }) {
  const c = mgrClub(g)!;
  const free = !p.club;
  const ask = free ? 0 : askingPrice(g, p);
  const [fee, setFee] = useState(Math.round(ask / 1e5) / 10);
  const [wage, setWage] = useState(Math.round(wageDemand(g, p, c) / 100) / 10);
  const [years, setYears] = useState(3);
  const [msg, setMsg] = useState<{ t: string; ask?: number; ok?: boolean } | null>(null);
  const send = (f = fee) => { const r = act((x) => bid(x, p.id, Math.round(f * 1e6), Math.round(wage * 1000), years))!; setMsg({ t: r.text, ask: r.ask, ok: r.result === 'done' }); if (r.result === 'done') { toast(r.text); } };
  return (
    <Modal onClose={onClose}>
      <div className="row gap6"><PlayerAvatar g={g} p={p} size={56} /><div><h2>{p.name}</h2><div className="small muted">{p.pos} · {g.world.season - p.born} · {ovr(p)} OVR (pot {p.pot}) · {free ? 'Free agent' : g.world.clubs[p.club!]?.name}</div></div></div>
      <div className="grid g3 mt">
        {!free && <label className="f">Fee (€M)<input type="number" min={0} step={0.5} value={fee} onChange={(e) => setFee(+e.target.value)} /></label>}
        <label className="f">Wage (€k / week)<input type="number" min={0} step={1} value={wage} onChange={(e) => setWage(+e.target.value)} /></label>
        <label className="f">Years<select value={years} onChange={(e) => setYears(+e.target.value)}>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select></label>
      </div>
      <p className="small muted">{free ? 'No fee — he just needs the wage.' : `Asking price around ${eurM(ask)}.`} He wants about {eurM(wageDemand(g, p, c))} a week. Budget {eurM(g.mgr!.budget)} · wages {eurM(wageBill(g.world, c))}/{eurM(g.mgr!.wageBudget)}.</p>
      {msg && <p className={msg.ok ? 'good' : 'warn'}>{msg.t}</p>}
      <div className="row gap6 mt">{!msg?.ok && <button className="btn pri" onClick={() => send()}>{free ? 'Offer contract' : 'Submit bid'}</button>}{msg?.ask && !msg.ok && <button className="btn" onClick={() => { setFee(msg.ask! / 1e6); send(msg.ask! / 1e6); }}>Pay {eurM(msg.ask)}</button>}<button className="btn ghost" onClick={onClose}>{msg?.ok ? 'Done' : 'Cancel'}</button></div>
    </Modal>
  );
}
export function MgrTransfers({ g }: { g: Game }) {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const [tab, setTab] = useState('search');
  const [q, setQ] = useState(''); const [pos, setPos] = useState(''); const [lg, setLg] = useState(''); const [minO, setMinO] = useState(70); const [maxAge, setMaxAge] = useState(40); const [affordable, setAff] = useState(true);
  const [target, setTarget] = useState<Player | null>(null);
  const results = useMemo(() => {
    if (!c) return [];
    return Object.values(w.players).filter((p) => !p.retired && p.club && p.club !== c.id && !w.clubs[p.club]?.nel && w.clubs[p.club]?.league && ovr(p) >= minO && w.season - p.born <= maxAge && (!pos || p.pos === pos) && (!lg || w.clubs[p.club]?.league === lg) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
      .map((p) => ({ p, ask: askingPrice(g, p) })).filter((x) => !affordable || x.ask <= m.budget).sort((a, b) => ovr(b.p) - ovr(a.p)).slice(0, 80);
  }, [q, pos, lg, minO, maxAge, affordable, w.abs, m.budget, c?.squad.length]);
  if (!c) return <MgrBoard g={g} />;
  const frees = w.free.map((id) => w.players[id]).filter((p) => p && !p.retired && ovr(p) >= 55).sort((a, b) => ovr(b) - ovr(a)).slice(0, 60);
  const open = m.offers.filter((o) => o.status === 'open');
  return (
    <>
      <div className="pagehead"><div><h1>Transfer market</h1><div className="sub">Budget <b className="gold">{eurM(m.budget)}</b> · wages {eurM(wageBill(w, c))} of {eurM(m.wageBudget)} a week · window <b className={windowOpen(w) ? 'good' : 'bad'}>{windowOpen(w) ? 'open' : 'closed'}</b></div></div></div>
      <Tabs tabs={[['search', 'Find players'], ['free', `Free agents (${frees.length})`], ['offers', `Offers for your players${open.length ? ` (${open.length})` : ''}`], ['deals', 'Your deals']]} value={tab} onChange={setTab} />
      {tab === 'search' && <Card>
        <div className="row wrap gap6 mb">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name" aria-label="Search name" style={{ minWidth: 150 }} />
          <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position"><option value="">Any position</option>{['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'SS', 'ST'].map((x) => <option key={x}>{x}</option>)}</select>
          <select value={lg} onChange={(e) => setLg(e.target.value)} aria-label="League"><option value="">Any league</option>{LEAGUES.map((L) => <option key={L.id} value={L.id}>{L.name}</option>)}</select>
          <label className="small row gap4">Min OVR<input type="number" value={minO} min={40} max={99} onChange={(e) => setMinO(+e.target.value)} style={{ width: 64 }} /></label>
          <label className="small row gap4">Max age<input type="number" value={maxAge} min={15} max={45} onChange={(e) => setMaxAge(+e.target.value)} style={{ width: 64 }} /></label>
          <label className="small row gap4"><input type="checkbox" checked={affordable} onChange={(e) => setAff(e.target.checked)} />Affordable only</label>
        </div>
        {!windowOpen(w) && <p className="warn small">The window is closed: you can scout and plan, but bids open again in the next window. Free agents can be signed any time.</p>}
        <div className="tw"><table><thead><tr><th>Player</th><th>Pos</th><th className="n">Age</th><th className="n">OVR</th><th className="n">POT</th><th>Club</th><th className="n">Asking</th><th className="n">Wage ask</th><th></th></tr></thead><tbody>
          {results.map(({ p, ask }) => <tr key={p.id}><td><span className="row gap6"><PlayerAvatar g={g} p={p} size={24} /><PlayerLink g={g} id={p.id} /></span></td><td>{p.pos}</td><td className="n">{w.season - p.born}</td><td className="n"><Ovr v={ovr(p)} size="sm" /></td><td className="n">{p.pot}</td><td className="small">{w.clubs[p.club!]?.sn}</td><td className="n">{eurM(ask)}</td><td className="n">{eurM(wageDemand(g, p, c))}</td><td><button className="btn sm" disabled={!windowOpen(w)} onClick={() => setTarget(p)}>Bid</button></td></tr>)}
          {!results.length && <tr><td colSpan={9}><Empty>Nobody matches — try a lower OVR, another position, or untick "affordable only".</Empty></td></tr>}
        </tbody></table></div>
      </Card>}
      {tab === 'free' && <Card><div className="tw"><table><thead><tr><th>Player</th><th>Pos</th><th className="n">Age</th><th className="n">OVR</th><th className="n">POT</th><th className="n">Wage ask</th><th></th></tr></thead><tbody>
        {frees.map((p) => <tr key={p.id}><td><span className="row gap6"><PlayerAvatar g={g} p={p} size={24} /><PlayerLink g={g} id={p.id} /></span></td><td>{p.pos}</td><td className="n">{w.season - p.born}</td><td className="n"><Ovr v={ovr(p)} size="sm" /></td><td className="n">{p.pot}</td><td className="n">{eurM(wageDemand(g, p, c))}</td><td><button className="btn sm" onClick={() => setTarget(p)}>Offer contract</button></td></tr>)}
        {!frees.length && <tr><td colSpan={7}><Empty>No free agents right now.</Empty></td></tr>}</tbody></table></div></Card>}
      {tab === 'offers' && <Card>{open.length ? open.map((o) => { const p = w.players[o.pid]; return p ? <div key={o.id} className="mgr-offer"><b>{w.clubs[o.from]?.name}</b> offer <b className="gold">{eurM(o.fee)}</b> for <PlayerLink g={g} id={p.id} /> ({p.pos}, {ovr(p)} OVR, value {eurM(marketValue(p, w.season))}){o.unsolicited && <Chip k="e">Unsolicited</Chip>}<div className="row gap6 mt"><button className="btn sm pri" onClick={() => { const e = act((x) => acceptOfferFor(x, o.id)); toast(e || `${p.name} sold to ${w.clubs[o.from]?.name}.`, !!e); }}>Accept</button><button className="btn sm ghost" onClick={() => act((x) => rejectOfferFor(x, o.id))}>Reject</button></div></div> : null; }) : <Empty>No open offers. List players in Squad & tactics → Players to attract bids while the window is open.</Empty>}</Card>}
      {tab === 'deals' && <Card>{m.deals.length ? <table><thead><tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th className="n">Fee</th></tr></thead><tbody>{m.deals.slice(0, 80).map((d, i) => <tr key={i}><td className="small">{d.date}</td><td><PlayerLink g={g} id={d.pid} /></td><td className="small">{d.from}</td><td className="small">{d.to}</td><td className={`n ${d.dir === 'out' ? 'good' : d.fee < 0 ? 'bad' : ''}`}>{d.fee ? eurM(Math.abs(d.fee)) : 'Free'}</td></tr>)}</tbody></table> : <Empty>No deals yet.</Empty>}</Card>}
      {target && <OfferModal g={g} p={target} onClose={() => setTarget(null)} />}
    </>
  );
}

// ───────────────────────────── match day ─────────────────────────────
let mgrLast: { ms: MatchState } | null = null;
/** Watch a match live without controlling a player. With `side` >= 0 you can make substitutions and tactical changes for that team. */
export function WatchLive({ g, ms, side, onDone }: { g: Game; ms: MatchState; side: number; onDone: () => void }) {
  const [, force] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [tab, setTab] = useState('feed');
  const [off, setOff] = useState(-1); const [on, setOn] = useState(-1);
  const banner = useRef<{ x: string; i: number } | null>(null);
  const saveTick = useRef(0);
  const delay = speed >= 8 ? 90 : speed >= 4 ? 140 : speed >= 2 ? 260 : 480;
  useEffect(() => {
    if (ms.done) { onDone(); return; }
    if (paused) return;
    const t = setTimeout(() => {
      const before = ms.ev.length;
      advMatch(ms, undefined, speed >= 8 ? 6 : speed >= 4 ? 2 : 1);
      for (let i = before; i < ms.ev.length; i++) { const e = ms.ev[i]; if (e.x && e.i >= 1) banner.current = { x: e.x, i: e.i }; }
      if (++saveTick.current % 60 === 0) autosave();
      force((x) => x + 1);
    }, delay);
    return () => clearTimeout(t);
  });
  const T = side >= 0 ? ms.teams[side] : null;
  const events = ms.ev.filter((e) => e.x).slice(-60).reverse();
  const setTac = (tac: Tactics) => { if (!T) return; T.tac = { ...tac }; force((x) => x + 1); };
  const mentality = (k: 'attack' | 'balanced' | 'park') => { if (!T) return; const b = T.tac; setTac(k === 'attack' ? { ...b, press: 0.8, line: 0.75, tempo: 0.8, direct: 0.65 } : k === 'park' ? { ...b, press: 0.25, line: 0.15, tempo: 0.35, direct: 0.7 } : { ...b, press: 0.5, line: 0.5, tempo: 0.55, direct: 0.5 }); toast(k === 'attack' ? 'All-out attack!' : k === 'park' ? 'Park the bus.' : 'Back to balance.'); };
  const doSub = () => { if (!T || off < 0 || on < 0) return; const e = managerSub(ms, side, off, on); if (e) toast(e, true); else { toast(`${ms.pl[on].nm} on for ${ms.pl[off].nm}.`); setOff(-1); setOn(-1); } force((x) => x + 1); };
  const rate = (i: number) => { const p = ms.pl[i]; return p.used ? ratingOf(p, ms.score[p.t], ms.score[1 - p.t], 0) : 0; };
  return (
    <>
      <div className="hero mb"><Scoreboard g={g} ms={ms} live />
        <div className="row wrap gap6 mtools" style={{ marginTop: 10, justifyContent: 'center' }}>
          <button className="btn sm" onClick={() => setPaused((p) => !p)}>{paused ? '▶ Play' : '❚❚ Pause'}</button>
          <span className="seg" role="group" aria-label="Speed">{[1, 2, 4, 8].map((s) => <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}×</button>)}</span>
          <button className="btn sm ghost" onClick={() => { advMatch(ms); force((x) => x + 1); }}>Sim to end ⏭</button>
        </div>
      </div>
      <div className="matchgrid">
        <div className="col" style={{ gap: 10 }}>
          <LivePitch ms={ms} tick={delay} hover={off} banner={banner.current} />
          <div className="card mfeed"><Tabs tabs={[['feed', 'Commentary'], ['stats', 'Match stats'], ['rat', 'Ratings']]} value={tab} onChange={setTab} />
            {tab === 'feed' ? <div className="evlist" style={{ height: 260 }}>{events.map((e, i) => <div key={ms.ev.length - i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div> : tab === 'stats' ? <StatTable ms={ms} /> : <Ratings g={g} ms={ms} />}</div>
        </div>
        {T && <div className="col" style={{ gap: 10 }}>
          <Card title={`Substitutions — ${T.subs}/${ms.rules.subs} used`}>
            <div className="mgr-subs">
              <div><div className="tiny up muted">Off</div>{T.on.map((i) => <button key={i} className={`mgr-pl ${off === i ? 'on' : ''}`} onClick={() => setOff(i)}><span>{ms.pl[i].pos}</span><b>{ms.pl[i].nm}</b><Rating v={rate(i)} /><span className={`tiny ${ms.pl[i].st < 55 ? 'bad' : 'muted'}`}>{Math.round(ms.pl[i].st)}%</span></button>)}</div>
              <div><div className="tiny up muted">On</div>{T.bench.filter((i) => !ms.pl[i].used).map((i) => <button key={i} className={`mgr-pl ${on === i ? 'on' : ''}`} onClick={() => setOn(i)}><span>{ms.pl[i].pos}</span><b>{ms.pl[i].nm}</b><span className="num">{ms.pl[i].ovr}</span></button>)}{!T.bench.some((i) => !ms.pl[i].used) && <span className="small muted">Nobody left on the bench.</span>}</div>
            </div>
            <button className="btn pri mt" disabled={off < 0 || on < 0 || T.subs >= ms.rules.subs} onClick={doSub}>Make substitution</button>
            <label className="small row gap6 mt"><input type="checkbox" checked={!!ms.mgrAuto} onChange={(e) => { ms.mgrAuto = e.target.checked; act((x) => { x.mgr!.autoSubs = e.target.checked; }, false); force((x) => x + 1); }} />Let my assistant make substitutions</label>
          </Card>
          <Card title="Tactics">
            <div className="row wrap gap6 mb"><button className="btn sm" onClick={() => mentality('attack')}>⚔ All-out attack</button><button className="btn sm" onClick={() => mentality('balanced')}>⚖ Balanced</button><button className="btn sm" onClick={() => mentality('park')}>🛡 Park the bus</button></div>
            <TacticSliders tac={T.tac} onChange={setTac} />
          </Card>
        </div>}
      </div>
    </>
  );
}
function MgrPost({ g, ms }: { g: Game; ms: MatchState }) {
  const [tab, setTab] = useState('rat');
  const mm = g.mgr!.matches.find((x) => x.fid === ms.fid);
  return (
    <>
      <div className="hero mb"><Scoreboard g={g} ms={ms} live={false} /></div>
      <div className="grid g3 mb">
        <Card title="Result" className="hot">{mm ? <><b className={`num ${mm.res === 'W' ? 'good' : mm.res === 'L' ? 'bad' : ''}`} style={{ fontSize: 28 }}>{mm.res === 'W' ? 'Victory' : mm.res === 'L' ? 'Defeat' : 'Draw'}</b><p className="small muted">Board confidence {mm.conf >= 0 ? '+' : ''}{mm.conf} → {Math.round(g.mgr!.conf)}%{mm.potm ? ` · Player of the Match: ${mm.potm}` : ''}</p></> : <Empty>—</Empty>}</Card>
        <Card title="Board"><ConfBar v={g.mgr!.conf} /><p className="small muted" style={{ marginTop: 6 }}>Target: {g.mgr!.obj.text}.</p></Card>
        <Card title="Next"><button className="btn pri big" onClick={() => { mgrLast = null; nav('mhub'); continueGame(1); }}>Continue</button></Card>
      </div>
      <Card><Tabs tabs={[['rat', 'Player ratings'], ['stats', 'Team stats'], ['feed', 'Key events']]} value={tab} onChange={setTab} />
        {tab === 'rat' ? <Ratings g={g} ms={ms} /> : tab === 'stats' ? <StatTable ms={ms} /> : <div>{ms.ev.filter((e) => e.i >= 2 && e.x).map((e, i) => <div key={i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div>}</Card>
    </>
  );
}
export function MgrMatch({ g }: { g: Game }) {
  const w = g.world, m = g.mgr!;
  const ms = g.live as MatchState | null;
  if (ms) return <WatchLive g={g} ms={ms} side={mgrSide(g, ms)} onDone={() => { act((x) => finishUserMatch(x, ms)); mgrLast = { ms }; autosave(true); refresh(); }} />;
  if (mgrLast) return <MgrPost g={g} ms={mgrLast.ms} />;
  const fx = w.stage <= 1 ? userFixtureToday(g) : null;
  if (!fx) return <><div className="pagehead"><div><h1>Match day</h1><div className="sub">No match today.</div></div></div><Card><p className="muted">Your next match: {(() => { const nf = nextUserFixture(g); return nf ? `${teamName(w, nf.h)} v ${teamName(w, nf.a)}, ${fmtDate(w, nf.day, true)}` : 'none scheduled'; })()}.</p><button className="btn pri" onClick={() => continueGame()}>Continue</button></Card></>;
  const side = userSide(g, fx)!; const opp = fx.h === side ? fx.a : fx.h;
  const mine = validSheet(g); const oppSheet = pickSheet(null, w, teamInfo(w, opp));
  const sl = FORMATIONS[mine.form];
  const begin = (mode: 'full' | 'sim') => {
    mgrLast = null;
    const live = act((x) => startUserMatch(x, mode), false);
    if (!live) return;
    if (mode === 'sim') { advMatch(live); act((x) => finishUserMatch(x, live)); mgrLast = { ms: live }; }
    autosave(); refresh();
  };
  const comp = w.comps[fx.comp];
  return (
    <>
      <div className="hero mb"><div className="score">
        <div className="row" style={{ justifyContent: 'flex-end' }}><span className="tn">{teamName(w, fx.h)}</span><ClubBadge g={g} id={fx.h} lg /></div>
        <div className="center"><div className="tiny up blue">{comp?.name}{fx.stg ? ` · ${fx.stg}` : ` · Round ${fx.rd}`}</div><div className="num" style={{ fontSize: 34 }}>VS</div><div className="small muted">{fmtDate(w, fx.day, true)}</div></div>
        <div className="row"><ClubBadge g={g} id={fx.a} lg /><span className="tn">{teamName(w, fx.a)}</span></div>
      </div></div>
      <div className="grid g3 mb">
        <Card title={`Your eleven — ${mine.form}`} right={<button className="btn sm ghost" onClick={() => nav('msquad')}>Edit</button>}><div className="small">{mine.xi.map((id, k) => { const p = w.players[id]; return p ? <div key={id} className="row between" style={{ padding: '1px 0' }}><span className="row gap6"><span className="dim" style={{ width: 26 }}>{sl[k][0]}</span><PlayerAvatar g={g} p={p} size={22} />{p.sn}</span><span className="num">{ovr(p)}</span></div> : null; })}</div><p className="tiny muted mt">{m.autoPick ? 'Picked by your assistant.' : 'Your selection (anyone unavailable has been replaced).'}</p></Card>
        <Card title={`${teamName(w, opp)} — ${oppSheet.form}`}><div className="small">{oppSheet.xi.map((x) => { const p = w.players[x.pid]; return <div key={x.pid} className="row between" style={{ padding: '1px 0' }}><span className="row gap6"><span className="dim" style={{ width: 26 }}>{x.pos}</span><PlayerAvatar g={g} p={p} size={22} /><PlayerLink g={g} id={p.id} /></span><span className="num">{ovr(p)}</span></div>; })}</div></Card>
        <Card title="Kick-off" className="hot"><div className="col" style={{ gap: 8 }}>
          <button className="opt hot" onClick={() => begin('full')}><b>Watch live</b><span className="small muted">Follow the match on the pitch view. Make substitutions and change tactics as it unfolds.</span></button>
          <button className="opt" onClick={() => begin('sim')}><b>Quick result</b><span className="small muted">Your assistant runs the touchline. Straight to the full-time report.</span></button>
          <span className="tiny muted">Squad strength: you {squadLevel(w, w.clubs[side]).toFixed(1)} · them {w.clubs[opp] ? squadLevel(w, w.clubs[opp]).toFixed(1) : '—'}</span>
        </div></Card>
      </div>
    </>
  );
}

// ───────────────────────────── board & career ─────────────────────────────
export function MgrBoard({ g }: { g: Game }) {
  const m = g.mgr!, w = g.world, c = mgrClub(g);
  const jobs = m.jobs.map((id) => w.clubs[id]).filter(Boolean);
  const take = (id: string) => { const e = act((x) => takeJob(x, id)); if (e) toast(e, true); else { toast(`You are the new manager of ${w.clubs[id].name}.`); nav('mhub'); } };
  const spark = m.confLog.slice(-60);
  return (
    <>
      <div className="pagehead"><div><h1>Board & career</h1><div className="sub">{m.name} · reputation {Math.round(m.rep)} · {c ? `manager of ${c.name}` : 'out of work'}</div></div></div>
      {!c && <Card title="Choose your next job" className="hot mb"><p className="small muted">You need a club before the season can continue. These clubs want to talk to you:</p>
        <div className="grid gauto">{jobs.map((j) => <button key={j.id} className="opt" onClick={() => take(j.id)}><span className="row gap6"><ClubBadge g={g} id={j.id} lg /><b style={{ fontSize: 17 }}>{j.name}</b></span><span className="small muted">{w.comps[j.league ?? '']?.name} · reputation {j.rep} · board expects about {ordinal(expectedFinish(w, j))}</span></button>)}</div></Card>}
      {c && jobs.length > 0 && <Card title="Other clubs want you" className="mb"><p className="small muted">You can stay — or move. Moving ends your time at {c.name}.</p><div className="grid gauto">{jobs.map((j) => <div key={j.id} className="opt"><span className="row gap6"><ClubBadge g={g} id={j.id} lg /><b>{j.name}</b></span><span className="small muted">{w.comps[j.league ?? '']?.name} · reputation {j.rep}</span><ConfirmButton className="btn sm pri" label="Take this job" confirm={`Leave ${c.sn}?`} onConfirm={() => take(j.id)} /></div>)}</div></Card>}
      {c && <div className="grid g2 mb">
        <Card title="The board"><ConfBar v={m.conf} /><p className="small muted mt">Target this season: <b>{m.obj.text}</b> (around {ordinal(m.obj.pos)}). Confidence moves with every result against what your squad should achieve, and with the season's final position. Below about 10% — or far off the target late on — you will be sacked.</p>
          {spark.length > 1 && <svg viewBox={`0 0 ${spark.length} 100`} preserveAspectRatio="none" className="mgr-spark" aria-label="Board confidence history"><polyline fill="none" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" points={spark.map((p, i) => `${i},${100 - p.v}`).join(' ')} /></svg>}
          <div className="mt"><ConfirmButton label="Resign" confirm="Really resign?" onConfirm={() => { act((x) => resign(x)); toast('You have resigned.'); }} /></div></Card>
        <Card title="Finances"><div className="grid g2"><Kpi label="Transfer budget" value={eurM(m.budget)} /><Kpi label="Wage bill / week" value={eurM(wageBill(w, c))} sub={`budget ${eurM(m.wageBudget)}`} /></div><p className="small muted mt">Home gates and prize money add to the budget; next season half of what is left carries over on top of the club's allocation.</p></Card>
      </div>}
      <div className="grid g2">
        <Card title="Seasons">{m.hist.length ? <table><thead><tr><th>Season</th><th>Club</th><th className="n">Pos</th><th className="n">Target</th><th className="n">W-D-L</th><th>Trophies</th></tr></thead><tbody>{[...m.hist].reverse().map((h) => <tr key={h.s + h.club}><td>{seasonLabel(h.s)}</td><td>{h.clubName}</td><td className={`n ${h.pos <= h.obj ? 'good' : 'bad'}`}>{ordinal(h.pos)}</td><td className="n">{ordinal(h.obj)}</td><td className="n">{h.w}-{h.d}-{h.l}</td><td className="small">{h.trophies.join(', ') || '—'}</td></tr>)}</tbody></table> : <Empty>Your first season is under way.</Empty>}</Card>
        <Card title={`Trophies (${m.trophies.length})`}>{m.trophies.length ? m.trophies.map((t, i) => <div key={i} className="row gap6 small"><span>🏆</span><b>{t.name}</b><span className="muted">{t.club} · {seasonLabel(t.s)}</span></div>) : <Empty>None yet.</Empty>}</Card>
      </div>
    </>
  );
}
