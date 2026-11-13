import { useMemo, useState } from 'react';
import type { Game } from '../engine/types';
import { S, newLine, addLine } from '../engine/match/model';
import { seasonLabel } from '../engine/competitions';
import { ovr } from '../engine/attributes';
import { teamName } from '../engine/match/setup';
import { Card, DataTable, Empty, PlayerLink, Rating, Tabs, Chip, Ovr, type Col } from '../ui/kit';

const DEFS: [string, string, (l: number[]) => number, boolean?][] = [
  ['Appearances', 'apps', (l) => l[S.APP]], ['Starts', 'st', (l) => l[S.START]], ['Minutes', 'min', (l) => Math.round(l[S.SEC] / 60)], ['Goals', 'g', (l) => l[S.G], true], ['Assists', 'a', (l) => l[S.A], true], ['Goal contributions', 'ga', (l) => l[S.G] + l[S.A], true],
  ['Non-penalty goals', 'npg', (l) => l[S.G] - l[S.PENG], true], ['Penalty goals', 'pg', (l) => l[S.PENG]], ['Shots', 'sh', (l) => l[S.SH], true], ['Shots on target', 'sot', (l) => l[S.SOT], true], ['Expected goals (xG)', 'xg', (l) => l[S.XG], true], ['Expected assists (xA)', 'xa', (l) => l[S.XA], true],
  ['Chances created', 'cc', (l) => l[S.KP] + l[S.A], true], ['Key passes', 'kp', (l) => l[S.KP], true], ['Passes attempted', 'pa', (l) => l[S.PA], true], ['Passes completed', 'pc', (l) => l[S.PC], true], ['Dribbles attempted', 'da', (l) => l[S.DA], true], ['Dribbles completed', 'dc', (l) => l[S.DC], true],
  ['Tackles won', 'tk', (l) => l[S.TKW], true], ['Interceptions', 'int', (l) => l[S.INT], true], ['Blocks', 'blk', (l) => l[S.BLK], true], ['Aerials won', 'aw', (l) => l[S.AW], true], ['Fouls committed', 'fc', (l) => l[S.FC], true], ['Yellow cards', 'yc', (l) => l[S.YC]], ['Red cards', 'rc', (l) => l[S.RC]],
  ['Clean sheets', 'cs', (l) => l[S.CS]], ['Saves', 'sv', (l) => l[S.SV], true], ['Player of the Match', 'potm', (l) => l[S.POTM]],
];
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const secs = (l: number[], nel: boolean) => (nel ? l[S.PLAY] : l[S.SEC]);

