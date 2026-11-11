'use client';

import {
  DocumentTypeRequestSchema,
  DocumentTypeUpdateRequestSchema,
  type DocumentType,
  type DocumentTypeListResponse,
} from '@bmi/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { DocumentTypesApi } from '../../lib/document-types-api';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { DataTable, type Column } from '../kit/DataTable';
import { Icon } from '../kit/Icon';
import { Field, Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';

/** The panel's working copy; numbers stay as typed until Save checks them. */
interface Draft {
  id: number | null;
  code: string;
  name: string;
  validity: string;
  warningDays: string;
  receiptRequired: boolean;
  classIds: number[];
}

const BLANK: Draft = {
  id: null,
  code: '',
  name: '',
  validity: '',
  warningDays: '30',
  receiptRequired: true,
  classIds: [],
};

const draftOf = (type: DocumentType): Draft => ({
  id: type.id,
  code: type.code,
  name: type.name,
  validity: type.usualValidityMonths === null ? '' : String(type.usualValidityMonths),
  warningDays: String(type.warningDays),
  receiptRequired: type.receiptRequired,
  classIds: [...type.classIds],
});

/** An empty field is no value; anything else is read as a number for the schema to check. */
const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const numberOf = (text: string) => (text.trim() === '' ? null : Number(text));

type Confirm = { kind: 'none' } | { kind: 'discard'; go: () => void } | { kind: 'deactivate' };

/** DocumentTypes (REQ-DOC-001, REQ-DOC-002, DEC-20, DEC-121): the master of document types. */
export function DocumentTypes({ api }: { api: DocumentTypesApi }) {
  const [page, setPage] = useState<DocumentTypeListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>({ kind: 'none' });
  const guard = useLeaveGuard();
  const { setDirty: setGuardDirty } = guard;

  const load = useCallback(
    async (select?: number) => {
      const outcome = await api.list();
      if (!outcome.ok) return setLoadError(outcome.message);
      setPage(outcome.data);
      const types = outcome.data.documentTypes;
      setDraft((current) => {
        if (current && select === undefined) return current;
        const chosen = types.find((t) => t.id === select) ?? types[0];
        return chosen ? draftOf(chosen) : BLANK;
      });
      return undefined;
    },
    [api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setGuardDirty(dirty), [dirty, setGuardDirty]);

  const head = (actions?: ReactNode) => (
    <PageHead
      crumb="Settings"
      title="Document types"
      actions={
        <>
          <a className="btn btn-secondary" href="/settings">
            Back to Settings
          </a>
          {actions}
        </>
      }
    />
  );

  if (loadError) {
    return (
      <>
        {head()}
        <Refusal message={loadError} />
      </>
    );
  }
  if (!page || !draft) return head();

  const allowed = new Set(page.allowedActions);
  const className = (id: number) => page.classes.find((c) => c.id === id)?.name ?? '';
  const stored = page.documentTypes.find((t) => t.id === draft.id) ?? null;
  const first = page.documentTypes[0];
  const isNew = draft.id === null;
  // REQ-DOC-002: the vehicles of newly ticked classes have no document of this type yet.
  const newlyRequired = page.classes.filter(
    (c) => draft.classIds.includes(c.id) && !(stored?.classIds ?? []).includes(c.id),
  );
  const nonCompliant = newlyRequired.reduce((sum, c) => sum + c.vehicleCount, 0);

  const columns: Column<DocumentType>[] = [
    { key: 'name', label: 'Type', value: (t) => t.name, searchable: true },
    {
      key: 'classes',
      label: 'Required for',
      value: (t) => (t.classIds.length ? t.classIds.map(className).join(', ') : 'None'),
    },
    {
      key: 'validity',
      label: 'Validity',
      value: (t) => (t.usualValidityMonths === null ? '-' : `${t.usualValidityMonths} months`),
    },
    { key: 'warning', label: 'Warning days', value: (t) => t.warningDays, align: 'end' },
    {
      key: 'receipt',
      label: 'Receipt required',
      value: (t) => (t.receiptRequired ? 'Yes' : 'No'),
    },
  ];

  /** C-16: changes are dropped only after a confirmation. */
  const leave = (go: () => void) => (dirty ? setConfirm({ kind: 'discard', go }) : go());
  const reset = (next: Draft) => {
    setDraft(next);
    setDirty(false);
    setError(null);
  };
  const edit = (change: Partial<Draft>) => {
    setDraft({ ...draft, ...change });
    setDirty(true);
    setError(null);
    setSaved(false);
  };
  const toggleClass = (id: number) =>
    edit({
      classIds: draft.classIds.includes(id)
        ? draft.classIds.filter((c) => c !== id)
        : [...draft.classIds, id].sort((a, b) => a - b),
    });

  /** C-17: the page checks, one save with an audit record, then Saved. */
  const save = async () => {
    setSaved(false);
    const fields = {
      name: draft.name,
      usualValidityMonths: numberOf(draft.validity),
      warningDays: numberOf(draft.warningDays),
      receiptRequired: draft.receiptRequired,
      classIds: draft.classIds,
    };
    if (isNew) {
      const parsed = DocumentTypeRequestSchema.safeParse({ code: draft.code, ...fields });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      setBusy(true);
      const outcome = await api.create(parsed.data);
      setBusy(false);
      if (!outcome.ok) return setError(outcome.message);
      reset(draftOf(outcome.data.documentType));
      setSaved(true);
      return load(outcome.data.documentType.id);
    }
    if (draft.id === null) return undefined;
    const parsed = DocumentTypeUpdateRequestSchema.safeParse(fields);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
    setBusy(true);
    const outcome = await api.update(draft.id, parsed.data);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    reset(draftOf(outcome.data.documentType));
    setSaved(true);
    return load(outcome.data.documentType.id);
  };

  const deactivate = async () => {
    setConfirm({ kind: 'none' });
    if (draft.id === null) return;
    setBusy(true);
    const outcome = await api.deactivate(draft.id);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    setDirty(false);
    setDraft(null);
    await load(-1);
  };

  return (
    <>
      {head(
        allowed.has('create') && (
          <Button variant="primary" onClick={() => leave(() => reset(BLANK))}>
            <Icon name="plus" size={16} />
            New document type
          </Button>
        ),
      )}
      <div className="master-detail">
        <DataTable
          rows={page.documentTypes}
          columns={columns}
          rowKey={(t) => String(t.id)}
          selectedKey={draft.id === null ? undefined : String(draft.id)}
          onSelect={(t) => leave(() => reset(draftOf(t)))}
        />
        <section className="panel" aria-label="Document type">
          {isNew && (
            <div className="panel-tag">
              <StatusPill tone="info">New</StatusPill>
            </div>
          )}
          <Field label="Code">
            {(id) => (
              <>
                <input
                  id={id}
                  className="input"
                  value={draft.code}
                  readOnly={!isNew}
                  onChange={(e) => edit({ code: e.target.value })}
                />
                {!isNew && <div className="small muted">Fixed once saved</div>}
              </>
            )}
          </Field>
          <Field label="Name">
            {(id) => (
              <input
                id={id}
                className="input"
                value={draft.name}
                onChange={(e) => edit({ name: e.target.value })}
              />
            )}
          </Field>
          <div className="field-pair">
            <Field label="Usual validity (months)">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="number"
                  min={1}
                  value={draft.validity}
                  onChange={(e) => edit({ validity: e.target.value })}
                />
              )}
            </Field>
            <Field label="Warning days">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="number"
                  min={1}
                  value={draft.warningDays}
                  onChange={(e) => edit({ warningDays: e.target.value })}
                />
              )}
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.receiptRequired}
              onChange={(e) => edit({ receiptRequired: e.target.checked })}
            />
            Renewal receipt required
          </label>
          <fieldset className="field checks">
            <legend>Required for these classes</legend>
            {page.classes.length === 0 && (
              <p className="small muted">
                No vehicle classes yet: add them in Classes and chassis layouts.
              </p>
            )}
            {page.classes.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={draft.classIds.includes(c.id)}
                  onChange={() => toggleClass(c.id)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          {nonCompliant > 0 && (
            <div className="note warn" aria-live="polite">
              Saving makes {nonCompliant} {nonCompliant === 1 ? 'vehicle' : 'vehicles'} of{' '}
              {joinAnd(newlyRequired.filter((c) => c.vehicleCount > 0).map((c) => c.name))}{' '}
              non-compliant until each has {draft.name.trim() ? `a ${draft.name.trim()}` : 'one'}.
            </div>
          )}
          <Refusal message={error} />
          {saved && (
            <p className="small muted" role="status">
              Saved.
            </p>
          )}
          <div className="bar">
            {!isNew && allowed.has('deactivate') && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'deactivate' })}
              >
                Deactivate
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={() => {
                const back = stored ?? first;
                leave(() => reset(back ? draftOf(back) : BLANK));
              }}
            >
              Discard changes
            </Button>
            {(isNew ? allowed.has('create') : allowed.has('edit')) && (
              <Button
                variant="primary"
                disabled={busy}
                aria-busy={busy}
                onClick={() => void save()}
              >
                Save
              </Button>
            )}
          </div>
        </section>
      </div>

      {confirm.kind === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          body="The document type goes back to what was saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirm({ kind: 'none' })}
          onConfirm={() => {
            const { go } = confirm;
            setConfirm({ kind: 'none' });
            go();
          }}
        />
      )}
      {confirm.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${draft.name}?`}
          body="It is no longer offered for new documents; documents already entered keep it."
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          onCancel={() => setConfirm({ kind: 'none' })}
          onConfirm={() => void deactivate()}
        />
      )}
      {guard.dialog}
    </>
  );
}
