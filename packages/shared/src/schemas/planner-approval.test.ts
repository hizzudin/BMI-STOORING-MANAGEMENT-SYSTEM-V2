import { describe, expect, it } from 'vitest';
import {
  APPROVAL_KINDS,
  APPROVAL_KIND_LABELS,
  PlannerApprovalOffRequestSchema,
  PlannerApprovalRequestSchema,
} from './planner-approval.js';

const issue = (schema: { safeParse: (v: unknown) => unknown }, body: unknown) =>
  (schema.safeParse(body) as { error?: { issues: { message: string }[] } }).error?.issues[0]
    ?.message;

describe('REQ-IAM-008 DEC-118 the Planner approval switch request', () => {
  it('DEC-48 the five kinds of the checklist, each with its label', () => {
    expect(APPROVAL_KINDS).toEqual([
      'spk_creation',
      'spk_amendment',
      'spk_completion',
      'stock_opname',
      'tyre_count',
    ]);
    expect(APPROVAL_KINDS.map((kind) => APPROVAL_KIND_LABELS[kind])).toEqual([
      'SPK creation',
      'SPK amendment',
      'SPK completion',
      'Stock opname',
      'Tyre count',
    ]);
  });

  it('accepts ticked kinds, an optional end time and a reason', () => {
    const body = {
      kinds: ['spk_creation'],
      until: '2026-11-11T11:00:00.000Z',
      reason: ' Site visit ',
    };
    expect(PlannerApprovalRequestSchema.parse(body)).toEqual({ ...body, reason: 'Site visit' });
    expect(PlannerApprovalRequestSchema.parse({ ...body, until: null }).until).toBeNull();
  });

  it('refuses no kind, a kind twice, a bad end time and an empty reason', () => {
    const body = { kinds: ['tyre_count'], until: null, reason: 'Urgent' };
    expect(issue(PlannerApprovalRequestSchema, { ...body, kinds: [] })).toBe(
      'Tick at least one approval kind.',
    );
    expect(
      issue(PlannerApprovalRequestSchema, { ...body, kinds: ['tyre_count', 'tyre_count'] }),
    ).toBe('Tick each kind once.');
    expect(issue(PlannerApprovalRequestSchema, { ...body, until: 'tomorrow' })).toBe(
      'Give the end time as a date and time.',
    );
    expect(issue(PlannerApprovalRequestSchema, { ...body, reason: '  ' })).toBe('Give a reason.');
    expect(issue(PlannerApprovalOffRequestSchema, { reason: '' })).toBe('Give a reason.');
  });
});
