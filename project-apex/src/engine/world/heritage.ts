import { Rng } from '../rng';
import type { Team, TeamHeritage } from '../types';
import { clamp } from '../util';

/**
 * A team's story before the career begins. Pedigree follows today's strength
 * only loosely, so some famous names have fallen on hard times (giants to
 * rebuild) and some strong teams are newcomers. Drawn from its own random
 * stream so it never changes the rest of the world.
 */
export function generateHeritage(seed: number, team: Pick<Team, 'id'>, startYear: number, strength: number, levels: { current: string; above: string | null }, cups: boolean): TeamHeritage {
  const rng = Rng.from(seed, 'heritage', team.id);
  const age = rng.int(2, 75);
  const pedigree = clamp(strength * 0.5 + rng.normal(0, 0.65), -1.6, 1.6);
  // Proud old names may have won their titles a level higher than they race today.
  const fallen = !!levels.above && pedigree - strength > 0.7 && age > 25;
  const titlesIn = fallen ? levels.above! : levels.current;
  const titles = pedigree > 0.25 ? Math.min(25, Math.round((pedigree - 0.15) * (age / 9) * rng.range(0.6, 1.4))) : 0;
  const bestFinish = titles > 0 ? 1 : Math.max(2, Math.round(2 + (1 - pedigree) * rng.range(1.5, 4.5)));
  return {
    founded: startYear - age,
    titles,
    titlesIn,
    cups: cups ? Math.max(0, Math.round(Math.max(0, pedigree + 0.3) * (age / 14) * rng.range(0.4, 1.6))) : 0,
    bestFinish,
    bestIn: titles > 0 ? titlesIn : levels.current,
  };
}

/** "Founded 1961 · 3× Formula 2 champions · 2 cups" */
export function heritageSummary(h: TeamHeritage | undefined, foundedYear?: number): string {
  if (!h) return foundedYear ? `Founded ${foundedYear} · a new team` : 'A new team';
  const parts = [`Founded ${h.founded}`];
  parts.push(h.titles > 0 ? `${h.titles}× ${h.titlesIn} champions` : `best finish P${h.bestFinish} in ${h.bestIn}`);
  if (h.cups > 0) parts.push(`${h.cups} cup${h.cups === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
