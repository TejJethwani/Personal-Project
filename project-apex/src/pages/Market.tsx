import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { NATIONALITIES } from '@/engine/data/names';
import { driverName, expectedSalary, marketValue, targetDivisionFor } from '@/engine/drivers/ratings';
import { cancelScouting, estimateOverall, estimatePotential, scoutingWeeklyCost, scoutKnowledge, startScouting } from '@/engine/market/scouting';
import { activeDrivers, playerTeam } from '@/engine/selectors';
import { scoutingCapacity } from '@/engine/team/facilities';
import type { DivisionId, Driver } from '@/engine/types';
import { activeDivisions } from '@/engine/config/ruleset';
import { DivisionBadge, DriverLink, TeamLink } from '@/components/common';
import { Badge, Button, Empty, Panel, Progress, RatingPill, SectionTitle, Select, Tabs, Toggle } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';


type Availability = 'any' | 'free' | 'expiring' | 'contracted';
type SortKey = 'rating' | 'potential' | 'age' | 'value' | 'salary';

export function MarketPage() {
  const game = useGame();
  const [tab, setTab] = useState<'drivers' | 'youth' | 'scouting'>('drivers');
  const youthCount = activeDrivers(game).filter((d) => d.age <= 18 && (!d.contract || d.contract.role === 'academy') && d.contract?.teamId !== game.player.teamId).length;
  return (
    <div className="space-y-5">
      <SectionTitle sub="Search the whole driver universe. Ratings of drivers you do not employ are estimates until scouted.">Driver Market</SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'drivers', label: 'All drivers' },
          { id: 'youth', label: 'Youth prospects', count: youthCount },
          { id: 'scouting', label: 'Scouting', count: game.player.scoutAssignments.length },
        ]}
      />
      {tab === 'drivers' && <DriverSearch />}
      {tab === 'youth' && <YouthList />}
      {tab === 'scouting' && <ScoutingPanel />}
    </div>
  );
}

