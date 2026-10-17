import { Shuffle, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CHALLENGES, type ChallengeId, type TakeoverCandidate } from '@/engine/career/takeover';
import { NATIONALITY_BY_CODE } from '@/engine/data/names';
import type { DivisionId } from '@/engine/types';
import { Flag, TeamBadge } from '@/components/common';
import { Badge, Button, cn, RatingBar, Select } from '@/components/ui';
import { money } from '@/lib/format';

type Tier = 'any' | 'high' | 'mid' | 'low';
type SortKey = 'rating' | 'projected' | 'cash' | 'drivers' | 'reputation' | 'name';

/** Thirds within each division: top, middle or bottom of its own field. */
function tierWithin(list: TakeoverCandidate[], value: (c: TakeoverCandidate) => number): Map<string, Tier> {
  const out = new Map<string, Tier>();
  const byDiv = new Map<DivisionId, TakeoverCandidate[]>();
  for (const c of list) byDiv.set(c.division, [...(byDiv.get(c.division) ?? []), c]);
  for (const group of byDiv.values()) {
    const sorted = [...group].sort((a, b) => value(b) - value(a));
    sorted.forEach((c, i) => out.set(c.teamId, i < sorted.length / 3 ? 'high' : i < (2 * sorted.length) / 3 ? 'mid' : 'low'));
  }
  return out;
}

export function TakeoverBrowser({ candidates, selected, onSelect, seed, onReroll, countryLabel }: { candidates: TakeoverCandidate[]; selected: string | null; onSelect: (id: string) => void; seed: number; onReroll: () => void; countryLabel: string | null }) {
  const [division, setDivision] = useState<string>('any');
  const [country, setCountry] = useState<string>('any');
  const [reputation, setReputation] = useState<Tier>('any');
  const [finance, setFinance] = useState<Tier>('any');
  const [drivers, setDrivers] = useState<Tier>('any');
  const [compete, setCompete] = useState<Tier>('any');
  const [challenge, setChallenge] = useState<ChallengeId | 'any'>('any');
  const [sort, setSort] = useState<SortKey>('rating');

  const tiers = useMemo(
    () => ({
      reputation: tierWithin(candidates, (c) => c.reputation),
      finance: tierWithin(candidates, (c) => c.budgetRatio),
      drivers: tierWithin(candidates, (c) => c.driverAvg),
      compete: tierWithin(candidates, (c) => -c.projected),
    }),
    [candidates],
  );
  const divisions = useMemo(() => [...new Map(candidates.map((c) => [c.division, c])).values()].sort((a, b) => a.level - b.level), [candidates]);
  const countries = useMemo(() => [...new Set(candidates.map((c) => c.nationality))].sort((a, b) => (NATIONALITY_BY_CODE[a]?.name ?? a).localeCompare(NATIONALITY_BY_CODE[b]?.name ?? b)), [candidates]);

  const shown = candidates
    .filter((c) => division === 'any' || c.division === division)
    .filter((c) => country === 'any' || c.nationality === country)
    .filter((c) => reputation === 'any' || tiers.reputation.get(c.teamId) === reputation)
    .filter((c) => finance === 'any' || tiers.finance.get(c.teamId) === finance)
    .filter((c) => drivers === 'any' || tiers.drivers.get(c.teamId) === drivers)
    .filter((c) => compete === 'any' || tiers.compete.get(c.teamId) === compete)
    .filter((c) => challenge === 'any' || c.challenges.includes(challenge))
    .sort((a, b) => {
      switch (sort) {
        case 'projected':
          return a.level - b.level || a.projected - b.projected;
        case 'cash':
          return b.cash - a.cash;
        case 'drivers':
          return b.driverAvg - a.driverAvg;
        case 'reputation':
          return b.reputation - a.reputation;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return b.rating - a.rating;
      }
    });
  const current = candidates.find((c) => c.teamId === selected) ?? null;
  const tierOptions = (high: string, mid: string, low: string) => [
    { value: 'any' as Tier, label: 'Any' },
    { value: 'high' as Tier, label: high },
    { value: 'mid' as Tier, label: mid },
    { value: 'low' as Tier, label: low },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-apex-muted">
        <span>
          World seed <span className="num text-white">{seed}</span>
          {countryLabel ? ` · ${countryLabel}` : ''} · {candidates.length} teams
        </span>
        <Button size="sm" variant="ghost" onClick={onReroll}>
          <Shuffle size={14} /> Generate a different world
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={challenge === 'any'} onClick={() => setChallenge('any')} label="All teams" />
        {(Object.keys(CHALLENGES) as ChallengeId[]).map((id) => (
          <FilterChip key={id} active={challenge === id} onClick={() => setChallenge(id)} label={`${CHALLENGES[id].label} (${candidates.filter((c) => c.challenges.includes(id)).length})`} title={CHALLENGES[id].description} />
        ))}
      </div>
      {challenge !== 'any' && <p className="text-xs text-apex-muted">{CHALLENGES[challenge].description}</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Labeled label="Division / formula class">
          <Select value={division} onChange={setDivision} options={[{ value: 'any', label: 'All divisions' }, ...divisions.map((c) => ({ value: c.division, label: `${c.divisionName} (${c.formulaClass} cars)` }))]} className="w-full" />
        </Labeled>
        {countryLabel === null && (
          <Labeled label="Country">
            <Select value={country} onChange={setCountry} options={[{ value: 'any', label: 'All countries' }, ...countries.map((n) => ({ value: n, label: NATIONALITY_BY_CODE[n]?.name ?? n }))]} className="w-full" />
          </Labeled>
        )}
        <Labeled label="Reputation">
          <Select value={reputation} onChange={setReputation} options={tierOptions('Famous in its division', 'Respected', 'Little known')} className="w-full" />
        </Labeled>
        <Labeled label="Financial strength">
          <Select value={finance} onChange={setFinance} options={tierOptions('Rich', 'Average', 'Stretched')} className="w-full" />
        </Labeled>
        <Labeled label="Driver quality">
          <Select value={drivers} onChange={setDrivers} options={tierOptions('Strong line-up', 'Solid', 'Developing')} className="w-full" />
        </Labeled>
        <Labeled label="Competitiveness">
          <Select value={compete} onChange={setCompete} options={tierOptions('Front runners', 'Midfield', 'Backmarkers')} className="w-full" />
        </Labeled>
        <Labeled label="Sort by">
          <Select<SortKey>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'rating', label: 'Team rating' },
              { value: 'projected', label: 'Projected finish' },
              { value: 'cash', label: 'Budget' },
              { value: 'drivers', label: 'Driver quality' },
              { value: 'reputation', label: 'Reputation' },
              { value: 'name', label: 'Name' },
            ]}
            className="w-full"
          />
        </Labeled>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
          {shown.length === 0 && <p className="p-4 text-sm text-apex-muted">No team matches these filters.</p>}
          {shown.map((c) => (
            <button key={c.teamId} onClick={() => onSelect(c.teamId)} className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition', selected === c.teamId ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
              <TeamBadge team={c} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="truncate text-xs text-apex-muted">
                  {c.divisionName} · projected P{c.projected} of {c.fieldSize} · {money(c.cash)}
                </div>
              </div>
              <div className="hidden flex-wrap justify-end gap-1 sm:flex">
                {c.challenges.slice(0, 2).map((id) => (
                  <Badge key={id} className="text-[10px]">
                    {CHALLENGES[id].label}
                  </Badge>
                ))}
              </div>
              <div className="w-10 text-right">
                <div className="num text-lg font-black">{c.rating}</div>
                <div className="text-[9px] uppercase text-apex-dim">rating</div>
              </div>
            </button>
          ))}
        </div>
        {current ? <TeamProfileCard c={current} /> : <div className="flex items-center justify-center rounded-xl border border-dashed border-apex-line p-8 text-sm text-apex-muted">Pick a team to see its full profile.</div>}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition', active ? 'border-apex-red bg-apex-red/15 text-white' : 'border-apex-line text-apex-muted hover:border-apex-line2 hover:text-white')}>
      {label}
    </button>
  );
}

