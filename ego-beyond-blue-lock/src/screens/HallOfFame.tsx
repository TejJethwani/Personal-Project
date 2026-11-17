/**
 * Hall of Fame — the career portfolio shown when the player retires (and available at any time
 * as "legacy so far"). Everything is derived from the save: archived stat lines, the match log,
 * the timeline and the awards store.
 */
import { useState } from 'react';
import type { Game } from '../engine/types';
import { S, newLine, addLine } from '../engine/match/model';
import { seasonLabel } from '../engine/competitions';
/** International tournaments are named by the year they were played (the U-20 World Cup is every two years: 2025, 2027…);
 *  club trophies by season. One without a year in its name is the U-20 World Cup straight after the NEL. */
function trophyYear(name: string, s: number): string {
  const y = / (\d{4})$/.exec(name)?.[1];
  if (y) return y;
  return /World Cup|Euro|Copa|Nations|Asian Cup|Gold Cup/.test(name) ? String(s) : seasonLabel(s);
}
import { ovr } from '../engine/attributes';
import { NATIONS } from '../engine/data/nations';
import { retire } from '../engine/actions';
import { act, nav, autosave } from '../store/game';
import { Avatar, ConfirmButton } from '../ui/kit';
import { fmtEur } from '../engine/util';
import { TrophyStack, kindForName, kindForAward } from '../ui/Trophy';


interface SeasonAgg { s: number; clubs: string[]; line: number[]; byComp: { comp: string; compName: string; clubName: string; line: number[] }[]; trophies: string[]; awards: string[] }

