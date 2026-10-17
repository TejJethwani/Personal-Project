import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Check, Flag as FlagIcon, Globe2, Hammer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { previewTakeoverWorld, takeoverCandidates } from '@/engine/career/takeover';
import { DIFFICULTIES, FINANCIAL_STARTS, PHILOSOPHIES } from '@/engine/config/difficulty';
import { customPointsProblem, DIVISIONS, expandedTable, pointsTable, POINTS_PRESETS } from '@/engine/config/divisions';
import { NATIONALITIES } from '@/engine/data/names';
import { divisionForLevel, europeanDivisionConfigs } from '@/engine/config/ruleset';
import { ASSOCIATIONS, ASSOCIATION_BY_ID } from '@/engine/europe/data';
import { berthsForRank } from '@/engine/europe/continental';
import { BOOST_PRESETS, cashBoostProblem, MAX_CASH_BOOST } from '@/engine/finance/boost';
import type { Difficulty, FinancialStart, LiveryPattern, NewCareerConfig, Philosophy, PointsChoice } from '@/engine/types';
import { CarLivery, TeamBadge } from '@/components/common';
import { PointsEditor, PointsTablePreview } from '@/components/PointsEditor';
import { Badge, Button, cn, Field, Toggle } from '@/components/ui';
import { money } from '@/lib/format';
import { useStore } from '@/store/gameStore';
import { TakeoverBrowser, TeamProfileCard } from './newcareer/TakeoverBrowser';

const SWATCHES = ['#e10600', '#ff6b00', '#f5c542', '#22c55e', '#00a19c', '#0ea5e9', '#2563eb', '#6d28d9', '#db2777', '#f8fafc', '#94a3b8', '#111827'];
const LIVERIES: { id: LiveryPattern; label: string }[] = [
  { id: 'solid', label: 'Classic' },
  { id: 'stripe', label: 'Racing Stripe' },
  { id: 'split', label: 'Split' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'halo', label: 'Halo' },
  { id: 'fade', label: 'Fade' },
];

const STEPS = ['Mode', 'Start', 'Team', 'Manager & money', 'Championship', 'Review'];

