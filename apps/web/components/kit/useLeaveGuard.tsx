'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * C-12, C-13: leaving a form with unsaved changes asks Leave without saving? (Leave, Stay).
 * Closing the browser tab with changes is guarded by the browser's own prompt.
 */
export function useLeaveGuard(): {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  leave: (go: () => void) => void;
  dialog: ReactNode;
} {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = (go: () => void) => (dirty ? setPending(() => go) : go());

  const dialog = pending ? (
    <ConfirmDialog
      title="Leave without saving?"
      body="What you typed on this page is lost."
      confirmLabel="Leave"
      cancelLabel="Stay"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const go = pending;
        setPending(null);
        setDirty(false);
        go();
      }}
    />
  ) : null;

  return { dirty, setDirty, leave, dialog };
}
