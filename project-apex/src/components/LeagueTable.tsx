import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { recentForm, strongFinishCut, type FormEntry, type FormGrade } from '@/engine/championship/form';
import { championshipPoints, computeStandingsFromResults, divisionStandings, seasonResults } from '@/engine/championship/standings';
import { tableZones, ZONE_TITLE, type TableZone, type ZoneKind } from '@/engine/championship/zones';
import { divisionAbove, DIVISIONS } from '@/engine/config/divisions';
import { driverShortName } from '@/engine/drivers/ratings';
import type { DivisionId, GameState, RaceResult, StandingRow, Team } from '@/engine/types';
import { useGame, useStore } from '@/store/gameStore';
import { TeamBadge } from './common';
import { Badge, cn, Panel, Select } from './ui';

export const ZONE_COLOR: Record<ZoneKind, string> = { CL: '#3b82f6', EL: '#f97316', ECL: '#22c55e', promotion: '#7dd3fc', relegation: '#ef4444' };

const GRADE: Record<FormGrade, { color: string; label: string }> = {
  win: { color: '#fbbf24', label: 'Race win' },
  podium: { color: '#22c55e', label: 'Podium' },
  strong: { color: '#3b82f6', label: 'Strong points finish' },
  points: { color: '#64748b', label: 'Lower points finish' },
  none: { color: '#ef4444', label: 'No points or DNF' },
};

/** Five small markers, oldest first; each opens that race's classification. */
export function FormStrip({ form, game }: { form: FormEntry[]; game: GameState }) {
  const openResult = useStore((s) => s.openResult);
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, k) => {
        const f = form[form.length - 5 + k];
        if (!f) return <span key={k} className="h-3.5 w-3.5 rounded-full border border-apex-line" />;
        const finish = f.finishes.map((x) => (x.position ? `P${x.position}` : 'DNF')).join(', ');
        const names = f.finishes.map((x) => driverShortName(game.drivers[x.driverId])).join(' / ');
        return (
          <button
            key={f.eventId}
            onClick={() => openResult(f.eventId)}
            title={`Round ${f.round} · ${game.circuits[f.circuitId]?.name ?? ''}\n${finish}${names ? ` (${names})` : ''} · ${f.points} pts\n${GRADE[f.grade].label}`}
            aria-label={`Round ${f.round}: ${finish}`}
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40 transition hover:scale-125"
            style={{ background: GRADE[f.grade].color }}
          />
        );
      })}
    </span>
  );
}

function ZoneBar({ zone }: { zone: TableZone | undefined }) {
  const openEurope = useStore((s) => s.openEurope);
  if (!zone) return null;
  const color = ZONE_COLOR[zone.kind];
  const european = zone.kind === 'CL' || zone.kind === 'EL' || zone.kind === 'ECL';
  return (
    <button
      onClick={() => european && openEurope(zone.kind)}
      title={`${zone.title}${zone.clinched ? ' · secured' : ''}\n${zone.detail}${european ? '\nClick to open the competition.' : ''}`}
      aria-label={zone.title}
      className={cn('absolute inset-y-1 left-0 w-1.5 rounded-r', european ? 'cursor-pointer' : 'cursor-help', zone.blocked && 'opacity-30')}
      style={zone.direct === false ? { background: `repeating-linear-gradient(180deg, ${color} 0 4px, transparent 4px 7px)` } : { background: color }}
    />
  );
}

interface Row {
  id: string;
  team: Pick<Team, 'shortName' | 'colors'> | undefined;
  name: string;
  isPlayer: boolean;
  raced: number;
  standing: StandingRow;
  moved: number;
  zone?: TableZone;
  form: FormEntry[];
}

function buildRows(game: GameState, division: DivisionId, season: number): { rows: Row[]; projection: ReturnType<typeof tableZones> | null; results: RaceResult[] } {
  const current = season === game.season;
  const hist = current ? null : game.history.find((h) => h.season === season)?.divisions[division];
  const standings = current ? divisionStandings(game, division).constructors : hist?.constructorStandings ?? [];
  const results = current ? seasonResults(game, division) : hist?.results ?? [];
  const scoring = championshipPoints(game, division).positions.length;
  const prev = new Map(results.length > 1 ? computeStandingsFromResults(results.slice(0, -1)).constructors.map((r, i) => [r.id, i + 1]) : []);
  const projection = current ? tableZones(game, division) : null;
  const pastZones = current ? null : pastSeasonZones(game, division, season);
  const rows = standings.map((r, i) => {
    const team = game.teams[r.id];
    const before = prev.get(r.id);
    return {
      id: r.id,
      team,
      name: hist?.teamNames[r.id] ?? team?.name ?? r.id,
      isPlayer: r.id === game.player.teamId,
      raced: results.filter((x) => x.entries.some((e) => e.teamId === r.id)).length,
      standing: r,
      moved: before ? before - (i + 1) : 0,
      zone: projection?.byTeam.get(r.id) ?? pastZones?.get(r.id),
      form: recentForm(results, r.id, 'team', scoring),
    };
  });
  return { rows, projection, results };
}

