'use client';

import { formatDateTimeWib, type AccessHistoryResponse } from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { AuditApi } from '../../lib/audit-api';
import { Pager } from '../kit/Pager';
import { PageHead } from '../shell/AppShell';
import { AccessTabs } from './AccessTabs';

/** When as the artboard shows it: the WIB date and time to the minute. */
const whenText = (at: string) => formatDateTimeWib(new Date(at)).slice(0, 16);

/**
 * AMAccessHistory (REQ-IAM-003, FLW-AM-05): the access changes, newest first, in words; the full
 * trail is the Audit log, opened on its Access area.
 */
export function AccessHistory({ api }: { api: AuditApi }) {
  const [page, setPage] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState<AccessHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void api.accessHistory(page).then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setData(outcome.data);
        setError(null);
      } else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, page]);

  return (
    <>
      <PageHead title="Users and roles" />
      <AccessTabs current="history" />
      <div className="bar bar-start">
        <a className="b" href="/audit-log?area=Access">
          Full trail in Audit log
        </a>
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
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{whenText(item.at)}</td>
                    <td>{item.who ?? 'System'}</td>
                    <td className="wrap">{item.what}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No access change yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager
            pagination={data.pagination}
            onPage={(next) => setPage((current) => ({ ...current, page: next }))}
            onPageSize={(pageSize) => setPage({ page: 1, pageSize })}
          />
        </>
      )}
    </>
  );
}
