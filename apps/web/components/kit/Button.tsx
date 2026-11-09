'use client';

import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

/** A pill button (DESIGN.md Buttons). Danger is outlined and carries an explicit verb, never filled. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`btn btn-${variant} ${className}`.trim()} {...rest} />
  );
});

export interface BusyButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => Promise<unknown>;
}

/** C-34: disabled with progress while its request runs; a refusal shows one sentence and keeps the form. */
export function BusyButton({ onClick, children, variant = 'primary', ...rest }: BusyButtonProps) {
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setRefusal(null);
    try {
      await onClick();
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : 'The request was refused.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="busy-button">
      <Button
        {...rest}
        variant={variant}
        disabled={busy}
        aria-busy={busy}
        onClick={() => void run()}
      >
        {busy && <span className="spinner" aria-hidden="true" />}
        {children}
      </Button>
      {refusal && (
        <span role="alert" className="refusal">
          {refusal}
        </span>
      )}
    </span>
  );
}
