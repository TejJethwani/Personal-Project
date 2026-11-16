/**
 * Team sheets: every club's current line-up, the end-of-season archive, the Teams of the Season of every
 * league, the Team of the Season Cup and the best elevens in history.
 */
import { useMemo, useState } from 'react';
import type { AwardXI, Game, Pos } from '../engine/types';
import { LEAGUES } from '../engine/data/clubs';
import { ovr } from '../engine/attributes';
import { pickSheet, teamInfo, teamName } from '../engine/match/setup';
import { seasonLabel } from '../engine/competitions';
import { historyXI, TOP_LEAGUES, totsTable } from '../engine/teamsheets';
import { Card, ClubBadge, Empty, Tabs } from '../ui/kit';
import { TotwPitch } from '../ui/Totw';
import { Trophy } from '../ui/Trophy';

const lgName = (id: string) => (id === 'allstars' ? 'All-Stars' : LEAGUES.find((l) => l.id === id)?.name ?? id);
const avgOvr = (xi: AwardXI[]) => (xi.length ? Math.round(xi.reduce((s, x) => s + (x.ovr ?? 0), 0) / xi.length) : 0);
const OvrBadge = ({ v, label = 'Team OVR' }: { v: number; label?: string }) => <span className="chip b" style={{ fontSize: 13 }}>{label} <b style={{ marginLeft: 4 }}>{v}</b></span>;

