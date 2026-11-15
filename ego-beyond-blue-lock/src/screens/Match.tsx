import { useEffect, useRef, useState } from 'react';
import type { Game } from '../engine/types';
import { startUserMatch, finishUserMatch, userFixtureToday, nextUserFixture, userSide } from '../engine/sim';
import { advance as advMatch, ratingOf, requestSub, subChance } from '../engine/match/engine';
import { Replay3D, ReplayList } from '../ui/Replay3D';
import { LivePitch } from '../ui/LivePitch';
import { UltCutIn } from '../ui/UltCutIn';
import { Cutscene3D } from '../ui/Cutscene3D';
import { faceoffFor, applyFaceoff, interviewFor, applyInterview } from '../engine/rivalry';
import { banterLine } from '../engine/data/banter';
import { wcqTable } from '../engine/international';
import { PlayerAvatar } from '../ui/kit';
import { clockLabel } from '../engine/match/rules';
import { S, type MatchState, type MPlayer, type Option, type Replay, type UltEvent } from '../engine/match/model';
import { teamName, teamInfo, pickSheet, importance } from '../engine/match/setup';
import { FLOW, abilityDef } from '../engine/abilities';
import { fmtDate } from '../engine/competitions';
import { NATIONS } from '../engine/data/nations';
import { ovr } from '../engine/attributes';
import { act, autosave, moment, nav, refresh, toast } from '../store/game';
import { continueGame } from '../ui/flow';
import { Bar, Card, Chip, ClubBadge, Empty, PlayerLink, Rating, Tabs, Ovr } from '../ui/kit';

let lastDone: { ms: MatchState; notes: string[] } | null = null;

/** Goal scorers with minutes, grouped by player, for one side. */
export function Scorers({ g, goals, side, align }: { g: Game; goals: [number, number, string, string, number, ...number[]][]; side: number; align: 'left' | 'right' }) {
  const by = new Map<string, string[]>();
  for (const gl of goals) { if (gl[1] !== side) continue; const k = gl[2]; const l = by.get(k) ?? []; l.push(`${gl[0]}'${gl[4] === 1 ? ' (pen)' : gl[4] === 2 ? ' (og)' : ''}`); by.set(k, l); }
  return <div className="small" style={{ textAlign: align, minHeight: 18 }}>{[...by.entries()].map(([pid, mins]) => <div key={pid}>{align === 'right' ? <>{g.world.players[pid]?.sn ?? 'Unknown'} <span className="muted">{mins.join(', ')}</span> ⚽</> : <>⚽ {g.world.players[pid]?.sn ?? 'Unknown'} <span className="muted">{mins.join(', ')}</span></>}</div>)}</div>;
}

export function Scoreboard({ g, ms: ms0, live, hide }: { g: Game; ms: MatchState; live: boolean; hide?: number }) {
  // goals whose 3D sequence has not been shown yet are kept off the scoreboard so nothing is spoiled
  const cut = hide ? ms0.goals.slice(0, Math.max(0, ms0.goals.length - hide)) : ms0.goals;
  const ms = hide ? { ...ms0, goals: cut, score: [cut.filter((x) => x[1] === 0).length, cut.filter((x) => x[1] === 1).length] as [number, number] } as MatchState : ms0;
  const nel = ms.rules.kind === 'nel';
  return (
    <div className="score" style={{ alignItems: 'start' }}>
      <div><div className="row" style={{ justifyContent: 'flex-end' }}><span className="tn">{ms.teams[0].name}</span><ClubBadge g={g} id={ms.teams[0].id} lg /></div><Scorers g={g} goals={ms.goals} side={0} align="right" /></div>
      <div className="center">
        {!live && <div className="tiny up blue">Full time · {ms.compName}</div>}
        <div className="sc">{ms.score[0]} – {ms.score[1]}</div>
        {ms.pens && <div className="num gold">{ms.pens[0]}–{ms.pens[1]} on penalties</div>}
        <div className="num blue" style={{ fontSize: 19 }}>{live ? (nel ? `PLAYING TIME ${clockLabel('nel', ms.clock, 1)}` : clockLabel('reg', ms.clock, ms.period)) : nel ? `${clockLabel('nel', ms.play, 1)} of playing time` : `${Math.round(ms.clock / 60)} minutes`} {live && <span className="muted" style={{ fontSize: 13 }}>{ms.phase}</span>}</div>
        {nel && <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 4 }}>{[0, 1].map((t) => <div key={t} className="pips" aria-label={`${ms.teams[t].name}: ${ms.score[t]} of ${ms.rules.goalTarget} goals`}>{Array.from({ length: ms.rules.goalTarget }, (_, i) => <i key={i} className={i < ms.score[t] ? 'on' : ''} />)}</div>)}</div>}
      </div>
      <div><div className="row"><ClubBadge g={g} id={ms.teams[1].id} lg /><span className="tn">{ms.teams[1].name}</span></div><Scorers g={g} goals={ms.goals} side={1} align="left" /></div>
    </div>
  );
}

