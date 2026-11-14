/**
 * Administrator panel: direct editing of the loaded career (player, abilities, club, any player
 * in the world, every rule and setting) and management of the local accounts on this device.
 */
import { useState } from 'react';
import type { Game, Pos } from '../engine/types';
import { ATTRS, N_OUT, OUTFIELD, calcOvr, ovr, solveToTarget } from '../engine/attributes';
import { WEAPONS, PASSIVES, ULTIMATES, MAX_LEVEL, abilityDef } from '../engine/abilities';
import { DIFFICULTY, REALISM } from '../engine/match/setup';
import { LEAGUES } from '../engine/data/clubs';
import { doTransfer } from '../engine/transfers';
import { fmtEur } from '../engine/util';
import { act, nav, toast, useStore } from '../store/game';
import { Card, Chip, ConfirmButton, Empty, Ovr, Tabs } from '../ui/kit';
import { isAdmin, listAccounts, removeAccount, changePassword, signOut } from '../storage/accounts';
import { listSaves, deleteSave, loadGame, type SlotMeta } from '../storage/idb';
import { setGame } from '../store/game';

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)));
function Num({ label, v, min, max, step = 1, on }: { label: string; v: number; min: number; max: number; step?: number; on: (v: number) => void }) {
  return <label className="f">{label}<input type="number" min={min} max={max} step={step} value={v} onChange={(e) => { const n = +e.target.value; if (!Number.isNaN(n)) on(Math.max(min, Math.min(max, n))); }} style={{ width: 120 }} /></label>;
}

function Accounts() {
  const [, bump] = useState(0);
  const [saves, setSaves] = useState<SlotMeta[] | null>(null);
  const [pw, setPw] = useState<Record<string, string>>({});
  const reload = () => listSaves(true).then(setSaves).catch(() => setSaves([]));
  if (saves === null) reload();
  const accs = listAccounts();
  return (
    <div className="grid g2">
      <Card title={`Accounts on this device (${accs.length})`}>
        {accs.length ? accs.map((a) => <div key={a.name} className="row wrap" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
          <div className="grow"><b>{a.name}</b><div className="tiny dim">created {new Date(a.created).toLocaleDateString()} · {(saves ?? []).filter((s) => s.owner === a.name).length} save(s)</div></div>
          <input placeholder="new password" value={pw[a.name] ?? ''} onChange={(e) => setPw({ ...pw, [a.name]: e.target.value })} style={{ width: 130 }} aria-label={`New password for ${a.name}`} />
          <button className="btn sm" onClick={async () => { const e = await changePassword(a.name, pw[a.name] ?? ''); toast(e ?? `Password for ${a.name} changed.`, !!e); if (!e) setPw({ ...pw, [a.name]: '' }); }}>Reset</button>
          <ConfirmButton label="Delete" confirm="Delete account + saves?" onConfirm={async () => { for (const s of saves ?? []) if (s.owner === a.name) await deleteSave(s.slot); removeAccount(a.name); await reload(); bump((x) => x + 1); }} />
        </div>) : <Empty>No accounts have been created on this device yet.</Empty>}
        <p className="tiny dim mt">Accounts are local to this browser. Passwords are stored only as salted hashes, so they can be reset here but not read.</p>
      </Card>
      <Card title="Every save on this device">
        {(saves ?? []).length ? (saves ?? []).map((s) => <div key={s.slot} className="row wrap" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
          <Ovr v={s.summary.ovr} size="sm" /><div className="grow"><b>{s.summary.name}</b> <span className="muted small">· {s.summary.club} · {s.summary.season}</span><div className="tiny dim">{s.owner ?? 'guest'} · {s.label} · {new Date(s.updated).toLocaleString()}</div></div>
          <button className="btn sm pri" onClick={async () => { try { setGame(await loadGame(s.slot)); toast(`Loaded ${s.summary.name}.`); bump((x) => x + 1); } catch (e) { toast((e as Error).message, true); } }}>Load to edit</button>
          <ConfirmButton label="Delete" confirm="Really delete?" onConfirm={async () => { await deleteSave(s.slot); reload(); }} />
        </div>) : <Empty>No saves.</Empty>}
      </Card>
    </div>
  );
}

