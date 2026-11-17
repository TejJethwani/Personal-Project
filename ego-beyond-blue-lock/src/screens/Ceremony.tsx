/**
 * Award ceremonies.
 *  - End of the club season: the league's Awards Night, then the World Football Gala.
 *  - Late October: the Ballon d'Or Gala, a separate night judged by 100 journalists, with the
 *    Kopa, Yashin, Gerd Müller and Johan Cruyff trophies, Club of the Year, the Dream Team and the
 *    30-to-1 countdown. Every vote can be inspected afterwards.
 * Every part can be skipped: one award, a whole section, or straight to the headline award.
 * Purely presentational: the awards were already decided by the engine.
 */
import { ordinal } from '../engine/util';
import { useEffect, useMemo, useState } from 'react';
import type { Award, AwardNom, Game } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { BDO_POINTS } from '../engine/ballondor';
import { NATIONS } from '../engine/data/nations';
import { act, nav, getGame } from '../store/game';
import { PlayerAvatar, ClubBadge } from '../ui/kit';
import { Trophy, kindForAward } from '../ui/Trophy';

const LEAGUE = ['signing_s', 'ironman', 'potm_king', 'boot', 'veteran', 'breakout', 'ballwinner', 'dribbler', 'glove', 'def_s', 'mid_s', 'fwd_s', 'playmaker', 'manager_s', 'ypots', 'tots', 'pots'];
const WORLD = ['world_potm', 'world_scorer', 'golden_shoe', 'world_goal', 'world_veteran', 'world_breakout', 'world_ballwinner', 'world_dribbler', 'world_playmaker', 'world_gk', 'world_def', 'world_mid', 'world_fwd', 'world_club', 'world_manager', 'world_xi', 'world_young'];
const GALA = ['kopa', 'yashin', 'muller', 'cruyff', 'bdo_club', 'bdo_xi', 'world_player', 'super_bdo'];

export function ceremonyAwards(g: Game, s: number): Award[] {
  const w = g.world, me = w.players[g.career.pid];
  let lg = '';
  for (const h of g.career.statHist) if (h.s === s && w.comps[h.comp]?.kind === 'league') lg = h.comp;
  if (!lg) for (const cid in me.ss) if (w.comps[cid]?.kind === 'league') lg = cid;
  if (!lg) lg = 'eng1';
  const out: Award[] = [];
  for (const t of LEAGUE) { const a = w.awards[`${t}:${lg}:${s}`]; if (a) out.push(a); }
  for (const t of WORLD) { const a = w.awards[`${t}:world:${s}`]; if (a) out.push(a); }
  return out;
}
export function galaAwards(g: Game, s: number): Award[] { return GALA.map((t) => g.world.awards[`${t}:bdo:${s}`]).filter(Boolean); }
/** Which ceremony is waiting: the Ballon d'Or gala takes precedence (it is the newer event). */
export function pendingCeremony(g: Game): { kind: 'gala' | 'season'; s: number } | null {
  const f = g.career.flags;
  if (f.gala != null && f.gala !== f.galaSeen) return { kind: 'gala', s: Number(f.gala) };
  if (f.ceremony != null && f.ceremony !== f.ceremonySeen) return { kind: 'season', s: Number(f.ceremony) };
  return null;
}

function Face({ g, n, size }: { g: Game; n: AwardNom; size: number }) {
  const p = n.pid ? g.world.players[n.pid] : null;
  return p ? <PlayerAvatar g={g} p={p} size={size} /> : <div style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}><ClubBadge g={g} id={n.club} lg /></div>;
}

