import { describe, expect, it } from 'vitest';
import {
  APPROVAL_DECISION_ACTIONS,
  ApprovalDecisionRequestSchema,
  ApprovalHistoryQuerySchema,
  ApprovalInboxQuerySchema,
} from './approvals.js';

describe('REQ-APR-002 DEC-128 the Approvals inbox query', () => {
  it('has no filter by default; the kind is Creation in phase 1 and the search is trimmed', () => {
    expect(ApprovalInboxQuerySchema.parse({})).toEqual({});
    expect(ApprovalInboxQuerySchema.parse({ kind: 'Creation', search: ' b 12 ' })).toEqual({
      kind: 'Creation',
      search: 'b 12',
    });
    // DEC-128: Amendment and Completion come with TASK-611 and TASK-210.
    expect(ApprovalInboxQuerySchema.safeParse({ kind: 'Amendment' }).success).toBe(false);
  });
});

describe('REQ-APR-007 DEC-128 the History query', () => {
  it('filters on Approve or Reject only', () => {
    expect(ApprovalHistoryQuerySchema.parse({ decision: 'Reject' })).toEqual({
      decision: 'Reject',
    });
    expect(ApprovalHistoryQuerySchema.safeParse({ decision: 'Submit' }).success).toBe(false);
    expect(APPROVAL_DECISION_ACTIONS).toEqual(['Approve', 'Reject']);
  });
});

describe('C-24 C-25 AC-APR-004 the decision request', () => {
  it('carries the version; the reason is trimmed', () => {
    expect(ApprovalDecisionRequestSchema.parse({ version: 3 })).toEqual({ version: 3 });
    expect(ApprovalDecisionRequestSchema.parse({ version: 3, reason: '  Wrong part  ' })).toEqual({
      version: 3,
      reason: 'Wrong part',
    });
    // A reason of spaces only is empty: the service refuses the rejection (AC-APR-004).
    expect(ApprovalDecisionRequestSchema.parse({ version: 3, reason: '   ' })).toEqual({
      version: 3,
      reason: '',
    });
    expect(
      ApprovalDecisionRequestSchema.safeParse({ version: 3, reason: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});
