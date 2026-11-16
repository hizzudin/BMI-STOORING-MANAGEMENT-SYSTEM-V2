'use client';

import {
  VENDOR_KINDS,
  VendorRequestSchema,
  VendorUpdateRequestSchema,
  type Vendor,
  type VendorKind,
  type VendorListResponse,
} from '@bmi/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { VendorsApi } from '../../lib/vendors-api';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { DataTable, type Column } from '../kit/DataTable';
import { Icon } from '../kit/Icon';
import { Field, Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';

/** The panel's working copy. */
interface Draft {
  id: number | null;
  code: string;
  name: string;
  kind: VendorKind;
  phone: string;
  address: string;
  isActive: boolean;
}

const BLANK: Draft = {
  id: null,
  code: '',
  name: '',
  kind: 'Supplier',
  phone: '',
  address: '',
  isActive: true,
};

const draftOf = (vendor: Vendor): Draft => ({
  id: vendor.id,
  code: vendor.code,
  name: vendor.name,
  kind: vendor.kind,
  phone: vendor.phone ?? '',
  address: vendor.address ?? '',
  isActive: vendor.isActive,
});

/** An empty optional field is no value. */
const orNull = (text: string) => (text.trim() === '' ? null : text);

type Confirm = { kind: 'none' } | { kind: 'discard'; go: () => void } | { kind: 'deactivate' };

/** SettingsVendors (REQ-INV-014, DEC-134): the vendor master of the System Admin. */
export function Vendors({ api }: { api: VendorsApi }) {
  const [page, setPage] = useState<VendorListResponse | null>(null);
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
      const vendors = outcome.data.vendors;
      setDraft((current) => {
        if (current && select === undefined) return current;
        const chosen = vendors.find((v) => v.id === select) ?? vendors[0];
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
      title="Vendors"
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
  const stored = page.vendors.find((v) => v.id === draft.id) ?? null;
  const first = page.vendors[0];
  const isNew = draft.id === null;

  const columns: Column<Vendor>[] = [
    {
      key: 'name',
      label: 'Vendor',
      value: (v) => v.name,
      searchable: true,
      render: (v) => (
        <span className="nowrap">
          {v.name} {!v.isActive && <StatusPill tone="neutral">Inactive</StatusPill>}
        </span>
      ),
    },
    { key: 'kind', label: 'Kind', value: (v) => v.kind },
    { key: 'phone', label: 'Phone', value: (v) => v.phone ?? '-' },
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

  /** C-17: the page checks, one save with an audit record, then Saved. */
  const save = async () => {
    setSaved(false);
    const fields = {
      name: draft.name,
      kind: draft.kind,
      phone: orNull(draft.phone),
      address: orNull(draft.address),
    };
    let result;
    if (isNew) {
      const parsed = VendorRequestSchema.safeParse({ code: draft.code, ...fields });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      setBusy(true);
      result = await api.create(parsed.data);
    } else {
      const parsed = VendorUpdateRequestSchema.safeParse(fields);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      if (draft.id === null) return undefined;
      setBusy(true);
      result = await api.update(draft.id, parsed.data);
    }
    setBusy(false);
    if (!result.ok) return setError(result.message);
    reset(draftOf(result.data.vendor));
    setSaved(true);
    return load(result.data.vendor.id);
  };

  /** C-32 Deactivate after its confirmation; DEC-134 Activate again. */
  const setActive = async (active: boolean) => {
    setConfirm({ kind: 'none' });
    if (draft.id === null) return;
    setBusy(true);
    const outcome = active ? await api.activate(draft.id) : await api.deactivate(draft.id);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    setDirty(false);
    await load(draft.id);
  };

  return (
    <>
      {head(
        allowed.has('create') && (
          <Button variant="primary" onClick={() => leave(() => reset(BLANK))}>
            <Icon name="plus" size={16} />
            New vendor
          </Button>
        ),
      )}
      <div className="master-detail">
        <DataTable
          rows={page.vendors}
          columns={columns}
          rowKey={(v) => String(v.id)}
          selectedKey={draft.id === null ? undefined : String(draft.id)}
          onSelect={(v) => leave(() => reset(draftOf(v)))}
        />
        <section className="panel" aria-label="Vendor">
          {(isNew || !draft.isActive) && (
            <div className="panel-tag">
              {isNew ? (
                <StatusPill tone="info">New</StatusPill>
              ) : (
                <StatusPill tone="neutral">Inactive</StatusPill>
              )}
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
          <Field label="Vendor">
            {(id) => (
              <input
                id={id}
                className="input"
                value={draft.name}
                onChange={(e) => edit({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Kind">
            {(id) => (
              <select
                id={id}
                className="input"
                value={draft.kind}
                onChange={(e) => edit({ kind: e.target.value as VendorKind })}
              >
                {VENDOR_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Phone">
            {(id) => (
              <input
                id={id}
                className="input"
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => edit({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="Address">
            {(id) => (
              <textarea
                id={id}
                className="input"
                rows={2}
                value={draft.address}
                onChange={(e) => edit({ address: e.target.value })}
              />
            )}
          </Field>
          <Refusal message={error} />
          {saved && (
            <p className="small muted" role="status">
              Saved.
            </p>
          )}
          <div className="bar">
            {!isNew && draft.isActive && allowed.has('deactivate') && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'deactivate' })}
              >
                Deactivate
              </Button>
            )}
            {!isNew && !draft.isActive && allowed.has('activate') && (
              <Button disabled={busy} onClick={() => void setActive(true)}>
                Activate
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
          body="The vendor goes back to what was saved."
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
          body="It is no longer offered for picking; records that already name it keep it."
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          onCancel={() => setConfirm({ kind: 'none' })}
          onConfirm={() => void setActive(false)}
        />
      )}
      {guard.dialog}
    </>
  );
}
