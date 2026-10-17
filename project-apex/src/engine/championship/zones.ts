import { divisionAbove, DIVISIONS } from '../config/divisions';
import { isEuropean, levelOfDivision } from '../config/ruleset';
import { associationRanking, seasonClubPoints, sum } from '../europe/coefficients';
import { berthsForRank, CONTINENTAL_ORDER } from '../europe/continental';
import { promotionPicture } from '../season/promotion';
import type { ContinentalCompetition, DivisionId, GameState, StandingRow } from '../types';
import { divisionStandings, teamPointsRemaining } from './standings';

/**
 * What every place in a league table is currently worth: European places
 * (from the association's coefficient rank, the domestic cup winner and title
 * holders, with places already taken passing down the table), promotion and
 * relegation. Recomputed from the live standings, so a team climbing from P7
 * to P4 picks up the Champions League place at once. A place is only marked
 * secured when no remaining result can take it away.
 */

export type ZoneKind = 'CL' | 'EL' | 'ECL' | 'promotion' | 'relegation';

export interface TableZone {
  kind: ZoneKind;
  /** European places: straight into the league phase, or via a qualifying round. */
  direct?: boolean;
  /** How a European place is earned. */
  via?: 'league' | 'cup' | 'holder';
  /** Mathematically secured: no remaining result can take it away. */
  clinched: boolean;
  /** A promotion position the team cannot take up (no licence); the place passes down. */
  blocked?: boolean;
  title: string;
  detail: string;
}

export interface ZoneProjection {
  byTeam: Map<string, TableZone>;
  /** Kinds present, in table order, for the legend. */
  kinds: ZoneKind[];
  notes: string[];
  /** Association coefficient rank the European places come from (top flight only). */
  rank: number | null;
  /** True once the coefficient ranking for next season can no longer change. */
  rankFinal: boolean;
  racesLeft: number;
}

export const ZONE_TITLE: Record<ZoneKind, string> = {
  CL: 'Champions League',
  EL: 'Europa League',
  ECL: 'Conference League',
  promotion: 'Promotion',
  relegation: 'Relegation',
};

// ---------------------------------------------------------------------------
// Mathematics of the table
// ---------------------------------------------------------------------------

/**
 * Guaranteed best and worst final positions of each row, given the most
 * points any team can still score. Ties are treated as going against the team
 * (count-back is not assumed), so "secured" is never claimed too early.
 */
export function positionBounds(rows: { points: number }[], remaining: number): { best: number; worst: number }[] {
  return rows.map((r, i) => {
    if (remaining <= 0) return { best: i + 1, worst: i + 1 };
    let couldBeAhead = 0;
    let surelyAhead = 0;
    rows.forEach((o, j) => {
      if (j === i) return;
      if (o.points + remaining >= r.points) couldBeAhead++;
      if (o.points > r.points + remaining) surelyAhead++;
    });
    return { best: surelyAhead + 1, worst: couldBeAhead + 1 };
  });
}

// ---------------------------------------------------------------------------
// European places
// ---------------------------------------------------------------------------

/** Has this season's continental programme finished (so coefficients are settled)? */
function europeanSeasonOver(state: GameState): boolean {
  const comps = Object.values(state.europe?.continental ?? {});
  return comps.length > 0 && comps.every((c) => c?.stage === 'done');
}

/**
 * Association ranking for next season's places if the season ended now: this
 * season's coefficient points so far replace the oldest of the five seasons.
 * After the season is closed the stored ranking already includes it.
 */
export function liveAssociationRanking(state: GameState): string[] {
  const europe = state.europe!;
  if (state.phase === 'seasonReview' || state.phase === 'offseason') return associationRanking(state);
  const pts = seasonClubPoints(state);
  const byAssoc = new Map<string, number[]>();
  for (const [clubId, row] of Object.entries(pts)) {
    const assoc = europe.clubs[clubId]?.assocId;
    if (assoc) byAssoc.set(assoc, [...(byAssoc.get(assoc) ?? []), row.points]);
  }
  const total = (id: string) => {
    const list = byAssoc.get(id) ?? [];
    const live = list.length ? Math.round((sum(list) / list.length) * 100) / 100 : 0;
    return sum([...europe.associations[id].coef, live].slice(-5));
  };
  return Object.keys(europe.associations).sort((a, b) => total(b) - total(a) || a.localeCompare(b));
}

