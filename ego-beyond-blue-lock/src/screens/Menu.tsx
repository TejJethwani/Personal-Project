import { useEffect, useRef, useState } from 'react';
import { listSaves, loadGame, deleteSave, saveGame, storageMode, type SlotMeta } from '../storage/idb';
import { importSave } from '../engine/save';
import { SUPPORTED } from '../engine/season';
import { nav, setGame, toast, useStore } from '../store/game';
import { Ovr, Chip, ConfirmButton } from '../ui/kit';
import { currentUser, isAdmin, signIn, signOut, signUp, onAccountChange } from '../storage/accounts';

function AccountBox({ onChange }: { onChange: () => void }) {
  const [, bump] = useState(0);
  const [mode, setMode] = useState<'in' | 'up' | null>(null);
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('');
  useEffect(() => onAccountChange(() => { bump((x) => x + 1); onChange(); }), [onChange]);
  const me = currentUser();
  const go = async () => { setErr(''); const e = mode === 'up' ? await signUp(u, p) : await signIn(u, p); if (e) setErr(e); else { setMode(null); setU(''); setP(''); toast(isAdmin() ? 'Signed in as administrator.' : `Signed in as ${currentUser()}.`); if (isAdmin()) nav('admin'); } };
  return (
    <section className={`card mb ${me ? 'hot' : ''}`}>
      <div className="row wrap between"><h3 style={{ margin: 0 }}>Account</h3>
        {me ? <span className="row wrap gap6"><Chip k={isAdmin() ? 'e' : 'g'}>{isAdmin() ? 'Administrator' : 'Signed in'}</Chip><b>{me}</b>{isAdmin() && <button className="btn sm pri" onClick={() => nav('admin')}>Admin panel</button>}<button className="btn sm" onClick={() => { signOut(); setGame(null); toast('Signed out.'); }}>Sign out</button></span>
          : <span className="row wrap gap6"><Chip>Guest</Chip><button className={`btn sm ${mode === 'in' ? 'pri' : ''}`} onClick={() => setMode(mode === 'in' ? null : 'in')}>Sign in</button><button className={`btn sm ${mode === 'up' ? 'pri' : ''}`} onClick={() => setMode(mode === 'up' ? null : 'up')}>Create account</button></span>}
      </div>
      {!me && mode && <form className="row wrap mt" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="f">Username<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" maxLength={20} autoFocus /></label>
        <label className="f">Password<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} maxLength={64} /></label>
        <button className="btn pri" type="submit" style={{ alignSelf: 'flex-end' }}>{mode === 'up' ? 'Create account' : 'Sign in'}</button>
        {err && <span className="bad small" role="alert" style={{ alignSelf: 'flex-end' }}>{err}</span>}
      </form>}
      <p className="tiny dim" style={{ marginTop: 8 }}>{me ? 'Your careers are saved to this account automatically after every important action.' : 'Sign in so your careers are saved under your own account and kept apart from anyone else using this device. Guests can still play; guest saves are shared.'} Accounts and saves are stored in this browser on this device — there is no server, so they do not follow you to another device (use Settings → Export for that).</p>
    </section>
  );
}

export function Menu() {
  const { g } = useStore();
  const [saves, setSaves] = useState<SlotMeta[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const reload = () => listSaves().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { reload(); }, []);
  const load = async (slot: string) => {
    try { const lg = await loadGame(slot); setGame(lg); nav(lg.mgr ? 'mhub' : 'hub'); } catch (e) { toast((e as Error).message, true); }
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try { const game = importSave(await f.text()); await saveGame(game, 'auto'); setGame(game); toast('Save imported.'); nav(game.mgr ? 'mhub' : 'hub'); }
    catch (e) { toast((e as Error).message, true); }
    if (file.current) file.current.value = '';
  };
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100%', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ maxWidth: 940, width: '100%' }}>
        <div style={{ marginBottom: 26 }}>
          <div className="num" style={{ fontSize: 'clamp(80px, 17vw, 190px)', lineHeight: 0.82, letterSpacing: '.04em', color: '#fff', textShadow: '0 0 60px rgba(30,167,255,.75), 0 0 140px rgba(11,95,214,.6)', transform: 'skewX(-7deg)' }}>EGO</div>
          <div className="num blue" style={{ fontSize: 'clamp(20px, 3.4vw, 34px)', letterSpacing: '.42em', textTransform: 'uppercase' }}>Beyond Blue Lock</div>
          <p className="muted mt" style={{ maxWidth: 620 }}>A single-player football career. Start in the Neo Egoist League, get valued in yen by the world's clubs, then take the same player into a living professional pyramid for as many seasons as you can last.</p>
        </div>
        <div className="row wrap mb">
          <button className="btn pri big" onClick={() => nav('create')}>New Career</button>
          <button className="btn pri big" onClick={() => nav('mcreate')}>New Manager Career</button>
          {g && <button className="btn big" onClick={() => nav(g.mgr ? 'mhub' : 'hub')}>Resume current</button>}
          <button className="btn big" onClick={() => nav('sim')}>Match simulator</button>
          <button className="btn" onClick={() => file.current?.click()}>Import save (.json)</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} aria-label="Import save file" />
        </div>
        <AccountBox onChange={reload} />
        <section className="card">
          <h3>Save slots{currentUser() && !isAdmin() ? ` — ${currentUser()}` : isAdmin() ? ' — all accounts' : ''}</h3>
          {saves === null ? <p className="muted">Loading…</p> : saves.length === 0 ? <p className="muted">No saves yet. Careers autosave after every important action.</p> : (
            <div className="col gap6">{saves.map((s) => (
              <div key={s.slot} className="row wrap" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                <Ovr v={s.summary.ovr} size="sm" />
                <div className="grow"><b>{s.summary.name}</b> <span className="muted">{s.summary.pos === 'MGR' ? `· ${s.summary.club}` : `· ${s.summary.pos} · age ${s.summary.age} · ${s.summary.club}`}</span><div className="tiny dim">{isAdmin() && <b>{s.owner ?? 'guest'} · </b>}{s.label} · {s.summary.season} · {new Date(s.updated).toLocaleString()}</div></div>
                <Chip k={s.kind === 'auto' ? 'b' : ''}>{s.kind === 'auto' ? 'Autosave' : 'Manual'}</Chip>
                {s.summary.edited && <Chip k="w">Edited</Chip>}
                <button className="btn sm pri" onClick={() => load(s.slot)}>Load</button>
                <ConfirmButton label="Delete" confirm="Really delete?" onConfirm={async () => { await deleteSave(s.slot); reload(); }} />
              </div>
            ))}</div>
          )}
          {storageMode() === 'memory' && <p className="warn small mt">Browser storage is unavailable, so saves live in memory only for this session. Use Settings → Export to keep your career.</p>}
        </section>
        <p className="tiny dim mt"><b>What is simulated:</b> {SUPPORTED} Squads use a 2025/26 baseline written from memory — not live or verified data — and all results are fictional. Fan-made, non-commercial; original artwork only. Runs fully offline.</p>
      </div>
    </div>
  );
}
