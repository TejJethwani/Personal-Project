import { DIVISIONS } from '../config/divisions';
import type { DivisionId, Driver, GameState } from '../types';
import { allTeams, allDrivers } from '../selectors';

export interface RecordEntry {
  id: string;
  name: string;
  value: number;
  detail: string;
  kind: 'driver' | 'team';
}

export interface RecordTable {
  title: string;
  description: string;
  entries: RecordEntry[];
}

function dName(d: Driver): string {
  return `${d.firstName} ${d.lastName}`;
}

function teamName(state: GameState, id: string | null | undefined): string {
  if (!id) return '—';
  return state.teams[id]?.name ?? '—';
}

/** Per-driver statistics restricted to a division, computed from season history plus the live season. */
export function driverDivisionTotals(state: GameState, division: DivisionId | 'all'): Map<string, { wins: number; poles: number; podiums: number; titles: number; starts: number; points: number }> {
  const totals = new Map<string, { wins: number; poles: number; podiums: number; titles: number; starts: number; points: number }>();
  const add = (id: string, k: 'wins' | 'poles' | 'podiums' | 'titles' | 'starts' | 'points', v: number) => {
    const t = totals.get(id) ?? { wins: 0, poles: 0, podiums: 0, titles: 0, starts: 0, points: 0 };
    t[k] += v;
    totals.set(id, t);
  };
  const results = [...state.history.flatMap((h) => Object.values(h.divisions).flatMap((dh) => dh.results)), ...Object.values(state.results)].filter((r) => !r.competition);
  for (const r of results) {
    if (division !== 'all' && r.division !== division) continue;
    for (const e of r.entries) {
      add(e.driverId, 'starts', 1);
      add(e.driverId, 'points', e.points);
      if (e.status === 'finished' && e.position === 1) add(e.driverId, 'wins', 1);
      if (e.status === 'finished' && e.position <= 3) add(e.driverId, 'podiums', 1);
    }
    if (r.poleDriverId) add(r.poleDriverId, 'poles', 1);
  }
  for (const h of state.history) {
    for (const dh of Object.values(h.divisions)) {
      if (division !== 'all' && dh.division !== division) continue;
      if (dh.championDriverId) add(dh.championDriverId, 'titles', 1);
    }
  }
  return totals;
}

function topDrivers(state: GameState, totals: ReturnType<typeof driverDivisionTotals>, key: 'wins' | 'poles' | 'podiums' | 'titles', n = 10): RecordEntry[] {
  return [...totals.entries()]
    .filter(([, t]) => t[key] > 0)
    .sort((a, b) => b[1][key] - a[1][key])
    .slice(0, n)
    .map(([id, t]) => {
      const d = state.drivers[id];
      return { id, name: d ? dName(d) : 'Unknown', value: t[key], detail: `${t.starts} starts${d?.retired ? ' · retired' : ''}`, kind: 'driver' as const };
    });
}

