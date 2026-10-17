import { create } from 'zustand';
import { createNewGame } from '@/engine/game';
import type { GameState, NewCareerConfig } from '@/engine/types';
import { GameRuleError } from '@/engine/util';
import { ACHIEVEMENT_BY_ID } from '@/engine/achievements';
import { recordAchievements } from '@/lib/profile';
import { AUTOSAVE_SLOT, saveToSlot } from './persistence';

export type Page = 'hq' | 'drivers' | 'market' | 'car' | 'race' | 'championship' | 'finances' | 'staff' | 'news' | 'history' | 'settings' | 'seasonReview';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'achievement';
  text: string;
}

export interface NegotiationTarget {
  driverId: string;
  mode: 'sign' | 'extend' | 'academy' | 'promote';
}

interface Store {
  game: GameState | null;
  rev: number;
  screen: 'title' | 'newCareer' | 'game';
  page: Page;
  driverProfile: string | null;
  teamProfile: string | null;
  negotiation: NegotiationTarget | null;
  resultView: string | null;
  toasts: Toast[];
  lastSaved: number | null;
  setScreen: (s: Store['screen']) => void;
  setPage: (p: Page) => void;
  openDriver: (id: string | null) => void;
  openTeam: (id: string | null) => void;
  openNegotiation: (t: NegotiationTarget | null) => void;
  openResult: (eventId: string | null) => void;
  newGame: (config: NewCareerConfig) => void;
  loadGame: (state: GameState) => void;
  /** Start a daily challenge world (never autosaved over the career). */
  loadDaily: (state: GameState) => void;
  quitToTitle: () => void;
  act: <T>(fn: (g: GameState) => T, opts?: { success?: string | ((r: T) => string | null); silent?: boolean }) => T | undefined;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  autosaveNow: () => Promise<void>;
}

let toastId = 0;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<Store>((set, get) => ({
  game: null,
  rev: 0,
  screen: 'title',
  page: 'hq',
  driverProfile: null,
  teamProfile: null,
  negotiation: null,
  resultView: null,
  toasts: [],
  lastSaved: null,
  setScreen: (screen) => set({ screen }),
  setPage: (page) => {
    set({ page, driverProfile: null, teamProfile: null });
    window.scrollTo?.({ top: 0 });
  },
  openDriver: (id) => set({ driverProfile: id }),
  openTeam: (id) => set({ teamProfile: id }),
  openNegotiation: (negotiation) => set({ negotiation }),
  openResult: (resultView) => set({ resultView }),
  newGame: (config) => {
    const game = createNewGame(config);
    set({ game, rev: 1, screen: 'game', page: 'hq' });
    void get().autosaveNow();
  },
  loadGame: (game) => {
    set({ game, rev: get().rev + 1, screen: 'game', page: game.phase === 'weekend' ? 'race' : game.phase === 'seasonReview' ? 'seasonReview' : 'hq', driverProfile: null, teamProfile: null, negotiation: null });
  },
  loadDaily: (game) => {
    set({ game, rev: get().rev + 1, screen: 'game', page: 'race', driverProfile: null, teamProfile: null, negotiation: null });
  },
  quitToTitle: () => set({ game: null, screen: 'title', driverProfile: null, teamProfile: null, negotiation: null }),
  act: (fn, opts = {}) => {
    const game = get().game;
    if (!game) return undefined;
    const unlockedBefore = new Set(Object.keys(game.player.achievements ?? {}));
    try {
      const result = fn(game);
      set({ rev: get().rev + 1 });
      const msg = typeof opts.success === 'function' ? opts.success(result) : opts.success;
      if (msg) get().toast('success', msg);
      const fresh = Object.keys(game.player.achievements ?? {}).filter((id) => !unlockedBefore.has(id));
      if (fresh.length) {
        recordAchievements(fresh);
        for (const id of fresh) get().toast('achievement', `Achievement unlocked: ${ACHIEVEMENT_BY_ID[id]?.title ?? id}`);
      }
      if (game.settings.autosave && game.mode !== 'daily') {
        // During a live race, save only once playback pauses for a while
        // instead of serialising the whole career after every lap.
        const racing = game.phase === 'weekend' && game.weekend?.phase === 'race';
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => void get().autosaveNow(), racing ? 8000 : 1200);
      }
      return result;
    } catch (err) {
      set({ rev: get().rev + 1 });
      if (err instanceof GameRuleError) {
        if (!opts.silent) get().toast('error', err.message);
      } else {
        console.error(err);
        get().toast('error', `Unexpected error: ${(err as Error).message}`);
      }
      return undefined;
    }
  },
  toast: (kind, text) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 4000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  autosaveNow: async () => {
    const game = get().game;
    if (!game || !game.settings.autosave || game.mode === 'daily') return;
    try {
      await saveToSlot(AUTOSAVE_SLOT, game);
      set({ lastSaved: Date.now() });
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  },
}));

/** Read the active game and re-render on every state revision. */
export function useGame(): GameState {
  useStore((s) => s.rev);
  const game = useStore((s) => s.game);
  if (!game) throw new Error('No active game');
  return game;
}
