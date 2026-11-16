import {
  SPK_TABS,
  type Role,
  type Spk,
  type SpkDetail,
  type SpkDetailStep,
  type SpkListItem,
  type SpkListQuery,
  type SpkListResponse,
  type SpkPriority,
  type SpkStatus,
  type SpkTab,
  type SpkTabCounts,
} from '@bmi/shared';
import type {
  PersonRow,
  SpkGateway,
  SpkGateways,
  SpkListFilter,
  SpkListRow,
  SpkRow,
  SpkStepRow,
} from '../../ports/spks.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { ActionRefusedError, allowedActions, NOT_ALLOWED, type Actor } from '../iam/actions.js';
import { SPK_POLICIES, SpkNotFoundError } from './spk-service.js';

/** REQ-SPK-010: the statuses of each tab; My steps and All take every status. */
const TAB_STATUSES: Record<Exclude<SpkTab, 'mine' | 'all'>, readonly SpkStatus[]> = {
  active: ['Active', 'In_Progress', 'Pending_Verification', 'Pending_Amendment'],
  draft: ['Draft'],
  pending: ['Pending_Approval'],
  rejected: ['Rejected'],
  completed: ['Completed'],
  cancelled: ['Cancelled'],
};

const roleLabel = (role: Role) => role.replace(/_/g, ' ');
const personLabel = (person: PersonRow) =>
  person.role ? `${roleLabel(person.role)} ${person.name}` : person.name;
const iso = (date: Date | null) => (date ? date.toISOString() : null);
const cents = (amount: string) => Math.round(Number(amount) * 100);

/** REQ-SPK-010, REQ-SPK-011, REQ-SPK-015, DEC-127: SPKList and SPKDetail (read only). */
export class SpkListService {
  constructor(private readonly unitOfWork: UnitOfWork<SpkGateways>) {}

  list(actor: Actor, query: SpkListQuery): Promise<SpkListResponse> {
    this.requireView(actor);
    return this.unitOfWork.run(async ({ spks }) => {
      const common: SpkListFilter = {
        ...(query.search ? { search: query.search } : {}),
        ...(query.type ? { category: query.type } : {}),
        ...(query.vehicleId !== undefined ? { vehicleId: query.vehicleId } : {}),
      };
      const filterOf = (tab: SpkTab): SpkListFilter => {
        if (tab === 'all') return common;
        if (tab === 'mine') {
          const roles = actor.user.role ? [actor.user.role] : [];
          return { ...common, mineOf: { userId: actor.user.id, roles } };
        }
        return { ...common, statuses: TAB_STATUSES[tab] };
      };
      const tabCounts = await this.counts(spks, filterOf);
      const total = tabCounts[query.tab];
      const rows = await spks.listPage(filterOf(query.tab), {
        offset: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
      });
      // DEC-128: a Rejected SPK shows its reason until SPKRejected (TASK-123).
      const reasons = await spks.rejectionReasons(
        rows.filter((row) => row.status === 'Rejected').map((row) => row.id),
      );
      return {
        items: rows.map((row) => this.item(actor, row, reasons.get(row.id))),
        tabCounts,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
        vehicles: await spks.vehiclesWithSpks(),
        allowedActions: actor.capabilities.has('spk.create') ? ['create'] : [],
      };
    });
  }

  detail(actor: Actor, id: number): Promise<SpkDetail> {
    this.requireView(actor);
    return this.unitOfWork.run(async ({ spks }) => {
      const row = await spks.detail(id);
      if (!row) throw new SpkNotFoundError();
      const { labor, parts, document, stooring } = row.costs;
      const total = [labor, parts, document, stooring].reduce((sum, c) => sum + cents(c), 0);
      return {
        spk: this.spk(actor, row),
        vehicle: {
          id: row.vehicle.id,
          licensePlate: row.vehicle.licensePlate,
          className: row.vehicle.className,
          unitKind: row.vehicleUnitKind,
          currentOdometer: row.vehicleOdometer,
        },
        createdBy: row.creator,
        steps: row.steps.map(step),
        approvals: row.approvals.map((approval) => ({
          ...approval,
          actedAt: approval.actedAt.toISOString(),
        })),
        costs: { labor, parts, document, stooring, total: (total / 100).toFixed(2) },
      };
    });
  }

  /** Every tab counts under the same search, type and vehicle (DEC-127). */
  private async counts(
    spks: SpkGateway,
    filterOf: (tab: SpkTab) => SpkListFilter,
  ): Promise<SpkTabCounts> {
    // One after another: the queries share the transaction's connection.
    const counts: Partial<SpkTabCounts> = {};
    for (const tab of SPK_TABS) counts[tab] = await spks.countMatching(filterOf(tab));
    return counts as SpkTabCounts;
  }

  private item(actor: Actor, row: SpkListRow, rejection?: string): SpkListItem {
    const current = row.currentStep;
    return {
      ...this.spk(actor, row),
      currentStep: current
        ? { sequenceNo: current.sequenceNo, name: current.name, status: current.status }
        : null,
      waitingOn: rejection === undefined ? waitingOn(row) : `Rejected: ${rejection}`,
    };
  }

  private spk(actor: Actor, row: SpkRow): Spk {
    return {
      id: row.id,
      spkNumber: row.spkNumber,
      vehicle: { ...row.vehicle },
      title: row.title,
      category: row.category,
      priority: row.priority as SpkPriority,
      requiresDowntime: row.requiresDowntime,
      description: row.description,
      requestSource: row.requestSource,
      status: row.status,
      stepCount: row.stepCount,
      version: row.version,
      allowedActions: allowedActions(SPK_POLICIES, actor, row),
    };
  }

  private requireView(actor: Actor): void {
    if (!actor.capabilities.has('spk.view')) throw new ActionRefusedError('view', NOT_ALLOWED);
  }
}

/** specs/design.md 5.11: who the SPK waits on, from its status and its current step. */
function waitingOn(row: SpkListRow): string | null {
  const current = row.currentStep;
  switch (row.status) {
    case 'Draft':
    case 'Rejected':
    case 'Pending_Amendment':
      return personLabel(row.creator);
    case 'Pending_Approval':
      return 'Approvers';
    case 'Active':
    case 'In_Progress':
      if (!current) return null;
      return current.assignee
        ? personLabel(current.assignee)
        : current.executorRoles.map(roleLabel).join(', ');
    case 'Pending_Verification':
      return current ? roleLabel(current.verifierRole) : null;
    default:
      return null;
  }
}

function step(row: SpkStepRow): SpkDetailStep {
  return {
    id: row.id,
    sequenceNo: row.sequenceNo,
    name: row.name,
    status: row.status,
    executorRoles: row.executorRoles,
    assignee: row.assignee,
    openedAt: iso(row.openedAt),
    submittedAt: iso(row.submittedAt),
    verifiedAt: iso(row.verifiedAt),
    verifiedBy: row.verifiedBy,
  };
}
