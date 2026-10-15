import { Hammer } from 'lucide-react';
import { useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { playerTeam } from '@/engine/selectors';
import { extendStaff, fireStaff, hireStaffMember, staffBuyoutFee, type StaffOfferResult } from '@/engine/staff/market';
import { STAFF_ROLE_INFO, STAFF_ROLES, staffExpectedSalary, staffName } from '@/engine/staff/staff';
import { academyCapacity, canUpgradeFacility, FACILITY_INFO, FACILITY_KEYS, facilityUpgradeCost, facilityUpgradeWeeks, facilityUpkeep, MAX_FACILITY_LEVEL, scoutingCapacity, startFacilityUpgrade } from '@/engine/team/facilities';
import { engineeringCapacity } from '@/engine/car/rnd';
import type { StaffMember, StaffRole } from '@/engine/types';
import { Flag, TeamLink } from '@/components/common';
import { Badge, Button, cn, Empty, Field, Modal, Panel, Progress, RatingPill, SectionTitle, Segmented, Tabs } from '@/components/ui';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';

export function StaffPage() {
  const [tab, setTab] = useState<'staff' | 'facilities'>('staff');
  return (
    <div className="space-y-5">
      <SectionTitle sub="Build the organisation behind the cars: people and infrastructure.">Staff &amp; Facilities</SectionTitle>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'staff', label: 'Staff' },
          { id: 'facilities', label: 'Headquarters' },
        ]}
      />
      {tab === 'staff' ? <StaffTab /> : <FacilitiesTab />}
    </div>
  );
}

function StaffTab() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const [role, setRole] = useState<StaffRole>('technicalDirector');
  const [hiring, setHiring] = useState<{ staff: StaffMember; mode: 'hire' | 'extend' } | null>(null);
  const [affordable, setAffordable] = useState(true);
  const budgetCap = Math.max(team.cash * 0.25, DIVISIONS[team.division].typicalBudget * 0.06);
  const market = Object.values(game.staff)
    .filter((s) => !s.retired && s.role === role && s.contract?.teamId !== team.id)
    .filter((s) => !affordable || (staffExpectedSalary(s.rating, team.division, s.role) <= budgetCap && (!s.contract || staffBuyoutFee(game, s) <= team.cash * 0.5)))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 25);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STAFF_ROLES.map((r) => {
          const s = team.staff[r] ? game.staff[team.staff[r]!] : null;
          return (
            <button key={r} onClick={() => setRole(r)} className={cn('panel p-4 text-left transition', role === r ? 'border-apex-red shadow-glow' : 'hover:border-apex-line2')}>
              <div className="label">{STAFF_ROLE_INFO[r].label}</div>
              {s ? (
                <>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{staffName(s)}</span>
                    <RatingPill value={s.rating} />
                  </div>
                  <div className="mt-1 text-xs text-apex-muted">
                    {s.specialization} · age {s.age} · {money(s.contract!.salary)}/yr · to S{s.contract!.endSeason}
                    {s.contract!.endSeason <= game.season && <span className="ml-1 text-amber-300">(expiring)</span>}
                  </div>
                </>
              ) : (
                <div className="mt-1 font-semibold text-red-300">Vacant</div>
              )}
              {s && s.history.length > 1 && (
                <div className="mt-1 truncate text-[11px] text-apex-muted">
                  Career: {[...new Set(s.history.map((h) => game.teams[h.teamId]?.shortName ?? '?'))].join(' → ')}
                </div>
              )}
              <div className="mt-2 text-[11px] text-apex-dim">{STAFF_ROLE_INFO[r].effect}</div>
            </button>
          );
        })}
      </div>
      {(() => {
        const s = team.staff[role] ? game.staff[team.staff[role]!] : null;
        if (!s) return null;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-apex-muted">
              {STAFF_ROLE_INFO[role].label}: {staffName(s)}
            </span>
            <Button size="sm" onClick={() => setHiring({ staff: s, mode: 'extend' })}>
              Extend contract
            </Button>
            <Button size="sm" variant="danger" onClick={async () => (await askConfirm(`Dismiss ${staffName(s)}? Severance will be paid.`)) && act((g) => fireStaff(g, team.id, s.id), { success: `${staffName(s)} dismissed.` })}>
              Dismiss
            </Button>
          </div>
        );
      })()}
      <Panel
        title={`${STAFF_ROLE_INFO[role].label} market`}
        actions={
          <Segmented
            size="xs"
            value={affordable ? 'a' : 'all'}
            onChange={(v) => setAffordable(v === 'a')}
            options={[
              { value: 'a', label: 'Within budget' },
              { value: 'all', label: 'Everyone' },
            ]}
          />
        }
      >
        <table className="table-apex">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Rating</th>
              <th>Exp.</th>
              <th>Specialisation</th>
              <th>Current</th>
              <th>Expected salary</th>
              <th>Release fee</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {market.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="flex items-center gap-1.5">
                    <Flag code={s.nationality} /> {staffName(s)}
                  </span>
                </td>
                <td>{s.age}</td>
                <td>
                  <RatingPill value={s.rating} />
                </td>
                <td>{s.experience}</td>
                <td className="text-xs">{s.specialization}</td>
                <td>{s.contract ? <TeamLink team={game.teams[s.contract.teamId]} short /> : <Badge tone="blue">Free</Badge>}</td>
                <td>{money(staffExpectedSalary(s.rating, team.division, s.role))}</td>
                <td className="text-apex-muted">{s.contract ? money(staffBuyoutFee(game, s)) : '—'}</td>
                <td className="text-right">
                  <Button size="xs" variant="outline" onClick={() => setHiring({ staff: s, mode: 'hire' })}>
                    Approach
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {market.length === 0 && <Empty>No candidates available.</Empty>}
      </Panel>
      <StaffOfferModal target={hiring} onClose={() => setHiring(null)} />
    </div>
  );
}

