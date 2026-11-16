/**
 * Context-aware banter. What an opponent says depends on the score and on the history between you:
 * nobody mocks a miss from a player whose team is 2–0 up and who has already scored — they grumble,
 * threaten a comeback or concede the point. The same goes off the pitch: a rival who keeps losing to you
 * does not sneer in the papers. Also: what the user can fire back, and many more interview lines.
 */
import type { Player } from '../types';
import { hashStr } from '../rng';
import { archetype, banterLine, QUESTIONS, ANSWERS, type Situation, type IvKind, type Tone } from './banter';

const L = (s: string) => s.split('|');
export type ExtSit = 'youMissAhead' | 'youScoreRout' | 'youScoreBehind' | 'theyScoreBehind' | 'theyScoreLevel' | 'preUnderdog' | 'pressUnderdog';
type Group = 'cold' | 'hot' | 'play' | 'calm';
const GROUP: Record<string, Group> = { king: 'cold', ice: 'cold', fire: 'hot', wild: 'hot', joker: 'play', genius: 'play', humble: 'calm', vet: 'calm' };

export const EXT: Record<ExtSit, Record<Group, string[]>> = {
  youMissAhead: {
    cold: L('Miss all you like. The score is the only thing I am looking at.|Do not get comfortable, {me}.|Even with the lead you look nervous.|You are winning. Stop showing off and you might keep it.|Hm. You got lucky earlier. That one was your real level.|Enjoy the cushion. It will not last.|I am not saying anything. The scoreboard is loud enough.|Tch. Just play.|You can afford that miss. Tonight.|Waste them. We only need one moment.'),
    hot: L('Keep missing! We are coming back for every one of those goals!|Laugh now — we are not done!|You think this is over? It is not over!|Missed! Our turn is coming, {me}!|One miss, then another. That is how comebacks start!|Do not look at me like that! It is not finished!|Grr — just wait!|Go on, waste another one. Please.|That one gave us life!|Every miss is a gift. Thank you!'),
    play: L('Ooh, close! Not that you need it right now.|Greedy, {me}! You already have enough goals.|Saving some for the next match?|Fine, fine, you are winning. You do not have to rub it in by missing too.|Even your misses look smug today.|Ha — the post likes me more than you.|Leave something for the highlights.|Missing on purpose to give us hope? Kind of you.|Somebody is getting cocky.|That was the universe telling you to calm down.'),
    calm: L('Stay sharp, lad. Leads disappear.|Unlucky. You are still in control though.|I have seen bigger leads lost. Do not switch off.|Good movement. Bad finish. It happens.|You are having a good night. Do not get careless.|We keep going. It is not over until it is over.|Breathe. You are winning.|Keep your head. That is the lesson.|Close. You will get another.|Tidy up the finish and it is game over.'),
  },
  youScoreRout: {
    cold: L('…|Fine. Tonight is yours. Tonight only.|I will remember every one of these.|Score as many as you like. It changes nothing about who I am.|Do not look at me.|This is not over between us.|Enjoy it. You will pay it back.|Tch.|Write it down. I will tear the page out next time.|You will not get this chance again.'),
    hot: L('Argh! Stop scoring!|I am going to explode — this is not happening!|One more and I swear—|Fine! FINE! Next match is war!|You are lucky I am not in goal!|Again?! Who is marking him?!|This does not count! None of it counts!|Next time, {me}. Next time.|I hate this. I hate all of this.|Someone stop him! Anyone!'),
    play: L('Okay, okay, I get it, you are good today.|Can we call it a draw and go home?|Leave some goals for the rest of the season!|Show-off. A talented show-off, but still.|My coach is going to make us run all week because of you.|Is it too late to switch teams?|Alright, that one was nice. Do not tell anyone I said so.|You are ruining my stats, {me}.|I am going to need a new highlight reel to recover from this.|Mercy rule? No? Worth a try.'),
    calm: L('Well taken. Your night, no doubt.|Credit where it is due.|You are on fire tonight, son.|That is a proper finish.|We have to tighten up. Fair play to you.|Good goal. We will look at it on the tape.|You earned that one.|Enjoy it — you have worked for it.|Nothing we could do about that.|Class. Pure class.'),
  },
  youScoreBehind: {
    cold: L('Still behind, {me}. Count again.|A goal. You are still losing.|Cute. Look at the scoreboard.|You needed two. You got one.|Do not celebrate a defeat.|One goal does not change the result.|Hm. Too little, too late.|That is a consolation, not a comeback.|We are still ahead. Remember that.|Run back to halfway. You are still losing.'),
    hot: L('Score all you want — we are still winning!|Still ahead! Still ahead!|You think that scares me?|Ha! You are still behind!|Keep going, we will score again!|Is that your comeback? Pathetic!|We will answer that in a minute!|Still not enough, {me}!|That changes nothing!|We go again — straight back up the pitch!'),
    play: L('Ooh, nice — but you are still losing, right?|Points for effort!|Is it a comeback if you are still behind?|Fancy. Now do it two more times.|Look at the score, {me}. Go on.|Sure, take a goal. We are feeling generous.|You are making this interesting at least.|Hm, okay, that was quite good.|Still our lead, though. Just saying.|A goal! Shame about the rest of the score.'),
    calm: L('Good goal. You are still behind, mind.|Game on, then.|That makes it interesting.|You never stop, do you?|Well done. Now we see what you have left.|Fair finish. We are still in front.|Keep that up and you might get something.|Plenty of time left. For both of us.|Good response. We stay calm.|Nice one. We go again.'),
  },
  theyScoreBehind: {
    cold: L('One back. Count with me, {me}.|That is the start.|You felt that.|Now it begins.|Your lead is shrinking.|Watch the next twenty minutes.|One. Then another.|Do not relax.|You are still ahead. For now.|I only need a little more time.'),
    hot: L('WE ARE COMING!|One back! You hear that crowd?!|Here we go — here we go!|Comeback starts now!|Look at your face, {me}!|Shaking yet?|Next one is coming too!|You are not safe!|Feel the pressure!|We smell it now!'),
    play: L('Plot twist!|Did that make you nervous? It made you nervous.|Just a little one. More where that came from.|Feeling the pressure, {me}?|Things are getting spicy.|Do not worry, it is only one. For now.|Exciting, right?|Your lead looks smaller from here.|Not over yet, superstar.|Oops. Did we spoil the party?'),
    calm: L('Still a game, lad.|That makes it a contest.|We keep chipping away.|Do not switch off now.|There is time.|One back. Heads up.|The game always gives you a chance.|Stay with it.|Now it is interesting.|We are not going anywhere.'),
  },
  theyScoreLevel: {
    cold: L('Level. That is where you belong.|And just like that, nothing.|All square. Your lead meant nothing.|Back to zero, {me}.|Equal. For now.|Your goal is erased.|Now it gets serious.|Start again.|Your lead was a rumour.|Now we see who you really are.'),
    hot: L('EQUALISER! Yes!|Level! Now we win it!|Who is laughing now?!|All square, {me}! All square!|We are not finished!|Told you!|Now we go for the kill!|Feel that? That is momentum!|Back in it! BACK IN IT!|I knew it! I knew it!'),
    play: L('Aaand we are level!|Well, that was fun while it lasted for you.|Reset!|Tied again — I love this game.|Your lead had a short life.|Fifty–fifty now, {me}.|And the drama continues!|Did not see that coming? I did.|Round two, then!|Everybody back to square one.'),
    calm: L('All square. Fair enough.|Level — we go again.|That is the game.|Honours even for now.|Back to the start.|Now it is anyone\'s.|Good response from us.|Keep your heads, both teams.|That is football. Never finished.|Even again. Let the best side win it.'),
  },
  preUnderdog: {
    cold: L('Last time was luck. Today it is not.|Do not mention the record. I have not forgotten it.|You beat me before. That made me worse for you.|I have watched every one of your goals against me. Every one.|Today the record changes.|Your streak ends here.|I came here for one thing, {me}.|Silence. Let us play.|I do not lose to the same player forever.|Enjoy the record while it is still yours.'),
    hot: L('I have been waiting for this all week!|Revenge, {me}! Today!|I have not slept since the last time!|You think you own me? Not today!|Everything you took, I take back tonight!|I am going to run through you!|This one is personal now!|You beat me once — never again!|I want this one more than anything!|Today I break you!'),
    play: L('Hey, champ. Not going to take it easy on me, are you?|You have been winning our little game. Rude.|I have a new trick just for you.|Let us see if you are still lucky.|The record says you. My gut says me.|Rematch time, {me}! Ding ding!|I brought my A-game this time. Promise.|You owe me a rematch — oh, here it is.|I have been practising. Mostly against you, in my head.|Your lucky streak and I need to have a chat.'),
    calm: L('You have had the better of me. That ends today, hopefully.|Respect. Now let me try to take it back.|You have earned the record. I will earn the next game.|Good to see you. I have studied you.|Let us give them a proper game.|I learn from losing. You will see.|Best of luck. Not too much, though.|Same again? We will see.|You have set the bar. I have been working to reach it.|Good to see you, {me}. Let us play.'),
  },
  pressUnderdog: {
    cold: L('Records are for statisticians. I play the next match.|{me} has had a good spell. Spells end.|I do not talk about him. I will answer on the pitch.|He is ahead for now. Ask me again in May.|Nothing to say. The next meeting will speak.|He won some games. Fine. I am not finished.|I am focused on myself, not on {me}.|Let him enjoy the headlines.|I do not comment on temporary things.|Next question.'),
    hot: L('He has been lucky against me, and I am sick of it!|Next time I make him pay for all of it!|Do not ask me about {me}! Ask me after the next match!|I am using every loss to him as fuel.|He thinks it is over? It has barely started!|I want that rematch tomorrow!|I will not lie — it eats me up!|Write it: I am coming for him.|Every time I see his name I train harder.|He has had his fun. Now it is mine.'),
    play: L('{me} is winning our little war right now. Cheeky.|I will admit it, he has been good. Do not quote me. Oh, you will.|He owes me a few goals. I will collect.|Great player. Annoying player. Both true.|I am the underdog? I love being the underdog.|Rivals keep you honest. He is keeping me very honest.|He is ahead for now. Comebacks are more fun anyway.|I send him my regards. And a warning.|Do I like him? Ask me after I beat him.|He is good. I am working on being annoying about it.'),
    calm: L('Fair play to {me}. He has been the better player in our meetings.|He deserves the credit. I have work to do.|I learn more from losing to him than from beating others.|He is in great form. I have to raise my level.|You cannot argue with the record. You can only change it.|He makes me better, honestly.|Respect. That is all I will say.|Next time I hope it goes my way.|He is one of the best I face. I enjoy it, even when it hurts.|I will keep my answer for the pitch.'),
  },
};

