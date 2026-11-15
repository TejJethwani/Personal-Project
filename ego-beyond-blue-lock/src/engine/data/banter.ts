/**
 * Banter: what opponents and rivals say to the user. Original lines, grouped by the speaker's
 * personality type and the situation. {me} = the user's short name, {r} = the speaker's short name,
 * {club} = the speaker's team. Lines are picked deterministically from match state.
 */
import type { Player } from '../types';
import { hashStr } from '../rng';

export type Archetype = 'king' | 'ice' | 'fire' | 'joker' | 'humble' | 'genius' | 'wild' | 'vet';
export type Situation = 'pre' | 'theyScore' | 'youScore' | 'youMiss' | 'theyWinDuel' | 'youWinDuel' | 'theyWon' | 'theyLost' | 'draw' | 'press';
const L = (s: string) => s.split('|');

export const BANTER: Record<Archetype, Record<Situation, string[]>> = {
  king: {
    pre: L('Bow now, {me}. It saves time later.|This pitch has one king. You are standing in his light.|I read your name on the team sheet. I had to ask who it was.|Enjoy the warm-up. It is the last time tonight you will feel good.|You are here to be part of my highlight reel.|Everyone in this stadium paid to watch me. You are the furniture.'),
    theyScore: L('That is what a real striker looks like, {me}. Take notes.|Did you see it? Of course you did. Everyone did.|One touch. One goal. One king.|Write that one down for your memoirs: "I was there."|That goal was mine before the pass was even played.|Kneel, {me}. That is the correct reaction.'),
    youScore: L('Fine. Even a peasant finds a coin sometimes.|Do not smile. That was the keeper\'s gift, not your talent.|One goal? I do that before breakfast.|Good. Now it is worth my while to crush you.|Celebrate quickly. I am about to take it back.|I allowed that. Do not confuse it with earning it.'),
    youMiss: L('That is the difference between us, {me}. I do not miss those.|Tragic. Truly. Shall I show you how?|You had the whole goal and chose the crowd.|The ball deserved better than you.|Keep shooting like that and I will sign your shirt for you.|A king finishes. A pretender apologises.'),
    theyWinDuel: L('Get up. The floor does not suit you... actually, it does.|You tried to take the ball from me? Adorable.|Stay down, {me}. It is safer there.|That is my ball. It has always been my ball.|Next time bring a friend. Bring two.|You are too slow to be in my story.'),
    youWinDuel: L('...Do that again and I will take it personally.|A lucky bounce. Do not get ideas.|Hm. So the insect has a sting.|I was looking at the goal, not at you.|Enjoy it. That is the only one you get.|You have my attention now. You will regret that.'),
    theyWon: L('As expected. Tell your friends you shared a pitch with me.|Three points and a lesson. You are welcome.|You played. I ruled. Simple.|Come back when you are worthy of my boots.|Do not look so sad. Losing to me is an honour.|The crown stays where it belongs.'),
    theyLost: L('Remember this face, {me}. You will see it in your nightmares.|One result changes nothing. I am still me. You are still you.|You won a match. I am winning an era.|Laugh while you can. Kings have long memories.|This was your night. The decade is mine.|I will make you pay for every second of this.'),
    draw: L('A draw with you counts as an insult to me.|We share a point. We do not share a level.|You survived. That is all that happened.|Next time there will be no mercy and no draw.'),
    press: L('{me}? A decent player. I am told he tries very hard.|I do not have rivals. I have people who lose to me. {me} is one of them.|If {me} wants my attention he should start by winning something.|Compare us if you like. Then look at the numbers.|He is good. I am inevitable. Print that.'),
  },
  ice: {
    pre: L('Lukewarm.|Do not waste my time today, {me}.|You are in my way. Move, or be moved.|I have already seen how this ends.|Say less. Play more. If you can.|You are not the one I came here to beat. You are just in the way.'),
    theyScore: L('Is that all your defence has?|Predictable.|One. Counting upwards.|You blinked. I did not.|That was the easy version.|Keep watching, {me}. It gets worse.'),
    youScore: L('Hm.|...Not bad. Still lukewarm.|One goal does not make you interesting.|Do it again. Then I might look at you.|Noted.|You have my eyes for exactly one minute.'),
    youMiss: L('Pathetic.|That is your level. Good to know.|You hesitated. That is why you will never catch me.|A clear chance, wasted. Typical.|Stop embarrassing the ball.|You do not deserve the next one.'),
    theyWinDuel: L('Too slow.|Read. Reacted. Done.|You telegraph everything.|Out of my way.|I saw that move last year. From someone better.|Predictable players lose the ball.'),
    youWinDuel: L('...Tch.|Once.|That will not work twice.|Fine. You have a move.|I will adjust. You will not.|Do not look pleased. It is unbecoming.'),
    theyWon: L('As it should be.|You were never the obstacle.|Come back less lukewarm.|This was routine.|Nothing here surprised me. Especially you.|Next.'),
    theyLost: L('...I will not forget this.|This changes nothing about who is better.|Today. Only today.|You have made yourself a target, {me}.|Enjoy it quietly.|I am going to break that smile next time.'),
    draw: L('Unacceptable.|A draw is a loss with better manners.|Neither of us deserved more. I will fix my half.|We are not finished.'),
    press: L('I do not think about {me}.|He is improving. It will not be enough.|Ask me again when he has beaten me twice.|There is a gap. He knows where it is.|He is a good player. Good players are everywhere.'),
  },
  fire: {
    pre: L('I am going to run through you today, {me}!|You and me. All ninety minutes. Do not you dare hide!|I have been waiting for this all week. LET\'S GO!|Look at me. LOOK AT ME. Today you lose!|No handshake. We shake hands when it is over!|I hope you slept. You will need the legs!'),
    theyScore: L('YES! THAT is how you hit a ball!|Did you hear that net, {me}?! Beautiful!|COME ON! Who is stopping me?! Nobody!|That one was for everyone who doubted me!|Boom! Your turn, if you have the guts!|I told you! I TOLD you!'),
    youScore: L('Agh! Fine! Now it is a fight!|Good! GOOD! Do not make it easy for me!|You think that scares me? It wakes me up!|Lucky! Do it again, I dare you!|That is it. No more Mr. Nice Guy!|All right, {me}. Now I am angry.'),
    youMiss: L('HA! Wide! Miles wide!|Shoot it properly or go home!|That is what pressure does to you, {me}!|Row Z says thank you!|My grandmother buries that one!|Keep missing! I love it!'),
    theyWinDuel: L('MINE! Get off my ball!|Too strong for you, {me}!|You bounce off me like a kid!|Stay down! Stay DOWN!|I eat tackles like yours for lunch!|Is that all the fight you have?!'),
    youWinDuel: L('Oi! OI! That will be the last time!|You got me. Once. ONCE!|Right. Now I am coming for you.|Agh! Clean... I hate that it was clean!|Do not walk away from me!|Next ball is mine and you know it!'),
    theyWon: L('THAT is what it means to want it more!|Go home, {me}! This is our house!|Three points! Say it with me!|I left everything out there. You left early!|Shake my hand now. NOW you may.|What a game! And what a result — for us!'),
    theyLost: L('This is NOT over, {me}! Not by a mile!|I will remember every second of this!|Rematch. Soon. I am already counting the days.|Do not celebrate in front of me!|You were better today. TODAY!|I am going to train until I cannot stand. Then I am coming for you.'),
    draw: L('A draw?! I wanted blood!|Nobody won, so nobody is happy. Especially me!|We settle this next time. Properly!|I hate draws. I hate them!'),
    press: L('{me}? I cannot wait to play him again. Write that in capitals.|He beat me once and I have not slept properly since.|I respect him. I also want to flatten him. Both are true.|Tell {me} I am coming. He will understand.|Our next game? Circle it. Twice.'),
  },
  joker: {
    pre: L('Oh good, {me} is here. I was worried this would be difficult.|Let us play a game: you chase me, and I laugh.|Did you bring a camera? You will want proof you were near the ball.|I promised my mum I would be nice today. I lied.|First one to nutmeg the other buys dinner. I am hungry.|Smile, {me}! You are about to be on my highlight reel.'),
    theyScore: L('Oops! Did I do that? I did that.|Sorry, sorry — was that your net?|Ta-daaa!|That was fun. Shall we do it again?|I closed my eyes for that one. Honest.|Somebody check on the keeper, he looks lonely.'),
    youScore: L('Hey! No fair, I was not ready!|Okay, okay, you can play a bit.|Nice one! ...I hate it. But nice one.|Now we are dancing, {me}!|You are making this fun. I like fun.|One–nil to the serious guy. Boo!'),
    youMiss: L('Ooooh, so close! To the corner flag.|Was that a shot or a clearance?|The ball is still rising, I think.|Do not worry, the car park needed a ball.|Aim for the big rectangle next time. It has a net.|I have seen better finishing on a first date.'),
    theyWinDuel: L('Nutmeg! That is dinner, {me}!|Now you see it... now you are on the floor.|Whoosh! Bye-bye!|Were you trying to tackle me or hug me?|Too easy. Give me a real challenge.|You fell for that? Everyone falls for that!'),
    youWinDuel: L('Hey! That was my ball! Rude.|Oh, you are quick. I do not like that.|Fine, keep it. I did not want it anyway. (I did.)|Okay, {me}, one–nil in the mini-game.|You read me?! Nobody reads me!|That was sneaky. I approve.'),
    theyWon: L('Good game! By which I mean: I won.|Same time next week? I will bring more goals.|Do not be sad, you made it entertaining.|Dinner is on you, remember.|That was a party and you were the piñata.|Thanks for playing, {me}!'),
    theyLost: L('Well. That was not in the script.|I let you win. Obviously. You are welcome.|Okay, you got me. I will be less funny next time.|Enjoy it, {me}. I am plotting already.|Somebody tell my legs the match started.|You owe me a rematch and a drink.'),
    draw: L('A draw! Everybody is equally disappointed. Lovely.|We both won! No? Just me? Okay.|Next time I am not sharing.|Half a party is still a party.'),
    press: L('{me}? Great guy. Terrible at losing to me, though.|We have a rivalry? Nobody told me. I would have tried harder.|I like playing him. He takes it so seriously.|Tell {me} the nutmeg count is still in my favour.|He is good. I am more fun. The fans know.'),
  },
  humble: {
    pre: L('Good luck today, {me}. I mean it.|It is a privilege to share a pitch with you. I still plan to win.|Let us give them a proper game.|I have studied you all week. You are harder to read than I hoped.|May the better side win. I hope that is us.|Whatever happens, let us shake hands after.'),
    theyScore: L('The team made that one. I just finished it.|I got a bit lucky there.|That is one. Stay focused.|Sorry, {me}. Had to take it.|Good ball from my team-mate. I only had to be there.|We keep going.'),
    youScore: L('Great finish. Really.|You earned that one, {me}.|I have to do better there. Well played.|That is why everyone talks about you.|Good goal. Now it is my turn to answer.|No complaints. That was class.'),
    youMiss: L('Unlucky. It was a good idea.|That one will go in next time. Hopefully not today.|Close. Too close for my liking.|I thought that was in.|You will not miss many of those.|We got away with one there.'),
    theyWinDuel: L('Sorry — fair challenge, I hope.|I have been working on that all month.|Got it this time.|You okay? Good. Let us go again.|That one was mine. The next might be yours.|I had to be perfect to win that.'),
    youWinDuel: L('Clean. Well done.|You are stronger than you look.|I did not see that coming.|Good feet. I will be ready next time.|That is the level I am chasing.|Fair. Completely fair.'),
    theyWon: L('We were a little better today. Only a little.|You made us work for every minute, {me}.|Hard luck. I know how that feels.|Thank you for the game. You pushed me.|It could have gone either way.|See you next time. Keep going.'),
    theyLost: L('You deserved it. Congratulations.|Best player on the pitch today, {me}.|I learned something tonight. Thank you.|No excuses. You were better.|Enjoy it. I will come back stronger.|That is the standard I have to reach.'),
    draw: L('A fair result, I think.|Neither of us gave an inch.|I will take the point and the lesson.|Good battle. Let us do it again.'),
    press: L('{me} is the standard at the moment. I am trying to get there.|Every time I play him I come away better.|I would not call it a rivalry. I would call it motivation.|He deserves everything he is getting.|He is the reason I stay late at training.'),
  },
  genius: {
    pre: L('I have run this match in my head forty times, {me}. You lose in thirty-eight.|Your first touch drifts left under pressure. I will be standing there.|There are eleven of you and I already know where ten will be.|Try to surprise me. Please. I am bored.|You think in moves. I think in outcomes.|The pitch is a puzzle. You are one of the easier pieces.'),
    theyScore: L('Exactly as drawn.|You were two metres out of position. I saw it a minute ago.|That was decided three passes back.|Checkmate was never in doubt.|I only needed you to step once. You stepped.|Solution found.'),
    youScore: L('Interesting. That was one of the two outcomes I could not close.|You broke the pattern. Do it again and I will have it.|An outlier. I will account for it.|So you can improvise. Noted.|That was not in my model. It is now.|Good. A puzzle that fights back.'),
    youMiss: L('The angle was wrong before you received it.|You rushed. I counted on it.|Seventy per cent of your shots from there miss. Now seventy-one.|You saw the goal. You did not see me closing the lane.|Error: finishing.|Predicted.'),
    theyWinDuel: L('You always fake right first.|I read your hips, not the ball.|That is the third time you have tried that.|You showed me the move in the warm-up.|Patterns, {me}. You are made of them.|I was there before you decided.'),
    youWinDuel: L('...You changed the tempo. Clever.|I had the wrong read. It will not happen again.|New data. Thank you.|You hid that one well.|Fine. I will widen the model.|That is the first thing today I did not expect.'),
    theyWon: L('The result matched the simulation.|You played the game. I played you.|Nothing personal. Just geometry.|You were good. The plan was better.|I will send you my notes. You will need them.|As calculated.'),
    theyLost: L('I miscalculated you. That is rare.|You were the variable. I underrated it.|Back to the whiteboard.|Enjoy being unsolved. It will not last.|I will study this one for a week.|You beat the plan. I will write a better one.'),
    draw: L('An inconclusive result. I dislike those.|Two correct answers cancel out.|The model needs one more match.|Neither of us solved it.'),
    press: L('{me} is the only opponent whose next move I cannot always name.|Statistically we are close. Stylistically we are opposites.|He plays on instinct. Instinct has patterns too.|I keep a file on him. It is getting thick.|I enjoy problems. He is a good one.'),
  },
  wild: {
    pre: L('I can smell it, {me}. Today is going to EXPLODE.|Do not bore me. Bored me is dangerous me.|Let us make something beautiful and violent!|You and me, we are going to make the crowd scream.|I have got a goal inside me that wants OUT.|Dance with me, {me}. Try to keep up.'),
    theyScore: L('BOOM! Did you feel that?!|That is the good stuff! More! MORE!|Ahhh, that hit different!|The monster says hello!|I did not even look! I just FELT it!|What a rush! Again!'),
    youScore: L('Ooh! Now THAT is a goal! I am jealous!|Yes! Give me a rival like that!|You are alive after all, {me}!|That made my skin tingle. Do it again!|Finally someone interesting!|Good! Now we both go crazy!'),
    youMiss: L('Aww. You killed the vibe.|No, no, no — you have to FEEL it!|Wasted! That one wanted to go in!|The goal is sad now. Look at it.|You thought about it. Never think.|Give it to me next time, I will show you.'),
    theyWinDuel: L('Too slow for the rhythm!|You cannot catch what you cannot guess!|Wheee!|My feet did that on their own!|That is one for the monster!|Left, right, gone!'),
    youWinDuel: L('Ha! You got me! I love that!|Ooh, you bite!|Do it again, I was not ready!|That was fun. You are fun.|You stole my dance!|All right, you are in the game now!'),
    theyWon: L('What a ride! Thanks, {me}!|We blew the roof off!|I could play that match forever!|You lost, but you were not boring!|That was pure electricity!|Next time bring even more!'),
    theyLost: L('Ugh. The ending was wrong.|You were the fire today. I felt it.|I want another one. Right now.|You made me feel alive. I will repay it with goals.|That stung. I kind of liked it.|Rematch! Rematch! Rematch!'),
    draw: L('No winner?! That is like a song with no chorus!|We both went crazy and nobody won. Weird.|Half the explosion. I want the rest.|Encore next time!'),
    press: L('{me} makes my blood move. I want to play him every week.|He is not boring. That is the best thing I can say about anyone.|When we are on the same pitch, something always happens.|I do not hate him. I want to devour him. Different thing.|Tell him I am hungry.'),
  },
  vet: {
    pre: L('I have seen a hundred like you come and go, {me}.|Enjoy today, son. I will teach you something for free.|When I was your age I was already tired of winning.|Nice boots. Let us see if they have ever been in a real game.|You have the legs. I have the answers.|Do not take it personally. It is just experience.'),
    theyScore: L('Old dog. Old trick. Still works.|You do not lose that, son. It just gets slower and smarter.|That is what twenty years looks like.|I have scored that goal in four different decades.|Positioning, kid. Positioning.|Class is permanent.'),
    youScore: L('Good goal, kid. Do not let it go to your head.|I remember scoring my first against a legend too.|You have got something. I will admit it.|Well taken. Now do it for fifteen years.|That was a grown-up finish.|Fine. The kid can play.'),
    youMiss: L('Patience, son. You snatched at it.|I used to miss those too. In my teens.|Breathe before you shoot. Free advice.|The young ones always rush.|You will learn. Painfully.|That is the gap: I would have waited.'),
    theyWinDuel: L('You went early. They always go early.|I let you think you had it.|Strength is not everything, kid.|I have been shielding balls since before you could walk.|Stand up, dust off, learn.|That one is called experience.'),
    youWinDuel: L('...These legs are not what they were.|Quick. Too quick for an old man.|All right, kid. You earned that.|I would have won that five years ago.|Good. Do not get cocky.|You remind me of me. That is not a compliment yet.'),
    theyWon: L('One more for the old guard.|Come and see me after. I will tell you what you did wrong.|You will beat me one day. Not today.|Experience wins the long games.|Keep your head up. You are close.|I am not done yet, kid.'),
    theyLost: L('Maybe it is your time. Maybe.|Well played, son. That was a passing of something.|I felt every year tonight.|Do not waste what you have, {me}.|You beat me fair. Few have.|Enjoy it. And look after your knees.'),
    draw: L('I will take a point from the kid.|Honours even. My pride is intact.|You could not beat an old man. Think about that.|A fair lesson for both of us.'),
    press: L('{me}? He is the real thing. I do not say that often.|He will have a career people talk about. If he listens.|I enjoy our battles. They keep me young.|He reminds me why I still play.|One day he will be the old dog. I hope he remembers me.'),
  },
};

