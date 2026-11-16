import { describe, expect, it } from 'vitest';
import {
  SPK_ACTIONS,
  SPK_PRIORITIES,
  SPK_TABS,
  SpkCancelRequestSchema,
  SpkListQuerySchema,
  SpkRequestSchema,
  SpkUpdateRequestSchema,
} from './spks.js';

const draft = {
  vehicleId: 7,
  title: ' PM 20.000 km ',
  category: 'PM',
  priority: 'Normal',
  requiresDowntime: true,
  description: 'Service per PM package TH-20K.',
};

const issue = (body: unknown) => SpkRequestSchema.safeParse(body).error?.issues[0]?.message;

describe('REQ-SPK-001 REQ-SPK-015 the SPK request', () => {
  it('REQ-SPK-015 the urgencies are Low, Normal, High and Urgent, in that order', () => {
    expect(SPK_PRIORITIES).toEqual(['Low', 'Normal', 'High', 'Urgent']);
    expect(issue({ ...draft, priority: 'Critical' })).toBe('Choose an urgency.');
  });

  it('REQ-SPK-001 trims the title; title, category, description and vehicle are required', () => {
    expect(SpkRequestSchema.parse(draft).title).toBe('PM 20.000 km');
    expect(issue({ ...draft, title: ' ' })).toBe('Enter a title.');
    expect(issue({ ...draft, title: 't'.repeat(151) })).toBe('A title has at most 150 characters.');
    expect(issue({ ...draft, category: 'Repair' })).toBe('Choose a category.');
    expect(issue({ ...draft, description: '' })).toBe('Enter a description.');
    expect(issue({ ...draft, vehicleId: undefined })).toBe('Choose a vehicle.');
  });

  it('C-15 a save carries the version it was read at', () => {
    expect(SpkUpdateRequestSchema.parse({ ...draft, version: 3 }).version).toBe(3);
    expect(SpkUpdateRequestSchema.safeParse(draft).success).toBe(false);
  });
});

describe('REQ-SPK-010 DEC-127 the SPK list query', () => {
  it('defaults to the Active tab, page 1 and 20 per page; numbers come from the query string', () => {
    expect(SpkListQuerySchema.parse({})).toEqual({ tab: 'active', page: 1, pageSize: 20 });
    expect(
      SpkListQuerySchema.parse({
        tab: 'mine',
        vehicleId: '7',
        page: '3',
        pageSize: '50',
        search: ' kx ',
      }),
    ).toEqual({ tab: 'mine', vehicleId: 7, page: 3, pageSize: 50, search: 'kx' });
  });

  it('DEC-127 offers 10, 20, 50 or 100 per page; the tabs and types are the PRD ones', () => {
    expect(SpkListQuerySchema.safeParse({ pageSize: '25' }).error?.issues[0]?.message).toBe(
      'Choose 10, 20, 50 or 100 per page.',
    );
    expect(SpkListQuerySchema.safeParse({ tab: 'late' }).success).toBe(false);
    expect(SpkListQuerySchema.safeParse({ type: 'Repair' }).success).toBe(false);
    expect(SPK_TABS).toEqual([
      'active',
      'mine',
      'draft',
      'pending',
      'rejected',
      'completed',
      'cancelled',
      'all',
    ]);
  });
});

describe('T6 DEC-129 the creator cancels a Draft or Rejected SPK', () => {
  it('T6 cancel is one of the SPK actions', () => {
    expect(SPK_ACTIONS).toEqual(['edit', 'submit', 'cancel']);
  });

  it('T6 the reason is required, trimmed and at most 500 characters', () => {
    expect(SpkCancelRequestSchema.parse({ version: 2, reason: '  Raised twice  ' })).toEqual({
      version: 2,
      reason: 'Raised twice',
    });
    for (const reason of ['', '   ', 'x'.repeat(501)]) {
      expect(SpkCancelRequestSchema.safeParse({ version: 2, reason }).success).toBe(false);
    }
    expect(
      SpkCancelRequestSchema.safeParse({ version: 2, reason: ' ' }).error?.issues[0]?.message,
    ).toBe('Give a reason to cancel.');
  });
});
