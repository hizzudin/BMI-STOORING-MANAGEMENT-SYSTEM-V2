'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation over the 55 % petrol-ink scrim (DESIGN.md Dialog lift): Leave without saving? (C-12),
 * Discard your changes? (C-16), Deactivate … (C-32). Cancel, Escape and the scrim close it unchanged (C-14).
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      className="overlay"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      >
        <h3 id={titleId}>{title}</h3>
        <p className="muted">{body}</p>
        <div className="bar">
          <Button ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
