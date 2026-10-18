import { Wand2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { carRating, COMPONENT_INFO, COMPONENT_KEYS, PACE_COMPONENTS } from '@/engine/car/car';
import { canStartCustomUpgrade, capacityUsed, componentInDevelopment, CUSTOM_DELIVERIES, customSummary, engineeringCapacity, maxAffordableCustomAmount, quoteCustomUpgrade, startCustomUpgrade } from '@/engine/car/rnd';
import { ECONOMY_TUNING } from '@/engine/config/tuning';
import type { ComponentKey, CustomDelivery, GameState, Team } from '@/engine/types';
import { Button, cn, Panel, Progress, Segmented, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import { useStore } from '@/store/gameStore';

type Mode = 'add' | 'target';

const PRESETS = [1, 2, 5, 10, 20];
const MAX_GAIN = ECONOMY_TUNING.rndCustom.maxGain;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Names short enough for the component picker. */
const CHIP_LABEL: Record<ComponentKey, string> = {
  aerodynamics: 'Aero',
  chassis: 'Chassis',
  powerUnit: 'Power unit',
  braking: 'Brakes',
  suspension: 'Suspension',
  cooling: 'Cooling',
  reliability: 'Reliability',
  tireEfficiency: 'Tyres',
  straightLine: 'Top speed',
  cornering: 'Cornering',
};

/**
 * Upgrade any set of components by an amount of your choosing in one project:
 * the same points on each, or every component up to a target rating.
 */
export function CustomUpgradePanel({ game, team, switcher }: { game: GameState; team: Team; switcher: ReactNode }) {
  const act = useStore((s) => s.act);
  const [selected, setSelected] = useState<ComponentKey[]>(COMPONENT_KEYS);
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState(2);
  const [target, setTarget] = useState(() => Math.min(99, Math.ceil(carRating(team.car)) + 3));
  const [delivery, setDelivery] = useState<CustomDelivery>('standard');
  const ratings = team.car.components;
  const requested = Object.fromEntries(selected.map((k) => [k, mode === 'add' ? amount : Math.max(0, target - ratings[k])])) as Partial<Record<ComponentKey, number>>;
  const check = canStartCustomUpgrade(game, team, requested, delivery);
  const q = check.quote;
  const standardWeeks = quoteCustomUpgrade(game, team, requested, 'standard').weeks;
  const cap = engineeringCapacity(game, team);
  const used = capacityUsed(team);
  const toggle = (k: ComponentKey) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : COMPONENT_KEYS.filter((x) => x === k || s.includes(x))));
  const weakest = [...COMPONENT_KEYS].sort((a, b) => ratings[a] - ratings[b]).slice(0, 3);
  const quick: { label: string; keys: ComponentKey[] }[] = [
    { label: 'Whole car', keys: COMPONENT_KEYS },
    { label: 'Pace parts', keys: PACE_COMPONENTS },
    { label: 'Weakest 3', keys: weakest },
    { label: 'None', keys: [] },
  ];

  return (
    <Panel title="Upgrade the car" icon={<Wand2 size={15} className="text-apex-red" />} actions={<span className="text-xs text-apex-muted">Capacity {used}/{cap}</span>}>
      {switcher}
      <Progress value={(used / cap) * 100} className="mb-4" />
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="label">1. Components ({selected.length})</div>
            <div className="flex flex-wrap gap-1">
              {quick.map((o) => (
                <Button key={o.label} size="xs" variant="ghost" onClick={() => setSelected(o.keys)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COMPONENT_KEYS.map((k) => {
              const on = selected.includes(k);
              const busy = componentInDevelopment(team, k);
              const gain = q.gains[k] ?? 0;
              return (
                <button
                  key={k}
                  onClick={() => toggle(k)}
                  aria-pressed={on}
                  title={busy ? `${COMPONENT_INFO[k].label} is already being developed` : `${COMPONENT_INFO[k].label}: ${COMPONENT_INFO[k].effect}`}
                  className={cn('rounded-lg border px-2 py-1.5 text-left transition-colors', on ? 'border-apex-red bg-apex-red/10' : 'border-apex-line bg-apex-bg/40 hover:border-apex-line2', busy && 'opacity-50')}
                >
                  <div className="truncate text-[11px] font-semibold text-apex-muted">{CHIP_LABEL[k]}</div>
                  <div className="num text-sm font-bold">
                    {ratings[k].toFixed(1)}
                    {on && gain > 0 && <span className="text-emerald-400"> → {(ratings[k] + gain).toFixed(1)}</span>}
                    {busy && <span className="ml-1 text-[10px] font-normal text-amber-300">in dev</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="label">2. How much</div>
            <Segmented
              size="xs"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'add', label: 'Add to each' },
                { value: 'target', label: 'Raise to a rating' },
              ]}
            />
          </div>
          {mode === 'add' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented size="xs" value={amount} onChange={setAmount} options={PRESETS.map((p) => ({ value: p, label: `+${p}` }))} />
                <input type="number" className="input w-24" min={0.5} max={MAX_GAIN} step={0.5} value={amount} onChange={(e) => setAmount(round1(Math.min(MAX_GAIN, Math.max(0, Number(e.target.value) || 0))))} aria-label="Points to add to each component" />
                <Button size="xs" variant="secondary" disabled={!selected.length} onClick={() => setAmount(maxAffordableCustomAmount(game, team, selected, delivery))}>
                  Max affordable
                </Button>
              </div>
              <input type="range" className="w-full" min={0.5} max={MAX_GAIN} step={0.5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Points to add" />
              <div className="text-[11px] text-apex-muted">
                Adds +{amount.toFixed(1)} to every selected component (up to +{MAX_GAIN} per project, never above 99).
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Bring every selected component up to</span>
                <input type="number" className="input w-24" min={1} max={99} step={1} value={target} onChange={(e) => setTarget(Math.min(99, Math.max(1, Math.round(Number(e.target.value) || 1))))} aria-label="Target rating" />
              </div>
              <input type="range" className="w-full" min={Math.floor(Math.min(...COMPONENT_KEYS.map((k) => ratings[k])))} max={99} step={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Target rating slider" />
              <div className="text-[11px] text-apex-muted">
                Components already at or above {target} are left alone; each gains at most +{MAX_GAIN} per project.
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="label mb-1.5">3. Delivery</div>
          <Segmented
            fill
            value={delivery}
            onChange={setDelivery}
            options={CUSTOM_DELIVERIES.map((d) => ({ value: d, label: d === 'express' ? `Express · 1 wk · +${Math.round((ECONOMY_TUNING.rndCustom.expressCost - 1) * 100)}%` : `Standard · ${standardWeeks} wk` }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-apex-line bg-apex-bg/50 p-4 sm:grid-cols-4">
          <Stat label="Cost" value={money(q.cost)} sub={team.cash < q.cost ? `you have ${money(team.cash)}` : undefined} />
          <Stat label="Delivery" value={`${q.weeks} wk`} sub={q.weeks === 1 ? 'fitted next week' : `fitted in ${q.weeks} weeks`} />
          <Stat label="New rating" value={q.ratingAfter.toFixed(1)} sub={`now ${carRating(team.car).toFixed(1)}`} accent />
          <Stat label="Points" value={`+${q.totalPoints.toFixed(1)}`} sub={`${Object.keys(q.gains).length} components`} />
        </div>
        <p className="text-xs text-apex-muted">
          A custom upgrade is built to specification: no delays and no surprises, delivered exactly. It costs what the same points would as a run of minor updates, plus 5% for the certainty, so strong components, a lead over the field and heavy development this season all cost more per point. It uses one engineering slot.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-amber-300">{!check.ok && check.reason}</span>
          <Button variant="primary" disabled={!check.ok} onClick={() => act((g) => startCustomUpgrade(g, team.id, requested, delivery), { success: `Custom upgrade ordered: ${customSummary(q.gains)}.` })}>
            Order upgrade ({money(q.cost)})
          </Button>
        </div>
      </div>
    </Panel>
  );
}
