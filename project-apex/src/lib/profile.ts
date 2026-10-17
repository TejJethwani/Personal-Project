/**
 * The player's profile across careers, kept in this browser: achievements
 * unlocked in any career and the daily-challenge record (results, streak).
 * Storage can be unavailable (private windows, blocked site data), so every
 * access is guarded and the game works without it.
 */

export interface DailyRecord {
  bestFinish: number | null;
  stars: number;
  goal: number;
  attempts: number;
  title: string;
}

export interface Profile {
  achievements: Record<string, string>;
  daily: {
    results: Record<string, DailyRecord>;
    lastCompleted: string | null;
    streak: number;
    bestStreak: number;
  };
}

const KEY = 'project-apex-profile';

const empty = (): Profile => ({ achievements: {}, daily: { results: {}, lastCompleted: null, streak: 0, bestStreak: 0 } });

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<Profile>;
    return { achievements: p.achievements ?? {}, daily: { ...empty().daily, ...(p.daily ?? {}) } };
  } catch {
    return empty();
  }
}

function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: the profile simply is not kept.
  }
}

export function recordAchievements(ids: string[]): void {
  if (!ids.length) return;
  const p = loadProfile();
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) p.achievements[id] ??= today;
  saveProfile(p);
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Record a finished daily challenge attempt; keeps the best result and the day streak. */
export function recordDaily(key: string, result: Omit<DailyRecord, 'attempts'>): Profile {
  const p = loadProfile();
  const prev = p.daily.results[key];
  const better = !prev || result.stars > prev.stars || (result.stars === prev.stars && (result.bestFinish ?? 99) < (prev.bestFinish ?? 99));
  p.daily.results[key] = { ...(better ? result : prev), attempts: (prev?.attempts ?? 0) + 1 };
  if (p.daily.lastCompleted !== key) {
    p.daily.streak = p.daily.lastCompleted === previousDay(key) ? p.daily.streak + 1 : 1;
    p.daily.lastCompleted = key;
    p.daily.bestStreak = Math.max(p.daily.bestStreak, p.daily.streak);
  }
  saveProfile(p);
  return p;
}

/** Current streak: still alive if the last completed challenge was today or yesterday. */
export function liveStreak(p: Profile, today: string): number {
  const last = p.daily.lastCompleted;
  return last === today || (last !== null && last === previousDay(today)) ? p.daily.streak : 0;
}

/** Daily-challenge trophies, kept in the profile. */
export const DAILY_TROPHIES = [
  { id: 'dailyFirst', title: 'Daily Driver', description: 'Complete a daily challenge.', tier: 'bronze' as const, check: (p: Profile) => Object.keys(p.daily.results).length >= 1 },
  { id: 'dailyPerfect', title: 'Three Stars', description: 'Earn three stars in a daily challenge.', tier: 'silver' as const, check: (p: Profile) => Object.values(p.daily.results).some((r) => r.stars >= 3) },
  { id: 'dailyStreak3', title: 'Habit Forming', description: 'Complete daily challenges three days in a row.', tier: 'silver' as const, check: (p: Profile) => p.daily.bestStreak >= 3 },
  { id: 'dailyStreak7', title: 'Every Single Day', description: 'Complete daily challenges seven days in a row.', tier: 'gold' as const, check: (p: Profile) => p.daily.bestStreak >= 7 },
];
