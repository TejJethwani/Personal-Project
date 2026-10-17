import { describe, expect, it } from 'vitest';
import { checkAchievements } from '../achievements';
import { CHALLENGES, previewTakeoverWorld, takeoverCandidates, type ChallengeId } from '../career/takeover';
import { activeDivisions } from '../config/ruleset';
import { MAX_CASH_BOOST, SANDBOX_FLOOR, setSandboxMoney } from '../finance/boost';
import { postTransaction } from '../finance/ledger';
import { createNewGame } from '../game';
import { deserializeGame, saveMeta, serializeGame } from '../save/serialization';
import { advanceWeek } from '../season/advance';
import { playerTeam, teamsInDivision } from '../selectors';
import type { GameState, NewCareerConfig } from '../types';
import { DIVISION_ORDER } from '../types';
import { validateState } from '../validation';
import { makeGame, playSeason } from './helpers';

const base: NewCareerConfig = {
  teamName: 'Unused',
  shortName: 'UNU',
  nationality: 'GBR',
  primaryColor: '#e10600',
  secondaryColor: '#ffffff',
  livery: 'arrow',
  principalName: 'New Boss',
  philosophy: 'balanced',
  difficulty: 'standard',
  financialStart: 'modest',
};

/** Everything a takeover must inherit, read from a world state. */
function snapshot(state: GameState, teamId: string) {
  const t = state.teams[teamId];
  return {
    name: t.name,
    division: t.division,
    cash: t.cash,
    reputation: t.reputation,
    car: t.car,
    facilities: t.facilities,
    staff: t.staff,
    raceDrivers: t.raceDrivers,
    reserve: t.reserveDriverId,
    academy: t.academyDriverIds,
    heritage: t.heritage,
    clubId: t.clubId,
    contracts: [...t.raceDrivers, t.reserveDriverId, ...t.academyDriverIds].filter(Boolean).map((id) => state.drivers[id!].contract),
  };
}

describe('Taking over an existing team', () => {
  it('Classic: every seat is an established team and the chosen one is inherited whole', () => {
    const config = { ...base, seed: 7001 };
    const preview = previewTakeoverWorld(config);
    for (const d of DIVISION_ORDER) expect(teamsInDivision(preview, d)).toHaveLength(10);
    expect(Object.values(preview.teams).some((t) => t.isPlayer)).toBe(false);
    const candidates = takeoverCandidates(preview);
    expect(candidates).toHaveLength(50);
    const pick = candidates.find((c) => c.division === 'F3')!;
    const before = snapshot(preview, pick.teamId);

    const s = createNewGame({ ...config, takeover: { teamId: pick.teamId } });
    const team = playerTeam(s);
    expect(team.id).toBe(pick.teamId);
    expect(snapshot(s, team.id)).toEqual(before);
    expect(team.isPlayer).toBe(true);
    expect(team.aiPersonality).toBeNull();
    expect(team.principal).toBe('New Boss');
    expect(Object.values(s.teams).filter((t) => t.isPlayer)).toHaveLength(1);
    // The AI's sponsor portfolio becomes running deals; board objectives fit the team.
    expect(team.sponsors).toHaveLength(6);
    expect(team.sponsors.every((d) => d.startSeason === 1 && d.endSeason >= 1)).toBe(true);
    expect(team.objectives.length).toBeGreaterThan(0);
    expect(s.player.managerHistory).toEqual([{ teamId: team.id, teamName: team.name, fromSeason: 1, toSeason: null, how: 'takeover' }]);
    expect(validateState(s)).toEqual([]);
    // The career runs a full season in that division.
    playSeason(s);
    expect(s.phase).toBe('seasonReview');
    expect(validateState(s)).toEqual([]);
  }, 60000);

  it('European League: takes over a club in its current league, club records intact', () => {
    const config = { ...base, seed: 7002, european: { assocId: 'ESP' } };
    const preview = previewTakeoverWorld(config);
    const candidates = takeoverCandidates(preview);
    expect(new Set(candidates.map((c) => c.division))).toEqual(new Set(activeDivisions(preview)));
    const pick = candidates.find((c) => c.level === 1)!;
    const club = preview.teams[pick.teamId].clubId!;
    const before = { snap: snapshot(preview, pick.teamId), club: preview.europe!.clubs[club] };

    const s = createNewGame({ ...config, takeover: { teamId: pick.teamId } });
    expect(snapshot(s, pick.teamId)).toEqual(before.snap);
    expect(s.europe!.clubs[club]).toEqual(before.club);
    expect(s.europe!.clubs[club].teamId).toBe(pick.teamId);
    expect(playerTeam(s).division).toBe(pick.division);
    expect(validateState(s)).toEqual([]);
    // Saves and reloads like any career.
    expect(deserializeGame(serializeGame(s)).player.teamId).toBe(pick.teamId);
  });

  it('is deterministic for a seed and needs a team to start', () => {
    const config = { ...base, seed: 7003 };
    const a = takeoverCandidates(previewTakeoverWorld(config));
    const b = takeoverCandidates(previewTakeoverWorld(config));
    expect(b).toEqual(a);
    expect(() => createNewGame({ ...config, takeover: { teamId: '' } })).toThrow();
  });

  it('challenge categories come from the generated teams', () => {
    const preview = previewTakeoverWorld({ ...base, seed: 7004 });
    const list = takeoverCandidates(preview);
    const has = (c: ChallengeId) => list.filter((x) => x.challenges.includes(c));
    for (const c of has('roadToGlory')) expect(c.division).toBe('F5');
    for (const c of has('dynasty')) {
      expect(c.division).toBe('F1');
      expect(c.projected).toBeLessThanOrEqual(2);
    }
    for (const c of has('contender')) expect(c.projected).toBeLessThanOrEqual(3);
    for (const c of has('rebuildGiant')) expect(c.heritage!.titles).toBeGreaterThanOrEqual(2);
    expect(has('roadToGlory').length).toBeGreaterThan(0);
    expect(has('dynasty').length).toBeGreaterThan(0);
    expect(Object.keys(CHALLENGES)).toHaveLength(5);
    // Every generated team has a history; a founded team does not.
    expect(list.every((c) => !!c.heritage && c.heritage.founded <= 2027)).toBe(true);
    expect(playerTeam(makeGame(7004)).heritage).toBeUndefined();
  });
});

