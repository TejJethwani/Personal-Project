/**
 * The weekly newspaper: short articles generated from the state of the world. They describe
 * results and hint at who is favourite for titles and awards — without ever deciding anything.
 */
import { ordinal } from './util';
import type { Game } from './types';
import { S } from './match/model';
import { tableOf, compFixtures } from './competitions';
import { teamName } from './match/setup';
import { addNews } from './util';
import { seasonLines } from './awards';
import { smartLine } from './data/banter2';
import { rivalQuoteReply } from './interactions';
import { bdoRows, base as bdoBase } from './ballondor';
import { banterLine } from './data/banter';
import { h2h } from './rivalry';

const pick = <T,>(a: T[], n: number): T => a[((n % a.length) + a.length) % a.length];

export function weeklyPress(g: Game, week: number): void {
  const w = g.world;
  if (w.phase !== 'pro') return;
  const me = w.players[g.career.pid];
  const lg = (me.club && w.clubs[me.club]?.league) || 'eng1';
  const comp = w.comps[lg];
  if (!comp || comp.done) return;
  const tab = tableOf(w, lg);
  if (!tab.length || tab[0].p < 3) return;
  const seed = w.season * 53 + week;
  // 1. result of the week
  const recent = compFixtures(w, lg).filter((f) => f.played && f.day > w.day - 7 && f.sc);
  if (recent.length) {
    const big = [...recent].sort((a, b) => Math.abs(b.sc![0] - b.sc![1]) * 2 + b.sc![0] + b.sc![1] - (Math.abs(a.sc![0] - a.sc![1]) * 2 + a.sc![0] + a.sc![1]))[0];
    const hw = big.sc![0] > big.sc![1], draw = big.sc![0] === big.sc![1];
    const win = teamName(w, hw ? big.h : big.a), lose = teamName(w, hw ? big.a : big.h), sc = hw ? `${big.sc![0]}–${big.sc![1]}` : `${big.sc![1]}–${big.sc![0]}`;
    const margin = Math.abs(big.sc![0] - big.sc![1]);
    const title = draw ? `${teamName(w, big.h)} and ${teamName(w, big.a)} share ${big.sc![0] + big.sc![1]} goals` : margin >= 4 ? `${win} run riot: ${sc} against ${lose}` : margin >= 2 ? `${win} too strong for ${lose}` : `${win} edge ${lose} ${sc}`;
    const scorers = (big.goals ?? []).map((gl) => w.players[gl[2]]?.sn).filter(Boolean);
    addNews(g, 'paper', title, `${comp.name}, week ${week}. ${draw ? `It finished ${big.sc![0]}–${big.sc![1]}.` : `${win} won ${sc}.`}${scorers.length ? ` On the scoresheet: ${[...new Set(scorers)].slice(0, 5).join(', ')}.` : ''} ${pick(['The dressing room will not forget this one.', 'The table is starting to take shape.', 'A result that will be talked about all week.', 'Three points that say a lot about both sides.'], seed)}`, { imp: 1, clubs: [big.h, big.a] });
  }
  // 2. the title race
  if (week % 2 === 0 && tab.length > 3) {
    const [a, b, c] = tab;
    const gap = a.pts - b.pts, left = Math.max(0, comp.rounds - a.p);
    const fav = gap >= 7 ? `${a.name} are running away with it` : gap >= 3 ? `${a.name} are favourites, but ${b.name} are within reach` : `nothing separates ${a.name} and ${b.name}`;
    addNews(g, 'paper', left <= 6 ? `Title run-in: ${fav}` : `Title race: ${fav}`, `${a.name} ${a.pts} pts, ${b.name} ${b.pts}, ${c.name} ${c.pts} after ${a.p} matches${left ? `, ${left} to play` : ''}. ${gap >= 7 ? 'Bookmakers have stopped taking bets.' : gap >= 3 ? 'One bad week would change everything.' : 'Our panel is split down the middle.'}${me.club && tab.findIndex((r) => r.id === me.club) >= 0 ? ` ${teamName(w, me.club)} sit ${ordinal(tab.findIndex((r) => r.id === me.club) + 1)}.` : ''}`, { imp: 1, clubs: [a.id, b.id], me: a.id === me.club || b.id === me.club });
  }
  // 3. Golden Boot watch
  if (week % 3 === 0) {
    const sc = seasonLines(g, lg).filter((x) => x.line[S.G] > 0).sort((x, y) => y.line[S.G] - x.line[S.G]).slice(0, 4);
    if (sc.length >= 3) addNews(g, 'paper', `Golden Boot watch: ${sc[0].p.sn} leads on ${sc[0].line[S.G]}`, `${sc.map((x, i) => `${i + 1}. ${x.p.name} (${teamName(w, x.club)}) ${x.line[S.G]}`).join(' · ')}. ${sc[0].line[S.G] - sc[1].line[S.G] >= 4 ? `It is ${sc[0].p.sn}'s to lose.` : 'Still anybody\'s race.'}`, { imp: 1, pids: sc.map((x) => x.p.id) });
  }
  // rivals talk about you in the papers
  if (week % 3 === 1 && g.career.rivals.length) {
    const rid = g.career.rivals[(seed >>> 1) % g.career.rivals.length];
    const rp = w.players[rid];
    // what he says depends on how the rivalry is going: a rival on the wrong end of it does not sneer
    const hh = rp ? h2h(g, rid) : null;
    const myS = Object.values(me.ss).reduce((x, l) => x + l[S.G], 0), hisS = rp ? Object.values(rp.ss).reduce((x, l) => x + l[S.G], 0) : 0;
    const diff = hh ? hh.w - hh.l + (myS >= hisS + 6 ? 1 : 0) : 0;
    const quote = rp ? smartLine(rp, 'press', { lead: 0, myGoals: 0, h2hDiff: diff }, me.sn, rp.club ? teamName(w, rp.club) : '', w.season, seed) : '';
    if (rp && !rp.retired) rivalQuoteReply(g, rid, quote, diff >= 1);
    if (rp && !rp.retired) addNews(g, 'paper', `${rp.sn} on ${me.sn}: "${quote}"`, `${rp.name} was asked about his rivalry with ${me.name} this week. Head to head so far: ${h2h(g, rid).w} wins for ${me.sn}, ${h2h(g, rid).l} for ${rp.sn}, ${h2h(g, rid).d} drawn.`, { imp: 2, me: true, pids: [rid] });
  }
  // 4. Ballon d'Or power ranking
  if (week % 4 === 0 && week >= 8) {
    const rows = bdoRows(g, Math.min(15, Math.max(5, Math.floor(week / 3))));
    const top = rows.slice(0, 5);
    if (top.length >= 5) {
      const mine = top.findIndex((x) => x.pid === me.id);
      const gap = bdoBase(top[0]) - bdoBase(top[1]);
      addNews(g, 'paper', `Ballon d'Or power ranking: ${top[0].name} out in front`, `${top.map((x, i) => `${i + 1}. ${x.name} (${x.clubName}) — ${x.g} goals, ${x.a} assists, avg ${x.rat.toFixed(2)}`).join(' · ')}. ${gap > 40 ? `${top[0].name} is the clear favourite as things stand.` : `${top[0].name} and ${top[1].name} are neck and neck; trophies in May and the summer tournament will decide it.`}${mine >= 0 ? ' You are in the conversation.' : ''} The vote is in late October.`, { imp: mine >= 0 ? 2 : 1, pids: top.map((x) => x.pid), me: mine >= 0 });
    }
  }
}
