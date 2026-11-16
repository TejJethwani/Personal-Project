/** Match simulator: pick any two teams, edit both team sheets, then play one match or a hundred. */
import { useMemo, useState } from 'react';
import type { Game } from '../engine/types';
import { simWorld, autoSheet, squadOf, playSim, playMany, SPECIAL_XIS, type SimSheet, type ManyResult } from '../engine/quickmatch';
import { ClubBadge, PlayerAvatar } from '../ui/kit';
import { LEAGUES, FORMATIONS, NEL_TEAMS } from '../engine/data/clubs';
import { NATIONS } from '../engine/data/nations';
import { ovr, fitAt } from '../engine/attributes';
import { clockLabel } from '../engine/match/rules';
import type { MatchState } from '../engine/match/model';
import { nav, toast } from '../store/game';
import { Card, Chip, Tabs, Ovr } from '../ui/kit';
import { Scoreboard, StatTable, Ratings } from './Match';
import { ReplayList } from '../ui/Replay3D';

const natList = Object.values(NATIONS).sort((a, b) => a.name.localeCompare(b.name));

function TeamPick({ g, value, onChange, label }: { g: Game; value: string; onChange: (id: string) => void; label: string }) {
  const w = g.world;
  return (
    <label className="f">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {LEAGUES.map((L) => <optgroup key={L.id} label={L.name}>{(w.comps[L.id]?.teams ?? Object.values(w.clubs).filter((c) => c.league === L.id).map((c) => c.id)).map((id) => w.clubs[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
        <optgroup label="Special sides">{SPECIAL_XIS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
        <optgroup label="Neo Egoist League">{NEL_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
        <optgroup label="National teams">{natList.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</optgroup>
      </select>
    </label>
  );
}

function SheetEdit({ g, id, sheet, onChange }: { g: Game; id: string; sheet: SimSheet; onChange: (s: SimSheet) => void }) {
  const w = g.world;
  const squad = squadOf(g, id).map((pid) => w.players[pid]).filter(Boolean).sort((a, b) => ovr(b) - ovr(a));
  const slots = FORMATIONS[sheet.form];
  const setSlot = (k: number, pid: string) => {
    const xi = [...sheet.xi];
    const other = xi.indexOf(pid);
    if (other >= 0) xi[other] = xi[k]; // swap if he is already in the eleven
    xi[k] = pid;
    const bench = squad.filter((p) => !xi.includes(p.id)).slice(0, 12).map((p) => p.id);
    onChange({ ...sheet, xi, bench });
  };
  const setForm = (form: string) => {
    // keep as many of the current eleven as fit the new shape, best fit first
    const sl = FORMATIONS[form];
    const pool = [...sheet.xi];
    const xi: string[] = [];
    for (let k = 0; k < sl.length; k++) { const pos = sl[k][0]; const cand = pool.filter((pid) => !xi.includes(pid) && (pos === 'GK') === (w.players[pid].pos === 'GK')).sort((a, b) => fitAt(w.players[b], pos as never) - fitAt(w.players[a], pos as never))[0] ?? pool.find((pid) => !xi.includes(pid))!; xi.push(cand); }
    onChange({ ...sheet, form, xi });
  };
  const avg = Math.round(sheet.xi.reduce((s, pid) => s + ovr(w.players[pid]), 0) / 11);
  return (
    <div>
      <div className="row wrap mb"><label className="f">Formation<select value={sheet.form} onChange={(e) => setForm(e.target.value)}>{Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}</select></label><button className="btn sm" style={{ alignSelf: 'flex-end' }} onClick={() => onChange(autoSheet(g, id))}>Coach's pick</button><Chip k="b">XI average {avg}</Chip></div>
      <div className="col gap4">{slots.map((sl, k) => { const p = w.players[sheet.xi[k]]; return (
        <div key={k} className="row small" style={{ gap: 8 }}>
          <span className="num dim" style={{ width: 30 }}>{sl[0]}</span>
          <select value={sheet.xi[k]} onChange={(e) => setSlot(k, e.target.value)} style={{ flex: 1, minWidth: 0 }} aria-label={`${sl[0]} slot`}>
            {squad.filter((q) => (sl[0] === 'GK') === (q.pos === 'GK') || q.id === sheet.xi[k]).map((q) => <option key={q.id} value={q.id}>{q.name} — {q.pos} {ovr(q)}{sheet.xi.includes(q.id) && q.id !== sheet.xi[k] ? ' (in XI)' : ''}</option>)}
          </select>
          <Ovr v={p ? Math.round(fitAt(p, sl[0] as never)) : 0} size="sm" />
        </div>); })}</div>
      <p className="tiny dim mt">Bench: {sheet.bench.slice(0, 9).map((pid) => w.players[pid]?.sn).join(', ') || '—'}. The rating beside each slot is the player's rating in that position.</p>
    </div>
  );
}

function ManyReport({ g, many, H, A, name, onOpen }: { g: Game; many: ManyResult; H: string; A: string; name: (id: string) => string; onOpen: (ms: MatchState) => void }) {
  const pct = (x: number) => Math.round((x / many.n) * 100);
  const groups = [...new Set(many.notable.map((x) => x.key))];
  const players = many.players;
  const top = (f: (p: ManyResult['players'][number]) => number, minApps = 1) => [...players].filter((p) => p.apps >= minApps && f(p) > 0).sort((a, b) => f(b) - f(a)).slice(0, 5);
  const T = many.team;
  const row = (label: string, a: string | number, b: string | number) => <tr key={label}><td className="n num">{a}</td><td className="center muted small">{label}</td><td className="num">{b}</td></tr>;
  const Board = ({ title, list, val }: { title: string; list: ManyResult['players']; val: (p: ManyResult['players'][number]) => string }) => (
    <Card title={title}>{list.length ? list.map((p, i) => { const wp = g.world.players[p.id]; return <div key={p.id} className="row" style={{ padding: '3px 0', gap: 8 }}><span className="num dim" style={{ width: 16 }}>{i + 1}</span>{wp && <PlayerAvatar g={g} p={wp} size={28} />}<span className="grow"><b>{p.name}</b> <span className="tiny muted">{name(p.t === 0 ? H : A)}</span></span><b className="num">{val(p)}</b></div>; }) : <p className="small muted">—</p>}</Card>
  );
  return (
    <div className="mb">
      <Card title={`${name(H)} v ${name(A)} — ${many.n} simulations`} className="hot mb">
        <div className="row wrap" style={{ gap: 26, alignItems: 'center' }}>
          <span className="row gap6"><ClubBadge g={g} id={H} lg /><div className="kpi"><b className="good">{pct(many.h)}%</b><span>{name(H)} win</span></div></span>
          <div className="kpi"><b>{pct(many.d)}%</b><span>Draw</span></div>
          <span className="row gap6"><div className="kpi"><b className="bad">{pct(many.a)}%</b><span>{name(A)} win</span></div><ClubBadge g={g} id={A} lg /></span>
          <div className="kpi"><b>{many.gf.toFixed(2)} – {many.ga.toFixed(2)}</b><span>Average score</span></div>
        </div>
        <div className="row small" style={{ marginTop: 10 }}><div className="grow bar tall" title="Outcome shares"><i style={{ width: `${pct(many.h)}%`, background: 'var(--good)' }} /><i style={{ left: `${pct(many.h)}%`, width: `${pct(many.d)}%`, background: 'var(--muted)' }} /><i style={{ left: `${pct(many.h + many.d)}%`, width: `${pct(many.a)}%`, background: 'var(--bad)' }} /></div></div>
        <div className="row wrap gap6 mt">{many.scores.map(([s2, n]) => <span key={s2} className="chip b">{s2} × {n}</span>)}<span className="chip">{many.comebacks} comebacks</span><span className="chip">{many.lateWinners} late winners</span>{many.pens > 0 && <span className="chip">{many.pens} shoot-outs</span>}<span className="chip">{many.draws00} goalless</span></div>
      </Card>
      <div className="grid g2 mb">
        <Card title="Average match">
          <table><thead><tr><th className="n">{name(H)}</th><th /><th>{name(A)}</th></tr></thead><tbody>
            {row('Possession', `${T[0].poss.toFixed(0)}%`, `${T[1].poss.toFixed(0)}%`)}{row('Shots', T[0].shots.toFixed(1), T[1].shots.toFixed(1))}{row('On target', T[0].sot.toFixed(1), T[1].sot.toFixed(1))}{row('Expected goals', T[0].xg.toFixed(2), T[1].xg.toFixed(2))}
            {row('Fouls', T[0].fouls.toFixed(1), T[1].fouls.toFixed(1))}{row('Yellow cards', T[0].yc.toFixed(2), T[1].yc.toFixed(2))}{row('Red cards (total)', Math.round(T[0].rc * many.n), Math.round(T[1].rc * many.n))}{row('Clean sheets', T[0].cs, T[1].cs)}{row('Biggest win', T[0].biggestWin, T[1].biggestWin)}
          </tbody></table>
        </Card>
        <div className="grid g2" style={{ gap: 10 }}>
          <Board title="Top scorers" list={top((p) => p.g)} val={(p) => `${p.g}`} />
          <Board title="Most assists" list={top((p) => p.a)} val={(p) => `${p.a}`} />
          <Board title="Best average rating" list={top((p) => p.rat, Math.ceil(many.n * 0.3))} val={(p) => p.rat.toFixed(2)} />
          <Board title="Player of the Match" list={top((p) => p.potm * 10 + p.hat)} val={(p) => `${p.potm}${p.hat ? ` · ${p.hat} hat-trick${p.hat > 1 ? 's' : ''}` : ''}`} />
        </div>
      </div>
      <Card title="Notable matches — click one to see it in full (ratings, stats and 3D replays)">
        {groups.length ? <div className="grid g2">{groups.map((k) => { const list = many.notable.filter((x) => x.key === k); return (
          <div key={k}><h4 style={{ marginBottom: 6 }}>{list[0].title}</h4>{list.map((x) => (
            <button key={x.sum.i} className="opt" style={{ marginBottom: 6, padding: '7px 10px' }} onClick={() => onOpen(x.ms)}>
              <span className="row between"><b style={{ fontSize: 17 }}>{name(H)} {x.sum.score[0]}–{x.sum.score[1]} {name(A)}{x.sum.pens ? ` (${x.sum.pens[0]}–${x.sum.pens[1]} pens)` : ''}</b><span className="tiny muted">match #{x.sum.i}</span></span>
              <span className="small muted">{[x.sum.comeback ? `came from ${x.sum.comeback} down` : '', x.sum.lateWinner ? 'late winner' : '', x.sum.lead > 1 ? `${x.sum.lead} lead changes` : '', x.sum.reds ? `${x.sum.reds} red card${x.sum.reds > 1 ? 's' : ''}` : '', `xG ${x.sum.xg[0].toFixed(1)}–${x.sum.xg[1].toFixed(1)}`].filter(Boolean).join(' · ')}</span>
              {x.sum.scorers.length > 0 && <span className="tiny dim">⚽ {x.sum.scorers.slice(0, 8).join(', ')}{x.sum.scorers.length > 8 ? '…' : ''}</span>}
            </button>))}</div>); })}</div> : <p className="small muted">Nothing out of the ordinary in these hundred matches.</p>}
      </Card>
    </div>
  );
}

export function MatchSim() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const g = useMemo(() => simWorld(seed), [seed]);
  const [home, setHome] = useState('eng1_ars');
  const [away, setAway] = useState('esp1_rma');
  const ok = (id: string) => !!g.world.clubs[id] || !!NATIONS[id];
  const H = ok(home) ? home : Object.keys(g.world.clubs)[0], A = ok(away) ? away : Object.keys(g.world.clubs)[1];
  const [sheets, setSheets] = useState<Record<string, SimSheet>>({});
  const sh = (id: string) => sheets[id] ?? autoSheet(g, id);
  const [nel, setNel] = useState(false);
  const [ko, setKo] = useState(false);
  const [ms, setMs] = useState<MatchState | null>(null);
  const [many, setMany] = useState<ManyResult | null>(null);
  const [tab, setTab] = useState('rat');
  const [edit, setEdit] = useState<'h' | 'a'>('h');
  const name = (id: string) => g.world.clubs[id]?.name ?? NATIONS[id]?.name ?? id;
  const run = () => { if (H === A) return toast('Pick two different teams.', true); try { setMany(null); setMs(playSim(g, H, A, [sh(H), sh(A)], { nel, knockout: ko, record: true })); setTab('rat'); } catch (e) { toast((e as Error).message, true); } };
  const [busy, setBusy] = useState(false);
  const runMany = () => { if (H === A) return toast('Pick two different teams.', true); setBusy(true); setMs(null); setTimeout(() => { try { setMany(playMany(g, H, A, [sh(H), sh(A)], 100, { nel, knockout: ko })); } catch (e) { toast((e as Error).message, true); } setBusy(false); }, 30); };
  return (
    <div className="page" style={{ position: 'relative', zIndex: 1 }}>
      <div className="pagehead"><div><h1>Match simulator</h1><div className="sub">Any two teams, your team sheets, the same engine as the career. Nothing here touches a save.</div></div>
        <span className="row wrap gap6"><button className="btn" onClick={() => { setSeed(Math.floor(Math.random() * 1e9)); setSheets({}); setMs(null); setMany(null); }} title="Rebuild the world with fresh generated players">New world</button><button className="btn" onClick={() => nav('menu')}>← Main menu</button></span></div>
      <div className="grid g2 mb">
        <Card title="Match-up">
          <div className="grid g2"><TeamPick g={g} value={H} onChange={(id) => { setHome(id); setMs(null); setMany(null); }} label="Home" /><TeamPick g={g} value={A} onChange={(id) => { setAway(id); setMs(null); setMany(null); }} label="Away" /></div>
          <div className="row wrap mt">
            <span className="seg" role="group" aria-label="Rules"><button className={!nel ? 'on' : ''} onClick={() => setNel(false)}>90 minutes</button><button className={nel ? 'on' : ''} onClick={() => setNel(true)}>First to three</button></span>
            {!nel && <label className="row small"><input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} /><span>Knockout tie (extra time and penalties)</span></label>}
          </div>
          <div className="row wrap mt"><button className="btn pri big" onClick={run}>▶ Simulate match</button><button className="btn big" onClick={runMany} disabled={busy}>{busy ? 'Simulating 100 matches…' : 'Simulate ×100'}</button></div>
          <p className="tiny dim mt">Squads are the 2025/26 baseline written from memory plus generated players; results are fictional.</p>
        </Card>
        <Card title="Team sheets">
          <div className="row mb"><span className="seg" role="group" aria-label="Team to edit"><button className={edit === 'h' ? 'on' : ''} onClick={() => setEdit('h')}>{name(H)}</button><button className={edit === 'a' ? 'on' : ''} onClick={() => setEdit('a')}>{name(A)}</button></span></div>
          <SheetEdit key={(edit === 'h' ? H : A) + seed} g={g} id={edit === 'h' ? H : A} sheet={sh(edit === 'h' ? H : A)} onChange={(s) => setSheets({ ...sheets, [edit === 'h' ? H : A]: s })} />
        </Card>
      </div>
      {many && <ManyReport g={g} many={many} H={H} A={A} name={name} onOpen={(m) => { setMs(m); setTab('rat'); setTimeout(() => document.getElementById('simmatch')?.scrollIntoView({ behavior: 'smooth' }), 50); }} />}
      {ms && <>
        <div className="hero mb" id="simmatch"><Scoreboard g={g} ms={ms} live={false} /></div>
        <Card><Tabs tabs={[['rat', 'Player ratings'], ['stats', 'Team stats'], ['feed', 'Key events'], ['rep', `3D replays${ms.replays?.length ? ` (${ms.replays.length})` : ''}`]]} value={tab} onChange={setTab} />
          {tab === 'rep' ? <ReplayList ms={ms} g={g} /> : tab === 'rat' ? <Ratings g={g} ms={ms} /> : tab === 'stats' ? <StatTable ms={ms} /> : <div>{ms.ev.filter((e) => e.i >= 2 && e.x).map((e, i) => <div key={i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div>}
        </Card>
      </>}
    </div>
  );
}
