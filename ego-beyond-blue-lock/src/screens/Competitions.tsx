import { useState } from 'react';
import type { Game, Fixture } from '../engine/types';
import { tableOf, compFixtures, fmtDate, seasonLabel } from '../engine/competitions';
import { teamName } from '../engine/match/setup';
import { SUPPORTED } from '../engine/season';
import { S } from '../engine/match/model';
import { seasonLines } from '../engine/awards';
import { nav } from '../store/game';
import { Card, ClubLink, Empty, PlayerLink, Tabs, Chip } from '../ui/kit';

function FixtureRow({ g, f }: { g: Game; f: Fixture }) {
  const w = g.world;
  const me = w.players[g.career.pid];
  const mine = f.h === me.club || f.a === me.club;
  return <div className="row small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)', background: mine ? 'rgba(30,167,255,.1)' : undefined }}>
    <span className="dim" style={{ width: 52 }}>{fmtDate(w, f.day)}</span><span className="grow right">{teamName(w, f.h)}</span>
    <b className="num center" style={{ width: 64 }}>{f.played ? `${f.sc![0]}–${f.sc![1]}` : 'v'}{f.pens ? '*' : ''}</b><span className="grow">{teamName(w, f.a)}</span>
    <span className="tiny dim hide-s" style={{ width: 150 }}>{f.pens ? `pens ${f.pens[0]}–${f.pens[1]}` : f.aet ? 'aet' : f.potm && w.players[f.potm] ? `⭐ ${w.players[f.potm].sn}` : ''}</span></div>;
}