export function Stats({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const [tab, setTab] = useState('me');
  const [scope, setScope] = useState('reg');
  const [per90, setPer90] = useState(false);
  const [comp, setComp] = useState(w.phase === 'nel' ? 'nel' : w.clubs[me.club ?? '']?.league ?? 'eng1');
  const [stat, setStat] = useState('g');
  const [minMin, setMinMin] = useState(300);
  const [h2h, setH2h] = useState('');
  // every total below is summed from the same per-match stat lines
  const rows = useMemo(() => {
    const out: { key: string; s: number; label: string; club: string; comp: string; rules: string; line: number[] }[] = [];
    for (const h of c.statHist) out.push({ key: `${h.s}${h.comp}${h.club}`, s: h.s, label: seasonLabel(h.s), club: h.clubName, comp: h.compName, rules: h.rules, line: h.line });
    for (const cid in me.ss) out.push({ key: 'cur' + cid, s: w.season, label: seasonLabel(w.season) + ' (current)', club: w.comps[cid]?.natTeams ? me.nat : cid === 'nel' ? teamName(w, me.nelTeam ?? '') : teamName(w, me.club ?? ''), comp: w.comps[cid]?.name ?? cid, rules: w.comps[cid]?.rules ?? 'reg', line: me.ss[cid] });
    return out;
  }, [c.statHist, me.ss, w.season]);
  const filt = rows.filter((r) => (scope === 'all' ? true : r.rules === scope));
  const total = newLine(); for (const r of filt) addLine(total, r.line);
  const nel = scope === 'nel';
  const p90 = (v: number, l: number[]) => (secs(l, nel) > 0 ? (v * 5400) / secs(l, nel) : 0);
  const compList = Object.values(w.comps).filter((x) => x.kind !== 'friendly' && Object.values(w.players).some((p) => p.ss[x.id]));
  const leaders = useMemo(() => Object.values(w.players).filter((p) => p.ss[comp]?.[S.APP]).map((p) => ({ p, l: p.ss[comp] })), [w.players, comp, w.abs]);
  const def = DEFS.find((d) => d[1] === stat)!;
  const cnel = w.comps[comp]?.rules === 'nel';
  const lcols: Col<(typeof leaders)[number]>[] = [
    { h: 'Player', get: (x) => <PlayerLink g={g} id={x.p.id} full /> }, { h: 'Club', get: (x) => <span className="small muted">{teamName(w, w.comps[comp]?.natTeams ? x.p.nat : cnel ? x.p.nelTeam ?? '' : x.p.club ?? '')}</span> }, { h: 'Pos', get: (x) => x.p.pos },
    { h: 'Apps', n: true, get: (x) => x.l[S.APP], sort: (x) => x.l[S.APP] }, { h: 'Min', n: true, get: (x) => Math.round(secs(x.l, cnel) / 60), sort: (x) => secs(x.l, cnel) },
    { h: def[0], n: true, get: (x) => <b className="num">{fmt(def[2](x.l))}</b>, sort: (x) => def[2](x.l) },
    { h: 'Per 90', n: true, get: (x) => (secs(x.l, cnel) ? ((def[2](x.l) * 5400) / secs(x.l, cnel)).toFixed(2) : '—'), sort: (x) => (secs(x.l, cnel) >= minMin * 60 ? (def[2](x.l) * 5400) / secs(x.l, cnel) : -1), title: `Players under ${minMin} minutes sort last` },
    { h: 'Rating', n: true, get: (x) => <Rating v={x.l[S.RATN] ? x.l[S.RAT] / x.l[S.RATN] : 0} />, sort: (x) => (x.l[S.RATN] >= 3 ? x.l[S.RAT] / x.l[S.RATN] : 0) },
  ];
  const other = h2h ? w.players[h2h] : null;
  const agg = (pid: string) => { const p = w.players[pid]; const t = newLine(); for (const k in p.ss) if ((w.comps[k]?.rules ?? 'reg') === 'reg') addLine(t, p.ss[k]); return t; };
  const known = Object.keys(c.rel).map((id) => w.players[id]).filter((p) => p && !p.retired).sort((a, b) => ovr(b) - ovr(a)).slice(0, 150);
  const recs = [...Object.entries(w.comps).flatMap(([cid, x]) => Object.entries(x.rec).map(([k, r]) => ({ scope: x.name, k, r, cid }))), ...Object.values(w.clubs).filter((x) => x.id === me.club).flatMap((x) => Object.entries(x.rec).map(([k, r]) => ({ scope: x.name, k, r, cid: x.id })))];
  return (
    <>
      <div className="pagehead"><div><h1>Statistics & Records</h1><div className="sub">Every figure is derived from match events. NEL (first-to-three, playing-time clock) and regulation football are kept separately filterable.</div></div></div>
      <Tabs tabs={[['me', 'My statistics'], ['log', 'Match log'], ['lead', 'Leaderboards'], ['h2h', 'Head-to-head'], ['rec', 'Records & history']]} value={tab} onChange={setTab} />
      {tab === 'me' && <>
        <div className="row wrap mb">{([['reg', 'Regulation football'], ['nel', 'Neo Egoist League'], ['all', 'Everything']] as const).map(([k, l]) => <button key={k} className={`btn sm ${scope === k ? 'pri' : ''}`} onClick={() => setScope(k)}>{l}</button>)}<label className="row small"><input type="checkbox" checked={per90} onChange={(e) => setPer90(e.target.checked)} />Per 90 {nel ? 'playing ' : ''}minutes</label></div>
        <div className="grid g2">
          <Card title={`Totals — ${scope === 'reg' ? 'regulation' : scope === 'nel' ? 'NEL' : 'all formats'}`}>{total[S.APP] ? <div className="grid g2" style={{ gap: '2px 18px' }}>{DEFS.map(([n, k, f, can]) => <div key={k} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '3px 0' }}><span className="muted">{n}</span><b className="num">{per90 && can ? p90(f(total), total).toFixed(2) : fmt(f(total))}</b></div>)}
            {([['Conversion rate', total[S.SH] ? (total[S.G] / total[S.SH]) * 100 : 0], ['Pass accuracy', total[S.PA] ? (total[S.PC] / total[S.PA]) * 100 : 0], ['Dribble success', total[S.DA] ? (total[S.DC] / total[S.DA]) * 100 : 0]] as const).map(([n, v]) => <div key={n} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '3px 0' }}><span className="muted">{n}</span><b className="num">{v.toFixed(1)}%</b></div>)}
            <div className="row between small" style={{ padding: '3px 0' }}><span className="muted">Average rating</span><Rating v={total[S.RATN] ? total[S.RAT] / total[S.RATN] : 0} /></div></div> : <Empty>No appearances in this format yet.</Empty>}
            <p className="tiny dim mt">Clean sheets: credited to goalkeepers and defenders who played at least 60% of a match in which the team conceded nothing. xG: see the documented model in <code>src/engine/match/xg.ts</code>.</p></Card>
          <Card title="By season and competition">{filt.length ? <div className="tw"><table><thead><tr><th>Season</th><th>Club</th><th>Competition</th><th className="n">Apps</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">xG</th><th className="n">Rating</th></tr></thead><tbody>{[...filt].reverse().map((r) => <tr key={r.key}><td>{r.label}</td><td>{r.club}</td><td>{r.comp}{r.rules === 'nel' && <Chip k="b">NEL</Chip>}</td><td className="n">{r.line[S.APP]}</td><td className="n">{Math.round(secs(r.line, r.rules === 'nel') / 60)}</td><td className="n num">{per90 ? ((r.line[S.G] * 5400) / (secs(r.line, r.rules === 'nel') || 1)).toFixed(2) : r.line[S.G]}</td><td className="n num">{per90 ? ((r.line[S.A] * 5400) / (secs(r.line, r.rules === 'nel') || 1)).toFixed(2) : r.line[S.A]}</td><td className="n">{r.line[S.XG].toFixed(1)}</td><td className="n"><Rating v={r.line[S.RATN] ? r.line[S.RAT] / r.line[S.RATN] : 0} /></td></tr>)}</tbody></table></div> : <Empty>Nothing yet.</Empty>}</Card>
        </div></>}
      {tab === 'log' && <Card title="Every match you were involved in">{c.matches.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Competition</th><th>Opponent</th><th>Result</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">Sh</th><th className="n">xG</th><th className="n">KP</th><th className="n">Pass</th><th className="n">Drb</th><th className="n">Def</th><th className="n">Rat</th></tr></thead><tbody>
        {[...c.matches].reverse().slice(0, 120).map((m) => { const l = m.line; return <tr key={m.fid}><td className="nowrap">{m.date}</td><td>{m.compName}</td><td>{m.home ? 'v' : '@'} {m.oppName}</td><td><b className={m.res === 'W' ? 'good' : m.res === 'L' ? 'bad' : ''}>{m.res} {m.sc[0]}–{m.sc[1]}</b></td>{l ? <><td className="n">{Math.round(secs(l, m.rules === 'nel') / 60)}</td><td className="n num">{l[S.G]}</td><td className="n num">{l[S.A]}</td><td className="n">{l[S.SH]}</td><td className="n">{l[S.XG].toFixed(2)}</td><td className="n">{l[S.KP]}</td><td className="n">{l[S.PC]}/{l[S.PA]}</td><td className="n">{l[S.DC]}/{l[S.DA]}</td><td className="n">{l[S.TKW] + l[S.INT] + l[S.BLK]}</td></> : <td colSpan={9} className="muted">did not play</td>}<td className="n"><Rating v={m.rat} />{m.potm ? '⭐' : ''}</td></tr>; })}
      </tbody></table></div> : <Empty>No matches yet.</Empty>}</Card>}
      {tab === 'lead' && <Card>
        <div className="row wrap mb"><select value={comp} onChange={(e) => setComp(e.target.value)} aria-label="Competition">{compList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={stat} onChange={(e) => setStat(e.target.value)} aria-label="Statistic">{DEFS.map(([n, k]) => <option key={k} value={k}>{n}</option>)}</select><label className="row small">Per-90 minimum minutes<input type="number" min={0} step={90} value={minMin} onChange={(e) => setMinMin(Math.max(0, +e.target.value || 0))} style={{ width: 90 }} /></label><span className="tiny muted">Click a column to sort; "Per 90" respects the minimum.</span></div>
        {leaders.length ? <DataTable rows={leaders} cols={lcols} rowKey={(x) => x.p.id} isMe={(x) => x.p.id === me.id} initial={5} max={60} /> : <Empty>No statistics for this competition in the current season.</Empty>}</Card>}
      {tab === 'h2h' && <Card title="Head-to-head (current season, regulation football)">
        <select value={h2h} onChange={(e) => setH2h(e.target.value)} aria-label="Compare with"><option value="">Compare yourself with…</option>{known.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.pos}, {ovr(p)})</option>)}</select>
        {other ? (() => { const a = agg(me.id), b = agg(other.id); return <table className="mt"><thead><tr><th className="n"><span className="row gap6" style={{ justifyContent: 'flex-end' }}>{me.name}<Ovr v={ovr(me)} size="sm" /></span></th><th className="center">Statistic</th><th><span className="row gap6"><Ovr v={ovr(other)} size="sm" /><PlayerLink g={g} id={other.id} full /></span></th></tr></thead><tbody>{DEFS.map(([n, k, f, can]) => { const x = per90 && can ? p90(f(a), a) : f(a), y = per90 && can ? (secs(b, false) ? (f(b) * 5400) / secs(b, false) : 0) : f(b); return <tr key={k}><td className={`n num ${x > y ? 'good' : ''}`}>{fmt(x)}</td><td className="center muted">{n}</td><td className={`num ${y > x ? 'good' : ''}`}>{fmt(y)}</td></tr>; })}<tr><td className="n"><Rating v={a[S.RATN] ? a[S.RAT] / a[S.RATN] : 0} /></td><td className="center muted">Average rating</td><td><Rating v={b[S.RATN] ? b[S.RAT] / b[S.RATN] : 0} /></td></tr></tbody></table>; })() : <Empty>Pick anyone you have a relationship with.</Empty>}
        <label className="row small mt"><input type="checkbox" checked={per90} onChange={(e) => setPer90(e.target.checked)} />Per 90 minutes</label></Card>}
      {tab === 'rec' && <div className="grid g2">
        <Card title="Records (since the 2025/26 baseline of this save)">{recs.length ? recs.map((x, i) => <p key={i} className="small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0', margin: 0 }}><span className="muted">{x.scope} — most {x.k} in a season:</span> <b>{x.r.v}</b> · {x.r.name} ({seasonLabel(x.r.s)})</p>) : <Empty>Records are set at the end of each season.</Empty>}</Card>
        <Card title="Historical leaders by season">{w.archive.length ? [...w.archive].reverse().map((a) => <div key={a.s} style={{ marginBottom: 10 }}><b className="num">{seasonLabel(a.s)}</b>{Object.values(w.comps).filter((x) => x.kind === 'league').map((x) => { const h = x.hist.find((y) => y.s === a.s); return h ? <div key={x.id} className="small"><span className="muted">{x.name}:</span> {h.championName} · top scorer {h.topScorer ? `${h.topScorer.name} (${h.topScorer.v})` : '—'} · most assists {h.topAssist ? `${h.topAssist.name} (${h.topAssist.v})` : '—'}</div> : null; })}</div>) : <Empty>Completed seasons appear here.</Empty>}</Card>
      </div>}
    </>
  );
}