interface Place {
  comp: ContinentalCompetition;
  direct: boolean;
  via: 'league' | 'cup' | 'holder';
}

/**
 * Next season's European places of one association, exactly as the season
 * allocation hands them out: title holders first, then each competition's
 * berths in order, a cup berth going to the cup winner unless already
 * qualified, and any place already taken passing to the next club down.
 * An undecided cup leaves its berth open.
 */
export function associationPlaces(rank: number, order: string[], cupWinner: string | null, holders: Partial<Record<ContinentalCompetition, string | null>>, cupDecided = true): Map<string, Place> {
  const out = new Map<string, Place>();
  const place = (id: string | null | undefined, p: Place) => {
    if (!id || out.has(id)) return;
    out.set(id, p);
  };
  if (holders.CL && order.includes(holders.CL)) place(holders.CL, { comp: 'CL', direct: true, via: 'holder' });
  if (holders.EL && order.includes(holders.EL)) place(holders.EL, { comp: 'CL', direct: true, via: 'holder' });
  if (holders.ECL && order.includes(holders.ECL)) place(holders.ECL, { comp: 'EL', direct: true, via: 'holder' });
  const berths = berthsForRank(rank);
  for (const comp of CONTINENTAL_ORDER) {
    for (const b of berths.filter((x) => x.comp === comp)) {
      if (b.route === 'cup') {
        if (!cupDecided) continue;
        if (cupWinner && !out.has(cupWinner)) place(cupWinner, { comp, direct: b.direct, via: 'cup' });
        else place(order.find((c) => !out.has(c)), { comp, direct: b.direct, via: 'league' });
      } else place(order.slice(b.pos - 1).find((c) => !out.has(c)), { comp, direct: b.direct, via: 'league' });
    }
  }
  return out;
}