function StaffOfferModal({ target, onClose }: { target: { staff: StaffMember; mode: 'hire' | 'extend' } | null; onClose: () => void }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const expected = target ? staffExpectedSalary(target.staff.rating, team.division, target.staff.role) : 0;
  const [salary, setSalary] = useState(expected);
  const [years, setYears] = useState(2);
  const [result, setResult] = useState<StaffOfferResult | null>(null);
  const [key, setKey] = useState('');
  if (target && key !== target.staff.id + target.mode) {
    setKey(target.staff.id + target.mode);
    setSalary(expected);
    setResult(null);
  }
  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const s = target.staff;
  const submit = () => {
    const r = act((g) => (target.mode === 'hire' ? hireStaffMember(g, team.id, s.id, salary, years) : extendStaff(g, team.id, s.id, salary, years)));
    if (!r) return;
    setResult(r);
    if (r.accepted) {
      useStore.getState().toast('success', r.message);
      onClose();
    }
  };
  return (
    <Modal open={!!target} onClose={onClose} title={target.mode === 'hire' ? `Approach ${staffName(s)}` : `Extend ${staffName(s)}`} width="max-w-lg">
      <div className="space-y-4">
        <div className="text-sm text-apex-muted">
          {STAFF_ROLE_INFO[s.role].label} · rating {s.rating} · {s.specialization} · expected {money(expected)}/season
          {s.contract && target.mode === 'hire' && ` · release fee ${money(staffBuyoutFee(game, s))}`}
        </div>
        <Field label={`Salary: ${money(salary)}`}>
          <input type="range" min={Math.round(expected * 0.5)} max={Math.round(expected * 2.5)} step={Math.max(500, Math.round(expected / 200) * 100)} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label="Years">
          <Segmented value={years} onChange={setYears} options={[1, 2, 3, 4].map((y) => ({ value: y, label: `${y}` }))} />
        </Field>
        {target.mode === 'hire' && team.staff[s.role] && (
          <div className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            This replaces your current {STAFF_ROLE_INFO[s.role].label.toLowerCase()}, {staffName(game.staff[team.staff[s.role]!])}, who will be paid severance.
          </div>
        )}
        {result && !result.accepted && (
          <div className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
            {result.message}
            {result.askingSalary && (
              <Button size="xs" className="ml-2" variant="outline" onClick={() => setSalary(result.askingSalary!)}>
                Use {money(result.askingSalary)}
              </Button>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Make offer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FacilitiesTab() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const team = playerTeam(game);
  const cfg = DIVISIONS[team.division];
  const totalUpkeep = FACILITY_KEYS.reduce((s, k) => s + facilityUpkeep(team.facilities[k].level), 0);
  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-6 p-4 text-sm">
        <span>
          <span className="label">Total upkeep</span> <span className="num ml-2 text-lg font-bold">{money(totalUpkeep)}</span>
          <span className="text-apex-muted"> / season</span>
        </span>
        <span>
          <span className="label">Engineering capacity</span> <span className="num ml-2 text-lg font-bold">{engineeringCapacity(game, team)}</span>
        </span>
        <span>
          <span className="label">Academy places</span> <span className="num ml-2 text-lg font-bold">{academyCapacity(game, team)}</span>
        </span>
        <span>
          <span className="label">Scouting slots</span> <span className="num ml-2 text-lg font-bold">{scoutingCapacity(team)}</span>
        </span>
        <span className="text-xs text-apex-muted">Typical {cfg.name} facilities: level {cfg.facilityRange[0]}–{cfg.facilityRange[1]}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FACILITY_KEYS.map((k) => {
          const f = team.facilities[k];
          const check = canUpgradeFacility(team, k);
          const next = f.level + 1;
          return (
            <div key={k} className="panel flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-base font-bold uppercase leading-tight">{FACILITY_INFO[k].label}</div>
                <span className="num text-2xl font-black text-apex-red">L{f.level}</span>
              </div>
              <div className="mt-2 flex gap-0.5">
                {Array.from({ length: MAX_FACILITY_LEVEL }, (_, i) => (
                  <span key={i} className={cn('h-1.5 flex-1 rounded-sm', i < f.level ? 'bg-apex-red' : 'bg-white/10')} />
                ))}
              </div>
              <p className="mt-3 flex-1 text-xs text-apex-muted">{FACILITY_INFO[k].benefit}</p>
              <div className="mt-3 text-xs text-apex-muted">Upkeep {money(facilityUpkeep(f.level))}/season</div>
              {f.upgrade ? (
                <div className="mt-3">
                  <div className="flex items-center gap-1 text-xs text-amber-300">
                    <Hammer size={12} /> Building level {f.upgrade.targetLevel}: {f.upgrade.weeksRemaining} wk left
                  </div>
                  <Progress value={100 - (f.upgrade.weeksRemaining / facilityUpgradeWeeks(f.upgrade.targetLevel)) * 100} className="mt-1" color="#f59e0b" />
                </div>
              ) : f.level < MAX_FACILITY_LEVEL ? (
                <Button className="mt-3" size="sm" variant={check.ok ? 'primary' : 'secondary'} disabled={!check.ok} title={check.reason} onClick={() => act((g) => startFacilityUpgrade(g, team.id, k), { success: `${FACILITY_INFO[k].label} upgrade started.` })}>
                  Upgrade to L{next}: {money(facilityUpgradeCost(next))} · {facilityUpgradeWeeks(next)} wk
                </Button>
              ) : (
                <Badge tone="gold" className="mt-3 self-start">
                  Maximum level
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
