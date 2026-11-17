/**
 * The feed: a rolling social timeline beside the game. Every account is fictional (an insider, a correspondent,
 * a stats page, a banter page and fan channels for every club); the posts are built from what happens in the world.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Game, News } from '../engine/types';
import { hashStr } from '../engine/rng';
import { PlayerAvatar, ClubBadge } from './kit';
import { thirdPerson } from '../screens/News';

interface Acc { name: string; handle: string; col: string; verified?: boolean }
interface Post { id: string; acc: Acc; text: string; pid?: string; club?: string; likes: number; reposts: number; replies: { acc: Acc; text: string; likes: number }[]; date: string }

const INSIDER: Acc = { name: 'Matteo Ferrante', handle: 'mferrante_mercato', col: '#e11d48', verified: true };
const CORRESP: Acc = { name: 'Daniel Ashcroft', handle: 'd_ashcroft', col: '#1d4ed8', verified: true };
const STATS: Acc = { name: 'xG Lab', handle: 'xglab', col: '#0ea5e9', verified: true };
const DAILY: Acc = { name: 'Pitchside Daily', handle: 'pitchsidedaily', col: '#f59e0b', verified: true };
const BANTER: Acc = { name: 'Banter FC', handle: 'banterfc', col: '#a855f7' };
const BLTV: Acc = { name: 'Blue Lock TV', handle: 'bluelock_tv', col: '#1ea7ff', verified: true };
const NEUTRALS: Acc[] = [{ name: 'Sunday League Legend', handle: 'sundayleaguelegend', col: '#16a34a' }, { name: 'Tactics Nerd', handle: 'falsenine_fan', col: '#64748b' }, { name: 'Groundhopper', handle: 'groundhopper_92', col: '#b45309' }, { name: 'Couch Pundit', handle: 'couch_pundit', col: '#db2777' }];

const pick = <T,>(a: T[], h: number): T => a[Math.abs(h) % a.length];
function fanAcc(g: Game, club: string, k: number): Acc {
  const c = g.world.clubs[club];
  const sn = (c?.sn ?? club).replace(/\s+/g, '');
  const kinds = [[`${c?.name ?? sn} Fan TV`, `${sn.toLowerCase()}fantv`], [`${sn} Faithful`, `${sn.toLowerCase()}_faithful`], [`The ${sn} Report`, `the${sn.toLowerCase()}report`], [`${sn} Ultras`, `${sn.toLowerCase()}_ultras`]];
  const [name, handle] = kinds[k % kinds.length];
  return { name, handle, col: c?.col?.[0] ?? '#444' };
}
const fmtK = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n));

function postFor(g: Game, n: News): Post | null {
  const w = g.world, h = hashStr('post' + n.id) >>> 0;
  const pid = n.pids?.[0], p = pid ? w.players[pid] : undefined, club = n.clubs?.[n.clubs.length - 1] ?? p?.club ?? undefined;
  const fame = (p?.rep ?? 55) + (club ? (w.clubs[club]?.rep ?? 60) * 0.5 : 20);
  const likes = Math.round((200 + fame * fame * 3) * (0.6 + (h % 100) / 80) * (n.imp >= 3 ? 3 : n.imp === 2 ? 1.5 : 1));
  const reply = (acc: Acc, text: string, k: number) => ({ acc, text, likes: Math.round(likes * (0.01 + ((h >>> k) % 50) / 1000)) });
  const fans = club ? [fanAcc(g, club, h), fanAcc(g, club, h + 1)] : [];
  let acc: Acc = DAILY, text = n.title;
  const replies: Post['replies'] = [];
  if (n.cat === 'transfer') {
    acc = h % 3 ? INSIDER : CORRESP;
    text = acc === INSIDER ? `🚨 ${n.title}. ${n.body.split('. ')[0]}. Deal agreed ✅ #Transfers` : `Understand ${n.title.charAt(0).toLowerCase()}${n.title.slice(1)}. ${n.body.split('. ')[0]}. More to follow.`;
    if (fans[0]) replies.push(reply(fans[0], pick(['GET IN!!! 🔥🔥', 'Welcome to the club king 👑', 'Finally some ambition from the board', 'This is a statement signing.'], h), 3));
    replies.push(reply(pick(NEUTRALS, h >>> 2), pick(['Fee is mad but the talent is real', 'Overpriced. Mark my words.', 'Smart business tbh', 'He will light up that league'], h >>> 4), 5));
  } else if (n.cat === 'match' || n.cat === 'paper' && /\d+[–-]\d+/.test(n.title)) {
    acc = fans[0] ?? DAILY;
    text = `${n.title} ${pick(['What a performance 🔥', 'Scenes!!!', 'Three points. Moving on.', 'Get in there!'], h)}${p ? ` ${p.sn} was ${pick(['unreal', 'a problem today', 'on another level', 'everywhere'], h >>> 3)}.` : ''}`;
    replies.push(reply(fans[1] ?? pick(NEUTRALS, h), pick(['Best player in the league right now', 'Give him the armband', 'Built different 💪', 'We are so back'], h >>> 5), 4));
    replies.push(reply(STATS, `xG and the eye test agree on this one.`, 6));
  } else if (n.cat === 'award') {
    acc = DAILY;
    text = `🏆 ${n.title.replace(/^You win:/, 'Winner:')}`;
    replies.push(reply(pick(NEUTRALS, h), pick(['Deserved. No debate.', 'Robbery 😤', 'Called it in August', 'Consistency pays'], h >>> 2), 3));
    if (fans[0]) replies.push(reply(fans[0], 'OUR GUY 💙', 5));
  } else if (n.cat === 'rivalry') {
    acc = BANTER;
    text = `${n.title} 🍿 ${pick(['Get the popcorn.', 'This one is personal.', 'Who you got?', 'The group chat is on fire.'], h)}`;
    replies.push(reply(pick(NEUTRALS, h), pick(['No contest.', 'It is getting spicy', 'Respect to both honestly', 'One of them is fraud and we all know who'], h >>> 3), 4));
  } else if (n.cat === 'nel' || (p && p.origin === 'bluelock')) {
    acc = BLTV;
    text = `${n.title} 🔵 ${pick(['The egoists keep rising.', 'Blue Lock graduates on the move.', 'Devour or be devoured.'], h)}`;
    replies.push(reply(pick(NEUTRALS, h), pick(['Blue Lock was the best thing to happen to football', 'Ego is a superpower', 'Every week a new monster'], h >>> 2), 3));
  } else if (n.cat === 'world' || n.cat === 'club' || n.cat === 'paper') {
    acc = h % 2 ? DAILY : STATS;
    text = acc === STATS ? `📊 ${n.title}. ${n.body.split('. ')[0]}.` : `📰 ${n.title}`;
    if (fans[0]) replies.push(reply(fans[0], pick(['Told you all', 'Not surprised', 'Massive', 'Respect'], h >>> 1), 4));
  } else if (n.cat === 'injury') {
    acc = CORRESP; text = `Injury update: ${n.title}. ${n.body.split('. ')[0]}.`;
    if (fans[0]) replies.push(reply(fans[0], 'Please no 😭', 3));
  } else return null;
  return { id: 'n' + n.id, acc, text: thirdPerson(text, w.players[g.career.pid]?.name ?? 'He'), pid, club, likes, reposts: Math.round(likes * 0.08), replies, date: n.date };
}

export function SocialFeed({ g, onClose }: { g: Game; onClose: () => void }) {
  const w = g.world;
  const posts = useMemo(() => w.news.slice(-80).reverse().map((n) => postFor(g, n)).filter((x): x is Post => !!x).slice(0, 40), [w.news.length, w.day]);
  const [shown, setShown] = useState(Math.min(6, posts.length));
  const [paused, setPaused] = useState(false);
  // rolling: a new post drops in every few seconds until the whole timeline is out
  useEffect(() => { setShown(Math.min(6, posts.length)); }, [posts.length]);
  useEffect(() => { if (paused || shown >= posts.length) return; const t = setTimeout(() => setShown((x) => x + 1), 3500); return () => clearTimeout(t); }, [shown, paused, posts.length]);
  const me = g.career.pid;
  return (
    <aside className="feed" aria-label="Social feed" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="feed-head"><b>Feed</b><span className="tiny muted">{paused ? 'paused' : 'live'} · fictional accounts</span><button className="btn sm ghost" onClick={onClose} aria-label="Close feed">✕</button></div>
      <div className="feed-list">
        {posts.slice(0, shown).map((p, i) => {
          const pl = p.pid ? w.players[p.pid] : undefined;
          return (
            <article key={p.id} className="fpost" style={{ animationDelay: `${i === 0 ? 0 : 0}ms` }}>
              <div className="fhd"><span className="fav" style={{ background: p.acc.col }}>{p.acc.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><div><b>{p.acc.name}{p.acc.verified && <span className="tick" title="Verified">✔</span>}</b><span>@{p.acc.handle} · {p.date}</span></div></div>
              <p>{p.text}</p>
              {(pl || p.club) && <div className="fimg" style={{ background: `linear-gradient(140deg, ${(p.club && w.clubs[p.club]?.col?.[0]) || '#1b2338'}, #0b0f18)` }}>{pl ? <PlayerAvatar g={g} p={pl} size={86} /> : <ClubBadge g={g} id={p.club!} lg />}{pl && <span className="fcap">{pl.name}{pl.id === me ? ' ⭐' : ''}</span>}</div>}
              <div className="fact"><span>❤️ {fmtK(p.likes)}</span><span>🔁 {fmtK(p.reposts)}</span><span>💬 {fmtK(Math.round(p.likes * 0.04))}</span></div>
              {p.replies.map((r, k) => <div key={k} className="frep"><span className="fav sm" style={{ background: r.acc.col }}>{r.acc.name[0]}</span><div><b>{r.acc.name}</b> <span className="muted">@{r.acc.handle}</span><p>{r.text}</p><span className="tiny muted">❤️ {fmtK(r.likes)}</span></div></div>)}
            </article>
          );
        })}
        {!posts.length && <p className="small muted" style={{ padding: 12 }}>Nothing on the timeline yet.</p>}
      </div>
    </aside>
  );
}