/** Named characters: their own voice, used ahead of the generic type lines. [before the match…, during / after…] */
export const VOICES: Record<string, { pre: string[]; jab: string[]; gloat: string[] }> = {
  'Yoichi Isagi': { pre: L('I can see the whole pitch, {me}. I can see where you lose it.|I am going to devour you and become the best striker in the world.|Your weapon is good. Mine is evolving right now.|Today you are the stepping stone.'), jab: L('I read that three seconds ago.|That is the smell of a goal — and it is mine.|You were a piece on my board.|Too slow. I have already moved on.'), gloat: L('That is my goal. My formula. Remember it.|I devoured you today, {me}.|The protagonist of this pitch is me.|Shut up, mediocre talent.') },
  'Michael Kaiser': { pre: L('Welcome to my stage, {me}. Try to be a decent clown.|The emperor does not learn names. Earn yours.|I will show you the impossible. Watch closely, it is fast.|You are a supporting actor in my masterpiece.'), jab: L('Kaiser Impact. You are welcome.|Too human. Far too human.|Kneel before the emperor.|Did the clown really think he could stop me?'), gloat: L('Bow. That is all that is left for you.|Another crown. They fit so well.|You were entertaining, {me}. For a clown.|The world revolves around my right foot.') },
  'Rin Itoshi': { pre: L('Lukewarm. All of you.|I will destroy you, {me}. Then I will destroy my brother.|Do not get in my way.|You are not even an obstacle.'), jab: L('Die.|Pathetic.|That is your limit. I do not have one.|Lukewarm trash.'), gloat: L('This is the difference in our egos.|You were never my rival.|Out of my sight.|I will kill your football next time too.') },
  'Meguru Bachira': { pre: L('Hey, {me}! Does your monster want to play with mine?|Let us dribble until the sun goes down!|I can hear it — today is going to be fun!|Try to catch me! You cannot!'), jab: L('Nyahaha! Too slow!|Left, right, monster!|That one tickled!|Did you see that? My feet are dancing!'), gloat: L('That was the most fun I have had all week!|Your monster is cute. Mine is bigger!|Play with me again, okay?|Football is a party and I am the music!') },
  'Seishiro Nagi': { pre: L('What a hassle... can we get this over with, {me}?|I would rather be napping. So I will end it quickly.|You look like effort. I do not like effort.|Mm. I guess I will beat you.'), jab: L('That was easy. Too easy.|The ball just... stops for me.|What a hassle. Goal.|Were you trying? Sorry, I could not tell.'), gloat: L('Okay, done. Can I go home now?|That was less of a hassle than I thought.|You made me try a little. Annoying.|I win. Yawn.') },
  'Shoei Barou': { pre: L('The king has arrived. Clean my pitch, donkey.|I am the lead. You are a commoner, {me}.|Stay out of my lane or get run over.|There is one star on this field and he does not pass.'), jab: L('Out of the way, donkey!|The king scores alone!|That is my goal and my rule!|Commoners should watch quietly.'), gloat: L('Bow to the king, {me}.|I rule this pitch. I always have.|You were a decent servant today.|The throne is not for sharing.') },
  'Ryusei Shidou': { pre: L('I am going to make this goal EXPLODE, {me}!|Everything inside the box is my territory. Step in and get burned!|I can feel it — a big bang is coming!|Are you ready to be reborn through my goals?!'), jab: L('BIG BANG!|Ahhh! That one was alive!|The box belongs to the demon!|Explode! Explode! EXPLODE!'), gloat: L('That was ecstasy, {me}!|Goals are life! And I am very alive!|You cannot tame this!|More! I want more of that!') },
  'Rensuke Kunigami': { pre: L('I will beat you head on, {me}. No tricks.|I walk my own path. You are standing on it.|Fair and square — and I win.|My left foot settles this.'), jab: L('Straight through.|That is a hero\'s strike.|No tricks. Just power.|Feel that?'), gloat: L('I won it the right way.|Get stronger, {me}. Then come again.|That is what resolve looks like.|I do not lose to shortcuts.') },
  'Hyoma Chigiri': { pre: L('Try to keep up, {me}. Nobody ever has.|I broke my chains. Now I break defences.|You will only see my back today.|Fifty metres. I will give you a head start.'), jab: L('Too slow!|See you at the goal line.|Speed is my ego.|Did you feel the wind?'), gloat: L('You never got close.|That is the fastest man on the pitch for you.|Catch me next time. If you can.|I ran right past your pride.') },
  'Reo Mikage': { pre: L('Anything you can do, {me}, I can copy. Better.|I always get what I want. Today I want this win.|Show me your weapon. I will borrow it.|I am ninety-nine per cent of everyone here.'), jab: L('Copied.|That move looks better on me.|Chameleon. Remember the word.|Thanks for the lesson. I improved it.'), gloat: L('I took your football and made it mine.|There is nothing you have that I cannot have.|That is what a complete player looks like.|You were a useful reference, {me}.') },
  'Alexis Ness': { pre: L('Everything I do is for Kaiser. You are in his way, {me}.|Do not touch the ball. It is not meant for you.|I will make the magic. You will watch.|Know your place.'), jab: L('A perfect pass for a perfect emperor.|You should not even be on this pitch.|Magic, was it not?|Step aside.'), gloat: L('That was beautiful. You could never.|Kaiser\'s victory. As always.|Run along, {me}.|The magician always wins.') },
  'Tabito Karasu': { pre: L('I have already found your weak spot, {me}. Want a hint?|I pick on the mediocre. Lucky you.|Let us see how long you last under analysis.|Crows eat what falls behind.'), jab: L('Found it.|Weak side, as predicted.|You crack right where I pressed.|Do not take it personally. Actually, do.'), gloat: L('I told you I had found it.|Your weakness has a name now.|Study yourself, {me}. I did.|Easy pickings.') },
  'Oliver Aiku': { pre: L('Nobody scores on my defence, {me}. You are not special.|I will be on your shoulder all night. Get comfortable.|Strikers break against me. Come and try.|I read forwards for a living.'), jab: L('Shut down.|Not through me.|I was in your head before you turned.|Is that everything?'), gloat: L('Another striker in my pocket.|You will dream about my shadow.|Clean sheet. Clean conscience.|Come back with a new idea, {me}.') },
  'Gin Gagamaru': { pre: L('I stop things. That is all.|You shoot. I catch. Simple.|Hm. I am ready.|Try anything. I will reach it.'), jab: L('Got it.|Mine.|Not today.|I felt that one coming.'), gloat: L('Nothing got past me.|That is my job.|Good shots. Still saved.|Try again next time.') },
  'Noel Noa': { pre: L('Football is logic. Show me yours, {me}.|I judge only by goals. Speak in goals.|Emotion is noise. Efficiency wins.|Be rational, or be beaten.'), jab: L('The rational choice.|Zero wasted movement.|That is the correct answer.|You hesitated. That is why.'), gloat: L('The numbers were never in doubt.|Improve your efficiency.|That is the world\'s standard.|Come back when your formula is complete.') },
  'Don Lorenzo': { pre: L('Ciao, {me}! I am going to stick to you like gum.|You look expensive. Let us lower the price.|I mark you for free today. Tomorrow I charge.|Zombie defending, baby. I do not get tired.'), jab: L('Still here!|You cannot shake me, amico!|Got your wallet and the ball.|Boo! Behind you!'), gloat: L('You were worth nothing today, {me}!|Zero goals. Zero euros.|I had fun. You did not.|Ciao ciao!') },
};