function PlayerEdit({ g, pid }: { g: Game; pid: string }) {
  const p = g.world.players[pid];
  const mine = pid === g.career.pid;
  const [target, setTarget] = useState(ovr(p));
  const edit = (fn: (x: Game) => void) => act((x) => { fn(x); x.edited = true; });
  if (!p) return <Empty>Player not found.</Empty>;
  return (
    <>
      <div className="row wrap mb"><Ovr v={ovr(p)} size="lg" /><div><h2>{p.name}</h2><div className="small muted">{p.pos} · age {g.world.season - p.born} · potential {p.pot} · {p.club ? g.world.clubs[p.club]?.name : 'no club'}</div></div></div>
      <div className="row wrap mb">
        <Num label="Set overall to" v={target} min={1} max={99} on={setTarget} />
        <button className="btn pri" style={{ alignSelf: 'flex-end' }} onClick={() => { edit((x) => { const q = x.world.players[pid]; q.a = solveToTarget(q.a, q.pos, target); q.pot = Math.max(q.pot, calcOvr(q.a, q.pos)); if (mine) x.career.ovrLog.push({ s: x.world.season, day: x.world.day, ovr: calcOvr(q.a, q.pos) }); }); toast(`Overall set to ${target}.`); }}>Apply overall</button>
        <Num label="Potential" v={p.pot} min={1} max={99} on={(v) => edit((x) => { x.world.players[pid].pot = clampN(v, 1, 99); })} />
        <Num label="Age" v={g.world.season - p.born} min={15} max={45} on={(v) => edit((x) => { x.world.players[pid].born = x.world.season - clampN(v, 15, 45); })} />
        <Num label="Reputation" v={Math.round(p.rep)} min={0} max={99} on={(v) => edit((x) => { x.world.players[pid].rep = v; })} />
        <Num label="Fitness" v={Math.round(p.fit)} min={1} max={100} on={(v) => edit((x) => { const q = x.world.players[pid]; q.fit = v; q.inj = 0; })} />
        <label className="f">Position<select value={p.pos} onChange={(e) => edit((x) => { x.world.players[pid].pos = e.target.value as Pos; })}>{(p.pos === 'GK' ? ['GK' as Pos] : OUTFIELD).map((o) => <option key={o}>{o}</option>)}</select></label>
      </div>
      <h4>Attributes</h4>
      <div className="grid g4" style={{ gap: 6, marginTop: 6 }}>{ATTRS.map((a, i) => (i >= N_OUT && p.pos !== 'GK' ? null : <label key={a.key} className="row small" style={{ gap: 6 }}><span className="grow">{a.name}</span><input type="number" min={1} max={99} value={p.a[i]} onChange={(e) => { const v = clampN(+e.target.value || 1, 1, 99); edit((x) => { const q = x.world.players[pid]; q.a[i] = v; q.pot = Math.max(q.pot, calcOvr(q.a, q.pos)); }); }} style={{ width: 62 }} aria-label={a.name} /></label>))}</div>
      <div className="row wrap mt"><button className="btn sm" onClick={() => edit((x) => { const q = x.world.players[pid]; for (let i = 0; i < (q.pos === 'GK' ? q.a.length : N_OUT); i++) q.a[i] = 99; q.pot = 99; })}>Max everything (99)</button><button className="btn sm" onClick={() => edit((x) => { const q = x.world.players[pid]; q.inj = 0; q.fit = 100; })}>Heal &amp; full fitness</button></div>
    </>
  );
}

