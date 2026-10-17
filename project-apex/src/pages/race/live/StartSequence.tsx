import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { TIRE_TUNING } from '@/engine/config/tuning';
import { driverShortName } from '@/engine/drivers/ratings';
import { weatherLabel } from '@/engine/race/weather';
import type { GameState, RaceState } from '@/engine/types';

export type StartPhase = 'idle' | 'formation' | 'lights' | 'out';

export interface StartSequence {
  phase: StartPhase;
  lights: number;
  active: boolean;
  begin: () => void;
}

const FORMATION_MS = 2200;
const LIGHT_MS = 650;
const OUT_MS = 900;

/**
 * The start of a race as television shows it: the formation lap, five red
 * lights one by one, then lights out. Pure presentation before lap one; the
 * race itself starts when the sequence ends.
 */
export function useStartSequence(onGo: () => void): StartSequence {
  const [phase, setPhase] = useState<StartPhase>('idle');
  const [lights, setLights] = useState(0);
  const go = useRef(onGo);
  go.current = onGo;
  useEffect(() => {
    if (phase === 'idle') return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'formation') t = setTimeout(() => setPhase('lights'), FORMATION_MS);
    else if (phase === 'lights') {
      t = setTimeout(() => {
        if (lights < 5) setLights(lights + 1);
        else {
          setPhase('out');
          go.current();
        }
      }, lights === 5 ? LIGHT_MS + 250 : LIGHT_MS);
    } else t = setTimeout(() => setPhase('idle'), OUT_MS);
    return () => clearTimeout(t);
  }, [phase, lights]);
  return {
    phase,
    lights,
    active: phase === 'formation' || phase === 'lights',
    begin: () => {
      setLights(0);
      setPhase('formation');
    },
  };
}

export function StartOverlay({ game, race, seq }: { game: GameState; race: RaceState; seq: StartSequence }) {
  const grid = [...race.cars].sort((a, b) => a.grid - b.grid);
  const pole = grid[0];
  const mine = grid.filter((c) => c.isPlayer);
  const wx = race.weather[0];
  return (
    <AnimatePresence>
      {seq.phase !== 'idle' && (
        <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55">
          {seq.phase === 'formation' && (
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-xl border border-apex-line bg-black/85 px-6 py-4 text-center shadow-panel">
              <div className="font-display text-3xl font-black uppercase tracking-[0.18em] text-white">Formation lap</div>
              <div className="mt-1 text-sm text-apex-muted">
                {race.cars.length} cars · {race.totalLaps} laps · {weatherLabel(wx?.rain ?? 0, wx?.wetness ?? 0)} · track {Math.round(wx?.trackTemp ?? 0)}°C
              </div>
              {pole && (
                <div className="mt-2 text-sm">
                  Pole: <span className="font-semibold">{driverShortName(game.drivers[pole.driverId])}</span>
                </div>
              )}
              {mine.length > 0 && (
                <div className="mt-1 flex justify-center gap-3 text-xs text-white/85">
                  {mine.map((c) => (
                    <span key={c.driverId} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: TIRE_TUNING.compounds[c.tire.compound].color }} />
                      {driverShortName(game.drivers[c.driverId])} P{c.grid}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          {seq.phase === 'lights' && (
            <div className="flex gap-3 rounded-xl bg-black/90 px-5 py-4 shadow-panel" aria-label={`${seq.lights} of 5 start lights on`}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md bg-zinc-900 p-2">
                  {[0, 1].map((k) => (
                    <span key={k} className="block h-8 w-8 rounded-full transition-all duration-100" style={{ background: i < seq.lights ? '#ef1c1c' : '#2a0c0c', boxShadow: i < seq.lights ? '0 0 18px 4px rgba(239,28,28,0.7)' : 'none' }} />
                  ))}
                </div>
              ))}
            </div>
          )}
          {seq.phase === 'out' && (
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-5xl font-black uppercase tracking-[0.16em] text-white drop-shadow-[0_0_18px_rgba(225,6,0,0.9)]">
              Lights out!
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