/** What the user can say back. tone → lines. */
export const REPLIES: Record<'cold' | 'fire' | 'respect', string[]> = {
  cold: L('Talk less. I answer on the pitch.|Remember this conversation at full time.|I did not come here to chat.|Say it again after ninety minutes.|You have my attention. That is your mistake.|Noted. Now watch.|Keep talking. It will not move the ball.|I will let the scoreboard reply.|We will see who is still talking at the end.|Save your breath. You will need it.|Words are cheap. Goals are not.|I have heard it all before. From people I beat.'),
  fire: L('I am going to devour you today!|Bring everything you have — I will crush all of it!|You? You are the stepping stone!|I will make you regret every word!|This pitch is mine. Get off it!|I will score right in front of your face!|You are not my rival. You are my meal!|I am the best striker here and I will prove it now!|Try to stop me. Please. I want you to try!|Tonight everyone learns my name — starting with you!|I will break your ego in two!|Kneel now and save us both the time!'),
  respect: L('May the best player win. I intend to be him.|I have been looking forward to this one.|You make me better. I will thank you with a goal.|Let us give them something to remember.|Good luck. You will need a little.|I respect you. That is why I will not hold back.|After this, shake my hand — whoever wins.|You are the reason I trained late all week.|This is the match I circled.|No tricks. Football decides.|Bring your best. I am bringing mine.|It is an honour. Now let us fight.'),
};

