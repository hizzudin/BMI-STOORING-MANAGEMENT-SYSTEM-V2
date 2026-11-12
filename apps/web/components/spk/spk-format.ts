import type { SpkPriority, SpkStatus } from '@bmi/shared';
import type { Tone } from '../kit/StatusPill';

/** REQ-SPK-015, DEC-92: Urgent red, High amber, Normal info, Low neutral; always with its text. */
export const PRIORITY_TONES: Record<SpkPriority, Tone> = {
  Urgent: 'danger',
  High: 'warning',
  Normal: 'info',
  Low: 'neutral',
};

export const STATUS_TONES: Record<SpkStatus, Tone> = {
  Draft: 'neutral',
  Pending_Approval: 'info',
  Rejected: 'danger',
  Active: 'success',
  In_Progress: 'success',
  Pending_Verification: 'info',
  Pending_Amendment: 'warning',
  Completed: 'success',
  Cancelled: 'neutral',
};

/** Pending_Approval reads "Pending approval". */
export const statusText = (status: SpkStatus) => {
  const words = status.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
