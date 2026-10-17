import type { RaceResult } from '../types';

/**
 * Recent form for league tables: one marker per race, graded by the best
 * finish (a team's best car) the way football tables show W/D/L.
 */
export type FormGrade = 'win' | 'podium' | 'strong' | 'points' | 'none';

export interface FormEntry {
  eventId: string;
  round: number;
  circuitId: string;
  finishes: { driverId: string; position: number | null }[];
  points: number;
  grade: FormGrade;
}

/** Finishing position up to which a points finish counts as strong. */
export function strongFinishCut(scoringPlaces: number): number {
  return Math.max(6, Math.round(scoringPlaces * 0.4));
}

export function gradeFor(bestFinish: number | null, points: number, scoringPlaces: number): FormGrade {
  if (bestFinish === 1) return 'win';
  if (bestFinish !== null && bestFinish <= 3) return 'podium';
  if (points > 0 && bestFinish !== null && bestFinish <= strongFinishCut(scoringPlaces)) return 'strong';
  if (points > 0) return 'points';
  return 'none';
}

/** The last `n` races of a team (or driver), most recent last. */
export function recentForm(results: RaceResult[], id: string, kind: 'team' | 'driver', scoringPlaces: number, n = 5): FormEntry[] {
  const out: FormEntry[] = [];
  for (const r of results) {
    const mine = r.entries.filter((e) => (kind === 'team' ? e.teamId === id : e.driverId === id));
    if (!mine.length) continue;
    const finishes = mine.map((e) => ({ driverId: e.driverId, position: e.status === 'finished' ? e.position : null }));
    const placed = finishes.map((f) => f.position).filter((p): p is number => p !== null);
    const best = placed.length ? Math.min(...placed) : null;
    const points = mine.reduce((s, e) => s + e.points, 0);
    out.push({ eventId: r.eventId, round: r.round, circuitId: r.circuitId, finishes, points, grade: gradeFor(best, points, scoringPlaces) });
  }
  return out.slice(-n);
}
