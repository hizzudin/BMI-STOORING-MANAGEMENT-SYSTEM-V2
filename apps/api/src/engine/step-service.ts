import {
  SPK_MACHINE,
  STEP_MACHINE,
  transition,
  type AsgStatus,
  type SpkStatus,
  type StepSubmitRequest,
  type StepSubmitResponse,
} from '@bmi/shared';
import { ActionRefusedError, assertAllowed, NOT_ALLOWED, type Actor } from '../core/iam/actions.js';
import { runIdempotent, type IdempotentResponse } from '../core/idempotency/run-idempotent.js';
import type { ClockPort } from '../ports/clock.js';
import type {
  EngineFileRow,
  EngineGateways,
  EngineSpkRow,
  EngineStepRow,
} from '../ports/engine.js';
import type { IdempotentRequest } from '../ports/idempotency.js';
import type { ModuleCatalog } from '../ports/registry.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { nextToOpen, spkMovesAfterSubmit } from './step-lifecycle.js';
import { STEP_MESSAGES, stepPolicies, submitConflict, type StepItem } from './step-policies.js';

/** HTTP 404. */
export class StepNotFoundError extends Error {
  constructor() {
    super(STEP_MESSAGES.stepNotFound);
    this.name = 'StepNotFoundError';
  }
}

/** HTTP 409: the state of the SPK, the step or a file does not allow the submit now. */
export class StepConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepConflictError';
  }
}

/** HTTP 400: the submit names a file it may not use. */
export class StepInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepInvalidError';
  }
}

/** DEC-139: a file that failed for good; its uploader is told after the rollback. */
export class FailedFileError extends StepInvalidError {
  constructor(readonly file: EngineFileRow) {
    super(failedFileSentence(file));
    this.name = 'FailedFileError';
  }
}

const fileName = (file: EngineFileRow) => file.originalName ?? `file ${file.id}`;

function failedFileSentence(file: EngineFileRow): string {
  return file.status === 'Expired'
    ? `The file ${fileName(file)} has expired. Upload it again and submit.`
    : `The file ${fileName(file)} failed: ${file.rejectReason ?? 'it could not be processed.'} Replace it and submit again.`;
}

/** The verifiers of a submit (REQ-NTF-005 matrix, "Step submitted"). */
const VERIFIER_ROLES = ['Planner', 'System_Admin'] as const;

const T7 = 'FirstStepStarted';
const T11 = 'LastStepSubmitted';

/** SM-STEP targets of Open and Submit are stored statuses (never the derived Paused). */
const stepTo = (from: AsgStatus, event: 'Open' | 'Submit') =>
  transition(STEP_MACHINE, from, event).to as AsgStatus;

/**
 * TASK-202, specs/design.md 5.25: the engine's step submit (REQ-ENG-001 to 003, BR-05, T7, T11,
 * DEC-139, DEC-145, DEC-146). One transaction under an Idempotency-Key; no module is imported (§8.3).
 */
export class StepService {
  private readonly policies: ReturnType<typeof stepPolicies>;

  constructor(
    private readonly unitOfWork: UnitOfWork<EngineGateways>,
    private readonly clock: ClockPort,
    private readonly catalog: ModuleCatalog,
  ) {
    this.policies = stepPolicies(catalog.executeCapabilities());
  }

