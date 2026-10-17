import { useMemo, useState } from 'react';
import { circuitTags } from '@/engine/data/circuits';
import { eventLaps } from '@/engine/config/divisions';
import type { Circuit, DivisionId, GameState } from '@/engine/types';
import { CircuitOutline } from './CircuitMap';
import { Badge, Segmented } from './ui';

type Filter = 'all' | 'season' | 'street' | 'speed' | 'mountain' | 'weather' | 'short' | 'long';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'season', label: 'This season' },
  { value: 'all', label: 'All' },
  { value: 'street', label: 'Street' },
  { value: 'speed', label: 'High-speed' },
  { value: 'mountain', label: 'Mountain' },
  { value: 'weather', label: 'Mixed weather' },
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
];

function matches(c: Circuit, f: Filter, season: Set<string>): boolean {
  const labels = circuitTags(c).map((t) => t.label);
  switch (f) {
    case 'season':
      return season.has(c.id);
    case 'street':
      return c.type === 'street';
    case 'speed':
      return labels.includes('High-speed');
    case 'mountain':
      return labels.some((l) => l.startsWith('Mountain'));
    case 'weather':
      return labels.includes('Mixed weather');
    case 'short':
      return c.lengthKm < 3.8;
    case 'long':
      return c.lengthKm > 6.2;
    default:
      return true;
  }
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 text-apex-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-white/[0.06]">
        <div className="h-1.5 rounded bg-apex-red/80" style={{ width: `${Math.round(Math.max(0.04, Math.min(1, value)) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Every venue: its layout, category tags and the characteristics that shape its races. */
export function CircuitGuide({ game, division }: { game: GameState; division: DivisionId }) {
  const [filter, setFilter] = useState<Filter>('season');
  const season = useMemo(() => new Set(game.calendars[division].map((e) => e.circuitId)), [game, division]);
  const list = Object.values(game.circuits)
    .filter((c) => matches(c, filter, season))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={FILTERS} />
        <span className="text-xs text-apex-muted">{list.length} circuits</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {list.map((c) => {
          const tags = circuitTags(c);
          const laps = eventLaps({ division }, c.laps);
          return (
            <div key={c.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold uppercase">{c.name}</div>
                  <div className="text-xs text-apex-muted">
                    {c.location} · {c.country} · {c.lengthKm.toFixed(2)} km · {laps} laps · pit loss {c.pitLoss}s
                  </div>
                </div>
                {season.has(c.id) && <Badge tone="red">This season</Badge>}
              </div>
              <CircuitOutline circuit={c} className="my-2 w-full" />
              <div className="mb-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <Badge key={t.label} tone={t.tone} title={t.title}>
                    {t.label}
                  </Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Meter label="Top speed" value={(c.weights.straightLine + c.weights.powerUnit - 0.2) / 0.25} />
                <Meter label="Downforce" value={(c.weights.aerodynamics + c.weights.cornering - 0.18) / 0.28} />
                <Meter label="Braking" value={(c.brakeStress - 0.6) / 0.8} />
                <Meter label="Tyre wear" value={(c.tireStress - 0.6) / 0.85} />
                <Meter label="Overtaking" value={1 - c.overtakingDifficulty} />
                <Meter label="Rain risk" value={c.rainChance / 0.6} />
                <Meter label="Fuel use" value={((c.fuelFactor ? c.fuelFactor / (c.lengthKm / 5) : 1) - 0.8) / 0.55} />
                <Meter label="Safety car" value={(c.safetyCarRisk - 0.5) / 1.5} />
              </div>
              <p className="mt-2 text-xs text-white/75">{c.character}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
