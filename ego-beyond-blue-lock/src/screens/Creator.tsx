import { useMemo, useState } from 'react';
import type { CustomAbility, Pos } from '../engine/types';
import { defaultConfig, newGame, validateConfig, balancedAttrs, rebalance, PRESETS, type CareerConfig } from '../engine/career';
import { ATTRS, ATTR_GROUPS, N_OUT, OUTFIELD, POS_NAME, calcOvr, stylesFor, STYLES, bestRoles, POS_WEIGHTS } from '../engine/attributes';
import { WEAPONS, PASSIVES, ULTIMATES, EGO_TYPES, PHILOSOPHIES, PERSONALITIES, BACKSTORIES, MODS, type AbilityDef, type ModKey, BUILDER_BUDGET, customCost, validateCustom, ACT_CTX_FOR, CTX_NAME, customToDef, meetsReq } from '../engine/abilities';
import { NATIONS } from '../engine/data/nations';
import { NEL_TEAMS, STYLES_TAC } from '../engine/data/clubs';
import { NEL_BLUELOCK, NEL_YOUTH, NEL_MASTERS } from '../engine/data/nel';
import { DIFFICULTY, REALISM } from '../engine/match/setup';
import { saveGame } from '../storage/idb';
import { nav, setGame, toast } from '../store/game';
import { Avatar, HAIR_COLS, LOOK_OPTIONS, Bar, Chip, Ovr, Tabs, Modal } from '../ui/kit';
import { LEAGUES } from '../engine/data/clubs';
import { skipNel } from '../engine/sim';
import { defaultLook } from '../engine/career';

const STEPS: [string, string][] = [['id', '1 Identity'], ['team', '2 Team & Start'], ['body', '3 Body & Position'], ['look', '4 Appearance'], ['mind', '5 Ego'], ['ovr', '6 Rating'], ['attr', '7 Attributes'], ['ab', '8 Abilities'], ['rules', '9 Rules']];
const natList = Object.values(NATIONS).sort((a, b) => a.name.localeCompare(b.name));

export function AbilityInfo({ d, compact }: { d: AbilityDef; compact?: boolean }) {
  return (
    <div className="small">
      <p>{d.desc}</p>
      {!compact && <>
        <p><b className="blue">Activation:</b> {d.req}</p>
        {d.fx.length > 0 && <p><b className="blue">Effects:</b> {d.fx.map((f) => `${MODS[f.k].name} +${f.v}${MODS[f.k].unit === 'frac' ? ' (fraction)' : ''} (+${f.per}/level)`).join('; ')}</p>}
        {d.act && <p><b className="blue">Triggered — {d.act.name}:</b> {d.act.desc} {d.act.fx.map((f) => `${MODS[f.k].name} +${f.v}`).join(', ')}.</p>}
        <p><b className="blue">Cost:</b> {d.cost}</p>
        <p><b className="warn">Counterplay:</b> {d.counter}</p>
        <p><b className="warn">Limits:</b> {d.limits}</p>
        {d.evo && <p><b className="blue">Evolves at level 3:</b> {d.evo.map((e) => e.name).join(' or ')}</p>}
      </>}
    </div>
  );
}

