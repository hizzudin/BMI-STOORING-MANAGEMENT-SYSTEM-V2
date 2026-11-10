import type { ApiClient } from '@bmi/api-client';
import type { PlannerApprovalRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** The Planner approval switch (REQ-IAM-008, DEC-118) through the generated client. */
export function plannerApprovalApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  return {
    get: () => settle(client().GET('/planner-approval')),
    set: (body: PlannerApprovalRequest) => settle(client().PUT('/planner-approval', { body })),
    switchOff: (reason: string) =>
      settle(client().POST('/planner-approval/switch-off', { body: { reason } })),
  };
}

export type PlannerApprovalApi = ReturnType<typeof plannerApprovalApi>;
