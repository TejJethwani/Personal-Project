import { motion } from 'framer-motion';
import { Download, FolderOpen, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DIVISIONS } from '@/engine/config/divisions';
import type { DivisionId } from '@/engine/types';
import { CarLivery } from '@/components/common';
import { Button } from '@/components/ui';
import { AUTOSAVE_SLOT, deleteSlot, importSave, listSaves, loadFromSlot, type SaveSummary } from '@/store/persistence';
import { useStore } from '@/store/gameStore';

export function TitleScreen() {
  const setScreen = useStore((s) => s.setScreen);
  const loadGame = useStore((s) => s.loadGame);
  const toast = useStore((s) => s.toast);
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listSaves()
      .then(setSaves)
      .catch(() => setSaves([]))
      .finally(() => setLoading(false));
  useEffect(() => {
    void refresh();
  }, []);

  const auto = saves.find((s) => s.slot === AUTOSAVE_SLOT);
  const load = async (slot: string) => {
    try {
      loadGame(await loadFromSlot(slot));
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      loadGame(await importSave(file));
      toast('success', 'Save imported.');
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-apex-bg">
      <div className="pointer-events-none absolute inset-0 bg-apex-grad" />
      <div className="pointer-events-none absolute inset-0 bg-carbon" />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[480px] w-[900px] -rotate-12 bg-gradient-to-r from-transparent via-apex-red/10 to-transparent blur-2xl" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col justify-center gap-12 px-8 py-16 lg:flex-row lg:items-center">
        <div className="flex-1">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="label mb-3 text-apex-red">Motorsport management simulator</div>
            <h1 className="font-display text-7xl font-black uppercase leading-[0.9] tracking-tight sm:text-8xl">
              Project
              <br />
              <span className="text-apex-red">Apex</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-apex-muted">From backmarkers to world champions. Build a Formula 5 garage into the greatest constructor in motorsport history.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {(['F5', 'F4', 'F3', 'F2', 'F1'] as DivisionId[]).map((d, i) => (
                <motion.div key={d} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }} className="rounded-md border border-apex-line bg-apex-panel/70 px-3 py-2">
                  <div className="font-display text-xl font-black">{d}</div>
                  <div className="text-[10px] uppercase tracking-wider text-apex-muted">{DIVISIONS[d].status}</div>
                </motion.div>
              ))}
            </div>
            <motion.div className="mt-10" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}>
              <CarLivery primary="#e10600" secondary="#ffffff" pattern="arrow" number="1" width={420} />
            </motion.div>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="panel w-full max-w-md p-6">
          <div className="space-y-3">
            {auto && (
              <Button variant="primary" size="lg" className="w-full justify-between" onClick={() => load(AUTOSAVE_SLOT)}>
                <span className="flex items-center gap-2">
                  <Play size={18} /> Continue
                </span>
                <span className="font-sans text-xs normal-case tracking-normal opacity-80">
                  {auto.meta.teamName} · {auto.meta.division} · S{auto.meta.season}
                </span>
              </Button>
            )}
            <Button variant={auto ? 'secondary' : 'primary'} size="lg" className="w-full" onClick={() => setScreen('newCareer')}>
              <Plus size={18} /> New Career
            </Button>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => fileRef.current?.click()}>
              <Download size={18} /> Import Save File
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          </div>
          <div className="mt-6">
            <div className="label mb-2 flex items-center gap-2">
              <FolderOpen size={13} /> Saved careers
            </div>
            {loading ? (
              <div className="text-sm text-apex-muted">Loading…</div>
            ) : saves.length === 0 ? (
              <div className="rounded-md border border-dashed border-apex-line2 p-4 text-sm text-apex-muted">No saves yet. Start a new career!</div>
            ) : (
              <div className="space-y-1.5">
                {saves.map((s) => (
                  <div key={s.slot} className="flex items-center gap-2 rounded-md border border-apex-line bg-apex-bg/60 px-3 py-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => load(s.slot)}>
                      <div className="truncate text-sm font-semibold">
                        {s.meta.teamName} <span className="text-apex-muted">· {s.meta.division}</span>
                      </div>
                      <div className="text-[11px] text-apex-muted">
                        {s.slot === AUTOSAVE_SLOT ? 'Autosave' : s.slot.replace('slot-', 'Slot ')} · Season {s.meta.season} ({s.meta.year}) · {new Date(s.savedAt).toLocaleString()}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete save"
                      onClick={async () => {
                        if (!confirm('Delete this save permanently?')) return;
                        await deleteSlot(s.slot);
                        void refresh();
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-apex-dim">Saves are stored in this browser (IndexedDB). Export from Settings to back up or move a career.</p>
        </motion.div>
      </div>
    </div>
  );
}