/** Ballon d'Or: 30 → 4 scroll past with their points, then the podium is revealed one place at a time. */
function Countdown({ g, a, onDone, onVotes }: { g: Game; a: Award; onDone: () => void; onVotes?: () => void }) {
  const noms = a.noms ?? [];
  const n = noms.length;
  const [shown, setShown] = useState(0);
  const me = g.career.pid;
  const fast = Math.max(0, n - 3);
  useEffect(() => {
    if (shown >= fast) return;
    const t = setTimeout(() => setShown((x) => x + 1), g.settings.reduceMotion ? 30 : shown < fast - 7 ? 260 : 620);
    return () => clearTimeout(t);
  }, [shown, fast, g.settings.reduceMotion]);
  const pts = a.votes ? ' pts' : '';
  const visible = noms.map((x, i) => ({ x, i })).filter(({ i }) => n - i <= shown);
  const podium = shown - fast;
  const myIdx = noms.findIndex((x) => x.pid === me);
  return (
    <div className="cer-count">
      <div className="cer-board">{visible.filter(({ i }) => i >= 3).map(({ x, i }) => <div key={x.pid + i} className={`cer-row ${x.pid === me ? 'me' : ''}`}><span className="pl">{i + 1}</span><Face g={g} n={x} size={34} /><b>{x.name}{pts && <span className="cer-pts">{x.score}{pts}</span>}</b><i>{x.clubName}</i><em>{x.line}</em></div>)}</div>
      {shown >= fast && <div className="cer-podium">{[2, 1, 0].map((i) => noms[i] && (podium > 2 - i ? <div key={i} className={`cer-pod p${i + 1} ${noms[i].pid === me ? 'me' : ''}`}><span className="pl">{i === 0 ? 'WINNER' : i === 1 ? '2ND' : '3RD'}</span><div className={i === 0 ? 'cer-walk' : 'cer-walk small'}><Face g={g} n={noms[i]} size={i === 0 ? 132 : 92} /></div>{i === 0 && <div className="cer-handover"><Trophy kind={a.type === 'super_bdo' ? 'ballon' : kindForAward(a.type)} size={74} /></div>}{i === 0 && <Confetti />}<b>{noms[i].name}</b><i>{noms[i].clubName}</i>{pts && <span className="cer-pts big">{noms[i].score} points</span>}<em>{noms[i].line}</em></div> : <div key={i} className={`cer-pod p${i + 1} wait`}><span className="pl">{i === 0 ? '1ST' : i === 1 ? '2ND' : '3RD'}</span><div className="q">?</div></div>))}</div>}
      {shown < fast ? <button className="btn" onClick={() => setShown(fast)}>Skip to the podium</button>
        : podium < 3 ? <div className="row gap6" style={{ justifyContent: 'center' }}><button className="btn pri big" onClick={() => setShown((x) => x + 1)}>{podium === 0 ? 'Third place is…' : podium === 1 ? 'The runner-up is…' : `✉ And the ${a.title} goes to…`}</button><button className="btn ghost" onClick={() => setShown(fast + 3)}>Reveal all</button></div>
          : <><p className="cer-why">{a.why}</p>{noms[0]?.pid === me ? <div className="cer-you">The best player in the world. That is you.</div> : myIdx > 0 ? <div className="cer-you">You finished {ordinal(myIdx + 1)}.</div> : null}
            <div className="row gap6" style={{ justifyContent: 'center' }}>{onVotes && <button className="btn big" onClick={onVotes}>🗳 How the journalists voted</button>}<button className="btn pri big" onClick={onDone}>Close the gala</button></div></>}
    </div>
  );
}