function placesText(rank: number): string {
  const b = berthsForRank(rank);
  const count = (comp: string, direct?: boolean) => b.filter((x) => x.comp === comp && (direct === undefined || x.direct === direct)).length;
  return (['CL', 'EL', 'ECL'] as const)
    .map((c) => {
      const n = count(c);
      if (!n) return null;
      const q = count(c, false);
      return `${c} ${n}${q ? ` (${q} via qualifying)` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function NewCareer() {
  const setScreen = useStore((s) => s.setScreen);
  const newGame = useStore((s) => s.newGame);
  const toast = useStore((s) => s.toast);
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<NewCareerConfig>({
    teamName: 'Apex Racing',
    shortName: 'APX',
    nationality: 'GBR',
    primaryColor: '#e10600',
    secondaryColor: '#f8fafc',
    livery: 'arrow',
    principalName: '',
    philosophy: 'balanced',
    difficulty: 'standard',
    financialStart: 'modest',
  });
  const [mode, setMode] = useState<'classic' | 'european'>('classic');
  const [assocId, setAssocId] = useState('ENG');
  const [start, setStart] = useState<'create' | 'takeover'>('create');
  const [seed, setSeed] = useState<number>(randomSeed);
  const [seedText, setSeedText] = useState('');
  const [takeoverId, setTakeoverId] = useState<string | null>(null);
  const [boostPreset, setBoostPreset] = useState<string>('none');
  const [customBoost, setCustomBoost] = useState('0');
  const [sandbox, setSandbox] = useState(false);
  const [points, setPoints] = useState<PointsChoice>('default');
  const [customTable, setCustomTable] = useState<number[]>([...POINTS_PRESETS.modern.positions]);
  const set = <K extends keyof NewCareerConfig>(k: K, v: NewCareerConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const european = mode === 'european';
  const assoc = ASSOCIATION_BY_ID[assocId];
  const worldSeed = start === 'takeover' ? seed : seedText.trim() ? Number.parseInt(seedText.trim(), 10) : undefined;
  const pointsChoice: PointsChoice = european && points === 'default' ? 'expanded' : points;

  // Takeover: the exact world the career will start in.
  const preview = useMemo(() => (start === 'takeover' && step >= 2 ? previewTakeoverWorld({ ...cfg, seed, ...(european ? { european: { assocId } } : {}) }) : null), [start, step >= 2, seed, european, assocId]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => (preview ? takeoverCandidates(preview, cfg.philosophy) : []), [preview, cfg.philosophy]);
  const chosen = candidates.find((c) => c.teamId === takeoverId) ?? null;

  // Starting division and money.
  const startLevel = assoc.levels.length;
  const createConfig = european ? europeanDivisionConfigs(assocId)[divisionForLevel(startLevel)] : DIVISIONS.F5;
  const createdCash = createConfig.typicalBudget * 0.42 * FINANCIAL_STARTS[cfg.financialStart].cashFactor * DIFFICULTIES[cfg.difficulty].startingCash;
  const baseCash = start === 'takeover' ? chosen?.cash ?? 0 : createdCash;
  const boost = boostPreset === 'custom' ? Number(customBoost) * 1_000_000 : BOOST_PRESETS.find((b) => b.id === boostPreset)?.amount ?? 0;
  const boostProblem = boostPreset === 'custom' ? cashBoostProblem(boost) : null;
  const gridCars = start === 'takeover' ? (chosen?.fieldSize ?? 10) * 2 : european ? assoc.levels[startLevel - 1].teams * 2 : 20;
  const divisionName = start === 'takeover' ? chosen?.divisionName ?? '—' : createConfig.name;
  const customProblem = pointsChoice === 'custom' ? customPointsProblem(customTable) : null;

  const stepValid = (i: number): string | null => {
    if (i === 2 && start === 'create' && (cfg.teamName.trim().length < 3 || cfg.shortName.trim().length < 2)) return 'Give the team a name (3+ letters) and an abbreviation (2+).';
    if (i === 2 && start === 'takeover' && !chosen) return 'Choose the team you will take over.';
    if (i === 3 && cfg.principalName.trim().length < 2) return 'Enter your name as Team Principal.';
    if (i === 3 && boostProblem) return boostProblem;
    if (i === 4 && customProblem) return customProblem;
    return null;
  };
  const blocker = [0, 1, 2, 3, 4].map(stepValid).find(Boolean) ?? null;

  const launch = () => {
    const seedNum = worldSeed !== undefined && Number.isFinite(worldSeed) ? worldSeed : undefined;
    try {
      newGame({
        ...cfg,
        seed: seedNum,
        ...(european ? { european: { assocId } } : {}),
        ...(start === 'takeover' && chosen ? { takeover: { teamId: chosen.teamId } } : {}),
        points: pointsChoice === 'custom' ? { system: 'custom', custom: customTable } : { system: pointsChoice },
        cashBoost: boost,
        sandboxMoney: sandbox,
      });
    } catch (e) {
      toast('error', e instanceof Error ? e.message : String(e));
    }
  };

  const next = () => {
    const problem = stepValid(step);
    if (problem) return toast('error', problem);
    if (step === 0 && european && points === 'default') setPoints('expanded');
    if (step === 0 && !european && points === 'expanded') setPoints('default');
    setStep(step + 1);
  };

  return (
    <div className="min-h-full bg-apex-bg bg-carbon">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="label text-apex-red">New career</div>
            <h1 className="font-display text-4xl font-black uppercase">{start === 'takeover' ? 'Take charge' : 'Create your team'}</h1>
          </div>
          <Button variant="ghost" onClick={() => setScreen('title')}>
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
        <div className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)} className={cn('flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs sm:text-sm', i === step ? 'border-apex-red bg-apex-red/10' : i < step ? 'border-apex-line2 text-white' : 'border-apex-line text-apex-dim')}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', i < step ? 'bg-emerald-600' : i === step ? 'bg-apex-red' : 'bg-apex-line')}>{i < step ? <Check size={13} /> : i + 1}</span>
              <span className="truncate font-display font-semibold uppercase tracking-wider">{s}</span>
            </button>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-4 sm:p-6">
          {step === 0 && (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                <Choice active={!european} onClick={() => setMode('classic')} icon={<FlagIcon size={20} className="text-apex-red" />} title="Classic Career" text="The original ladder: five Formula series of ten teams, one race per round. Climb from Formula 5 to Formula 1." />
                <Choice active={european} tone="sky" onClick={() => setMode('european')} icon={<Globe2 size={20} className="text-sky-400" />} title="European League" text="A national league pyramid of full grids (up to 20 teams, 40 cars), one full race per gameweek, promotion and relegation, domestic cups and the Apex Champions, Europa and Conference Leagues." />
              </div>
              {european && (
                <div>
                  <div className="label mb-2">Country · coefficient ranking</div>
                  <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {ASSOCIATIONS.map((a, i) => (
                      <button key={a.id} onClick={() => setAssocId(a.id)} className={cn('rounded-lg border p-3 text-left text-xs', assocId === a.id ? 'border-sky-400 bg-sky-400/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-bold uppercase">
                            <span className="text-apex-muted">#{i + 1}</span> {a.name}
                          </span>
                          <span className="num text-apex-muted">{a.id}</span>
                        </div>
                        <div className="mt-1 text-apex-muted">
                          {a.levels.length} divisions · {a.levels.map((l) => l.teams).join('/')} clubs
                        </div>
                        <div className="mt-1 text-sky-300">{placesText(i + 1)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              <Choice
                active={start === 'create'}
                onClick={() => setStart('create')}
                icon={<Hammer size={20} className="text-apex-red" />}
                title="Create a team"
                text={`Found a new organisation: choose its name, ${european ? '' : 'nationality, '}colours and livery. You begin in ${european ? `the ${assoc.levels[startLevel - 1].name}` : 'Formula 5'} with two generated drivers, a basic car, four staff and starter facilities.`}
              />
              <Choice
                active={start === 'takeover'}
                onClick={() => {
                  setStart('takeover');
                  setTakeoverId(null);
                }}
                icon={<Building2 size={20} className="text-apex-red" />}
                title="Take over a team"
                text={`Become Team Principal of an existing ${european ? `${assoc.name} club` : 'team'} in any division. You inherit its drivers and contracts, staff, car, facilities, finances, sponsors, reputation and history, and race in its current championship.`}
              />
            </div>
          )}

          {step === 2 && start === 'create' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label="Team name">
                    <input className="input w-full" value={cfg.teamName} maxLength={32} onChange={(e) => set('teamName', e.target.value)} />
                  </Field>
                  <Field label="Abbreviation">
                    <input className="input w-full uppercase" value={cfg.shortName} maxLength={3} onChange={(e) => set('shortName', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                  </Field>
                </div>
                {!european && (
                  <Field label="Team nationality">
                    <select className="input w-full" value={cfg.nationality} onChange={(e) => set('nationality', e.target.value)}>
                      {[...NATIONALITIES].sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
                        <option key={n.code} value={n.code}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {(['primaryColor', 'secondaryColor'] as const).map((k) => (
                  <Field key={k} label={k === 'primaryColor' ? 'Primary colour' : 'Secondary colour'}>
                    <div className="flex flex-wrap items-center gap-2">
                      {SWATCHES.map((c) => (
                        <button key={c} onClick={() => set(k, c)} className={cn('h-7 w-7 rounded-md border-2', cfg[k] === c ? 'border-white' : 'border-transparent')} style={{ background: c }} aria-label={c} />
                      ))}
                      <input type="color" value={cfg[k]} onChange={(e) => set(k, e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-apex-line2 bg-transparent" />
                    </div>
                  </Field>
                ))}
                <Field label="Livery">
                  <div className="grid grid-cols-3 gap-2">
                    {LIVERIES.map((l) => (
                      <button key={l.id} onClick={() => set('livery', l.id)} className={cn('rounded-md border p-2 text-xs font-semibold', cfg.livery === l.id ? 'border-apex-red bg-apex-red/10' : 'border-apex-line hover:border-apex-line2')}>
                        <CarLivery primary={cfg.primaryColor} secondary={cfg.secondaryColor} pattern={l.id} width={120} />
                        {l.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-apex-line bg-apex-bg p-6">
                <CarLivery primary={cfg.primaryColor} secondary={cfg.secondaryColor} pattern={cfg.livery} number={cfg.shortName} width={300} />
                <div className="mt-4 font-display text-2xl font-black uppercase">{cfg.teamName || 'Your team'}</div>
                <div className="text-sm text-apex-muted">{european ? assoc.name : NATIONALITIES.find((n) => n.code === cfg.nationality)?.name}</div>
              </div>
            </div>
          )}

          {step === 2 && start === 'takeover' && (
            <TakeoverBrowser
              candidates={candidates}
              selected={takeoverId}
              onSelect={setTakeoverId}
              seed={seed}
              onReroll={() => {
                setSeed(randomSeed());
                setTakeoverId(null);
              }}
              countryLabel={european ? assoc.name : null}
            />
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Field label="Team principal (you)">
                <input className="input w-full max-w-md" placeholder="Your name" value={cfg.principalName} maxLength={30} onChange={(e) => set('principalName', e.target.value)} />
              </Field>
              <div>
                <div className="label mb-2">Your management philosophy</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {(Object.keys(PHILOSOPHIES) as Philosophy[]).map((p) => {
                    const ph = PHILOSOPHIES[p];
                    return (
                      <button key={p} onClick={() => set('philosophy', p)} className={cn('rounded-lg border p-3 text-left transition', cfg.philosophy === p ? 'border-apex-red bg-apex-red/[0.08] shadow-glow' : 'border-apex-line hover:border-apex-line2')}>
                        <div className="font-display font-bold uppercase">{ph.label}</div>
                        <div className="mt-1 text-xs text-apex-muted">{ph.summary}</div>
                        <div className="mt-2 text-[11px] text-emerald-300">+ {ph.pros.join(' · ')}</div>
                        <div className="text-[11px] text-red-300">− {ph.cons.join(' · ')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="label mb-2">Difficulty</div>
                <div className="grid gap-2 md:grid-cols-4">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                    <button key={d} onClick={() => set('difficulty', d)} className={cn('rounded-lg border p-3 text-left', cfg.difficulty === d ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                      <div className="font-display font-bold uppercase">{DIFFICULTIES[d].label}</div>
                      <div className="mt-1 text-xs text-apex-muted">{DIFFICULTIES[d].description}</div>
                    </button>
                  ))}
                </div>
              </div>
              {start === 'create' && (
                <div>
                  <div className="label mb-2">Financial realism · starting conditions</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {(Object.keys(FINANCIAL_STARTS) as FinancialStart[]).map((f) => (
                      <button key={f} onClick={() => set('financialStart', f)} className={cn('rounded-lg border p-3 text-left', cfg.financialStart === f ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                        <div className="font-display font-bold uppercase">{FINANCIAL_STARTS[f].label}</div>
                        <div className="mt-1 text-xs text-apex-muted">{FINANCIAL_STARTS[f].description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div>
                  <div className="label mb-2">Starting cash boost</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[...BOOST_PRESETS, { id: 'custom', label: 'Custom boost', amount: -1 }].map((b) => (
                      <button key={b.id} onClick={() => setBoostPreset(b.id)} className={cn('rounded-lg border p-3 text-left', boostPreset === b.id ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                        <div className="font-display font-bold uppercase">{b.label}</div>
                        <div className="text-xs text-apex-muted">{b.amount < 0 ? 'Any amount you choose' : b.amount === 0 ? 'Standard starting budget' : `+${money(b.amount)}`}</div>
                      </button>
                    ))}
                  </div>
                  {boostPreset === 'custom' && (
                    <Field label="Custom boost (millions of dollars)" hint={`From 0 to ${MAX_CASH_BOOST / 1_000_000}M.`} className="mt-3">
                      <input className="input w-48" inputMode="decimal" value={customBoost} onChange={(e) => setCustomBoost(e.target.value.replace(/[^0-9.]/g, ''))} />
                    </Field>
                  )}
                  {boostProblem && <p className="mt-2 text-xs text-red-300">{boostProblem}</p>}
                  <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.05] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          Sandbox money <Badge tone="amber">Cheat</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-apex-muted">Unlimited money: the bank is topped up to $1 billion whenever it runs low. Separate from the boost. Achievements are switched off for a sandbox career.</p>
                      </div>
                      <Toggle checked={sandbox} onChange={setSandbox} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-apex-line bg-apex-bg p-4 text-sm">
                  <div className="label">Starting budget</div>
                  <Row k={start === 'takeover' ? 'Inherited team budget' : 'Base team budget'} v={start === 'takeover' && !chosen ? '—' : money(baseCash)} />
                  <Row k="Cash boost" v={boostProblem ? '—' : `+${money(boost)}`} />
                  <Row k="Final starting budget" v={boostProblem || (start === 'takeover' && !chosen) ? '—' : money(baseCash + boost)} strong />
                  <Row k="Difficulty" v={DIFFICULTIES[cfg.difficulty].label} />
                  <Row k="Financial realism" v={start === 'takeover' ? 'Inherited finances' : FINANCIAL_STARTS[cfg.financialStart].label} />
                  {sandbox && <Row k="Sandbox money" v="On (cheat)" />}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <div className="label mb-2">Championship points</div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  {(european ? (['expanded', 'modern', 'custom'] as PointsChoice[]) : (['default', 'modern', 'expanded', 'custom'] as PointsChoice[])).map((p) => (
                    <button key={p} onClick={() => setPoints(p)} className={cn('rounded-lg border p-3 text-left', pointsChoice === p ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                      <div className="font-display font-bold uppercase">{p === 'default' ? 'Series default' : p === 'modern' ? 'Classic F1' : p === 'expanded' ? 'Expanded' : 'Custom'}</div>
                      <div className="mt-1 text-xs text-apex-muted">
                        {p === 'default' && 'Each Formula series keeps its own system (Formula 5: 10-8-6-5-4-3-2-1 … Formula 1: 25-18-15 + fastest lap).'}
                        {p === 'modern' && '25-18-15-12-10-8-6-4-2-1. Only the top ten score.'}
                        {p === 'expanded' && `The top three-quarters score: 50-45-41-38-35… down to 1 (top 30 of a 40-car grid).${european ? ' Recommended for full grids.' : ''}`}
                        {p === 'custom' && 'Set every scoring place yourself.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {pointsChoice === 'custom' ? (
                <PointsEditor value={customTable} onChange={setCustomTable} />
              ) : pointsChoice !== 'default' ? (
                <div>
                  <div className="label mb-2">
                    {divisionName}: {gridCars} cars, {pointsTable(pointsChoice, gridCars).positions.length} scoring places
                  </div>
                  <PointsTablePreview positions={pointsChoice === 'expanded' ? expandedTable(gridCars) : POINTS_PRESETS.modern.positions} />
                </div>
              ) : null}
              <p className="text-xs text-apex-muted">Points apply to every championship of the career. Grids smaller than 40 cars get a shorter Expanded table; no table ever gives points to places that do not exist. You can change the system in Settings later; changes take effect from the next season.</p>
              {start === 'create' && (
                <Field label="World seed (optional)" hint="Use the same seed to generate the same universe again.">
                  <input className="input w-48" inputMode="numeric" placeholder="Random" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))} />
                </Field>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <Row k="Mode" v={european ? `European League · ${assoc.name}` : 'Classic Career'} />
                <Row k="Start" v={start === 'takeover' ? 'Take over an existing team' : 'Create a new team'} />
                <Row k="Team" v={start === 'takeover' ? chosen?.name ?? '—' : `${cfg.teamName} (${cfg.shortName})`} />
                <Row k="Division" v={divisionName} />
                <Row k="Team principal" v={cfg.principalName || '—'} />
                <Row k="Philosophy" v={PHILOSOPHIES[cfg.philosophy].label} />
                <Row k="Difficulty" v={DIFFICULTIES[cfg.difficulty].label} />
                <Row k="Starting budget" v={`${money(baseCash + (boostProblem ? 0 : boost))}${boost > 0 ? ` (incl. +${money(boost)} boost)` : ''}`} />
                {sandbox && <Row k="Sandbox money" v="On (cheat, no achievements)" />}
                <Row k="Points" v={pointsChoice === 'default' ? 'Series default' : pointsChoice === 'modern' ? 'Classic F1 (top 10)' : pointsChoice === 'expanded' ? `Expanded (top ${pointsTable('expanded', gridCars).positions.length} of ${gridCars})` : `Custom (${customTable.length} places)`} />
                <Row k="World seed" v={worldSeed !== undefined ? String(worldSeed) : 'Random'} />
                <div className="rounded-lg border border-apex-line bg-apex-bg p-4 text-apex-muted">
                  {start === 'takeover'
                    ? `You take charge of ${chosen?.name ?? 'the team'} as its new Team Principal. Its contracts, staff, facilities and records carry over; the board expects: ${chosen?.objectives.join('; ') ?? '—'}.`
                    : european
                      ? `You start at the bottom of ${assoc.name}'s pyramid with two contracted drivers, a basic car and four staff. You face ${assoc.levels[startLevel - 1].teams - 1} rival clubs, and ${placesText(ASSOCIATIONS.indexOf(assoc) + 1)} European places wait at the top.`
                      : 'You start at the very bottom: two contracted drivers, a basic car, four staff and a garage-sized headquarters. Nine rival teams stand between you and promotion.'}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-apex-line bg-apex-bg p-6">
                {start === 'takeover' && chosen ? (
                  <TeamProfileCard c={chosen} />
                ) : (
                  <>
                    <TeamBadge team={{ shortName: cfg.shortName || 'APX', colors: { primary: cfg.primaryColor, secondary: cfg.secondaryColor } }} size={56} />
                    <CarLivery primary={cfg.primaryColor} secondary={cfg.secondaryColor} pattern={cfg.livery} number={cfg.shortName} width={320} />
                    <div className="font-display text-3xl font-black uppercase">{cfg.teamName}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> Previous
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next} disabled={!!stepValid(step)}>
              Next <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled={!!blocker} onClick={launch}>
              {start === 'takeover' ? 'Take charge' : 'Launch team'} <ArrowRight size={18} />
            </Button>
          )}
        </div>
        {(stepValid(step) || (step === STEPS.length - 1 && blocker)) && <p className="mt-2 text-right text-xs text-amber-300">{stepValid(step) ?? blocker}</p>}
      </div>
    </div>
  );
}

function Choice({ active, onClick, icon, title, text, tone = 'red' }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string; tone?: 'red' | 'sky' }) {
  return (
    <button onClick={onClick} className={cn('rounded-xl border p-5 text-left transition', active ? (tone === 'sky' ? 'border-sky-400 bg-sky-400/[0.08]' : 'border-apex-red bg-apex-red/[0.08] shadow-glow') : 'border-apex-line hover:border-apex-line2')}>
      <div className="flex items-center gap-2 font-display text-2xl font-black uppercase">
        {icon} {title}
      </div>
      <p className="mt-2 text-sm text-apex-muted">{text}</p>
    </button>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-apex-line pb-2">
      <span className="text-apex-muted">{k}</span>
      <span className={cn('text-right font-semibold', strong && 'text-lg text-white')}>{v}</span>
    </div>
  );
}
