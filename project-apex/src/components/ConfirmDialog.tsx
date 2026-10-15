import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { settleConfirm, useConfirmStore } from '@/store/confirm';
import { Button } from './ui';

export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  useEffect(() => {
    if (!request) return;
    // Capture phase so Escape answers this dialog without also closing a modal underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      settleConfirm(e.key === 'Enter');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request]);
  return createPortal(
    <AnimatePresence>
      {request && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={() => settleConfirm(false)}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-message"
            className="panel w-full max-w-md"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p id="confirm-message" className="p-5 text-sm leading-relaxed text-white">
              {request.message}
            </p>
            <div className="flex justify-end gap-2 border-t border-apex-line px-5 py-3">
              <Button variant="ghost" onClick={() => settleConfirm(false)}>
                Cancel
              </Button>
              <Button variant="primary" autoFocus onClick={() => settleConfirm(true)}>
                {request.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