interface Trail { x1: number; y1: number; x2: number; y2: number; k: number }
function Pitch({ ms, hover, tick, trail, banner }: { ms: MatchState; hover: number; tick: number; trail: Trail | null; banner: { x: string; i: number } | null }) {
  const u = ms.uc?.idx ?? -1;
  const ht = hover >= 0 ? ms.pl[hover] : null;
  return (
    <div className="pitchwrap" style={{ ['--tick' as string]: `${tick}ms` }}><svg className="pitch" viewBox="-2 -2 109 72" role="img" aria-label={`Pitch view. ${ms.teams[0].name} attack right, ${ms.teams[1].name} attack left.`}>
      <defs><pattern id="grass" width="10.5" height="68" patternUnits="userSpaceOnUse"><rect width="5.25" height="68" fill="#0b3a1c" /><rect x="5.25" width="5.25" height="68" fill="#0d4421" /></pattern></defs>
      <rect x="0" y="0" width="105" height="68" fill="url(#grass)" />
      <g fill="none" stroke="#cfe9d6" strokeOpacity=".55" strokeWidth=".35">
        <rect x="0" y="0" width="105" height="68" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" />
        <rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" /><rect x="0" y="24.84" width="5.5" height="18.32" /><rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <rect x="-1.6" y="30.34" width="1.6" height="7.32" /><rect x="105" y="30.34" width="1.6" height="7.32" />
      </g>
      {trail && <line key={trail.k} className="trail" x1={trail.x1 * 1.05} y1={trail.y1 * 0.68} x2={trail.x2 * 1.05} y2={trail.y2 * 0.68} stroke="#fff" strokeWidth=".5" strokeDasharray="1.4 1" />}
      {ht && ht.on && <><line x1={ms.bx * 1.05} y1={ms.by * 0.68} x2={ht.x * 1.05} y2={ht.y * 0.68} stroke="#3df2ff" strokeWidth=".6" strokeDasharray="1.6 1" /><circle cx={ht.x * 1.05} cy={ht.y * 0.68} r="3.4" fill="none" stroke="#3df2ff" strokeWidth=".6" /></>}
      {ms.pl.map((p, i) => (p.on ? (
        <g key={p.id} className="pl" style={{ transform: `translate(${p.x * 1.05}px, ${p.y * 0.68}px)` }}>
          {i === u && <circle r="3.1" fill="none" stroke="#3df2ff" strokeWidth=".5" />}
          {p.flEnd > ms.play && <circle r="3.6" fill="none" stroke="#b47bff" strokeWidth=".35" strokeDasharray="1 .8" />}
          {i === ms.car && <circle r="2.6" fill="none" stroke="#fff" strokeWidth=".3" />}
          <circle r="1.9" fill={ms.teams[p.t].col} stroke={p.star ? '#ffd166' : ms.teams[p.t].col2} strokeWidth={p.star ? 0.6 : 0.4} />
          <text y=".75" textAnchor="middle" fontSize="1.9" fontWeight="700" fill="#fff" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.45 }}>{p.num || ''}</text>
          {(i === u || i === ms.car || i === hover) && <text y="-2.9" textAnchor="middle" fontSize="2" fill="#fff" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.5 }}>{p.nm}</text>}
        </g>) : null))}
      <g className="ball" style={{ transform: `translate(${ms.bx * 1.05}px, ${ms.by * 0.68}px)` }}><circle r={ms.bh > 0 ? 1.35 : 1} fill="#fff" stroke="#111" strokeWidth=".25" />{ms.bh > 0 && <circle r="2" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".2" />}</g>
    </svg>
      {banner && <div className={`pbanner i${banner.i}`} aria-live="polite">{banner.x}</div>}
    </div>
  );
}

function Hud({ ms, live, delta, hist }: { ms: MatchState; live: number; delta: number; hist: number[] }) {
  const u = ms.uc!;
  const me = ms.pl[u.idx];
  const inFlow = me.flEnd > ms.play;
  const h = hist.slice(-40);
  const lo = Math.min(5.5, ...h), hi = Math.max(7.5, ...h);
  return (
    <div className={`card ${inFlow ? 'flowon' : ''}`} style={{ padding: '10px 14px' }}>
      <div className="row wrap">
        <div style={{ minWidth: 120 }}><b className="num" style={{ fontSize: 19 }}>{me.nm} <span className="muted" style={{ fontSize: 13 }}>{me.pos}</span></b>{!me.on && <div><Chip k="w">{me.used ? 'Off the pitch' : 'On the bench'}</Chip></div>}</div>
        <div className="row gap6" title="Live match rating — it moves with every action you take"><span className={`ovr ${live >= 8 ? 't1' : live >= 7 ? 't2' : live >= 6 ? 't3' : 't5'}`} style={{ width: 54, fontSize: 24 }}>{me.used ? live.toFixed(1) : '—'}</span>
          <div><div className="tiny up muted">Live rating</div><b className={`num ${delta > 0 ? 'good' : delta < 0 ? 'bad' : 'dim'}`} style={{ fontSize: 15 }}>{delta > 0 ? `▲ +${delta.toFixed(1)}` : delta < 0 ? `▼ ${delta.toFixed(1)}` : '— steady'}</b></div>
          {h.length > 2 && <svg width="90" height="30" viewBox="0 0 90 30" aria-hidden="true"><polyline fill="none" stroke="#1ea7ff" strokeWidth="1.6" points={h.map((v, i) => `${(i / (h.length - 1)) * 88 + 1},${28 - ((v - lo) / (hi - lo)) * 26}`).join(' ')} /></svg>}</div>
        <div className="grow" style={{ minWidth: 170 }}>
          <div className="row small"><span style={{ width: 56 }}>Stamina</span><div className="grow"><Bar v={me.st} kind={me.st < 40 ? 'r' : me.st < 65 ? 'w' : 'g'} /></div><b style={{ width: 30 }} className="right">{Math.round(me.st)}</b></div>
          <div className="row small"><span style={{ width: 56 }}>Flow</span><div className="grow"><Bar v={inFlow ? ((me.flEnd - ms.play) / FLOW.baseDuration) * 100 : me.fl} kind="f" /></div><b style={{ width: 30 }} className="right">{inFlow ? 'ON' : Math.round(me.fl)}</b></div>
        </div>
      </div>
      <div className="row wrap gap4" style={{ marginTop: 6 }}>
        <Chip>{me.s[S.G]}G {me.s[S.A]}A</Chip><Chip>{me.s[S.SH]} shots · xG {me.s[S.XG].toFixed(2)}</Chip><Chip>{me.s[S.PC]}/{me.s[S.PA]} passes</Chip><Chip>{me.s[S.DC]}/{me.s[S.DA]} dribbles</Chip><Chip>{me.s[S.TKW] + me.s[S.INT]} def</Chip>
        {inFlow && <Chip k="e">FLOW {Math.max(0, Math.ceil(me.flEnd - ms.play))}s</Chip>}{me.yc > 0 && <Chip k="y">Booked</Chip>}{u.dominion > ms.play && <Chip k="e">Field Dominion</Chip>}{u.combo >= 0 && ms.pl[u.combo]?.on && <Chip k="b">Combo: {ms.pl[u.combo].nm}</Chip>}{ms.pl.some((p) => p.rival && p.on) ? <Chip k="e">Rival on the pitch</Chip> : null}
      </div>
    </div>
  );
}

