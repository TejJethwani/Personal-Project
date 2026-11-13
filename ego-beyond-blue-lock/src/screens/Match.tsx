import { useEffect, useRef, useState } from 'react';
import type { Game } from '../engine/types';
import { startUserMatch, finishUserMatch, userFixtureToday, nextUserFixture, userSide } from '../engine/sim';
import { advance as advMatch, ratingOf } from '../engine/match/engine';
import { clockLabel } from '../engine/match/rules';
import { S, type MatchState, type MPlayer, type Option } from '../engine/match/model';
import { teamName, teamInfo, pickSheet, importance } from '../engine/match/setup';
import { FLOW, abilityDef } from '../engine/abilities';
import { fmtDate } from '../engine/competitions';
import { ovr } from '../engine/attributes';
import { act, autosave, moment, nav, refresh, toast } from '../store/game';
import { continueGame } from '../ui/flow';
import { Bar, Card, Chip, ClubBadge, Empty, PlayerLink, Rating, Tabs, Ovr } from '../ui/kit';

let lastDone: { ms: MatchState; notes: string[] } | null = null;

function Pitch({ ms }: { ms: MatchState }) {
  const u = ms.uc?.idx ?? -1;
  return (
    <div className="pitchwrap"><svg className="pitch" viewBox="-2 -2 109 72" role="img" aria-label={`Pitch view. ${ms.teams[0].name} attack right, ${ms.teams[1].name} attack left.`}>
      <defs><pattern id="grass" width="10.5" height="68" patternUnits="userSpaceOnUse"><rect width="5.25" height="68" fill="#0b3a1c" /><rect x="5.25" width="5.25" height="68" fill="#0d4421" /></pattern></defs>
      <rect x="0" y="0" width="105" height="68" fill="url(#grass)" />
      <g fill="none" stroke="#cfe9d6" strokeOpacity=".55" strokeWidth=".35">
        <rect x="0" y="0" width="105" height="68" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" />
        <rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" /><rect x="0" y="24.84" width="5.5" height="18.32" /><rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <rect x="-1.6" y="30.34" width="1.6" height="7.32" /><rect x="105" y="30.34" width="1.6" height="7.32" />
      </g>
      {ms.pl.map((p, i) => (p.on ? (
        <g key={p.id} className="pl" style={{ transform: `translate(${p.x * 1.05}px, ${p.y * 0.68}px)` }}>
          {i === u && <circle r="3.1" fill="none" stroke="#3df2ff" strokeWidth=".5" />}
          {p.flEnd > ms.play && <circle r="3.6" fill="none" stroke="#b47bff" strokeWidth=".35" strokeDasharray="1 .8" />}
          {i === ms.car && <circle r="2.6" fill="none" stroke="#fff" strokeWidth=".3" />}
          <circle r="1.9" fill={ms.teams[p.t].col} stroke={p.star ? '#ffd166' : ms.teams[p.t].col2} strokeWidth={p.star ? 0.6 : 0.4} />
          <text y=".75" textAnchor="middle" fontSize="1.9" fontWeight="700" fill={p.t === 0 ? ms.teams[0].col2 : ms.teams[1].col2} style={{ paintOrder: 'stroke', stroke: ms.teams[p.t].col, strokeWidth: 0.3 }}>{p.num || ''}</text>
          {(i === u || i === ms.car) && <text y="-2.9" textAnchor="middle" fontSize="2" fill="#fff" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.5 }}>{p.nm}</text>}
        </g>) : null))}
      <g className="ball" style={{ transform: `translate(${ms.bx * 1.05}px, ${ms.by * 0.68}px)` }}><circle r="1" fill="#fff" stroke="#111" strokeWidth=".25" /></g>
    </svg></div>
  );
}