export interface BanterCtx { lead: number; myGoals: number; h2hDiff?: number }
/** Refine a base situation using the score and history, so the line fits what is actually happening. */
export function contextSit(sit: Situation, ctx: BanterCtx): Situation | ExtSit {
  if (sit === 'youMiss') return ctx.lead >= 1 || (ctx.lead === 0 && ctx.myGoals >= 2) ? 'youMissAhead' : 'youMiss';
  if (sit === 'youScore') return ctx.lead >= 2 ? 'youScoreRout' : ctx.lead < 0 ? 'youScoreBehind' : 'youScore';
  if (sit === 'theyScore') return ctx.lead >= 1 ? 'theyScoreBehind' : ctx.lead === 0 ? 'theyScoreLevel' : 'theyScore';
  if (sit === 'theyWinDuel' && ctx.lead >= 2) return 'youMissAhead';
  if (sit === 'pre' && (ctx.h2hDiff ?? 0) >= 2) return 'preUnderdog';
  if (sit === 'press' && (ctx.h2hDiff ?? 0) >= 1) return 'pressUnderdog';
  return sit;
}
const fill = (s: string, me: string, r: string, club: string) => s.replace(/\{me\}/g, me).replace(/\{r\}/g, r).replace(/\{club\}/g, club);
/** A line that fits the moment: context situations use their own pool, base situations the classic one. */
export function smartLine(p: Player, sit: Situation, ctx: BanterCtx, meName: string, club: string, season: number, salt: number): string {
  const s = contextSit(sit, ctx);
  if (!(s in EXT)) return banterLine(p, s as Situation, meName, club, season, salt);
  const list = EXT[s as ExtSit][GROUP[archetype(p, season)] ?? 'cold'];
  return fill(list[Math.abs(hashStr(p.id + s) + salt * 7) % list.length], meName, p.sn, club);
}