const GROUPS: [string, string[]][] = [['Special', ['meta']], ['Shoot', ['shoot']], ['Pass', ['pass', 'through', 'cross', 'cutback', 'onetwo']], ['On the ball', ['dribble', 'carry', 'hold']], ['Movement', ['run']], ['Defend', ['tackle', 'press', 'contain', 'cut']]];
function orderOptions(opts: Option[]): { group: string; list: Option[] }[] {
  const out: { group: string; list: Option[] }[] = [];
  for (const [name, kinds] of GROUPS) { const list = opts.filter((o) => kinds.includes(o.kind)); if (list.length) out.push({ group: name, list: name === 'Pass' || name === 'Shoot' ? [...list].sort((a, b) => b.p - a.p) : list }); }
  const rest = opts.filter((o) => !GROUPS.some(([, k]) => k.includes(o.kind)));
  if (rest.length) out.push({ group: 'Other', list: rest });
  return out;
}
function Decision({ ms, onPick, onHover }: { ms: MatchState; onPick: (id: string) => void; onHover: (i: number) => void }) {
  const d = ms.pending!;
  const groups = orderOptions(d.options);
  const flat = groups.flatMap((x) => x.list);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const n = +e.key; if (n >= 1 && n <= Math.min(9, flat.length)) { e.preventDefault(); onPick(flat[n - 1].id); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const col = (p: number) => (p >= 0.75 ? 'var(--good)' : p >= 0.5 ? 'var(--blue2)' : p >= 0.28 ? 'var(--warn)' : 'var(--bad)');
  let n = 0;
  return (
    <div className="card hot decision" aria-live="polite">
      <div className="row between wrap"><h3 style={{ margin: 0 }}>{d.title}</h3><span className="small muted">{d.ctx}</span></div>
      <div className="dlist">
        {groups.map((gr) => <div key={gr.group}><div className="tiny up muted" style={{ margin: '8px 0 4px' }}>{gr.group}</div>
          <div className="col" style={{ gap: 5 }}>{gr.list.map((o) => { const k = ++n; const pct = Math.round(o.p * 100); const shot = o.kind === 'shoot'; return (
            <button key={o.id} className={`opt2 ${o.hot ? 'hot' : ''}`} onClick={() => onPick(o.id)} onMouseEnter={() => onHover(o.tgt)} onMouseLeave={() => onHover(-1)} onFocus={() => onHover(o.tgt)} onBlur={() => onHover(-1)}>
              <span className="k">{k <= 9 ? k : ''}</span>
              <span className="grow" style={{ minWidth: 0 }}><b>{o.label}</b><span className="small muted">{o.detail}</span>
                <span className="row wrap gap4" style={{ marginTop: 3 }}><span className="chip">{o.intent}</span><span className="chip">{o.risk}</span>{o.ab && <span className="chip e">{abilityDef(o.ab)?.name ?? 'Ability'}{o.sta ? ` · −${o.sta} stamina` : ''}</span>}</span></span>
              {o.kind !== 'meta' && <span className="pct" style={{ color: col(shot ? Math.min(1, o.p * 2.4) : o.p) }}><b>{pct}%</b><span>{shot ? 'to score' : 'success'}</span><i style={{ width: `${pct}%`, background: 'currentColor' }} /></span>}
            </button>); })}</div></div>)}
      </div>
      <div className="tiny dim" style={{ marginTop: 6 }}>Hover a choice to see it on the pitch · press 1–9 to choose</div>
    </div>
  );
}

export function StatTable({ ms }: { ms: MatchState }) {
  const sum = (t: number, i: number) => ms.pl.filter((p) => p.t === t && p.used).reduce((s, p) => s + p.s[i], 0);
  const rows: [string, (t: number) => string | number][] = [
    ['Shots (on target)', (t) => `${sum(t, S.SH)} (${sum(t, S.SOT)})`], ['Expected goals', (t) => sum(t, S.XG).toFixed(2)], ['Passes (completed)', (t) => `${sum(t, S.PA)} (${sum(t, S.PC)})`],
    ['Pass accuracy', (t) => (sum(t, S.PA) ? Math.round((sum(t, S.PC) / sum(t, S.PA)) * 100) + '%' : '—')], ['Dribbles won', (t) => `${sum(t, S.DC)}/${sum(t, S.DA)}`], ['Tackles won', (t) => sum(t, S.TKW)], ['Interceptions', (t) => sum(t, S.INT)],
    ['Fouls', (t) => sum(t, S.FC)], ['Offsides', (t) => sum(t, S.OFF)], ['Yellow / red', (t) => `${sum(t, S.YC)} / ${sum(t, S.RC)}`], ['Saves', (t) => sum(t, S.SV)],
  ];
  const poss = [0, 1].map((t) => sum(t, S.PA)); const tp = poss[0] + poss[1] || 1;
  return <table><tbody><tr><td className="n num">{Math.round((poss[0] / tp) * 100)}%</td><td className="center muted">Possession (by passes)</td><td className="num">{Math.round((poss[1] / tp) * 100)}%</td></tr>{rows.map(([n, f]) => <tr key={n}><td className="n num">{f(0)}</td><td className="center muted">{n}</td><td className="num">{f(1)}</td></tr>)}</tbody></table>;
}

export function Ratings({ g, ms }: { g: Game; ms: MatchState }) {
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
    if (mode === 'sim' || !ms.uc) { if (!ms.uc) toast('You are not in the matchday squad — the match is played without you.'); advMatch(ms); const notes = act((x) => finishUserMatch(x, ms)) ?? []; lastDone = { ms, notes }; refresh(); }
    else { advMatch(ms, undefined, 1); refresh(); autosave(); }
  };
  const [faceDone, setFaceDone] = useState(false);
  const face = !faceDone ? faceoffFor(g, fx, side) : null;
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
      {face && <Card title={`The tunnel — ${face.rival.name}`} className="hot mb" right={<span className="tiny muted">Head to head: {face.h.w}W {face.h.d}D {face.h.l}L · duels {face.h.dw}–{face.h.dl}</span>}>
        <Cutscene3D g={g} kind="tunnel" title="BEFORE KICK-OFF" me={me} other={face.rival}
          beats={[{ who: 'other', name: face.rival.sn, text: face.lines[0] }, { who: 'other', name: face.rival.sn, text: face.lines[1] }]}
          choices={face.replies.map((r) => ({ id: r.tone, label: r.tone === 'fire' ? 'Trash-talk back' : r.tone === 'cold' ? 'Stay ice cold' : 'Show respect', text: r.text }))}
          onChoose={(id) => act((x) => applyFaceoff(x, x.world.fixtures[fx.id], face.rival.id, id as 'cold' | 'fire' | 'respect')) ?? []}
          onClose={() => setFaceDone(true)} />
      </Card>}
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
  const [hover, setHover] = useState(-1);
  const [, force] = useState(0);
  const seen = useRef(ms.ev.length);
  const dec = useRef(0);
  const trail = useRef<Trail | null>(null);
  const banner = useRef<{ x: string; i: number; at: number } | null>(null);
  const rat = useRef<{ last: number; delta: number; at: number; hist: number[] }>({ last: 6, delta: 0, at: -99, hist: [] });
  const ticks = useRef(0);
  const [queue, setQueue] = useState<({ k: 'rp'; r: Replay } | { k: 'ult'; e: UltEvent })[]>([]);
  const replay = queue[0] ?? null;
  const [banter, setBanter] = useState<{ pid: string; name: string; text: string } | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean | null; title: string; text: string } | null>(null);
  const hold = useRef(0);
  const slow = useRef(0);
  const seenUlt = useRef(ms.ults?.length ? ms.ults[ms.ults.length - 1].n : 0);
  const seenRp = useRef(ms.replays?.length ? ms.replays[ms.replays.length - 1].id : 0);
  const u = ms.uc!;
  const speed = g.settings.matchSpeed;
  const me = ms.pl[u.idx];
  const key = u.mode === 'key' || !me.on;
  const delay = key ? 130 : speed >= 4 ? 130 : speed >= 2 ? 300 : 560;
  const liveRating = me.used ? ratingOf(me, ms.score[me.t], ms.score[1 - me.t], 0) : 6;
  const run = (fn: () => void) => {
    const bx = ms.bx, by = ms.by;
    fn();
    ticks.current++;
    if (Math.abs(ms.bx - bx) + Math.abs(ms.by - by) > 4) trail.current = { x1: bx, y1: by, x2: ms.bx, y2: ms.by, k: ticks.current };
    for (let i = seen.current; i < ms.ev.length; i++) {
      const e = ms.ev[i];
      if (e.k === 'goal' && (u.mode === 'sim' || g.settings.reduceMotion)) moment('GOAL', `${ms.teams[0].abbr} ${ms.score[0]}–${ms.score[1]} ${ms.teams[1].abbr}`); // otherwise the 3D view announces it when the ball actually goes in
      else if (e.k === 'flow' && e.p === u.idx) moment('FLOW', 'You are in the zone', 'flow');
      else if (e.k === 'star_on') moment('STAR CHANGE', ms.pl[e.p]?.nm);
      if (e.x && (e.i >= 1 || e.p === u.idx || e.q === u.idx)) banner.current = { x: e.x, i: e.p === u.idx || e.q === u.idx ? Math.max(2, e.i) : e.i, at: ticks.current };
    }
    // banter: opponents (rivals first) have something to say about goals and misses
    for (let i = seen.current; i < ms.ev.length; i++) {
      const e = ms.ev[i];
      const mine = e.p === u.idx;
      if (!me.used || (e.k !== 'goal' && !(e.k === 'shot' && mine))) continue;
      const foes = ms.pl.filter((q) => q.t !== me.t && q.on);
      const rivalOn = foes.find((q) => g.career.rivals.includes(q.id));
      const sit = e.k === 'goal' ? (mine ? 'youScore' : ms.pl[e.p]?.t !== me.t ? 'theyScore' : null) : 'youMiss';
      if (!sit) continue;
      const sp = sit === 'theyScore' ? ms.pl[e.p] : rivalOn ?? (e.q >= 0 && ms.pl[e.q]?.t !== me.t ? ms.pl[e.q] : foes[(ms.steps + i) % Math.max(1, foes.length)]);
      const wp = sp ? g.world.players[sp.id] : null;
      if (!sp || !wp) continue;
      const known = g.career.rivals.includes(sp.id) || !!g.career.rel[sp.id];
      if (!known && (ms.steps * 31 + i) % 100 >= (sit === 'youScore' ? 70 : 45)) continue;
      setBanter({ pid: sp.id, name: sp.nm, text: banterLine(wp, sit, me.nm, ms.teams[sp.t].name, g.world.season, ms.steps) });
    }
    seen.current = ms.ev.length;
    // every ultimate gets its cut-in and every shot zooms into the 3D view
    const add: ({ k: 'rp'; r: Replay } | { k: 'ult'; e: UltEvent })[] = [];
    for (const e of ms.ults ?? []) if (e.n > seenUlt.current) { seenUlt.current = e.n; add.push({ k: 'ult', e }); }
    for (const r of ms.replays ?? []) if (r.id > seenRp.current) { seenRp.current = r.id; add.push({ k: 'rp', r }); }
    // an ultimate that ends in a strike gets its whole cutscene in 3D; the 2D title card is only for the others
    const shown = add.some((x) => x.k === 'rp' && x.r.ult) ? add.filter((x) => x.k !== 'ult') : add;
    if (shown.length && u.mode !== 'sim' && !g.settings.reduceMotion) setQueue((q) => [...q, ...shown.slice(-3)]);
    if (me.used) {
      const r = ratingOf(me, ms.score[me.t], ms.score[1 - me.t], 0);
      const R = rat.current;
      if (Math.abs(r - R.last) >= 0.05) { R.delta = Math.round((r - R.last) * 10) / 10; R.at = ticks.current; R.last = r; }
      else if (ticks.current - R.at > 8) R.delta = 0;
      if (ticks.current % 3 === 0 || R.at === ticks.current) R.hist.push(r);
    }
    force((x) => x + 1);
  };
  const finish = () => { const notes = act((x) => finishUserMatch(x, ms)) ?? []; lastDone = { ms, notes }; autosave(true); refresh(); };
  useEffect(() => {
    if (replay) return;
    if (ms.done) { finish(); return; }
    if (paused || ms.pending) return;
    const wait = Math.max(slow.current > 0 ? 520 : delay, hold.current - Date.now());
    const t = setTimeout(() => run(() => {
      const before = ms.ev.length;
      if (outcome && Date.now() >= hold.current) setOutcome(null);
      if (slow.current > 0) { slow.current--; advMatch(ms, undefined, 1); }
      else if (key) { for (let k = 0; k < 7 && !ms.done && !ms.pending; k++) { advMatch(ms, undefined, 1); if (ms.ev.slice(before).some((e) => e.i >= 2)) break; } }
      else advMatch(ms, undefined, 1);
    }), wait);
    return () => clearTimeout(t);
  });
  useEffect(() => { if (!banter || replay) return; const t = setTimeout(() => setBanter(null), 5200); return () => clearTimeout(t); }, [banter, replay]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.code === 'Space' && !ms.pending) { e.preventDefault(); setPaused((p) => !p); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [ms]);
  const pick = (id: string) => {
    setHover(-1);
    const d = ms.pending;
    const o = d?.options.find((x) => x.id === id);
    const ev0 = ms.ev.length, sc0 = ms.score[0] + ms.score[1], rp0 = ms.replays?.length ?? 0;
    run(() => advMatch(ms, id, 1));
    if (++dec.current % 4 === 0) autosave();
    if (!o || !d || ms.done) return;
    // show what the choice led to, and hold the picture long enough to follow the ball
    const mine = ms.poss === me.t;
    const evs = ms.ev.slice(ev0).filter((e) => e.x && (e.p === u.idx || e.q === u.idx));
    const text = evs.length ? evs[evs.length - 1].x : '';
    const shot = (ms.replays?.length ?? 0) > rp0 || ms.score[0] + ms.score[1] !== sc0;
    let res: { ok: boolean | null; title: string } | null = null;
    if (shot || o.kind === 'meta' || d.kind === 'flow' || d.kind === 'penalty' || d.kind === 'keeper') res = null;
    else if (d.kind === 'ball') {
      if (o.tgt >= 0 && o.tgt !== u.idx) { const tn = ms.pl[o.tgt]?.nm ?? ''; res = mine ? { ok: true, title: o.kind === 'through' ? `THROUGH BALL FINDS ${tn.toUpperCase()}` : o.kind === 'cross' ? `CROSS MEETS ${tn.toUpperCase()}` : `PASS COMPLETE → ${tn.toUpperCase()}` } : { ok: false, title: o.kind === 'cross' ? 'CROSS CLEARED' : 'PASS CUT OUT' }; }
      else if (o.kind === 'dribble') res = mine ? { ok: true, title: 'BEATEN HIM!' } : { ok: false, title: 'DISPOSSESSED' };
      else res = mine ? { ok: true, title: o.kind === 'carry' ? 'GROUND MADE' : 'BALL KEPT' } : { ok: false, title: 'POSSESSION LOST' };
    } else if (d.kind === 'defend') res = mine ? { ok: true, title: 'BALL WON!' } : ms.restart ? { ok: null, title: 'PLAY STOPPED' } : { ok: null, title: id.startsWith('tackle') ? 'CHALLENGE MISSED' : 'STILL DEFENDING' };
    else if (d.kind === 'offball') res = ms.car === u.idx ? { ok: true, title: 'YOU ARE FOUND!' } : mine ? { ok: null, title: 'RUN MADE' } : { ok: false, title: 'MOVE BREAKS DOWN' };
    if (!res) setOutcome(null);
    if (res) { setOutcome({ ...res, text }); hold.current = Date.now() + (d.kind === 'ball' ? 1150 : 800); slow.current = 2; }
  };
  const simEnd = () => { u.mode = 'sim'; setQueue([]); run(() => { if (ms.pending) advMatch(ms, ms.pending.options[0].id); else advMatch(ms); }); };
  const events = ms.ev.filter((e) => e.x && (u.mode === 'key' ? e.i >= 1 : true)).slice(-70).reverse();
  const b = banner.current && ticks.current - banner.current.at < 6 ? banner.current : null;
  const poss = [0, 1].map((t) => ms.pl.filter((p) => p.t === t && p.used).reduce((s2, p) => s2 + p.s[S.PA], 0));
  const pp = poss[0] + poss[1] ? (poss[0] / (poss[0] + poss[1])) * 100 : 50;
  return (
    <>
      <div className="card mb" style={{ padding: '10px 16px' }}>
        <Scoreboard g={g} ms={ms} live hide={queue.filter((q) => q.k === 'rp' && q.r.res === 'goal').length} />
        <div className="row small" style={{ marginTop: 6 }}><span className="muted" style={{ width: 34 }}>{Math.round(pp)}%</span><div className="grow bar" title="Possession (by passes)"><i style={{ width: `${pp}%`, background: ms.teams[0].col }} /></div><span className="muted right" style={{ width: 34 }}>{100 - Math.round(pp)}%</span></div>
        <div className="row wrap between small" style={{ marginTop: 8 }}>
          <span className="muted">{ms.poss === 0 ? ms.teams[0].name : ms.teams[1].name} in possession · {ms.restart ? 'dead ball' : ms.car >= 0 ? `${ms.pl[ms.car].nm} on the ball` : 'loose ball'}{ms.teams.map((T, t) => (T.starState === 1 ? <Chip key={t} k="y"> ★ {ms.pl[T.star].nm} {Math.max(0, Math.ceil(T.starEnd - ms.play))}s left</Chip> : null))}</span>
          <span className="row wrap gap6 mtools">
            <button className={`btn sm ${paused ? 'pri' : ''}`} onClick={() => setPaused((p) => !p)} disabled={!!ms.pending} title="Space">{paused ? '▶ Resume' : '❚❚ Pause'}</button>
            <span className="seg" role="group" aria-label="Speed">{[1, 2, 4].map((sp) => <button key={sp} className={speed === sp ? 'on' : ''} onClick={() => act((x) => { x.settings.matchSpeed = sp; }, false)}>{sp}×</button>)}</span>
            <span className="seg" role="group" aria-label="Mode"><button className={u.mode === 'full' ? 'on' : ''} onClick={() => { u.mode = 'full'; refresh(); }}>Full</button><button className={u.mode === 'key' ? 'on' : ''} onClick={() => { u.mode = 'key'; refresh(); }}>Highlights</button></span>
            <button className={`btn sm ${g.settings.touch !== false ? 'pri' : ''}`} onClick={() => act((x) => { x.settings.touch = x.settings.touch === false; }, false)} title="Tap team-mates and swipe runs on the pitch">☝ Touch</button>
            <button className="btn sm ghost" onClick={simEnd}>Sim to end ⏭</button>
          </span>
        </div>
      </div>
      <div className="matchgrid">
        <div className="col" style={{ gap: 10, position: 'relative' }}>
          {banter && !replay && g.world.players[banter.pid] && <div className="pbanter" role="status"><PlayerAvatar g={g} p={g.world.players[banter.pid]} size={46} /><div><span className="who">{banter.name}{g.career.rivals.includes(banter.pid) ? ' · rival' : ''}</span><b>“{banter.text}”</b></div></div>}
          {replay?.k === 'ult' ? <UltCutIn ms={ms} ev={replay.e} onDone={() => setQueue((q) => q.slice(1))} /> : replay?.k === 'rp' ? <Replay3D key={replay.r.id} g={g} ms={ms} rp={replay.r} auto quick={replay.r.res !== 'goal' && replay.r.xg < 0.3 && replay.r.sh !== u.idx && !replay.r.ult} onClose={() => setQueue((q) => q.slice(1))} /> : <LivePitch ms={ms} hover={hover} tick={slow.current > 0 ? 520 : delay} banner={b} touch={g.settings.touch !== false} onPick={pick} outcome={outcome} />}
          <Hud ms={ms} live={liveRating} delta={rat.current.delta} hist={rat.current.hist} />
        </div>
        <div className="col" style={{ gap: 10 }}>
          {!me.on && !me.used && !ms.done && (() => { const pc = subChance(ms); const T = ms.teams[me.t]; return <div className="card hot">
            <b className="num" style={{ fontSize: 19 }}>On the bench</b>
            <p className="small muted" style={{ margin: '4px 0 8px' }}>{T.subs}/{ms.rules.subs} substitutions used. {u.cameo ? 'The coach has you in his plans for the closing stages.' : 'No promise of minutes today — you may have to ask.'} Coach trust {Math.round(u.trust)}.</p>
            <button className="btn pri" disabled={pc <= 0} onClick={() => { const r = requestSub(ms); toast(r.text, !r.ok); if (r.ok) moment('YOU ARE ON', `${ms.teams[me.t].name}`); force((x) => x + 1); autosave(); }}>🙋 Ask the coach to bring you on{pc > 0 ? ` — ${Math.round(pc * 100)}% chance` : ''}</button>
            <p className="tiny dim" style={{ marginTop: 6 }}>Chance grows with coach trust, as the match goes on and when the team is chasing the game. Asking repeatedly lowers it — and costs a little trust.</p>
          </div>; })()}
          {ms.pending ? <Decision ms={ms} onPick={pick} onHover={setHover} /> : <div className="card small muted">{me.on ? (u.mode === 'key' ? 'Highlights mode: skipping to the next key moment…' : 'Play continues — you will be asked the moment you are involved. Space pauses.') : me.used ? 'You have been substituted. Watching from the touchline — use "Sim to end" to skip.' : 'You are on the bench. The coach may bring you on — or use "Sim to end".'}</div>}
          <div className="card"><Tabs tabs={[['feed', 'Commentary'], ['stats', 'Match stats'], ['instr', 'Instructions']]} value={tab} onChange={setTab} />
            {tab === 'feed' ? <div className="evlist" style={{ height: ms.pending ? 150 : 330 }} aria-live="off">{events.map((e, i) => <div key={ms.ev.length - i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div> : tab === 'stats' ? <StatTable ms={ms} /> : <>
              <div className="grid g3" style={{ gap: 8 }}>
                {([['stance', 'Positioning', ['Deep', 'Balanced', 'Advanced']], ['press', 'Pressing', ['Conserve', 'Normal', 'Aggressive']], ['risk', 'Decision frequency', ['Low', 'Standard', 'High']]] as const).map(([k, label, opts]) => (
                  <label key={k} className="f">{label}<select value={k === 'risk' ? (u.thr >= 70 ? 0 : u.thr >= 45 ? 1 : 2) : u.instr[k]} onChange={(e) => { const v = +e.target.value; if (k === 'risk') u.thr = [72, 50, 30][v]; else u.instr[k] = v; refresh(); }}>{opts.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>
                ))}
              </div>
              <p className="tiny dim" style={{ marginTop: 6 }}>Coach: {ms.teams[me.t].form}, press {Math.round(ms.teams[me.t].tac.press * 100)}%, line {Math.round(ms.teams[me.t].tac.line * 100)}%, {ms.teams[me.t].tac.direct > 0.6 ? 'direct' : 'patient'} build-up. Following the plan raises coach trust.</p></>}
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
  const [ivDone, setIvDone] = useState(false);
  const um = g.career.matches.find((m) => m.fid === ms.fid);
  const iv = !ivDone && um && u ? interviewFor(g, um, ms) : null;
  const meP = g.world.players[g.career.pid];
  return (
    <>
      <div className="hero mb"><Scoreboard g={g} ms={ms} live={false} /></div>
      {iv && <Card title="Mixed zone — post-match interview" className="hot mb">
        <Cutscene3D g={g} kind="press" title="POST-MATCH INTERVIEW" me={meP} other={iv.rival}
          beats={[{ who: 'reporter', name: 'The Touchline', text: iv.question }]}
          choices={iv.answers.map((a) => ({ id: a.tone, label: a.tone === 'humble' ? 'Humble' : a.tone === 'confident' ? 'Confident' : 'Pure ego', text: a.text }))}
          onChoose={(id) => act((x) => applyInterview(x, iv, id as 'humble' | 'confident' | 'ego')) ?? []}
          onClose={() => setIvDone(true)} />
      </Card>}
      <div className="grid g3 mb">
        <Card title="Your match" className="hot">{me?.used ? <>
          <div className="row"><span className={`ovr lg ${me.s[S.RAT] >= 8 ? 't1' : me.s[S.RAT] >= 7 ? 't2' : me.s[S.RAT] >= 6 ? 't3' : 't5'}`}>{me.s[S.RATN] ? me.s[S.RAT].toFixed(1) : '—'}</span><div><b>{me.s[S.POTM] ? '⭐ Player of the Match' : me.s[S.RATN] ? 'Match rating' : 'Too brief to rate'}</b><div className="small muted">{Math.round((ms.rules.kind === 'nel' ? me.s[S.PLAY] : me.s[S.SEC]) / 60)} minutes{me.started ? ', started' : ', from the bench'}</div></div></div>
          <div className="row wrap gap4 mt"><Chip>{me.s[S.G]} goals</Chip><Chip>{me.s[S.A]} assists</Chip><Chip>{me.s[S.SH]} shots ({me.s[S.SOT]} on target)</Chip><Chip>xG {me.s[S.XG].toFixed(2)}</Chip><Chip>xA {me.s[S.XA].toFixed(2)}</Chip><Chip>{me.s[S.KP]} key passes</Chip><Chip>{me.s[S.PC]}/{me.s[S.PA]} passes</Chip><Chip>{me.s[S.DC]}/{me.s[S.DA]} dribbles</Chip><Chip>{me.s[S.TKW]} tackles</Chip><Chip>{me.s[S.INT]} interceptions</Chip></div>
          {u && <p className="tiny muted mt">Decisions made: {u.decisions} · selfish: {u.selfish} · unselfish: {u.unselfish} · Flow entered {me.flN}×</p>}</> : <Empty>You did not get on the pitch.</Empty>}
        </Card>
        <Card title="Aftermath"><ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{notes.length ? notes.map((n, i) => <li key={i}>{n}</li>) : <li className="muted">Nothing notable.</li>}</ul></Card>
        <Card title="Next"><p className="small muted">Results elsewhere, awards and bids are processed when you continue.</p><button className="btn pri big" onClick={() => { lastDone = null; nav('hub'); continueGame(1); }}>Continue</button></Card>
      </div>
      <Card><Tabs tabs={[['rat', 'Player ratings'], ['stats', 'Team stats'], ['feed', 'Key events'], ['rep', `3D replays${ms.replays?.length ? ` (${ms.replays.length})` : ''}`]]} value={tab} onChange={setTab} />
        {tab === 'rep' ? <ReplayList ms={ms} g={g} /> : tab === 'rat' ? <Ratings g={g} ms={ms} /> : tab === 'stats' ? <StatTable ms={ms} /> : <div>{ms.ev.filter((e) => e.i >= 2 && e.x).map((e, i) => <div key={i} className={`ev i${e.i}`}><span className="t">{clockLabel(ms.rules.kind, e.c, e.h ?? 1)}</span><span>{e.x}</span></div>)}</div>}</Card>
    </>
  );
}

export function MatchCentre({ g }: { g: Game }) {
  const w = g.world;
  const ms = g.live as MatchState | null;
  if (ms && !ms.uc) { advMatch(ms); const notes = act((x) => finishUserMatch(x, ms)) ?? []; lastDone = { ms, notes }; return <Post g={g} ms={ms} notes={notes} />; }
  if (ms) return <Live g={g} ms={ms} />;
  if (lastDone) return <Post g={g} ms={lastDone.ms} notes={lastDone.notes} />;
  if (w.stage <= 1 && userFixtureToday(g)) return <PreMatch g={g} />;
  return <Idle g={g} />;
}

function Idle({ g }: { g: Game }) {
  const w = g.world;
  const me = w.players[g.career.pid];
  const nf = nextUserFixture(g);
  const natNext = !!nf && !!w.comps[nf.comp]?.natTeams;
  const [view, setView] = useState<'club' | 'nat'>(natNext ? 'nat' : 'club');
  const isNat = (m: Game['career']['matches'][number]) => !!NATIONS[m.club];
  const all = [...g.career.matches].reverse();
  const recent = all.filter((m) => (view === 'nat') === isNat(m)).slice(0, 14);
  const nation = w.nations[me.nat];
  const inSenior = !!nation?.squad?.includes(me.id), inU20 = !!nation?.u20squad?.includes(me.id);
  const team = view === 'nat' ? me.nat : me.club ?? '';
  const upcoming = Object.values(w.fixtures).filter((f) => !f.played && (f.h === team || f.a === team) && (view === 'club' || (w.comps[f.comp]?.u20 ? inU20 : inSenior))).sort((a, b) => a.day - b.day).slice(0, 6);
  const tot = (list: typeof all) => { let ap = 0, gl = 0, as = 0, rt = 0, rn = 0, wn = 0; for (const m of list) { if (!m.line) continue; ap++; gl += m.line[S.G]; as += m.line[S.A]; if (m.rat) { rt += m.rat; rn++; } if (m.res === 'W') wn++; } return { ap, gl, as, avg: rn ? rt / rn : 0, wn }; };
  const T = tot(all.filter((m) => (view === 'nat') === isNat(m)));
  const youth = all.filter((m) => isNat(m) && /U-2[01]/.test(m.compName));
  const Ty = tot(youth);
  return (
    <>
      <div className="pagehead"><div><h1>Match Centre</h1><div className="sub">{nf ? `Next: ${teamName(w, nf.h)} v ${teamName(w, nf.a)} — ${fmtDate(w, nf.day, true)} (${w.comps[nf.comp]?.name})` : 'No match scheduled.'}</div></div><button className="btn pri" onClick={() => continueGame()}>Continue to next event</button></div>
      <div className="row wrap mb">
        <button className={`btn ${view === 'club' ? 'pri' : ''}`} onClick={() => setView('club')}>{me.club ? <><ClubBadge g={g} id={me.club} /> {teamName(w, me.club)}</> : 'Club'}</button>
        <button className={`btn ${view === 'nat' ? 'pri' : ''}`} onClick={() => setView('nat')}><ClubBadge g={g} id={me.nat} /> {NATIONS[me.nat]?.name ?? 'National team'}{inSenior ? '' : inU20 ? ' U-20' : ''}</button>
      </div>
      <div className="grid g3 mb">
        <Card title={view === 'nat' ? 'International status' : 'Club status'} className="hot">
          {view === 'nat' ? <>
            <b className={`num ${inSenior ? 'good' : inU20 ? 'warn' : 'bad'}`} style={{ fontSize: 22 }}>{inSenior ? 'In the senior squad' : inU20 ? 'In the U-20 squad' : 'Not called up'}</b>
            <p className="small muted">{inSenior || inU20 ? 'You are part of the current squad. Squad-mates are listed under Relationships → national team.' : 'Call-ups follow form, overall and reputation. Keep performing for your club.'}</p>
            <button className="btn sm" onClick={() => nav('relationships', 'people')}>Squad relationships</button>
          </> : <>
            <b className="num" style={{ fontSize: 22 }}>{me.club ? teamName(w, me.club) : 'Unattached'}</b>
            <p className="small muted">{me.con ? `${me.con.role} · contract to ${me.con.until + 1}` : 'No contract'} · coach trust {Math.round(g.career.mgrTrust)}</p>
          </>}
        </Card>
        <Card title={view === 'nat' ? 'International record' : 'Club record (all matches)'}>
          <div className="row wrap gap4"><Chip>{T.ap} {view === 'nat' ? 'caps' : 'apps'}</Chip><Chip>{T.gl} goals</Chip><Chip>{T.as} assists</Chip><Chip>{T.wn} wins</Chip><Chip>avg {T.avg ? T.avg.toFixed(2) : '—'}</Chip></div>
          {view === 'nat' && Ty.ap > 0 && <p className="small muted mt">Of which youth internationals: {Ty.ap} caps, {Ty.gl} goals.</p>}
        </Card>
        <Card title="Upcoming">{upcoming.length ? <div className="small">{upcoming.map((f) => <div key={f.id} className="row between" style={{ padding: '2px 0' }}><span>{f.h === team ? 'v' : '@'} {teamName(w, f.h === team ? f.a : f.h)}</span><span className="muted">{fmtDate(w, f.day)} · {w.comps[f.comp]?.sn}</span></div>)}</div> : <Empty>{view === 'nat' ? 'No international fixtures for your squad right now.' : 'No fixtures scheduled.'}</Empty>}</Card>
      </div>
      {view === 'nat' && w.wcq && (() => { const gr = w.wcq.groups.find((x) => x.teams.includes(me.nat)); if (!gr) return null; const tab = wcqTable(gr); return <Card title={`World Cup ${w.wcq.year} qualifying — ${gr.name}`} className="mb" right={<span className="tiny muted">{w.wcq.done ? (w.wcq.qualified.includes(me.nat) ? 'Qualified' : 'Did not qualify') : gr.slots === 1 ? 'winners qualify' : `top ${gr.slots} qualify`}</span>}>
        <div className="tw"><table><thead><tr><th>#</th><th>Nation</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GF</th><th className="n">GA</th><th className="n">Pts</th></tr></thead><tbody>
          {tab.map((x, i) => <tr key={x.id} className={`${x.id === me.nat ? 'me' : ''} ${i < gr.slots ? 'zone-up' : ''}`}><td className="n dim">{i + 1}</td><td>{NATIONS[x.id]?.name}</td><td className="n">{x.r[0]}</td><td className="n">{x.r[1]}</td><td className="n">{x.r[2]}</td><td className="n">{x.r[3]}</td><td className="n">{x.r[4]}</td><td className="n">{x.r[5]}</td><td className="n"><b>{x.r[6]}</b></td></tr>)}
        </tbody></table></div>
        <p className="tiny dim mt">Qualifying is played in the international breaks. Your nation's ties are real matches when you are called up; the rest are simulated from team strength.</p>
      </Card>; })()}
      <Card title={view === 'nat' ? 'Your international matches' : 'Your recent club matches'}>{recent.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Competition</th><th>Opponent</th><th>Result</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">Rating</th></tr></thead><tbody>
        {recent.map((m) => <tr key={m.fid}><td>{m.date}</td><td>{m.compName}</td><td>{m.home ? 'v' : '@'} {m.oppName}</td><td><b className={m.res === 'W' ? 'good' : m.res === 'L' ? 'bad' : ''}>{m.res} {m.sc[0]}–{m.sc[1]}</b>{m.pens ? ` (${m.pens[0]}–${m.pens[1]}p)` : ''}</td><td className="n">{m.line ? Math.round((m.rules === 'nel' ? m.line[S.PLAY] : m.line[S.SEC]) / 60) : '—'}</td><td className="n">{m.line?.[S.G] ?? ''}</td><td className="n">{m.line?.[S.A] ?? ''}</td><td className="n"><Rating v={m.rat} />{m.potm ? ' ⭐' : ''}</td></tr>)}
      </tbody></table></div> : <Empty>{view === 'nat' ? 'No international matches yet.' : 'No matches played yet.'}</Empty>}</Card>
      {recent[0]?.feed?.length ? <Card title={`Key events — v ${recent[0].oppName}`} className="mt"><div className="small">{recent[0].feed!.map((f, i) => <div key={i} style={{ padding: '2px 0' }}>{f}</div>)}</div></Card> : null}
      <p className="tiny dim mt"><Ovr v={ovr(w.players[g.career.pid])} size="sm" /> Tip: interaction frequency and probability display can be changed in Settings; match mode can be switched during a match.</p>
      {(() => { void toast; return null; })()}
    </>
  );
}
