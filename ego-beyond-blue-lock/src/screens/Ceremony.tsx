/**
 * End-of-season awards: first the league gala, then the world football gala.
 *  - awards decided by one published number (Golden Boot, Golden Shoe…) are read out as a ranking;
 *  - judged awards are presented with nominees and an envelope;
 *  - the Ballon d'Or is counted down from 30th place to the podium.
 * Purely presentational: the awards were already decided by the engine at the end of the season.
 */
import { useEffect, useState } from 'react';
import type { Award, AwardNom, Game } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { act, nav } from '../store/game';
import { PlayerAvatar, ClubBadge } from '../ui/kit';

const LEAGUE = ['signing_s', 'ironman', 'potm_king', 'boot', 'veteran', 'breakout', 'ballwinner', 'dribbler', 'glove', 'def_s', 'mid_s', 'fwd_s', 'playmaker', 'manager_s', 'ypots', 'tots', 'pots'];
const WORLD = ['world_potm', 'world_scorer', 'golden_shoe', 'world_goal', 'world_veteran', 'world_breakout', 'world_ballwinner', 'world_dribbler', 'world_playmaker', 'world_gk', 'world_def', 'world_mid', 'world_fwd', 'world_club', 'world_manager', 'world_xi', 'world_young', 'world_player'];

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

function Face({ g, n, size }: { g: Game; n: AwardNom; size: number }) {
  const p = n.pid ? g.world.players[n.pid] : null;
  return p ? <PlayerAvatar g={g} p={p} size={size} /> : <div style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}><ClubBadge g={g} id={n.club} lg /></div>;
}

/** Ballon d'Or: 30 → 4 scroll past, then the podium is revealed one place at a time. */
function Countdown({ g, a, onDone }: { g: Game; a: Award; onDone: () => void }) {
  const noms = a.noms ?? [];
  const n = noms.length;
  const [shown, setShown] = useState(0); // how many places (from the bottom) have been read out
  const me = g.career.pid;
  const fast = Math.max(0, n - 3);
  useEffect(() => {
    if (shown >= fast) return;
    const t = setTimeout(() => setShown((x) => x + 1), g.settings.reduceMotion ? 30 : shown < fast - 7 ? 260 : 620);
    return () => clearTimeout(t);
  }, [shown, fast, g.settings.reduceMotion]);
  const place = (i: number) => i + 1; // noms are sorted best first
  const visible = noms.map((x, i) => ({ x, i })).filter(({ i }) => n - i <= shown).slice(0, 30);
  const podium = shown - fast; // 0..3
  return (
    <div className="cer-count">
      <div className="cer-roll">{visible.filter(({ i }) => i >= 3).slice(0, 9).map(({ x, i }) => <div key={x.pid + i} className={`cer-row ${x.pid === me ? 'me' : ''}`}><span className="pl">{place(i)}</span><Face g={g} n={x} size={34} /><b>{x.name}</b><i>{x.clubName}</i><em>{x.line}</em></div>)}</div>
      {shown >= fast && <div className="cer-podium">{[2, 1, 0].map((i) => noms[i] && (podium > 2 - i ? <div key={i} className={`cer-pod p${i + 1} ${noms[i].pid === me ? 'me' : ''}`}><span className="pl">{i === 0 ? 'WINNER' : i === 1 ? '2ND' : '3RD'}</span><Face g={g} n={noms[i]} size={i === 0 ? 132 : 92} /><b>{noms[i].name}</b><i>{noms[i].clubName}</i><em>{noms[i].line}</em></div> : <div key={i} className={`cer-pod p${i + 1} wait`}><span className="pl">{i === 0 ? '1ST' : i === 1 ? '2ND' : '3RD'}</span><div className="q">?</div></div>))}</div>}
      {shown < fast ? <button className="btn" onClick={() => setShown(fast)}>Skip to the podium</button>
        : podium < 3 ? <button className="btn pri big" onClick={() => setShown((x) => x + 1)}>{podium === 0 ? 'Third place is…' : podium === 1 ? 'The runner-up is…' : `✉ And the ${a.title} goes to…`}</button>
          : <><p className="cer-why">{a.why}</p>{noms[0]?.pid === me && <div className="cer-you">The best player in the world. That is you.</div>}<button className="btn pri big" onClick={onDone}>Close the gala</button></>}
    </div>
  );
}