/** What a finished season actually sent up, down and into Europe. */
function pastSeasonZones(game: GameState, division: DivisionId, season: number): Map<string, TableZone> {
  const out = new Map<string, TableZone>();
  const h = game.history.find((x) => x.season === season);
  if (!h) return out;
  for (const m of h.promotions.filter((x) => x.from === division)) out.set(m.teamId, { kind: 'promotion', clinched: true, title: `Promoted to ${DIVISIONS[m.to].name}`, detail: 'Promoted at the end of the season.' });
  for (const m of h.relegations.filter((x) => x.from === division)) out.set(m.teamId, { kind: 'relegation', clinched: true, title: 'Relegated', detail: `Relegated to ${DIVISIONS[m.to].name}.` });
  const q = game.europe?.history.find((x) => x.season === season)?.qualified;
  if (q) {
    for (const t of Object.values(game.teams)) {
      const p = t.clubId ? q[t.clubId] : undefined;
      if (p) out.set(t.id, { kind: p.comp, direct: p.direct, clinched: true, title: `${ZONE_TITLE[p.comp]} · ${p.direct ? 'league phase' : 'qualifying round'}`, detail: 'Qualified from this season.' });
    }
  }
  return out;
}

/**
 * The teams' championship as a league table: qualification zones beside the
 * positions, gameweeks raced, wins, podiums, points, the gap to the leader and
 * the last five races.
 */
export function TeamStandings({ division }: { division: DivisionId }) {
  const game = useGame();
  const seasons = useMemo(() => [game.season, ...game.history.filter((h) => h.divisions[division]?.constructorStandings?.length).map((h) => h.season).reverse()], [game, division]);
  const [season, setSeason] = useState(game.season);
  const shown = seasons.includes(season) ? season : game.season;
  const { rows, projection, results } = buildRows(game, division, shown);
  const leader = rows[0]?.standing.points ?? 0;
  const kinds = projection?.kinds ?? [...new Set(rows.map((r) => r.zone?.kind).filter((k): k is ZoneKind => !!k))];
  const anyQualifying = rows.some((r) => r.zone?.direct === false);
  const anyClinched = rows.some((r) => r.zone?.clinched);
  const scoring = championshipPoints(game, division).positions.length;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
      <Panel
        title={shown === game.season ? 'Teams’ championship' : `Teams’ championship · season ${shown}`}
        actions={seasons.length > 1 ? <Select value={String(shown)} onChange={(v) => setSeason(Number(v))} options={seasons.map((s) => ({ value: String(s), label: s === game.season ? `Season ${s} (current)` : `Season ${s}` }))} /> : undefined}
        bodyClass="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table-apex min-w-[640px]">
            <thead>
              <tr>
                <th className="w-2 !p-0" />
                <th className="w-12">Pos</th>
                <th>Team</th>
                <th title="Gameweeks raced (one race each)">GW</th>
                <th title="Race wins">W</th>
                <th title="Podiums">Pod</th>
                <th className="text-right" title="Constructors' points">Pts</th>
                <th className="text-right" title="Points behind the leader">Gap</th>
                <th title="Last five races, oldest first">Last 5</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.isPlayer ? 'bg-apex-red/[0.08]' : ''}>
                  <td className="relative w-2 !p-0">
                    <ZoneBar zone={r.zone} />
                  </td>
                  <td className="num font-bold">
                    <span className="inline-flex items-center gap-1">
                      {i + 1}
                      {r.zone?.clinched && <Check size={12} className="text-emerald-400" aria-label="Secured" />}
                      {r.moved !== 0 && <span className={cn('text-[10px]', r.moved > 0 ? 'text-emerald-400' : 'text-red-400')}>{r.moved > 0 ? `▲${r.moved}` : `▼${-r.moved}`}</span>}
                    </span>
                  </td>
                  <td>
                    <TeamCell id={r.id} team={r.team} name={r.name} isPlayer={r.isPlayer} />
                  </td>
                  <td className="num">{r.raced}</td>
                  <td className="num">{r.standing.wins}</td>
                  <td className="num">{r.standing.podiums}</td>
                  <td className="num text-right text-base font-bold">{r.standing.points}</td>
                  <td className="num text-right text-apex-muted">{i === 0 ? '—' : `−${leader - r.standing.points}`}</td>
                  <td>{results.length ? <FormStrip form={r.form} game={game} /> : <span className="text-xs text-apex-dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend kinds={kinds} anyQualifying={anyQualifying} anyClinched={anyClinched} scoring={scoring} division={division} />
      </Panel>
      {projection && <QualificationPicture division={division} rows={rows} projection={projection} />}
    </div>
  );
}

