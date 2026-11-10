'use client';

import { useId, type FormEvent, type ReactNode } from 'react';

/** A labelled field of a side panel; the label points at the control by id. */
export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

/** C-34: one sentence that refuses. */
export function Refusal({ message }: { message: string | null }) {
  return message ? (
    <p className="refusal" role="alert">
      {message}
    </p>
  ) : null;
}

/** A side panel over the scrim (DESIGN.md): the scrim and Escape close it (C-14). */
export function Panel({
  label,
  onClose,
  onSubmit,
  children,
}: {
  label: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="overlay right"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        {children}
      </form>
    </div>
  );
}