/**
 * Post-match interviews. The situation decides both the question and the three answers, so every answer
 * fits what just happened (nobody brags about a 3–0 defeat — though an egoist can still say something egoist).
 * {r} = the rival, {opp} = the opponent, {sc} = the score from the user's side, {g} = the user's goals.
 */
export type IvKind = 'rivalWin' | 'rivalLoss' | 'rivalDraw' | 'starWin' | 'starDraw' | 'starLoss' | 'poorWin' | 'poorLoss' | 'win' | 'bigWin' | 'draw' | 'loss' | 'heavyLoss';
export const QUESTIONS: Record<IvKind, string[]> = {
  rivalWin: L('You came out on top against {r} today. Has the balance of this rivalry shifted?|{r} had plenty to say before the game. What do you say to him now?|Was beating {r} personal?|People are starting to say you are better than {r}. Are you?'),
  rivalLoss: L('{r} got the better of you tonight. How much does that hurt?|What did {r} do today that you could not?|Is {r} simply ahead of you right now?|What happens the next time you meet {r}?'),
  rivalDraw: L('Honours even with {r}. Who had the better night?|Neither you nor {r} could settle it. What was missing?|Does a draw against {r} feel like a win or a loss?'),
  starWin: L('A {sc} win and you were the difference. Where does that rank for you?|The whole stadium was chanting your name. How did that feel?|Is this the best form of your career?|{g} today. What clicked?'),
  starDraw: L('You were excellent, but it finished {sc}. Is that frustrating?|Your performance deserved a win. What was missing as a team?|You did everything you could. Does a draw sting?'),
  starLoss: L('You were the best player on the pitch, yet you lost {sc}. How do you feel?|A great individual night ruined by the result. What went wrong around you?|Is it hard to take positives from a performance like yours in a {sc} defeat?'),
  poorWin: L('The team won {sc}, but it was a quiet night for you. Are you satisfied?|Three points, but not your best game. What was missing personally?|Does it bother you that others decided this one?'),
  poorLoss: L('A {sc} defeat and a difficult night for you personally. What went wrong?|You looked frustrated out there. Is something off?|How do you respond after a night like this?|Do you understand the criticism you will get this week?'),
  win: L('A {sc} win against {opp}. How would you sum it up?|Three points against {opp}. What pleased you most?|What did the manager ask of you today?|How important was that win for the season?'),
  bigWin: L('A {sc} demolition of {opp}. Did you expect it to be that one-sided?|Everything went right today. Is this the team at its best?|{opp} could not live with you. What made the difference?'),
  draw: L('It finished {sc} against {opp}. A point gained or two lost?|How would you sum up the draw against {opp}?|What was missing in the final third today?'),
  loss: L('A {sc} defeat against {opp}. What went wrong?|How does the dressing room feel after that loss?|What do you take from a defeat like this?|Was {opp} simply better today?'),
  heavyLoss: L('A {sc} defeat to {opp}. How do you explain that?|That was a painful night. Where does the team go from here?|Some fans left early tonight. What do you say to them?|Was that the worst performance of the season?'),
};
export type Tone = 'humble' | 'confident' | 'ego';
const W = { humble: L('The team did the work. I only finished it.|Credit to everyone — that was a collective win.|I am grateful to the manager for trusting me.|One game at a time. Nothing is won yet.|We stay humble and keep working.'), confident: L('I knew what I could do. Today everyone saw it.|I prepared for exactly this. It showed.|I expect this level from myself every week.|This is what I train for.|Give me the ball and I will decide matches.'), ego: L('I am the best player on that pitch. It is not close.|They should build the team around me. Tonight proved it.|Remember my name, because the world will.|I will be the best striker in the world. Write it down.|Nobody stops me when I am like this.') };
const LOSS = { humble: L('We were not good enough. I take my share of the blame.|Credit to them — they deserved it. We have to learn quickly.|I let the team down today. I will work to put it right.|There are no excuses. We were second best.|We apologise to the fans. They deserved more.'), confident: L('One bad night does not define us. We will bounce back.|I know what this team can do. You will see it next week.|We will learn from this and come back stronger.|Losses happen. How we respond is what matters.|I still believe in this group completely.'), ego: L('This will not happen again — next time I take the game on myself.|Losing makes me hungrier. Watch what I do next.|I did not come here to lose. Nobody hates this more than me.|Give me the ball more and results like this disappear.|Today I was not enough. That is the last time I say that.') };
const DRAW = { humble: L('A fair result. We have to be sharper in front of goal.|We take the point and keep working.|They made it hard. We could not find the extra gear.|Not enough today. We know that.|A point is a point. We go again.'), confident: L('We were the better side. The goals will come.|I am happy with how we played. Small details decided it.|We will win the next one. I am sure of it.|We controlled long spells. We just need the finish.|Keep playing like that and we win most of these.'), ego: L('If I get one more chance, we win that game.|A draw is a defeat for me. I want more.|I am not here to share points.|I needed more of the ball. Simple.|Next time I end it before the whistle.') };
const STAR_BAD = { humble: L('My performance does not matter when the team loses.|Individual nights mean nothing without the result.|I would trade all of it for the points.|I could have done more — we all could.|It means nothing if we do not win.'), confident: L('I gave everything. If we keep that level as a team, we win.|I am playing well. The results will follow.|I know my level. Now we raise the team\'s.|Days like this make us stronger.|I am ready to carry more if that is what it takes.'), ego: L('I did my job. Others need to do theirs.|I cannot score and defend at the same time.|If the rest match my level, we do not lose games like that.|I was the best player out there. It was not enough — yet.|Give me better service and watch.') };
const POOR = { humble: L('I was not at my level. I have to be better.|The team carried me today. I owe them one.|Not my night. I will watch it back and fix it.|I need to work harder. Simple as that.|I am disappointed with myself.'), confident: L('Quiet nights happen. Next week will be different.|I know what went wrong. It is fixable.|I am not worried. My form will come back.|Nobody is perfect every week. I will answer on the pitch.|Judge me over the season, not one match.'), ego: L('Even on a bad day I am the most dangerous player on the pitch.|One quiet game does not change who I am.|I was saving it. Next week someone pays.|Bad nights make me more dangerous, not less.|I will answer with goals. Many of them.') };
const RIVAL_W = { humble: L('{r} is a great player. Today it went my way.|It is not about me and {r}. It is about the team.|I respect {r}. Tomorrow it could be his night.|Beating {r} means something because he is so good.'), confident: L('I knew I could get the better of {r}. Today I proved it.|I prepared for {r} all week. It paid off.|I am closing the gap — or maybe it is the other way round now.|This rivalry makes me better. Today it showed.'), ego: L('{r} talks. I score. That is the whole story.|I do not have rivals. I have victims.|{r} should study the tape. He will learn something.|There is only one of us at the top. Tonight everyone saw who.') };
const RIVAL_L = { humble: L('{r} was better tonight. I have to admit it.|Credit to {r}. I have work to do.|He won this one. I will learn from it.|{r} deserved it. I will be back.'), confident: L('{r} won the battle. The war is long.|One result. I am still coming for {r}.|I will be ready next time. He knows that.|This only makes the next meeting bigger.'), ego: L('Enjoy it, {r}. It will not happen again.|He won today. I will make him pay for every second of it.|Remember this one, {r}. It is the last.|I am more motivated than ever. Bad news for him.') };
const RIVAL_D = { humble: L('Neither of us could find a way. Fair result.|{r} is a top player. A draw is honest.|We cancelled each other out.'), confident: L('Next time I settle it.|I had the better chances. It will come.|This rivalry is far from finished.'), ego: L('A draw with {r} is an insult to me.|Next time there will be no draw.|He survived. That is all that happened.') };
export const ANSWERS: Record<IvKind, Record<Tone, string[]>> = {
  rivalWin: RIVAL_W, rivalLoss: RIVAL_L, rivalDraw: RIVAL_D,
  starWin: W, bigWin: W, win: W, starDraw: { ...DRAW, ego: STAR_BAD.ego }, draw: DRAW,
  starLoss: STAR_BAD, poorWin: POOR, poorLoss: { ...LOSS, confident: POOR.confident, ego: POOR.ego }, loss: LOSS, heavyLoss: LOSS,
};

