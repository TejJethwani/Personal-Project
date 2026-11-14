import { useRef, useState } from 'react';
import type { Game } from '../engine/types';
import { exportSave, importSave, summarize } from '../engine/save';
import { saveGame } from '../storage/idb';
import { DIFFICULTY, REALISM } from '../engine/match/setup';
import { ATTRS, ATTR_GROUPS, N_OUT, calcOvr } from '../engine/attributes';
import { sandboxEdit, retire } from '../engine/actions';
import { SUPPORTED } from '../engine/season';
import { act, nav, setGame, toast } from '../store/game';
import { Card, Chip, Ovr, ConfirmButton } from '../ui/kit';

export function Settings({ g }: { g: Game }) {
  const s = g.settings;
  const me = g.world.players[g.career.pid];
  const file = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<number[] | null>(null);
  const [pot, setPot] = useState(me.pot);
  const set = (p: Partial<Game['settings']>) => act((x) => { Object.assign(x.settings, p); });
  const doExport = () => {
    const text = exportSave(g);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `ego-${summarize(g).name.replace(/\W+/g, '-').toLowerCase()}-${g.world.season}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { /* downloads can be blocked in embedded views */ }
    // embedded viewers block downloads, so the save is also copied to the clipboard
    navigator.clipboard?.writeText(text).then(() => toast('Save exported (also copied to the clipboard — paste it into a .json file if no download started).'), () => toast('Save exported as a download. If nothing downloaded, this viewer blocks downloads: open the game in a normal browser tab to export.'));
  };
  return (
    <>
      <div className="pagehead"><div><h1>Settings</h1><div className="sub">Changes apply immediately and are stored in the save.</div></div>{g.edited && <Chip k="w">This save is marked as edited</Chip>}</div>
      <div className="grid g2">
        <Card title="Saves">
          <p className="small muted">The career autosaves after every important action and at decision points inside interactive matches. Manual saves are separate slots you can load from the main menu.</p>
          <div className="row wrap"><button className="btn pri" onClick={async () => { await saveGame(g, 'manual', `Manual — ${new Date().toLocaleString()}`); toast('Manual save created.'); }}>Create manual save</button><button className="btn" onClick={doExport}>Export save (.json)</button><button className="btn" onClick={() => file.current?.click()}>Import save</button><button className="btn ghost" onClick={() => nav('menu')}>Main menu</button></div>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import save file" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const game = importSave(await f.text()); await saveGame(game, 'auto'); setGame(game); toast('Save imported.'); nav('hub'); } catch (err) { toast((err as Error).message, true); } e.target.value = ''; }} />
        </Card>
        <Card title="Match & interface">
          <div className="grid g2">
            <label className="f">Match interaction frequency<select value={s.freq} onChange={(e) => set({ freq: +e.target.value })}><option value={0}>Low — decisive moments only</option><option value={1}>Standard</option><option value={2}>High — every involvement</option></select></label>
            <label className="f">Default match speed<select value={s.matchSpeed} onChange={(e) => set({ matchSpeed: +e.target.value })}>{[1, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
          </div>
          <label className="row mt"><input type="checkbox" checked={s.showProb} onChange={(e) => set({ showProb: e.target.checked })} /><span>Show numerical probabilities on match choices (advanced)</span></label>
          <label className="row mt"><input type="checkbox" checked={s.touch !== false} onChange={(e) => set({ touch: e.target.checked })} /><span>Touch controls: tap team-mates and swipe runs directly on the pitch</span></label>
          <label className="row mt"><input type="checkbox" checked={s.autoFlow} onChange={(e) => set({ autoFlow: e.target.checked })} /><span>Enter Flow automatically when the meter fills</span></label>
          <label className="row mt"><input type="checkbox" checked={s.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} /><span>Reduce motion (also follows your system setting)</span></label>
        </Card>
        <Card title="Difficulty & simulation">
          <label className="f">Difficulty<select value={s.difficulty} onChange={(e) => set({ difficulty: +e.target.value })}>{DIFFICULTY.map((d, i) => <option key={i} value={i}>{d.name}</option>)}</select><span className="h">{DIFFICULTY[s.difficulty].desc} Attributes are never scaled against you.</span></label>
          <div className="grid g2 mt">
            <label className="f">Injury frequency<select value={s.injuries} onChange={(e) => set({ injuries: +e.target.value })}>{['Off', 'Low', 'Normal', 'High'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
            <label className="f">Development speed<select value={s.devSpeed} onChange={(e) => set({ devSpeed: +e.target.value })}>{[0.5, 1, 1.5, 2, 3].map((n) => <option key={n} value={n}>×{n}</option>)}</select></label>
            <label className="f">Realism level<select value={s.realism} onChange={(e) => set({ realism: +e.target.value })}>{REALISM.map((r, i) => <option key={i} value={i}>{r.name} (abilities ×{r.scale})</option>)}</select></label>
          </div>
          <label className="row mt"><input type="checkbox" checked={s.dynamicPot} onChange={(e) => set({ dynamicPot: e.target.checked })} /><span>Dynamic potential</span></label>
          <label className="row mt"><input type="checkbox" checked={s.canonChange} onChange={(e) => set({ canonChange: e.target.checked })} /><span>Canonical outcomes may change (NEL)</span></label>
          <p className="tiny dim mt">NEL rules in this save: first to {s.nel.goalTarget}, {s.nel.subs} substitutions, Star Change {s.nel.starChange ? `${s.nel.starSec}s` : 'off'}, offsides {s.nel.offside ? 'on' : 'off'}, top {s.nel.topN} selected.</p>
        </Card>
        <Card title="About this world">
          <p className="small">{g.world.baseline}</p><p className="small"><b>Simulated:</b> {SUPPORTED}</p>
          <p className="small muted">Not simulated: other countries' leagues, lower tiers outside England, reserve leagues and international qualifying. Clubs relegated out of the simulated pyramid are replaced by clubs from the division below and can return. World seed {g.world.seed}; {Object.keys(g.world.players).length} players tracked.</p>
          <div className="mt"><ConfirmButton className="btn danger" label="Retire from football" confirm="Confirm retirement (ends the playable career)" disabled={me.retired != null} onConfirm={() => { act((x) => retire(x)); nav('hof'); }} /></div>
        </Card>
      </div>
      <Card title="Sandbox editor" className="mt" right={<Chip k="w">Marks the save as edited</Chip>}>
        <p className="small muted">Freely change your attributes and potential at any time. The save is visibly flagged as edited from then on. Your OVR is always recalculated from the attributes.</p>
        {!edit ? <button className="btn" onClick={() => { setEdit(me.a.slice()); setPot(me.pot); }}>Open sandbox editor</button> : <>
          <div className="row"><span className="small muted">Resulting OVR</span><Ovr v={calcOvr(edit, me.pos)} /><label className="f">Potential<input type="number" min={1} max={99} value={pot} onChange={(e) => setPot(Math.max(1, Math.min(99, +e.target.value || 1)))} style={{ width: 80 }} /></label></div>
          <div className="grid g3 mt">{ATTR_GROUPS.map((gn) => <div key={gn}><h4>{gn}</h4>{ATTRS.map((a, i) => (a.group !== gn || i >= N_OUT ? null : <label key={a.key} className="row small" style={{ margin: '3px 0' }}><span className="grow">{a.name}</span><input type="number" min={1} max={99} value={edit[i]} onChange={(e) => { const n = edit.slice(); n[i] = Math.max(1, Math.min(99, +e.target.value || 1)); setEdit(n); }} style={{ width: 64 }} /></label>))}</div>)}</div>
          <div className="row mt"><button className="btn pri" onClick={() => { act((x) => sandboxEdit(x, { attrs: edit, pot })); setEdit(null); toast('Sandbox changes applied. Save marked as edited.'); }}>Apply</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div></>}
      </Card>
    </>
  );
}