function Current({ g }: { g: Game }) {
  const w = g.world, me = w.players[g.career.pid];
  const [lg, setLg] = useState(w.clubs[me.club ?? '']?.league ?? 'eng1');
  const clubs = (w.comps[lg]?.teams ?? []).filter((id) => w.clubs[id]);
  const [club, setClub] = useState<string>(me.club && clubs.includes(me.club) ? me.club : clubs[0]);
  const cid = clubs.includes(club) ? club : clubs[0];
  const xi = useMemo(() => {
    if (!cid) return null;
    const sh = pickSheet(null, w, teamInfo(w, cid));
    return { form: sh.form, xi: sh.xi.map((x) => { const p = w.players[x.pid]; return { pid: x.pid, name: p?.name ?? '?', pos: x.pos as Pos, club: cid, clubName: teamName(w, cid), rat: 0, ovr: p ? ovr(p) : 0 }; }) };
  }, [cid, w.day, w.season]);
  return (
    <div className="grid g2">
      <Card title="Clubs">
        <select value={lg} onChange={(e) => { setLg(e.target.value); setClub(''); }} aria-label="League" className="mb">{LEAGUES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <div className="col gap4">{clubs.map((id) => <button key={id} className={`btn sm ${id === cid ? 'pri' : 'ghost'}`} style={{ justifyContent: 'flex-start' }} onClick={() => setClub(id)}><span className="row gap6"><ClubBadge g={g} id={id} />{w.clubs[id].name}</span></button>)}</div>
      </Card>
      {xi && <Card title={<span className="row gap6"><ClubBadge g={g} id={cid} />{w.clubs[cid]?.name} — current XI</span>} right={<span className="row gap6"><span className="small muted">{xi.form}</span><OvrBadge v={avgOvr(xi.xi)} /></span>}>
        <TotwPitch g={g} a={{ title: w.clubs[cid]?.name, xi: xi.xi }} metric="ovr" />
        <p className="tiny dim mt">The manager's strongest available eleven today (injuries and suspensions taken into account). Numbers are overall ratings.</p>
      </Card>}
    </div>
  );
}

function Archive({ g }: { g: Game }) {
  const w = g.world;
  const seasons = Object.keys(w.sheetArchive ?? {}).map(Number).sort((a, b) => b - a);
  const [s, setS] = useState(seasons[0]);
  const [lg, setLg] = useState('eng1');
  if (!seasons.length) return <Empty>The archive starts at the end of your first professional season: every club's line-up is filed when the season closes.</Empty>;
  const sheets = w.sheetArchive![s] ?? {};
  const clubs = Object.keys(sheets).filter((id) => (w.comps[lg]?.hist.find((h) => h.s === s)?.table ?? []).some((r) => r.id === id) || w.clubs[id]?.league === lg);
  return (
    <>
      <div className="row gap6 mb wrap"><select value={s} onChange={(e) => setS(+e.target.value)} aria-label="Season">{seasons.map((x) => <option key={x} value={x}>{seasonLabel(x)}</option>)}</select><select value={lg} onChange={(e) => setLg(e.target.value)} aria-label="League">{LEAGUES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      {clubs.length ? <div className="grid g2">{clubs.map((id) => { const sh = sheets[id]; const xi: AwardXI[] = sh.xi.map(([pid, pos, o, name]) => ({ pid, pos: pos as Pos, ovr: o, name, club: id, clubName: teamName(w, id), rat: 0 })); return (
        <Card key={id} title={<span className="row gap6"><ClubBadge g={g} id={id} />{teamName(w, id)}</span>} right={<span className="row gap6"><span className="small muted">{sh.form}</span><OvrBadge v={avgOvr(xi)} /></span>}><TotwPitch g={g} a={{ title: teamName(w, id), xi }} metric="ovr" /></Card>); })}</div> : <Empty>No sheets filed for this league in {seasonLabel(s)}.</Empty>}
    </>
  );
}

function Tots({ g }: { g: Game }) {
  const w = g.world;
  const all = Object.values(w.awards).filter((a) => a.type === 'tots' && a.xi?.length === 11);
  const seasons = [...new Set(all.map((a) => a.s))].sort((a, b) => b - a);
  const [s, setS] = useState(seasons[0]);
  if (!seasons.length) return <Empty>Teams of the Season are named at the end of each league season.</Empty>;
  const list = all.filter((a) => a.s === s).sort((a, b) => LEAGUES.findIndex((l) => l.id === a.comp) - LEAGUES.findIndex((l) => l.id === b.comp));
  return (
    <>
      <div className="row gap6 mb"><select value={s} onChange={(e) => setS(+e.target.value)} aria-label="Season">{seasons.map((x) => <option key={x} value={x}>{seasonLabel(x)}</option>)}</select></div>
      <div className="grid g2">{list.map((a) => <Card key={a.id} title={<span className="row gap6"><Trophy kind="xi" size={22} />{a.compName} — Team of the Season</span>} right={<span className="row gap6"><span className="small muted">{a.form}</span>{a.xi!.some((x) => x.ovr) && <OvrBadge v={avgOvr(a.xi!)} />}</span>}><TotwPitch g={g} a={a} /></Card>)}</div>
    </>
  );
}

function LiveCup({ g }: { g: Game }) {
  const w = g.world, L = w.totsLive!;
  const table = totsTable(g);
  const fx = Object.values(w.fixtures).filter((f) => f.comp === 'totscup').sort((a, b) => a.day - b.day);
  const nm = (id: string) => (id === 'tots_allstars' ? 'All-Stars' : lgName(id.slice(5)) + ' TOTS');
  const me = g.career.pid, mine = L.made.find((id) => w.clubs[id]?.squad.includes(me));
  return (
    <Card className="hot mb" title={<span className="row gap6"><Trophy kind="club" size={26} />Team of the Season Cup {seasonLabel(L.s)} — in progress</span>} right={mine ? <span className="chip b">You: {nm(mine)}</span> : undefined}>
      <div className="grid g2">
        <table><thead><tr><th>#</th><th>Team</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GD</th><th className="n">Pts</th></tr></thead><tbody>
          {table.map((r, i) => <tr key={r.lg} className={'tots_' + r.lg === mine ? 'me' : ''}><td>{i + 1}</td><td>{lgName(r.lg)}</td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.gf - r.ga}</td><td className="n"><b>{r.pts}</b></td></tr>)}
        </tbody></table>
        <div className="small">{fx.map((f) => <div key={f.id} className={`row between ${f.h === mine || f.a === mine ? 'blue' : ''}`} style={{ padding: '2px 0' }}><span className="muted" style={{ width: 70 }}>{f.stg === 'Final' ? 'FINAL' : `Round ${f.rd}`}</span><span>{nm(f.h)}</span><b className="num">{f.played && f.sc ? `${f.sc[0]}–${f.sc[1]}${f.pens ? ` (${f.pens[0]}–${f.pens[1]} p)` : ''}` : 'v'}</b><span>{nm(f.a)}</span></div>)}</div>
      </div>
      <p className="tiny dim mt">One round a day after the summer tournament; the table-topper plays the All-Stars of every other league in the final.{mine ? ' Your matches are played like any other fixture.' : ''}</p>
    </Card>
  );
}

function Cup({ g }: { g: Game }) {
  const w = g.world;
  const cups = [...(w.totsCup ?? [])].sort((a, b) => b.s - a.s);
  const [s, setS] = useState(cups[0]?.s);
  const c = cups.find((x) => x.s === s) ?? cups[0];
  if (!c && w.totsLive) return <LiveCup g={g} />;
  if (!c) return <Empty>The Team of the Season Cup is played at the end of every season: each top league's Team of the Season meets the others, and the winner faces the All-Stars of every other league.</Empty>;
  const me = g.career.pid;
  const xiOf = (pids: string[], lg: string): AwardXI[] => pids.map((pid) => { const p = w.players[pid]; return { pid, name: p?.name ?? '?', pos: (p?.pos ?? 'CM') as Pos, club: p?.club ?? '', clubName: p?.club ? teamName(w, p.club) : lgName(lg), rat: 0, ovr: p ? ovr(p) : 0 }; });
  const finalists = [c.teams.find((t) => t.lg === c.winner)!, c.allStars];
  return (
    <>
      {w.totsLive && <LiveCup g={g} />}
      <div className="row gap6 mb"><select value={c.s} onChange={(e) => setS(+e.target.value)} aria-label="Season">{cups.map((x) => <option key={x.s} value={x.s}>{seasonLabel(x.s)}</option>)}</select></div>
      <Card className="hot mb" title={<span className="row gap6"><Trophy kind="club" size={30} />Team of the Season Cup {seasonLabel(c.s)} — {c.champion === 'allstars' ? 'All-Stars' : `${lgName(c.winner)} TOTS`} win</span>}>
        <div className="row wrap gap6" style={{ alignItems: 'center', justifyContent: 'center', fontSize: 22 }}><b>{lgName(c.winner)} TOTS</b><b className="num" style={{ fontSize: 34 }}>{c.final.sc[0]} – {c.final.sc[1]}</b><b>All-Stars</b>{c.final.pens && <span className="small muted">({c.final.pens[0]}–{c.final.pens[1]} on penalties)</span>}</div>
        {c.final.scorers.length > 0 && <p className="small muted center">⚽ {c.final.scorers.join(', ')}</p>}
      </Card>
      <div className="grid g2 mb">
        <Card title="Round robin"><table><thead><tr><th>#</th><th>Team of the Season</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GF</th><th className="n">GA</th><th className="n">Pts</th></tr></thead><tbody>
          {c.table.map((r, i) => <tr key={r.lg} className={i === 0 ? 'me' : ''}><td>{i + 1}</td><td>{lgName(r.lg)}</td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n"><b>{r.pts}</b></td></tr>)}
        </tbody></table></Card>
        <Card title="Results">{c.matches.map((m, i) => <div key={i} className="row between small" style={{ padding: '2px 0' }}><span>{lgName(m.h)}</span><b className="num">{m.sc[0]}–{m.sc[1]}</b><span>{lgName(m.a)}</span></div>)}</Card>
      </div>
      <div className="grid g2">{finalists.map((t) => { const xi = xiOf(t.xi, t.lg); return <Card key={t.lg} title={`${t.lg === 'allstars' ? 'All-Stars' : lgName(t.lg) + ' TOTS'}${t.xi.includes(me) ? ' · you' : ''}`} right={<OvrBadge v={avgOvr(xi)} />}><TotwPitch g={g} a={{ title: t.name, xi }} metric="ovr" /></Card>; })}</div>
    </>
  );
}

function History({ g }: { g: Game }) {
  const [lg, setLg] = useState<string>('all');
  const h = useMemo(() => historyXI(g, lg), [g, lg, g.world.season]);
  const opts: [string, string][] = [['all', 'All top leagues + World XIs'], ...TOP_LEAGUES.map((l) => [l.id, l.name] as [string, string]), ...LEAGUES.filter((l) => l.tier > 1).map((l) => [l.id, l.name] as [string, string])];
  return (
    <>
      <div className="row gap6 mb"><select value={lg} onChange={(e) => setLg(e.target.value)} aria-label="League">{opts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
      {h ? <Card className="hot" title={<span className="row gap6"><Trophy kind="xi" size={28} />The best XI in history — {opts.find((o) => o[0] === lg)?.[1] ?? ''}</span>} right={<OvrBadge v={h.ovr} />}>
        <TotwPitch g={g} a={{ title: 'Best XI in history', xi: h.xi }} metric="ovr" />
        <p className="tiny dim mt">Built from every Team of the Season{lg === 'all' ? ' and World Eleven' : ''} ever named, each player rated as he was in that season. The same player can appear twice, from two different seasons.</p>
        <div className="small mt">{h.xi.map((x, i) => <span key={i} className="chip" style={{ margin: 2 }}>{x.pos} {x.name} · {x.s != null ? seasonLabel(x.s) : ''} · {x.ovr}</span>)}</div>
      </Card> : <Empty>Not enough Teams of the Season yet — the history eleven appears once a season has finished.</Empty>}
    </>
  );
}

export function TeamSheets({ g }: { g: Game }) {
  const [tab, setTab] = useState('current');
  return (
    <>
      <div className="pagehead"><div><h1>Team Sheets</h1><div className="sub">Every club's line-up today and at the end of every season, the Teams of the Season, the Team of the Season Cup and the best elevens in history.</div></div></div>
      <Tabs tabs={[['current', 'Current XIs'], ['archive', 'Archive'], ['tots', 'Teams of the Season'], ['cup', 'TOTS Cup'], ['history', 'Best XI in history']]} value={tab} onChange={setTab} />
      {tab === 'current' && <Current g={g} />}
      {tab === 'archive' && <Archive g={g} />}
      {tab === 'tots' && <Tots g={g} />}
      {tab === 'cup' && <Cup g={g} />}
      {tab === 'history' && <History g={g} />}
    </>
  );
}
