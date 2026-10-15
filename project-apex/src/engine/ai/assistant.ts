import { freeSponsorTiers, signSponsor } from '../finance/sponsors';
import { Rng } from '../rng';
import { playerTeam } from '../selectors';
import type { GameState } from '../types';
import { aiFacilities, aiRnD, aiStaff, aiTry } from './manager';
import { eventLineup } from '../race/weekend';
import { aiEnsureSubstitute, aiFillSeats } from './market';

/**
 * The assistant manager runs the player's team with the same routines the AI
 * uses for rival teams. Used for holiday mode and for automated long-run tests.
 */
export function assistantManage(state: GameState, opts: { development: boolean } = { development: true }): void {
  const team = playerTeam(state);
  const rng = Rng.from(state.seed, 'assistant', state.season, state.week);
  if (team.raceDrivers.includes(null)) aiTry(() => aiFillSeats(state, team, 4, state.phase === 'preseason' || state.phase === 'season'));
  if (eventLineup(state, team).some((s) => !s.driverId)) aiTry(() => aiEnsureSubstitute(state, team));
  // Sign the most valuable sponsor offers for free slots.
  const season = state.phase === 'offseason' ? state.season : state.season;
  for (const tier of freeSponsorTiers(team, season)) {
    const offers = state.player.sponsorOffers.filter((o) => o.tier === tier).sort((a, b) => b.perRace - a.perRace);
    if (offers[0]) {
      try {
        signSponsor(state, offers[0].id);
      } catch {
        // slot filled meanwhile
      }
    }
  }
  if (opts.development && (state.phase === 'season' || state.phase === 'weekend')) {
    const saved = team.aiPersonality;
    team.aiPersonality = 'engineering';
    aiTry(() => aiRnD(state, team, rng));
    aiTry(() => aiFacilities(state, team, rng));
    team.aiPersonality = saved;
  }
  if (state.week % 3 === 0 && team.cash > 0) aiTry(() => aiStaff(state, team, rng));
}