describe('Starting cash boost', () => {
  it('adds the boost once, on top of the normal starting budget', () => {
    const plain = makeGame(7100);
    const boosted = makeGame(7100, { cashBoost: 100_000_000 });
    expect(playerTeam(boosted).cash).toBe(playerTeam(plain).cash + 100_000_000);
    expect(boosted.player.startingBoost).toBe(100_000_000);
    const entries = playerTeam(boosted).ledger.filter((t) => t.label === 'Starting cash boost');
    expect(entries).toHaveLength(1);
    // Loading never re-applies it, and neither does the season.
    const loaded = deserializeGame(serializeGame(boosted));
    expect(playerTeam(loaded).cash).toBe(playerTeam(boosted).cash);
    playSeason(loaded);
    expect(playerTeam(loaded).ledger.filter((t) => t.label === 'Starting cash boost')).toHaveLength(1);
  }, 60000);

  it('works on a takeover and rejects impossible amounts', () => {
    const config = { ...base, seed: 7101 };
    const pick = takeoverCandidates(previewTakeoverWorld(config))[0];
    const inherited = previewTakeoverWorld(config).teams[pick.teamId].cash;
    const s = createNewGame({ ...config, takeover: { teamId: pick.teamId }, cashBoost: 25_000_000 });
    expect(playerTeam(s).cash).toBe(inherited + 25_000_000);
    expect(() => makeGame(7102, { cashBoost: -1 })).toThrow();
    expect(() => makeGame(7102, { cashBoost: MAX_CASH_BOOST + 1 })).toThrow();
  });
});

describe('Sandbox money', () => {
  it('keeps the bank topped up, marks the career and switches achievements off', () => {
    const s = makeGame(7200, { sandboxMoney: true });
    const team = playerTeam(s);
    expect(team.cash).toBeGreaterThanOrEqual(SANDBOX_FLOOR);
    postTransaction(s, team, 'facilities', -(team.cash + 5_000_000), 'Huge spend');
    expect(team.cash).toBeLessThan(0);
    advanceWeek(s);
    expect(team.cash).toBeGreaterThanOrEqual(SANDBOX_FLOOR - 10_000_000);
    expect(checkAchievements(s)).toEqual([]);
    setSandboxMoney(s, false);
    expect(s.settings.sandboxUsed).toBe(true);
    expect(saveMeta(s).sandbox).toBe(true);
    expect(saveMeta(makeGame(7201)).sandbox).toBeUndefined();
  });
});
