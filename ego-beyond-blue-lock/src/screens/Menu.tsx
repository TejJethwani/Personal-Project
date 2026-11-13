import { useEffect, useRef, useState } from 'react';
import { listSaves, loadGame, deleteSave, saveGame, storageMode, type SlotMeta } from '../storage/idb';
import { importSave } from '../engine/save';
import { SUPPORTED } from '../engine/season';
import { nav, setGame, toast, useStore } from '../store/game';
import { Ovr, Chip, ConfirmButton } from '../ui/kit';

export function Menu() {
  const { g } = useStore();
  const [saves, setSaves] = useState<SlotMeta[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const reload = () => listSaves().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { reload(); }, []);
  const load = async (slot: string) => {
    try { setGame(await loadGame(slot)); nav('hub'); } catch (e) { toast((e as Error).message, true); }
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try { const game = importSave(await f.text()); await saveGame(game, 'auto'); setGame(game); toast('Save imported.'); nav('hub'); }
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
          {g && <button className="btn big" onClick={() => nav('hub')}>Resume current</button>}
          <button className="btn" onClick={() => file.current?.click()}>Import save (.json)</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} aria-label="Import save file" />
        </div>
        <section className="card">
          <h3>Save slots</h3>
          {saves === null ? <p className="muted">Loading…</p> : saves.length === 0 ? <p className="muted">No saves yet. Careers autosave after every important action.</p> : (
            <div className="col gap6">{saves.map((s) => (
              <div key={s.slot} className="row wrap" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                <Ovr v={s.summary.ovr} size="sm" />
                <div className="grow"><b>{s.summary.name}</b> <span className="muted">· {s.summary.pos} · age {s.summary.age} · {s.summary.club}</span><div className="tiny dim">{s.label} · {s.summary.season} · {new Date(s.updated).toLocaleString()}</div></div>
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