function TeamCell({ id, team, name, isPlayer }: { id: string; team: Row['team']; name: string; isPlayer: boolean }) {
  const open = useStore((s) => s.openTeam);
  const game = useGame();
  return (
    <button onClick={() => game.teams[id] && open(id)} className={cn('inline-flex min-w-0 items-center gap-2 text-left hover:underline', isPlayer ? 'font-semibold text-white' : 'text-white/85')}>
      <TeamBadge team={team} title={name} />
      <span className="truncate">{name}</span>
    </button>
  );
}

function Legend({ kinds, anyQualifying, anyClinched, scoring, division }: { kinds: ZoneKind[]; anyQualifying: boolean; anyClinched: boolean; scoring: number; division: DivisionId }) {
  const up = divisionAbove(division);
  return (
    <div className="space-y-2 border-t border-apex-line px-4 py-3 text-[11px] text-apex-muted">
      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {kinds.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: ZONE_COLOR[k] }} />
              {k === 'promotion' && up ? `Promotion to ${DIVISIONS[up].name}` : ZONE_TITLE[k]}
            </span>
          ))}
          {anyQualifying && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: 'repeating-linear-gradient(180deg, #94a3b8 0 3px, transparent 3px 5px)' }} />
              Striped: qualifying round, not straight into the league phase
            </span>
          )}
          {anyClinched && (
            <span className="flex items-center gap-1">
              <Check size={12} className="text-emerald-400" /> mathematically secured
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Last 5:</span>
        {(Object.keys(GRADE) as FormGrade[]).map((g) => (
          <span key={g} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GRADE[g].color }} />
            {g === 'strong' ? `${GRADE[g].label} (P4–P${strongFinishCut(scoring)})` : GRADE[g].label}
          </span>
        ))}
        <span>· best car per race; click a marker for the classification</span>
      </div>
    </div>
  );
}

/** Who is heading where if the season ended now, and what is already settled. */
function QualificationPicture({ division, rows, projection }: { division: DivisionId; rows: Row[]; projection: ReturnType<typeof tableZones> }) {
  const groups = projection.kinds.map((k) => ({ kind: k, rows: rows.filter((r) => r.zone?.kind === k && !r.zone.blocked) }));
  const blocked = rows.filter((r) => r.zone?.blocked);
  return (
    <Panel title="Qualification picture">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>{projection.racesLeft ? `${projection.racesLeft} race${projection.racesLeft === 1 ? '' : 's'} left` : 'Season complete'}</Badge>
          {projection.rank && <Badge tone="blue">Coefficient rank #{projection.rank}{projection.rankFinal ? '' : ' (live)'}</Badge>}
        </div>
        {groups.length === 0 && <p className="text-xs text-apex-muted">{DIVISIONS[division].name} has no promotion, relegation or European places.</p>}
        {groups.map((g) => (
          <div key={g.kind}>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: ZONE_COLOR[g.kind] }}>
              <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: ZONE_COLOR[g.kind] }} />
              {ZONE_TITLE[g.kind]}
            </div>
            <div className="space-y-1">
              {g.rows.map((r) => (
                <div key={r.id} className={cn('flex items-center gap-2 text-xs', r.isPlayer && 'text-white')} title={r.zone?.detail}>
                  <span className="num w-6 text-apex-muted">P{rows.indexOf(r) + 1}</span>
                  <TeamBadge team={r.team} size={16} />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="text-[10px] text-apex-muted">{r.zone?.via === 'cup' ? 'cup' : r.zone?.via === 'holder' ? 'holders' : r.zone?.direct === false ? 'qualifying' : ''}</span>
                  {r.zone?.clinched ? <Check size={12} className="text-emerald-400" /> : <span className="text-[10px] text-apex-dim">projected</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {blocked.length > 0 && (
          <div className="text-xs text-apex-muted">
            <div className="mb-1 font-semibold uppercase tracking-wider">Licence missing</div>
            {blocked.map((r) => (
              <div key={r.id} className="flex items-center gap-2" title={r.zone?.detail}>
                <span className="num w-6">P{rows.indexOf(r) + 1}</span>
                <TeamBadge team={r.team} size={16} />
                <span className="truncate">{r.name}</span>
              </div>
            ))}
          </div>
        )}
        {projection.notes.length > 0 && (
          <ul className="space-y-1 border-t border-apex-line pt-2 text-[11px] text-apex-muted">
            {projection.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
