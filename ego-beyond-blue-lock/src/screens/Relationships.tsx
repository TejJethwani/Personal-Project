import { useState } from 'react';
import type { Game, Interaction } from '../engine/types';
import { resolveInteraction, pendingInteractions, SOCIAL_ACTIONS, canAct, doAction, socialLeft, SOCIAL_PER_WEEK } from '../engine/interactions';
import { NATIONS } from '../engine/data/nations';
import { relLabel, personName, MAX_RIVALS } from '../engine/relationships';
import { RivalCard } from '../ui/RivalCard';
import { ovr } from '../engine/attributes';
import { seasonLabel } from '../engine/competitions';
import { act, nav, toast } from '../store/game';
import { Bar, Card, Chip, ClubLink, Empty, PlayerAvatar, PlayerLink, Tabs, Ovr, Modal } from '../ui/kit';

function InteractionCard({ g, it }: { g: Game; it: Interaction }) {
  const p = g.world.players[it.who];
  const toneCls: Record<string, string> = { ego: 'e', humble: 'g', team: 'g', warm: 'g', confident: 'b', tactical: 'b', cold: '', neutral: '' };
  return (
    <div className={`card ${it.done ? '' : 'hot'}`}>
      <div className="row start">
        {p ? <PlayerAvatar g={g} p={p} size={54} /> : <div className="avatar" style={{ width: 54, height: 54, display: 'grid', placeItems: 'center' }}>💬</div>}
        <div className="grow">
          <div className="row between wrap"><b className="num" style={{ fontSize: 19 }}>{it.title}</b><span className="tiny dim">{it.place} · {seasonLabel(it.s)}{!it.done ? ` · expires in ${Math.max(0, it.expires - g.world.abs)}d` : ''}</span></div>
          <div className="small muted">{p ? <PlayerLink g={g} id={p.id} full /> : it.whoName}{g.career.people[it.who] ? ` · ${g.career.people[it.who].role}${g.career.people[it.who].org ? ', ' + g.career.people[it.who].org : ''}` : ''}</div>
          <p style={{ marginTop: 8 }}>{it.body}</p>
          {it.done ? <div className="small"><p><b className="blue">You:</b> {it.done.label}</p><p>{it.done.result}</p><div className="row wrap gap4">{it.done.effects.map((e, i) => <Chip key={i} k={e.includes('−') || e.includes('-') ? 'r' : 'g'}>{e}</Chip>)}</div></div>
            : <div className="col gap6">{it.options.map((o) => <button key={o.id} className="opt" onClick={() => { const r = act((x) => resolveInteraction(x, it.id, o.id)); if (r) toast(r); }}><b style={{ fontSize: 16, textTransform: 'none' }}>{o.label}</b><span className={`chip ${toneCls[o.tone]}`}>{o.tone}</span></button>)}</div>}
        </div>
      </div>
    </div>
  );
}

