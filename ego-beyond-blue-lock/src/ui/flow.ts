/** Shared "continue" flow: advance the world in small async chunks so the UI stays responsive. */
import { advance, nextStop, simUserMatch } from '../engine/sim';
import { act, getGame, moment, nav, setBusy, toast, autosave } from '../store/game';

let running = false;
export function ceremonyDue(g: { career: { flags: Record<string, number | string> } }): boolean {
  const f = g.career.flags;
  return f.ceremony != null && f.ceremony !== f.ceremonySeen;
}
/**
 * Simulate several weeks in one go. The user's matches are quick-simulated with the same engine.
 * Stops early for anything that needs a decision: choosing a club, the NEL summary, the awards ceremony, retirement.
 */
export async function simWeeks(weeks: number): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  if (g.live) { toast('Finish the match in progress first.', true); return nav('match'); }
  running = true;
  const target = g.world.abs + weeks * 7;
  let played = 0, wins = 0, goals = 0, why = '';
  try {
    for (let guard = 0; guard < weeks * 30 + 20; guard++) {
      const x = getGame()!;
      if (x.world.abs >= target) break;
      const st = nextStop(x);
      if (st.kind === 'club') { why = 'You must choose a club to continue.'; break; }
      if (st.kind === 'summary' || st.kind === 'retired' || st.kind === 'live') { why = st.label; break; }
      if (ceremonyDue(x)) { why = 'The awards ceremony is waiting.'; break; }
      { const me2 = x.world.players[x.career.pid]; const ending = me2.con && me2.con.until === x.world.season && x.career.offers.some((o) => o.status === 'open' && o.club === me2.club); if (ending && !x.career.flags['renewSeen:' + x.world.season]) { act((y) => { y.career.flags['renewSeen:' + y.world.season] = 1; }, false); why = 'Your contract ends this season and your club has offered a new one — see Transfers.'; break; } }
      setBusy(`Simulating — week ${Math.min(weeks, Math.floor((weeks * 7 - (target - x.world.abs)) / 7) + 1)} of ${weeks}`);
      await new Promise((r) => setTimeout(r, 8));
      if (st.kind === 'match') {
        const n0 = x.career.matches.length;
        act((y) => simUserMatch(y), false);
        const m = getGame()!.career.matches[n0];
        if (m) { played++; if (m.res === 'W') wins++; goals += m.line ? m.line[18] * 0 : 0; }
      } else act((y) => advance(y, 1), false);
    }
  } catch (e) {
    console.error(e);
    toast('Something went wrong while simulating: ' + (e as Error).message, true);
  }
  running = false;
  setBusy('');
  autosave(true);
  const g2 = getGame()!;
  act((y) => { delete y.career.flags.awardPop; }, false);
  toast(`Simulated ${played} match${played === 1 ? '' : 'es'}${played ? ` — ${wins} won` : ''}.${why ? ' Stopped: ' + why : ''}`);
  void goals;
  const st = nextStop(g2);
  if (ceremonyDue(g2)) nav('ceremony');
  else if (st.kind === 'club') nav('transfers');
  else if (st.kind === 'summary') nav('nelsummary');
  else if (st.kind === 'retired') nav('hof');
  else nav('hub');
}
export async function continueGame(maxDays = 7): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  const s0 = nextStop(g);
  if (s0.kind === 'match' || s0.kind === 'live') return nav('match');
  if (s0.kind === 'summary') return nav('nelsummary');
  if (s0.kind === 'club') return nav('transfers');
  if (s0.kind === 'retired') return nav('hof');
  if (ceremonyDue(g)) return nav('ceremony');
  running = true;
  setBusy('Simulating');
  const digest: string[] = [];
  let stop: string | null = null;
  try {
    for (let d = 0; d < maxDays; d++) {
      await new Promise((r) => setTimeout(r, 12));
      const rep = act((x) => advance(x, 1), false)!;
      digest.push(...rep.digest);
      if (rep.stop) { stop = rep.stop; break; }
    }
  } catch (e) {
    console.error(e);
    toast('Something went wrong while simulating: ' + (e as Error).message, true);
  }
  running = false;
  setBusy('');
  autosave(true);
  const g2 = getGame()!;
  for (const t of [...new Set(digest)].slice(0, 4)) toast(t);
  if (g2.career.flags.awardPop) { const a = g2.world.awards[String(g2.career.flags.awardPop)]; if (a) moment(a.title, a.compName, 'award'); act((x) => { delete x.career.flags.awardPop; }, false); }
  if (ceremonyDue(g2)) return nav('ceremony');
  if (stop === 'match') nav('match');
  else if (stop === 'summary') nav('nelsummary');
  else if (stop === 'club') { toast('You must choose a club to continue.'); nav('transfers'); }
  else if (getGame()) nav('hub');
}
