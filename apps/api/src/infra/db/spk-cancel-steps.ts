import type { SpkCancelSteps } from '../../ports/spk-cancel-steps.js';

/**
 * DEC-140: none of the tables these steps change exists yet, so each step does nothing until its
 * owning task replaces it (TASK-308, TASK-502, TASK-313, TASK-612, TASK-610).
 */
export class NoCancelStepsYet implements SpkCancelSteps {
  reversePostedIssues(): Promise<void> {
    return Promise.resolve();
  }
  releaseIssuedTyres(): Promise<void> {
    return Promise.resolve();
  }
  listPurchasedItems(): Promise<void> {
    return Promise.resolve();
  }
  leaveOpenSchedule(): Promise<void> {
    return Promise.resolve();
  }
  reopenReportBreakdown(): Promise<void> {
    return Promise.resolve();
  }
}
