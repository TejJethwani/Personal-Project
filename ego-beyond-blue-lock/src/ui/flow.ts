/** Shared "continue" flow: advance the world in small async chunks so the UI stays responsive. */
import { advance, nextStop, simUserMatch } from '../engine/sim';
import { act, getGame, moment, nav, setBusy, toast, autosave } from '../store/game';

let running = false;
export function ceremonyDue(g: { career: { flags: Record<string, number | string> } }): boolean {
  const f = g.career.flags;
  return (f.ceremony != null && f.ceremony !== f.ceremonySeen) || (f.gala != null && f.gala !== f.galaSeen);
}
export function galaDue(g: { career: { flags: Record<string, number | string> } }): boolean { const f = g.career.flags; return f.gala != null && f.gala !== f.galaSeen; }
/**
 * Simulate several weeks in one go. The user's matches are quick-simulated with the same engine.
 * Stops early for anything that needs a decision: choosing a club, the NEL summary, the awards ceremony, retirement.
 */
/** Simulate up to (and including) a calendar day of the current season. Same stops as simWeeks. */
export async function simToDay(day: number): Promise<void> {
  const g = getGame();
  if (!g) return;
  const n = day - g.world.day;
  if (n <= 0) return;
  return simWeeks(n / 7, 'calendar');
}
export async function simWeeks(weeks: number, back = 'hub'): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  if (g.live) { toast('Finish the match in progress first.', true); return nav(g.mgr ? 'mmatch' : 'match'); }
  running = true;
  const target = g.world.abs + Math.round(weeks * 7);
  let played = 0, wins = 0, goals = 0, why = '';
  try {
    for (let guard = 0; guard < Math.ceil(weeks) * 30 + 20; guard++) {
      const x = getGame()!;
      if (x.world.abs >= target) break;
      const st = nextStop(x);
      if (st.kind === 'club') { why = x.mgr ? 'You need a new job to continue.' : 'You must choose a club to continue.'; break; }
      if (st.kind === 'summary' || st.kind === 'retired' || st.kind === 'live') { why = st.label; break; }
      if (ceremonyDue(x)) { why = galaDue(x) ? "The Ballon d'Or gala is tonight." : 'The awards ceremony is waiting.'; break; }
      if (!x.mgr) { const me2 = x.world.players[x.career.pid]; const ending = me2.con && me2.con.until === x.world.season && x.career.offers.some((o) => o.status === 'open' && o.club === me2.club); if (ending && !x.career.flags['renewSeen:' + x.world.season]) { act((y) => { y.career.flags['renewSeen:' + y.world.season] = 1; }, false); why = 'Your contract ends this season and your club has offered a new one — see Transfers.'; break; } }
      setBusy(`Simulating — ${target - x.world.abs} day${target - x.world.abs === 1 ? '' : 's'} to go`);
      await new Promise((r) => setTimeout(r, 8));
      if (st.kind === 'match') {
        const n0 = x.mgr ? x.mgr.matches.length : x.career.matches.length;
        act((y) => simUserMatch(y), false);
        const gg = getGame()!;
        const m = gg.mgr ? gg.mgr.matches[n0] : gg.career.matches[n0];
        if (m) { played++; if (m.res === 'W') wins++; }
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
  else if (st.kind === 'club') nav(g2.mgr ? 'mboard' : 'transfers');
  else if (st.kind === 'summary') nav('nelsummary');
  else if (st.kind === 'retired') nav('hof');
  else nav(g2.mgr && back === 'hub' ? 'mhub' : back);
}
export async function continueGame(maxDays = 7): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  const s0 = nextStop(g);
  if (s0.kind === 'match' || s0.kind === 'live') return nav(g.mgr ? 'mmatch' : 'match');
  if (s0.kind === 'summary') return nav('nelsummary');
  if (s0.kind === 'club') return nav(g.mgr ? 'mboard' : 'transfers');
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
  if (stop === 'match') nav(g2.mgr ? 'mmatch' : 'match');
  else if (stop === 'summary') nav('nelsummary');
  else if (stop === 'club') { toast(g2.mgr ? 'You need a new job to continue.' : 'You must choose a club to continue.'); nav(g2.mgr ? 'mboard' : 'transfers'); }
  else if (getGame()) nav(g2.mgr ? 'mhub' : 'hub');
}

// ───────────────────────────── several years at once ─────────────────────────────
import { longSimStart, longSimChunk, longSimReport, type LongSimOpts, type LongSimReport } from '../engine/longsim';
let cancelReq = false;
export let longReport: LongSimReport | null = null;
export const longSimRunning = () => running && longActive;
let longActive = false;
export function cancelLongSim(): void { cancelReq = true; }
export function clearLongReport(): void { longReport = null; refreshUi(); }
let refreshUi: () => void = () => {};
export function setLongSimRefresh(f: () => void): void { refreshUi = f; }
export async function simYears(opts: LongSimOpts): Promise<void> {
  const g = getGame();
  if (!g || running) return;
  if (g.live) { toast('Finish the match in progress first.', true); return nav(g.mgr ? 'mmatch' : 'match'); }
  running = true; longActive = true; cancelReq = false;
  const st = longSimStart(g, opts);
  const t0 = Date.now();
  let season = g.world.season;
  try {
    for (let guard = 0; guard < 400000; guard++) {
      if (cancelReq) { st.stopped = 'You stopped the simulation.'; break; }
      const more = act((x) => longSimChunk(x, st), false);
      if (!more) break;
      const x = getGame()!;
      if (x.world.season !== season) { season = x.world.season; autosave(true); }
      if (guard % 3 === 0) {
        const done = Math.min(1, (x.world.abs - st.startAbs) / Math.max(1, st.target - 200 - st.startAbs));
        const el = (Date.now() - t0) / 1000, left = done > 0.02 ? Math.round((el / done) * (1 - done)) : 0;
        setBusy(`Simulating ${st.opts.years} year${st.opts.years === 1 ? '' : 's'} — ${Math.round(done * 100)}% · now ${fmtLong(x)}${left ? ` · about ${left >= 90 ? Math.round(left / 60) + ' min' : left + ' s'} left` : ''}`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } catch (e) {
    console.error(e);
    st.stopped = 'Something went wrong: ' + (e as Error).message;
  }
  running = false; longActive = false;
  setBusy('');
  autosave(true);
  const g2 = getGame()!;
  longReport = longSimReport(g2, st);
  const ns = nextStop(g2);
  if (ceremonyDue(g2)) nav('ceremony');
  else if (ns.kind === 'club') nav(g2.mgr ? 'mboard' : 'transfers');
  else if (ns.kind === 'retired') nav('hof');
  else nav(g2.mgr ? 'mhub' : 'hub');
  refreshUi();
}
function fmtLong(g: { world: { phase: 'nel' | 'pro'; season: number; day: number } }): string { return g.world.phase === 'nel' ? 'Neo Egoist League' : `${seasonLabelLong(g.world.season)}`; }
import { seasonLabel as seasonLabelLong } from '../engine/competitions';
