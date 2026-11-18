import { describe, it, expect } from 'vitest';
import { defaultConfig, newGame } from '../src/engine/career';
import { newManagerGame } from '../src/engine/managerStart';
import { longSimRun, DEFAULT_LONGSIM } from '../src/engine/longsim';
import { validate } from '../src/engine/save';

describe('multi-year simulation', () => {
  it('a player career runs three seasons unattended (clubs, renewals and ceremonies handled)', () => {
    const cfg = defaultConfig(61); cfg.skipNel = true;
    const g = newGame(cfg);
    const s0 = g.world.season, t0 = Date.now();
    const r = longSimRun(g, { ...DEFAULT_LONGSIM, years: 3, bdo: false });
    console.log('PLAYER', r.from, '→', r.to, 'stopped:', r.stopped || '(target reached)', `${((Date.now() - t0) / 1000).toFixed(1)}s`, r.lines.slice(0, 6));
    expect(r.stopped).toBe('');
    expect(g.world.season).toBeGreaterThanOrEqual(s0 + 3);
    expect(validate(g)).toEqual([]);
  }, 900000);
  it('stops at the end of a season when asked', () => {
    const cfg = defaultConfig(62); cfg.skipNel = true;
    const g = newGame(cfg);
    const r = longSimRun(g, { ...DEFAULT_LONGSIM, years: 5, seasonEnd: true });
    expect(r.stopped).toMatch(/season is about to start/);
    expect(r.days).toBeLessThan(520); // a career that starts in the NEL reaches its first new season after the NEL and one full season
  }, 900000);
  it('a manager career runs two seasons unattended', () => {
    const g = newManagerGame({ name: 'L', nat: 'ENG', club: 'eng1_che', seed: 63 });
    const s0 = g.world.season, t0 = Date.now();
    const r = longSimRun(g, { ...DEFAULT_LONGSIM, years: 2, board: false });
    console.log('MANAGER', r.from, '→', r.to, 'stopped:', r.stopped || '(target reached)', `${((Date.now() - t0) / 1000).toFixed(1)}s`, r.lines);
    expect(g.world.season).toBeGreaterThanOrEqual(s0 + 2);
    expect(g.mgr!.hist.length).toBeGreaterThanOrEqual(2);
    expect(validate(g)).toEqual([]);
  }, 900000);
});
