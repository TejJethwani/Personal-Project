import { ECONOMY_TUNING } from '../config/tuning';
import { generateSponsorOffer } from '../finance/sponsors';
import { Rng } from '../rng';
import type { GameState, ManagerStint, SponsorDeal, SponsorTier, Team } from '../types';
import { assertRule } from '../util';

/**
 * The player as a manager: which team they run and the teams they have run.
 * Taking charge hands an AI team to the player with everything it has
 * (drivers and contracts, staff, car, facilities, cash, reputation, history);
 * only the AI's decision-making stops. Moving on hands the old team back.
 */
export function assumeControl(state: GameState, teamId: string, principal: string, how: ManagerStint['how']): Team {
  const team = state.teams[teamId];
  assertRule(team && !team.guest, 'That team does not exist.');
  const previous = state.player.teamId && state.player.teamId !== teamId ? state.teams[state.player.teamId] : null;
  if (previous) releaseTeam(previous);

  team.isPlayer = true;
  team.aiPersonality = null;
  team.principal = principal.trim() || 'Team Principal';
  state.player.teamId = team.id;
  state.player.principalName = team.principal;
  // The commercial portfolio the AI ran as an abstraction becomes real, running sponsor deals.
  if (!team.sponsors.length) inheritSponsors(state, team);
  for (const id of [...team.raceDrivers, team.reserveDriverId, ...team.academyDriverIds]) if (id) state.player.scouting[id] = 100;
  const history = (state.player.managerHistory ?? []).map((s) => (s.toSeason === null ? { ...s, toSeason: state.season } : s));
  history.push({ teamId: team.id, teamName: team.name, fromSeason: state.season, toSeason: null, how });
  state.player.managerHistory = history;
  return team;
}

/** A team the player leaves goes back to AI management, with its sponsors back in the AI's abstract portfolio. */
function releaseTeam(team: Team): void {
  team.isPlayer = false;
  team.aiPersonality = 'conservative';
  team.sponsors = [];
}

/** One running deal per sponsor slot, as the team's existing commercial partners. */
function inheritSponsors(state: GameState, team: Team): void {
  const rng = Rng.from(state.seed, 'inheritSponsors', team.id, state.season);
  const slots = ECONOMY_TUNING.sponsorSlots;
  for (const tier of ['title', 'major', 'minor'] as SponsorTier[]) {
    for (let i = 0; i < slots[tier]; i++) {
      const { expiresAbsWeek: _e, patience: _p, maxValue: _m, ...offer } = generateSponsorOffer(state, team, rng, tier);
      const seasons = rng.int(1, 3);
      const deal: SponsorDeal = { ...offer, seasons, startSeason: state.season, endSeason: state.season + seasons - 1, satisfaction: 60 };
      team.sponsors.push(deal);
    }
  }
}