/** What the user can say back, by the state of the match. */
export type ReplyTone = 'cold' | 'fire' | 'respect';
export const COMEBACKS: Record<'ahead' | 'behind' | 'level', Record<ReplyTone, string[]>> = {
  ahead: {
    cold: L('Look at the scoreboard.|Talk when you are winning.|Scoreboard, {r}.|Count the goals, then talk.|I am busy winning.|Say it louder — I cannot hear you over the score.|Your team needs you. Not your mouth.|Noted. Still winning.'),
    fire: L('I am not done with you!|Another one is coming, {r}!|Keep talking, I will keep scoring!|This is my pitch tonight!|You want more? I have more!|I will bury you by full time!|Watch me go again!|Tell me again after the next one!'),
    respect: L('Good game so far, {r}.|You made us work for it.|Respect — keep fighting.|You are a tough opponent.|Long way to go, I know.|Fair enough. Play on.|That is football.|Let us finish it properly.'),
  },
  behind: {
    cold: L('It is not over.|Ninety minutes, {r}.|Talk at full time.|Enjoy it while it lasts.|I only need one chance.|Save your breath.|Watch this.|Keep counting. Backwards.'),
    fire: L('I am coming back for this!|You will regret that, {r}!|The comeback starts with me!|Do not celebrate yet!|I will turn this around myself!|Every word — I will make you eat it!|Watch me!|This is far from finished!'),
    respect: L('Well played so far.|You deserve the lead. For now.|Good goal. We will answer.|Fair. Let us see the rest.|You are good. I am better in the end.|Respect. Now watch.|Tough night. Not over.|Okay. My move.'),
  },
  level: {
    cold: L('Next goal wins it.|Say less.|We will see.|Hm.|Keep watching.|It is all still to play for.|You are talking. I am thinking.|Nothing decided.'),
    fire: L('The next goal is mine!|I settle this!|This ends with me!|Get ready, {r}!|I want the winner!|Bring it!|My game now!|You will not stop me!'),
    respect: L('Great game, this.|Fair fight.|May the best man win.|Enjoying this one.|Let us finish it.|Good battle, {r}.|All to play for.|Respect.'),
  },
};
export function comeback(lead: number, tone: ReplyTone, rival: string, salt: number): string {
  const list = COMEBACKS[lead > 0 ? 'ahead' : lead < 0 ? 'behind' : 'level'][tone];
  return list[Math.abs(salt) % list.length].replace(/\{r\}/g, rival);
}
/** Answers to a rival's quote in the papers, by whether the rivalry is going your way. */
export const PRESS_REPLY: Record<'up' | 'down', Record<ReplyTone, string[]>> = {
  up: {
    cold: L('I let the head-to-head talk for me.|The numbers answer him better than I could.|I do not need to say anything. He knows the record.|Ask him how our last game went.|I am focused on trophies, not on him.'),
    fire: L('He can talk. I will keep beating him.|Tell him to get used to second place.|Every time we meet, I take something from him. That will not change.|He should save his breath for running after me.|Next time I score twice. Write that down too.'),
    respect: L('He is a great player and I enjoy our battles. I have been lucky to come out on top.|I have a lot of respect for him. He pushes me to be better.|The record is mine for now. He will make it hard.|He is one of the reasons I train like I do.|I am happy to keep the rivalry on the pitch.'),
  },
  down: {
    cold: L('He has had his moment. Mine is coming.|I do not answer in the papers.|We will see in the next match.|Talk is cheap. Ninety minutes is not.|I have nothing to prove in an interview.'),
    fire: L('Let him enjoy it. I am going to take everything back.|He is ahead now. I am coming for him.|He will not be smiling after our next game.|Every word goes on my wall. I will answer all of them.|I lose sleep over him. Good. That makes me dangerous.'),
    respect: L('He has been better in our meetings. I accept it and I will work to change it.|Credit to him. I have to raise my level.|He is a fantastic player. I am learning from every game.|He deserves the praise right now.|Rivalries go both ways. My turn will come.'),
  },
};