/** The full profile of a team on offer. */
export function TeamProfileCard({ c }: { c: TakeoverCandidate }) {
  const h = c.heritage;
  return (
    <div className="space-y-4 rounded-xl border border-apex-line bg-apex-bg/60 p-4 text-sm">
      <div className="flex items-center gap-3">
        <TeamBadge team={c} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-black uppercase">{c.name}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-apex-muted">
            <Flag code={c.nationality} /> {NATIONALITY_BY_CODE[c.nationality]?.name ?? c.nationality}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-3xl font-black">{c.rating}</div>
          <div className="text-[10px] uppercase text-apex-dim">team rating</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Fact k="Division" v={c.divisionName} />
        <Fact k="Car class" v={c.formulaClass} />
        <Fact k="Projected finish" v={`P${c.projected} of ${c.fieldSize}`} />
        <Fact k="Budget (cash)" v={money(c.cash)} />
        <Fact k="Reputation" v={String(c.reputation)} />
        <Fact k="Staff average" v={c.staffAvg ? String(c.staffAvg) : 'Vacancies'} />
      </div>
      <div className="space-y-1.5">
        <Meter label="Car performance" value={c.carRating} />
        <Meter label="Driver quality" value={c.driverAvg} />
        <Meter label="Facilities" value={c.facilityAvg * 10} text={`avg level ${c.facilityAvg}`} />
      </div>
      <div>
        <div className="label mb-1">Driver line-up</div>
        {c.drivers.map((d) => (
          <div key={d.id} className="flex justify-between text-xs">
            <span>{d.name}</span>
            <span className="text-apex-muted">
              {d.overall} overall · age {d.age}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="label mb-1 flex items-center gap-1">
          <Trophy size={12} className="text-amber-400" /> History
        </div>
        {h ? (
          <p className="text-xs text-apex-muted">
            Founded {h.founded}. {h.titles > 0 ? `${h.titles}× ${h.titlesIn} champions.` : `Best finish P${h.bestFinish} in ${h.bestIn}; no titles yet.`}
            {h.cups > 0 ? ` ${h.cups} domestic cup${h.cups === 1 ? '' : 's'}.` : ''}
          </p>
        ) : (
          <p className="text-xs text-apex-muted">No recorded history.</p>
        )}
      </div>
      <div>
        <div className="label mb-1">Board expectations</div>
        <ul className="space-y-0.5 text-xs text-apex-muted">
          {c.objectives.map((o) => (
            <li key={o}>• {o}</li>
          ))}
        </ul>
      </div>
      {c.challenges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.challenges.map((id) => (
            <Badge key={id} tone="red" title={CHALLENGES[id].description}>
              {CHALLENGES[id].label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-apex-line px-2 py-1">
      <div className="text-[10px] uppercase text-apex-dim">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function Meter({ label, value, text }: { label: string; value: number; text?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-xs">
      <span className="text-apex-muted">{label}</span>
      <RatingBar value={value} showValue={false} />
      <span className="num text-right">{text ?? Math.round(value)}</span>
    </div>
  );
}
