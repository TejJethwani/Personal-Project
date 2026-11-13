import { useState } from 'react';
import type { Game, Player } from '../engine/types';
import { ATTRS, ATTR_GROUPS, N_OUT, N_ATTR, ovr, strengths, weaknesses, bestRoles, POS_NAME, POS_WEIGHTS, STYLES } from '../engine/attributes';
import { playerAbilityDefs, levelLabel, EGO_TYPES, PHILOSOPHIES, PERSONALITIES, BACKSTORIES } from '../engine/abilities';
import { marketValue } from '../engine/worldgen';
import { fmtEur, fmtWage, fmtYenShort } from '../engine/util';
import { ROLE_NAME } from '../engine/transfers';
import { relOf, relLabel } from '../engine/relationships';
import { S } from '../engine/match/model';
import { seasonLabel } from '../engine/competitions';
import { nav } from '../store/game';
import { Bar, Card, Chip, ClubLink, Kpi, Ovr, PlayerAvatar, Tabs, natName, Rating, tier, Empty } from '../ui/kit';

function ambition(p: Player): string {
  const a = p.pers;
  if (a.amb >= 80) return 'Wants to win the biggest trophies and will move to do it.';
  if (a.loyal >= 75) return 'A one-club mentality: values belonging over prestige.';
  if (a.ego >= 80) return 'Wants to be the undisputed star wherever he plays.';
  if (a.prof >= 80) return 'Chasing consistency and a long career at the top level.';
  return 'Wants regular football and steady progress.';
}
function persLine(p: Player): string {
  const a = p.pers;
  const t: string[] = [];
  t.push(a.ego >= 80 ? 'towering ego' : a.ego >= 60 ? 'confident' : 'humble');
  t.push(a.temper >= 70 ? 'fiery' : a.temper <= 30 ? 'calm' : 'even-tempered');
  if (a.prof >= 78) t.push('model professional'); else if (a.prof <= 40) t.push('casual trainer');
  if (a.social >= 75) t.push('sociable'); else if (a.social <= 30) t.push('private');
  return t.join(' · ');
}
export function OvrChart({ g }: { g: Game }) {
  const log = g.career.ovrLog;
  if (log.length < 2) return <Empty>Your OVR history will be charted here as you develop.</Empty>;
  const pts = log.map((l, i) => ({ x: i, y: l.ovr, s: l.s }));
  const min = Math.min(...pts.map((p) => p.y)) - 2, max = Math.max(...pts.map((p) => p.y)) + 2;
  const W = 600, H = 150;
  const X = (i: number) => 30 + (i / (pts.length - 1)) * (W - 40), Y = (v: number) => H - 20 - ((v - min) / (max - min)) * (H - 34);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label={`OVR history from ${pts[0].y} to ${pts[pts.length - 1].y}`}>
    {[min + 1, Math.round((min + max) / 2), max - 1].map((v) => <g key={v}><line x1="30" x2={W - 8} y1={Y(v)} y2={Y(v)} stroke="#1c2742" /><text x="4" y={Y(v) + 4} fill="#5b6a8e" fontSize="11">{Math.round(v)}</text></g>)}
    <polyline fill="none" stroke="#1ea7ff" strokeWidth="2.5" points={pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} />
    <circle cx={X(pts.length - 1)} cy={Y(pts[pts.length - 1].y)} r="4" fill="#3df2ff" />
    <text x={W - 8} y={14} fill="#8b9bc0" fontSize="11" textAnchor="end">{seasonLabel(pts[0].s)} → {seasonLabel(pts[pts.length - 1].s)}</text>
  </svg>;
}

