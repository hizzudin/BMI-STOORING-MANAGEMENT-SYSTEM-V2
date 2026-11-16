'use client';

import { AUDIT_PAGE_SIZES, type Pagination } from '@bmi/shared';

/** DEC-127: "Page n of m (total)", rows per page, Previous and Next, as SPKList shows them. */
export function Pager({
  pagination,
  onPage,
  onPageSize,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
  onPageSize?: (pageSize: number) => void;
}) {
  return (
    <div className="bar pager">
      <span className="small muted">
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
      </span>
      <span className="grow" />
      {onPageSize && (
        <select
          className="input auto"
          aria-label="Rows per page"
          value={pagination.pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {AUDIT_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
      >
        Previous
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPage(pagination.page + 1)}
      >
        Next
      </button>
    </div>
  );
}
