/** REQ-PLC-008: the status of a position, always shown with its text label (NFR-10). */
export const POSITION_STATUSES = ['Normal', 'DueSoon', 'ActNow', 'Empty', 'Missing'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const STATUS_LABELS: Readonly<Record<PositionStatus, string>> = {
  Normal: 'Normal',
  DueSoon: 'Due soon',
  ActNow: 'Act now',
  Empty: 'Empty',
  Missing: 'Missing',
};

/** DEC-119: what each colour means, in the guide under the map (REQ-PLC-007, REQ-BSL-004). */
export const STATUS_MEANINGS: Readonly<Record<PositionStatus, string>> = {
  Normal: 'Fitted and within its life',
  DueSoon: 'Near its replacement limit',
  ActNow: 'At or past its limit: replace or check it',
  Empty: 'No tyre fitted',
  Missing: 'No baseline recorded for this position',
};

/** The tyre classes of the map's style sheet (artboard kit: t-ok, t-due, t-act, t-empty; DEC-119: t-miss). */
export const STATUS_CLASSES: Readonly<Record<PositionStatus, string>> = {
  Normal: 't-ok',
  DueSoon: 't-due',
  ActNow: 't-act',
  Empty: 't-empty',
  Missing: 't-miss',
};
