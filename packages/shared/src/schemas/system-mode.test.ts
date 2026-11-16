import { describe, expect, it } from 'vitest';
import {
  BACK_TO_SETUP_PHRASE,
  GO_LIVE_PHRASE,
  SETUP_SIGN_IN_ROLES,
  SystemModeSwitchRequestSchema,
} from './system-mode.js';

describe('System mode (REQ-IAM-010, DEC-56, DEC-132)', () => {
  it('DEC-56 only the System Admin and Access Managers sign in during Setup', () => {
    expect(SETUP_SIGN_IN_ROLES).toEqual(['System_Admin', 'Access_Manager']);
  });

  it('DEC-132 names the phrases typed to switch', () => {
    expect(GO_LIVE_PHRASE).toBe('GO LIVE');
    expect(BACK_TO_SETUP_PHRASE).toBe('BACK TO SETUP');
  });

  it('DEC-132 a switch carries a reason and the typed phrase', () => {
    expect(
      SystemModeSwitchRequestSchema.parse({ reason: 'Data is complete', confirmation: 'GO LIVE' }),
    ).toEqual({ reason: 'Data is complete', confirmation: 'GO LIVE' });
    expect(SystemModeSwitchRequestSchema.safeParse({ confirmation: 'GO LIVE' }).success).toBe(
      false,
    );
    expect(
      SystemModeSwitchRequestSchema.safeParse({ reason: 'x'.repeat(501), confirmation: 'GO LIVE' })
        .success,
    ).toBe(false);
  });
});
