/**
 * Contextual interactions with team-mates, opponents, coaches, the agent and journalists.
 * Everything is authored templates + persistent state: no network or AI service is needed.
 * Opportunities appear from what actually happened (matches, memories, transfers, selection),
 * expire if ignored, and are rate-limited so relationships cannot be farmed by clicking.
 */
import type { Fixture, Game, Interaction, InteractionOption, Player } from './types';
import { ovr } from './attributes';
import { abilityDef, mainWeapon } from './abilities';
import { clamp } from './rng';
import { rngOf } from './worldgen';
import { adjust, relOf, remember, lastMemory, personName } from './relationships';
import { addNews, fmtYenShort, ordinal, milestone } from './util';
import { S, type MatchState } from './match/model';
import { teamName } from './match/setup';
import { NATIONS } from './data/nations';
import { tableOf, positionOf } from './competitions';
import { levelOf } from './transfers';

type Tone = InteractionOption['tone'];
type Opt = [label: string, tone: Tone, fx?: string, hint?: string];
interface Built { who: string; place: string; title: string; body: string; opts: Opt[]; ctx?: Record<string, string | number>; blocking?: boolean; days?: number }

const first = (n: string) => n.split(' ')[0];

/** How a person reacts to the tone of your answer. Personality decides: arrogance motivates some and alienates others. */
function toneReaction(g: Game, who: string, tone: Tone): string[] {
  const p = g.world.players[who];
  const ego = p?.pers.ego ?? 55, prof = p?.pers.prof ?? 60;
  const c = g.career;
  const cha = c.personality === 'charismatic' ? 1.3 : c.personality === 'lonewolf' ? 0.6 : 1;
  switch (tone) {
    case 'humble': c.image = clamp(c.image - 3, -100, 100); return adjust(g, who, ego >= 78 ? { trust: 1, resp: -1 } : { trust: 2.5, resp: 1, friend: 1 * cha });
    case 'confident': c.image = clamp(c.image + 1, -100, 100); return adjust(g, who, ego >= 75 ? { resp: 2, rival: 2 } : { resp: 2 });
    case 'ego': c.image = clamp(c.image + 5, -100, 100); return adjust(g, who, ego >= 70 ? { resp: 3, rival: 4 } : { trust: -4, friend: -3 * cha, resp: prof >= 75 ? -2 : 0 });
    case 'team': c.image = clamp(c.image - 2, -100, 100); return adjust(g, who, { trust: 3, friend: 2 * cha, chem: 1 });
    case 'cold': return adjust(g, who, { friend: -2, trust: -0.5 });
    case 'warm': return adjust(g, who, { friend: 3 * cha, trust: 1 });
    case 'tactical': return adjust(g, who, { chem: 2, trust: 1, resp: 1 });
    default: return [];
  }
}

function push(g: Game, tpl: string, b: Built): Interaction {
  const w = g.world;
  const c = g.career;
  const it: Interaction = {
    id: c.nextInteraction++, tpl, s: w.season, day: w.day, abs: w.abs, expires: w.abs + (b.days ?? 5), who: b.who, whoName: personName(g, b.who), place: b.place, title: b.title, body: b.body,
    options: b.opts.map((o, i) => ({ id: `o${i}`, label: o[0], tone: o[1], hint: o[3] })), ctx: { ...(b.ctx ?? {}), ...Object.fromEntries(b.opts.map((o, i) => [`fx${i}`, o[2] ?? ''])) }, blocking: b.blocking,
  };
  c.inbox.push(it);
  c.flags['tpl:' + tpl] = w.abs;
  if (g.career.rel[b.who]) g.career.rel[b.who].last = w.abs;
  if (c.inbox.length > 80) c.inbox = c.inbox.filter((x, i) => !x.done || i > c.inbox.length - 60);
  return it;
}
const cool = (g: Game, tpl: string, days: number) => Number(g.career.flags['tpl:' + tpl] ?? -999) < g.world.abs - days;

function mates(g: Game): Player[] {
  const w = g.world;
  const me = w.players[g.career.pid];
  const c = me.club ? w.clubs[me.club] : null;
  return c ? c.squad.filter((id) => id !== me.id).map((id) => w.players[id]).filter(Boolean) : [];
}
function coachId(g: Game): string | null { const me = g.world.players[g.career.pid]; return me.club ? g.world.clubs[me.club]?.mgr.id ?? null : null; }

