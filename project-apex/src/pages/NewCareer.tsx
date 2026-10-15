import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTIES, FINANCIAL_STARTS, PHILOSOPHIES } from '@/engine/config/difficulty';
import { DIVISIONS } from '@/engine/config/divisions';
import { NATIONALITIES } from '@/engine/data/names';
import type { Difficulty, FinancialStart, LiveryPattern, NewCareerConfig, Philosophy } from '@/engine/types';
import { CarLivery } from '@/components/common';
import { Button, cn, Field } from '@/components/ui';
import { money } from '@/lib/format';
import { useStore } from '@/store/gameStore';

const SWATCHES = ['#e10600', '#ff6b00', '#f5c542', '#22c55e', '#00a19c', '#0ea5e9', '#2563eb', '#6d28d9', '#db2777', '#f8fafc', '#94a3b8', '#111827'];
const LIVERIES: { id: LiveryPattern; label: string }[] = [
  { id: 'solid', label: 'Classic' },
  { id: 'stripe', label: 'Racing Stripe' },
  { id: 'split', label: 'Split' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'halo', label: 'Halo' },
  { id: 'fade', label: 'Fade' },
];

const STEPS = ['Identity', 'Philosophy', 'Challenge', 'Confirm'];

export function NewCareer() {
  const setScreen = useStore((s) => s.setScreen);
  const newGame = useStore((s) => s.newGame);
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
  const [seedText, setSeedText] = useState('');
  const set = <K extends keyof NewCareerConfig>(k: K, v: NewCareerConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const valid = cfg.teamName.trim().length >= 3 && cfg.shortName.trim().length >= 2 && cfg.principalName.trim().length >= 2;
  const startingCash = DIVISIONS.F5.typicalBudget * 0.42 * FINANCIAL_STARTS[cfg.financialStart].cashFactor * DIFFICULTIES[cfg.difficulty].startingCash;

  const start = () => {
    const seed = seedText.trim() ? Number.parseInt(seedText.trim(), 10) : undefined;
    newGame({ ...cfg, seed: Number.isFinite(seed) ? seed : undefined });
  };

  return (
    <div className="min-h-full bg-apex-bg bg-carbon">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="label text-apex-red">New career</div>
            <h1 className="font-display text-4xl font-black uppercase">Create your team</h1>
          </div>
          <Button variant="ghost" onClick={() => setScreen('title')}>
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
        <div className="mb-8 flex gap-2">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)} className={cn('flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm', i === step ? 'border-apex-red bg-apex-red/10' : i < step ? 'border-apex-line2 text-white' : 'border-apex-line text-apex-dim')}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', i < step ? 'bg-emerald-600' : i === step ? 'bg-apex-red' : 'bg-apex-line')}>{i < step ? <Check size={13} /> : i + 1}</span>
              <span className="font-display font-semibold uppercase tracking-wider">{s}</span>
            </button>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-6">
          {step === 0 && (
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
                <Field label="Team nationality">
                  <select className="input w-full" value={cfg.nationality} onChange={(e) => set('nationality', e.target.value)}>
                    {[...NATIONALITIES].sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
                      <option key={n.code} value={n.code}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </Field>
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
                <div className="text-sm text-apex-muted">{NATIONALITIES.find((n) => n.code === cfg.nationality)?.name}</div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Field label="Team principal (you)">
                <input className="input w-full max-w-md" placeholder="Your name" value={cfg.principalName} maxLength={30} onChange={(e) => set('principalName', e.target.value)} />
              </Field>
              <div>
                <div className="label mb-2">Team philosophy</div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(PHILOSOPHIES) as Philosophy[]).map((p) => {
                    const ph = PHILOSOPHIES[p];
                    return (
                      <button key={p} onClick={() => set('philosophy', p)} className={cn('rounded-lg border p-4 text-left transition', cfg.philosophy === p ? 'border-apex-red bg-apex-red/[0.08] shadow-glow' : 'border-apex-line hover:border-apex-line2')}>
                        <div className="font-display text-lg font-bold uppercase">{ph.label}</div>
                        <div className="mt-1 text-xs text-apex-muted">{ph.summary}</div>
                        <ul className="mt-3 space-y-1 text-xs">
                          {ph.pros.map((x) => (
                            <li key={x} className="text-emerald-300">+ {x}</li>
                          ))}
                          {ph.cons.map((x) => (
                            <li key={x} className="text-red-300">− {x}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="label mb-2">Difficulty</div>
                <div className="grid gap-3 md:grid-cols-4">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                    <button key={d} onClick={() => set('difficulty', d)} className={cn('rounded-lg border p-4 text-left', cfg.difficulty === d ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                      <div className="font-display text-lg font-bold uppercase">{DIFFICULTIES[d].label}</div>
                      <div className="mt-1 text-xs text-apex-muted">{DIFFICULTIES[d].description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label mb-2">Financial starting conditions</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(Object.keys(FINANCIAL_STARTS) as FinancialStart[]).map((f) => (
                    <button key={f} onClick={() => set('financialStart', f)} className={cn('rounded-lg border p-4 text-left', cfg.financialStart === f ? 'border-apex-red bg-apex-red/[0.08]' : 'border-apex-line hover:border-apex-line2')}>
                      <div className="font-display text-lg font-bold uppercase">{FINANCIAL_STARTS[f].label}</div>
                      <div className="mt-1 text-xs text-apex-muted">{FINANCIAL_STARTS[f].description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="World seed (optional)" hint="Use the same seed to generate the same universe again.">
                <input className="input w-48" inputMode="numeric" placeholder="Random" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <Row k="Team" v={`${cfg.teamName} (${cfg.shortName})`} />
                <Row k="Team principal" v={cfg.principalName || '—'} />
                <Row k="Philosophy" v={PHILOSOPHIES[cfg.philosophy].label} />
                <Row k="Difficulty" v={DIFFICULTIES[cfg.difficulty].label} />
                <Row k="Finances" v={FINANCIAL_STARTS[cfg.financialStart].label} />
                <Row k="Starting division" v="Formula 5 (8 races)" />
                <Row k="Starting cash" v={money(startingCash)} />
                <div className="rounded-lg border border-apex-line bg-apex-bg p-4 text-apex-muted">
                  You start at the very bottom: two contracted drivers, a basic car, four staff and a garage-sized headquarters. Nine rival teams stand between you and promotion. Every division above is faster, richer and more expensive.
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-apex-line bg-apex-bg p-6">
                <CarLivery primary={cfg.primaryColor} secondary={cfg.secondaryColor} pattern={cfg.livery} number={cfg.shortName} width={320} />
                <div className="mt-3 font-display text-3xl font-black uppercase">{cfg.teamName}</div>
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> Previous
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 1 && cfg.principalName.trim().length < 2}>
              Next <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled={!valid} onClick={start}>
              Launch team <ArrowRight size={18} />
            </Button>
          )}
        </div>
        {!valid && step === 3 && <p className="mt-2 text-right text-xs text-amber-300">A team name (3+), abbreviation (2+) and principal name (2+) are required.</p>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-apex-line pb-2">
      <span className="text-apex-muted">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
