/** Small shared helpers: money formatting, tactical fit, logging, news. */
import type { Game, News, NewsCat, Player, World } from './types';
import { A, ovr } from './attributes';
import { clamp } from './rng';
import { fmtDate } from './competitions';

export function fmtEur(v: number): string {
  if (v >= 1e9) return `€${(v / 1e9).toFixed(2)}bn`;
  if (v >= 1e6) return `€${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}m`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}k`;
  return `€${Math.round(v)}`;
}
export function fmtWage(v: number): string { return `${fmtEur(v)}/wk`; }
/** NEL bids are annual-salary offers in Japanese yen. */
export function fmtYen(v: number): string {
  if (v >= 1e8) return `¥${(v / 1e8).toFixed(2)}億 (${Math.round(v / 1e6)}M)`;
  return `¥${Math.round(v / 1e6)}M`;
}
export function fmtYenShort(v: number): string { return v <= 0 ? '—' : `¥${Math.round(v / 1e6).toLocaleString('en-US')}M`; }
export const YEN_PER_EUR = 162;

const STYLE_ATTRS: Record<string, number[]> = {
  possession: [A.SPA, A.VIS, A.BCO, A.FTO, A.DEC], gegenpress: [A.STA, A.ACC, A.TAC, A.REA, A.TIQ], counter: [A.SPD, A.ACC, A.FIN, A.LPA, A.POS],
  direct: [A.STR, A.HEA, A.LPA, A.JUM, A.SHP], wing: [A.CRO, A.SPD, A.DRI, A.ACC, A.STA], lowblock: [A.DAW, A.MAR, A.TIQ, A.STR, A.INT],
  balanced: [A.DEC, A.TIQ, A.REA, A.BCO, A.STA], tiki: [A.SPA, A.FTO, A.VIS, A.AGI, A.TIQ], rational: [A.POS, A.DEC, A.FIN, A.TIQ, A.REA],
  athletic: [A.ACC, A.SPD, A.STR, A.STA, A.JUM], creative: [A.DRI, A.AGI, A.SKL, A.BCO, A.VIS], strategic: [A.TIQ, A.DAW, A.MAR, A.DEC, A.INT],
  dualace: [A.SHP, A.FIN, A.ACC, A.COM, A.DRI],
};
export function styleAttrs(style: string): number[] { return STYLE_ATTRS[style] ?? STYLE_ATTRS.balanced; }
/** Tactical fit in selection points (−3..+3): how well a player's attributes suit a club's identity. */
export function tacticalFit(p: Player, style: string): number {
  const idx = styleAttrs(style);
  let s = 0;
  for (const i of idx) s += p.a[i];
  return clamp((s / idx.length - ovr(p)) / 4, -3, 3);
}

export function log(w: World, k: string, m: string): void {
  w.log.push({ abs: w.abs, s: w.season, day: w.day, k, m });
  if (w.log.length > 1500) w.log.splice(0, 300);
}

export function addNews(g: Game, cat: NewsCat, title: string, body: string, o: { imp?: number; pids?: string[]; clubs?: string[]; me?: boolean; paper?: string } = {}): News {
  const w = g.world;
  const me = o.me ?? !!o.pids?.includes(g.career.pid);
  const n: News = { id: w.newsId++, s: w.season, day: w.day, date: fmtDate(w, w.day), cat, title, body, imp: o.imp ?? 1, pids: o.pids, clubs: o.clubs, me, ...(o.paper ? { paper: o.paper } : {}) };
  w.news.push(n);
  if (w.news.length > 520) {
    // keep the feed bounded: drop the oldest low-importance items first
    const cut = w.news.length - 420;
    let removed = 0;
    w.news = w.news.filter((x, i) => { if (removed < cut && !x.me && x.imp < 3 && i < w.news.length - 150) { removed++; return false; } return true; });
  }
  return n;
}

export function milestone(g: Game, type: string, txt: string): void {
  const w = g.world;
  g.career.timeline.push({ s: w.season, day: w.day, date: fmtDate(w, w.day, true), type, txt });
}
export function once(w: World, key: string): boolean {
  if (w.done[key]) return false;
  w.done[key] = w.abs + 1;
  return true;
}
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
export function me(g: Game): Player { return g.world.players[g.career.pid]; }
export function ageOf(g: Game, p: Player): number { return g.world.season - p.born; }
