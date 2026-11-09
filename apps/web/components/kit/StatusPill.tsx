import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A status always carries its text label (NFR-10, ui.md 7.5 StatusPill); colour only supports it. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