export function PlayerScreen({ g, id }: { g: Game; id: string }) {
  const w = g.world;
  const p = w.players[id];
  const [tab, setTab] = useState('over');
  if (!p) return <Empty>This player is no longer in the database (retired long ago).</Empty>;
  const mine = id === g.career.pid;
  const o = ovr(p);
  const club = p.club ? w.clubs[p.club] : null;
  const isGk = p.pos === 'GK';
  const rel = !mine && g.career.rel[id] ? relOf(g, id) : null;
  const bid = w.nel.bids[id];
  const tabs: [string, string][] = [['over', 'Overview'], ['stats', 'Season stats'], ['hist', 'Career'], ...(mine ? [['dev', 'Development'] as [string, string]] : []), ...(rel ? [['rel', 'Relationship'] as [string, string]] : [])];
  return (
    <>
      <div className="hero mb"><div className="row wrap">
        <PlayerAvatar g={g} p={p} size={104} />
        <div className="grow">
          <div className="tiny up blue">{POS_NAME[p.pos]}{p.pos2.length ? ` · also ${p.pos2.join(', ')}` : ''}</div>
          <h1>{p.name}{p.nick ? <span className="muted" style={{ fontSize: 22 }}> "{p.nick}"</span> : null}</h1>
          <div className="row wrap gap6" style={{ marginTop: 6 }}>
            {club ? <ClubLink g={g} id={club.id} /> : <Chip>{p.retired ? `Retired ${p.retired + 1}` : 'Unattached'}</Chip>}
            <Chip>{natName(p.nat)}</Chip><Chip>Age {w.season - p.born}</Chip><Chip>{p.h} cm · {p.w} kg</Chip><Chip>{p.foot === 'L' ? 'Left' : p.foot === 'R' ? 'Right' : 'Both'}-footed</Chip>{p.num > 0 && <Chip>#{p.num}</Chip>}
            {p.con && <Chip k="y">{ROLE_NAME[p.con.role]}</Chip>}{p.inj > 0 && <Chip k="r">{p.injName ?? 'Injured'} ({p.inj}d)</Chip>}
            {p.origin === 'bluelock' && <Chip k="b">Blue Lock</Chip>}{p.origin === 'master' && <Chip k="e">Master Striker</Chip>}{p.origin === 'regen' && <Chip>Academy graduate</Chip>}{p.origin === 'pool' && <Chip>Plays outside simulated leagues</Chip>}
            {p.canon && <Chip k={p.canon === 'canon' ? 'b' : 'w'} title="How confident the roster data file is about this character's placement. 'original' = fictional player created for this game.">{p.canon}</Chip>}
            {g.career.rivals.includes(id) && <Chip k="e">Your rival</Chip>}{rel && <Chip k="g">{relLabel(rel)}</Chip>}
          </div>
        </div>
        <div className="row"><div className="center"><Ovr v={o} size="lg" /><div className="tiny up muted">Overall</div></div><div className="center"><span className={`ovr lg ${tier(p.pot)}`} style={{ opacity: 0.75 }}>{p.pot}</span><div className="tiny up muted">Potential</div></div></div>
      </div></div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'over' && <div className="grid g3">
        <div className="col" style={{ gridColumn: 'span 2' }}>
          <Card title="Attributes"><p className="tiny muted">OVR {o} is calculated from these values with {p.pos} weights. Highlighted attributes carry weight for this position. Hover for what each one does.</p>
            <div className="grid g3 mt">{(isGk ? [...ATTR_GROUPS, 'Goalkeeping'] : ATTR_GROUPS).map((gn) => <div key={gn}><h4>{gn}</h4><div className="attr mt" style={{ marginTop: 6 }}>{ATTRS.map((a, i) => (a.group !== gn || (!isGk && i >= N_OUT) || i >= N_ATTR ? null : [
              <span key={a.key} title={a.desc} className={POS_WEIGHTS[p.pos][i] > 0.03 ? 'blue' : ''}>{a.name}<Bar v={p.a[i]} max={99} kind={p.a[i] >= 85 ? 'f' : p.a[i] >= 70 ? 'g' : p.a[i] >= 55 ? 'w' : 'r'} /></span>, <b key={a.key + 'v'} className={tier(p.a[i])}>{p.a[i]}</b>]))}</div></div>)}</div></Card>
          <Card title="Abilities">{p.ab.length ? <div className="grid g2">{playerAbilityDefs(p).map(({ ref, def }) => <div key={ref.id} className="card" style={{ padding: 10 }}><div className="row between"><b className="num" style={{ fontSize: 17 }}>{def.name}</b><Chip k={def.kind === 'ultimate' ? 'e' : def.kind === 'weapon' ? 'b' : ''}>{def.kind} · Lv {ref.lv} {levelLabel(ref.lv)}</Chip></div><div className="small muted">{def.desc}</div></div>)}</div> : <Empty>No signature abilities yet.</Empty>}
            {mine && <button className="btn sm mt" onClick={() => nav('weapons')}>Manage weapons & progression</button>}</Card>
        </div>
        <div className="col">
          <Card title="Profile">
            <div className="grid g2"><Kpi label="Market value" value={fmtEur(marketValue(p, w.season))} sub="transfer value, EUR" /><Kpi label="Wage" value={p.con ? fmtWage(p.con.wage) : '—'} sub={p.con ? `until ${p.con.until + 1}` : 'no contract'} /></div>
            {bid?.top ? <p className="small mt">NEL bid: <b className="gold">{fmtYenShort(bid.top)}</b> <span className="muted">(annual salary, yen) from {w.clubs[bid.topClub]?.name}</span></p> : null}
            <p className="small mt"><b>Reputation</b> {Math.round(p.rep)}/100</p><Bar v={p.rep} kind="e" />
            <p className="small mt"><b>Recent form</b> <Rating v={p.form} /> · condition {Math.round(p.fit)}% · morale {Math.round(p.morale)}</p>
            <p className="small"><b>Style</b> {STYLES[p.style]?.name ?? p.style}</p>
            <p className="small"><b>Personality</b> {mine ? `${PERSONALITIES.find((x) => x.id === g.career.personality)?.name} · ${EGO_TYPES.find((x) => x.id === g.career.egoType)?.name} · ${PHILOSOPHIES.find((x) => x.id === g.career.philosophy)?.name}` : persLine(p)}</p>
            <p className="small"><b>Ambition</b> {mine ? BACKSTORIES.find((x) => x.id === g.career.backstory)?.desc : ambition(p)}</p>
            {p.caps > 0 && <p className="small"><b>International</b> {p.caps} caps, {p.ig} goals for {natName(p.nat)}</p>}
          </Card>
          <Card title="Strengths"><div className="row wrap gap6">{strengths(p).map((i) => <Chip key={i} k="g">{ATTRS[i].name} {p.a[i]}</Chip>)}</div><h4 className="mt">Weaknesses</h4><div className="row wrap gap6 mt">{weaknesses(p).map((i) => <Chip key={i} k="r">{ATTRS[i].name} {p.a[i]}</Chip>)}</div><h4 className="mt">Preferred roles</h4><div className="row wrap gap6 mt">{bestRoles(p.a, isGk).slice(0, 4).map((r) => <Chip key={r.pos} k={r.pos === p.pos ? 'b' : ''}>{r.pos} {r.ovr}</Chip>)}</div></Card>
          {p.awards.length > 0 && <Card title={`Awards (${p.awards.length})`}><div className="col gap4 small">{p.awards.slice(-8).reverse().map((a) => w.awards[a] ? <div key={a}>🏆 {w.awards[a].title} <span className="muted">— {w.awards[a].compName} {w.awards[a].period}</span></div> : null)}</div></Card>}
        </div>
      </div>}
      {tab === 'stats' && <Card title={`Current season`}>{Object.keys(p.ss).length ? <div className="tw"><table><thead><tr><th>Competition</th><th className="n">Apps</th><th className="n">Starts</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">xG</th><th className="n">Shots</th><th className="n">KP</th><th className="n">Pass%</th><th className="n">Tkl+Int</th><th className="n">POTM</th><th className="n">Rating</th></tr></thead><tbody>
        {Object.entries(p.ss).map(([cid, l]) => <tr key={cid}><td>{w.comps[cid]?.name ?? cid}</td><td className="n">{l[S.APP]}</td><td className="n">{l[S.START]}</td><td className="n">{Math.round((w.comps[cid]?.rules === 'nel' ? l[S.PLAY] : l[S.SEC]) / 60)}</td><td className="n num">{l[S.G]}</td><td className="n num">{l[S.A]}</td><td className="n">{l[S.XG].toFixed(1)}</td><td className="n">{l[S.SH]}</td><td className="n">{l[S.KP]}</td><td className="n">{l[S.PA] ? Math.round((l[S.PC] / l[S.PA]) * 100) : 0}</td><td className="n">{l[S.TKW] + l[S.INT]}</td><td className="n">{l[S.POTM]}</td><td className="n"><Rating v={l[S.RATN] ? l[S.RAT] / l[S.RATN] : 0} /></td></tr>)}
      </tbody></table></div> : <Empty>No appearances this season yet.</Empty>}{mine && <button className="btn sm mt" onClick={() => nav('stats')}>Full statistics centre</button>}</Card>}
      {tab === 'hist' && <Card title="Career history">{p.hist.length ? <div className="tw"><table><thead><tr><th>Season</th><th>Club</th><th>Competition</th><th className="n">Apps</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">POTM</th><th className="n">Rating</th><th className="n">OVR</th></tr></thead><tbody>
        {[...p.hist].reverse().map((h, i) => <tr key={i}><td>{seasonLabel(h.s)}</td><td>{h.clubName}</td><td>{h.compName}</td><td className="n">{h.ap}</td><td className="n">{h.min}</td><td className="n num">{h.g}</td><td className="n num">{h.a}</td><td className="n">{h.mom}</td><td className="n"><Rating v={h.rt / 100} /></td><td className="n">{h.ovr}</td></tr>)}
      </tbody></table></div> : <Empty>No completed seasons in this save yet.</Empty>}
        <h4 className="mt">Transfers</h4><div className="col gap4 small mt">{w.transfers.filter((t) => t.pid === id).map((t) => <div key={t.id}>{seasonLabel(t.s)} · {t.fromName} → <b>{t.toName}</b> <span className="muted">({t.type}{t.fee ? `, ${fmtEur(t.fee)}` : ''})</span></div>)}{!w.transfers.some((t) => t.pid === id) && <span className="muted">No moves recorded.</span>}</div></Card>}
      {tab === 'dev' && mine && <div className="grid g2"><Card title="OVR over time"><OvrChart g={g} /></Card>
        <Card title="Why your attributes changed"><div style={{ maxHeight: 380, overflowY: 'auto' }}>{g.career.devLog.length ? [...g.career.devLog].reverse().slice(0, 80).map((d, i) => <div key={i} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><b className={d.delta > 0 ? 'good' : 'bad'}>{ATTRS[d.attr].name} {d.delta > 0 ? '+1' : '−1'} → {d.to}</b> <span className="dim">· {d.date} {seasonLabel(d.s)}</span><div className="muted">{d.why.join(' · ')}</div></div>) : <Empty>Train and play: every attribute point you gain is listed here with its causes.</Empty>}</div></Card></div>}
      {tab === 'rel' && rel && <div className="grid g2"><Card title={`You and ${p.sn}`}>
        {([['Respect', rel.resp, ''], ['Trust', rel.trust, 'g'], ['Friendship', rel.friend, 'w'], ['Rivalry', rel.rival, 'e'], ['Tactical chemistry', rel.chem, 'f']] as const).map(([n, v, k]) => <div key={n} style={{ marginBottom: 8 }}><div className="row between small"><span>{n}</span><b>{Math.round(v)}</b></div><Bar v={v} kind={k} /></div>)}
        <p className="small muted">Played together {rel.shared}× · against {rel.vs}×</p><button className="btn sm" onClick={() => nav('relationships', 'people')}>Interact</button></Card>
        <Card title="Shared memories">{rel.mem.length ? [...rel.mem].reverse().map((m, i) => <div key={i} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><span className={m.w > 0 ? 'good' : m.w < 0 ? 'bad' : 'muted'}>●</span> {m.txt} <span className="dim">({seasonLabel(m.s)})</span></div>) : <Empty>Nothing significant yet.</Empty>}</Card></div>}
    </>
  );
}