export function CustomBuilder({ unrestricted, onDone, onClose }: { unrestricted: boolean; onDone: (c: CustomAbility) => void; onClose: () => void }) {
  const [c, setC] = useState<CustomAbility>({ id: 'custom_' + Date.now().toString(36), kind: 'weapon', name: '', desc: '', fx: [] });
  const cost = c.kind === 'ultimate' ? 0 : customCost(c);
  const errs = validateCustom(c, unrestricted);
  const keys = (Object.keys(MODS) as ModKey[]);
  const setFx = (k: string, v: number) => setC((x) => ({ ...x, fx: v <= 0 ? x.fx.filter((f) => f.k !== k) : x.fx.some((f) => f.k === k) ? x.fx.map((f) => (f.k === k ? { k, v } : f)) : [...x.fx, { k, v }] }));
  return (
    <Modal onClose={onClose} wide>
      <h2>Custom ability builder</h2>
      <p className="muted small">Build an ability from the mechanical effects the match engine supports. {unrestricted ? 'Unrestricted mode: no point budget.' : `Budget: ${BUILDER_BUDGET.weapon} points for a weapon, ${BUILDER_BUDGET.passive} for a passive.`} Counterplay and limitations are generated from the effects you choose.</p>
      <div className="grid g3 mt">
        <label className="f">Type<select value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as CustomAbility['kind'], fx: [], act: undefined })}><option value="weapon">Weapon</option><option value="passive">Passive</option><option value="ultimate">Ultimate (re-skin a base mechanic)</option></select></label>
        <label className="f">Name<input value={c.name} maxLength={32} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="e.g. Phantom Step" /></label>
        <label className="f">Description<input value={c.desc} maxLength={160} onChange={(e) => setC({ ...c, desc: e.target.value })} placeholder="Flavour text" /></label>
      </div>
      {c.kind === 'ultimate' ? (
        <div className="mt"><label className="f">Base mechanic<select value={c.fx[0]?.k ?? ''} onChange={(e) => setC({ ...c, fx: e.target.value ? [{ k: e.target.value, v: 1 }] : [] })}><option value="">Choose…</option>{ULTIMATES.map((u) => <option key={u.id} value={u.ult}>{u.name}</option>)}</select></label>
          {c.fx[0] && <div className="card mt"><AbilityInfo d={ULTIMATES.find((u) => u.ult === c.fx[0].k)!} /></div>}</div>
      ) : (
        <>
          <div className="row between mt"><h4>Effects</h4><span className={`num ${!unrestricted && cost > BUILDER_BUDGET[c.kind] ? 'bad' : 'good'}`}>{cost} {unrestricted ? 'pts' : `/ ${BUILDER_BUDGET[c.kind]} pts`}</span></div>
          <div className="grid g2 mt" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {keys.map((k) => { const m = MODS[k]; const v = c.fx.find((f) => f.k === k)?.v ?? 0; return (
              <div key={k} className="small" title={m.text}><div className="row between"><b>{m.name}</b><span className="num">{v ? `+${v.toFixed(2)}` : '—'}</span></div><input type="range" min={0} max={m.max} step={m.max / 10} value={v} onChange={(e) => setFx(k, +e.target.value)} aria-label={m.name} /><div className="tiny dim">{m.text}</div></div>
            ); })}
          </div>
          {c.kind === 'weapon' && <div className="grid g3 mt">
            <label className="f">Triggered effect (optional)<select value={c.act?.k ?? ''} onChange={(e) => { const k = e.target.value as ModKey; setC({ ...c, act: k ? { k, v: MODS[k].max * 0.6, ctx: ACT_CTX_FOR[k] ?? 'pass_any', sta: 4 } : undefined }); }}><option value="">None</option>{keys.filter((k) => ACT_CTX_FOR[k]).map((k) => <option key={k} value={k}>{MODS[k].name} — {CTX_NAME[ACT_CTX_FOR[k]!]}</option>)}</select></label>
            {c.act && <label className="f">Strength {c.act.v.toFixed(2)}<input type="range" min={MODS[c.act.k as ModKey].max * 0.2} max={MODS[c.act.k as ModKey].max} step={MODS[c.act.k as ModKey].max / 10} value={c.act.v} onChange={(e) => setC({ ...c, act: { ...c.act!, v: +e.target.value } })} /></label>}
            {c.act && <label className="f">Stamina cost {c.act.sta}<input type="range" min={1} max={10} step={1} value={c.act.sta} onChange={(e) => setC({ ...c, act: { ...c.act!, sta: +e.target.value } })} /></label>}
          </div>}
        </>
      )}
      {errs.length > 0 && <ul className="bad small mt">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="row mt"><button className="btn pri" disabled={errs.length > 0} onClick={() => onDone(c)}>Create ability</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

export function Creator() {
  const [cfg, setCfg] = useState<CareerConfig>(() => defaultConfig());
  const [step, setStep] = useState('id');
  const [target, setTarget] = useState(78);
  const [style, setStyle] = useState('poacher');
  const [locked, setLocked] = useState<number[]>([]);
  const [building, setBuilding] = useState(false);
  const [starting, setStarting] = useState(false);
  const up = (p: Partial<CareerConfig>) => setCfg((c) => ({ ...c, ...p }));
  const balanced = cfg.settings.mode === 'balanced';
  const cur = calcOvr(cfg.attrs, cfg.pos);
  const errs = useMemo(() => validateConfig(cfg), [cfg]);
  const allDefs = (kind: string): AbilityDef[] => [...(kind === 'weapon' ? WEAPONS : kind === 'passive' ? PASSIVES : ULTIMATES), ...cfg.custom.filter((c) => c.kind === kind).map(customToDef)];

  const regen = (pos: Pos, t: number, st: string, seed = cfg.seed) => { setLocked([]); return balancedAttrs(pos, t, st, seed); };
  const setPos = (pos: Pos) => { const st = stylesFor(pos).includes(style) ? style : stylesFor(pos)[1] ?? 'balanced'; setStyle(st); up({ pos, pos2: cfg.pos2.filter((x) => x !== pos), attrs: balanced ? regen(pos, target, st) : cfg.attrs }); };
  const setTargetOvr = (t: number) => { t = Math.max(1, Math.min(99, Math.round(t) || 1)); setTarget(t); up({ attrs: regen(cfg.pos, t, style), pot: Math.max(cfg.pot, t) }); };
  const setAttr = (i: number, v: number) => {
    v = Math.max(1, Math.min(99, Math.round(v) || 1));
    const a = cfg.attrs.slice(); a[i] = v;
    if (balanced) { const lk = [...new Set([...locked, i])]; setLocked(lk); up({ attrs: rebalance(a, cfg.pos, target, lk) }); }
    else up({ attrs: a, pot: Math.max(cfg.pot, calcOvr(a, cfg.pos)) });
  };
  const toggle = (key: 'weapons' | 'passives', id: string, max: number) => { const l = cfg[key]; up({ [key]: l.includes(id) ? l.filter((x) => x !== id) : l.length >= max ? [...l.slice(1), id] : [...l, id] } as Partial<CareerConfig>); };
  const start = async () => {
    if (errs.length) { toast(errs[0], true); return; }
    setStarting(true);
    await new Promise((r) => setTimeout(r, 30));
    try { const g = newGame(cfg); if (cfg.skipNel) skipNel(g, cfg.proClub ?? ''); await saveGame(g, 'auto'); setGame(g); nav('hub'); }
    catch (e) { console.error(e); toast('Could not create the career: ' + (e as Error).message, true); setStarting(false); }
  };
  const team = NEL_TEAMS.find((t) => t.id === cfg.nelTeam)!;
  const idx = STEPS.findIndex((s) => s[0] === step);

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}>
      <div className="topbar"><button className="btn sm ghost" onClick={() => nav('menu')}>← Menu</button><h3 className="grow">Create your egoist</h3>
        <span className="row gap6"><Ovr v={cur} /><span className="small muted hide-s">{cfg.name || 'Unnamed'} · {cfg.pos} · {NATIONS[cfg.nat]?.name}</span></span>
        <button className="btn pri" disabled={starting} onClick={start}>{starting ? 'Building world…' : 'Start Career'}</button></div>
      <div className="page" style={{ maxWidth: 1180 }}>
        <Tabs tabs={STEPS} value={step} onChange={setStep} />
        {step === 'id' && <div className="grid g2">
          <section className="card"><h3>Identity</h3><div className="grid g2">
            <label className="f">Name<input value={cfg.name} maxLength={28} onChange={(e) => up({ name: e.target.value })} placeholder="Full name" autoFocus /></label>
            <label className="f">Nickname<input value={cfg.nick} maxLength={20} onChange={(e) => up({ nick: e.target.value })} placeholder="Optional" /></label>
            <label className="f">Nationality<select value={cfg.nat} onChange={(e) => up({ nat: e.target.value })}>{natList.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
            <label className="f">Age ({cfg.age})<input type="range" min={15} max={34} value={cfg.age} onChange={(e) => up({ age: +e.target.value })} /><span className="h">{cfg.age <= 20 ? 'Eligible for the U-20 World Cup selection.' : 'Over the U-20 limit: the selection storyline will not apply.'}</span></label>
          </div>
            <label className="f mt">Also eligible for (choose up to two)<select multiple size={5} value={cfg.nat2} onChange={(e) => up({ nat2: [...e.target.selectedOptions].map((o) => o.value).slice(0, 2) })}>{natList.filter((n) => n.id !== cfg.nat).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select><span className="h">{cfg.nat === 'JPN' || cfg.nat2.includes('JPN') ? 'Japan-eligible: you compete in the Blue Lock ranking for the top-23 selection.' : 'Not Japan-eligible: you are ranked in the overall NEL valuation table; a top-23 finish earns a U-20 call-up from your own nation.'}</span></label>
          </section>
          <section className="card"><h3>Backstory & starting reputation</h3>
            <div className="col gap6">{BACKSTORIES.map((b) => <button key={b.id} className={`opt ${cfg.backstory === b.id ? 'hot' : ''}`} onClick={() => up({ backstory: b.id, rep: b.rep })}><b>{b.name}</b><span className="small muted">{b.desc} Suggested reputation {b.rep}.</span></button>)}</div>
            <label className="f mt">Starting reputation ({cfg.rep}/100)<input type="range" min={0} max={90} value={cfg.rep} onChange={(e) => up({ rep: +e.target.value })} /><span className="h">Reputation affects first impressions, press attention and how clubs weigh you — it does not change your attributes.</span></label>
          </section>
        </div>}
        {step === 'body' && <div className="grid g2">
          <section className="card"><h3>Body</h3><div className="grid g2">
            <label className="f">Height ({cfg.h} cm)<input type="range" min={158} max={204} value={cfg.h} onChange={(e) => up({ h: +e.target.value })} /><span className="h">Taller players gain a small edge in aerial duels.</span></label>
            <label className="f">Weight ({cfg.w} kg)<input type="range" min={52} max={105} value={cfg.w} onChange={(e) => up({ w: +e.target.value })} /></label>
            <label className="f">Preferred foot<select value={cfg.foot} onChange={(e) => up({ foot: e.target.value as CareerConfig['foot'] })}><option value="R">Right</option><option value="L">Left</option><option value="B">Both</option></select></label>
            <label className="f">Shirt number<input type="number" min={1} max={99} value={cfg.num} onChange={(e) => up({ num: Math.max(1, Math.min(99, +e.target.value || 1)) })} /></label>
          </div></section>
          <section className="card"><h3>Position</h3>
            <p className="small muted">Supported: all twelve outfield positions. Goalkeeper careers are not supported (goalkeepers exist in the world with their own attributes).</p>
            <label className="f">Primary position<select value={cfg.pos} onChange={(e) => setPos(e.target.value as Pos)}>{OUTFIELD.map((p) => <option key={p} value={p}>{p} — {POS_NAME[p]}</option>)}</select></label>
            <div className="f mt">Secondary positions<div className="row wrap gap6">{OUTFIELD.filter((p) => p !== cfg.pos).map((p) => <button key={p} className={`btn sm ${cfg.pos2.includes(p) ? 'pri' : 'ghost'}`} onClick={() => up({ pos2: cfg.pos2.includes(p) ? cfg.pos2.filter((x) => x !== p) : [...cfg.pos2, p].slice(-3) })} aria-pressed={cfg.pos2.includes(p)}>{p}</button>)}</div></div>
            <label className="f mt">Playing style (shapes the balanced attribute spread)<select value={style} onChange={(e) => { setStyle(e.target.value); if (balanced) up({ attrs: regen(cfg.pos, target, e.target.value) }); }}>{stylesFor(cfg.pos).map((s) => <option key={s} value={s}>{STYLES[s].name}</option>)}</select></label>
          </section>
        </div>}
        {step === 'look' && <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)' }}>
          <section className="card center"><Avatar look={cfg.look} size={280} kit={'#1ea7ff'} /><div className="row mt" style={{ justifyContent: 'center' }}><button className="btn sm" onClick={() => up({ look: defaultLook(Math.floor(Math.random() * 1e9)) })}>Randomise</button></div><p className="small muted mt">Original layered illustration. Every other player in the world gets a portrait from the same system.</p></section>
          <section className="card"><h3>Appearance</h3><div className="grid g2">
            {LOOK_OPTIONS.map(([k, label, o]) => { const n = Array.isArray(o) ? o.length : o; const v = (cfg.look[k] ?? 0) as number; return (
              <div key={k} className="f"><span>{label}{Array.isArray(o) ? <b className="blue" style={{ textTransform: 'none', letterSpacing: 0 }}> — {o[v % n]}</b> : null}</span>
                <div className="row gap6"><button className="btn sm ghost" aria-label={`Previous ${label}`} onClick={() => up({ look: { ...cfg.look, [k]: (v + n - 1) % n } })}>◀</button><input type="range" min={0} max={n - 1} value={v % n} onChange={(e) => up({ look: { ...cfg.look, [k]: +e.target.value } })} aria-label={label} /><button className="btn sm ghost" aria-label={`Next ${label}`} onClick={() => up({ look: { ...cfg.look, [k]: (v + 1) % n } })}>▶</button></div></div>); })}</div>
            <div className="f mt">Hair colour<div className="row wrap gap6">{HAIR_COLS.map((c, i) => <button key={c} onClick={() => up({ look: { ...cfg.look, hairCol: i } })} aria-label={`Hair colour ${i + 1}`} aria-pressed={cfg.look.hairCol === i} style={{ width: 30, height: 30, background: c, border: cfg.look.hairCol === i ? '2px solid var(--cyan)' : '1px solid var(--line2)', cursor: 'pointer' }} />)}</div></div>
          </section>
        </div>}
        {step === 'mind' && <div className="grid g3">
          <section className="card"><h3>Personality</h3><div className="col gap6">{PERSONALITIES.map((x) => <button key={x.id} className={`opt ${cfg.personality === x.id ? 'hot' : ''}`} onClick={() => up({ personality: x.id })}><b>{x.name}</b><span className="small muted">{x.desc}</span></button>)}</div></section>
          <section className="card"><h3>Ego type (Flow)</h3><div className="col gap6">{EGO_TYPES.map((x) => <button key={x.id} className={`opt ${cfg.egoType === x.id ? 'hot' : ''}`} onClick={() => up({ egoType: x.id })}><b>{x.name}</b><span className="small muted">{x.desc}</span><span className="tiny blue">Flow boosts: {x.boost.map((i) => ATTRS[i].key).join(' ')}</span></button>)}</div></section>
          <section className="card"><h3>Football philosophy</h3><div className="col gap6">{PHILOSOPHIES.map((x) => <button key={x.id} className={`opt ${cfg.philosophy === x.id ? 'hot' : ''}`} onClick={() => up({ philosophy: x.id })}><b>{x.name}</b><span className="small muted">{x.desc}</span></button>)}</div></section>
        </div>}
        {step === 'ovr' && <div className="grid g2">
          <section className="card"><h3>Creation mode</h3>
            <div className="row"><button className={`btn ${balanced ? 'pri' : ''}`} onClick={() => { up({ settings: { ...cfg.settings, mode: 'balanced' }, attrs: regen(cfg.pos, target, style) }); }}>Balanced</button><button className={`btn ${!balanced ? 'pri' : ''}`} onClick={() => up({ settings: { ...cfg.settings, mode: 'unrestricted' } })}>Unrestricted</button></div>
            <p className="small muted mt">{balanced ? 'Balanced: choose any OVR from 1 to 99 and the attributes are distributed to match it for your position. You can still nudge individual attributes — the rest rebalance to keep the same OVR.' : 'Unrestricted: edit every attribute by hand. The OVR shown is always calculated from the attributes with your position\'s weights.'}</p>
            <h4 className="mt">Preset profiles (optional)</h4>
            <div className="col gap6 mt">{PRESETS.map((p) => <button key={p.id} className={`opt ${target === p.ovr && cfg.pot === p.pot ? 'hot' : ''}`} onClick={() => { setTarget(p.ovr); up({ attrs: regen(cfg.pos, p.ovr, style), pot: p.pot, rep: p.rep }); }}><b>{p.name} — {p.ovr} OVR / {p.pot} POT</b><span className="small muted">{p.desc}</span></button>)}</div>
          </section>
          <section className="card"><h3>Rating</h3>
            <div className="row"><Ovr v={cur} size="lg" /><div className="grow">
              <label className="f">Starting overall rating: {balanced ? target : cur}{balanced && <><input type="range" min={1} max={99} value={target} onChange={(e) => setTargetOvr(+e.target.value)} /><input type="number" min={1} max={99} value={target} onChange={(e) => setTargetOvr(+e.target.value)} style={{ width: 90 }} aria-label="Starting OVR" /></>}</label>
              {!balanced && <p className="small muted">Edit attributes on the next tab — the rating follows them.</p>}
            </div></div>
            <p className="small mt">{cur >= 90 ? 'You will be one of the best players in the league from the first whistle. Nothing is scaled against you.' : cur >= 80 ? 'A probable starter and a genuine threat.' : cur >= 72 ? 'A squad player who can earn a place.' : 'You will start on the bench and must earn every minute.'} <span className="muted">A high rating really is strong: opponents are never secretly scaled to cancel it. Difficulty changes opponent decision-making, forgiveness and management pressure only.</span></p>
            <label className="f mt">Potential ceiling: {cfg.pot}<input type="range" min={cur} max={99} value={Math.max(cfg.pot, cur)} onChange={(e) => up({ pot: +e.target.value })} /></label>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.dynamicPot} onChange={(e) => up({ settings: { ...cfg.settings, dynamicPot: e.target.checked } })} /><span><b>Dynamic potential</b> <span className="small muted">— the ceiling can rise with sustained excellent seasons (and reaching it) or fall after lost seasons.</span></span></label>
            <h4 className="mt">Best roles for this sheet</h4>
            <div className="row wrap gap6 mt">{bestRoles(cfg.attrs, false).slice(0, 5).map((r) => <Chip key={r.pos} k={r.pos === cfg.pos ? 'b' : ''}>{r.pos} {r.ovr}</Chip>)}</div>
          </section>
        </div>}
        {step === 'attr' && <section className="card">
          <div className="row between wrap"><h3>Attributes</h3><div className="row"><span className="muted small">Calculated OVR at {cfg.pos}</span><Ovr v={cur} />{balanced && <><span className="small muted">target {target}</span><button className="btn sm" onClick={() => up({ seed: cfg.seed + 1, attrs: regen(cfg.pos, target, style, cfg.seed + 1) })}>Re-roll spread</button>{locked.length > 0 && <button className="btn sm ghost" onClick={() => { setLocked([]); up({ attrs: regen(cfg.pos, target, style) }); }}>Clear {locked.length} locks</button>}</>}</div></div>
          <p className="small muted">{balanced ? 'Change any value and it is locked (🔒); the other attributes rebalance so the OVR stays at your target.' : 'Free editing. Attributes highlighted in blue carry weight in your position\'s OVR.'}</p>
          <div className="grid g3 mt">{ATTR_GROUPS.map((gname) => <div key={gname}><h4>{gname}</h4>{ATTRS.map((a, i) => (a.group !== gname || i >= N_OUT ? null : (
            <div key={a.key} className="row gap6" style={{ margin: '5px 0' }} title={a.desc}>
              <span className={`grow small ${POS_WEIGHTS[cfg.pos][i] > 0.03 ? 'blue' : ''}`}>{a.name}{locked.includes(i) ? ' 🔒' : ''}</span>
              <button className="btn sm ghost" onClick={() => setAttr(i, cfg.attrs[i] - 1)} aria-label={`Decrease ${a.name}`}>−</button>
              <input type="number" min={1} max={99} value={cfg.attrs[i]} onChange={(e) => setAttr(i, +e.target.value)} style={{ width: 58, textAlign: 'center' }} aria-label={a.name} />
              <button className="btn sm ghost" onClick={() => setAttr(i, cfg.attrs[i] + 1)} aria-label={`Increase ${a.name}`}>+</button>
            </div>)))}</div>)}</div>
        </section>}
        {step === 'ab' && <div className="col">
          <div className="row between wrap"><p className="muted small grow">You start with <b>one weapon</b>. A player can only ever hold <b>four</b>, and the other three must be unlocked during your career by developing them in training — once learned they are permanent, so there is no swapping later. Your <b>ultimate is dormant</b>: it awakens only after you have a level-3 weapon, have entered Flow five times and made twelve appearances. Pick up to 3 passives.</p><button className="btn" onClick={() => setBuilding(true)}>+ Custom ability builder</button></div>
          {(['weapon', 'passive', 'ultimate'] as const).map((kind) => (
            <section key={kind} className="card"><h3>{kind === 'weapon' ? 'Starting weapon (choose one)' : kind === 'passive' ? `Passives (${cfg.passives.length}/3)` : 'Destined ultimate (dormant at the start)'}</h3>
              <div className="grid gauto">{allDefs(kind).map((d) => { const on = kind === 'weapon' ? cfg.weapons.includes(d.id) : kind === 'passive' ? cfg.passives.includes(d.id) : cfg.ultimate === d.id; const req = meetsReq(cfg.attrs, d); return (
                <details key={d.id} className={`card ${on ? 'hot' : ''}`} style={{ padding: 10 }}>
                  <summary style={{ cursor: 'pointer', listStyle: 'none' }}><div className="row between"><b className="num" style={{ fontSize: 18 }}>{d.name}{kind === 'weapon' && cfg.weapons[0] === d.id ? ' ★' : ''}</b><button className={`btn sm ${on ? 'pri' : ''}`} onClick={(e) => { e.preventDefault(); if (kind === 'weapon') up({ weapons: [d.id] }); else if (kind === 'passive') toggle('passives', d.id, 3); else up({ ultimate: on ? '' : d.id }); }}>{on ? 'Selected' : 'Select'}</button></div>
                    <div className="small muted">{d.desc.slice(0, 96)}{d.desc.length > 96 ? '…' : ''}</div>
                    <div className="row wrap gap4 mt">{d.custom && <Chip k="e">Custom</Chip>}<Chip>{'★'.repeat(Math.round(d.rarity))} rarity</Chip>{!req.ok && <Chip k="w" title={`Suggested: ${req.missing.join(', ')}`}>Low fit</Chip>}<span className="tiny dim">details ▾</span></div></summary>
                  <div className="mt"><AbilityInfo d={d} /></div>
                </details>); })}</div>
            </section>
          ))}
          {building && <CustomBuilder unrestricted={!balanced} onClose={() => setBuilding(false)} onDone={(c) => { up({ custom: [...cfg.custom, c] }); setBuilding(false); toast(`${c.name} created — select it below.`); }} />}
        </div>}
        {step === 'team' && <>
          <div className="row wrap mb"><button className={`btn big ${!cfg.skipNel ? 'pri' : ''}`} onClick={() => up({ skipNel: false })}>Start in the Neo Egoist League</button><button className={`btn big ${cfg.skipNel ? 'pri' : ''}`} onClick={() => up({ skipNel: true })}>Skip the NEL — straight to professional football</button></div>
          {cfg.skipNel ? <div className="grid g2">
            <section className="card"><h3>Choose your first professional club</h3>
              <p className="small muted">The NEL still takes place without you (results, bids and the Blue Lock players' signings all happen), then you join your club for the {2025}/26 season under regulation rules. There is no yen bid or top-23 selection for you.</p>
              <button className={`opt ${!cfg.proClub ? 'hot' : ''}`} onClick={() => up({ proClub: '' })}><b>Let the game place me</b><span className="small muted">A club at your level where you should play regularly.</span></button>
              {LEAGUES.map((L) => <details key={L.id} style={{ marginTop: 8 }} open={!!cfg.proClub?.startsWith(L.id)}><summary className="num" style={{ cursor: 'pointer', fontSize: 18 }}>{L.name}</summary><div className="grid g2" style={{ gap: 6, marginTop: 6 }}>
                {L.rows.trim().split('\n').map((r) => { const [short, name, , , rep] = r.split('|'); const id = `${L.id}_${short}`; const lvl = Math.round(38 + +rep * 0.5); const d = cur - lvl; return <button key={id} className={`opt ${cfg.proClub === id ? 'hot' : ''}`} style={{ padding: '6px 10px' }} onClick={() => up({ proClub: id })}><b style={{ fontSize: 15 }}>{name}</b><span className="tiny muted">squad level {lvl} · {d >= 4 ? 'you would be a star' : d >= -1 ? 'likely starter' : d >= -5 ? 'rotation' : 'fringe / development'}</span></button>; })}</div></details>)}
            </section>
            <section className="card"><h3>What skipping means</h3><ul className="small"><li>No NEL matches, bids, rankings or U-20 World Cup for you.</li><li>Your starting weapon, passives and dormant ultimate are unchanged.</li><li>You begin with no relationships: the Blue Lock cast will be opponents or team-mates you meet as a professional.</li><li>Your squad role depends on your OVR against the club's squad: {cur} OVR.</li></ul></section>
          </div> : <div className="grid g2">
          <div className="col">{NEL_TEAMS.map((t) => { const m = NEL_MASTERS[t.id]; const sq = [...(NEL_BLUELOCK[t.id] ?? []), ...(NEL_YOUTH[t.id] ?? [])]; const rivals = sq.filter((p) => p.pos === cfg.pos || p.pos2.includes(cfg.pos)).sort((a, b) => b.ovr - a.ovr); return (
            <button key={t.id} className={`opt ${cfg.nelTeam === t.id ? 'hot' : ''}`} onClick={() => up({ nelTeam: t.id })}><b>{t.name} <span className="muted" style={{ fontSize: 14 }}>· {NATIONS[t.nat].name} · master striker {m.name}</span></b>
              <span className="small">{t.identity}</span><br />
              <span className="tiny blue">Tactics: {STYLES_TAC[t.style].name} ({STYLES_TAC[t.style].form[0]}) · training favours {t.train.join(', ')}</span><br />
              <span className="tiny muted">Competition at {cfg.pos}: {rivals.length ? rivals.slice(0, 3).map((p) => `${p.sn} ${p.ovr}`).join(', ') : 'nobody established'} — you are {cur}.</span></button>); })}</div>
          <section className="card"><h3>{team.name}</h3><p className="small muted">Listed squad (editable in <code>src/engine/data/nel.ts</code>; confidence labels shown — "original" players are fictional and not canon). Squads are topped up to 20.</p>
            <div className="tw" style={{ maxHeight: 460, overflowY: 'auto' }}><table><thead><tr><th>Player</th><th>Pos</th><th className="n">OVR</th><th className="n">POT</th><th>Source</th></tr></thead><tbody>
              {[...(NEL_BLUELOCK[team.id] ?? []), ...(NEL_YOUTH[team.id] ?? [])].sort((a, b) => b.ovr - a.ovr).map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.pos}</td><td className="n num">{p.ovr}</td><td className="n">{p.pot}</td><td><Chip k={p.canon === 'canon' ? 'b' : p.canon === 'original' ? '' : 'w'}>{p.canon}</Chip></td></tr>)}
            </tbody></table></div></section>
        </div>}
        </>}
        {step === 'rules' && <div className="grid g2">
          <section className="card"><h3>Difficulty & world</h3>
            <label className="f">Difficulty<select value={cfg.settings.difficulty} onChange={(e) => up({ settings: { ...cfg.settings, difficulty: +e.target.value } })}>{DIFFICULTY.map((d, i) => <option key={i} value={i}>{d.name}</option>)}</select><span className="h">{DIFFICULTY[cfg.settings.difficulty].desc} Attributes are never scaled.</span></label>
            <div className="grid g2 mt">
              <label className="f">Injury frequency<select value={cfg.settings.injuries} onChange={(e) => up({ settings: { ...cfg.settings, injuries: +e.target.value } })}>{['Off', 'Low', 'Normal', 'High'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
              <label className="f">Development speed<select value={cfg.settings.devSpeed} onChange={(e) => up({ settings: { ...cfg.settings, devSpeed: +e.target.value } })}>{[0.5, 1, 1.5, 2, 3].map((n) => <option key={n} value={n}>×{n}</option>)}</select></label>
              <label className="f">Realism level<select value={cfg.settings.realism} onChange={(e) => up({ settings: { ...cfg.settings, realism: +e.target.value } })}>{REALISM.map((r, i) => <option key={i} value={i}>{r.name} (abilities ×{r.scale})</option>)}</select></label>
              <label className="f">Match interaction frequency<select value={cfg.settings.freq} onChange={(e) => up({ settings: { ...cfg.settings, freq: +e.target.value } })}><option value={0}>Low — decisive moments only</option><option value={1}>Standard</option><option value={2}>High — every involvement</option></select></label>
            </div>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.canonChange} onChange={(e) => up({ settings: { ...cfg.settings, canonChange: e.target.checked } })} /><span><b>Canonical outcomes may change</b> <span className="small muted">— on (default): everything is simulated. Off: NEL results listed as canon in the roster file are steered toward their canonical winner when your team is not involved.</span></span></label>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.showProb} onChange={(e) => up({ settings: { ...cfg.settings, showProb: e.target.checked } })} /><span><b>Show numerical probabilities</b> <span className="small muted">— advanced: display success percentages next to the qualitative risk labels.</span></span></label>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.autoFlow} onChange={(e) => up({ settings: { ...cfg.settings, autoFlow: e.target.checked } })} /><span><b>Enter Flow automatically</b> <span className="small muted">— otherwise you choose the moment.</span></span></label>
          </section>
          <section className="card"><h3>NEL rules (defaults are the recognisable format)</h3>
            <div className="grid g2">
              <label className="f">Goals to win ({cfg.settings.nel.goalTarget})<input type="range" min={1} max={5} value={cfg.settings.nel.goalTarget} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, goalTarget: +e.target.value } } })} /></label>
              <label className="f">Substitutions ({cfg.settings.nel.subs})<input type="range" min={0} max={7} value={cfg.settings.nel.subs} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, subs: +e.target.value } } })} /></label>
              <label className="f">Star Change length ({cfg.settings.nel.starSec}s of playing time)<input type="range" min={60} max={600} step={30} value={cfg.settings.nel.starSec} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, starSec: +e.target.value } } })} /></label>
              <label className="f">Selection size (top {cfg.settings.nel.topN})<input type="range" min={11} max={30} value={cfg.settings.nel.topN} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, topN: +e.target.value } } })} /></label>
            </div>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.nel.starChange} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, starChange: e.target.checked } } })} /><span>Star Change system (master strikers may play for a limited time)</span></label>
            <label className="row mt"><input type="checkbox" checked={cfg.settings.nel.offside} onChange={(e) => up({ settings: { ...cfg.settings, nel: { ...cfg.settings.nel, offside: e.target.checked } } })} /><span>Offsides</span></label>
            <p className="small muted mt">Five teams, each plays the other four once: ten matches over five rounds, two matches and one resting team per round. No 90-minute ending — first to the goal target wins.</p>
            <label className="f mt">World seed<input type="number" value={cfg.seed} onChange={(e) => up({ seed: Math.abs(Math.floor(+e.target.value)) || 1 })} /><span className="h">The same seed and the same choices always produce the same world.</span></label>
          </section>
        </div>}
        <div className="row between mt">
          <button className="btn" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1][0])}>← Back</button>
          {errs.length > 0 && <span className="bad small">{errs[0]}</span>}
          {idx < STEPS.length - 1 ? <button className="btn pri" onClick={() => setStep(STEPS[idx + 1][0])}>Next →</button> : <button className="btn pri big" disabled={starting} onClick={start}>{starting ? 'Building world…' : 'Start Career'}</button>}
        </div>
        <div className="mt"><Bar v={idx + 1} max={STEPS.length} /></div>
      </div>
    </div>
  );
}