function Hud({ ms }: { ms: MatchState }) {
  const u = ms.uc!;
  const me = ms.pl[u.idx];
  const inFlow = me.flEnd > ms.play;
  const live = me.used ? ratingOf(me, ms.score[me.t], ms.score[1 - me.t], 0) : 0;
  return (
    <div className={`card ${inFlow ? 'flowon' : ''}`}>
      <div className="row between"><b className="num" style={{ fontSize: 20 }}>{me.nm} <span className="muted" style={{ fontSize: 14 }}>{me.pos}</span></b>{me.on ? <span className="row gap6">{inFlow && <Chip k="e">FLOW {Math.max(0, Math.ceil(me.flEnd - ms.play))}s</Chip>}<span className="small muted">Rating</span><Rating v={live} /></span> : <Chip k="w">{me.used ? 'Off the pitch' : 'On the bench'}</Chip>}</div>
      <div className="row small mt" style={{ marginTop: 6 }}><span style={{ width: 62 }}>Stamina</span><div className="grow"><Bar v={me.st} kind={me.st < 40 ? 'r' : me.st < 65 ? 'w' : 'g'} /></div><b style={{ width: 30 }} className="right">{Math.round(me.st)}</b></div>
      <div className="row small"><span style={{ width: 62 }}>Flow</span><div className="grow"><Bar v={inFlow ? ((me.flEnd - ms.play) / FLOW.baseDuration) * 100 : me.fl} kind="f" /></div><b style={{ width: 30 }} className="right">{inFlow ? 'ON' : Math.round(me.fl)}</b></div>
      <div className="row wrap gap4" style={{ marginTop: 6 }}>
        <Chip>{me.s[S.G]}G {me.s[S.A]}A</Chip><Chip>{me.s[S.SH]} shots · xG {me.s[S.XG].toFixed(2)}</Chip><Chip>{me.s[S.PC]}/{me.s[S.PA]} passes</Chip><Chip>{me.s[S.DC]}/{me.s[S.DA]} dribbles</Chip><Chip>{me.s[S.TKW] + me.s[S.INT]} def</Chip>
        {me.yc > 0 && <Chip k="y">Booked</Chip>}{u.dominion > ms.play && <Chip k="e">Field Dominion</Chip>}{u.combo >= 0 && ms.pl[u.combo]?.on && <Chip k="b">Combo: {ms.pl[u.combo].nm}</Chip>}{me.rival || ms.pl.some((p) => p.rival && p.on) ? <Chip k="e">Rival on the pitch</Chip> : null}
      </div>
    </div>
  );
}

