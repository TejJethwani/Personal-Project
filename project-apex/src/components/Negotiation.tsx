import { useEffect, useMemo, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import { driverName, expectedSalary, overall } from '@/engine/drivers/ratings';
import { negotiationMemory, roleExpectedSalary, type UtilityFactor } from '@/engine/market/negotiation';
import { buyoutQuote, MAX_CONTRACT_YEARS, offerContract, type SigningResult } from '@/engine/market/transfers';
import { playerTeam } from '@/engine/selectors';
import { academyCapacity } from '@/engine/team/facilities';
import type { DriverOffer, DriverRole, DriverStatus } from '@/engine/types';
import { currentAbsWeek } from '@/engine/season/calendar';
import { money } from '@/lib/format';
import { useGame, useStore } from '@/store/gameStore';
import { Badge, Button, cn, Field, Modal, Segmented } from './ui';
import { DriverLink } from './common';

export function NegotiationModal() {
  const target = useStore((s) => s.negotiation);
  const close = useStore((s) => s.openNegotiation);
  return (
    <Modal open={!!target} onClose={() => close(null)} title="Contract Negotiation" width="max-w-3xl">
      {target && <NegotiationBody key={target.driverId + target.mode} driverId={target.driverId} mode={target.mode} />}
    </Modal>
  );
}

function NegotiationBody({ driverId, mode }: { driverId: string; mode: 'sign' | 'extend' | 'academy' | 'promote' }) {
  const game = useGame();
  const act = useStore((s) => s.act);
  const close = useStore((s) => s.openNegotiation);
  const closeProfile = useStore((s) => s.openDriver);
  const team = playerTeam(game);
  const d = game.drivers[driverId];
  const inSeason = game.phase === 'season' || game.phase === 'weekend';
  const expiring = !d.contract || d.contract.endSeason <= game.season;
  const ownTeam = d.contract?.teamId === team.id;
  const initialRole: DriverRole = mode === 'academy' ? 'academy' : mode === 'extend' ? (d.contract?.role ?? 'race') : 'race';
  const [role, setRole] = useState<DriverRole>(initialRole);
  const base = role === 'academy' ? 0 : roleExpectedSalary(game, d, team, role);
  const [salary, setSalary] = useState(Math.round(base));
  const [years, setYears] = useState(d.age <= 22 ? 2 : 2);
  const [signingBonus, setSigningBonus] = useState(0);
  const [winBonus, setWinBonus] = useState(0);
  const [podiumBonus, setPodiumBonus] = useState(0);
  const [status, setStatus] = useState<DriverStatus>(d.contract?.status ?? 'equal');
  const canPreContract = inSeason && expiring && !d.futureContract && role !== 'academy';
  const [startNext, setStartNext] = useState(mode === 'extend' ? inSeason && expiring : canPreContract && !ownTeam && !!d.contract);
  const seatsFull = team.raceDrivers.every((x) => x !== null && x !== d.id);
  const [seat, setSeat] = useState<0 | 1>(team.raceDrivers[0] === null ? 0 : 1);
  const [displace, setDisplace] = useState<'reserve' | 'release'>('reserve');
  const [result, setResult] = useState<SigningResult | null>(null);
  useEffect(() => {
    setSalary(Math.round(role === 'academy' ? 0 : roleExpectedSalary(game, d, team, role)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const memory = negotiationMemory(game, team.id, d.id);
  const blocked = memory.blockedUntil > currentAbsWeek(game);
  const quote = !ownTeam && d.contract && !startNext && !(d.contract.endSeason < game.season) ? buyoutQuote(game, team, d) : null;
  const needSeat = role === 'race' && !startNext && !(ownTeam && d.contract?.role === 'race') && seatsFull;
  const needReserveSlot = role === 'reserve' && !startNext && team.reserveDriverId !== null && team.reserveDriverId !== d.id;
  const offer: DriverOffer = useMemo(
    () => ({ driverId: d.id, role, salary: Math.max(0, Math.round(salary)), years, signingBonus, winBonus, podiumBonus, status, startNextSeason: startNext && role !== 'academy', seatIndex: role === 'race' && !startNext ? seat : undefined }),
    [d.id, role, salary, years, signingBonus, winBonus, podiumBonus, status, startNext, seat],
  );
  const annual = offer.salary + offer.signingBonus / Math.max(1, offer.years);

  const submit = () => {
    const r = act((g) => offerContract(g, team.id, offer, { displace: needSeat || needReserveSlot ? displace : undefined }));
    if (!r) return;
    setResult(r);
    if (r.signed) {
      useStore.getState().toast('success', `${driverName(d)} signed! ${offer.startNextSeason ? '(from next season)' : ''}`);
      close(null);
      closeProfile(null);
    }
  };

  const roleOptions: { value: DriverRole; label: string }[] =
    mode === 'academy'
      ? [{ value: 'academy', label: 'Academy' }]
      : [
          { value: 'race', label: 'Race seat' },
          { value: 'reserve', label: 'Reserve' },
        ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-apex-line bg-apex-bg/60 p-4">
        <div>
          <DriverLink driver={d} className="font-display text-xl font-bold uppercase" />
          <div className="mt-1 text-xs text-apex-muted">
            Age {d.age} · {d.contract ? `${game.teams[d.contract.teamId].name} until S${d.contract.endSeason} (${money(d.contract.salary)}/yr)` : 'Free agent'}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="label">Market expectation</div>
          <div className="num text-xl font-bold">{role === 'academy' ? 'Funded place' : `${money(base)}/season`}</div>
          {role !== 'academy' && <div className="text-[11px] text-apex-muted">Base for {DIVISIONS[team.division].name} · overall {overall(d)}</div>}
        </div>
      </div>

      {blocked && <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{memory.lastResponse}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          <Segmented options={roleOptions} value={role} onChange={setRole} />
        </Field>
        {role === 'race' && (
          <Field label="Driver status">
            <Segmented
              options={[
                { value: 'number1', label: 'No. 1' },
                { value: 'equal', label: 'Equal' },
                { value: 'number2', label: 'No. 2' },
              ]}
              value={status}
              onChange={setStatus}
            />
          </Field>
        )}
        {role !== 'academy' && (
          <Field label={`Salary per season: ${money(salary)}`} hint={`Expectation ${money(base)}. Annual package incl. signing bonus: ${money(annual)}`}>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={Math.max(base * 4, 20_000)} step={Math.max(500, Math.round(base / 100 / 500) * 500)} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="flex-1" />
              <input type="number" className="input w-32" value={salary} min={0} onChange={(e) => setSalary(Number(e.target.value))} />
            </div>
          </Field>
        )}
        <Field label="Contract length">
          <Segmented options={Array.from({ length: role === 'academy' ? 3 : MAX_CONTRACT_YEARS }, (_, i) => ({ value: i + 1, label: `${i + 1} yr` }))} value={years} onChange={setYears} />
        </Field>
        {role !== 'academy' && (
          <>
            <Field label="Signing bonus (paid now)">
              <input type="number" className="input w-full" min={0} value={signingBonus} onChange={(e) => setSigningBonus(Math.max(0, Number(e.target.value)))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win bonus">
                <input type="number" className="input w-full" min={0} value={winBonus} onChange={(e) => setWinBonus(Math.max(0, Number(e.target.value)))} />
              </Field>
              <Field label="Podium bonus">
                <input type="number" className="input w-full" min={0} value={podiumBonus} onChange={(e) => setPodiumBonus(Math.max(0, Number(e.target.value)))} />
              </Field>
            </div>
          </>
        )}
        {role !== 'academy' && inSeason && (
          <Field label="Start" hint={!canPreContract && !ownTeam ? 'Pre-contracts are only possible for drivers out of contract at season end.' : undefined}>
            <Segmented
              options={[
                { value: 'now', label: 'Immediately', disabled: false },
                { value: 'next', label: 'Next season', disabled: !canPreContract && !(ownTeam && expiring) },
              ]}
              value={startNext ? 'next' : 'now'}
              onChange={(v) => setStartNext(v === 'next')}
            />
          </Field>
        )}
        {(needSeat || needReserveSlot) && (
          <Field label={needSeat ? 'Seat to fill' : 'Reserve seat is occupied'}>
            <div className="space-y-2">
              {needSeat && (
                <Segmented
                  options={[0, 1].map((i) => ({ value: i as 0 | 1, label: `Replace ${team.raceDrivers[i] ? game.drivers[team.raceDrivers[i]!].lastName : 'empty'}` }))}
                  value={seat}
                  onChange={setSeat}
                />
              )}
              <Segmented
                options={[
                  { value: 'reserve', label: 'Move to reserve', disabled: needReserveSlot || team.reserveDriverId !== null },
                  { value: 'release', label: 'Release (severance)' },
                ]}
                value={displace}
                onChange={setDisplace}
              />
            </div>
          </Field>
        )}
        {role === 'academy' && (
          <div className="text-sm text-apex-muted">
            Academy places used: {team.academyDriverIds.length}/{academyCapacity(game, team)}. Cost {money(DIVISIONS[team.division].academyCostPerDriver)} per season.
          </div>
        )}
      </div>

      {quote && (
        <div className={cn('rounded-md border p-3 text-sm', quote.willing ? 'border-amber-600/40 bg-amber-500/10 text-amber-100' : 'border-red-900 bg-red-950/40 text-red-200')}>
          {quote.willing ? `Buyout required: ${money(quote.fee)} to ${game.teams[d.contract!.teamId].name}. ${quote.reason}` : quote.reason}
        </div>
      )}

      {result && !result.signed && (
        <div className={cn('rounded-lg border p-4', result.response === 'counter' ? 'border-amber-600/40 bg-amber-500/[0.08]' : 'border-red-900/70 bg-red-950/30')}>
          <div className="flex items-center gap-2">
            <Badge tone={result.response === 'counter' ? 'amber' : 'red'}>{result.response === 'counter' ? 'Counter-offer' : result.response === 'refuseTalks' ? 'Talks off' : 'Rejected'}</Badge>
            <span className="text-sm">{result.message}</span>
          </div>
          {result.counter && (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => {
                setSalary(result.counter!.salary);
                if (result.counter!.status) setStatus(result.counter!.status);
              }}
            >
              Use their terms ({money(result.counter.salary)}{result.counter.status ? `, ${result.counter.status} status` : ''})
            </Button>
          )}
          {result.factors.length > 0 && <FactorList factors={result.factors} />}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-apex-line pt-4">
        <div className="text-xs text-apex-muted">
          {memory.attempts > 0 && !blocked ? `Failed approaches: ${memory.attempts}. Too many lowball offers end the talks.` : 'Drivers weigh salary, team level, competitiveness, role, contract length and development.'}
          {d.contract && !ownTeam && d.contract.role !== 'academy' && <div>Current deal: {money(d.contract.salary)} per season.</div>}
          {role !== 'academy' && <div>Your cash: {money(team.cash)} · expected for this division: {money(expectedSalary(d, team.division))}</div>}
        </div>
        <Button variant="primary" size="lg" disabled={blocked} onClick={submit}>
          Submit offer
        </Button>
      </div>
    </div>
  );
}

function FactorList({ factors }: { factors: UtilityFactor[] }) {
  const sorted = [...factors].filter((f) => Math.abs(f.value) > 0.02).sort((a, b) => a.value - b.value);
  return (
    <div className="mt-3">
      <div className="label mb-1.5">What matters to them</div>
      <div className="space-y-1">
        {sorted.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-xs">
            <span className="w-44 truncate text-apex-muted">{f.label}</span>
            <div className="relative h-2 flex-1 rounded bg-white/5">
              <div className="absolute top-0 h-2 rounded" style={{ left: f.value < 0 ? `${50 + Math.max(-50, f.value * 25)}%` : '50%', width: `${Math.min(50, Math.abs(f.value) * 25)}%`, background: f.value < 0 ? '#ef4444' : '#22c55e' }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
            </div>
            <span className={cn('w-10 text-right', f.value < 0 ? 'text-red-300' : 'text-emerald-300')}>{f.value > 0 ? '+' : ''}{f.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
