'use client';

import {
  AUDIT_AREAS,
  formatDateTimeWib,
  type AuditArea,
  type AuditExportFormat,
  type AuditLogDetail,
  type AuditLogItem,
  type AuditLogQuery,
  type AuditLogResponse,
} from '@bmi/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { AuditApi } from '../../lib/audit-api';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Pager } from '../kit/Pager';
import { Panel, Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';

type Filters = Omit<Partial<AuditLogQuery>, 'page' | 'pageSize'>;
type Query = Filters & { page: number; pageSize: number };

const roleText = (role: string | null | undefined) => (role ? role.replace(/_/g, ' ') : '');
const timeText = (at: string) => formatDateTimeWib(new Date(at));

/** Only the filters that are set: the query string of the list and of the export. */
function filtersOf(query: Filters): Filters {
  return {
    ...(query.userId !== undefined ? { userId: query.userId } : {}),
    ...(query.area ? { area: query.area } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };
}

/**
 * AuditLog (REQ-IAM-007, NFR-02, DEC-131): read only. User, Area and date filters (the last 7 days
 * by default), one page from the server, newest first; a row opens its full record; Export (C-26).
 */
export function AuditLog({ api, initialArea }: { api: AuditApi; initialArea?: AuditArea }) {
  const [query, setQuery] = useState<Query>({
    page: 1,
    pageSize: 20,
    ...(initialArea ? { area: initialArea } : {}),
  });
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let current = true;
    void api
      .list({ page: query.page, pageSize: query.pageSize, ...filtersOf(query) })
      .then((outcome) => {
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

  const change = (next: Filters) => setQuery((q) => ({ ...q, page: 1, ...next }));
  // A date filter keeps the other end the page shows, so the range stays what the user sees.
  const changeDate = (end: 'from' | 'to', value: string) =>
    change({
      from: query.from ?? data?.range.from,
      to: query.to ?? data?.range.to,
      [end]: value || undefined,
    });

  return (
    <>
      <PageHead
        title="Audit log"
        actions={
          <Button onClick={() => setExporting(true)}>
            <Icon name="download" size={16} />
            Export
          </Button>
        }
      />
      <div className="bar bar-start list-filters">
        <select
          className="input auto"
          aria-label="User"
          value={query.userId ?? ''}
          onChange={(event) =>
            change({ userId: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">All users</option>
          {data?.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select
          className="input auto"
          aria-label="Area"
          value={query.area ?? ''}
          onChange={(event) =>
            change({ area: (event.target.value || undefined) as AuditArea | undefined })
          }
        >
          <option value="">All areas</option>
          {AUDIT_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <label className="date-filter">
          <span className="small muted">From</span>
          <input
            type="date"
            className="input auto"
            aria-label="From"
            value={query.from ?? data?.range.from ?? ''}
            onChange={(event) => changeDate('from', event.target.value)}
          />
        </label>
        <label className="date-filter">
          <span className="small muted">To</span>
          <input
            type="date"
            className="input auto"
            aria-label="To"
            value={query.to ?? data?.range.to ?? ''}
            onChange={(event) => changeDate('to', event.target.value)}
          />
        </label>
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
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Area</th>
                  <th>Record</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Self</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <Row key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No audit record matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager
            pagination={data.pagination}
            onPage={(page) => setQuery((q) => ({ ...q, page }))}
            onPageSize={(pageSize) => setQuery((q) => ({ ...q, page: 1, pageSize }))}
          />
        </>
      )}
      {openId !== null && <RecordPanel api={api} id={openId} onClose={() => setOpenId(null)} />}
      {exporting && (
        <ExportDialog api={api} filters={filtersOf(query)} onClose={() => setExporting(false)} />
      )}
    </>
  );
}

function Row({ item, onOpen }: { item: AuditLogItem; onOpen: () => void }) {
  return (
    <tr className="selectable" onClick={onOpen}>
      <td>{timeText(item.at)}</td>
      <td>{item.user?.name ?? 'System'}</td>
      <td>{roleText(item.user?.role)}</td>
      <td>{item.area}</td>
      <td>
        <button
          type="button"
          className="link-button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {item.record}
        </button>
      </td>
      <td className="wrap">{item.before ?? '—'}</td>
      <td className="wrap">{item.after ?? '—'}</td>
      <td>{item.self && <StatusPill tone="warning">{item.self}</StatusPill>}</td>
    </tr>
  );
}

const jsonText = (value: unknown) =>
  value === null || value === undefined ? '—' : JSON.stringify(value, null, 2);

const personText = (user: AuditLogItem['user']) =>
  user ? [user.name, roleText(user.role)].filter(Boolean).join(', ') : 'System';

/** DEC-131: the full before and after and the reason of one record. */
function RecordPanel({ api, id, onClose }: { api: AuditApi; id: number; onClose: () => void }) {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void api.detail(id).then((outcome) => {
      if (!current) return;
      if (outcome.ok) setDetail(outcome.data);
      else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, id]);

  const item = detail?.item;
  return (
    <Panel label="Audit record" onClose={onClose}>
      <h2>{item?.record ?? 'Audit record'}</h2>
      <Refusal message={error} />
      {!detail && !error && <p className="muted">Loading…</p>}
      {item && detail && (
        <>
          <dl className="kv-list">
            <dt>Time</dt>
            <dd>{timeText(item.at)}</dd>
            <dt>User</dt>
            <dd>{personText(item.user)}</dd>
            <dt>Area</dt>
            <dd>{item.area}</dd>
            <dt>Action</dt>
            <dd>{item.action}</dd>
            {item.self && (
              <>
                <dt>Self</dt>
                <dd>
                  <StatusPill tone="warning">{item.self}</StatusPill>
                </dd>
              </>
            )}
            <dt>Reason</dt>
            <dd>{item.reason ?? <span className="muted">No reason given</span>}</dd>
          </dl>
          <h3 className="small">Before</h3>
          <pre className="json">{jsonText(detail.before)}</pre>
          <h3 className="small">After</h3>
          <pre className="json">{jsonText(detail.after)}</pre>
        </>
      )}
      <div className="bar">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Panel>
  );
}

/** C-26: the format, then the rows under the filters as a file; the server logs the export. */
function ExportDialog({
  api,
  filters,
  onClose,
}: {
  api: AuditApi;
  filters: Filters;
  onClose: () => void;
}) {
  const titleId = useId();
  const [format, setFormat] = useState<AuditExportFormat>('xlsx');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  const run = async () => {
    setBusy(true);
    const outcome = await api.exportFile({ format, ...filters });
    setBusy(false);
    if (!outcome.ok) {
      setRefusal(outcome.message);
      return;
    }
    const url = URL.createObjectURL(outcome.data.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = outcome.data.fileName;
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <h3 id={titleId}>Export</h3>
        <fieldset className="field checks">
          <legend>Format</legend>
          {(['xlsx', 'csv'] as const).map((option) => (
            <label key={option} className="check">
              <input
                type="radio"
                name="export-format"
                checked={format === option}
                onChange={() => setFormat(option)}
              />
              {option}
            </label>
          ))}
        </fieldset>
        <p className="muted">
          Exports the current table with its filters and only the columns you may see. The export is
          logged.
        </p>
        <Refusal message={refusal} />
        <div className="bar">
          <Button ref={cancelRef} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void run()}>
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}
