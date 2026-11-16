/**
 * The weekly newspaper: short articles generated from the state of the world. They describe
 * results and hint at who is favourite for titles and awards — without ever deciding anything.
 */
import { ordinal } from './util';
import type { Game } from './types';
import { S } from './match/model';
import { LEAGUES } from './data/clubs';
import { hashStr } from './rng';
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
  // 5. around the other leagues: who leads, who is scoring, who was the player of the week — the world does not revolve around one player
  {
    const others = LEAGUES.filter((L) => L.tier === 1 && L.id !== lg && w.comps[L.id] && !w.comps[L.id].done);
    const L = others[(week + w.season) % Math.max(1, others.length)];
    if (L) {
      const t2 = tableOf(w, L.id);
      if (t2.length && t2[0].p >= 3) {
        const top = seasonLines(g, L.id).filter((c) => c.line[S.G] > 0).sort((a, b) => b.line[S.G] - a.line[S.G])[0];
        const potw = Object.values(w.awards).filter((a) => a.type === 'potw' && a.comp === L.id && a.s === w.season).sort((a, b) => b.day - a.day)[0];
        addNews(g, 'world', `Around Europe — ${L.name}: ${t2[0].name} ${t2[0].pts - (t2[1]?.pts ?? 0) >= 6 ? 'pulling clear' : 'lead the way'}`, `${t2[0].name} top the ${L.name} on ${t2[0].pts} points, ${t2[0].pts - (t2[1]?.pts ?? 0)} ahead of ${t2[1]?.name}.${top ? ` ${top.p.name} (${teamName(w, top.club)}) leads the scoring charts with ${top.line[S.G]}.` : ''}${potw?.winner ? ` Player of the Week: ${potw.winner.name} — ${potw.winner.line}.` : ''}`, { imp: 2, pids: [top?.p.id, potw?.winner?.pid].filter((x): x is string => !!x), clubs: [t2[0].id] });
      }
    }
    // the best performer in the user's own league this week, whoever he is
    const pw = Object.values(w.awards).filter((a) => a.type === 'potw' && a.comp === lg && a.s === w.season).sort((a, b) => b.day - a.day)[0];
    if (pw?.winner && pw.winner.pid !== me.id && pw.day >= w.day - 7) addNews(g, 'paper', `${pw.winner.name} is the ${comp.name}'s Player of the Week`, `${pw.winner.clubName}: ${pw.winner.line}.`, { imp: 2, pids: [pw.winner.pid], clubs: [pw.winner.club] });
  }
  // 4. Ballon d'Or watch: each paper has its own panel, its own taste and its own favourite, so nobody knows who leads
  if (week % 2 === 0 && week >= 8) {
    const PAPER = ['touchline', 'express', 'bls', 'monde'][(week / 2) % 4];
    const rows = bdoRows(g, Math.min(15, Math.max(5, Math.floor(week / 3)))).slice(0, 25);
    if (rows.length >= 8) {
      const noise = (pid: string) => 1 + ((hashStr(pid + PAPER + week + w.season) % 1000) / 1000 - 0.5) * 0.3;
      const taste = (r: (typeof rows)[number]) => {
        const p2 = w.players[r.pid];
        if (PAPER === 'touchline') return (r.sForm * 1.5 + r.sGoals * 0.7 + r.sTroph * 0.5);
        if (PAPER === 'express') return (r.sGoals * 1.6 + r.sForm * 0.5 + r.sTroph * 0.5) * (w.clubs[r.club]?.league === 'eng1' ? 1.25 : 1);
        if (PAPER === 'bls') return (r.sGoals + r.sForm + r.sTroph * 0.6) * (p2?.origin === 'bluelock' || r.nat === 'JPN' ? 1.45 : 1);
        return (r.sTroph * 1.7 + r.sForm + r.sGoals * 0.7) * ((p2?.ss.ucl?.[S.APP] ?? 0) > 0 ? 1.12 : 1);
      };
      const top = [...rows].sort((a, b) => taste(b) * noise(b.pid) - taste(a) * noise(a.pid)).slice(0, 5);
      const mine = top.findIndex((x) => x.pid === me.id);
      const NAME: Record<string, string> = { touchline: 'The Touchline', express: 'GOAL EXPRESS', bls: 'Blue Lock Sports', monde: 'Le Monde du Football' };
      const VIEW: Record<string, string> = { touchline: 'Our writers judge on week-in, week-out level, not highlight reels.', express: 'Goals win Ballon d\'Ors. Our list is simple: who is putting the ball in the net?', bls: 'Our correspondents back the egoists — and they are not shy about it.', monde: 'Silver decides it in the end. Our panel weighs the big trophies and the European nights.' };
      const lead = top[0];
      addNews(g, 'paper', `${NAME[PAPER]} Ballon d'Or watch: ${lead.name} ${PAPER === 'express' ? 'is OUR man' : 'leads our list'}`, `${VIEW[PAPER]} ${top.map((x, i) => `${i + 1}. ${x.name} (${x.clubName}) — ${x.g} goals, ${x.a} assists`).join(' · ')}.${mine >= 0 ? ` ${me.sn} is on our list.` : ''} Other papers see it differently, and the 100 journalists vote in late October.`, { imp: mine >= 0 ? 2 : 1, pids: top.map((x) => x.pid), me: mine >= 0, paper: PAPER });
    }
  }
}
