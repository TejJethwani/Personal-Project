import { create } from 'zustand';

/**
 * In-page replacement for window.confirm(). Some hosts (embedded frames,
 * sandboxed viewers) never show native dialogs and make confirm() return
 * false, which would silently block every guarded action.
 */
export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(() => ({ request: null }));

export function askConfirm(message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    // Only one question at a time: a newer one cancels the older.
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { message, confirmLabel, resolve } });
  });
}

export function settleConfirm(ok: boolean): void {
  const request = useConfirmStore.getState().request;
  if (!request) return;
  useConfirmStore.setState({ request: null });
  request.resolve(ok);
}
