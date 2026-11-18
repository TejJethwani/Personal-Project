/** "Simulate several years": the setup panel (years and stop conditions) and the report shown when it ends. */
import { useState } from 'react';
import type { Game } from '../engine/types';
import { DEFAULT_LONGSIM, type LongSimOpts } from '../engine/longsim';
import { ovr } from '../engine/attributes';
import { simYears, longReport, clearLongReport } from './flow';
import { Modal } from './kit';

const KEY = 'ego:longsim';
function loadOpts(): LongSimOpts { try { const s = localStorage.getItem(KEY); if (s) return { ...DEFAULT_LONGSIM, ...JSON.parse(s) }; } catch { /* storage blocked */ } return { ...DEFAULT_LONGSIM }; }
function saveOpts(o: LongSimOpts): void { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage blocked */ } }

export function LongSimModal({ g, onClose }: { g: Game; onClose: () => void }) {
  const [o, setO] = useState<LongSimOpts>(loadOpts);
  const mgr = !!g.mgr;
  const up = (p: Partial<LongSimOpts>) => setO((x) => ({ ...x, ...p }));
  const me = g.world.players[g.career.pid];
  const Opt = ({ k, label, hint }: { k: keyof LongSimOpts; label: string; hint?: string }) => (
    <label className="ls-opt"><input type="checkbox" checked={!!o[k]} onChange={(e) => up({ [k]: e.target.checked } as Partial<LongSimOpts>)} /><span><b>{label}</b>{hint && <span className="tiny muted">{hint}</span>}</span></label>
  );
  return (
    <Modal onClose={onClose}>
      <h2>Simulate several years</h2>
      <p className="small muted">Every match in the world is played with the full engine, so allow roughly a minute per season. You can stop at any time; progress is saved at the start of each season.</p>
      <div className="ls-years">
        <input type="range" min={1} max={25} value={o.years} onChange={(e) => up({ years: +e.target.value })} aria-label="Years" />
        <b className="num">{o.years} year{o.years === 1 ? '' : 's'}</b>
      </div>
      <div className="row wrap gap4 mb">{[1, 2, 3, 5, 10, 15, 20, 25].map((n) => <button key={n} className={`btn sm ${o.years === n ? 'pri' : 'ghost'}`} onClick={() => up({ years: n })}>{n}</button>)}</div>
      <h4>Stop when…</h4>
      <div className="ls-grid">
        <Opt k="trophy" label="I win a trophy" />
        {!mgr && <Opt k="bdo" label="I win the Ballon d'Or" />}
        <Opt k="bigOffer" label={mgr ? 'A big club wants me as manager' : 'A big club makes me an offer'} hint="reputation 88+" />
        {!mgr && <Opt k="injury" label="I get a long injury" hint="four weeks or more" />}
        {mgr && <Opt k="board" label="Board confidence drops below 25%" />}
        {mgr && <Opt k="bids" label="A club bids for one of my players" />}
        <Opt k="seasonEnd" label="Each new season starts" />
        <Opt k="ceremonies" label="An awards ceremony or the Ballon d'Or gala is on" hint="otherwise they are skipped (results are kept)" />
        {!mgr && <label className="ls-opt"><input type="checkbox" checked={o.ovrTarget > 0} onChange={(e) => up({ ovrTarget: e.target.checked ? Math.min(99, ovr(me) + 3) : 0 })} /><span><b>My OVR reaches</b>{o.ovrTarget > 0 && <input type="number" min={1} max={99} value={o.ovrTarget} onChange={(e) => up({ ovrTarget: Math.max(1, Math.min(99, +e.target.value || 0)) })} style={{ width: 64, marginLeft: 6 }} aria-label="Target OVR" />}<span className="tiny muted">now {ovr(me)}</span></span></label>}
      </div>
      <h4 className="mt">Decide for me</h4>
      <div className="ls-grid">
        <Opt k="autoClub" label={mgr ? 'Take the best job if I am sacked' : 'Pick the best club when I must move'} hint="otherwise the simulation stops so you can choose" />
        {!mgr && <Opt k="autoRenew" label="Accept new contracts from my club" />}
      </div>
      <div className="row gap6 mt"><button className="btn pri big" onClick={() => { saveOpts(o); onClose(); simYears(o); }}>▶ Simulate {o.years} year{o.years === 1 ? '' : 's'}</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

export function LongSimReportModal() {
  const r = longReport;
  if (!r) return null;
  return (
    <Modal onClose={clearLongReport}>
      <h2>Simulation finished</h2>
      <p className="small muted">{r.from} → {r.to} · {r.days} days</p>
      {r.stopped && <p className="warn"><b>Stopped:</b> {r.stopped}</p>}
      <ul className="small" style={{ paddingLeft: 18 }}>{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <button className="btn pri" onClick={clearLongReport}>Continue</button>
    </Modal>
  );
}
