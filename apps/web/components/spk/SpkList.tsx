'use client';

import {
  SPK_CATEGORIES,
  SPK_PAGE_SIZES,
  type SpkCategory,
  type SpkListItem,
  type SpkListQuery,
  type SpkListResponse,
  type SpkTab,
} from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Icon } from '../kit/Icon';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';
import { PRIORITY_TONES, STATUS_TONES, statusText } from './spk-format';

const TABS: { key: SpkTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'mine', label: 'My steps' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending approval' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const FIRST: SpkListQuery = { tab: 'active', page: 1, pageSize: 20 };

/** The query string of the list request: only what is set. */
function queryOf(query: SpkListQuery) {
  return {
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.vehicleId !== undefined ? { vehicleId: query.vehicleId } : {}),
  };
}

/**
 * SPKList (REQ-SPK-010, REQ-SPK-015, DEC-127): tabs with counts, search, type and vehicle, one page
 * from the server. Open goes to Create SPK when the row allows `edit`; every other row offers View.
 */
export function SpkList({ api, initialTab }: { api: SpksApi; initialTab?: SpkTab }) {
  const [query, setQuery] = useState<SpkListQuery>({ ...FIRST, tab: initialTab ?? FIRST.tab });
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState<SpkListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void api.list(queryOf(query)).then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setData(outcome.data);
        setError(null);
      } else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, query]);

  // C-33: the search runs once typing pauses.
  useEffect(() => {
    const search = searchText.trim();
    const timer = setTimeout(() => {
      setQuery((q) =>
        (q.search ?? '') === search ? q : { ...q, page: 1, search: search || undefined },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const change = (next: Partial<SpkListQuery>) => setQuery((q) => ({ ...q, page: 1, ...next }));
  const pagination = data?.pagination;

  return (
    <>
      <PageHead
        title="Surat Perintah Kerja"
        actions={
          <>
            <input
              type="search"
              className="input search head-search"
              placeholder="Search SPK, plate, title"
              aria-label="Search SPK, plate, title"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {data?.allowedActions.includes('create') && (
              <a className="btn btn-primary" href="/spk/new">
                <Icon name="plus" size={16} />
                Create SPK
              </a>
            )}
          </>
        }
      />
      <div className="tabs" role="tablist" aria-label="SPK tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === query.tab}
            className={tab.key === query.tab ? 'tab on' : 'tab'}
            onClick={() => change({ tab: tab.key })}
          >
            {tab.label}
            {data && data.tabCounts[tab.key] > 0 && (
              <span className="tab-count">{data.tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>
      <div className="bar bar-start list-filters">
        <select
          className="input auto"
          aria-label="Type"
          value={query.type ?? ''}
          onChange={(event) =>
            change({ type: (event.target.value || undefined) as SpkCategory | undefined })
          }
        >
          <option value="">All types</option>
          {SPK_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          className="input auto"
          aria-label="Vehicle"
          value={query.vehicleId ?? ''}
          onChange={(event) =>
            change({ vehicleId: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">All vehicles</option>
          {data?.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.licensePlate}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="refusal" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SPK</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Current step</th>
                  <th>Waiting on</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No SPK matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination && (
            <div className="bar pager">
              <span className="small muted">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <span className="grow" />
              <select
                className="input auto"
                aria-label="Rows per page"
                value={query.pageSize}
                onChange={(event) => change({ pageSize: Number(event.target.value) })}
              >
                {SPK_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={query.page <= 1}
                onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={query.page >= pagination.totalPages}
                onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Row({ item }: { item: SpkListItem }) {
  // DEC-127: Open edits a Draft of its creator; every other row is View. DEC-129: a Rejected SPK
  // opens SPKRejected, where its creator chooses Edit and resubmit or Cancel SPK.
  const opens = item.allowedActions.includes('edit');
  const href = opens && item.status !== 'Rejected' ? `/spk/${item.id}/edit` : `/spk/${item.id}`;
  const step = item.currentStep;
  return (
    <tr>
      <td>
        <span className="nowrap">
          <a className="b" href={href}>
            {item.spkNumber}
          </a>{' '}
          <StatusPill tone={PRIORITY_TONES[item.priority]}>{item.priority}</StatusPill>
        </span>
      </td>
      <td>
        <a className="b nowrap" href={`/vehicles/${item.vehicle.id}`}>
          {item.vehicle.licensePlate}
        </a>
      </td>
      <td>{item.category}</td>
      <td>
        <StatusPill tone={STATUS_TONES[item.status]}>{statusText(item.status)}</StatusPill>
      </td>
      <td>{step ? `Step ${step.sequenceNo} ${step.name}` : '—'}</td>
      <td>{item.waitingOn ?? '—'}</td>
      <td>
        <a className="btn" href={href}>
          {opens ? 'Open' : 'View'}
        </a>
      </td>
    </tr>
  );
}
