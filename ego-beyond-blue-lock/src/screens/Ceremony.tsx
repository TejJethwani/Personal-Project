/**
 * End-of-season awards ceremony: each major award is presented in turn — nominees first,
 * then the envelope, then the winner. Purely presentational; the awards themselves were
 * already decided by the engine at the end of the season.
 */
import { useEffect, useState } from 'react';
import type { Award, Game } from '../engine/types';
import { seasonLabel } from '../engine/competitions';
import { act, nav } from '../store/game';
import { PlayerAvatar } from '../ui/kit';

const ORDER = ['signing_s', 'glove', 'def_s', 'mid_s', 'fwd_s', 'playmaker', 'boot', 'ypots', 'pots', 'tots', 'world_goal', 'world_playmaker', 'world_scorer', 'golden_shoe', 'world_gk', 'world_def', 'world_mid', 'world_fwd', 'world_xi', 'world_young', 'world_player'];

export function ceremonyAwards(g: Game, s: number): Award[] {
  const w = g.world, me = w.players[g.career.pid];
  let lg = '';
  for (const h of g.career.statHist) if (h.s === s && w.comps[h.comp]?.kind === 'league') lg = h.comp;
  if (!lg) for (const cid in me.ss) if (w.comps[cid]?.kind === 'league') lg = cid;
  if (!lg) lg = 'eng1';
  const out: Award[] = [];
  for (const t of ORDER) { const a = w.awards[`${t}:${t.startsWith('world') || t === 'golden_shoe' ? 'world' : lg}:${s}`]; if (a) out.push(a); }
  return out;
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
  const mine = a.winner?.pid === me || !!a.xi?.some((x) => x.pid === me);
  const noms = a.noms ?? (a.winner ? [a.winner] : []);
  const shuffled = [...noms].sort((x, y) => (x.pid < y.pid ? -1 : 1));
  const next = () => { if (last) done(); else { setI(i + 1); setStage(0); } };
  const big = a.type === 'world_player';
  return (
    <div className={`cer ${big ? 'big' : ''}`}>
      <div className="cer-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="cer-stage">
        <div className="cer-kicker">{seasonLabel(s)} Awards Gala · {i + 1} / {list.length}</div>
        <div className="cer-comp">{a.compName}</div>
        <h1 key={a.id}>{a.title}</h1>
        {a.xi ? (
          stage < 2 ? <><p className="cer-why">{a.why}</p><button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'The eleven are…' : 'Reveal the eleven'}</button></>
            : <div className="cer-xi">{a.xi.map((x, k) => <div key={x.pid} className={x.pid === me ? 'me' : ''} style={{ animationDelay: `${k * 90}ms` }}><span>{x.pos}</span><b>{x.name}</b><i>{x.clubName}</i></div>)}</div>
        ) : stage < 2 ? (
          <>
            <div className="cer-noms">{shuffled.map((n, k) => { const p = g.world.players[n.pid]; return <div key={n.pid} className={`cer-nom ${n.pid === me ? 'me' : ''} ${stage === 1 ? 'roll' : ''}`} style={{ animationDelay: `${k * 120}ms` }}>{p && <PlayerAvatar g={g} p={p} size={76} />}<b>{n.name}</b><span>{n.clubName}</span><i>{n.line}</i></div>; })}</div>
            <button className="btn pri big" onClick={() => setStage(1)} disabled={stage === 1}>{stage === 1 ? 'And the winner is…' : '✉ Open the envelope'}</button>
          </>
        ) : a.winner ? (
          <div className={`cer-win ${a.winner.pid === me ? 'me' : ''}`}>
            <div className="burst" aria-hidden="true" />
            {g.world.players[a.winner.pid] && <PlayerAvatar g={g} p={g.world.players[a.winner.pid]} size={150} />}
            <div className="nm">{a.winner.name}</div>
            <div className="cl">{a.winner.clubName}</div>
            <div className="ln">{a.winner.line}</div>
            {a.winner.pid === me && <div className="you">That is you. Walk up and take it.</div>}
          </div>
        ) : null}
        {stage === 2 && <><p className="cer-why">{a.why}</p>{mine && a.xi && <div className="cer-you">You are in the eleven.</div>}<button className="btn pri big" onClick={next}>{last ? 'End of the ceremony' : 'Next award ▶'}</button></>}
        <button className="btn ghost sm cer-skip" onClick={done}>Skip ceremony</button>
      </div>
    </div>
  );
}