function Decision({ ms, onPick }: { ms: MatchState; onPick: (id: string) => void }) {
  const d = ms.pending!;
  const showP = !!ms.uc?.showP || (ms.uc?.dominion ?? 0) > ms.play;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const n = +e.key; if (n >= 1 && n <= d.options.length) { e.preventDefault(); onPick(d.options[n - 1].id); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const riskCls = (r: string) => (r === 'Safe' ? 'g' : r === 'Moderate' ? 'b' : r === 'Risky' ? 'w' : 'r');
  return (
    <div className="card hot" aria-live="polite">
      <div className="row between wrap"><h3 style={{ margin: 0 }}>{d.title}</h3><span className="small muted">{d.ctx}</span></div>
      <div className="grid g2 mt" style={{ gap: 8, marginTop: 10 }}>
        {d.options.slice(0, 12).map((o: Option, i) => (
          <button key={o.id} className={`opt ${o.hot ? 'hot' : ''}`} onClick={() => onPick(o.id)}>
            {i < 9 && <kbd>{i + 1}</kbd>}
            <b>{o.label}</b>
            <span className="small muted">{o.detail}</span>
            <span className="row wrap gap4" style={{ marginTop: 4 }}>
              <span className={`chip ${riskCls(o.risk)}`}>{o.risk}</span><span className="chip">{o.intent}</span>
              {o.ab && <span className="chip e">{abilityDef(o.ab)?.name ?? 'Ability'}{o.sta ? ` · −${o.sta} sta` : ''}</span>}
              {showP && o.kind !== 'meta' && <span className="chip b">{Math.round(o.p * 100)}%</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTable({ ms }: { ms: MatchState }) {
  const sum = (t: number, i: number) => ms.pl.filter((p) => p.t === t && p.used).reduce((s, p) => s + p.s[i], 0);
  const rows: [string, (t: number) => string | number][] = [
    ['Shots (on target)', (t) => `${sum(t, S.SH)} (${sum(t, S.SOT)})`], ['Expected goals', (t) => sum(t, S.XG).toFixed(2)], ['Passes (completed)', (t) => `${sum(t, S.PA)} (${sum(t, S.PC)})`],
    ['Pass accuracy', (t) => (sum(t, S.PA) ? Math.round((sum(t, S.PC) / sum(t, S.PA)) * 100) + '%' : '—')], ['Dribbles won', (t) => `${sum(t, S.DC)}/${sum(t, S.DA)}`], ['Tackles won', (t) => sum(t, S.TKW)], ['Interceptions', (t) => sum(t, S.INT)],
    ['Fouls', (t) => sum(t, S.FC)], ['Offsides', (t) => sum(t, S.OFF)], ['Yellow / red', (t) => `${sum(t, S.YC)} / ${sum(t, S.RC)}`], ['Saves', (t) => sum(t, S.SV)],
  ];
  const poss = [0, 1].map((t) => sum(t, S.PA)); const tp = poss[0] + poss[1] || 1;
  return <table><tbody><tr><td className="n num">{Math.round((poss[0] / tp) * 100)}%</td><td className="center muted">Possession (by passes)</td><td className="num">{Math.round((poss[1] / tp) * 100)}%</td></tr>{rows.map(([n, f]) => <tr key={n}><td className="n num">{f(0)}</td><td className="center muted">{n}</td><td className="num">{f(1)}</td></tr>)}</tbody></table>;
}

function Ratings({ g, ms }: { g: Game; ms: MatchState }) {
  return <div className="grid g2">{[0, 1].map((t) => <div key={t}><h4>{ms.teams[t].name}</h4><table><thead><tr><th>Player</th><th>Pos</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">Rat</th></tr></thead><tbody>
    {ms.pl.filter((p) => p.t === t && p.used).sort((a, b) => (b.s[S.RAT] || 0) - (a.s[S.RAT] || 0)).map((p: MPlayer) => <tr key={p.id} className={p.user ? 'me' : ''}><td><PlayerLink g={g} id={p.id} />{p.s[S.POTM] ? ' ⭐' : ''}{p.star ? ' ★' : ''}{p.yc ? ' 🟨' : ''}{p.rc ? ' 🟥' : ''}</td><td>{p.pos}</td><td className="n">{Math.round((ms.rules.kind === 'nel' ? p.s[S.PLAY] : p.s[S.SEC]) / 60)}</td><td className="n">{p.s[S.G] || ''}</td><td className="n">{p.s[S.A] || ''}</td><td className="n"><Rating v={p.s[S.RATN] ? p.s[S.RAT] : 0} /></td></tr>)}
  </tbody></table></div>)}</div>;
}

function PreMatch({ g }: { g: Game }) {
  const w = g.world;
  const fx = userFixtureToday(g)!;
  const side = userSide(g, fx)!;
  const opp = fx.h === side ? fx.a : fx.h;
  const comp = w.comps[fx.comp];
  const me = w.players[g.career.pid];
  const u20 = !!comp?.u20;
  const mySheet = pickSheet(g, w, teamInfo(w, side, u20), 0, comp?.rules === 'nel' ? 12 : 9);
  const oppInfo = teamInfo(w, opp, u20);
  const oppSheet = pickSheet(null, w, oppInfo);
  const sel = mySheet.userScore;
  const start = (mode: 'full' | 'key' | 'sim') => {
    lastDone = null;
    const ms = act((x) => startUserMatch(x, mode), false);
    if (!ms) return;
    if (mode === 'sim') { advMatch(ms); const notes = act((x) => finishUserMatch(x, ms)) ?? []; lastDone = { ms, notes }; refresh(); }
    else { advMatch(ms, undefined, 1); refresh(); autosave(); }
  };
  const known = oppSheet.xi.map((x) => w.players[x.pid]).filter((p) => p && g.career.rel[p.id] && (g.career.rel[p.id].mem.length || g.career.rivals.includes(p.id)));
  return (
    <>
      <div className="hero mb"><div className="score">
        <div className="row" style={{ justifyContent: 'flex-end' }}><span className="tn">{teamName(w, fx.h)}</span><ClubBadge g={g} id={fx.h} lg /></div>
        <div className="center"><div className="tiny up blue">{comp?.name}{fx.stg ? ` · ${fx.stg}` : ` · Round ${fx.rd}`}</div><div className="num" style={{ fontSize: 34 }}>VS</div><div className="small muted">{fmtDate(w, fx.day, true)}</div></div>
        <div className="row"><ClubBadge g={g} id={fx.a} lg /><span className="tn">{teamName(w, fx.a)}</span></div>
      </div>
        <p className="center small muted mt">{comp?.rules === 'nel' ? `NEL rules: first to ${g.settings.nel.goalTarget} goals wins. No full-time whistle. The clock shows actual playing time.${g.settings.nel.starChange ? ` Each master striker may play for ${g.settings.nel.starSec / 60} minutes via Star Change.` : ''}` : `Regulation rules: 90 minutes plus stoppage time${fx.ko ? '; extra time and penalties if level' : ''}.`} Importance {Math.round(importance(w, fx) * 100)}%.</p>
      </div>
      <div className="grid g3 mb">
        <Card title="Your selection" className={sel?.started ? 'hot' : ''}>
          {sel ? <><b className={`num ${sel.started ? 'good' : sel.inSquad ? 'warn' : 'bad'}`} style={{ fontSize: 24 }}>{sel.started ? 'You start' : sel.inSquad ? 'On the bench' : 'Not in the squad'}</b>
            <ul className="small" style={{ paddingLeft: 18 }}>{sel.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="small muted">Coach's selection score: you {sel.score} · rivals {sel.rivals.map((r) => `${r.name} ${r.score}`).join(', ') || '—'}</p></> : <Empty>—</Empty>}
        </Card>
        <Card title={`${teamName(w, side)} — ${mySheet.form}`}><div className="small">{mySheet.xi.map((x) => { const p = w.players[x.pid]; return <div key={x.pid} className="row between" style={{ padding: '1px 0' }}><span><span className="dim">{x.pos}</span> {p.id === me.id ? <b className="blue">{p.sn} ★</b> : p.sn}</span><span className="num">{ovr(p)}</span></div>; })}</div></Card>
        <Card title={`${teamName(w, opp)} — ${oppSheet.form}`}><div className="small">{oppSheet.xi.map((x) => { const p = w.players[x.pid]; return <div key={x.pid} className="row between" style={{ padding: '1px 0' }}><span><span className="dim">{x.pos}</span> <PlayerLink g={g} id={p.id} />{g.career.rivals.includes(p.id) ? ' ⚔' : ''}</span><span className="num">{ovr(p)}</span></div>; })}</div>
          {known.length > 0 && <p className="small warn mt">You have history with: {known.map((p) => p.sn).join(', ')}.</p>}</Card>
      </div>
      <Card title="How do you want to play it?">
        <div className="grid g3">
          <button className="opt hot" onClick={() => start('full')}><b>Full interactive</b><span className="small muted">Watch every phase and make every decision your interaction-frequency setting allows — on the ball, off it and in defence.</span></button>
          <button className="opt" onClick={() => start('key')}><b>Key highlights</b><span className="small muted">Jump between decisive moments only: chances, final-third involvement, last-ditch defending.</span></button>
          <button className="opt" onClick={() => start('sim')}><b>Quick simulation</b><span className="small muted">Instant result. Your player is controlled by the same AI as everyone else, with your attributes and abilities.</span></button>
        </div>
        <p className="tiny dim mt">All three modes run the same simulation engine and produce the same kinds of statistics. You can change mode during the match.</p>
      </Card>
    </>
  );
}

function Live({ g, ms }: { g: Game; ms: MatchState }) {
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState('feed');
  const [, force] = useState(0);
  const seen = useRef(ms.ev.length);
  const dec = useRef(0);
  const u = ms.uc!;
  const speed = g.settings.matchSpeed;
  const me = ms.pl[u.idx];
  const tick = () => {
    // look for moments among the new events
    for (let i = seen.current; i < ms.ev.length; i++) {
      const e = ms.ev[i];
      if (e.k === 'goal') moment('GOAL', `${ms.teams[0].abbr} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].abbr}`);
      else if (e.k === 'flow' && e.p === u.idx) moment('FLOW', 'You are in the zone', 'flow');
      else if (e.k === 'star_on') moment('STAR CHANGE', ms.pl[e.p]?.nm);
    }
    seen.current = ms.ev.length;
    force((x) => x + 1);
  };
  const finish = () => { const notes = act((x) => finishUserMatch(x, ms)) ?? []; lastDone = { ms, notes }; autosave(true); refresh(); };
  useEffect(() => {
    if (ms.done) { finish(); return; }
    if (paused || ms.pending) return;
    const key = u.mode === 'key' || !me.on;
    const delay = key ? 140 : speed >= 4 ? 90 : speed >= 2 ? 260 : 620;
    const t = setTimeout(() => {
      const before = ms.ev.length;
      if (key) { for (let k = 0; k < 40 && !ms.done && !ms.pending; k++) { advMatch(ms, undefined, 1); if (ms.ev.slice(before).some((e) => e.i >= 2)) break; } }
      else advMatch(ms, undefined, 1);
      tick();
    }, delay);
    return () => clearTimeout(t);
  });
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.code === 'Space' && !ms.pending) { e.preventDefault(); setPaused((p) => !p); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [ms]);
  const pick = (id: string) => { advMatch(ms, id, 1); if (++dec.current % 4 === 0) autosave(); tick(); };
  const simEnd = () => { u.mode = 'sim'; if (ms.pending) advMatch(ms, ms.pending.options[0].id); else advMatch(ms); tick(); };
  const nel = ms.rules.kind === 'nel';
  const events = ms.ev.filter((e) => e.x && (u.mode === 'key' ? e.i >= 1 : true)).slice(-70).reverse();
  return (
    <>
      <div className="card mb"><div className="score">
        <div className="row" style={{ justifyContent: 'flex-end' }}><span className="tn">{ms.teams[0].name}</span><ClubBadge g={g} id={ms.teams[0].id} lg /></div>
        <div className="center"><div className="sc">{ms.score[0]} – {ms.score[1]}</div>
          <div className="num blue" style={{ fontSize: 20 }}>{nel ? `PLAYING TIME ${clockLabel('nel', ms.clock, 1)}` : clockLabel('reg', ms.clock, ms.period)} <span className="muted" style={{ fontSize: 13 }}>{ms.phase}</span></div>
          {nel && <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 4 }}>{[0, 1].map((t) => <div key={t} className="pips" aria-label={`${ms.teams[t].name}: ${ms.score[t]} of ${ms.rules.goalTarget} goals`}>{Array.from({ length: ms.rules.goalTarget }, (_, i) => <i key={i} className={i < ms.score[t] ? 'on' : ''} />)}</div>)}</div>}
        </div>
        <div className="row"><ClubBadge g={g} id={ms.teams[1].id} lg /><span className="tn">{ms.teams[1].name}</span></div>
      </div>
        <div className="row wrap between mt small">
          <span className="muted">{ms.poss === 0 ? ms.teams[0].name : ms.teams[1].name} in possession · {ms.restart ? 'dead ball' : ms.car >= 0 ? `${ms.pl[ms.car].nm} on the ball` : 'loose ball'}{ms.teams.map((T, t) => (T.starState === 1 ? <Chip key={t} k="y"> ★ {ms.pl[T.star].nm} {Math.max(0, Math.ceil(T.starEnd - ms.play))}s left</Chip> : null))}</span>
          <span className="row wrap gap6">
            <button className="btn sm" onClick={() => setPaused((p) => !p)} disabled={!!ms.pending}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
            {[1, 2, 4].map((s) => <button key={s} className={`btn sm ${speed === s ? 'pri' : ''}`} onClick={() => act((x) => { x.settings.matchSpeed = s; }, false)}>{s}×</button>)}
            <button className={`btn sm ${u.mode === 'full' ? 'pri' : ''}`} onClick={() => { u.mode = 'full'; refresh(); }}>Full</button>
            <button className={`btn sm ${u.mode === 'key' ? 'pri' : ''}`} onClick={() => { u.mode = 'key'; refresh(); }}>Highlights</button>
            <button className="btn sm" onClick={simEnd}>Sim to end</button>
          </span>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div className="col">
          <Pitch ms={ms} />
          {ms.pending ? <Decision ms={ms} onPick={pick} /> : <div className="card small muted">{me.on ? (u.mode === 'key' ? 'Highlights mode: skipping to the next key moment…' : 'Play continues. You will be asked when you are involved. (Space = pause, 1–9 = choose)') : me.used ? 'You have been substituted. Watching from the touchline — use "Sim to end" to skip.' : 'You are on the bench. The coach may bring you on — or use "Sim to end".'}</div>}
        </div>
        <div className="col">
          <Hud ms={ms} />
          <div className="card">
            <h4>Your instructions</h4>
            <div className="grid g3 mt" style={{ gap: 8, marginTop: 6 }}>
              {([['stance', 'Positioning', ['Deep', 'Balanced', 'Advanced']], ['press', 'Pressing', ['Conserve', 'Normal', 'Aggressive']], ['risk', 'Frequency', ['Low', 'Standard', 'High']]] as const).map(([k, label, opts]) => (
                <label key={k} className="f">{label}<select value={k === 'risk' ? (u.thr >= 70 ? 0 : u.thr >= 45 ? 1 : 2) : u.instr[k]} onChange={(e) => { const v = +e.target.value; if (k === 'risk') u.thr = [72, 50, 30][v]; else u.instr[k] = v; refresh(); }}>{opts.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>
              ))}
            </div>
            <p className="tiny dim" style={{ marginTop: 6 }}>Coach: {ms.teams[me.t].form}, press {Math.round(ms.teams[me.t].tac.press * 100)}%, line {Math.round(ms.teams[me.t].tac.line * 100)}%, {ms.teams[me.t].tac.direct > 0.6 ? 'direct' : 'patient'} build-up. Following the plan raises coach trust.</p>
          </div>
          <div className="card"><Tabs tabs={[['feed', 'Commentary'], ['stats', 'Match stats']]} value={tab} onChange={setTab} />
            {tab === 'feed' ? <div className="evlist" aria-live="off">{events.map((e, i) => <div key={ms.ev.length - i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div> : <StatTable ms={ms} />}
          </div>
        </div>
      </div>
    </>
  );
}

function Post({ g, ms, notes }: { g: Game; ms: MatchState; notes: string[] }) {
  const u = ms.uc;
  const me = u ? ms.pl[u.idx] : null;
  const [tab, setTab] = useState('rat');
  return (
    <>
      <div className="hero mb"><div className="score">
        <div className="row" style={{ justifyContent: 'flex-end' }}><span className="tn">{ms.teams[0].name}</span><ClubBadge g={g} id={ms.teams[0].id} lg /></div>
        <div className="center"><div className="tiny up blue">Full time · {ms.compName}</div><div className="sc">{ms.score[0]} – {ms.score[1]}</div>{ms.pens && <div className="num gold">{ms.pens[0]}–{ms.pens[1]} on penalties</div>}<div className="small muted">{ms.rules.kind === 'nel' ? `${clockLabel('nel', ms.play, 1)} of playing time` : `${Math.round(ms.clock / 60)} minutes`}</div></div>
        <div className="row"><ClubBadge g={g} id={ms.teams[1].id} lg /><span className="tn">{ms.teams[1].name}</span></div>
      </div>
        <div className="center small mt">{ms.goals.map((gl, i) => <span key={i} className="chip" style={{ margin: 2 }}>{gl[0]}' {g.world.players[gl[2]]?.sn}{gl[4] === 1 ? ' (pen)' : ''} · {gl[1] === 0 ? ms.teams[0].abbr : ms.teams[1].abbr}</span>)}</div>
      </div>
      <div className="grid g3 mb">
        <Card title="Your match" className="hot">{me?.used ? <>
          <div className="row"><span className={`ovr lg ${me.s[S.RAT] >= 8 ? 't1' : me.s[S.RAT] >= 7 ? 't2' : me.s[S.RAT] >= 6 ? 't3' : 't5'}`}>{me.s[S.RATN] ? me.s[S.RAT].toFixed(1) : '—'}</span><div><b>{me.s[S.POTM] ? '⭐ Player of the Match' : me.s[S.RATN] ? 'Match rating' : 'Too brief to rate'}</b><div className="small muted">{Math.round((ms.rules.kind === 'nel' ? me.s[S.PLAY] : me.s[S.SEC]) / 60)} minutes{me.started ? ', started' : ', from the bench'}</div></div></div>
          <div className="row wrap gap4 mt"><Chip>{me.s[S.G]} goals</Chip><Chip>{me.s[S.A]} assists</Chip><Chip>{me.s[S.SH]} shots ({me.s[S.SOT]} on target)</Chip><Chip>xG {me.s[S.XG].toFixed(2)}</Chip><Chip>xA {me.s[S.XA].toFixed(2)}</Chip><Chip>{me.s[S.KP]} key passes</Chip><Chip>{me.s[S.PC]}/{me.s[S.PA]} passes</Chip><Chip>{me.s[S.DC]}/{me.s[S.DA]} dribbles</Chip><Chip>{me.s[S.TKW]} tackles</Chip><Chip>{me.s[S.INT]} interceptions</Chip></div>
          {u && <p className="tiny muted mt">Decisions made: {u.decisions} · selfish: {u.selfish} · unselfish: {u.unselfish} · Flow entered {me.flN}×</p>}</> : <Empty>You did not get on the pitch.</Empty>}
        </Card>
        <Card title="Aftermath"><ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{notes.length ? notes.map((n, i) => <li key={i}>{n}</li>) : <li className="muted">Nothing notable.</li>}</ul></Card>
        <Card title="Next"><p className="small muted">Results elsewhere, awards and bids are processed when you continue.</p><button className="btn pri big" onClick={() => { lastDone = null; nav('hub'); continueGame(1); }}>Continue</button></Card>
      </div>
      <Card><Tabs tabs={[['rat', 'Player ratings'], ['stats', 'Team stats'], ['feed', 'Key events']]} value={tab} onChange={setTab} />
        {tab === 'rat' ? <Ratings g={g} ms={ms} /> : tab === 'stats' ? <StatTable ms={ms} /> : <div>{ms.ev.filter((e) => e.i >= 2 && e.x).map((e, i) => <div key={i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div>}</Card>
    </>
  );
}

export function MatchCentre({ g }: { g: Game }) {
  const w = g.world;
  const ms = g.live as MatchState | null;
  if (ms) return <Live g={g} ms={ms} />;
  if (lastDone) return <Post g={g} ms={lastDone.ms} notes={lastDone.notes} />;
  if (w.stage <= 1 && userFixtureToday(g)) return <PreMatch g={g} />;
  const nf = nextUserFixture(g);
  const recent = [...g.career.matches].reverse().slice(0, 12);
  return (
    <>
      <div className="pagehead"><div><h1>Match Centre</h1><div className="sub">{nf ? `Next: ${teamName(w, nf.h)} v ${teamName(w, nf.a)} — ${fmtDate(w, nf.day, true)} (${w.comps[nf.comp]?.name})` : 'No match scheduled.'}</div></div><button className="btn pri" onClick={() => continueGame()}>Continue to next event</button></div>
      <Card title="Your recent matches">{recent.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Competition</th><th>Opponent</th><th>Result</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">Rating</th></tr></thead><tbody>
        {recent.map((m) => <tr key={m.fid}><td>{m.date}</td><td>{m.compName}</td><td>{m.home ? 'v' : '@'} {m.oppName}</td><td><b className={m.res === 'W' ? 'good' : m.res === 'L' ? 'bad' : ''}>{m.res} {m.sc[0]}–{m.sc[1]}</b>{m.pens ? ` (${m.pens[0]}–${m.pens[1]}p)` : ''}</td><td className="n">{m.line ? Math.round((m.rules === 'nel' ? m.line[S.PLAY] : m.line[S.SEC]) / 60) : '—'}</td><td className="n">{m.line?.[S.G] ?? ''}</td><td className="n">{m.line?.[S.A] ?? ''}</td><td className="n"><Rating v={m.rat} />{m.potm ? ' ⭐' : ''}</td></tr>)}
      </tbody></table></div> : <Empty>No matches played yet.</Empty>}</Card>
      {recent[0]?.feed?.length ? <Card title={`Key events — v ${recent[0].oppName}`} className="mt"><div className="small">{recent[0].feed!.map((f, i) => <div key={i} style={{ padding: '2px 0' }}>{f}</div>)}</div></Card> : null}
      <p className="tiny dim mt"><Ovr v={ovr(w.players[g.career.pid])} size="sm" /> Tip: interaction frequency and probability display can be changed in Settings; match mode can be switched during a match.</p>
      {(() => { void toast; return null; })()}
    </>
  );
}