/** Paper confetti for the moment the winner takes the trophy. */
function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${0.9 + (i % 9) * 0.12}s`, background: ['#f6d77a', '#fff3c9', '#d7a938', '#3df2ff', '#ff6b6b'][i % 5], transform: `rotate(${i * 23}deg)` }} />)}</div>;
}

/** Every journalist's ballot, with a points table and a filter for one player. */
export function VotesPanel({ g, a, onClose }: { g: Game; a: Award; onClose?: () => void }) {
  const w = g.world, me = g.career.pid;
  const votes = a.votes ?? [];
  const [who, setWho] = useState<string>(votes.some((v) => v.picks.includes(me)) ? me : a.winner?.pid ?? '');
  const [q, setQ] = useState('');
  const name = (pid: string) => a.noms?.find((n) => n.pid === pid)?.name ?? w.players[pid]?.name ?? pid;
  const tally = useMemo(() => {
    const t: Record<string, { pts: number; byPlace: number[] }> = {};
    for (const v of votes) v.picks.forEach((pid, i) => { const e = (t[pid] ??= { pts: 0, byPlace: Array(10).fill(0) }); e.pts += BDO_POINTS[i]; e.byPlace[i]++; });
    return Object.entries(t).sort((x, y) => y[1].pts - x[1].pts);
  }, [votes]);
  const list = votes.filter((v) => (!who || v.picks.includes(who)) && (!q || `${v.j} ${v.out} ${NATIONS[v.nat]?.name}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="votes">
      <div className="row between wrap"><h2 style={{ margin: 0 }}>🗳 The {seasonLabel(a.s)} Ballon d'Or ballots</h2>{onClose && <button className="btn sm" onClick={onClose}>Back</button>}</div>
      <p className="small muted">{votes.length} journalists, one per nation. Each ranked ten players: {BDO_POINTS.join(', ')} points.</p>
      <div className="votes-grid">
        <div className="votes-tally"><table><thead><tr><th>#</th><th>Player</th><th className="n">Pts</th><th className="n">1st</th><th className="n">Top 3</th><th className="n">Ballots</th><th className="n" title="Average position on the ballots that named him">Avg pos</th></tr></thead><tbody>
          {tally.slice(0, 30).map(([pid, e], i) => <tr key={pid} className={`${pid === who ? 'sel' : ''} ${pid === me ? 'me' : ''}`} onClick={() => setWho(pid === who ? '' : pid)} style={{ cursor: 'pointer' }}><td>{i + 1}</td><td>{name(pid)}</td><td className="n"><b>{e.pts}</b></td><td className="n">{e.byPlace[0]}</td><td className="n">{e.byPlace[0] + e.byPlace[1] + e.byPlace[2]}</td><td className="n">{e.byPlace.reduce((x, y) => x + y, 0)}</td><td className="n" title={e.byPlace.map((c2, k) => c2 ? `${ordinal(k + 1)}: ${c2}` : '').filter(Boolean).join(' · ')}>{(e.byPlace.reduce((x, c2, k) => x + c2 * (k + 1), 0) / Math.max(1, e.byPlace.reduce((x, y) => x + y, 0))).toFixed(2)}</td></tr>)}
        </tbody></table><p className="tiny dim">Points come from every ballot, not just first places: a player ranked 2nd on many ballots can outscore one with an extra first place but more 4th–10th places. Hover "Avg pos" for the full spread. Click a player to see only the ballots that include him.</p></div>
        <div>
          <div className="row gap6 wrap mb"><input placeholder="Search journalist or nation" value={q} onChange={(e) => setQ(e.target.value)} />{who && <span className="chip">Showing ballots naming {name(who)} <button className="btn sm ghost" onClick={() => setWho('')}>×</button></span>}<span className="small muted">{list.length} ballots</span></div>
          <div className="votes-list">{list.map((v) => { const at = who ? v.picks.indexOf(who) : -1; return (
            <div key={v.nat} className="ballot"><div className="hd"><ClubBadge g={g} id={v.nat} /> <b>{v.j}</b> <span className="tiny muted">{v.out}</span>{at >= 0 && <span className="chip b" style={{ marginLeft: 'auto' }}>{ordinal(at + 1)} · {BDO_POINTS[at]} pts</span>}</div>
              <ol>{v.picks.map((pid, i) => <li key={pid} className={`${pid === who ? 'sel' : ''} ${pid === me ? 'me' : ''}`}>{name(pid)}</li>)}</ol></div>); })}</div>
        </div>
      </div>
    </div>
  );
}