/** Personality type of a player (stable). */
export function archetype(p: Player, season: number): Archetype {
  const e = p.pers.ego, t = p.pers.temper, age = season - p.born;
  const h = hashStr(p.id) % 100;
  if (age >= 32) return 'vet';
  if (e >= 86) return h < 60 ? 'king' : 'ice';
  if (t >= 76) return h < 65 ? 'fire' : 'wild';
  if (e <= 45) return 'humble';
  return (['genius', 'joker', 'ice', 'wild', 'fire', 'humble'] as Archetype[])[h % 6];
}
const fill = (s: string, me: string, r: string, club: string) => s.replace(/\{me\}/g, me).replace(/\{r\}/g, r).replace(/\{club\}/g, club);
/** A line from `p` to the user for a situation. `salt` varies the pick (e.g. the match clock). */
export function banterLine(p: Player, sit: Situation, meName: string, club: string, season: number, salt: number): string {
  const v = VOICES[p.name];
  const k = Math.abs(hashStr(p.id + sit) + salt * 7);
  if (v) {
    const set = sit === 'pre' ? v.pre : sit === 'theyScore' || sit === 'theyWon' ? v.gloat : sit === 'theyWinDuel' || sit === 'youMiss' ? v.jab : null;
    if (set && k % 3 !== 0) return fill(set[k % set.length], meName, p.sn, club);
  }
  const list = BANTER[archetype(p, season)][sit];
  return fill(list[k % list.length], meName, p.sn, club);
}
export function countBanterLines(): number {
  let n = 0;
  for (const a in BANTER) for (const s in BANTER[a as Archetype]) n += BANTER[a as Archetype][s as Situation].length;
  for (const k in VOICES) n += VOICES[k].pre.length + VOICES[k].jab.length + VOICES[k].gloat.length;
  for (const k in REPLIES) n += REPLIES[k as 'cold'].length;
  for (const k in QUESTIONS) n += QUESTIONS[k as IvKind].length;
  for (const a of [W, LOSS, DRAW, STAR_BAD, POOR, RIVAL_W, RIVAL_L, RIVAL_D]) for (const t in a) n += a[t as Tone].length;
  return n;
}
