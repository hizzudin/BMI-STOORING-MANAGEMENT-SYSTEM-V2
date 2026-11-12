import { describe, expect, it } from 'vitest';
import { SPK_PRIORITIES, SpkRequestSchema, SpkUpdateRequestSchema } from './spks.js';

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