// ── more interview lines: extra questions and answers for every situation ──
const MORE_Q: Partial<Record<IvKind, string>> = {
  rivalWin: 'Do you enjoy beating {r} more than anyone else?|What did you say to {r} at full time?|Is this rivalry the best thing that happened to your career?',
  rivalLoss: 'Did {r} say anything to you after the whistle?|Are you worried {r} has your number?|Will you watch this game back, knowing {r} won it?',
  rivalDraw: 'Did you speak to {r} after the game?|Is this rivalry getting better every time?',
  starWin: 'The fans want to know: is there more to come?|You seem to be enjoying your football. Is that fair?|Is this the version of you the manager has been waiting for?|What was going through your head on the goal?',
  starDraw: 'Do your team-mates need to step up to your level?|Was there anything more you could have done?',
  starLoss: 'Does it feel lonely being the best player in a losing team?|Will the result spoil a great personal night?',
  poorWin: 'Did you feel the game passed you by?|Is it a good sign that the team can win without your goals?',
  poorLoss: 'Do you feel pressure after a night like that?|What will you say to the manager tomorrow?',
  win: 'Who impressed you most in the team today?|Does this result change your targets for the season?|What was the key moment?',
  bigWin: 'Did you feel sorry for them at any point?|Is this the best the team has played this season?',
  draw: 'Was that the right result?|Who was the better team today?',
  loss: 'Do you need to look at yourselves after that?|Where was the game lost?|Is the dressing room still united?',
  heavyLoss: 'Is the manager under pressure after that result?|What do the players owe the fans after a night like this?',
};
const MORE_A: { pool: IvKind; tone: Tone; lines: string }[] = [
  { pool: 'win', tone: 'humble', lines: 'I just tried to help. Everyone ran for each other.|The lads made it easy for me.|Big win, but we have bigger games coming.|Our defenders deserve the headlines today.|I am happy for the supporters. They travelled far.' },
  { pool: 'win', tone: 'confident', lines: 'We were sharp. I was sharp. It showed.|When I get chances like that, I take them.|This is the standard. Every week.|I felt good from the first minute.|I like big games. They suit me.' },
  { pool: 'win', tone: 'ego', lines: 'Without me this is a draw. Everybody knows it.|They had no answer for me. Nobody does.|I decided this game. That is what I do.|I am not surprised. You should not be either.|Put my name in the headline. It belongs there.' },
  { pool: 'loss', tone: 'humble', lines: 'We will look at ourselves honestly.|I have to do more. We all do.|The fans are right to be disappointed.|We have to stick together now.|It hurts. It should hurt.' },
  { pool: 'loss', tone: 'confident', lines: 'We are still a good team. One night does not change that.|We will analyse it, fix it and move on.|I have no doubt about this group.|Next week we show the real version of us.|Mistakes happen. We correct them.' },
  { pool: 'loss', tone: 'ego', lines: 'I need the ball in better places. That is all I will say.|When I am given freedom, we win. Today I was not.|I will drag us back by myself if I have to.|I hate losing more than anybody in that dressing room.|Next game, give it to me and get out of the way.' },
  { pool: 'draw', tone: 'humble', lines: 'We take the point and respect the opponent.|A draw is fair. We were not at our best.|We have to be more clinical. Me included.|It was a tough place to come.' },
  { pool: 'draw', tone: 'confident', lines: 'On another day we win that comfortably.|We created enough. The finishing will come.|I am positive. The performance was there.|One more chance and it is three points.' },
  { pool: 'draw', tone: 'ego', lines: 'If I had taken my chance we would be talking about a win.|A draw is not enough for a team with me in it.|I want to win every game. Today I did not. I am angry.|They were lucky I was not on the ball more.' },
  { pool: 'starLoss', tone: 'humble', lines: 'My rating does not matter. The result does.|I would give my performance away for a point.|We lost together. No individuals tonight.' },
  { pool: 'starLoss', tone: 'confident', lines: 'If I play like that every week, the results will come.|I am in good form. The team will follow.|I can be proud of my game and still be angry.' },
  { pool: 'starLoss', tone: 'ego', lines: 'I cannot play every position on the pitch.|Look at my numbers, then look at the result. Something does not add up.|I did my part. I always do.' },
  { pool: 'poorWin', tone: 'humble', lines: 'It was not my night, but it was our night. That is enough.|I will do better. The team was brilliant.|My job is to help. Today others helped more.' },
  { pool: 'poorWin', tone: 'confident', lines: 'Quiet games happen. I still made the runs.|The goals will come. I am not worried.|Even when I do not score, defenders have to watch me.' },
  { pool: 'poorWin', tone: 'ego', lines: 'I was saving my best for a bigger occasion.|They spent the whole game watching me. Others enjoyed the space.|You will not see two quiet games in a row from me.' },
  { pool: 'rivalWin', tone: 'humble', lines: 'It is always special against him. I am just glad it went our way.|He made it very difficult. I was lucky with my chances.|We shook hands. There is respect.' },
  { pool: 'rivalWin', tone: 'confident', lines: 'I wanted this one badly and I prepared for it.|I enjoyed every minute of that battle.|I think the record speaks for itself now.' },
  { pool: 'rivalWin', tone: 'ego', lines: 'He talked all week. I talked for ninety minutes.|Tell him to call me when he is ready.|He is good. I am better. It is that simple.' },
  { pool: 'rivalLoss', tone: 'humble', lines: 'He deserved it. I will be honest about that.|I have lessons to take from today.|I congratulated him. He earned it.' },
  { pool: 'rivalLoss', tone: 'confident', lines: 'Next time I will be ready for everything he has.|He won today. It does not decide who is better.|I am already thinking about the rematch.' },
  { pool: 'rivalLoss', tone: 'ego', lines: 'He should frame this result. It will not happen often.|I do not lose to him twice in a row.|Enjoy it, because I will remember it.' },
];
let extended = false;
/** Add the extra interview questions and answers (idempotent). */
export function extendInterviews(): void {
  if (extended) return;
  extended = true;
  for (const k in MORE_Q) QUESTIONS[k as IvKind].push(...L(MORE_Q[k as IvKind]!));
  for (const m of MORE_A) ANSWERS[m.pool][m.tone].push(...L(m.lines));
}
extendInterviews();
export function countBanter2(): number {
  let n = 0;
  for (const s in EXT) for (const g in EXT[s as ExtSit]) n += EXT[s as ExtSit][g as Group].length;
  for (const s in COMEBACKS) for (const t in COMEBACKS[s as 'ahead']) n += COMEBACKS[s as 'ahead'][t as ReplyTone].length;
  for (const s in PRESS_REPLY) for (const t in PRESS_REPLY[s as 'up']) n += PRESS_REPLY[s as 'up'][t as ReplyTone].length;
  return n;
}
