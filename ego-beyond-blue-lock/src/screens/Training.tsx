import type { Game } from '../engine/types';
import { SESSIONS, INTENSITY, weeklyGrowth } from '../engine/development';
import { ATTRS } from '../engine/attributes';
import { abilityDef } from '../engine/abilities';
import { setPlan } from '../engine/actions';
import { userSide } from '../engine/sim';
import { fmtDate, seasonLabel } from '../engine/competitions';
import { teamName } from '../engine/match/setup';
import { NEL_TEAMS } from '../engine/data/clubs';
import { styleAttrs } from '../engine/util';
import { A } from '../engine/attributes';
import { act } from '../store/game';
import { Bar, Card, Chip, Empty } from '../ui/kit';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function Training({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const club = me.club ? w.clubs[me.club] : null;
  const weekStart = w.day - (w.day % 7);
  const mates = club ? club.squad.filter((id) => id !== me.id).map((id) => w.players[id]).filter(Boolean).sort((a, b) => (c.rel[b.id]?.chem ?? 0) - (c.rel[a.id]?.chem ?? 0)) : [];
  const ident = club ? (club.nel ? (NEL_TEAMS.find((t) => t.id === club.id)?.train.map((k) => A[k as keyof typeof A]) ?? []) : styleAttrs(club.style)) : [];
  const load = c.plan.reduce((s, p) => s + Math.max(0, (SESSIONS.find((x) => x.id === p.type)?.fatigue ?? 0)), 0) * INTENSITY[c.intensity].fat;
  const learnable = Object.keys(c.learning).map((id) => abilityDef(id)).filter(Boolean);
  const myWeapons = me.ab.map((r) => abilityDef(r.id)).filter((d) => d && d.kind !== 'passive');
  return (
    <>
      <div className="pagehead"><div><h1>Training Calendar</h1><div className="sub">One session a day. Match days replace the session automatically. The plan repeats every week until you change it.</div></div>
        <div className="row"><span className="small muted">Intensity</span>{INTENSITY.map((it, i) => <button key={i} className={`btn sm ${c.intensity === i ? 'pri' : ''}`} onClick={() => act((x) => { x.career.intensity = i; })} title={`XP ×${it.xp}, fatigue ×${it.fat}`}>{it.name}</button>)}</div></div>
      <div className="grid g4 mb">
        <Card><div className="tiny up muted">Expected growth</div><b className="num" style={{ fontSize: 30 }}>{(weeklyGrowth(g) * INTENSITY[c.intensity].xp).toFixed(1)}</b><div className="small muted">attribute points per week of focused work (age {w.season - me.born}, potential gap {Math.max(0, me.pot - Math.round(me.a.reduce((s) => s, 0) * 0))}, facilities {club?.fac ?? 5}/10, speed ×{g.settings.devSpeed})</div></Card>
        <Card><div className="tiny up muted">Condition</div><b className="num" style={{ fontSize: 30 }}>{Math.round(me.fit)}%</b><Bar v={me.fit} kind={me.fit < 55 ? 'r' : me.fit < 75 ? 'w' : 'g'} /><div className="small muted">Weekly training load {Math.round(load)} · natural recovery ≈ 38/week</div></Card>
        <Card><div className="tiny up muted">{club?.sn ?? 'Club'} training identity</div><div className="row wrap gap4 mt">{ident.map((i) => <Chip key={i} k="b">{ATTRS[i].name}</Chip>)}</div><div className="small muted mt">These attributes gain 25% more from any session that trains them here.</div></Card>
        <Card><div className="tiny up muted">Risk</div><div className="small">{me.inj > 0 ? <b className="bad">Injured: {me.injName} ({me.inj} days). Sessions are replaced by rehab.</b> : me.fit < 55 ? <b className="warn">Tired legs: reduced gains and triple injury risk. Schedule recovery.</b> : 'Normal. Intense work below 60% condition raises injury risk.'}</div></Card>
      </div>
      <div className="grid g2">
        <Card title="This week">
          {DAYS.map((d, i) => { const day = weekStart + i; const fx = (w.sched[day] ?? []).map((id) => w.fixtures[id]).find((f) => f && userSide(g, f)); const s = c.plan[i] ?? { type: 'rest' }; const def = SESSIONS.find((x) => x.id === s.type); const past = day < w.day; return (
            <div key={d} className="row wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: past ? 0.5 : 1 }}>
              <div style={{ width: 96 }}><b className={day === w.day ? 'blue' : ''}>{d}</b><div className="tiny dim">{fmtDate(w, day)}{day === w.day ? ' · today' : ''}</div></div>
              {fx ? <div className="grow"><Chip k="e">Match day</Chip> <span className="small">{teamName(w, fx.h)} v {teamName(w, fx.a)}</span></div> : <>
                <select value={s.type === 'match' ? 'rest' : s.type} onChange={(e) => act((x) => setPlan(x, i, { type: e.target.value, focus: SESSIONS.find((q) => q.id === e.target.value)?.focus ? Object.keys(SESSIONS.find((q) => q.id === e.target.value)!.focus!)[0] : undefined }))} aria-label={`${d} session`}>{SESSIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                {def?.focus && <select value={s.focus} onChange={(e) => act((x) => setPlan(x, i, { ...s, focus: e.target.value }))} aria-label={`${d} focus`}>{Object.entries(def.focus).map(([k, f]) => <option key={k} value={k}>{f.name}</option>)}</select>}
                {s.type === 'chemistry' && <select value={s.partner ?? ''} onChange={(e) => act((x) => setPlan(x, i, { ...s, partner: e.target.value }))} aria-label={`${d} partner`}><option value="">Choose a team-mate…</option>{mates.map((m) => <option key={m.id} value={m.id}>{m.sn} ({m.pos}) · chem {Math.round(c.rel[m.id]?.chem ?? 25)}</option>)}</select>}
                {s.type === 'weapon' && <select value={s.ability ?? ''} onChange={(e) => act((x) => setPlan(x, i, { ...s, ability: e.target.value || undefined }))} aria-label={`${d} ability`}><option value="">Main weapon</option>{myWeapons.map((d2) => <option key={d2!.id} value={d2!.id}>{d2!.name}</option>)}{learnable.map((d2) => <option key={d2!.id} value={d2!.id}>Learn: {d2!.name}</option>)}</select>}
                <span className="tiny muted grow">{def?.desc}</span></>}
            </div>); })}
          <div className="row wrap mt"><span className="small muted">Templates:</span>
            {([['Balanced', ['technical', 'position', 'weapon', 'tactical', 'recovery', 'analysis', 'recovery']], ['Development push', ['technical', 'physical', 'position', 'weapon', 'technical', 'recovery', 'recovery']], ['Match-heavy week', ['recovery', 'tactical', 'recovery', 'position', 'analysis', 'recovery', 'recovery']], ['Win the coach', ['tactical', 'position', 'analysis', 'tactical', 'recovery', 'analysis', 'recovery']]] as const).map(([n, plan]) => <button key={n} className="btn sm" onClick={() => act((x) => { x.career.plan = plan.map((t) => ({ type: t, focus: t === 'technical' ? 'shooting' : t === 'physical' ? 'pace' : undefined })); })}>{n}</button>)}</div>
        </Card>
        <Card title="Recent development">
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>{c.devLog.length ? [...c.devLog].reverse().slice(0, 40).map((d, i) => <div key={i} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><b className={d.delta > 0 ? 'good' : 'bad'}>{ATTRS[d.attr].name} {d.delta > 0 ? '+1' : '−1'} → {d.to}</b> <span className="dim">· {d.date} {seasonLabel(d.s)}</span><div className="muted">{d.why.join(' · ')}</div></div>) : <Empty>No attribute changes yet. Gains arrive point by point, each with its causes listed.</Empty>}</div>
        </Card>
      </div>
    </>
  );
}