export function HallOfFame({ g }: { g: Game }) {
  const w = g.world, c = g.career;
  const me = w.players[c.pid];
  const [tab, setTab] = useState('overview');
  const retired = me.retired != null;
  // ── gather
  const rows = c.statHist.map((h) => ({ s: h.s, comp: h.comp, compName: h.compName, clubName: h.clubName, line: h.line }));
  for (const cid in me.ss) if (me.ss[cid][S.APP] && !rows.some((r) => r.s === w.season && r.comp === cid)) rows.push({ s: w.season, comp: cid, compName: w.comps[cid]?.name ?? cid, clubName: w.comps[cid]?.natTeams ? NATIONS[me.nat]?.name ?? '' : w.clubs[me.club ?? '']?.name ?? '', line: me.ss[cid] });
  const trophies = c.timeline.filter((t) => t.type === 'trophy').map((t) => { const m = /^Won the (.+) with (.+)\.$/.exec(t.txt); return { s: t.s, name: m ? m[1] : t.txt, team: m ? m[2] : '', date: t.date }; });
  const myAwards = w.awardIds.map((id) => w.awards[id]).filter((a) => a && (a.winner?.pid === me.id || a.xi?.some((x) => x.pid === me.id)));
  const major = myAwards.filter((a) => !['potw', 'totw', 'potr', 'totr', 'gotm', 'totm'].includes(a.type));
  const seasons = new Map<number, SeasonAgg>();
  for (const r of rows) {
    let a = seasons.get(r.s);
    if (!a) { a = { s: r.s, clubs: [], line: newLine(), byComp: [], trophies: [], awards: [] }; seasons.set(r.s, a); }
    addLine(a.line, r.line); a.byComp.push(r);
    if (r.clubName && !a.clubs.includes(r.clubName) && !Object.values(NATIONS).some((n) => n.name === r.clubName)) a.clubs.push(r.clubName);
  }
  for (const t of trophies) seasons.get(t.s)?.trophies.push(t.name);
  for (const a of major) seasons.get(a.s)?.awards.push(a.title);
  const seasonList = [...seasons.values()].sort((a, b) => a.s - b.s);
  const total = newLine();
  for (const r of rows) addLine(total, r.line);
  const played = c.matches.filter((m) => m.line);
  const wins = played.filter((m) => m.res === 'W').length;
  const winPct = played.length ? (wins / played.length) * 100 : 0;
  const gpg = total[S.APP] ? total[S.G] / total[S.APP] : 0;
  const avg = total[S.RATN] ? total[S.RAT] / total[S.RATN] : 0;
  const peak = c.ovrLog.reduce((m, x) => Math.max(m, x.ovr), ovr(me));
  const isNation = (n: string) => Object.values(NATIONS).some((x) => x.name === n);
  const clubs = [...new Set(rows.filter((r) => !w.comps[r.comp]?.natTeams && !isNation(r.clubName)).map((r) => r.clubName).filter(Boolean))];
  const intl = rows.filter((r) => w.comps[r.comp]?.natTeams || Object.values(NATIONS).some((n) => n.name === r.clubName));
  const caps = intl.reduce((x, r) => x + r.line[S.APP], 0), intlG = intl.reduce((x, r) => x + r.line[S.G], 0);
  const sur = (me.sn || me.name).split(' ').slice(-1)[0].toUpperCase();
  const first = seasonList[0]?.s ?? w.season, last = seasonList[seasonList.length - 1]?.s ?? w.season;
  // grouped cabinet
  const cab = new Map<string, { name: string; n: number; years: string[]; team: string }>();
  for (const t of trophies) { const base = t.name.replace(/ \d{4}$/, ''); const e = cab.get(base) ?? { name: base, n: 0, years: [], team: t.team }; e.n++; e.years.push(trophyYear(t.name, t.s)); cab.set(base, e); }
  const awardCab = new Map<string, { title: string; n: number; years: string[]; type?: string }>();
  for (const a of major) { const e = awardCab.get(a.title) ?? { title: a.title, n: 0, years: [], type: a.type }; e.n++; e.years.push(seasonLabel(a.s)); awardCab.set(a.title, e); }
  // records
  const best = (f: (m: (typeof played)[number]) => number) => played.reduce<(typeof played)[number] | null>((b, m) => (!b || f(m) > f(b) ? m : b), null);
  const bestRat = best((m) => m.rat), mostG = best((m) => m.line![S.G]), bigWin = best((m) => (m.res === 'W' ? m.sc[0] - m.sc[1] : -9));
  let streak = 0, bestStreak = 0, hat = 0;
  for (const m of played) { if (m.line![S.G] > 0) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0; if (m.line![S.G] >= 3) hat++; }
  const bestSeason = seasonList.reduce<SeasonAgg | null>((b, x) => (!b || x.line[S.G] > b.line[S.G] ? x : b), null);
  const records: [string, string, string][] = [
    ['Career goals', String(total[S.G]), `${total[S.APP]} appearances · ${gpg.toFixed(2)} per game`],
    ['Career assists', String(total[S.A]), `${total[S.KP]} chances created`],
    ['Best season', bestSeason ? `${bestSeason.line[S.G]} goals` : '—', bestSeason ? `${seasonLabel(bestSeason.s)} · ${bestSeason.clubs.join(', ')}` : ''],
    ['Highest match rating', bestRat ? bestRat.rat.toFixed(1) : '—', bestRat ? `v ${bestRat.oppName}, ${bestRat.date}` : ''],
    ['Most goals in a match', mostG ? String(mostG.line![S.G]) : '—', mostG ? `v ${mostG.oppName}, ${mostG.date}` : ''],
    ['Hat-tricks', String(hat), 'three or more in a match'],
    ['Longest scoring run', `${bestStreak} matches`, 'consecutive appearances with a goal'],
    ['Player of the Match', String(total[S.POTM]), `${total[S.APP] ? Math.round((total[S.POTM] / total[S.APP]) * 100) : 0}% of appearances`],
    ['Biggest win', bigWin && bigWin.res === 'W' ? `${bigWin.sc[0]}–${bigWin.sc[1]}` : '—', bigWin && bigWin.res === 'W' ? `v ${bigWin.oppName}, ${bigWin.date}` : ''],
    ['International', `${caps} caps`, `${intlG} goals for ${NATIONS[me.nat]?.name ?? 'country'}`],
    ['Peak overall', String(peak), `potential ${me.pot}`],
    ['Career earnings', fmtEur(c.wages), `${clubs.length} club${clubs.length === 1 ? '' : 's'}`],
  ];
  const TABS: [string, string][] = [['overview', 'Overview'], ['cabinet', 'Cabinet'], ['seasons', 'Seasons'], ['stats', 'Stats'], ['records', 'Records'], ['timeline', 'Timeline'], ['results', 'Results']];
  const Stars = ({ n }: { n: number }) => <span className="hof-stars" aria-label={`${n} trophies`}>{'★'.repeat(Math.min(n, 8))}</span>;
  const stat = (v: string, l: string, k = '') => <div className={`hof-big ${k}`}><b>{v}</b><span>{l}</span></div>;
  return (
    <div className="hof">
      <header className="hof-hero">
        <div className="hof-hero-l">
          <div className="hof-kicker">{retired ? 'Hall of Fame' : 'Legacy so far'} · {seasonLabel(first)} – {seasonLabel(last)}</div>
          <h1><span>THE</span> {sur} <span className="red">ERA</span></h1>
          <p className="hof-tag">{me.name} — {me.pos}, {NATIONS[me.nat]?.name}. {seasonList.length} season{seasonList.length === 1 ? '' : 's'}, {clubs.length} club{clubs.length === 1 ? '' : 's'}, {trophies.length} troph{trophies.length === 1 ? 'y' : 'ies'}. {retired ? c.retiredNote ?? 'The boots are hung up; the numbers stay.' : 'The story is still being written.'}</p>
          <div className="hof-bigrow">{stat(String(trophies.length), 'Trophies', 'gold')}{stat(String(seasonList.length), 'Seasons')}{stat(`${winPct.toFixed(1)}%`, 'Win rate')}{stat(gpg.toFixed(2), 'Goals / game', 'red')}</div>
          <div className="row wrap gap6" style={{ marginTop: 18 }}>
            {!retired && <ConfirmButton className="btn danger" label={`Retire now (age ${w.season - me.born})`} confirm="Confirm retirement — this ends the playable career" onConfirm={() => { act((x) => retire(x)); autosave(true); }} />}
            <button className="btn ghost" onClick={() => nav('history')}>Career history</button>
            {!retired && <button className="btn ghost" onClick={() => nav('hub')}>Back to career</button>}
          </div>
        </div>
        <div className="hof-card">
          <div className="hof-card-in">
            <div className="hof-card-top"><div><b>{peak}</b><span>PEAK</span><i>{me.pos}</i></div><Avatar look={c.look} size={132} kit={w.clubs[me.club ?? '']?.col[0] ?? '#b8891f'} /></div>
            <div className="hof-card-name">{me.name}</div>
            <div className="hof-card-grid">
              <div><b>{total[S.APP]}</b><span>APPS</span></div><div><b>{total[S.G]}</b><span>GOALS</span></div><div><b>{total[S.A]}</b><span>ASSISTS</span></div>
              <div><b>{avg ? avg.toFixed(2) : '—'}</b><span>AVG</span></div><div><b>{total[S.POTM]}</b><span>POTM</span></div><div><b>{major.length}</b><span>AWARDS</span></div>
            </div>
          </div>
        </div>
      </header>
      <nav className="hof-nav" aria-label="Hall of fame sections">{TABS.map(([id, l]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}</nav>

      {tab === 'overview' && <>
        <section className="hof-sec"><div className="hof-kicker">01 — The numbers</div><h2>A CAREER IN <span className="gold">FULL</span></h2>
          <div className="hof-strip">{([['Appearances', total[S.APP]], ['Goals', total[S.G]], ['Assists', total[S.A]], ['Shots', total[S.SH]], ['xG', total[S.XG].toFixed(1)], ['Key passes', total[S.KP]], ['Dribbles', total[S.DC]], ['Tackles won', total[S.TKW]], ['Caps', caps]] as [string, number | string][]).map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
        </section>
        <section className="hof-sec"><div className="hof-kicker">02 — Silverware</div><h2>THE <span className="gold">CABINET</span></h2>
          {cab.size ? <div className="hof-cab">{[...cab.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((t) => <div key={t.name} className="hof-trophy"><div className="spot" /><TrophyStack kind={kindForName(t.name)} n={t.n} size={64} title={t.name} /><div className="plaque"><b>{t.name}</b><span>×{t.n} · {t.years.join(', ')}</span></div></div>)}</div> : <p className="hof-empty">No team trophies{retired ? '' : ' yet'}.</p>}
          {awardCab.size > 0 && <><h3 className="hof-h3">Individual silverware</h3><div className="hof-cab small">{[...awardCab.values()].sort((a, b) => (b.type === 'world_player' ? 1 : 0) - (a.type === 'world_player' ? 1 : 0) || b.n - a.n).map((t) => <div key={t.title} className="hof-trophy"><div className="spot" /><TrophyStack kind={t.type ? kindForAward(t.type) : 'player'} n={t.n} size={48} title={t.title} /><div className="plaque"><b>{t.title}</b><span>×{t.n} · {t.years.slice(0, 6).join(', ')}{t.years.length > 6 ? '…' : ''}</span></div></div>)}</div></>}
        </section>
        <section className="hof-sec"><div className="hof-kicker">03 — The clubs</div><h2>WHERE IT <span className="red">HAPPENED</span></h2>
          <div className="hof-clubs">{clubs.map((n) => { const l = newLine(); for (const r of rows) if (r.clubName === n && !w.comps[r.comp]?.natTeams) addLine(l, r.line); return <div key={n}><b>{n}</b><span>{l[S.APP]} apps · {l[S.G]} goals · {l[S.A]} assists</span></div>; })}{caps > 0 && <div><b>{NATIONS[me.nat]?.name}</b><span>{caps} caps · {intlG} goals</span></div>}</div>
        </section>
      </>}

      {tab === 'cabinet' && <section className="hof-sec"><div className="hof-kicker">Silverware</div><h2>EVERY <span className="gold">HONOUR</span></h2>
        {cab.size ? <div className="hof-cab">{[...cab.values()].sort((a, b) => b.n - a.n).map((t) => <div key={t.name} className="hof-trophy"><div className="spot" /><TrophyStack kind={kindForName(t.name)} n={t.n} size={64} title={t.name} /><div className="plaque"><b>{t.name}</b><span>×{t.n} · {t.years.join(', ')}</span><span>{t.team}</span></div></div>)}</div> : <p className="hof-empty">No team trophies{retired ? '' : ' yet'}.</p>}
        <h3 className="hof-h3">Individual awards</h3>
        {awardCab.size ? <div className="hof-cab small">{[...awardCab.values()].sort((a, b) => b.n - a.n).map((t) => <div key={t.title} className="hof-trophy"><div className="spot" /><TrophyStack kind={t.type ? kindForAward(t.type) : 'player'} n={t.n} size={44} title={t.title} /><div className="plaque"><b>{t.title}</b><span>×{t.n} · {t.years.slice(0, 6).join(', ')}{t.years.length > 6 ? '…' : ''}</span></div></div>)}</div> : <p className="hof-empty">No individual awards{retired ? '' : ' yet'}.</p>}
        <p className="hof-note">Weekly and monthly awards won: {myAwards.length - major.length}.</p>
      </section>}

      {tab === 'seasons' && <section className="hof-sec"><div className="hof-kicker">Season by season</div><h2>THE <span className="red">CAMPAIGNS</span></h2>
        <div className="hof-seasons">{seasonList.map((a, i) => <div key={a.s} className={`hof-season ${a.trophies.length ? 'won' : ''}`}>
          <div className="top"><span className="no">{String(i + 1).padStart(2, '0')}</span><div><b>{seasonLabel(a.s)}</b><span>{a.clubs.join(' / ') || '—'}</span></div><Stars n={a.trophies.length} /></div>
          <div className="nums"><div><b>{a.line[S.APP]}</b><span>Apps</span></div><div><b>{a.line[S.G]}</b><span>Goals</span></div><div><b>{a.line[S.A]}</b><span>Assists</span></div><div><b>{a.line[S.RATN] ? (a.line[S.RAT] / a.line[S.RATN]).toFixed(2) : '—'}</b><span>Avg</span></div></div>
          <div className="chips">{a.trophies.map((t, k) => <span key={'t' + k} className="gold">🏆 {t}</span>)}{a.awards.slice(0, 6).map((t, k) => <span key={'a' + k}>🏅 {t}</span>)}</div>
          <div className="comps">{a.byComp.map((r, k) => <div key={k}><span>{r.compName}</span><span>{r.line[S.APP]} · {r.line[S.G]}G · {r.line[S.A]}A</span></div>)}</div>
        </div>)}</div>
      </section>}

      {tab === 'stats' && <section className="hof-sec"><div className="hof-kicker">By competition</div><h2>THE <span className="gold">LEDGER</span></h2>
        <div className="tw"><table className="hof-table"><thead><tr><th>Season</th><th>Team</th><th>Competition</th><th className="n">Apps</th><th className="n">Min</th><th className="n">G</th><th className="n">A</th><th className="n">Shots</th><th className="n">xG</th><th className="n">KP</th><th className="n">POTM</th><th className="n">Avg</th></tr></thead><tbody>
          {[...rows].sort((a, b) => b.s - a.s).map((r, i) => <tr key={i}><td>{seasonLabel(r.s)}</td><td>{r.clubName}</td><td>{r.compName}</td><td className="n">{r.line[S.APP]}</td><td className="n">{Math.round(r.line[S.SEC] / 60)}</td><td className="n"><b>{r.line[S.G]}</b></td><td className="n">{r.line[S.A]}</td><td className="n">{r.line[S.SH]}</td><td className="n">{r.line[S.XG].toFixed(1)}</td><td className="n">{r.line[S.KP]}</td><td className="n">{r.line[S.POTM]}</td><td className="n">{r.line[S.RATN] ? (r.line[S.RAT] / r.line[S.RATN]).toFixed(2) : '—'}</td></tr>)}
          <tr className="tot"><td colSpan={3}>Career</td><td className="n">{total[S.APP]}</td><td className="n">{Math.round(total[S.SEC] / 60)}</td><td className="n"><b>{total[S.G]}</b></td><td className="n">{total[S.A]}</td><td className="n">{total[S.SH]}</td><td className="n">{total[S.XG].toFixed(1)}</td><td className="n">{total[S.KP]}</td><td className="n">{total[S.POTM]}</td><td className="n">{avg ? avg.toFixed(2) : '—'}</td></tr>
        </tbody></table></div>
      </section>}

      {tab === 'records' && <section className="hof-sec"><div className="hof-kicker">Personal bests</div><h2>THE <span className="red">RECORDS</span></h2>
        <div className="hof-records">{records.map(([l, v, d]) => <div key={l}><span>{l}</span><b>{v}</b><i>{d}</i></div>)}</div>
      </section>}

      {tab === 'timeline' && <section className="hof-sec"><div className="hof-kicker">Milestones</div><h2>THE <span className="gold">TIMELINE</span></h2>
        <div className="hof-time">{c.timeline.filter((t) => !/^(Team of the (Week|Round|Month)|Player of the (Week|Round)|Goal of the Month)\b/.test(t.txt)).map((t, i) => <div key={i} className={t.type}><span>{t.date}</span><p>{t.txt}</p></div>)}</div>
      </section>}

      {tab === 'results' && <section className="hof-sec"><div className="hof-kicker">Results · {played.length} on record</div><h2>EVERY RESULT ON <span className="red">RECORD</span></h2>
        <div className="hof-results">{[...c.matches].reverse().slice(0, 400).map((m) => <div key={m.fid} className="hof-res">
          <span className="d">{m.date}<i>{m.compName}</i></span>
          <span className={`r ${m.res}`}>{m.res}</span>
          <span className="sc">{m.sc[0]}–{m.sc[1]}</span>
          <span className="o">{m.home ? 'v' : '@'} {m.oppName}</span>
          <span className="ch">{m.line ? <>{m.line[S.G] > 0 && <em className="g">⚽ ×{m.line[S.G]}</em>}{m.line[S.A] > 0 && <em>🅰 ×{m.line[S.A]}</em>}{m.potm && <em className="gold">★ MOTM</em>}{m.rat > 0 && <em className="rt">{m.rat.toFixed(1)}</em>}</> : <em className="dim">unused</em>}</span>
        </div>)}</div>
        {c.matches.length > 400 && <p className="hof-note">Showing the most recent 400 of {c.matches.length} recorded matches.</p>}
      </section>}
    </div>
  );
}
