import { useState } from 'react';
import type { Game } from '../engine/types';
import { playerAbilityDefs, xpProgress, levelLabel, usesPerMatch, abilityDef, meetsReq, SLOTS, FLOW, egoType, MAX_LEVEL, WEAPONS } from '../engine/abilities';
import { ATTRS } from '../engine/attributes';
import { chooseEvolution, craftHybrid, canHybrid } from '../engine/actions';
import { tryLearn, weaponSlots, ultimateStatus, ULT_NEED, startDeveloping } from '../engine/development';
import { act, toast } from '../store/game';
import { Bar, Card, Chip, Empty, PlayerLink, Tabs } from '../ui/kit';
import { AbilityInfo } from './Creator';
import { UltCutIn } from '../ui/UltCutIn';
import { Replay3D } from '../ui/Replay3D';
import { demoScene } from '../ui/demo3d';
import type { Replay } from '../engine/match/model';

const FINISH_DEMOS: [string, Partial<Replay>][] = [
  ['Top bins', { gy: 0.8, gz: 0.85 }], ['Bicycle kick', { v: 'volley', high: true, d: 11, fr: 10 }], ['Diving header', { v: 'header', high: true, d: 6, gz: 0.3, fr: 10 }], ['Chip', { d: 12, gy: 0.1, gz: 0.6, fr: 10 }], ['Rocket', { v: 'long', d: 26, gy: -0.5, gz: 0.6, fr: 30 }], ['Knuckleball', { v: 'long', d: 28, gy: 0.4, gz: 0.5, fr: 10 }], ['Curler', { v: 'long', d: 23, gy: 0.75, gz: 0.7, fr: 60 }],
  ['Through the legs', { gy: 0.05, gz: 0.1, d: 9 }], ['In off the post', { gy: 0.9, gz: 0.4, d: 14, fr: 10 }], ['Sliding finish', { d: 5, gy: -0.4, gz: 0.2, fr: 10 }], ['Panenka', { v: 'pen', gy: 0.1, gz: 0.7, as: -1, fx: -1 }], ['Free kick', { v: 'fk', d: 24, gy: -0.7, gz: 0.8, as: -1, fx: -1 }], ['Save: low corner', { res: 'save', gy: -0.7, gz: 0.12 }], ['Save: top corner', { res: 'save', gy: 0.72, gz: 0.8 }], ['Save: at the keeper', { res: 'save', gy: 0.1, gz: 0.4 }], ['Back-heel', { d: 7, gy: 0.5, gz: 0.15, fr: 50 }], ['Off the post', { res: 'post', gy: 0.9, gz: 0.5 }], ['Banana shot', { v: 'long', d: 25, gy: 0.8, gz: 0.8, fr: 5 }], ['Top-corner curler', { d: 13, gy: -0.7, gz: 0.5, fr: 30 }], ['Outside of the boot', { d: 12, gy: 0.6, gz: 0.5, fr: 46 }], ['Blocked long shot', { v: 'long', d: 24, res: 'block', blk: 16, fr: 40 }], ['Step-over then finish', { d: 11, gy: -0.6, gz: 0.3, skill: 2, beat: 18, as: -1, fx: -1, fy: -1, fr: 70 }],
];
import { ULTIMATES } from '../engine/abilities';
import type { MatchState } from '../engine/match/model';