/** Weekly contextual opportunities (called once a week). At most two appear. */
export function spawnWeekly(g: Game): void {
  const w = g.world;
  const c = g.career;
  const me = w.players[c.pid];
  if (me.retired || !me.club) return;
  const rng = rngOf(w);
  const club = w.clubs[me.club];
  const ms = mates(g);
  const my = ovr(me);
  const cands: { wt: number; make: () => void }[] = [];
  const pend = c.inbox.filter((x) => !x.done && x.expires >= w.abs).length;
  if (pend >= 4) return;
  const pickMate = (f: (p: Player) => boolean) => { const l = ms.filter(f); return l.length ? rng.pick(l) : null; };

  if (cool(g, 'train_invite', 16)) { const m = pickMate((p) => relOf(g, p.id).chem < 80 && p.pos !== 'GK'); if (m) cands.push({ wt: 3, make: () => {
    const r = relOf(g, m.id); const wpn = mainWeapon(m);
    push(g, 'train_invite', { who: m.id, place: 'Training ground', title: `${m.sn} wants extra work`, body: `${m.name} jogs over as the session ends. "${r.shared > 3 ? 'We keep missing each other by half a second out there.' : 'We haven\'t really played together yet.'} Stay behind? ${wpn ? `I want to see how your movement fits with my ${wpn.name.toLowerCase()}.` : 'Twenty minutes of patterns.'}"`, opts: [['Stay and work on combinations', 'tactical', 'extra_train'], ['"Fine — but we drill MY runs."', 'ego', 'extra_train_ego'], ['"Not today. I need to recover."', 'cold']] });
  } }); }

  const coach = coachId(g);
  if (coach && cool(g, 'coach_feedback', 20)) cands.push({ wt: 3, make: () => {
    const low = c.mgrTrust < 45, disc = c.discipline < 55;
    push(g, 'coach_feedback', { who: coach, place: 'Coach\'s office', title: `${club.mgr.name} calls you in`, body: low ? `"I'll be direct. ${disc ? 'You drift out of the structure too often — I count the moments you ignore the plan.' : 'I need more from you in the role I\'ve given you.'} Talent is the minimum here. Tell me why I should pick you."` : `"You're doing what I ask. ${c.discipline >= 70 ? 'I notice the discipline off the ball.' : 'Now sharpen the details.'} What do you want from me?"`, opts: [['"Tell me exactly what to fix."', 'humble', 'coach_listen'], ['"Play me in my best role and judge me then."', 'confident', 'coach_role'], ['"Pick the best player. That\'s me."', 'ego', 'coach_ego']] });
  } });

  if (cool(g, 'dressing_provocation', 30)) { const m = pickMate((p) => p.pers.ego >= 72 && relOf(g, p.id).friend < 45 && Math.abs(ovr(p) - my) <= 8); if (m) cands.push({ wt: 2, make: () => {
    const r = relOf(g, m.id); const mem = lastMemory(r, ['ignored_them', 'ignored_me']);
    push(g, 'dressing_provocation', { who: m.id, place: 'Dressing room', title: `${m.sn} has something to say`, body: `${m.name} doesn't look up from his boots. "${mem ? (mem.t === 'ignored_them' ? 'Still thinking about that chance you wasted when I was free.' : 'Next time you make that run, maybe earn the pass first.') : `Everyone talks about you. I haven't seen it yet.`} There's one main character in this team."`, opts: [['"Then take it from me on the pitch."', 'ego', 'declare_soft'], ['Laugh it off: "We want the same thing."', 'warm'], ['Say nothing and walk past', 'cold']] });
  } }); }

  if (cool(g, 'travel_chat', 18)) { const m = pickMate((p) => p.pers.social >= 45); if (m) cands.push({ wt: 2, make: () => {
    const amb = m.pers.amb >= 75 ? 'I\'m not staying here forever. The Champions League anthem — that\'s where I belong.' : m.pers.loyal >= 70 ? 'I could play here my whole career, honestly.' : 'I just want to play every week. Wherever that is.';
    push(g, 'travel_chat', { who: m.id, place: 'Team coach', title: `On the road with ${m.sn}`, body: `Three hours of motorway. ${m.name} takes the seat next to you. "${amb} What about you?"`, opts: [['Tell him your real ambitions', 'warm', 'share_ambition'], ['"To be the best in the world. Nothing less."', 'ego'], ['Put your headphones on', 'cold']], ctx: { amb } });
  } }); }

  if (cool(g, 'recovery_advice', 25)) { const m = pickMate((p) => (w.season - p.born >= 28 || ovr(p) >= my + 3) && p.pers.prof >= 55); if (m) cands.push({ wt: 2, make: () => {
    push(g, 'recovery_advice', { who: m.id, place: 'Recovery pool', title: `Advice from ${m.sn}`, body: `${m.name} (${w.season - m.born}, ${ovr(m)} OVR) is two lanes over. "You train like you're trying to win Tuesday. I did that at your age. Want to know what I'd change?"`, opts: [['"Go on. I\'m listening."', 'humble', 'advice'], ['"Show me in training instead."', 'tactical', 'extra_train'], ['"I\'ve got my own way."', 'ego']] });
  } }); }

  if (cool(g, 'journalist', 16) && (me.rep >= 15 || w.phase === 'nel')) cands.push({ wt: 2, make: () => {
    const j = rng.pick(['journo1', 'journo2', 'journo3']);
    const jp = c.people[j];
    let ap = 0, gl = 0; for (const k in me.ss) { ap += me.ss[k][S.APP]; gl += me.ss[k][S.G]; }
    const q = jp.trait === 'provocative' ? `"${ap ? `${gl} goals in ${ap} games` : 'You haven\'t played yet'}. Are you being held back by the players around you?"` : jp.trait === 'hype' ? `"The fans love you. Can you be the best player in this ${w.phase === 'nel' ? 'league' : 'team'}?"` : `"How would you assess your ${w.phase === 'nel' ? 'Neo Egoist League' : 'season'} so far?"`;
    push(g, 'journalist', { who: j, place: 'Mixed zone', title: `${jp.name}, ${jp.org}`, body: `A recorder appears under your chin. ${q}`, opts: [['Credit the team and the staff', 'team', 'press_team'], ['"I\'m satisfied, but there is more to come."', 'confident', 'press_conf'], ['"I\'m the best player on that pitch every week."', 'ego', 'press_ego']] });
  } });

  if (cool(g, 'agent', 30) && w.phase === 'pro') cands.push({ wt: 1.5, make: () => {
    const role = me.con?.role ?? 'rotation';
    push(g, 'agent', { who: 'agent', place: 'Private message', title: 'Message from your agent', body: `"Quick check-in. You're on a ${role} contract at ${club.name}${me.con ? ` until ${me.con.until + 1}` : ''}. ${c.flags.rejectedBid && Number(c.flags.rejectedBidAbs ?? -999) > w.abs - 60 ? `They turned down a bid from ${teamName(w, String(c.flags.rejectedBid))}. ` : ''}Tell me what you want and I'll work the phones."`, opts: [['"I\'m happy here. Don\'t unsettle things."', 'team', 'agent_stay'], ['"Find me a bigger stage."', 'confident', 'agent_big'], ['"I need minutes. Loan, sale, anything."', 'neutral', 'agent_minutes']], days: 10 });
  } });

  if (w.phase === 'pro' && me.con && cool(g, 'playing_time', 40)) {
    let st = 0, ap = 0; const l = me.ss[club.league ?? '']; if (l) { st = l[S.START]; ap = l[S.APP]; }
    const played = Object.values(w.fixtures).filter((f) => f.comp === club.league && f.played && (f.h === club.id || f.a === club.id)).length;
    if (played >= 8 && coach && (me.con.role === 'star' || me.con.role === 'key') && st < played * 0.4 && me.inj === 0) cands.push({ wt: 6, make: () => {
      push(g, 'playing_time', { who: coach, place: 'Coach\'s office', title: 'You asked for a meeting', body: `You were told you would be a ${me.con!.role === 'star' ? 'star' : 'key'} player. You have started ${st} of ${played} league matches (${ap} appearances). ${club.mgr.name} waits for you to speak.`, opts: [['"What do I need to do to start?"', 'humble', 'coach_listen'], ['"I was promised a role. Honour it."', 'confident', 'demand_role'], ['"If I\'m not playing, let me leave."', 'ego', 'want_out']], blocking: false, days: 8 });
    } });
  }

  if (Number(c.flags.newManager ?? -999) > w.abs - 10 && coach && cool(g, 'new_manager', 30)) cands.push({ wt: 9, make: () => {
    push(g, 'new_manager', { who: coach, place: 'Training ground', title: `First meeting with ${club.mgr.name}`, body: `The new manager shakes every hand in the squad. He holds yours a second longer. "I've watched your clips. Tell me in one sentence what you are."`, opts: [['"A player who does whatever the team needs."', 'team', 'coach_listen'], ['"The one who decides matches."', 'ego', 'coach_ego'], ['Describe your best role and movements', 'tactical', 'coach_role']] });
  } });

  // messages from people at other clubs
  const away = Object.entries(c.rel).map(([id, r]) => ({ p: w.players[id], r })).filter((x) => x.p && !x.p.retired && x.p.club !== me.club && x.p.club);
  if (cool(g, 'friend_msg', 28)) { const fr = away.filter((x) => x.r.friend >= 45); if (fr.length) cands.push({ wt: 2, make: () => {
    const { p, r } = rng.pick(fr); const mem = lastMemory(r, ['assist_to', 'assist_from', 'reaction', 'reunion']);
    const pc = w.clubs[p.club!];
    push(g, 'friend_msg', { who: p.id, place: 'Private message', title: `Message from ${p.sn}`, body: `"${first(me.name)}! ${mem ? `I was telling the lads here about the time — ${mem.txt.replace(/\.$/, '')}. ` : ''}${pc.name} is ${positionOf(w, pc.league ?? '', pc.id) ? `${ordinal(positionOf(w, pc.league ?? '', pc.id))} right now` : 'a different world'}. You watching our games?"`, opts: [['Catch up properly', 'warm'], ['"Put in a word for me with your manager."', 'confident', 'word_in'], ['"Watching? I\'m planning how to beat you."', 'ego', 'declare_soft']], days: 8 });
  } }); }
  if (cool(g, 'rival_msg', 35)) { const rv = away.filter((x) => c.rivals.includes(x.p.id) || x.r.rival >= 50); if (rv.length) cands.push({ wt: 2, make: () => {
    const { p, r } = rng.pick(rv); const mem = lastMemory(r, ['dominated', 'beat_them', 'rival_match']);
    push(g, 'rival_msg', { who: p.id, place: 'Private message', title: `${p.sn} sends a message`, body: `"${mem ? mem.txt + ' I haven\'t forgotten.' : 'I see your name in the news.'} Don't get comfortable."`, opts: [['"Next time will be different."', 'confident'], ['"You\'re the reason I train. Keep up."', 'ego'], ['Leave him on read', 'cold']], days: 8 });
  } }); }

  if (w.phase === 'nel' && cool(g, 'bid_talk', 12)) { const b = w.nel.bids[me.id]; const m = pickMate((p) => !!w.nel.bids[p.id]?.top); if (b?.top && m) { const mb = w.nel.bids[m.id]; cands.push({ wt: 4, make: () => {
    const ahead = b.top > mb.top;
    push(g, 'bid_talk', { who: m.id, place: 'Monitor room', title: 'The ranking board updates', body: `The bids flash up: you ${fmtYenShort(b.top)} (${ordinal(b.rank)}), ${m.sn} ${fmtYenShort(mb.top)} (${ordinal(mb.rank)}). ${m.name} ${ahead ? 'stares at the screen. "Enjoy it. Numbers move."' : 'smirks. "Long way up from there."'}`, opts: [[ahead ? '"Then come and take it."' : '"I\'m coming for your number."', 'ego', 'declare_soft'], ['"We both go up if this team wins."', 'team'], ['Study the board in silence', 'neutral']] });
  } }); } }

  if (w.phase === 'nel' && coach && cool(g, 'master_talk', 14)) cands.push({ wt: 3, make: () => {
    push(g, 'master_talk', { who: coach, place: 'Training pitch', title: `${club.mgr.name} stops the drill`, body: `"${club.identity ?? ''}" He points at you. "So. What is your football? Say it in front of everyone."`, opts: [['"I score. Everything else is detail."', 'ego', 'coach_ego'], ['"I make the team\'s best move happen."', 'team', 'coach_listen'], ['"The highest-probability action, every time."', 'tactical', 'coach_role']] });
  } });

  if (Number(c.flags.intlCamp ?? -999) > w.abs - 6 && cool(g, 'intl_camp', 20)) { const sq = (w.nations[me.nat]?.squad ?? []).map((id) => w.players[id]).filter((p) => p && p.id !== me.id && p.club !== me.club); if (sq.length) cands.push({ wt: 8, make: () => {
    const p = rng.pick(sq); relOf(g, p.id);
    push(g, 'intl_camp', { who: p.id, place: `${NATIONS[me.nat]?.name ?? 'National'} camp`, title: `Room-mate: ${p.sn}`, body: `International week. ${p.name} of ${teamName(w, p.club ?? '')} is your room-mate. "Club rivals for nine months, same shirt for ten days. Strange job. What's it really like at ${club.sn}?"`, opts: [['Swap stories about your clubs', 'warm', 'share_ambition'], ['Talk tactics for the match', 'tactical'], ['"We\'re not friends. We\'re colleagues."', 'cold']] });
  } }); }

  for (const k of Object.keys(c.flags)) if (k.startsWith('reunion:') && Number(c.flags[k]) > w.abs - 12) { const pid = k.slice(8); const p = w.players[pid]; if (p && p.club === me.club && cool(g, 'reunion:' + pid, 999)) cands.push({ wt: 10, make: () => {
    const r = relOf(g, pid); const mem = lastMemory(r);
    push(g, 'reunion:' + pid, { who: pid, place: 'Training ground', title: `${p.sn} walks back into your life`, body: `${p.name} drops his bag at the locker next to yours. "${mem ? `Last thing I remember: ${mem.txt}` : 'Been a while.'} ${r.rival >= 50 ? 'Same team now. Don\'t expect me to pass.' : 'Told you we\'d play together again.'}"`, opts: [['"Let\'s finish what we started."', 'warm'], ['"Same pitch, same rule: I\'m the striker."', 'ego'], ['Nod and get changed', 'neutral']] });
    delete c.flags[k];
  } }); }

  let n = 0;
  const max = pend >= 2 ? 1 : 2;
  while (n < max && cands.length) {
    const tot = cands.reduce((s, x) => s + x.wt, 0);
    let r = rng.next() * tot, i = 0;
    for (; i < cands.length - 1; i++) { r -= cands[i].wt; if (r <= 0) break; }
    cands[i].make();
    cands.splice(i, 1);
    n++;
    if (rng.chance(0.45)) break;
  }
}

/** Tunnel encounter before a match against someone who remembers you. */
export function spawnPreMatch(g: Game, fx: Fixture): void {
  const w = g.world;
  const c = g.career;
  const me = w.players[c.pid];
  if (c.flags['pre:' + fx.id]) return;
  c.flags['pre:' + fx.id] = 1;
  const oppId = fx.h === me.club || (w.comps[fx.comp]?.natTeams && fx.h === me.nat) ? fx.a : fx.h;
  const squad = w.clubs[oppId]?.squad ?? w.nations[oppId]?.squad ?? [];
  const known = squad.map((id) => ({ p: w.players[id], r: c.rel[id] })).filter((x) => x.p && x.r && (x.r.mem.length > 0 || c.rivals.includes(x.p.id))).sort((a, b) => b.r.rival + b.r.friend - (a.r.rival + a.r.friend));
  if (!known.length) return;
  const { p, r } = known[0];
  const mem = lastMemory(r, ['dominated', 'beat_them', 'rival_match', 'assist_to', 'assist_from', 'reaction', 'left', 'left_behind']) ?? lastMemory(r);
  const rival = c.rivals.includes(p.id) || r.rival >= 50;
  const body = rival
    ? `${p.name} is already in the tunnel, staring straight ahead. Then, without turning: "${mem ? mem.txt : 'I\'ve been waiting for this.'} ${mem?.t === 'dominated' ? 'Same again today.' : 'Today I settle it.'}"`
    : `${p.name} breaks into a grin when he sees you in the tunnel. "${mem ? mem.txt : 'Look who it is.'} ${r.friend >= 50 ? 'No favours for ninety minutes, alright?' : 'Good luck. You\'ll need it.'}"`;
  push(g, 'tunnel', { who: p.id, place: 'Tunnel', title: rival ? `Rival reunion: ${p.sn}` : `Reunion: ${p.sn}`, body, opts: rival ? [['"Watch closely. I\'m not who I was."', 'confident'], ['"You\'re a stepping stone."', 'ego', 'declare_soft'], ['Stare ahead in silence', 'cold']] : [['Embrace him: "Best of luck — after the whistle."', 'warm'], ['"I\'m scoring on you today."', 'ego'], ['A quick nod', 'neutral']], days: 1, ctx: { fid: fx.id } });
  if (rival) addNews(g, 'rivalry', `${me.name} v ${p.name}: the rivalry resumes`, `${teamName(w, me.club ?? me.nat)} face ${teamName(w, oppId)}. ${mem ? mem.txt : ''}`, { imp: 2, me: true, pids: [p.id] });
}

/** Post-match conversations generated from what actually happened in the match. */
export function spawnPostMatch(g: Game, fx: Fixture, ms: MatchState): void {
  const w = g.world;
  const c = g.career;
  const u = ms.uc;
  if (!u || !ms.pl[u.idx].used) return;
  const meM = ms.pl[u.idx];
  const opp = ms.teams[1 - meM.t];
  let done = 0;
  for (const k in u.memo) {
    const m = u.memo[k], q = ms.pl[+k], p = w.players[q.id];
    if (!p || done >= 2) continue;
    if (q.t === meM.t && m.iIgn > 0 && cool(g, 'confront:' + p.id, 20)) {
      push(g, 'confront:' + p.id, { who: p.id, place: 'Dressing room', title: `${p.sn} confronts you`, body: `Boots off, nobody talking. ${p.name} sits down opposite. "I was free. ${m.iIgn > 1 ? 'More than once.' : 'You saw me.'} ${meM.s[S.G] ? 'You scored today, fine. That doesn\'t make it the right decision.' : 'And you didn\'t even score.'}"`, opts: [['"You\'re right. I\'m sorry — next one is yours."', 'humble', 'apologise'], ['"A striker shoots. Be better and I\'ll pass."', 'ego'], ['"Let\'s fix it in training tomorrow."', 'tactical', 'extra_train']], days: 4, ctx: { fid: fx.id } });
      done++;
    } else if (q.t === meM.t && m.at > 0 && cool(g, 'thanks:' + p.id, 30)) {
      push(g, 'thanks:' + p.id, { who: p.id, place: 'Dressing room', title: `${p.sn} finds you after the match`, body: `"That ball against ${opp.name}. I didn't even have to break stride." ${p.name} taps your chest. "Keep finding me like that and we both get rich."`, opts: [['"Make the run and I\'ll find you every time."', 'team', 'combo'], ['"I created it. You just finished."', 'ego'], ['Smile and shrug', 'warm']], days: 4 });
      done++;
    } else if (q.t !== meM.t && m.dl - m.dw >= 3 && (meM.s[S.RAT] || 6) < 6.4 && cool(g, 'dominated:' + p.id, 60)) {
      push(g, 'dominated:' + p.id, { who: p.id, place: 'Pitch, full-time', title: `${p.sn} offers a hand`, body: `${p.name} — ${ovr(p)}-rated ${p.pos} of ${opp.name} — pulls you up off the grass. "${p.pers.ego >= 70 ? 'Is that everything? They told me you were dangerous.' : 'You\'ll get there. Not today, though.'}"`, opts: [['"Remember my name. We\'ll meet again."', 'confident', 'declare_soft'], ['"You were better. Teach me how you read that."', 'humble', 'study_him'], ['Walk off without a word', 'cold']], days: 3 });
      done++;
    }
  }
  if (!done && meM.s[S.POTM] && cool(g, 'potm_press', 20)) {
    push(g, 'potm_press', { who: 'journo3', place: 'Pitch-side interview', title: 'Player of the Match interview', body: `"${meM.s[S.G]} goal${meM.s[S.G] === 1 ? '' : 's'}, ${meM.s[S.A]} assist${meM.s[S.A] === 1 ? '' : 's'}, rated ${meM.s[S.RAT].toFixed(1)} against ${opp.name}. Where does that performance come from?"`, opts: [['"From the ten players around me."', 'team', 'press_team'], ['"From work nobody sees."', 'confident', 'press_conf'], ['"From being the best. Get used to it."', 'ego', 'press_ego']], days: 2 });
  }
}

/** Resolve the player's chosen answer. Returns the outcome text. */
export function resolveInteraction(g: Game, id: number, optId: string): string {
  const w = g.world;
  const c = g.career;
  const it = c.inbox.find((x) => x.id === id);
  if (!it || it.done) return '';
  const idx = +optId.slice(1);
  const o = it.options[idx];
  if (!o) return '';
  const fx = String(it.ctx['fx' + idx] ?? '');
  const me = w.players[c.pid];
  const p = w.players[it.who];
  const effects = toneReaction(g, it.who, o.tone);
  let result = '';
  const say = (s: string) => { result = s; };
  switch (fx) {
    case 'extra_train': case 'extra_train_ego': {
      me.fit = clamp(me.fit - 4, 5, 100);
      effects.push(...adjust(g, it.who, { chem: fx === 'extra_train' ? 3 : 2 }));
      if (p) for (const r of p.ab) { const d = abilityDef(r.id); if (d && d.kind === 'weapon' && !me.ab.some((x) => x.id === r.id)) { const L = (c.learning[r.id] ??= { exposure: 0, practice: 0, from: p.id }); L.exposure = Math.min(100, L.exposure + 10); effects.push(`Studied ${d.name} (+10% exposure)`); break; } }
      remember(g, it.who, 'trained', `You stayed behind to train with ${personName(g, it.who).split(' ').pop()}.`, 1);
      say(fx === 'extra_train' ? 'Forty minutes later you have three patterns that work. He nods on the way in.' : 'He rolls his eyes — but he feeds your runs until the lights go off.');
      effects.push('Condition −4');
      break;
    }
    case 'coach_listen': c.mgrTrust = clamp(c.mgrTrust + 3, 0, 100); c.discipline = clamp(c.discipline + 2, 0, 100); effects.push('Coach trust +3'); say(`"Good. ${c.lastSel?.reasons[0] ?? 'Keep your shape when we lose the ball.'} Do that and you play." He means it.`); break;
    case 'coach_role': { const ok = me.form >= 6.8 || ovr(me) >= levelOf(w.clubs[me.club!]) + 2; c.mgrTrust = clamp(c.mgrTrust + (ok ? 4 : -2), 0, 100); effects.push(`Coach trust ${ok ? '+4' : '−2'}`); say(ok ? '"Your numbers back that up. I\'ll give you the role — for now."' : '"Earn it in training first. Then we talk about roles."'); break; }
    case 'coach_ego': { const big = ovr(me) >= levelOf(w.clubs[me.club!]) + 4; c.mgrTrust = clamp(c.mgrTrust + (big ? 2 : -4), 0, 100); effects.push(`Coach trust ${big ? '+2' : '−4'}`); say(big ? 'A long pause. "…Then prove it every single week."' : '"Ego without output is noise." The meeting is over.'); break; }
    case 'demand_role': { const ok = c.mgrTrust >= 40; c.mgrTrust = clamp(c.mgrTrust + (ok ? 5 : -3), 0, 100); effects.push(`Coach trust ${ok ? '+5' : '−3'}`); say(ok ? '"You\'re right, I made a promise. You start the next one."' : '"Promises depend on performances. Yours haven\'t been there."'); break; }
    case 'want_out': c.flags.wantOut = 1; c.mgrTrust = clamp(c.mgrTrust - 6, 0, 100); effects.push('Coach trust −6', 'You are now available for transfer'); say('"Fine. If the right bid comes in, I won\'t stand in your way."'); addNews(g, 'career', `${me.name} asks to leave`, 'Reports say the player has told the manager he wants regular football elsewhere.', { imp: 2, me: true }); break;
    case 'agent_stay': c.flags.wantOut = 0; say('"Understood. I\'ll tell them you\'re not for sale."'); break;
    case 'agent_big': c.flags.wantOut = 1; effects.push('Your agent is inviting offers'); say('"Leave it with me. If your form holds, the phone will ring in the window."'); break;
    case 'agent_minutes': c.flags.wantOut = 1; effects.push('Your agent is looking for minutes'); say('"A loan or a smaller club, then. I\'ll have options when the window opens."'); break;
    case 'press_team': me.rep = clamp(me.rep + 0.5, 0, 99); for (const m of mates(g).slice(0, 30)) if (c.rel[m.id]) c.rel[m.id].trust = clamp(c.rel[m.id].trust + 0.6, 0, 100); effects.push('Team-mates\' trust +', 'Public image: humble'); say('The quote runs under the headline "All for the team". The dressing room notices.'); break;
    case 'press_conf': me.rep = clamp(me.rep + 1, 0, 99); effects.push('Reputation +1'); say('A clean, professional answer. It gets clipped and shared.'); break;
    case 'press_ego': me.rep = clamp(me.rep + 2, 0, 99); for (const m of mates(g)) { const r = c.rel[m.id]; if (r) { if (m.pers.ego >= 70) r.rival = clamp(r.rival + 2, 0, 100); else r.trust = clamp(r.trust - 1.2, 0, 100); } } effects.push('Reputation +2', 'Humble team-mates\' trust −', 'Ego-driven team-mates\' rivalry +'); say('It leads every broadcast tonight. Some of your team-mates loved it. Some did not.'); addNews(g, 'career', `"${o.label.replace(/"/g, '')}"`, `${me.name}'s interview is the talk of the league.`, { imp: 2, me: true }); break;
    case 'declare_soft': effects.push(...adjust(g, it.who, { rival: 6 })); if (p && !c.rivals.includes(p.id) && relOf(g, p.id).rival >= 45 && c.rivals.length < 3) { c.rivals.push(p.id); effects.push(`${p.sn} is now a declared rival`); milestone(g, 'rival', `A rivalry with ${p.name} begins.`); } say('The air between you changes. This is going to be a thing.'); break;
    case 'share_ambition': effects.push(...adjust(g, it.who, { friend: 2, trust: 1 })); remember(g, it.who, 'talked', `A long talk about ambitions with ${personName(g, it.who).split(' ').pop()}${it.ctx.amb ? `: "${String(it.ctx.amb).slice(0, 60)}…"` : ''}.`, 1); say('You talk until the motorway lights blur. You know each other a little now.'); break;
    case 'advice': { const L = p ? mainWeapon(p) : undefined; c.discipline = clamp(c.discipline + 3, 0, 100); effects.push('Tactical discipline +3'); if (L && !me.ab.some((x) => x.id === L.id)) { const e = (c.learning[L.id] ??= { exposure: 0, practice: 0, from: it.who }); e.exposure = Math.min(100, e.exposure + 12); effects.push(`Studied ${L.name} (+12% exposure)`); } say('"Recovery is training. Decisions are training. Most players only count the running." You write it down later.'); break; }
    case 'apologise': { const r = relOf(g, it.who); const m = r.mem.filter((x) => x.t === 'ignored_them').pop(); if (m) m.w = -0.5; effects.push(...adjust(g, it.who, { trust: 5, friend: 2 })); if (p) { c.combo = { with: p.id, until: w.abs + 10 }; effects.push(`Planned combination with ${p.sn} for the next match`); } say('He holds your eye, then nods. "Next one\'s mine. I\'ll hold you to it."'); break; }
    case 'combo': if (p) { c.combo = { with: p.id, until: w.abs + 10 }; effects.push(`Planned combination with ${p.sn} for the next match`); } say('"Deal."'); break;
    case 'study_him': { if (p) { const L = mainWeapon(p); if (L && !me.ab.some((x) => x.id === L.id)) { const e = (c.learning[L.id] ??= { exposure: 0, practice: 0, from: p.id }); e.exposure = Math.min(100, e.exposure + 15); effects.push(`Studied ${L.name} (+15% exposure)`); } } say('He actually explains it — two sentences about where he was looking. You will not forget either of them.'); break; }
    case 'word_in': { if (p?.club) { c.flags['interest:' + p.club] = w.abs; effects.push(`${teamName(w, p.club)} will hear your name`); } say('"I\'ll mention it. No promises — he picks who he wants."'); break; }
    default:
      say(o.tone === 'cold' ? 'The moment passes.' : o.tone === 'ego' ? 'You said it. Now you have to back it up.' : o.tone === 'warm' ? 'It was good to talk.' : 'Noted.');
  }
  it.done = { choice: optId, label: o.label, result, effects: effects.slice(0, 6) };
  return result;
}

export function expireInteractions(g: Game): void {
  const w = g.world;
  for (const it of g.career.inbox) if (!it.done && it.expires < w.abs) {
    it.done = { choice: '', label: '(no response)', result: 'You let the moment pass.', effects: [] };
    if (g.career.rel[it.who] && g.world.players[it.who]) adjust(g, it.who, { friend: -0.5 });
  }
}
export function pendingInteractions(g: Game): Interaction[] { return g.career.inbox.filter((x) => !x.done); }

// ───────────────────────────── player-initiated actions ─────────────────────────────
export const SOCIAL_PER_WEEK = 2;
export interface SocialAction { id: string; name: string; desc: string }
export const SOCIAL_ACTIONS: SocialAction[] = [
  { id: 'train', name: 'Train together', desc: 'Extra pattern work. Chemistry up, condition down. Team-mates only.' },
  { id: 'tactics', name: 'Discuss tactics', desc: 'Talk through movements and triggers.' },
  { id: 'advice', name: 'Ask for advice', desc: 'Learn from a better or older player; exposes you to his weapon.' },
  { id: 'praise', name: 'Praise', desc: 'Tell him what he does well.' },
  { id: 'challenge', name: 'Challenge', desc: 'A competitive bet. Ego-driven players respect it; others may not.' },
  { id: 'rival', name: 'Declare a rivalry', desc: 'Name him as your rival (max. three). Rivalry-driven abilities trigger against him.' },
  { id: 'apologise', name: 'Apologise', desc: 'Only available if he holds something against you.' },
  { id: 'combo', name: 'Request a combination', desc: 'Plan a specific link-up for the next match (needs chemistry 40+).' },
  { id: 'catchup', name: 'Catch up (message / call)', desc: 'Stay in touch with someone at another club. Costs no social time — friendships survive transfers if you keep them alive.' },
  { id: 'ambitions', name: 'Discuss ambitions / a transfer', desc: 'Find out what he wants — or ask a friend at another club to recommend you.' },
];
function weekKey(g: Game): number { return g.world.season * 100 + Math.floor(g.world.day / 7) + (g.world.phase === 'nel' ? 5000 : 0); }
export function socialLeft(g: Game): number {
  const s = g.career.social;
  return s.week === weekKey(g) ? Math.max(0, SOCIAL_PER_WEEK - s.used) : SOCIAL_PER_WEEK;
}
export function canAct(g: Game, pid: string, action: string): string | null {
  const w = g.world;
  const c = g.career;
  const me = w.players[c.pid];
  const p = w.players[pid];
  if (!p || p.retired) return 'Not available.';
  const r = relOf(g, pid);
  const natMate = isNatMate(g, pid);
  if (action === 'catchup') {
    if (p.club === me.club && !!p.club) return 'You see him every day — spend real time with him instead.';
    if ((r.uses.catchup ?? []).some((d) => d > w.abs - 6)) return 'You spoke this week already.';
    return null;
  }
  if (socialLeft(g) <= 0) return 'No social time left this week.';
  if ((r.uses.any ?? []).some((d) => d > w.abs - 6)) return 'You already spent time with him this week.';
  const mate = (p.club === me.club && !!p.club) || natMate;
  if ((action === 'train' || action === 'combo' || action === 'tactics') && !mate) return 'Club or national team-mates only.';
  if (action === 'combo' && r.chem < 40) return 'Needs tactical chemistry of 40+.';
  if (action === 'advice' && !(ovr(p) >= ovr(me) - 2 || w.season - p.born >= w.season - me.born + 4)) return 'He has nothing to teach you yet.';
  if (action === 'apologise' && !r.mem.some((m) => m.t === 'ignored_them' && m.w <= -1)) return 'There is nothing to apologise for.';
  if (action === 'rival') { if (c.rivals.includes(pid)) return 'Already your rival.'; if (c.rivals.length >= 5) return 'You already have five rivals.';  }
  return null;
}
/** True if this player is in the same current national squad (senior or youth) as the user. */
export function isNatMate(g: Game, pid: string): boolean {
  const me = g.world.players[g.career.pid];
  const n = g.world.nations[me.nat];
  if (!n) return false;
  return (!!n.squad?.includes(me.id) && !!n.squad?.includes(pid)) || (!!n.u20squad?.includes(me.id) && !!n.u20squad?.includes(pid));
}
/** Perform an initiated action. Gains shrink with repeated use on the same person. */
export function doAction(g: Game, pid: string, action: string): { text: string; effects: string[] } {
  const w = g.world;
  const c = g.career;
  const err = canAct(g, pid, action);
  if (err) return { text: err, effects: [] };
  const me = w.players[c.pid];
  const p = w.players[pid];
  const r = relOf(g, pid);
  if (action === 'catchup') {
    (r.uses.catchup ??= []).push(w.abs);
    if (r.uses.catchup.length > 6) r.uses.catchup.shift();
    const warm = r.friend >= 40;
    const fx = adjust(g, pid, { friend: warm ? 1.6 : 1, trust: 0.8, chem: r.shared > 0 ? 0.3 : 0 });
    remember(g, pid, 'talked', `You and ${p.sn} caught up while at different clubs.`, 0.4);
    return { text: warm ? `${p.sn} picks up on the second ring. Twenty minutes later you are still laughing about the old dressing room.` : `A short exchange of messages with ${p.sn}. Small, but it keeps the door open.`, effects: fx };
  }
  const wk = weekKey(g);
  if (c.social.week !== wk) c.social = { week: wk, used: 0 };
  c.social.used++;
  const recent = (r.uses[action] ?? []).filter((d) => d > w.abs - 28).length;
  const k = Math.pow(0.5, recent);
  (r.uses[action] ??= []).push(w.abs);
  (r.uses.any ??= []).push(w.abs);
  if (r.uses[action].length > 6) r.uses[action].shift();
  if (r.uses.any.length > 8) r.uses.any.shift();
  const ego = p.pers.ego;
  let text = '';
  let fx: string[] = [];
  switch (action) {
    case 'train': me.fit = clamp(me.fit - 4, 5, 100); fx = adjust(g, pid, { chem: 3 * k, friend: 0.8 * k, trust: 0.6 * k }); fx.push('Condition −4'); text = `An extra half-hour of patterns with ${p.sn}.`; break;
    case 'tactics': fx = adjust(g, pid, { chem: 1.8 * k, resp: 0.8 * k, trust: 0.5 * k }); text = `You and ${p.sn} map out where each of you wants the ball.`; break;
    case 'advice': { fx = adjust(g, pid, { resp: -0.3, friend: 1.2 * k, trust: 1 * k }); const L = mainWeapon(p); if (L && !me.ab.some((x) => x.id === L.id)) { const e = (c.learning[L.id] ??= { exposure: 0, practice: 0, from: pid }); e.exposure = Math.min(100, e.exposure + 12 * k); fx.push(`Studied ${L.name} (+${Math.round(12 * k)}% exposure)`); } c.discipline = clamp(c.discipline + 1.5 * k, 0, 100); text = `${p.sn} talks you through how he sees the game.`; break; }
    case 'praise': fx = adjust(g, pid, ego >= 80 ? { friend: 1 * k, resp: -0.5 } : { friend: 2.2 * k, trust: 1 * k }); text = ego >= 80 ? `${p.sn} takes the compliment as his due.` : `${p.sn} is genuinely pleased.`; break;
    case 'challenge': fx = adjust(g, pid, ego >= 65 ? { rival: 4 * k, resp: 2 * k } : { rival: 2 * k, trust: -1.5, friend: -1 }); text = ego >= 65 ? `"First to score next match. Loser carries the bags." ${p.sn} grins. He's in.` : `${p.sn} doesn't see why everything has to be a competition.`; break;
    case 'rival': c.rivals.push(pid); fx = adjust(g, pid, { rival: 15, resp: ego >= 60 ? 3 : 0 }); remember(g, pid, 'rival_declared', `You declared ${p.sn} your rival.`, 1); milestone(g, 'rival', `Declared ${p.name} a rival.`); fx.push('Declared rival'); text = `You tell ${p.sn} to his face: he is the one you measure yourself against.`; if (p.rep >= 60 || me.rep >= 60) addNews(g, 'rivalry', `${me.name} names ${p.name} as his rival`, 'A new personal duel to watch.', { imp: 2, me: true, pids: [pid] }); break;
    case 'apologise': { const m = r.mem.filter((x) => x.t === 'ignored_them' && x.w <= -1).pop(); if (m) m.w = -0.5; fx = adjust(g, pid, { trust: 5, friend: 1.5 }); c.image = clamp(c.image - 3, -100, 100); text = `${p.sn} accepts it. "Just look up next time."`; break; }
    case 'combo': c.combo = { with: pid, until: w.abs + 10 }; fx = adjust(g, pid, { chem: 1 * k }); fx.push('Combination planned for the next match (+one-two bonus)'); text = `You and ${p.sn} agree a trigger: when he checks short, you spin in behind.`; break;
    case 'ambitions': {
      const amb = p.pers.amb >= 75 ? 'wants trophies at the highest level and will move to get them' : p.pers.loyal >= 70 ? 'sees his future at his current club' : 'mostly wants to play every week';
      fx = adjust(g, pid, { friend: 1.5 * k, trust: 0.8 * k });
      if (p.club && p.club !== me.club && r.friend >= 50) { c.flags['interest:' + p.club] = w.abs; fx.push(`${teamName(w, p.club)} will hear your name`); text = `${p.sn} ${amb}. He promises to mention you to his manager.`; }
      else text = `${p.sn} ${amb}.`;
      remember(g, pid, 'talked', `${p.sn} told you he ${amb}.`, 0.5);
      break;
    }
  }
  return { text, effects: fx };
}
export { tableOf };