export function computeRecords(state: GameState, division: DivisionId | 'all' = 'F1'): RecordTable[] {
  const totals = driverDivisionTotals(state, division);
  const label = division === 'all' ? 'all divisions' : DIVISIONS[division].name;
  const tables: RecordTable[] = [
    { title: division === 'F1' ? 'Most World Championships' : 'Most Championships', description: `Drivers' titles in ${label}`, entries: topDrivers(state, totals, 'titles') },
    { title: 'Most Race Wins', description: `Victories in ${label}`, entries: topDrivers(state, totals, 'wins') },
    { title: 'Most Pole Positions', description: `Poles in ${label}`, entries: topDrivers(state, totals, 'poles') },
    { title: 'Most Podiums', description: `Top-three finishes in ${label}`, entries: topDrivers(state, totals, 'podiums') },
  ];

  // Constructors' titles.
  const teamTitles = new Map<string, number>();
  for (const h of state.history) {
    for (const dh of Object.values(h.divisions)) {
      if (division !== 'all' && dh.division !== division) continue;
      if (dh.championTeamId) teamTitles.set(dh.championTeamId, (teamTitles.get(dh.championTeamId) ?? 0) + 1);
    }
  }
  tables.push({
    title: 'Most Constructors\' Championships',
    description: `Teams' titles in ${label}`,
    entries: [...teamTitles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, v]) => ({ id, name: teamName(state, id), value: v, detail: state.teams[id] ? DIVISIONS[state.teams[id].division].name : '', kind: 'team' })),
  });

  // Consecutive drivers' titles.
  const streaks: RecordEntry[] = [];
  const champs = state.history.map((h) => (division === 'all' ? null : h.divisions[division]?.championDriverId ?? null));
  if (division !== 'all') {
    let current: string | null = null;
    let run = 0;
    let start = 0;
    champs.forEach((c, i) => {
      if (c && c === current) run++;
      else {
        if (current && run > 0) streaks.push({ id: current, name: state.drivers[current] ? dName(state.drivers[current]) : 'Unknown', value: run, detail: `Seasons ${state.history[start].season}–${state.history[start + run - 1].season}`, kind: 'driver' });
        current = c;
        run = c ? 1 : 0;
        start = i;
      }
    });
    if (current && run > 0) streaks.push({ id: current, name: state.drivers[current] ? dName(state.drivers[current]) : 'Unknown', value: run, detail: `Seasons ${state.history[start].season}–${state.history[start + run - 1].season}`, kind: 'driver' });
  }
  tables.push({ title: 'Most Consecutive Titles', description: `Back-to-back drivers' championships in ${label}`, entries: streaks.sort((a, b) => b.value - a.value).slice(0, 10) });

  // Youngest champion.
  const youngest: RecordEntry[] = [];
  for (const h of state.history) {
    for (const dh of Object.values(h.divisions)) {
      if (division !== 'all' && dh.division !== division) continue;
      if (!dh.championDriverId) continue;
      const d = state.drivers[dh.championDriverId];
      if (!d) continue;
      const ageThen = d.age - (state.season - h.season);
      youngest.push({ id: d.id, name: dName(d), value: ageThen, detail: `${DIVISIONS[dh.division].name} champion, season ${h.season}`, kind: 'driver' });
    }
  }
  tables.push({ title: 'Youngest Champion', description: 'Age when the title was won', entries: youngest.sort((a, b) => a.value - b.value).slice(0, 10) });

  // Greatest comeback season: biggest year-on-year rise in the constructors' table within the same division.
  const comebacks: RecordEntry[] = [];
  for (const team of allTeams(state)) {
    const hist = team.history;
    for (let i = 1; i < hist.length; i++) {
      const a = hist[i - 1];
      const b = hist[i];
      if (a.division !== b.division) continue;
      if (division !== 'all' && b.division !== division) continue;
      const rise = a.position - b.position;
      if (rise > 0) comebacks.push({ id: team.id, name: team.name, value: rise, detail: `P${a.position} → P${b.position} in ${DIVISIONS[b.division].name}, season ${b.season}`, kind: 'team' });
    }
  }
  tables.push({ title: 'Greatest Comeback Season', description: 'Biggest rise in the teams\' standings in one season', entries: comebacks.sort((a, b) => b.value - a.value).slice(0, 10) });
  return tables;
}

export interface HallOfFamer {
  driverId: string;
  name: string;
  nationality: string;
  titles: Partial<Record<DivisionId, number>>;
  f1Wins: number;
  wins: number;
  podiums: number;
  retired: boolean;
  citation: string;
}

/** Hall of Fame: Formula 1 champions and prolific winners. */
export function hallOfFame(state: GameState): HallOfFamer[] {
  const f1 = driverDivisionTotals(state, 'F1');
  const out: HallOfFamer[] = [];
  for (const d of allDrivers(state)) {
    const titles = d.career.championships;
    const f1Titles = titles.F1 ?? 0;
    const f1Wins = f1.get(d.id)?.wins ?? 0;
    const totalTitles = Object.values(titles).reduce((s, v) => s + (v ?? 0), 0);
    if (f1Titles === 0 && f1Wins < 10 && totalTitles < 3) continue;
    const parts: string[] = [];
    if (f1Titles) parts.push(`${f1Titles}× World Champion`);
    if (f1Wins) parts.push(`${f1Wins} F1 wins`);
    for (const div of ['F2', 'F3', 'F4', 'F5'] as DivisionId[]) if (titles[div]) parts.push(`${titles[div]}× ${DIVISIONS[div].name} champion`);
    out.push({ driverId: d.id, name: dName(d), nationality: d.nationality, titles, f1Wins, wins: d.career.wins, podiums: d.career.podiums, retired: d.retired, citation: parts.join(' · ') });
  }
  return out.sort((a, b) => (b.titles.F1 ?? 0) - (a.titles.F1 ?? 0) || b.f1Wins - a.f1Wins || b.wins - a.wins);
}

/** Head-to-head record between two drivers across all shared races. */
export function headToHead(state: GameState, a: string, b: string): { races: number; aAhead: number; bAhead: number } {
  const results = [...state.history.flatMap((h) => Object.values(h.divisions).flatMap((dh) => dh.results)), ...Object.values(state.results)].filter((r) => !r.competition);
  let races = 0;
  let aAhead = 0;
  let bAhead = 0;
  for (const r of results) {
    const ea = r.entries.find((e) => e.driverId === a);
    const eb = r.entries.find((e) => e.driverId === b);
    if (!ea || !eb) continue;
    races++;
    if (ea.position < eb.position) aAhead++;
    else bAhead++;
  }
  return { races, aAhead, bAhead };
}