export function Ceremony({ g }: { g: Game }) {
  const s = Number(g.career.flags.ceremony ?? g.world.season - 1);
  const list = ceremonyAwards(g, s);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 nominees, 1 drumroll, 2 winner
  const me = g.career.pid;
  const done = () => { act((x) => { x.career.flags.ceremonySeen = s; }); nav('hub'); };
  useEffect(() => { if (stage !== 1) return; const t = setTimeout(() => setStage(2), g.settings.reduceMotion ? 200 : 1700); return () => clearTimeout(t); }, [stage, g.settings.reduceMotion]);
  if (!list.length) return <div className="cer"><div className="cer-stage"><h1>No ceremony this season</h1><button className="btn pri" onClick={done}>Continue</button></div></div>;
  const a = list[Math.min(i, list.length - 1)];
  const last = i >= list.length - 1;
  const world = a.comp === 'world';
  const mine = a.winner?.pid === me || !!a.xi?.some((x) => x.pid === me);
  const noms = a.noms ?? (a.winner ? [a.winner] : []);
  const shuffled = [...noms].slice(0, 5).sort((x, y) => (x.name < y.name ? -1 : 1));
  const next = () => { if (last) done(); else { setI(i + 1); setStage(0); } };
  const big = a.type === 'world_player';
  const firstWorld = list.findIndex((x) => x.comp === 'world');
  return (
    <div className={`cer ${big ? 'big' : ''} ${world ? 'world' : ''}`}>
      <div className="cer-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="cer-stage">
        <div className="cer-kicker">{seasonLabel(s)} · {world ? 'World Football Gala' : `${a.compName} Awards Night`} · {i + 1} / {list.length}</div>
        <div className="cer-comp">{a.compName}{a.mode === 'rank' ? ' · decided by the numbers' : a.xi ? '' : ' · voted'}</div>
        <h1 key={a.id}>{a.title}</h1>
        {big && noms.length >= 5 ? <Countdown key={a.id} g={g} a={a} onDone={next} />
          : a.xi ? (
            stage < 2 ? <><p className="cer-why">{a.why}</p><button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'The eleven are…' : 'Reveal the eleven'}</button></>
              : <div className="cer-xi">{a.xi.map((x, k) => <div key={x.pid} className={x.pid === me ? 'me' : ''} style={{ animationDelay: `${k * 90}ms` }}><span>{x.pos}</span><b>{x.name}</b><i>{x.clubName}</i></div>)}</div>
          ) : a.mode === 'rank' ? (
            // a ranking: no envelope, the table is the story — read from the bottom up
            <div className="cer-rank">{noms.slice(0, 8).map((n, k, arr) => <div key={n.pid + k} className={`cer-row ${k === 0 ? 'first' : ''} ${n.pid === me ? 'me' : ''}`} style={{ animationDelay: `${(arr.length - 1 - k) * 260}ms` }}><span className="pl">{k + 1}</span><Face g={g} n={n} size={k === 0 ? 56 : 36} /><b>{n.name}</b><i>{n.clubName}</i><em>{n.line}</em></div>)}</div>
          ) : stage < 2 ? (
            <>
              <div className="cer-noms">{shuffled.map((n, k) => <div key={n.pid + n.name} className={`cer-nom ${n.pid === me ? 'me' : ''} ${stage === 1 ? 'roll' : ''}`} style={{ animationDelay: `${k * 120}ms` }}><Face g={g} n={n} size={76} /><b>{n.name}</b><span>{n.clubName}</span><i>{n.line}</i></div>)}</div>
              <button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'And the winner is…' : '✉ Open the envelope'}</button>
            </>
          ) : a.winner ? (
            <div className={`cer-win ${a.winner.pid === me ? 'me' : ''}`}>
              <div className="burst" aria-hidden="true" />
              <Face g={g} n={a.winner} size={150} />
              <div className="nm">{a.winner.name}</div>
              <div className="cl">{a.winner.clubName}</div>
              <div className="ln">{a.winner.line}</div>
              {a.winner.pid === me && <div className="you">That is you. Walk up and take it.</div>}
            </div>
          ) : null}
        {!big && (stage === 2 || a.mode === 'rank') && !(a.xi && stage < 2) && <><p className="cer-why">{a.why}</p>{mine && a.xi && <div className="cer-you">You are in the eleven.</div>}{mine && a.mode === 'rank' && <div className="cer-you">Top of the table: you.</div>}<button className="btn pri big" onClick={next}>{last ? 'End of the ceremony' : i + 1 === firstWorld ? 'On to the World Football Gala ▶' : 'Next award ▶'}</button></>}
        <button className="btn ghost sm cer-skip" onClick={done}>Skip ceremony</button>
      </div>
    </div>
  );
}