export function Weapons({ g }: { g: Game }) {
  const c = g.career;
  const me = g.world.players[c.pid];
  const [prev, setPrev] = useState('');
  const [prevN, setPrevN] = useState(1);
  const [phase, setPhase] = useState(0);
  const [fin, setFin] = useState(-1);
  const abs = playerAbilityDefs(me);
  const [tab, setTab] = useState('mine');
  const [ha, setHa] = useState(''); const [hb, setHb] = useState('');
  const hy = canHybrid(g);
  const et = egoType(c.egoType);
  const slots = weaponSlots(g);
  const ult = ultimateStatus(g);
  const ultDef = abilityDef(ult.id);
  const myWeapons = abs.filter((a) => a.def.kind === 'weapon');
  const free = slots.open - myWeapons.length;
  const learning = Object.entries(c.learning).map(([id, L]) => ({ id, L, d: abilityDef(id) })).filter((x) => x.d && x.d.kind !== 'ultimate' && !me.ab.some((r) => r.id === x.id)).sort((a, b) => b.L.practice - a.L.practice);
  const locked = WEAPONS.filter((w) => !me.ab.some((r) => r.id === w.id));
  return (
    <>
      <div className="pagehead"><div><h1>Weapons & Progression</h1><div className="sub">You carry at most {SLOTS.weapon} weapons in a career and they are permanent once learned — choose what you develop carefully.</div></div>
        <div className="row wrap gap6">{Array.from({ length: SLOTS.weapon }, (_, i) => <Chip key={i} k={i < myWeapons.length ? 'b' : i < slots.open ? 'g' : ''}>{i < myWeapons.length ? myWeapons[i].def.name : i < slots.open ? 'Open slot' : '🔒 Locked'}</Chip>)}</div></div>
      <Tabs tabs={[['mine', 'Your abilities'], ['unlock', `Unlock weapons${free > 0 ? ` (${free} slot free)` : ''}`], ['ult', ult.awake ? 'Ultimate' : 'Ultimate (dormant)'], ['more', 'Flow, hybrids & reactions']]} value={tab} onChange={setTab} />
      {tab === 'mine' && <div className="grid g2">
        {abs.map(({ ref, def }) => { const xp = xpProgress(ref); const evoReady = def.evo && ref.lv >= 3 && !ref.evo; return (
          <Card key={ref.id} className={def.kind === 'ultimate' ? 'hot' : ''} title={<>{def.name}{ref.evo && <span className="blue"> → {def.evo?.find((e) => e.id === ref.evo)?.name}</span>}</>} right={<Chip k={def.kind === 'ultimate' ? 'e' : def.kind === 'weapon' ? 'b' : ''}>{def.kind}</Chip>}>
            <div className="row between small"><b>Level {ref.lv} — {levelLabel(ref.lv)}</b><span className="muted">{ref.lv >= MAX_LEVEL ? 'Max level' : `${Math.round(xp.cur)} / ${xp.need} XP`}</span></div><Bar v={xp.pct} kind="f" tall />
            <p className="tiny muted" style={{ marginTop: 6 }}>{def.kind === 'ultimate' ? `Usable ${usesPerMatch(ref.lv)}× per match, only inside Flow. XP comes from using it.` : def.kind === 'weapon' ? 'XP: triggering it in matches (+8 per use, bonus if you score) and Weapon Practice sessions (+11).' : 'XP: appearances and strong ratings.'}</p>
            <AbilityInfo d={def} />
            {evoReady && <div className="card hot mt"><b className="num gold" style={{ fontSize: 18 }}>Evolution available</b><p className="small muted">Choose one branch. The choice is permanent.</p><div className="grid g2">{def.evo!.map((e) => <button key={e.id} className="opt hot" onClick={() => toast(act((x) => chooseEvolution(x, ref.id, e.id)) ?? '')}><b>{e.name}</b><span className="small">{e.desc}</span></button>)}</div></div>}
            {def.evo && !ref.evo && ref.lv < 3 && <p className="tiny dim">Evolves at level 3: {def.evo.map((e) => e.name).join(' or ')}.</p>}
          </Card>); })}
      </div>}
      {tab === 'unlock' && <>
        <Card title={`Weapon slots: ${myWeapons.length} used · ${slots.open} open · ${SLOTS.weapon} maximum`} className="mb">
          <p className="small">{slots.next}</p>
          <p className="small muted">To unlock a weapon: pick one to develop, then train it with <b>Weapon Practice</b> sessions until practice reaches 100%. You must meet its attribute requirements and have an open slot. Studying a player who already has it (matches together or against, chemistry sessions, asking for advice) raises <b>exposure</b>, which speeds practice up to 1.5×.</p>
        </Card>
        {learning.length > 0 && <Card title="In development" className="mb">{learning.map(({ id, L, d }) => { const req = meetsReq(me.a, d!); const isW = d!.kind === 'weapon'; const full = isW ? free <= 0 : me.ab.filter((r) => abilityDef(r.id)?.kind === 'passive').length >= SLOTS.passive; return (
          <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row between"><b>{d!.name} <span className="muted small">({d!.kind})</span></b>{L.from && g.world.players[L.from] && <span className="small muted">studied from <PlayerLink g={g} id={L.from} /></span>}</div>
            <div className="row small"><span style={{ width: 70 }}>Practice</span><div className="grow"><Bar v={L.practice} kind="g" /></div><b>{Math.round(L.practice)}%</b></div>
            <div className="row small"><span style={{ width: 70 }}>Exposure</span><div className="grow"><Bar v={L.exposure} /></div><b>{Math.round(L.exposure)}%</b></div>
            <div className="row wrap gap6 small">{req.ok ? <Chip k="g">Attributes compatible</Chip> : <Chip k="r">Needs {req.missing.join(', ')}</Chip>}{full && <Chip k="w">No open slot yet</Chip>}{!isW && L.exposure < 100 && <Chip k="w">Passives need 100% exposure</Chip>}
              <button className="btn sm" onClick={() => toast(act((x) => { const i = x.career.plan.findIndex((s) => s.type === 'weapon'); x.career.plan[i >= 0 ? i : 2] = { type: 'weapon', ability: id }; return `Weapon Practice now targets ${d!.name}.`; }) ?? '')}>Practise this</button>
              {L.practice >= 100 && <button className="btn sm pri" onClick={() => { const ok = act((x) => tryLearn(x, id)); toast(ok ? `${d!.name} unlocked!` : 'Requirements not met yet.', !ok); }}>Unlock</button>}</div>
          </div>); })}</Card>}
        <div className="grid gauto">{locked.map((d) => { const req = meetsReq(me.a, d); const dev = !!c.learning[d.id]; return (
          <details key={d.id} className="card" style={{ padding: 10, opacity: req.ok ? 1 : 0.7 }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}><div className="row between"><b className="num" style={{ fontSize: 18 }}>🔒 {d.name}</b><button className="btn sm" disabled={dev} onClick={(e) => { e.preventDefault(); toast(act((x) => startDeveloping(x, d.id)) ?? ''); }}>{dev ? 'Developing' : 'Develop'}</button></div>
              <div className="small muted">{d.desc.slice(0, 100)}{d.desc.length > 100 ? '…' : ''}</div>
              <div className="row wrap gap4 mt"><Chip>{'★'.repeat(Math.round(d.rarity))}</Chip>{req.ok ? <Chip k="g">Requirements met</Chip> : <Chip k="r">Needs {req.missing.join(', ')}</Chip>}<span className="tiny dim">details ▾</span></div></summary>
            <div className="mt"><AbilityInfo d={d} /></div>
          </details>); })}</div>
      </>}
      {tab === 'ult' && <Card title="Ultimate animations" className="mb"><p className="small muted">Every ultimate has its own cut-in when it is unleashed in a match (shooting ultimates also get their own 3D strike effects). Preview them here.</p>
        <div className="row wrap gap6 mb">{ULTIMATES.map((d) => <button key={d.id} className={`btn sm ${prev === d.id ? 'pri' : ''}`} onClick={() => { setPrev(d.id); setPhase(0); setFin(-1); setPrevN((n) => n + 1); }}>{d.name}</button>)}</div>
        {prev && (() => { const d = ULTIMATES.find((x) => x.id === prev)!; const solo = ['zero', 'dag', 'trance', 'sprint', 'charge', 'comet', 'fk', 'crescent'].includes(d.ult ?? ''); const demo = demoScene(me.sn, { ...(solo ? { as: -1, fx: -1, fy: -1 } : {}), ult: d.ult, v: d.ult === 'dag' ? 'dag:volley' : d.ult === 'sky' ? 'header' : d.ult === 'comet' ? 'long' : d.ult === 'fk' ? 'fk' : d.ult === 'charge' ? 'power' : 'placed', high: d.ult === 'sky' || d.ult === 'dag', by: d.ult === 'dag' ? 24 : 52, d: d.ult === 'dag' ? 20 : d.ult === 'zero' ? 21 : d.ult === 'comet' ? 28 : d.ult === 'fk' ? 23 : d.ult === 'crescent' ? 21 : 13 });
          return <div style={{ maxWidth: 760 }}>{phase === 0 && (d.ult === 'curtain' || d.ult === 'dominion') ? <UltCutIn key={prevN} ms={{ pl: [{ nm: me.sn }] } as unknown as MatchState} ev={{ n: prevN, key: d.ult ?? '', name: d.name, idx: 0, t: 0, x: 50, y: 50, min: 67 }} onDone={() => setPrev('')} /> : <Replay3D key={'r' + prevN} ms={demo.ms} rp={demo.rp} g={g} onClose={() => setPrev('')} />}</div>; })()}
        <h4 className="mt">Finishes &amp; celebrations</h4><p className="small muted">A sample of the finish types the 3D view can show (each goal picks one from the situation, then one of seven celebrations).</p>
        <div className="row wrap gap6 mb">{FINISH_DEMOS.map(([label], i) => <button key={label} className={`btn sm ${fin === i ? 'pri' : ''}`} onClick={() => { setFin(i); setPrev(''); setPrevN((n) => n + 1); }}>{label}</button>)}</div>
        {fin >= 0 && !prev && (() => { const demo = demoScene(me.sn, { ...FINISH_DEMOS[fin][1], id: 11 + fin * 3 + prevN }); return <div style={{ maxWidth: 760 }}><Replay3D key={'f' + prevN} ms={demo.ms} rp={demo.rp} g={g} onClose={() => setFin(-1)} /></div>; })()}
      </Card>}
      {tab === 'ult' && <Card title={ultDef ? ultDef.name : 'No ultimate chosen'} className="hot" right={<Chip k={ult.awake ? 'e' : ''}>{ult.awake ? 'Awakened' : 'Dormant'}</Chip>}>
        {ultDef ? <>
          {!ult.awake && <><p>Your ultimate was chosen when you created your player, but it cannot be used yet. It awakens by itself once all three conditions are met:</p>
            {([['A weapon at level ' + ULT_NEED.weaponLv, ult.weaponLv, ULT_NEED.weaponLv], ['Enter Flow in matches', ult.flows, ULT_NEED.flows], ['Career appearances', ult.apps, ULT_NEED.apps]] as const).map(([n, v, need]) => <div key={n} className="row small" style={{ margin: '6px 0' }}><span style={{ width: 190 }}>{v >= need ? '✅' : '⬜'} {n}</span><div className="grow"><Bar v={Math.min(v, need)} max={need} kind={v >= need ? 'g' : 'f'} tall /></div><b style={{ width: 60 }} className="right">{Math.min(v, need)}/{need}</b></div>)}
            <p className="small muted">Progress is checked after every match you play.</p></>}
          <AbilityInfo d={ultDef} /></> : <Empty>No ultimate was selected for this career.</Empty>}
      </Card>}
      {tab === 'more' && <div className="grid g2">
        <Card title="Flow">
          <p className="small"><b className="blue">{et.name}.</b> {et.desc}</p>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>The meter (0–{FLOW.max}) builds from meaningful actions: goals, key passes, beaten defenders, won duels — more against stronger opponents, when trailing and in big matches.</li>
            <li>At {FLOW.max} you can enter Flow: about {Math.round(FLOW.baseDuration / 60)} minutes of playing time with +{FLOW.boost} to {et.boost.map((i) => ATTRS[i].key).join(', ')}. Ultimates are only usable inside Flow and each one burns {FLOW.ultimateShare * 100}% of the time left.</li>
            <li>When it ends you crash (−{FLOW.crashStamina} stamina) and every re-entry in the same match builds {Math.round((1 - FLOW.reentryPenalty) * 100)}% slower.</li>
          </ul>
        </Card>
        <Card title="Hybrid weapons">
          <p className="small muted">Fuse two of your weapons at level 3+ into a hybrid carrying 60% of each parent's effects. It takes one of your four weapon slots.</p>
          {hy.length >= 2 ? <div className="row wrap"><select value={ha} onChange={(e) => setHa(e.target.value)} aria-label="First weapon"><option value="">First weapon…</option>{hy.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><span>×</span><select value={hb} onChange={(e) => setHb(e.target.value)} aria-label="Second weapon"><option value="">Second weapon…</option>{hy.filter((x) => x.id !== ha).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn pri" disabled={!ha || !hb || free <= 0} onClick={() => toast(act((x) => craftHybrid(x, ha, hb)) ?? '')}>Fuse</button></div> : <Empty>You need two weapons at level 3 or higher.</Empty>}
        </Card>
        <Card title="Chemical reactions">
          <p className="small muted">When tactical chemistry with a team-mate reaches 70, your weapons can combine into a named reaction: a special combination option in matches that ends with you facing goal.</p>
          {c.reactions.length ? c.reactions.map((r) => <div key={r.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><div><b className="blue">{r.name}</b> <span className="small muted">with <PlayerLink g={g} id={r.with} full /></span></div><Chip k="b">Lv {r.lv} · used {r.uses}×</Chip></div>) : <Empty>No reactions discovered yet.</Empty>}
        </Card>
      </div>}
    </>
  );
}
