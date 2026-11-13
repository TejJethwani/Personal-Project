import type { Game, Player } from '../engine/types';
import { ovr, fitAt } from '../engine/attributes';
import { STYLES_TAC, FORMATIONS } from '../engine/data/clubs';
import { pickSheet, teamInfo } from '../engine/match/setup';
import { ROLE_NAME, levelOf } from '../engine/transfers';
import { tacticalFit, fmtEur, fmtWage, ordinal } from '../engine/util';
import { marketValue, clubStrength } from '../engine/worldgen';
import { positionOf, seasonLabel } from '../engine/competitions';
import { S } from '../engine/match/model';
import { mainWeapon } from '../engine/abilities';
import { act, nav } from '../store/game';
import { Card, Chip, ClubBadge, DataTable, Empty, Kpi, Ovr, PlayerLink, Pos, Rating, natName, type Col } from '../ui/kit';

function squadCols(g: Game, league: string): Col<Player>[] {
  const w = g.world;
  const L = (p: Player) => p.ss[league];
  return [
    { h: '#', get: (p) => <span className="dim">{p.num || ''}</span>, sort: (p) => p.num },
    { h: 'Player', get: (p) => <span className="row gap6"><PlayerLink g={g} id={p.id} full />{p.inj > 0 && <Chip k="r">inj {p.inj}d</Chip>}{p.susp > 0 && <Chip k="r">susp</Chip>}{p.con?.loanFrom && <Chip k="w">loan</Chip>}{g.career.rivals.includes(p.id) && <Chip k="e">rival</Chip>}</span>, sort: (p) => p.sn },
    { h: 'Pos', get: (p) => <Pos p={p.pos} />, sort: (p) => p.pos },
    { h: 'Age', n: true, get: (p) => w.season - p.born, sort: (p) => w.season - p.born },
    { h: 'Nat', get: (p) => <span className="small muted">{p.nat}</span>, sort: (p) => p.nat, title: 'Nationality' },
    { h: 'OVR', n: true, get: (p) => <Ovr v={ovr(p)} size="sm" />, sort: (p) => ovr(p) },
    { h: 'Pot', n: true, get: (p) => p.pot, sort: (p) => p.pot },
    { h: 'Role', get: (p) => <span className="small">{p.con ? ROLE_NAME[p.con.role] : '—'}</span>, sort: (p) => p.con?.role ?? '' },
    { h: 'Cond', n: true, get: (p) => <span className={p.fit < 60 ? 'bad' : p.fit < 80 ? 'warn' : ''}>{Math.round(p.fit)}</span>, sort: (p) => p.fit, title: 'Condition' },
    { h: 'Form', n: true, get: (p) => <Rating v={p.form} />, sort: (p) => p.form },
    { h: 'Apps', n: true, get: (p) => L(p)?.[S.APP] ?? 0, sort: (p) => L(p)?.[S.APP] ?? 0 },
    { h: 'G', n: true, get: (p) => L(p)?.[S.G] ?? 0, sort: (p) => L(p)?.[S.G] ?? 0 },
    { h: 'A', n: true, get: (p) => L(p)?.[S.A] ?? 0, sort: (p) => L(p)?.[S.A] ?? 0 },
    { h: 'Rat', n: true, get: (p) => <Rating v={L(p)?.[S.RATN] ? L(p)[S.RAT] / L(p)[S.RATN] : 0} />, sort: (p) => (L(p)?.[S.RATN] ? L(p)[S.RAT] / L(p)[S.RATN] : 0) },
    { h: 'Weapon', get: (p) => <span className="small muted">{mainWeapon(p)?.name ?? ''}</span> },
    { h: 'Chem', n: true, get: (p) => (g.career.rel[p.id] && p.id !== g.career.pid ? Math.round(g.career.rel[p.id].chem) : ''), sort: (p) => g.career.rel[p.id]?.chem ?? -1, title: 'Tactical chemistry with you' },
  ];
}