export function Competitions({ g, id }: { g: Game; id?: string }) {
  const w = g.world;
  const me = w.players[g.career.pid];
  const comps = Object.values(w.comps).filter((c) => c.kind !== 'friendly' && (c.season === w.season || c.kind === 'nel' || c.kind === 'intl')).sort((a, b) => (a.kind === 'league' ? 0 : 1) - (b.kind === 'league' ? 0 : 1) || (a.tier ?? 9) - (b.tier ?? 9) || a.name.localeCompare(b.name));
  const def = id && w.comps[id] ? id : w.phase === 'nel' ? 'nel' : w.clubs[me.club ?? '']?.league ?? 'eng1';
  const c = w.comps[def];
  const [tab, setTab] = useState('table');
  const [rd, setRd] = useState<number | null>(null);
  if (!c) return <Empty>No competitions yet.</Empty>;
  const fs = compFixtures(w, c.id);
  const isLeague = c.kind === 'league' || c.kind === 'nel';
  const groups = c.stages[0]?.type === 'rr' && !isLeague ? c.stages[0].groups ?? [] : [];
  const curRd = rd ?? (fs.find((f) => !f.played)?.rd ?? fs[fs.length - 1]?.rd ?? 1);
  const rounds = [...new Set(fs.map((f) => f.rd))].sort((a, b) => a - b);
  const scorers = seasonLines(g, c.id).filter((x) => x.line[S.G] > 0 || x.line[S.A] > 0);
  const zone = (i: number, n: number) => (c.kind !== 'league' ? '' : c.tier === 1 ? (i < 4 ? 'zone-eu' : i >= n - (c.down ?? 0) ? 'zone-down' : '') : i < (c.up ?? 0) ? 'zone-up' : i < (c.up ?? 0) + (c.playoff ?? 0) ? 'zone-po' : i >= n - (c.down ?? 0) ? 'zone-down' : '');
  const Table = ({ rows }: { rows: ReturnType<typeof tableOf> }) => <div className="tw"><table><thead><tr><th>#</th><th>Team</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GF</th><th className="n">GA</th><th className="n">GD</th><th className="n">Pts</th><th className="hide-s">Form</th></tr></thead><tbody>
    {rows.map((r, i) => <tr key={r.id} className={`${r.id === me.club || r.id === me.nat ? 'me' : ''} ${zone(i, rows.length)}`}><td>{i + 1}</td><td><ClubLink g={g} id={r.id} /></td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n">{r.gf - r.ga}</td><td className="n num">{r.pts}</td><td className="hide-s">{r.form.slice(-5).map((x, k) => <span key={k} className={x === 'W' ? 'good' : x === 'L' ? 'bad' : 'muted'} style={{ marginRight: 3 }}>{x}</span>)}</td></tr>)}
  </tbody></table></div>;
  return (
    <>
      <div className="pagehead"><div><h1>{c.name}</h1><div className="sub">{c.kind === 'nel' ? 'First to three goals. Five rounds, two matches and one resting team per round.' : `${seasonLabel(c.season)} · ${c.kind}${c.done && c.champion ? ` · winners: ${teamName(w, c.champion)}` : ''}`}</div></div>
        <select value={c.id} onChange={(e) => { setRd(null); nav('competitions', e.target.value); }} aria-label="Competition">{comps.map((x) => <option key={x.id} value={x.id}>{x.name}{x.done ? ' ✓' : ''}</option>)}</select></div>
      <Tabs tabs={[['table', isLeague ? 'Table' : groups.length ? 'Groups' : 'Bracket'], ['fix', 'Fixtures & results'], ['top', 'Leaders'], ['hist', 'History']]} value={tab} onChange={setTab} />
      {tab === 'table' && (isLeague ? <Card><Table rows={tableOf(w, c.id)} />{c.kind === 'league' && <p className="tiny dim mt">{c.tier === 1 ? 'Blue: continental places. ' : 'Green: automatic promotion. Amber: play-offs. '}Red: relegation. The table is computed directly from results.</p>}</Card>
        : <div className="col">{groups.length > 0 && <div className="grid g2">{groups.map((_, gi) => <Card key={gi} title={`Group ${String.fromCharCode(65 + gi)}`}><Table rows={tableOf(w, c.id, gi)} /></Card>)}</div>}
          {c.stages.filter((s) => s.type === 'ko').map((s) => <Card key={s.name} title={s.name}>{fs.filter((f) => f.stg === s.name).map((f) => <FixtureRow key={f.id} g={g} f={f} />)}</Card>)}
          {!groups.length && !c.stages.some((s) => s.type === 'ko') && <Empty>The draw has not been made.</Empty>}</div>)}
      {tab === 'fix' && <Card>{fs.length ? <>
        <div className="row wrap mb"><button className="btn sm" onClick={() => setRd(Math.max(rounds[0], curRd - 1))}>←</button><b className="num">Round {curRd}{fs.find((f) => f.rd === curRd)?.stg ? ` · ${fs.find((f) => f.rd === curRd)!.stg}` : ''}</b><button className="btn sm" onClick={() => setRd(Math.min(rounds[rounds.length - 1], curRd + 1))}>→</button>{me.club && <Chip k="b">Your matches are highlighted</Chip>}</div>
        {fs.filter((f) => f.rd === curRd).map((f) => <FixtureRow key={f.id} g={g} f={f} />)}
        {me.club && <><h4 className="mt">Your fixtures in this competition</h4>{fs.filter((f) => f.h === me.club || f.a === me.club).map((f) => <FixtureRow key={f.id} g={g} f={f} />)}</>}</> : <Empty>Fixtures from finished competitions are archived; see History.</Empty>}</Card>}
      {tab === 'top' && <div className="grid g2">{([['Goals', S.G], ['Assists', S.A]] as const).map(([n, i]) => <Card key={n} title={n}>{scorers.length ? <table><tbody>{[...scorers].sort((a, b) => b.line[i] - a.line[i]).slice(0, 15).map((x, k) => <tr key={x.p.id} className={x.p.id === me.id ? 'me' : ''}><td className="dim">{k + 1}</td><td><PlayerLink g={g} id={x.p.id} full /></td><td className="small muted">{teamName(w, c.natTeams ? x.p.nat : x.club)}</td><td className="n num">{x.line[i]}</td></tr>)}</tbody></table> : <Empty>No data yet.</Empty>}</Card>)}</div>}
      {tab === 'hist' && <Card title="Honours (this save)">{c.hist.length ? <table><thead><tr><th>Season</th><th>Champion</th><th>Runner-up</th><th>Top scorer</th><th>Best player</th><th>Promoted</th><th>Relegated</th></tr></thead><tbody>{[...c.hist].reverse().map((h) => <tr key={h.s}><td>{seasonLabel(h.s)}</td><td><b>{h.championName}</b></td><td>{h.runnerUp ? teamName(w, h.runnerUp) : ''}</td><td>{h.topScorer ? `${h.topScorer.name} (${h.topScorer.v})` : ''}</td><td>{h.best?.name ?? ''}</td><td className="small">{h.promoted?.map((x) => w.clubs[x]?.sn).join(', ')}</td><td className="small">{h.relegated?.map((x) => w.clubs[x]?.sn).join(', ')}</td></tr>)}</tbody></table> : <Empty>No completed editions yet.</Empty>}
        {Object.keys(c.rec).length > 0 && <><h4 className="mt">Competition records (since the 2025/26 baseline)</h4>{Object.entries(c.rec).map(([k, r]) => <p key={k} className="small">Most {k} in a season: <b>{r.v}</b> — {r.name}, {r.clubName} ({seasonLabel(r.s)})</p>)}</>}</Card>}
      <p className="tiny dim mt"><b>Simulated world:</b> {SUPPORTED}</p>
    </>
  );
}