export function Ceremony({ g }: { g: Game }) {
  const pend = pendingCeremony(g);
  const gala = pend?.kind === 'gala';
  const s = pend?.s ?? g.world.season - 1;
  const list = gala ? galaAwards(g, s) : ceremonyAwards(g, s);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 nominees, 1 drumroll, 2 winner
  const [intro, setIntro] = useState(gala);
  const [votes, setVotes] = useState(false);
  const me = g.career.pid;
  const done = () => { act((x) => { if (gala) x.career.flags.galaSeen = s; else x.career.flags.ceremonySeen = s; }); const g2 = getGame(); const nx = g2 && pendingCeremony(g2); if (nx) { setI(0); setStage(0); setIntro(nx.kind === 'gala'); setVotes(false); } else nav('hub'); };
  useEffect(() => { if (stage !== 1) return; const t = setTimeout(() => setStage(2), g.settings.reduceMotion ? 200 : 1700); return () => clearTimeout(t); }, [stage, g.settings.reduceMotion]);
  if (!list.length) return <div className="cer"><div className="cer-stage"><h1>No ceremony this season</h1><button className="btn pri" onClick={done}>Continue</button></div></div>;
  const a = list[Math.min(i, list.length - 1)];
  const last = i >= list.length - 1;
  const world = a.comp === 'world';
  const mine = a.winner?.pid === me || !!a.xi?.some((x) => x.pid === me);
  const noms = a.noms ?? (a.winner ? [a.winner] : []);
  const shuffled = [...noms].slice(0, 5).sort((x, y) => (x.name < y.name ? -1 : 1));
  const go = (k: number) => { setI(Math.max(0, Math.min(list.length - 1, k))); setStage(0); };
  const next = () => { if (last) done(); else go(i + 1); };
  const big = a.type === 'world_player';
  const firstWorld = list.findIndex((x) => x.comp === 'world');
  const bigIdx = list.findIndex((x) => x.type === 'world_player' || x.type === 'pots');
  const sectionEnd = !gala && firstWorld > i ? firstWorld : list.length - 1;
  if (gala && intro) {
    const bdo = list.find((x) => x.type === 'world_player');
    const nominees = [...(bdo?.noms ?? [])].sort((x, y) => (x.name < y.name ? -1 : 1));
    return (
      <div className="cer gala big">
        <div className="cer-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="cer-stage">
          <div className="cer-kicker">Théâtre du Châtelet · Paris · {seasonLabel(s)}</div>
          <div className="cer-trophy"><Trophy kind="ballon" size={120} /></div>
          <h1>Ballon d'Or Gala</h1>
          <p className="cer-why">The red carpet. Thirty nominees, chosen by the whole of the {seasonLabel(s)} season and the summer that followed it. One hundred journalists have voted.</p>
          <div className="cer-carpet">{nominees.map((n, k) => <div key={n.pid} className={n.pid === me ? 'me' : ''} style={{ animationDelay: `${k * 50}ms` }}><Face g={g} n={n} size={46} /><b>{n.name}</b><i>{n.clubName}</i></div>)}</div>
          <div className="row gap6" style={{ justifyContent: 'center' }}><button className="btn pri big" onClick={() => setIntro(false)}>Take your seats ▶</button><button className="btn big" onClick={() => { setIntro(false); go(Math.max(0, list.findIndex((x) => x.type === 'world_player'))); }}>Straight to the Ballon d'Or</button></div>
          <button className="btn ghost sm cer-skip" onClick={done}>Skip ceremony</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`cer ${big ? 'big' : ''} ${world ? 'world' : ''} ${gala ? 'gala' : ''}`}>
      <div className="cer-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="cer-stage">
        <div className="cer-kicker">{seasonLabel(s)} · {gala ? "Ballon d'Or Gala" : world ? 'World Football Gala' : `${a.compName} Awards Night`} · {i + 1} / {list.length}</div>
        <div className="cer-trophy" key={'t' + a.id}><Trophy kind={kindForAward(a.type)} size={big ? 110 : 76} /></div>
        <div className="cer-comp">{a.compName}{a.mode === 'rank' ? ' · decided by the numbers' : a.xi ? '' : a.votes ? ' · journalists’ vote' : ' · voted'}</div>
        <h1 key={a.id}>{a.title}</h1>
        {big && noms.length >= 5 ? <Countdown key={a.id} g={g} a={a} onDone={next} onVotes={a.votes ? () => setVotes(true) : undefined} />
          : a.xi ? (
            stage < 2 ? <><p className="cer-why">{a.why}</p><button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'The eleven are…' : 'Reveal the eleven'}</button></>
              : <div className="cer-xi">{a.xi.map((x, k) => <div key={x.pid} className={x.pid === me ? 'me' : ''} style={{ animationDelay: `${k * 90}ms` }}><span>{x.pos}</span><b>{x.name}</b><i>{x.clubName}</i></div>)}</div>
          ) : a.mode === 'rank' ? (
            <div className="cer-rank">{noms.slice(0, 8).map((n, k, arr) => <div key={n.pid + k} className={`cer-row ${k === 0 ? 'first' : ''} ${n.pid === me ? 'me' : ''}`} style={{ animationDelay: `${(arr.length - 1 - k) * 260}ms` }}><span className="pl">{k + 1}</span><Face g={g} n={n} size={k === 0 ? 56 : 36} /><b>{n.name}</b><i>{n.clubName}</i><em>{n.line}</em></div>)}</div>
          ) : stage < 2 ? (
            <>
              <div className="cer-noms">{shuffled.map((n, k) => <div key={n.pid + n.name} className={`cer-nom ${n.pid === me ? 'me' : ''} ${stage === 1 ? 'roll' : ''}`} style={{ animationDelay: `${k * 120}ms` }}><Face g={g} n={n} size={76} /><b>{n.name}</b><span>{n.clubName}</span><i>{n.line}</i></div>)}</div>
              <div className="row gap6" style={{ justifyContent: 'center' }}><button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'And the winner is…' : '✉ Open the envelope'}</button>{stage === 0 && <button className="btn ghost" onClick={() => setStage(2)}>Skip the suspense</button>}</div>
            </>
          ) : a.winner ? (
            <div className={`cer-win ${a.winner.pid === me ? 'me' : ''}`}>
              <div className="burst" aria-hidden="true" />
              <Confetti />
              <div className="cer-walk"><Face g={g} n={a.winner} size={150} /></div>
              <div className="cer-handover"><Trophy kind={kindForAward(a.type)} size={80} /></div>
              <div className="nm">{a.winner.name}</div>
              <div className="cl">{a.winner.clubName}</div>
              <div className="ln">{a.winner.line}</div>
              {a.winner.pid === me && <div className="you">That is you. Walk up and take it.</div>}
            </div>
          ) : null}
        {!big && (stage === 2 || a.mode === 'rank') && !(a.xi && stage < 2) && <><p className="cer-why">{a.why}</p>{mine && a.xi && <div className="cer-you">You are in the eleven.</div>}{mine && a.mode === 'rank' && <div className="cer-you">Top of the table: you.</div>}<button className="btn pri big" onClick={next}>{last ? 'End of the ceremony' : i + 1 === firstWorld ? 'On to the World Football Gala ▶' : list[i + 1]?.type === 'world_player' ? "The Ballon d'Or ▶" : list[i + 1]?.type === 'super_bdo' ? "The Super Ballon d'Or ▶" : 'Next award ▶'}</button></>}
        {/* skipping: one award, a section, or straight to the headline award */}
        <div className="cer-skips">
          {!last && !big && <button className="btn ghost sm" onClick={next}>Skip this award</button>}
          {!gala && i < firstWorld && firstWorld > 0 && <button className="btn ghost sm" onClick={() => go(firstWorld)}>Skip to the World Football Gala</button>}
          {!gala && sectionEnd > i && sectionEnd !== firstWorld && <button className="btn ghost sm" onClick={() => go(sectionEnd)}>Skip to the last award</button>}
          {bigIdx > i && <button className="btn ghost sm" onClick={() => go(bigIdx)}>{gala ? "Skip to the Ballon d'Or" : 'Skip to Player of the Season'}</button>}
          {i > 0 && <button className="btn ghost sm" onClick={() => go(i - 1)}>◀ Previous</button>}
        </div>
        <button className="btn ghost sm cer-skip" onClick={done}>Skip ceremony</button>
      </div>
      {votes && a.votes && <div className="votes-ov" role="dialog" aria-label="Ballon d'Or ballots"><div className="cer-stage"><VotesPanel g={g} a={a} onClose={() => setVotes(false)} /></div></div>}
    </div>
  );
}