export function ClubScreen({ g, id }: { g: Game; id: string }) {
  const w = g.world;
  const c = w.clubs[id];
  if (!c) return <Empty>Club not found.</Empty>;
  const me = w.players[g.career.pid];
  const mine = me.club === id;
  const league = c.nel ? 'nel' : c.league ?? '';
  const st = STYLES_TAC[c.style];
  const squad = c.squad.map((x) => w.players[x]).filter(Boolean);
  const sheet = squad.length >= 11 ? pickSheet(mine ? g : null, w, teamInfo(w, id)) : null;
  const pos = league && w.comps[league] ? positionOf(w, league, id) : 0;
  const master = c.master ? w.players[c.master] : null;
  const rivals = mine ? squad.filter((p) => p.id !== me.id && p.pos !== 'GK' && (p.pos === me.pos || p.pos2.includes(me.pos) || me.pos2.includes(p.pos))).sort((a, b) => fitAt(b, me.pos) - fitAt(a, me.pos)) : [];
  const form = FORMATIONS[c.tac.form] ?? FORMATIONS['4-3-3'];
  return (
    <>
      <div className="hero mb"><div className="row wrap">
        <ClubBadge g={g} id={id} lg />
        <div className="grow"><div className="tiny up blue">{c.nel ? 'Neo Egoist League' : c.dormant ? 'Outside the simulated pyramid' : w.comps[league]?.name}{pos ? ` · ${ordinal(pos)}` : ''}</div><h1>{c.name}</h1>
          <div className="row wrap gap6" style={{ marginTop: 6 }}><Chip>{natName(c.nat)}</Chip><Chip k="b">{st?.name ?? c.style} · {c.tac.form}</Chip><Chip>{c.nel ? 'Coach' : 'Manager'}: {c.mgr.name}</Chip>{master && <Chip k="e">Master striker: {master.name}</Chip>}{!c.nel && !c.dormant && <Chip>Expected finish: {ordinal(c.expect)}</Chip>}{mine && <Chip k="g">Your club</Chip>}</div></div>
        <div className="grid g4" style={{ gap: 18 }}><Kpi label="Reputation" value={Math.round(c.rep)} /><Kpi label="Squad rating" value={Math.round(clubStrength(w, c))} /><Kpi label="Facilities" value={`${c.fac}/10`} /><Kpi label="Budget" value={c.nel ? '—' : fmtEur(Math.max(0, c.budget))} /></div>
      </div></div>
      <div className="grid g3 mb">
        <Card title="Tactical identity">
          <p className="small">{c.identity ?? st?.desc}</p>
          {(['press', 'line', 'tempo', 'width', 'direct'] as const).map((k) => <div key={k} className="row small" style={{ margin: '3px 0' }}><span style={{ width: 110 }}>{{ press: 'Pressing', line: 'Defensive line', tempo: 'Tempo', width: 'Width', direct: 'Directness' }[k]}</span><div className="grow bar"><i style={{ width: `${c.tac[k] * 100}%` }} /></div></div>)}
          {mine && <p className="small mt">Your tactical fit: <b className={tacticalFit(me, c.style) >= 0 ? 'good' : 'warn'}>{tacticalFit(me, c.style) >= 1 ? 'Excellent' : tacticalFit(me, c.style) >= 0 ? 'Good' : tacticalFit(me, c.style) >= -1 ? 'Workable' : 'Awkward'}</b> ({tacticalFit(me, c.style).toFixed(1)} selection points)</p>}
        </Card>
        <Card title={`Likely eleven — ${sheet?.form ?? c.tac.form}`}>
          {sheet ? <svg viewBox="0 0 100 70" style={{ width: '100%', background: '#0b3a1c', border: '1px solid #14502a' }} role="img" aria-label="Formation">
            <rect x="1" y="1" width="98" height="68" fill="none" stroke="#cfe9d6" strokeOpacity=".4" strokeWidth=".4" /><line x1="50" y1="1" x2="50" y2="69" stroke="#cfe9d6" strokeOpacity=".3" strokeWidth=".4" />
            {sheet.xi.map((x, i) => { const p = w.players[x.pid]; const f = form[i] ?? [x.pos, x.x, x.y]; return <g key={x.pid} transform={`translate(${(f[1] as number) * 1.05 + 2}, ${(f[2] as number) * 0.66 + 2})`}><circle r="3.4" fill={p.id === me.id ? '#3df2ff' : c.col[0]} stroke={c.col[1]} strokeWidth=".5" /><text y="1.1" textAnchor="middle" fontSize="3" fontWeight="700" fill={p.id === me.id ? '#000' : c.col[1]}>{ovr(p)}</text><text y="6.6" textAnchor="middle" fontSize="2.7" fill="#fff">{p.sn.slice(0, 11)}</text></g>; })}
          </svg> : <Empty>No squad registered.</Empty>}
        </Card>
        {mine ? <Card title={`Competition at ${me.pos}`}>
          <div className="small"><div className="row between me" style={{ padding: '3px 0' }}><b className="blue">You</b><span className="num">{Math.round(fitAt(me, me.pos))}</span></div>{rivals.slice(0, 6).map((p) => <div key={p.id} className="row between" style={{ padding: '3px 0', borderTop: '1px solid var(--line)' }}><span><PlayerLink g={g} id={p.id} full /> <span className="dim">{p.pos} · {w.season - p.born}</span></span><span className="num">{Math.round(fitAt(p, me.pos))}</span></div>)}</div>
          <p className="small mt">Squad role: <b>{me.con ? ROLE_NAME[me.con.role] : 'NEL squad member'}</b> · coach trust {Math.round(g.career.mgrTrust)}{me.con ? <> · {fmtWage(me.con.wage)}</> : null}</p>
          <p className="tiny muted">Selection = ability in the role × condition + form + role status + coach trust. Train tactically, stay disciplined and perform to move up.</p>
          <h4 className="mt">Your default match instructions</h4>
          <div className="grid g2" style={{ gap: 8, marginTop: 6 }}>{([['stance', 'Positioning', ['Deep', 'Balanced', 'Advanced']], ['press', 'Pressing', ['Conserve', 'Normal', 'Aggressive']]] as const).map(([k, label, opts]) => <label key={k} className="f">{label}<select value={g.career.instr[k]} onChange={(e) => act((x) => { x.career.instr[k] = +e.target.value; })}>{opts.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>)}</div>
        </Card> : <Card title="Club record">
          {c.trophies.length ? <div className="small col gap4">{c.trophies.slice(-8).reverse().map((t, i) => <div key={i}>🏆 {t.name} <span className="muted">{seasonLabel(t.s)}</span></div>)}</div> : <p className="muted small">No trophies in this save yet.</p>}
          <h4 className="mt">Recent seasons</h4><div className="small">{c.hist.slice(-5).reverse().map((h) => <div key={h.s}>{seasonLabel(h.s)}: {ordinal(h.pos)} in {h.compName} ({h.pts} pts){h.note ? ` — ${h.note}` : ''}</div>)}{!c.hist.length && <span className="muted">—</span>}</div>
          {Object.entries(c.rec).map(([k, r]) => <p key={k} className="small mt">Record {k} in a season: <b>{r.v}</b> — {r.name} ({seasonLabel(r.s)})</p>)}
          <p className="small muted mt">Squad value {fmtEur(squad.reduce((s, p) => s + marketValue(p, w.season), 0))} · level {Math.round(levelOf(c))}</p>
        </Card>}
      </div>
      <Card title={`Squad (${squad.length})`}><DataTable rows={squad} cols={squadCols(g, league)} rowKey={(p) => p.id} isMe={(p) => p.id === me.id} initial={5} /></Card>
      {mine && c.hist.length > 0 && <Card title="Club history" className="mt"><div className="small">{c.hist.slice(-8).reverse().map((h) => <div key={h.s}>{seasonLabel(h.s)}: {ordinal(h.pos)} in {h.compName} — {h.w}W {h.d}D {h.l}L, {h.pts} pts{h.note ? ` · ${h.note}` : ''}</div>)}</div>{Object.entries(c.goalsAll).sort((a, b) => b[1] - a[1]).slice(0, 5).length > 0 && <><h4 className="mt">All-time scorers (this save)</h4><div className="small">{Object.entries(c.goalsAll).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pid, n]) => <div key={pid}><PlayerLink g={g} id={pid} full /> — {n}</div>)}</div></>}</Card>}
    </>
  );
}
export function Squad({ g }: { g: Game }) {
  const me = g.world.players[g.career.pid];
  if (!me.club) return <><div className="pagehead"><h1>Squad & Tactics</h1></div><Empty>You are not attached to a club. Check Transfers for offers.</Empty><button className="btn" onClick={() => nav('transfers')}>Transfers</button></>;
  return <ClubScreen g={g} id={me.club} />;
}
