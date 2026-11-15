/** Match simulator: pick any two teams, edit both team sheets, then play one match or a hundred. */
import { useMemo, useState } from 'react';
import type { Game } from '../engine/types';
import { simWorld, autoSheet, squadOf, playSim, playMany, type SimSheet } from '../engine/quickmatch';
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
  const [many, setMany] = useState<ReturnType<typeof playMany> | null>(null);
  const [tab, setTab] = useState('rat');
  const [edit, setEdit] = useState<'h' | 'a'>('h');
  const name = (id: string) => g.world.clubs[id]?.name ?? NATIONS[id]?.name ?? id;
  const run = () => { if (H === A) return toast('Pick two different teams.', true); try { setMany(null); setMs(playSim(g, H, A, [sh(H), sh(A)], { nel, knockout: ko, record: true })); setTab('rat'); } catch (e) { toast((e as Error).message, true); } };
  const runMany = () => { if (H === A) return toast('Pick two different teams.', true); try { setMs(null); setMany(playMany(g, H, A, [sh(H), sh(A)], 100, { nel, knockout: ko })); } catch (e) { toast((e as Error).message, true); } };
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
          <div className="row wrap mt"><button className="btn pri big" onClick={run}>▶ Simulate match</button><button className="btn big" onClick={runMany}>Simulate ×100</button></div>
          <p className="tiny dim mt">Squads are the 2025/26 baseline written from memory plus generated players; results are fictional.</p>
        </Card>
        <Card title="Team sheets">
          <div className="row mb"><span className="seg" role="group" aria-label="Team to edit"><button className={edit === 'h' ? 'on' : ''} onClick={() => setEdit('h')}>{name(H)}</button><button className={edit === 'a' ? 'on' : ''} onClick={() => setEdit('a')}>{name(A)}</button></span></div>
          <SheetEdit key={(edit === 'h' ? H : A) + seed} g={g} id={edit === 'h' ? H : A} sheet={sh(edit === 'h' ? H : A)} onChange={(s) => setSheets({ ...sheets, [edit === 'h' ? H : A]: s })} />
        </Card>
      </div>
      {many && <Card title={`${name(H)} v ${name(A)} — ${many.n} simulations`} className="hot mb">
        <div className="row wrap" style={{ gap: 26 }}>
          <div className="kpi"><b className="good">{Math.round((many.h / many.n) * 100)}%</b><span>{name(H)} win</span></div>
          <div className="kpi"><b>{Math.round((many.d / many.n) * 100)}%</b><span>Draw</span></div>
          <div className="kpi"><b className="bad">{Math.round((many.a / many.n) * 100)}%</b><span>{name(A)} win</span></div>
          <div className="kpi"><b>{many.gf.toFixed(2)} – {many.ga.toFixed(2)}</b><span>Average score</span></div>
        </div>
        <div className="row small" style={{ marginTop: 10 }}><div className="grow bar tall" title="Outcome shares"><i style={{ width: `${(many.h / many.n) * 100}%`, background: 'var(--good)' }} /><i style={{ left: `${(many.h / many.n) * 100}%`, width: `${(many.d / many.n) * 100}%`, background: 'var(--muted)' }} /><i style={{ left: `${((many.h + many.d) / many.n) * 100}%`, width: `${(many.a / many.n) * 100}%`, background: 'var(--bad)' }} /></div></div>
        <p className="small muted mt">Most common scores: {many.scores.map(([s, n]) => `${s} (${n})`).join(' · ')}</p>
      </Card>}
      {ms && <>
        <div className="hero mb"><Scoreboard g={g} ms={ms} live={false} /></div>
        <Card><Tabs tabs={[['rat', 'Player ratings'], ['stats', 'Team stats'], ['feed', 'Key events'], ['rep', `3D replays${ms.replays?.length ? ` (${ms.replays.length})` : ''}`]]} value={tab} onChange={setTab} />
          {tab === 'rep' ? <ReplayList ms={ms} g={g} /> : tab === 'rat' ? <Ratings g={g} ms={ms} /> : tab === 'stats' ? <StatTable ms={ms} /> : <div>{ms.ev.filter((e) => e.i >= 2 && e.x).map((e, i) => <div key={i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div>}
        </Card>
      </>}
    </div>
  );
}
