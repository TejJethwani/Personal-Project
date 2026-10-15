import { describe, expect, it } from 'vitest';
import { DIVISIONS } from '../config/divisions';
import { divisionStandings } from '../championship/standings';
import { computeRecords, hallOfFame } from '../history/records';
import { deserializeGame, serializeGame } from '../save/serialization';
import { playerTeam } from '../selectors';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame, playOffseason, playSeason } from './helpers';

const SEASONS = Number(process.env.APEX_SEASONS ?? 5);

describe(`long-run simulation (${SEASONS} seasons)`, () => {
  it('keeps the world valid, the economy sane and history complete', () => {
    const s = makeGame(2027);
    const winnersByStrength: number[] = [];
    let backmarkerPodiums = 0;
    let races = 0;
    for (let i = 0; i < SEASONS; i++) {
      playSeason(s, { validate: true });
      expect(s.phase).toBe('seasonReview');
      // Results are believable: winners usually come from the stronger half of the field.
      for (const d of DIVISION_ORDER) {
        const st = divisionStandings(s, d);
        const order = st.constructors.map((r) => r.id);
        for (const ev of s.calendars[d]) {
          const r = s.results[ev.id];
          races++;
          winnersByStrength.push(order.indexOf(r.entries[0].teamId));
          for (const e of r.entries.slice(0, 3)) if (order.indexOf(e.teamId) >= 9) backmarkerPodiums++;
        }
      }
      playOffseason(s, true, { validate: true });
      expect(validateState(s)).toEqual([]);
      for (const t of Object.values(s.teams)) {
        expect(Number.isFinite(t.cash)).toBe(true);
        expect(t.raceDrivers.every((x) => x !== null) || t.isPlayer).toBe(true);
        // AI teams never spiral into absurd debt or absurd wealth.
        if (!t.isPlayer) {
          expect(t.cash).toBeGreaterThan(-DIVISIONS[t.division].typicalBudget * 0.6);
          expect(t.cash).toBeLessThan(DIVISIONS[t.division].typicalBudget * 25);
        }
      }
      const active = Object.values(s.drivers).filter((d) => !d.retired).length;
      expect(active).toBeGreaterThanOrEqual(250);
      expect(active).toBeLessThan(420);
    }
    expect(s.history).toHaveLength(SEASONS);
    expect(s.history[0].season).toBe(1);
    for (const h of s.history) for (const d of DIVISION_ORDER) expect(h.divisions[d].results).toHaveLength(DIVISIONS[d].races);
    const topHalfWins = winnersByStrength.filter((p) => p < 5).length / winnersByStrength.length;
    expect(topHalfWins).toBeGreaterThan(0.7);
    expect(backmarkerPodiums / races).toBeLessThan(0.05);
    expect(computeRecords(s, 'F1')[1].entries.length).toBeGreaterThan(0);
    expect(hallOfFame(s)).toBeInstanceOf(Array);
    // The whole career still saves and loads.
    const loaded = deserializeGame(serializeGame(s));
    expect(loaded.season).toBe(s.season);
    expect(playerTeam(loaded).name).toBe(playerTeam(s).name);
  });
});
