'use client';

import {
  formatDateTimeWib,
  type ApprovalInboxItem,
  type ApprovalInboxQuery,
  type InboxKind,
} from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { ApprovalsApi } from '../../lib/approvals-api';
import { StatusPill } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';
import { PRIORITY_TONES, personText, roleText } from '../spk/spk-format';
import { ApprovalsTabs, waitingText } from './approval-format';

/** DEC-128: the chips shown in phase 1; Amendment and Completion come with TASK-611 and TASK-210. */
const CHIPS: { kind: InboxKind | undefined; label: string }[] = [
  { kind: undefined, label: 'All' },
  { kind: 'Creation', label: 'Creation' },
];

/**
 * Approvals, Surat Perintah Kerja tab (REQ-APR-002, REQ-APR-004, REQ-APR-006, DEC-128): the waiting
 * SPKs in the order the server sends (Urgent and High first, then the longest waiting), a preview of
 * the selected row, and Open review on each row and in the preview.
 */
export function ApprovalsInbox({ api }: { api: ApprovalsApi }) {
  const [kind, setKind] = useState<InboxKind | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ApprovalInboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    const query: ApprovalInboxQuery = {
      ...(kind ? { kind } : {}),
      ...(search ? { search } : {}),
    };
    void api.inbox(query).then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setItems(outcome.data.items);
        setError(null);
      } else setError(outcome.message);
    });
    return () => {
      current = false;
    };
  }, [api, kind, search]);

  // C-33: the search runs once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const selected = items?.find((item) => item.spkId === selectedId) ?? items?.[0] ?? null;

  return (
    <>
      <PageHead title="Approvals" />
      <ApprovalsTabs current="spk" />
      <div className="bar bar-start list-filters">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={chip.kind === kind ? 'chip on' : 'chip'}
            aria-pressed={chip.kind === kind}
            onClick={() => setKind(chip.kind)}
          >
            {chip.label}
          </button>
        ))}
        <input
          type="search"
          className="input search auto"
          placeholder="Search SPK, plate"
          aria-label="Search SPK, plate"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>
      {error && (
        <p className="refusal" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className="muted">Nothing is waiting for your decision.</p>
      )}
      {items && items.length > 0 && (
        <div className="master-detail wide">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SPK</th>
                  <th>Vehicle</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Approval</th>
                  <th>Requested by</th>
                  <th>Submitted</th>
                  <th>Waiting</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.spkId}
                    className={item.spkId === selected?.spkId ? 'selectable sel' : 'selectable'}
                    aria-selected={item.spkId === selected?.spkId}
                    onClick={() => setSelectedId(item.spkId)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedId(item.spkId);
                    }}
                  >
                    <td>
                      <span className="nowrap">
                        <a className="b" href={`/spk/${item.spkId}`}>
                          {item.spkNumber}
                        </a>{' '}
                        <StatusPill tone={PRIORITY_TONES[item.priority]}>
                          {item.priority}
                        </StatusPill>
                        {item.yours && (
                          <>
                            {' '}
                            <StatusPill tone="neutral">Yours</StatusPill>
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <a className="nowrap" href={`/vehicles/${item.vehicle.id}`}>
                        {item.vehicle.licensePlate}
                      </a>
                    </td>
                    <td>{item.title}</td>
                    <td>{item.category}</td>
                    <td>
                      <StatusPill tone="warning">{item.kind}</StatusPill>
                    </td>
                    <td>{personText(item.requestedBy)}</td>
                    <td className="nowrap">{formatDateTimeWib(new Date(item.submittedAt))}</td>
                    <td className="nowrap">{waitingText(item.waitingSeconds)}</td>
                    <td>
                      <a className="btn" href={`/approvals/spk/${item.spkId}`}>
                        Open review
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && <Preview item={selected} />}
        </div>
      )}
    </>
  );
}

/** REQ-APR-004: the key data of the selected item; the decision is made on the review page. */
function Preview({ item }: { item: ApprovalInboxItem }) {
  return (
    <section className="panel preview" aria-label="Preview">
      <h2 className="title-row">
        {item.spkNumber}{' '}
        <StatusPill tone={PRIORITY_TONES[item.priority]}>{item.priority}</StatusPill>
      </h2>
      <p className="small muted">
        {item.kind} · requested by {personText(item.requestedBy)} · waiting{' '}
        {waitingText(item.waitingSeconds)}
      </p>
      <dl className="kv-list">
        <dt>Title</dt>
        <dd>{item.title}</dd>
        <dt>Vehicle</dt>
        <dd>
          {item.vehicle.licensePlate} · {item.vehicle.className} · {item.category}
        </dd>
        <dt>Description</dt>
        <dd>{item.description}</dd>
        <dt>Steps</dt>
        <dd>
          {item.steps.length === 0 ? (
            <span className="muted">No steps.</span>
          ) : (
            item.steps.map((step) => (
              <div key={step.sequenceNo}>
                {`${step.sequenceNo} ${step.name} · ${step.executorRoles.map(roleText).join(', ')}`}
              </div>
            ))
          )}
        </dd>
      </dl>
      <div className="bar">
        <span className="grow" />
        <a className="btn btn-primary" href={`/approvals/spk/${item.spkId}`}>
          Open review
        </a>
      </div>
    </section>
  );
}
