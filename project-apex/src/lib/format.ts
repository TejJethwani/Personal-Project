export function money(v: number, opts: { sign?: boolean; precise?: boolean } = {}): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 100_000_000 || !opts.precise ? (abs >= 10_000_000 ? 1 : 2) : 2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function pct(v: number, dp = 0): string {
  return `${(v * 100).toFixed(dp)}%`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function lapTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds >= 99999) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function gapText(gap: number): string {
  return `+${gap.toFixed(gap >= 100 ? 1 : 3)}`;
}

export function weekLabel(_season: number, week: number): string {
  if (week < 0) return `Off-season · ${-week} wk to go`;
  if (week === 0) return 'Pre-season';
  return `Week ${week}`;
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