function DriverSearch() {
  const game = useGame();
  const team = playerTeam(game);
  const [q, setQ] = useState('');
  const [division, setDivision] = useState<'any' | DivisionId | 'none'>('any');
  const [availability, setAvailability] = useState<Availability>('any');
  const [nat, setNat] = useState('any');
  const [ageMin, setAgeMin] = useState(16);
  const [ageMax, setAgeMax] = useState(40);
  const [minRating, setMinRating] = useState(0);
  const [minPotential, setMinPotential] = useState(0);
  const [maxSalary, setMaxSalary] = useState(0);
  const [sort, setSort] = useState<SortKey>('rating');
  const [limit, setLimit] = useState(60);
  const [realistic, setRealistic] = useState(true);
  const myTier = DIVISIONS[team.division].tier;

  const rows = useMemo(() => {
    const list = activeDrivers(game)
      .filter((d) => d.contract?.teamId !== team.id && d.contract?.role !== 'academy')
      .map((d) => {
        const t = d.contract ? game.teams[d.contract.teamId] : null;
        return { d, t, ovr: estimateOverall(game, d), pot: estimatePotential(game, d), ask: expectedSalary(d, team.division), value: marketValue(d) };
      })
      .filter(({ d, t, ovr, pot, ask }) => {
        if (q && !driverName(d).toLowerCase().includes(q.toLowerCase())) return false;
        if (division === 'none' && t) return false;
        if (division !== 'any' && division !== 'none' && t?.division !== division) return false;
        if (availability === 'free' && d.contract) return false;
        if (availability === 'expiring' && !(d.contract && d.contract.endSeason <= game.season && !d.futureContract)) return false;
        if (availability === 'contracted' && !d.contract) return false;
        if (nat !== 'any' && d.nationality !== nat) return false;
        if (d.age < ageMin || d.age > ageMax) return false;
        if (ovr.value < minRating || pot.value < minPotential) return false;
        if (maxSalary > 0 && ask > maxSalary) return false;
        if (realistic && DIVISIONS[targetDivisionFor(ovr.value)].tier > myTier + 1) return false;
        return true;
      });
    list.sort((a, b) => {
      switch (sort) {
        case 'potential':
          return b.pot.value - a.pot.value;
        case 'age':
          return a.d.age - b.d.age;
        case 'value':
          return b.value - a.value;
        case 'salary':
          return a.ask - b.ask;
        default:
          return b.ovr.value - a.ovr.value;
      }
    });
    return list;
  }, [game, team, q, division, availability, nat, ageMin, ageMax, minRating, minPotential, maxSalary, sort, realistic, myTier]);

  return (
    <div className="space-y-4">
      <div className="panel grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-8">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-2.5 text-apex-muted" />
          <input className="input w-full pl-8" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={division} onChange={setDivision} options={[{ value: 'any', label: 'All series' }, { value: 'none', label: 'Unattached' }, ...activeDivisions(game).map((d) => ({ value: d, label: DIVISIONS[d].name }))]} />
        <Select<Availability> value={availability} onChange={setAvailability} options={[{ value: 'any', label: 'Any status' }, { value: 'free', label: 'Free agents' }, { value: 'expiring', label: 'Expiring contracts' }, { value: 'contracted', label: 'Under contract' }]} />
        <Select value={nat} onChange={setNat} options={[{ value: 'any', label: 'Any nationality' }, ...[...NATIONALITIES].sort((a, b) => a.name.localeCompare(b.name)).map((n) => ({ value: n.code, label: n.name }))]} />
        <Select<SortKey> value={sort} onChange={setSort} options={[{ value: 'rating', label: 'Sort: rating' }, { value: 'potential', label: 'Sort: potential' }, { value: 'age', label: 'Sort: youngest' }, { value: 'value', label: 'Sort: value' }, { value: 'salary', label: 'Sort: cheapest' }]} />
        <div className="flex items-center gap-1 text-xs text-apex-muted">
          Age
          <input type="number" className="input w-14 px-1.5" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} />–
          <input type="number" className="input w-14 px-1.5" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-1 text-xs text-apex-muted">
          Min OVR <input type="number" className="input w-14 px-1.5" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-1 text-xs text-apex-muted">
          Min POT <input type="number" className="input w-14 px-1.5" value={minPotential} onChange={(e) => setMinPotential(Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-1 text-xs text-apex-muted md:col-span-2">
          Max salary
          <input type="number" className="input w-28 px-1.5" step={5000} value={maxSalary} onChange={(e) => setMaxSalary(Number(e.target.value))} />
          <span>{maxSalary > 0 ? money(maxSalary) : 'any'}</span>
        </div>
        <div className="flex items-center md:col-span-2">
          <Toggle checked={realistic} onChange={setRealistic} label={<span className="text-xs">Realistic targets only (at most one division above you)</span>} />
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="table-apex">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Age</th>
              <th>Team</th>
              <th>Series</th>
              <th>Rating</th>
              <th>Potential</th>
              <th>Value</th>
              <th>Asks ({team.division})</th>
              <th>Contract</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(({ d, t, ovr, pot, ask, value }) => (
              <MarketRow key={d.id} d={d} t={t} ovr={ovr} pot={pot} ask={ask} value={value} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty className="m-4">No drivers match these filters.</Empty>}
        {rows.length > limit && (
          <div className="p-3 text-center">
            <Button size="sm" onClick={() => setLimit(limit + 60)}>
              Show more ({rows.length - limit} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function MarketRow({ d, t, ovr, pot, ask, value }: { d: Driver; t: ReturnType<typeof playerTeam> | null; ovr: ReturnType<typeof estimateOverall>; pot: ReturnType<typeof estimatePotential>; ask: number; value: number }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const openNegotiation = useStore((s) => s.openNegotiation);
  const scouting = game.player.scoutAssignments.find((a) => a.targetId === d.id);
  const knowledge = scoutKnowledge(game, d);
  const expiring = d.contract && d.contract.endSeason <= game.season;
  return (
    <tr>
      <td>
        <DriverLink driver={d} />
      </td>
      <td>{d.age}</td>
      <td>{t ? <TeamLink team={t} short /> : <Badge tone="blue">Free</Badge>}</td>
      <td>{t ? <DivisionBadge division={t.division} /> : '—'}</td>
      <td>
        <RatingPill value={ovr.value} estimate={ovr} />
      </td>
      <td>
        <RatingPill value={pot.value} estimate={pot} />
      </td>
      <td className="text-apex-muted">{money(value)}</td>
      <td>{money(ask)}</td>
      <td className="text-xs">
        {d.contract ? <span className={expiring ? 'text-amber-300' : 'text-apex-muted'}>S{d.contract.endSeason}{d.futureContract ? ' · signed' : ''}</span> : <span className="text-apex-muted">{d.futureContract ? 'signed' : '—'}</span>}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-1">
          {knowledge < 100 && (
            <Button size="xs" variant="ghost" disabled={!!scouting} onClick={() => act((g) => startScouting(g, d.id), { success: `Scouting ${d.lastName}.` })} title="Send a scout">
              {scouting ? `${scouting.weeksRemaining}w` : 'Scout'}
            </Button>
          )}
          <Button size="xs" variant="outline" disabled={!!d.futureContract} onClick={() => openNegotiation({ driverId: d.id, mode: 'sign' })}>
            Offer
          </Button>
        </div>
      </td>
    </tr>
  );
}

function YouthList() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const openNegotiation = useStore((s) => s.openNegotiation);
  const team = playerTeam(game);
  const prospects = activeDrivers(game)
    .filter((d) => d.age <= 18 && (!d.contract || d.contract.role === 'academy') && d.contract?.teamId !== team.id)
    .map((d) => ({ d, ovr: estimateOverall(game, d), pot: estimatePotential(game, d), k: scoutKnowledge(game, d) }))
    .sort((a, b) => b.pot.value - a.pot.value);
  return (
    <div className="panel overflow-x-auto">
      <div className="border-b border-apex-line px-4 py-3 text-sm text-apex-muted">
        Young prospects develop in your academy. Their potential is hidden until scouted: invest scouting time before committing. Trialists recommended by your academy director are already well known.
      </div>
      <table className="table-apex">
        <thead>
          <tr>
            <th>Prospect</th>
            <th>Age</th>
            <th>Status</th>
            <th>Rating</th>
            <th>Potential</th>
            <th>Knowledge</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {prospects.map(({ d, ovr, pot, k }) => {
            const scouting = game.player.scoutAssignments.find((a) => a.targetId === d.id);
            return (
              <tr key={d.id}>
                <td>
                  <DriverLink driver={d} />
                </td>
                <td>{d.age}</td>
                <td>{d.contract ? <TeamLink team={game.teams[d.contract.teamId]} short /> : <Badge tone="blue">Unsigned</Badge>}</td>
                <td>
                  <RatingPill value={ovr.value} estimate={ovr} />
                </td>
                <td>
                  <RatingPill value={pot.value} estimate={pot} />
                </td>
                <td className="w-32">
                  <Progress value={k} color="#3b82f6" />
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    {k < 100 && (
                      <Button size="xs" variant="ghost" disabled={!!scouting} onClick={() => act((g) => startScouting(g, d.id))}>
                        {scouting ? `${scouting.weeksRemaining}w` : 'Scout'}
                      </Button>
                    )}
                    <Button size="xs" variant="outline" disabled={!!d.contract} onClick={() => openNegotiation({ driverId: d.id, mode: 'academy' })}>
                      Academy offer
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoutingPanel() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const cap = scoutingCapacity(team);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Panel title={`Active assignments (${game.player.scoutAssignments.length}/${cap})`}>
        {game.player.scoutAssignments.length === 0 ? (
          <Empty>No scouts deployed. Use the Scout button next to any driver.</Empty>
        ) : (
          <div className="space-y-3">
            {game.player.scoutAssignments.map((a) => {
              const d = game.drivers[a.targetId];
              return (
                <div key={a.targetId} className="flex items-center gap-4 rounded-md border border-apex-line p-3">
                  <DriverLink driver={d} className="w-48" />
                  <Progress value={((a.weeksTotal - a.weeksRemaining) / a.weeksTotal) * 100} className="flex-1" />
                  <span className="text-xs text-apex-muted">{a.weeksRemaining} wk left</span>
                  <Button size="xs" variant="ghost" onClick={() => act((g) => cancelScouting(g, a.targetId))}>
                    Cancel
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel title="Scouting department">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-apex-muted">Facility level</span>
            <span>L{team.facilities.scouting.level}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-apex-muted">Capacity</span>
            <span>{cap} at once</span>
          </div>
          <div className="flex justify-between">
            <span className="text-apex-muted">Cost</span>
            <span>{money(scoutingWeeklyCost(game))} / assignment / week</span>
          </div>
          <p className="pt-2 text-xs text-apex-muted">Upgrade the Scouting Department and hire a better Head Scout for faster, more accurate reports.</p>
        </div>
      </Panel>
    </div>
  );
}
