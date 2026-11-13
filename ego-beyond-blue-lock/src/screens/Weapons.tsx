import { useState } from 'react';
import type { Game } from '../engine/types';
import { playerAbilityDefs, xpProgress, levelLabel, usesPerMatch, abilityDef, meetsReq, SLOTS, FLOW, egoType, MAX_LEVEL } from '../engine/abilities';
import { ATTRS } from '../engine/attributes';
import { chooseEvolution, craftHybrid, canHybrid, sandboxAddAbility } from '../engine/actions';
import { tryLearn } from '../engine/development';
import { act, toast } from '../store/game';
import { Bar, Card, Chip, Empty, PlayerLink } from '../ui/kit';
import { AbilityInfo, CustomBuilder } from './Creator';

export function Weapons({ g }: { g: Game }) {
  const c = g.career;
  const me = g.world.players[c.pid];
  const abs = playerAbilityDefs(me);
  const [ha, setHa] = useState(''); const [hb, setHb] = useState('');
  const [building, setBuilding] = useState(false);
  const hy = canHybrid(g);
  const et = egoType(c.egoType);
  const learning = Object.entries(c.learning).map(([id, L]) => ({ id, L, d: abilityDef(id) })).filter((x) => x.d).sort((a, b) => b.L.exposure + b.L.practice - (a.L.exposure + a.L.practice));
  return (
    <>
      <div className="pagehead"><div><h1>Weapons & Progression</h1><div className="sub">{abs.filter((a) => a.def.kind === 'weapon').length}/{SLOTS.weapon} weapons · {abs.filter((a) => a.def.kind === 'passive').length}/{SLOTS.passive} passives · {abs.filter((a) => a.def.kind === 'ultimate').length}/{SLOTS.ultimate} ultimate</div></div>
        <button className="btn" onClick={() => setBuilding(true)} title="Adds a custom ability and marks this save as edited">Sandbox: custom ability</button></div>
      <div className="grid g2">
        {abs.map(({ ref, def }) => { const xp = xpProgress(ref); const evoReady = def.evo && ref.lv >= 3 && !ref.evo; return (
          <Card key={ref.id} className={def.kind === 'ultimate' ? 'hot' : ''} title={<>{def.name}{ref.evo && <span className="blue"> → {def.evo?.find((e) => e.id === ref.evo)?.name}</span>}</>} right={<Chip k={def.kind === 'ultimate' ? 'e' : def.kind === 'weapon' ? 'b' : ''}>{def.kind}</Chip>}>
            <div className="row between small"><b>Level {ref.lv} — {levelLabel(ref.lv)}</b><span className="muted">{ref.lv >= MAX_LEVEL ? 'Max level' : `${Math.round(xp.cur)} / ${xp.need} XP`}</span></div><Bar v={xp.pct} kind="f" tall />
            <p className="tiny muted" style={{ marginTop: 6 }}>{def.kind === 'ultimate' ? `Usable ${usesPerMatch(ref.lv)}× per match, only inside Flow. XP comes from using it.` : def.kind === 'weapon' ? 'XP: triggering it in matches (+8 per use, bonus if you score) and Weapon Practice sessions (+11).' : 'XP: appearances and strong ratings.'}</p>
            <AbilityInfo d={def} />
            {evoReady && <div className="card hot mt"><b className="num gold" style={{ fontSize: 18 }}>Evolution available</b><p className="small muted">Choose one branch. The choice is permanent.</p><div className="grid g2">{def.evo!.map((e) => <button key={e.id} className="opt hot" onClick={() => toast(act((x) => chooseEvolution(x, ref.id, e.id)) ?? '')}><b>{e.name}</b><span className="small">{e.desc}</span></button>)}</div></div>}
            {def.evo && !ref.evo && ref.lv < 3 && <p className="tiny dim">Evolves at level 3: {def.evo.map((e) => e.name).join(' or ')}.</p>}
          </Card>); })}
      </div>
      <div className="grid g2 mt">
        <Card title="Flow">
          <p className="small"><b className="blue">{et.name}.</b> {et.desc}</p>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>The meter (0–{FLOW.max}) builds from meaningful actions: goals, key passes, beaten defenders, won duels — more against stronger opponents, when trailing and in big matches.</li>
            <li>At {FLOW.max} you can enter Flow: about {Math.round(FLOW.baseDuration / 60)} minutes of playing time with +{FLOW.boost} to {et.boost.map((i) => ATTRS[i].key).join(', ')}. Ultimates are only usable inside Flow and each one burns {FLOW.ultimateShare * 100}% of the time left.</li>
            <li>When it ends you crash (−{FLOW.crashStamina} stamina) and every re-entry in the same match builds {Math.round((1 - FLOW.reentryPenalty) * 100)}% slower. It cannot be sustained indefinitely.</li>
          </ul>
        </Card>
        <Card title="Hybrid weapons">
          <p className="small muted">Fuse two of your weapons at level 3+ into a hybrid carrying 60% of each parent's effects. It occupies a weapon slot.</p>
          {hy.length >= 2 ? <div className="row wrap"><select value={ha} onChange={(e) => setHa(e.target.value)} aria-label="First weapon"><option value="">First weapon…</option>{hy.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><span>×</span><select value={hb} onChange={(e) => setHb(e.target.value)} aria-label="Second weapon"><option value="">Second weapon…</option>{hy.filter((x) => x.id !== ha).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn pri" disabled={!ha || !hb} onClick={() => toast(act((x) => craftHybrid(x, ha, hb)) ?? '')}>Fuse</button></div> : <Empty>You need two weapons at level 3 or higher.</Empty>}
        </Card>
        <Card title="Learning from others">
          <p className="small muted">Seeing a move once is not mastery. You need <b>exposure</b> (watching it in matches, training with its owner, asking for advice), <b>practice</b> (Weapon Practice sessions aimed at it) and compatible attributes.</p>
          {learning.length ? learning.map(({ id, L, d }) => { const req = meetsReq(me.a, d!); const full = me.ab.filter((r) => abilityDef(r.id)?.kind === d!.kind).length >= SLOTS[d!.kind]; return (
            <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row between"><b>{d!.name} <span className="muted small">({d!.kind})</span></b>{L.from && g.world.players[L.from] && <span className="small muted">from <PlayerLink g={g} id={L.from} /></span>}</div>
              <div className="row small"><span style={{ width: 70 }}>Exposure</span><div className="grow"><Bar v={L.exposure} /></div><b>{Math.round(L.exposure)}%</b></div>
              <div className="row small"><span style={{ width: 70 }}>Practice</span><div className="grow"><Bar v={L.practice} kind="g" /></div><b>{Math.round(L.practice)}%</b></div>
              <div className="row wrap gap6 small">{req.ok ? <Chip k="g">Attributes compatible</Chip> : <Chip k="r">Needs {req.missing.join(', ')}</Chip>}{full && <Chip k="w">No free {d!.kind} slot</Chip>}
                <button className="btn sm" onClick={() => act((x) => { const i = x.career.plan.findIndex((s) => s.type === 'weapon'); if (i >= 0) x.career.plan[i] = { type: 'weapon', ability: id }; else x.career.plan[2] = { type: 'weapon', ability: id }; toast(`Weapon Practice now targets ${d!.name}.`); })}>Practise this</button>
                {L.exposure >= 100 && L.practice >= 100 && <button className="btn sm pri" onClick={() => { const ok = act((x) => tryLearn(x, id)); toast(ok ? `${d!.name} learned!` : 'Requirements not met yet.', !ok); }}>Learn</button>}</div>
            </div>); }) : <Empty>Nothing studied yet. Play with and against players who have weapons.</Empty>}
        </Card>
        <Card title="Chemical reactions">
          <p className="small muted">When tactical chemistry with a team-mate reaches 70, your weapons can combine into a named reaction: a special combination option in matches that ends with you facing goal.</p>
          {c.reactions.length ? c.reactions.map((r) => <div key={r.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><div><b className="blue">{r.name}</b> <span className="small muted">with <PlayerLink g={g} id={r.with} full /></span></div><Chip k="b">Lv {r.lv} · used {r.uses}×</Chip></div>) : <Empty>No reactions discovered yet.</Empty>}
        </Card>
      </div>
      {building && <CustomBuilder unrestricted onClose={() => setBuilding(false)} onDone={(cu) => { toast(act((x) => sandboxAddAbility(x, cu)) ?? ''); setBuilding(false); }} />}
    </>
  );
}
