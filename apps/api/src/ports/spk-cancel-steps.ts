/**
 * TX-14, DEC-140: the steps of an approver cancel (T15) before the SPK is set Cancelled, called in
 * this order inside the cancel's transaction. Each is filled by the task that owns its tables;
 * until then the adapter does nothing.
 */
export interface SpkCancelSteps {
  /** TASK-308: reverse the posted goods issues of the SPK (TX-05 without verification, DEC-58). */
  reversePostedIssues(spkId: number, by: number): Promise<void>;
  /** TASK-502: return the tyres Issued to the SPK to In_Stock. */
  releaseIssuedTyres(spkId: number, by: number): Promise<void>;
  /** TASK-313: list the items bought in a Part Purchase step for the Warehouse Manager. */
  listPurchasedItems(spkId: number): Promise<void>;
  /** TASK-612: the schedule card leaves the open lists. */
  leaveOpenSchedule(spkId: number): Promise<void>;
  /** TASK-610: a linked Report Breakdown goes back to New (TX-24). */
  reopenReportBreakdown(spkId: number): Promise<void>;
}
