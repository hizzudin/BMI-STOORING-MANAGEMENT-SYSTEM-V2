import { z } from 'zod';
import type { Role } from '../enums/index.js';

export const SYSTEM_MODES = ['Setup', 'Live'] as const;

/** DEC-56: the roles that sign in while the system is in Setup mode. */
export const SETUP_SIGN_IN_ROLES: readonly Role[] = ['System_Admin', 'Access_Manager'];

/** DEC-132: the phrases the System Admin types to switch the mode. */
export const GO_LIVE_PHRASE = 'GO LIVE';
export const BACK_TO_SETUP_PHRASE = 'BACK TO SETUP';

export const SYSTEM_MODE_ACTIONS = ['go_live', 'back_to_setup'] as const;
export type SystemModeAction = (typeof SYSTEM_MODE_ACTIONS)[number];

export const SYSTEM_MODE_MESSAGES = {
  beingSetUp: 'The system is being set up.',
  reasonRequired: 'Give a reason.',
  goLivePhrase: `Type ${GO_LIVE_PHRASE} to confirm.`,
  backToSetupPhrase: `Type ${BACK_TO_SETUP_PHRASE} to confirm.`,
  alreadyLive: 'The system is already Live.',
  alreadySetup: 'The system is already in Setup mode.',
} as const;

/** DEC-132: a switch needs a reason and the typed phrase; the service trims and checks both. */
export const SystemModeSwitchRequestSchema = z.object({
  reason: z.string().max(500),
  confirmation: z.string().max(40),
});
export type SystemModeSwitchRequest = z.infer<typeof SystemModeSwitchRequestSchema>;

/** REQ-IAM-010, DEC-132: one line of the checklist on SetupGoLive, with what is in the system. */
export const SetupChecklistItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
});
export type SetupChecklistItem = z.infer<typeof SetupChecklistItemSchema>;

export const SystemModeResponseSchema = z.object({
  mode: z.enum(SYSTEM_MODES),
  /** The latest Go live, or null before the first. */
  wentLiveAt: z.string().nullable(),
  checklist: z.array(SetupChecklistItemSchema),
  allowedActions: z.array(z.enum(SYSTEM_MODE_ACTIONS)),
});
export type SystemModeResponse = z.infer<typeof SystemModeResponseSchema>;
