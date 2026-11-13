/** Small player-driven mutations that do not belong to the day loop. */
import type { Game, SessionPlan } from './types';
import { abilityDef, makeHybrid, registerCustom } from './abilities';
import { weaponSlots } from './development';
import { calcOvr, N_OUT } from './attributes';
import { clamp } from './rng';
import { addNews, milestone } from './util';
import { release } from './transfers';

export function chooseEvolution(g: Game, id: string, evo: string): string {
  const p = g.world.players[g.career.pid];
  const r = p.ab.find((x) => x.id === id);
  const d = abilityDef(id);
  const e = d?.evo?.find((x) => x.id === evo);
  if (!r || !d || !e) return 'Not available.';
  if (r.lv < 3) return 'Reach level 3 first.';
  if (r.evo) return 'This weapon has already evolved.';
  r.evo = evo;
  delete g.career.flags['evo:' + id];
  milestone(g, 'ability', `${d.name} evolved into ${e.name}.`);
  addNews(g, 'career', `${d.name} evolves: ${e.name}`, e.desc, { imp: 3, me: true });
  return `${d.name} evolved: ${e.name}.`;
}

export function canHybrid(g: Game): { id: string; name: string }[] {
  const p = g.world.players[g.career.pid];
  return p.ab.filter((r) => r.lv >= 3).map((r) => ({ id: r.id, def: abilityDef(r.id) })).filter((x) => x.def?.kind === 'weapon' && !x.def.custom).map((x) => ({ id: x.id, name: x.def!.name }));
}
/** Fuse two level-3+ weapons into a hybrid that takes a third weapon slot. */
export function craftHybrid(g: Game, a: string, b: string): string {
  const p = g.world.players[g.career.pid];
  const ok = canHybrid(g).map((x) => x.id);
  if (a === b || !ok.includes(a) || !ok.includes(b)) return 'Both weapons must be different and at level 3 or higher.';
  const weapons = p.ab.filter((r) => abilityDef(r.id)?.kind === 'weapon');
  if (weapons.length >= weaponSlots(g).open) return 'You have no free weapon slot yet.';
  const key = 'hyb_' + [a, b].sort().join('_');
  if (g.career.custom.some((c) => c.id === key)) return 'You have already created that hybrid.';
  const h = makeHybrid(abilityDef(a)!, abilityDef(b)!, key);
  g.career.custom.push(h);
  registerCustom(g.career.custom);
  p.ab.push({ id: key, lv: 1, xp: 0 });
  milestone(g, 'ability', `Created the hybrid weapon ${h.name}.`);
  addNews(g, 'career', `New hybrid weapon: ${h.name}`, h.desc, { imp: 3, me: true });
  return `Hybrid created: ${h.name}.`;
}

export function setPlan(g: Game, day: number, s: SessionPlan): void { g.career.plan[day] = s; }

/** Sandbox: edit attributes / potential / age / condition. Marks the save as edited. */
export function sandboxEdit(g: Game, o: { attrs?: number[]; pot?: number; age?: number; fit?: number; trust?: number; rep?: number }): void {
  const p = g.world.players[g.career.pid];
  if (o.attrs) for (let i = 0; i < N_OUT; i++) p.a[i] = clamp(Math.round(o.attrs[i]), 1, 99);
  if (o.pot != null) p.pot = clamp(Math.round(o.pot), 1, 99);
  p.pot = Math.max(p.pot, calcOvr(p.a, p.pos));
  if (o.age != null) p.born = g.world.season - clamp(Math.round(o.age), 15, 45);
  if (o.fit != null) { p.fit = clamp(o.fit, 1, 100); p.inj = 0; }
  if (o.trust != null) g.career.mgrTrust = clamp(o.trust, 0, 100);
  if (o.rep != null) p.rep = clamp(o.rep, 0, 99);
  g.edited = true;
  g.career.ovrLog.push({ s: g.world.season, day: g.world.day, ovr: calcOvr(p.a, p.pos) });
}

export function retire(g: Game): void {
  const w = g.world;
  const p = w.players[g.career.pid];
  if (p.retired) return;
  const club = p.club ? w.clubs[p.club]?.name : '';
  release(g, p, true);
  g.live = null;
  milestone(g, 'retire', `Retired from football${club ? ` at ${club}` : ''}, aged ${w.season - p.born}.`);
  addNews(g, 'career', `${p.name} retires`, `A career of ${g.career.matches.filter((m) => m.line).length} appearances comes to an end.`, { imp: 3, me: true });
}