  async submit(
    actor: Actor,
    spkId: number,
    stepId: number,
    request: StepSubmitRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    try {
      return await runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, (gateways) =>
        this.submitIn(gateways, actor, spkId, stepId, request),
      );
    } catch (error) {
      // DEC-139: the refusal rolled the submit back; the notice is its own unit of work.
      if (error instanceof FailedFileError) await this.notifyFailedFile(error.file);
      throw error;
    }
  }

  private async submitIn(
    gateways: EngineGateways,
    actor: Actor,
    spkId: number,
    stepId: number,
    request: StepSubmitRequest,
  ): Promise<{ status: number; body: StepSubmitResponse }> {
    // 1. One lock order: the SPK, its steps, the files.
    const spk = await gateways.steps.lockSpk(spkId);
    if (!spk) throw new StepNotFoundError();
    const steps = await gateways.steps.lockSteps(spkId);
    const step = steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new StepNotFoundError();

    // 2. The state, then 3. L1 and L2 (REQ-ENG-003).
    const item: StepItem = {
      spkStatus: spk.status,
      module: step.module,
      status: step.status,
      executorRoles: step.executorRoles,
      executeCapability: this.catalog.executeCapabilityOf(step.module),
    };
    const conflict = submitConflict(item);
    if (conflict) throw new StepConflictError(conflict);
    assertAllowed(this.policies, actor, item, 'submit');
    const role = actor.user.role;
    if (!role) throw new ActionRefusedError('submit', NOT_ALLOWED);

    // 4. DEC-139, REQ-FUP-006, REQ-FUP-009.
    const fileIds = [...new Set(request.fileIds)].sort((a, b) => a - b);
    await this.checkFiles(gateways, actor, fileIds);

    // DEC-149: the module's own hooks, on this transaction; a refusal or a throw rolls it all back.
    const now = this.clock.now();
    const bind = this.catalog.hooksOf(step.module);
    if (!bind) throw new ActionRefusedError('submit', STEP_MESSAGES.moduleNotAvailable);
    const hooks = bind(gateways.tx);
    const context = {
      spkId: spk.id,
      stepId: step.id,
      sequenceNo: step.sequenceNo,
      stepConfig: step.stepConfig,
      actor,
      fileIds,
      now,
    };
    const refusal = await hooks.validate(context);
    if (refusal) {
      throw refusal.status === 409
        ? new StepConflictError(refusal.sentence)
        : new StepInvalidError(refusal.sentence);
    }
    await hooks.submit(context);

    // 5. Submitted; only the next Locked step opens (BR-05); the notices.
    const submitted = stepTo(step.status, 'Submit');
    await gateways.steps.markSubmitted(step.id, { at: now, by: actor.user.id });
    if (fileIds.length > 0) await gateways.steps.attachFiles(fileIds, now);
    let after: EngineStepRow[] = steps.map((s) =>
      s.id === step.id ? { ...s, status: submitted } : s,
    );
    const next = after.find((s) => s.id === nextToOpen(after, step.sequenceNo));
    if (next) {
      const opened = stepTo(next.status, 'Open');
      await gateways.steps.open(next.id, now);
      after = after.map((s) => (s.id === next.id ? { ...s, status: opened } : s));
      await this.notifyOpened(gateways, spk, next);
    }
    await this.notifySubmitted(gateways, spk, step);

    // 6. T7, then T11, each through SM-SPK with its own version and audit record.
    let status: SpkStatus = spk.status;
    let version = spk.version;
    for (const target of spkMovesAfterSubmit(spk.status, after)) {
      const event = target === 'In_Progress' ? T7 : T11;
      const to = transition(SPK_MACHINE, status, event).to;
      await gateways.steps.moveSpk(spk.id, version, to, event === T7 ? now : undefined);
      await gateways.audit.write({
        entity: 'spk',
        entityId: spk.id,
        action: event === T7 ? 'start' : 'request_verification',
        before: { status },
        after: { status: to },
        userId: actor.user.id,
        userRole: role,
      });
      status = to;
      version += 1;
    }

    // 7. The step's own audit record (NFR-02).
    await gateways.audit.write({
      entity: 'spk_assignment',
      entityId: step.id,
      action: 'step_submit',
      before: { status: step.status },
      after: { status: submitted, fileIds },
      userId: actor.user.id,
      userRole: role,
    });

    return {
      status: 200,
      body: {
        spk: { id: spk.id, status, version },
        steps: after.map((s) => ({ id: s.id, sequenceNo: s.sequenceNo, status: s.status })),
      },
    };
  }

  /** The actor's unattached files; Rejected or Expired first (DEC-139), then Pending (409). */
  private async checkFiles(
    gateways: EngineGateways,
    actor: Actor,
    fileIds: readonly number[],
  ): Promise<void> {
    if (fileIds.length === 0) return;
    const files = await gateways.steps.lockFiles(fileIds);
    const usable = files.filter((file) => file.uploadedBy === actor.user.id && !file.attachedAt);
    if (usable.length !== fileIds.length) throw new StepInvalidError(STEP_MESSAGES.fileNotUsable);
    const failed = usable.find((file) => file.status === 'Rejected' || file.status === 'Expired');
    if (failed) throw new FailedFileError(failed);
    if (usable.some((file) => file.status === 'Pending')) {
      throw new StepConflictError(STEP_MESSAGES.pendingFile);
    }
  }

  /** REQ-FUP-006: one notice naming the file to fix; the key keeps it to one per file. */
  private notifyFailedFile(file: EngineFileRow): Promise<void> {
    return this.unitOfWork.run(({ notifications }) =>
      notifications.send([file.uploadedBy], {
        kind: 'Step',
        title: `Fix ${fileName(file)} to submit the step`,
        body: failedFileSentence(file),
        linkRecord: null,
        dedupeKey: `file:${file.id}:failed`,
      }),
    );
  }

  /** REQ-NTF-005 "Step opened": its assignee, or else the users of its executor roles. */
  private async notifyOpened(
    gateways: EngineGateways,
    spk: EngineSpkRow,
    step: EngineStepRow,
  ): Promise<void> {
    const recipients =
      step.assignedTo !== null
        ? [step.assignedTo]
        : await gateways.notifications.activeUsersWithRoles(step.executorRoles);
    await gateways.notifications.send(recipients, {
      kind: 'Step',
      title: `${spk.spkNumber} step ${step.sequenceNo} is open`,
      body: `${step.moduleName} · ${spk.licensePlate} · ${spk.title}`,
      linkRecord: `/spk/${spk.id}`,
      dedupeKey: `spk:${spk.id}:step:${step.id}:open:a${step.attemptNo}`,
    });
  }

  /** REQ-NTF-005 "Step submitted": the verifiers, Planners and the System Admin. */
  private async notifySubmitted(
    gateways: EngineGateways,
    spk: EngineSpkRow,
    step: EngineStepRow,
  ): Promise<void> {
    const recipients = await gateways.notifications.activeUsersWithRoles(VERIFIER_ROLES);
    await gateways.notifications.send(recipients, {
      kind: 'Step',
      title: `${spk.spkNumber} step ${step.sequenceNo} was submitted`,
      body: `${step.moduleName} · ${spk.licensePlate} · ${spk.title}`,
      linkRecord: `/spk/${spk.id}`,
      dedupeKey: `spk:${spk.id}:step:${step.id}:submitted:a${step.attemptNo}`,
    });
  }
}
