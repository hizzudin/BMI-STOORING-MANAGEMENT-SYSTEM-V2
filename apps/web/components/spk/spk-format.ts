import type { AsgStatus, Role, SpkPriority, SpkStatus } from '@bmi/shared';
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
  // DESIGN.md: In Progress pills are petrol (info).
  In_Progress: 'info',
  Pending_Verification: 'info',
  Pending_Amendment: 'warning',
  Completed: 'success',
  Cancelled: 'neutral',
};

/** Pending_Approval reads "Pending approval". */
export const statusText = (status: SpkStatus | AsgStatus) => {
  const words = status.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** ui.md 7.5 StepCard: Verified green, Submitted amber, Open and In progress info, Locked and Skipped neutral. */
export const STEP_TONES: Record<AsgStatus, Tone> = {
  Locked: 'neutral',
  Open: 'info',
  In_Progress: 'info',
  Submitted: 'warning',
  Verified: 'success',
  Skipped: 'neutral',
};

/** "Planner Sari"; a role reads with spaces ("Warehouse Manager"). */
export const roleText = (role: Role) => role.replaceAll('_', ' ');
export const personText = (person: { name: string; role: Role | null }) =>
  person.role ? `${roleText(person.role)} ${person.name}` : person.name;
