/** A searchable gallery of every Blue Lock / NEL character you can play as: portrait, position, rating and team. */
import { useMemo, useState } from 'react';
import { NEL_TEAMS } from '../engine/data/clubs';
import { NEL_BLUELOCK, NEL_YOUTH, type NelRow } from '../engine/data/nel';
import { NATIONS } from '../engine/data/nations';
import { lookOf } from '../engine/data/looks';
import { nationKit } from '../engine/data/kits';
import { Avatar, Modal } from './kit';

export interface CharPick { row: NelRow; team: string }
export function allCharacters(): CharPick[] {
  const out: CharPick[] = [];
  for (const t of NEL_TEAMS) for (const r of [...(NEL_BLUELOCK[t.id] ?? []), ...(NEL_YOUTH[t.id] ?? [])]) out.push({ row: r, team: t.id });
  return out;
}
const POS_GROUP: Record<string, string> = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LM: 'MID', RM: 'MID', LW: 'ATT', RW: 'ATT', SS: 'ATT', ST: 'ATT' };

export function CharacterCard({ c, on, onPick, big }: { c: CharPick; on?: boolean; onPick?: () => void; big?: boolean }) {
  const team = NEL_TEAMS.find((t) => t.id === c.team);
  const look = lookOf({ id: 'char:' + c.row.name, name: c.row.name });
  return (
    <button className={`charcard ${on ? 'on' : ''} ${big ? 'big' : ''}`} onClick={onPick} aria-pressed={on} title={`${c.row.name} — ${c.row.pos}, ${c.row.ovr} OVR`}>
      <div className="cc-face"><Avatar look={look} size={big ? 132 : 92} kitObj={NATIONS[c.row.nat] ? nationKit(c.row.nat) : undefined} /></div>
      <b className="cc-ovr num">{c.row.ovr}</b><span className="cc-pos num">{c.row.pos}</span>
      <div className="cc-name">{c.row.name}</div>
      <div className="cc-team tiny">{team?.name ?? ''} · pot {c.row.pot}{c.row.bl ? ' · Blue Lock' : ''}</div>
    </button>
  );
}

export function CharacterPicker({ value, onPick, onClose }: { value?: string; onPick: (c: CharPick) => void; onClose: () => void }) {
  const all = useMemo(() => allCharacters(), []);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [grp, setGrp] = useState('');
  const [bl, setBl] = useState(true);
  const list = all.filter((c) => (!q || (c.row.name + ' ' + c.row.sn).toLowerCase().includes(q.toLowerCase())) && (!team || c.team === team) && (!grp || POS_GROUP[c.row.pos] === grp) && (!bl || c.row.bl || q))
    .sort((a, b) => b.row.ovr - a.row.ovr);
  return (
    <Modal onClose={onClose} wide>
      <div className="row between wrap"><h2>Play as a Blue Lock character</h2><button className="btn sm ghost" onClick={onClose}>Close</button></div>
      <p className="small muted">Tap a character to take over his career: his attributes, weapons, ultimate, personality and NEL club are used as they are.</p>
      <div className="row wrap gap6 mb">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name — e.g. Isagi, Rin, Nagi" aria-label="Search characters" autoFocus style={{ minWidth: 180 }} />
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team"><option value="">All NEL teams</option>{NEL_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="row wrap gap6 mb">
        {[['', 'All'], ['ATT', 'Attackers'], ['MID', 'Midfielders'], ['DEF', 'Defenders'], ['GK', 'Keepers']].map(([k, l]) => <button key={k} className={`btn sm ${grp === k ? 'pri' : 'ghost'}`} onClick={() => setGrp(k)}>{l}</button>)}
        <label className="row gap6 small" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={bl} onChange={(e) => setBl(e.target.checked)} />Blue Lock players only</label>
      </div>
      <div className="chargrid">
        {list.map((c) => <CharacterCard key={c.row.name} c={c} on={value === c.row.name} onPick={() => onPick(c)} />)}
        {!list.length && <p className="muted">Nobody matches that search.</p>}
      </div>
    </Modal>
  );
}