export function Admin() {
  const { g } = useStore();
  const [tab, setTab] = useState(g ? 'me' : 'acc');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  if (!isAdmin()) return <div className="page"><Card title="Administrator only"><p>Sign in with the administrator account from the main menu to open this panel.</p><button className="btn" onClick={() => nav('menu')}>Back to menu</button></Card></div>;
  const edit = (fn: (x: Game) => void) => act((x) => { fn(x); x.edited = true; });
  const me = g ? g.world.players[g.career.pid] : null;
  const s = g?.settings;
  const found = g && q.trim().length >= 2 ? Object.values(g.world.players).filter((p) => !p.retired && p.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => ovr(b) - ovr(a)).slice(0, 14) : [];
  const tabs: [string, string][] = g ? [['me', 'My player'], ['ab', 'Abilities'], ['career', 'Career & club'], ['world', 'Any player'], ['rules', 'Rules & settings'], ['acc', 'Accounts & saves']] : [['acc', 'Accounts & saves']];
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Admin panel</h1><div className="sub">{g ? <>Editing the loaded career: <b>{me!.name}</b>. Changes apply immediately, are autosaved and mark the save as edited.</> : 'No career is loaded — load a save below (or from the main menu) to edit it.'}</div></div>
        <span className="row wrap gap6"><Chip k="e">Administrator</Chip>{g && <button className="btn" onClick={() => nav('hub')}>Open career</button>}<button className="btn" onClick={() => nav('menu')}>Main menu</button><button className="btn ghost" onClick={() => { signOut(); nav('menu'); }}>Sign out</button></span></div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'acc' && <Accounts />}
      {g && me && tab === 'me' && <Card><PlayerEdit g={g} pid={me.id} /></Card>}
      {g && me && tab === 'ab' && <div className="grid g3">{([['Weapons', WEAPONS], ['Passives', PASSIVES], ['Ultimates', ULTIMATES]] as const).map(([title, list]) => <Card key={title} title={title}>
        <div className="col gap4">{list.map((d) => { const r = me.ab.find((x) => x.id === d.id); return <div key={d.id} className="row small" style={{ gap: 6 }}>
          <label className="row grow" style={{ gap: 6 }}><input type="checkbox" checked={!!r} onChange={(e) => edit((x) => { const p = x.world.players[x.career.pid]; if (e.target.checked) { if (!p.ab.some((y) => y.id === d.id)) p.ab.push({ id: d.id, lv: 1, xp: 0 }); if (d.kind === 'ultimate') { x.career.flags.ultPath = d.id; x.career.flags.ultAwake = 1; } } else p.ab = p.ab.filter((y) => y.id !== d.id); })} /><span>{d.name}</span></label>
          {r && <select value={r.lv} onChange={(e) => edit((x) => { const y = x.world.players[x.career.pid].ab.find((z) => z.id === d.id); if (y) { y.lv = +e.target.value; y.xp = 0; } })} aria-label={`${d.name} level`}>{Array.from({ length: MAX_LEVEL }, (_, i) => <option key={i} value={i + 1}>Lv {i + 1}</option>)}</select>}
        </div>; })}</div>
        {title === 'Weapons' && <p className="tiny dim mt">The four-weapon limit is not enforced here.</p>}
        {title === 'Ultimates' && <p className="tiny dim mt">Ticking an ultimate awakens it at once. Path: {abilityDef(String(g.career.flags.ultPath ?? ''))?.name ?? 'none'}.</p>}
      </Card>)}</div>}
      {g && me && tab === 'career' && <div className="grid g2">
        <Card title="Career values"><div className="row wrap">
          <Num label="Coach trust" v={Math.round(g.career.mgrTrust)} min={0} max={100} on={(v) => edit((x) => { x.career.mgrTrust = v; })} />
          <Num label="Tactical discipline" v={Math.round(g.career.discipline)} min={0} max={100} on={(v) => edit((x) => { x.career.discipline = v; })} />
          <Num label="Public image (−100…100)" v={Math.round(g.career.image)} min={-100} max={100} on={(v) => edit((x) => { x.career.image = v; })} />
          <Num label="Career earnings (€)" v={Math.round(g.career.wages)} min={0} max={2e9} step={100000} on={(v) => edit((x) => { x.career.wages = v; })} />
          <Num label="Flow entries (ultimate progress)" v={Number(g.career.flags.flowCount ?? 0)} min={0} max={999} on={(v) => edit((x) => { x.career.flags.flowCount = v; })} />
          {me.con && <Num label="Weekly wage (€)" v={me.con.wage} min={0} max={5e6} step={1000} on={(v) => edit((x) => { const c = x.world.players[x.career.pid].con; if (c) c.wage = v; })} />}
          {me.con && <Num label="Contract until (season)" v={me.con.until} min={g.world.season} max={g.world.season + 10} on={(v) => edit((x) => { const c = x.world.players[x.career.pid].con; if (c) c.until = v; })} />}
        </div>
          <div className="row wrap mt"><button className="btn sm" onClick={() => edit((x) => { for (const id in x.career.rel) { const r = x.career.rel[id]; r.trust = 90; r.friend = 90; r.resp = 90; r.chem = 90; } })}>Max every relationship</button><button className="btn sm" onClick={() => edit((x) => { x.career.inbox = x.career.inbox.filter((i) => i.done); })}>Clear pending interactions</button></div>
          <p className="small muted mt">Currently: {me.club ? g.world.clubs[me.club]?.name : 'no club'}{me.con ? ` · ${me.con.role} · ${fmtEur(me.con.wage)}/week` : ''}</p>
        </Card>
        <Card title="Move to any club">{g.world.phase !== 'pro' ? <Empty>Available once the professional chapter has started.</Empty> : <>
          <p className="small muted">An immediate free transfer on a three-year contract as a key player.</p>
          {LEAGUES.map((L) => <details key={L.id} style={{ marginTop: 6 }}><summary className="num" style={{ cursor: 'pointer', fontSize: 17 }}>{L.name}</summary><div className="row wrap gap6" style={{ marginTop: 6 }}>{(g.world.comps[L.id]?.teams ?? []).map((id) => g.world.clubs[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <button key={c.id} className={`btn sm ${me.club === c.id ? 'pri' : ''}`} disabled={me.club === c.id} onClick={() => { edit((x) => { const p = x.world.players[x.career.pid]; doTransfer(x, p, x.world.clubs[c.id], 0, 'free', { years: 3, role: 'key', wage: Math.max(p.con?.wage ?? 20000, 20000) }); x.career.mgrTrust = 75; }); toast(`Moved to ${c.name}.`); }}>{c.sn}</button>)}</div></details>)}
        </>}</Card>
      </div>}
      {g && tab === 'world' && <Card title="Edit any player">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player by name (2+ letters)" style={{ width: '100%', maxWidth: 420 }} aria-label="Search player" />
        <div className="row wrap gap6 mt">{found.map((p) => <button key={p.id} className={`btn sm ${sel === p.id ? 'pri' : ''}`} onClick={() => setSel(p.id)}>{p.name} · {p.pos} {ovr(p)}</button>)}</div>
        {sel && g.world.players[sel] && <div className="mt"><PlayerEdit key={sel} g={g} pid={sel} /></div>}
      </Card>}
      {g && s && tab === 'rules' && <div className="grid g2">
        <Card title="Simulation">
          <div className="row wrap">
            <label className="f">Difficulty<select value={s.difficulty} onChange={(e) => edit((x) => { x.settings.difficulty = +e.target.value; })}>{DIFFICULTY.map((d, i) => <option key={i} value={i}>{d.name}</option>)}</select></label>
            <label className="f">Realism<select value={s.realism} onChange={(e) => edit((x) => { x.settings.realism = +e.target.value; })}>{REALISM.map((r, i) => <option key={i} value={i}>{r.name}</option>)}</select></label>
            <label className="f">Injuries<select value={s.injuries} onChange={(e) => edit((x) => { x.settings.injuries = +e.target.value; })}>{['Off', 'Low', 'Normal', 'High'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
            <Num label="Development speed ×" v={s.devSpeed} min={0.1} max={20} step={0.1} on={(v) => edit((x) => { x.settings.devSpeed = v; })} />
            <label className="f">Decision frequency<select value={s.freq} onChange={(e) => edit((x) => { x.settings.freq = +e.target.value; })}>{['Low', 'Standard', 'High'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
          </div>
          {(['showProb', 'autoFlow', 'dynamicPot', 'canonChange', 'reduceMotion'] as const).map((k) => <label key={k} className="row mt"><input type="checkbox" checked={!!s[k]} onChange={(e) => edit((x) => { x.settings[k] = e.target.checked; })} /><span>{{ showProb: 'Show probabilities', autoFlow: 'Automatic Flow', dynamicPot: 'Dynamic potential', canonChange: 'Canonical outcomes may change', reduceMotion: 'Reduce motion (disables 3D cut-ins)' }[k]}</span></label>)}
          <label className="row mt"><input type="checkbox" checked={s.touch !== false} onChange={(e) => edit((x) => { x.settings.touch = e.target.checked; })} /><span>Touch controls on the pitch</span></label>
        </Card>
        <Card title="NEL rules"><div className="row wrap">
          <Num label="Goals to win" v={s.nel.goalTarget} min={1} max={9} on={(v) => edit((x) => { x.settings.nel.goalTarget = clampN(v, 1, 9); })} />
          <Num label="Substitutions" v={s.nel.subs} min={0} max={11} on={(v) => edit((x) => { x.settings.nel.subs = clampN(v, 0, 11); })} />
          <Num label="Star Change seconds" v={s.nel.starSec} min={30} max={900} step={30} on={(v) => edit((x) => { x.settings.nel.starSec = v; })} />
          <Num label="Selected for the U-20s (top N)" v={s.nel.topN} min={1} max={60} on={(v) => edit((x) => { x.settings.nel.topN = clampN(v, 1, 60); })} />
        </div>
          <label className="row mt"><input type="checkbox" checked={s.nel.starChange} onChange={(e) => edit((x) => { x.settings.nel.starChange = e.target.checked; })} /><span>Star Change</span></label>
          <label className="row mt"><input type="checkbox" checked={s.nel.offside} onChange={(e) => edit((x) => { x.settings.nel.offside = e.target.checked; })} /><span>Offsides</span></label>
          <p className="tiny dim mt">Rule changes apply from the next match.</p>
        </Card>
      </div>}
    </div>
  );
}
