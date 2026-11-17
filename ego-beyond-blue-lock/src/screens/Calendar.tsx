/** The season calendar: a month grid of your fixtures and results, key dates, and the transfer window. */
import { useMemo, useState } from 'react';
import type { Fixture, Game } from '../engine/types';
import { dateOf, seasonLabel, WINDOWS, SEASON_END_DAY, SEASON_DAYS, SUMMER_TOURNAMENT_DAY } from '../engine/competitions';
import { simToDay } from '../ui/flow';
import { userSide } from '../engine/sim';
import { teamName } from '../engine/match/setup';
import { BDO_DAY } from '../engine/ballondor';
import { TOTS_FINAL_DAY, TOTS_RR_DAYS } from '../engine/teamsheets';
import { ClubBadge } from '../ui/kit';
import { nav } from '../store/game';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIND_COL: Record<string, string> = { league: '#7c3aed', continental: '#1d4ed8', cup: '#15803d', intl: '#b91c1c', nel: '#0ea5e9', playoff: '#a16207', friendly: '#475569' };

export function Calendar({ g }: { g: Game }) {
  const w = g.world;
  const pro = w.phase === 'pro';
  const last = pro ? SEASON_DAYS - 1 : 120;
  const toDay = (d: Date) => Math.round((d.getTime() - dateOf(w.phase, w.season, 0).getTime()) / 864e5);
  const today = dateOf(w.phase, w.season, w.day);
  const [ym, setYm] = useState<[number, number]>([today.getUTCFullYear(), today.getUTCMonth()]);
  const [sel, setSel] = useState(w.day);
  const fx = useMemo(() => { const m: Record<number, Fixture> = {}; for (const id in w.fixtures) { const f = w.fixtures[id]; if (f.s === w.season && userSide(g, f)) m[f.day] = f; } return m; }, [w.day, w.season]);
  const windowAt = (d: number) => (pro ? d < WINDOWS.summerEnd || (d >= WINDOWS.winterStart && d < WINDOWS.winterEnd) || d >= WINDOWS.summerStart : d >= 35);
  // the big dates of the season: ceremonies, windows, finals, breaks and tournaments
  const events = useMemo(() => {
    const ev: Record<number, string[]> = {};
    const add = (d: number, t: string) => { if (d >= 0 && d <= last) (ev[d] ??= []).push(t); };
    if (pro) {
      add(SEASON_END_DAY, '🏆 End-of-season awards'); add(BDO_DAY, "🌟 Ballon d'Or gala");
      add(WINDOWS.summerEnd, 'Transfer window closes'); add(WINDOWS.winterStart, 'January window opens'); add(WINDOWS.winterEnd, 'Deadline day'); add(WINDOWS.summerStart, 'Summer window opens');
      add(TOTS_RR_DAYS[0], 'TOTS Cup begins'); add(TOTS_FINAL_DAY, 'TOTS Cup final'); add(SUMMER_TOURNAMENT_DAY, '🌍 Summer tournament begins'); add(last, 'New season');
      for (const e of w.events) add(e.day, e.key === 'intlbreak' ? 'International break' : e.key === 'midseason' ? 'Mid-season review' : e.key === 'market' ? 'Transfer market busy' : e.key);
    } else add(35, 'NEL bids & window');
    const seenFinal = new Set<string>();
    for (const id in w.fixtures) { const f = w.fixtures[id]; if (f.s !== w.season || f.stg !== 'Final' || seenFinal.has(f.comp)) continue; seenFinal.add(f.comp); add(f.day, `${w.comps[f.comp]?.name ?? 'Cup'} final`); }
    for (const id in w.comps) { const c = w.comps[id]; if (c.kind !== 'league' || c.tier !== 1) continue; const fs = Object.values(w.fixtures).filter((f) => f.comp === id && f.s === w.season); if (fs.length) add(Math.max(...fs.map((f) => f.day)), `${c.sn} final day`); }
    return ev;
  }, [w.season, w.phase, Object.keys(w.fixtures).length]);
  // the month grid, Monday first
  const first = new Date(Date.UTC(ym[0], ym[1], 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(ym[0], ym[1], 1 - offset + i)));
  const step = (k: number) => { const d = new Date(Date.UTC(ym[0], ym[1] + k, 1)); setYm([d.getUTCFullYear(), d.getUTCMonth()]); };
  const minD = dateOf(w.phase, w.season, 0), maxD = dateOf(w.phase, w.season, last);
  const canPrev = new Date(Date.UTC(ym[0], ym[1], 0)) >= minD, canNext = new Date(Date.UTC(ym[0], ym[1] + 1, 1)) <= maxD;
  // the side panel
  const sf = fx[sel];
  const next = Object.values(fx).filter((f) => !f.played && f.day >= w.day).sort((a, b) => a.day - b.day)[0];
  const open = windowAt(w.day);
  let edge = w.day; while (edge <= last && windowAt(edge) === open) edge++;
  const me = w.players[g.career.pid];
  const opp = (f: Fixture) => (f.h === userSide(g, f) ? f.a : f.h);
  const res = (f: Fixture) => { if (!f.played || !f.sc) return null; const home = f.h === userSide(g, f); const [a, b] = home ? f.sc : [f.sc[1], f.sc[0]]; return { s: `${a}–${b}`, r: a > b ? 'W' : a < b ? 'L' : f.pens ? ((home ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]) ? 'W' : 'L') : 'D' }; };
  const selDate = dateOf(w.phase, w.season, sel);
  return (
    <>
      <div className="pagehead"><div><h1>Calendar</h1><div className="sub">{w.phase === 'nel' ? 'Neo Egoist League' : seasonLabel(w.season)} · your fixtures, results and the key dates of the season.</div></div></div>
      <div className="cal">
        <div className="cal-side card">
          <div className="cal-date">{DOW[(selDate.getUTCDay() + 6) % 7]} {selDate.getUTCDate()} {MONTHS[selDate.getUTCMonth()]} {selDate.getUTCFullYear()}</div>
          {sf ? <>
            <div className="small muted">{w.comps[sf.comp]?.name}{sf.stg && sf.stg !== 'Group' ? ` · ${sf.stg}` : ''}</div>
            <div className="cal-vs"><ClubBadge g={g} id={userSide(g, sf)!} lg /><span>{res(sf)?.s ?? 'v'}</span><ClubBadge g={g} id={opp(sf)} lg /></div>
            <b>{teamName(w, opp(sf))}</b><span className="small muted">{sf.neutral ? 'Neutral venue' : sf.h === userSide(g, sf) ? 'Home' : 'Away'}</span>
          </> : <span className="small muted">No match for you.</span>}
          {(events[sel] ?? []).map((t) => <b key={t} className="gold small">{t}</b>)}
          {sel > w.day && !g.live && <div className="col gap4" style={{ width: '100%', marginTop: 6 }}>
            <button className="btn pri" onClick={() => simToDay(sel)}>⏩ Sim to {selDate.getUTCDate()} {MONTHS[selDate.getUTCMonth()].slice(0, 3)}</button>
            <span className="tiny muted">Your matches on the way are simulated; it stops early for anything that needs you (a ceremony, a contract, choosing a club).</span>
          </div>}
          {next && next.day > w.day && <button className="btn sm" onClick={() => simToDay(next.day - 1)}>Advance to the eve of my next match</button>}
          <hr />
          {me.club && <div className="row gap6"><ClubBadge g={g} id={me.club} lg /><b>{w.clubs[me.club]?.name}</b></div>}
          {next && <p className="small">Next: <b>{teamName(w, opp(next))}</b> ({w.comps[next.comp]?.name}) — {next.day === w.day ? 'today' : `in ${next.day - w.day} day${next.day - w.day > 1 ? 's' : ''}`}</p>}
          <div className={`cal-win ${open ? 'open' : ''}`}><span>Transfer window {open ? 'open' : 'closed'}</span><b>{edge > last ? '—' : `${edge - w.day} days`}</b><span>{edge > last ? 'until the season ends' : open ? 'until it closes' : 'until it opens'}</span></div>
          <button className="btn sm mt" onClick={() => nav('competitions')}>Tables & fixtures ▸</button>
        </div>
        <div className="cal-main card">
          <div className="row between mb"><button className="btn sm" disabled={!canPrev} onClick={() => step(-1)}>◀</button><b className="cal-month">{MONTHS[ym[1]]} {ym[0]}</b><button className="btn sm" disabled={!canNext} onClick={() => step(1)}>▶</button></div>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d) => {
              const day = toDay(d), inM = d.getUTCMonth() === ym[1], f = fx[day], r = f ? res(f) : null, kind = f ? w.comps[f.comp]?.kind ?? 'friendly' : '';
              const cls = ['cal-cell', inM ? '' : 'out', day === w.day ? 'today' : '', day === sel ? 'sel' : '', day < w.day ? 'past' : '', f ? 'has' : ''].join(' ');
              return (
                <button key={d.toISOString()} className={cls} style={f ? { background: `linear-gradient(160deg, ${KIND_COL[kind] ?? '#475569'}cc, ${KIND_COL[kind] ?? '#475569'}55)` } : undefined} onClick={() => setSel(day)} disabled={day < 0 || day > last}>
                  <span className="n">{d.getUTCDate()}</span>
                  {f && <><span className="c"><ClubBadge g={g} id={opp(f)} /></span><span className="t">{f.neutral ? 'Neutral' : f.h === userSide(g, f) ? 'Home' : 'Away'}<br />{w.comps[f.comp]?.sn ?? ''}</span>{r && <span className={`r ${r.r}`}>{r.s}</span>}</>}
                  {events[day] && <span className={`ev ${f ? 'on' : ''}`} title={events[day].join(' · ')}>{events[day][0]}{events[day].length > 1 ? ` +${events[day].length - 1}` : ''}</span>}
                </button>
              );
            })}
          </div>
          <div className="cal-key">{Object.entries({ League: 'league', Europe: 'continental', Cup: 'cup', International: 'intl', NEL: 'nel', Other: 'friendly' }).map(([l, k]) => <span key={k}><i style={{ background: KIND_COL[k] }} />{l}</span>)}</div>
        </div>
      </div>
    </>
  );
}