export function Relationships({ g, tab: initial }: { g: Game; tab?: string }) {
  const [tab, setTab] = useState(initial ?? (pendingInteractions(g).length ? 'inbox' : 'people'));
  const [filter, setFilter] = useState('mates');
  const [target, setTarget] = useState<string | null>(null);
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const pend = pendingInteractions(g);
  const people = Object.entries(c.rel).map(([id, r]) => ({ id, r, p: w.players[id] })).filter((x) => x.p && !x.p.retired);
  const nat = w.nations[me.nat];
  const natIds = new Set<string>([...(nat?.squad?.includes(me.id) ? nat.squad : []), ...(nat?.u20squad?.includes(me.id) ? nat.u20squad : [])]);
  const isNat = (x: { id: string; r: (typeof people)[number]['r']; p: (typeof people)[number]['p'] }) => natIds.has(x.id) || (!!x.r.flags?.nat && x.p.nat === me.nat);
  const natList = people.filter(isNat);
  const list = people.filter((x) => (filter === 'nat' ? isNat(x) : filter === 'mates' ? x.p.club === me.club : filter === 'rivals' || filter === 'h2h' ? c.rivals.includes(x.id) || x.r.rival >= 50 : filter === 'friends' ? x.r.friend >= 45 : x.p.club !== me.club))
    .sort((a, b) => (filter === 'rivals' || filter === 'h2h' ? Number(c.rivals.includes(b.id)) * 100 + b.r.rival - Number(c.rivals.includes(a.id)) * 100 - a.r.rival : b.r.friend + b.r.chem + b.r.resp - (a.r.friend + a.r.chem + a.r.resp))).slice(0, 80);
  const staff = Object.entries(c.rel).filter(([id]) => !w.players[id]).map(([id, r]) => ({ id, r, name: personName(g, id) })).filter((x) => x.name !== 'Unknown');
  const tp = target ? w.players[target] : null;
  return (
    <>
      <div className="pagehead"><div><h1>Relationships</h1><div className="sub">Respect, trust, friendship, rivalry and tactical chemistry are tracked separately. People remember what you did.</div></div><Chip k="b">Social time this week: {socialLeft(g)}/{SOCIAL_PER_WEEK}</Chip></div>
      <Tabs tabs={[['inbox', `Interactions${pend.length ? ` (${pend.length})` : ''}`], ['people', 'People'], ['log', 'History']]} value={tab} onChange={setTab} />
      {tab === 'inbox' && <div className="col">{pend.length ? pend.map((it) => <InteractionCard key={it.id} g={g} it={it} />) : <Empty>No one needs you right now. Conversations appear from what happens: training, matches, travel, transfers, international camps. They expire if ignored.</Empty>}</div>}
      {tab === 'log' && <div className="col">{c.inbox.filter((x) => x.done).reverse().slice(0, 30).map((it) => <InteractionCard key={it.id} g={g} it={it} />)}{!c.inbox.some((x) => x.done) && <Empty>No past conversations yet.</Empty>}</div>}
      {tab === 'people' && <>
        <div className="row wrap mb">{([['mates', 'Club team-mates'], ['nat', `${NATIONS[me.nat]?.name ?? 'National'} team${natList.length ? ` (${natList.length})` : ''}`], ['friends', 'Friends'], ['rivals', 'Rivals'], ['h2h', 'Head to head'], ['others', 'Elsewhere']] as const).map(([k, l]) => <button key={k} className={`btn sm ${filter === k ? 'pri' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {filter === 'h2h' && <><p className="small muted">Your 20 strongest rivalries, highest first, with the full record against each. Declared rivals are capped at {MAX_RIVALS}; rivalries grow from matches where you both decide the game, or you can declare one yourself.</p>{Object.keys(c.rel).filter((id) => w.players[id] && !w.players[id].retired && (c.rivals.includes(id) || c.rel[id].rival > 0)).sort((a, b) => (c.rel[b]?.rival ?? 0) - (c.rel[a]?.rival ?? 0) || Number(c.rivals.includes(b)) - Number(c.rivals.includes(a))).slice(0, 20).map((id) => <RivalCard key={id} g={g} id={id} />)}</>}
        {filter === 'rivals' && <p className="small muted mb">Declared rivals (at most {MAX_RIVALS}) and everyone you have a rivalry of 50+ with. Open Head to head for the full record against each of them.</p>}
        {filter !== 'h2h' && <div className="grid gauto">{list.map(({ id, r, p }) => (
          <div key={id} className="card" style={{ padding: 12 }}>
            <div className="row"><PlayerAvatar g={g} p={p} size={44} /><div className="grow"><PlayerLink g={g} id={id} full /><div className="tiny muted">{p.pos} · {w.season - p.born} · {p.club ? <ClubLink g={g} id={p.club} badge={false} /> : 'unattached'}</div></div><Ovr v={ovr(p)} size="sm" /></div>
            <div className="row wrap gap4" style={{ margin: '6px 0' }}><Chip k={c.rivals.includes(id) ? 'e' : 'g'}>{relLabel(r, c.rivals.includes(id))}</Chip>{c.rivals.includes(id) && <Chip k="e">Declared rival</Chip>}{natIds.has(id) ? <Chip k="b">{nat?.u20squad?.includes(id) && !nat?.squad?.includes(id) ? 'U-20 squad-mate' : 'National squad-mate'}</Chip> : r.flags?.nat && p.nat === me.nat ? <Chip>Former national team-mate</Chip> : null}{p.club !== me.club && r.shared > 0 && <Chip>Ex team-mate</Chip>}{c.reactions.some((x) => x.with === id) && <Chip k="b">Reaction</Chip>}</div>
            {([['Respect', r.resp, ''], ['Trust', r.trust, 'g'], ['Friendship', r.friend, 'w'], ['Rivalry', r.rival, 'e'], ['Chemistry', r.chem, 'f']] as const).map(([n, v, k]) => <div key={n} className="row tiny" style={{ gap: 6 }}><span style={{ width: 62 }} className="muted">{n}</span><div className="grow"><Bar v={v} kind={k} /></div><span style={{ width: 20 }} className="right">{Math.round(v)}</span></div>)}
            {r.mem.length > 0 && <p className="tiny muted" style={{ marginTop: 6 }}>“{r.mem[r.mem.length - 1].txt}”</p>}
            <button className="btn sm mt" style={{ marginTop: 6 }} onClick={() => setTarget(id)}>Interact</button>
          </div>))}</div>}
        {!list.length && <Empty>{filter === 'nat' ? 'You have not been called up yet. Once you join a national squad (U-20 or senior), every squad-mate appears here with your relationship to them.' : 'Nobody in this group yet.'}</Empty>}
        {staff.length > 0 && <Card title="Staff, agent and press" className="mt"><div className="grid g3">{staff.map((s) => <div key={s.id} className="small"><b>{s.name}</b><div className="row tiny gap6"><span style={{ width: 50 }} className="muted">Respect</span><div className="grow"><Bar v={s.r.resp} /></div></div><div className="row tiny gap6"><span style={{ width: 50 }} className="muted">Trust</span><div className="grow"><Bar v={s.r.trust} kind="g" /></div></div></div>)}</div></Card>}
      </>}
      {tp && target && <Modal onClose={() => setTarget(null)}>
        <div className="row"><PlayerAvatar g={g} p={tp} size={60} /><div><h2>{tp.name}</h2><div className="small muted">{relLabel(c.rel[target], c.rivals.includes(target))} · social time left this week: {socialLeft(g)}</div></div></div>
        <div className="col gap6 mt">{SOCIAL_ACTIONS.map((a) => { const err = canAct(g, target, a.id); return <button key={a.id} className="opt" disabled={!!err} style={err ? { opacity: 0.45, cursor: 'not-allowed' } : undefined} onClick={() => { const r = act((x) => doAction(x, target, a.id)); if (r) toast(`${r.text} ${r.effects.join(' · ')}`); setTarget(null); }}><b style={{ fontSize: 16 }}>{a.name}</b><span className="small muted">{err ?? a.desc}</span></button>; })}</div>
        <div className="row mt"><button className="btn ghost" onClick={() => setTarget(null)}>Close</button><button className="btn ghost" onClick={() => { setTarget(null); nav('player', target); }}>View profile</button></div>
      </Modal>}
    </>
  );
}
