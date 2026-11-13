/** Shared "continue" flow: advance the world in small async chunks so the UI stays responsive. */
import { advance, nextStop } from '../engine/sim';
import { act, getGame, moment, nav, setBusy, toast, autosave } from '../store/game';

let running = false;
export async function continueGame(maxDays = 7): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  const s0 = nextStop(g);
  if (s0.kind === 'match' || s0.kind === 'live') return nav('match');
  if (s0.kind === 'summary') return nav('nelsummary');
  if (s0.kind === 'club') return nav('transfers');
  if (s0.kind === 'retired') return nav('history');
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
  if (stop === 'match') nav('match');
  else if (stop === 'summary') nav('nelsummary');
  else if (stop === 'club') { toast('You must choose a club to continue.'); nav('transfers'); }
  else if (getGame() && location.hash.replace('#/', '').split('/')[0] !== 'hub') nav('hub');
}
