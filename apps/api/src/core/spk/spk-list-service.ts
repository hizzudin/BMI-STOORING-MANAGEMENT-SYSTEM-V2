import type {
  SpkListItem,
  SpkListQuery,
  SpkListResponse,
  SpkTabCounts,
  Actor,
} from '@bmi/shared';
import type { SpkGateway } from '../../ports/spks.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { and, eq, inArray, ilike, or, sql, type SQL } from 'drizzle-orm';
import { SPK_STATUSES, SPK_CATEGORIES, type SpkStatus, type SpkCategory } from '@bmi/shared';
import type { SpkRow } from '../../ports/spks.js';
import { SPK_POLICIES, allowedActions } from '../spk/spk-service.js';

interface SpkListFilters {
  tab?: string;
  search?: string;
  type?: string;
  vehicleId?: number;
}

interface TabStatusMap {
  [key: string]: SpkStatus[];
}

const TAB_STATUS_MAP: TabStatusMap = {
  active: ['Active', 'In_Progress', 'Pending_Verification', 'Pending_Amendment'],
  mine: [], // Special handling - steps where user is executor/assignee
  draft: ['Draft'],
  pending: ['Pending_Approval'],
  rejected: ['Rejected'],
  completed: ['Completed'],
  cancelled: ['Cancelled'],
  all: [...SPK_STATUSES],
};

export class SpkListService {
  constructor(private readonly unitOfWork: UnitOfWork<{ spks: SpkGateway }>) {}

  async list(actor: Actor, query: SpkListQuery): Promise<{
    items: SpkListItem[];
    tabCounts: SpkTabCounts;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    return this.unitOfWork.run(async ({ spks }) => {
      const { tab = 'active', search, type, vehicleId, page = 1, pageSize = 20 } = query;

      // Build WHERE conditions
      const where = await this.buildWhere(actor, { tab, search, type, vehicleId });

      // Get tab counts
      const tabCounts = await this.getTabCounts(actor, spks);

      // Count total
      const total = await spks.countList(where);

      // Get paginated items
      const offset = (page - 1) * pageSize;
      const items = await spks.findList(where, { offset, limit: pageSize });

      return {
        items: items.map((row) => this.toSpk(row, actor)),
        tabCounts,
        pagination: {
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
          total,
          totalPages: Math.ceil(total / (query.pageSize ?? 20)),
        },
      };
    });
  }

  private async buildWhere(
    actor: Actor,
    filters: { tab?: string; search?: string; type?: string; vehicleId?: number }
  ): Promise<SQL> {
    const conditions: SQL[] = [];

    // Tab filter
    if (filters.tab && filters.tab !== 'all') {
      const statuses = TAB_STATUS_MAP[filters.tab];
      if (filters.tab === 'mine') {
        // Special handling for 'mine' - handled separately
      } else if (statuses && statuses.length > 0) {
        conditions.push(sql`spks.status IN (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`);
      }
    }

    // Search filter
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        sql`(
          spks.spk_number ILIKE ${filters.search} OR
          spks.title ILIKE ${searchTerm} OR
          vehicles.license_plate ILIKE ${searchTerm}
        )`
      );
    }

    // Type filter
    if (filters.type) {
      conditions.push(sql`spks.category = ${filters.type}`);
    }

    // Vehicle filter
    if (filters.vehicleId) {
      conditions.push(sql`spks.vehicle_id = ${filters.vehicleId}`);
    }

    // Only non-deleted
    conditions.push(sql`spks.deleted_at IS NULL`);

    return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  }

  private async getTabCounts(actor: Actor, spks: SpkGateway): Promise<SpkTabCounts> {
    const counts: Record<string, number> = {};

    for (const tab of ['active', 'mine', 'draft', 'pending', 'rejected', 'completed', 'cancelled', 'all']) {
      if (tab === 'mine') {
        counts[tab] = await spks.countMine(actor);
      } else if (tab === 'all') {
        counts[tab] = await spks.countAllNonDeleted();
      } else {
        const statuses = TAB_STATUS_MAP[tab];
        if (statuses && statuses.length > 0) {
          counts[tab] = await spks.countByStatuses(statuses);
        } else {
          counts[tab] = 0;
        }
      }
    }

    return counts as SpkTabCounts;
  }

  private toSpk(row: SpkRow, actor: Actor): SpkListItem {
    return {
      id: row.id,
      spkNumber: row.spkNumber,
      vehicle: { ...row.vehicle },
      title: row.title,
      category: row.category as 'PM' | 'Corrective' | 'Tyre' | 'Document' | 'Other',
      requiresDowntime: row.requiresDowntime,
      requestSource: row.requestSource,
      priority: row.priority as 'Low' | 'Normal' | 'High' | 'Urgent',
      description: row.description,
      status: row.status as 'Active' | 'Draft' | 'Pending_Approval' | 'Rejected' | 'In_Progress' | 'Pending_Verification' | 'Pending_Amendment' | 'Completed' | 'Cancelled',
      stepCount: row.stepCount,
      version: row.version,
      allowedActions: (row.allowedActions ?? []) as ('edit' | 'submit')[],
      currentStep: null,
      waitingOn: null,
    };
  }
}