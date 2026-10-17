import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../achievements';
import { COMPONENT_KEYS } from '../car/car';
import { assignPoints, championshipPoints } from '../championship/standings';
import { createDailyChallenge, dailyKey, dailyStars } from '../daily';
import { ATTRIBUTE_KEYS } from '../drivers/ratings';
import { autoplayPlayerWeekend } from '../game';
import { simulateEventRace } from '../race/weekend';
import { settleSeasonChallenges } from '../season/challenges';
import { seasonTwists, twistEffects, type SeasonTwistId } from '../season/twists';
import { playerTeam, raceDrivers } from '../selectors';
import type { DivisionId, GameState, RaceResultEntry } from '../types';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame, playOffseason, playSeason } from './helpers';

/** Find a world and series that races under a given twist this season. */
function withTwist(twist: SeasonTwistId, season = 2): { state: GameState; division: DivisionId } {
  for (let seed = 1; seed < 400; seed++) {
    const state = makeGame(seed);
    state.season = season;
    for (const d of DIVISION_ORDER) if (seasonTwists(state, d).includes(twist)) return { state, division: d };
  }
  throw new Error(`no world with ${twist}`);
}

describe('season twists', () => {
  it('are drawn fresh every season and are the same for the same world', () => {
    const a = makeGame(900);
    const b = makeGame(900);
    expect(seasonTwists(a, 'F5', 1)).toHaveLength(1);
    expect(seasonTwists(a, 'F5', 2)).toHaveLength(2);
    expect(seasonTwists(a, 'F5', 3)).toEqual(seasonTwists(b, 'F5', 3));
    const seasons = [2, 3, 4, 5, 6].map((s) => seasonTwists(a, 'F5', s).join());
    expect(new Set(seasons).size).toBeGreaterThan(2);
  });

  it('a double-points finale pays twice the usual points', () => {
    const { state, division } = withTwist('doublePointsFinale', 1);
    const finale = state.calendars[division].find((e) => e.round === twistEffects(state, division).doublePointsRound)!;
    const { result } = simulateEventRace(state, finale);
    const plain: RaceResultEntry[] = result.entries.map((e) => ({ ...e, points: 0 }));
    assignPoints(plain, championshipPoints(state, division), result.poleDriverId, result.fastestLapDriverId);
    result.entries.forEach((e, i) => expect(e.points).toBe(plain[i].points * 2));
  });

  it('the reverse-grid round flips the top ten of qualifying', () => {
    const { state, division } = withTwist('reverseGridRound', 1);
    const round = state.calendars[division].find((e) => e.round === twistEffects(state, division).reverseGridRound)!;
    const { result } = simulateEventRace(state, round);
    const pole = result.qualifying.find((q) => q.position === 1)!;
    const tenth = result.qualifying.find((q) => q.position === 10)!;
    if (!pole.gridPenalty && !tenth.gridPenalty) {
      expect(pole.grid).toBeGreaterThanOrEqual(9);
      expect(tenth.grid).toBeLessThanOrEqual(2);
    }
  });

  it('a development race makes upgrades bigger and cheaper', () => {
    const { state, division } = withTwist('developmentRace');
    const fx = twistEffects(state, division);
    expect(fx.rndGain).toBeGreaterThan(1);
    expect(fx.rndCost).toBeLessThan(1);
  });
});

describe('season challenges', () => {
  it('three challenges, one against a rival, are drawn for every season', () => {
    const s = makeGame(901);
    const list = s.player.challenges!.filter((c) => c.season === s.season);
    expect(list).toHaveLength(3);
    expect(list.some((c) => c.kind === 'beatRival')).toBe(true);
    expect(s.player.rival?.teamId).toBeTruthy();
    expect(s.player.rival?.teamId).not.toBe(playerTeam(s).id);
  });

  it('completing a challenge pays its reward once, and the season settles them all', () => {
    const s = makeGame(902);
    const me = playerTeam(s);
    for (const k of COMPONENT_KEYS) me.car.components[k] = 95;
    for (const d of raceDrivers(s, me)) for (const k of ATTRIBUTE_KEYS) d.attributes[k] = k === 'aggression' ? 65 : 97;
    playSeason(s);
    const list = s.player.challenges!.filter((c) => c.season === s.season);
    expect(list.some((c) => c.completed)).toBe(true);
    expect(list.every((c) => c.completed || c.failed)).toBe(true);
    const rewards = me.ledger.filter((t) => t.label.startsWith('Challenge:'));
    expect(rewards.length).toBe(list.filter((c) => c.completed).length);
    expect(settleSeasonChallenges(s)).toBe(list.filter((c) => c.completed).length);
    expect(s.lastSeasonReview?.challenges?.total).toBe(3);
    playOffseason(s);
    expect(s.player.challenges!.filter((c) => c.season === s.season)).toHaveLength(3);
  });
});

describe('achievements', () => {
  it('unlock as the team makes history, once each', () => {
    const s = makeGame(903);
    const me = playerTeam(s);
    for (const k of COMPONENT_KEYS) me.car.components[k] = 95;
    for (const d of raceDrivers(s, me)) for (const k of ATTRIBUTE_KEYS) d.attributes[k] = k === 'aggression' ? 65 : 97;
    playSeason(s);
    const got = s.player.achievements ?? {};
    for (const id of ['firstPoints', 'firstPodium', 'firstWin', 'champion']) expect(got[id]).toBeTruthy();
    expect(Object.keys(got).every((id) => ACHIEVEMENTS.some((a) => a.id === id))).toBe(true);
    const news = s.news.filter((n) => n.headline.startsWith('ACHIEVEMENT UNLOCKED: WINNER'));
    expect(news).toHaveLength(1);
  });
});

describe('daily challenge', () => {
  it('is the same scenario for everyone on a date and different the next day', () => {
    const a = createDailyChallenge('2026-10-17');
    const b = createDailyChallenge('2026-10-17');
    const c = createDailyChallenge('2026-10-18');
    expect(a.daily).toEqual(b.daily);
    expect(a.daily?.title === c.daily?.title && a.daily?.eventId === c.daily?.eventId).toBe(false);
    expect(dailyKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('starts a valid weekend for the player and records the best finish', () => {
    const s = createDailyChallenge('2026-10-19');
    expect(s.mode).toBe('daily');
    expect(s.phase).toBe('weekend');
    expect(playerTeam(s).division).toBe(s.daily!.division);
    expect(validateState(s)).toEqual([]);
    autoplayPlayerWeekend(s);
    expect(s.weekend?.phase).toBe('complete');
    const mine = s.results[s.daily!.eventId].entries.filter((e) => e.teamId === s.player.teamId && e.status === 'finished');
    expect(s.daily!.bestFinish).toBe(mine.length ? Math.min(...mine.map((e) => e.position)) : null);
    expect(Object.keys(s.player.achievements ?? {})).toHaveLength(0);
  });

  it('scores stars against the goal', () => {
    expect(dailyStars(null, 5)).toBe(0);
    expect(dailyStars(6, 5)).toBe(0);
    expect(dailyStars(5, 5)).toBe(1);
    expect(dailyStars(4, 5)).toBe(2);
    expect(dailyStars(2, 5)).toBe(3);
    expect(dailyStars(1, 1)).toBe(3);
  });
});