/** The last table position a competition's league places reach in this projection. */
function lowestPosition(order: string[], places: Map<string, Place>, comp: ContinentalCompetition): number {
  let pos = 0;
  order.forEach((id, i) => {
    const p = places.get(id);
    if (p?.comp === comp && p.via === 'league') pos = i + 1;
  });
  return pos;
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export function tableZones(state: GameState, division: DivisionId): ZoneProjection {
  const rows: StandingRow[] = divisionStandings(state, division).constructors;
  const cfg = DIVISIONS[division];
  const racesLeft = state.calendars[division].filter((e) => !e.completed).length;
  const bounds = positionBounds(rows, teamPointsRemaining(state, division));
  const byTeam = new Map<string, TableZone>();
  const notes: string[] = [];
  const over = racesLeft === 0;
  let rank: number | null = null;
  let rankFinal = false;

  // European places (top flight of a European League association).
  if (isEuropean(state) && state.europe && levelOfDivision(division) === 1) {
    const europe = state.europe;
    const assocId = europe.playerAssocId;
    rankFinal = state.phase === 'seasonReview' || state.phase === 'offseason' || europeanSeasonOver(state);
    rank = liveAssociationRanking(state).indexOf(assocId) + 1;
    const clubOf = new Map(rows.map((r) => [state.teams[r.id]?.clubId, r.id]));
    const order = rows.map((r) => state.teams[r.id]?.clubId).filter((x): x is string => !!x);
    const cup = europe.cups[`${assocId}-cup`];
    const holders = Object.fromEntries(CONTINENTAL_ORDER.map((c) => [c, europe.continental[c]?.winner ?? null])) as Record<ContinentalCompetition, string | null>;
    const places = associationPlaces(rank, order, cup?.winner ?? null, holders, !!cup?.winner);
    const cupBerth = berthsForRank(rank).find((b) => b.route === 'cup');
    if (cupBerth && !cup?.winner) notes.push(`${cup?.name ?? 'Cup'} winner (still to be decided): ${ZONE_TITLE[cupBerth.comp]}${cupBerth.direct ? '' : ' qualifying'}. If the winner has already qualified through the league, the place passes to the next team in the table.`);
    if (cup?.winner && places.get(cup.winner)?.via !== 'cup' && order.includes(cup.winner)) notes.push(`${europe.clubs[cup.winner]?.name ?? 'The cup winner'} won the ${cup.name} but qualify through the league, so the cup's place passes down the table.`);
    for (const c of CONTINENTAL_ORDER) {
      const h = holders[c];
      if (h && places.get(h)?.via === 'holder') notes.push(`${europe.clubs[h]?.name} qualify as ${ZONE_TITLE[c]} winners; their league place passes down the table.`);
    }
    notes.push(rankFinal ? `Coefficient rank #${rank} is final for next season.` : `Based on the live coefficient ranking (#${rank}). Places become official once the European season ends.`);
    for (const [clubId, p] of places) {
      const teamId = clubOf.get(clubId);
      if (!teamId) continue;
      const i = rows.findIndex((r) => r.id === teamId);
      let clinched = false;
      let detail: string;
      const stage = p.direct ? 'league phase' : 'qualifying round';
      if (p.via === 'holder') {
        clinched = true;
        detail = `Qualified as title holders: ${ZONE_TITLE[p.comp]} ${stage}.`;
      } else if (p.via === 'cup') {
        clinched = rankFinal;
        detail = `${cup?.name} winners: ${ZONE_TITLE[p.comp]} ${stage}.${rankFinal ? '' : ' The competition depends on the final coefficient rank.'}`;
      } else {
        const lastPos = lowestPosition(order, places, p.comp);
        clinched = rankFinal && bounds[i].worst <= lastPos;
        detail = clinched
          ? `Secured: cannot finish below P${lastPos}. ${ZONE_TITLE[p.comp]} ${stage} (could still finish higher).`
          : `${ZONE_TITLE[p.comp]} ${stage} if the season ended now.${bounds[i].worst > lastPos ? ` Could still drop to P${bounds[i].worst}.` : ' Becomes official when the coefficient ranking is final.'}`;
      }
      byTeam.set(teamId, { kind: p.comp, direct: p.direct, via: p.via, clinched, title: `${ZONE_TITLE[p.comp]} · ${stage}`, detail });
    }
  }

  // Promotion and relegation follow the live promotion picture (licences included).
  const picture = promotionPicture(state, division);
  const up = divisionAbove(division);
  picture.forEach((row) => {
    const i = row.position - 1;
    if (row.status === 'promotion' && up) {
      const secured = bounds[i].worst <= cfg.promotionSlots;
      byTeam.set(row.teamId, {
        kind: 'promotion',
        clinched: secured && row.eligible && over,
        title: `Promotion to ${DIVISIONS[up].name}`,
        detail: `${secured ? `Top ${cfg.promotionSlots} secured on the track.` : `Promoted if the season ended now${bounds[i].worst > cfg.promotionSlots ? `; could still drop to P${bounds[i].worst}` : ''}.`} Promotion also needs a licence for ${DIVISIONS[up].name}${row.eligible ? ' (currently met).' : ' (not met yet).'}`,
      });
    } else if (row.status === 'contender' && up && row.position <= cfg.promotionSlots) {
      const missing = row.checks.filter((c) => !c.met).map((c) => c.label);
      byTeam.set(row.teamId, {
        kind: 'promotion',
        blocked: true,
        clinched: false,
        title: 'Promotion position · licence missing',
        detail: `Finishing here would earn promotion, but the team has no licence for ${DIVISIONS[up].name} yet (${missing.join(', ')}). The place passes to the next eligible team.`,
      });
    } else if (row.status === 'relegation') {
      const safeLine = rows.length - picture.filter((r) => r.status === 'relegation').length;
      byTeam.set(row.teamId, {
        kind: 'relegation',
        clinched: over,
        title: 'Relegation',
        detail: over ? 'Relegated.' : bounds[i].best > safeLine ? `Cannot climb above P${safeLine}: relegated unless fewer clubs go up from below.` : `Relegated if the season ended now; can still reach P${bounds[i].best}.`,
      });
    }
  });
  if (picture.some((r) => r.status === 'contender') && up) notes.push(`A team in a promotion position without a licence for ${DIVISIONS[up].name} gives its place to the next eligible team.`);

  const kinds: ZoneKind[] = [];
  for (const r of rows) {
    const z = byTeam.get(r.id);
    if (z && !kinds.includes(z.kind)) kinds.push(z.kind);
  }
  return { byTeam, kinds, notes, rank, rankFinal, racesLeft };
}
