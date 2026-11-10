'use client';

import { ChassisMap } from '@bmi/chassis-map';
import {
  AXLE_ROLES,
  AXLE_SPACINGS,
  FRONT_DRAWINGS,
  UNIT_KINDS,
  VehicleClassRequestSchema,
  type AxleRole,
  type AxleSpacing,
  type ChassisDefinition,
  type FrontDrawing,
  type UnitKind,
  type VehicleClass,
  type VehicleClassListResponse,
} from '@bmi/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { VehicleClassesApi } from '../../lib/vehicle-classes-api';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { DataTable, type Column } from '../kit/DataTable';
import { Icon } from '../kit/Icon';
import { Field, Refusal } from '../kit/SidePanel';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';

type Axle = ChassisDefinition['axles'][number];

/** The editor's working copy: the class fields (a new class only) and the layout definition. */
interface Draft {
  classId: number | null;
  code: string;
  name: string;
  unitKind: UnitKind;
  frontDrawing: FrontDrawing;
  axles: Axle[];
  /** As typed, so the field may be empty while editing; the layout reads it as a number. */
  spares: string;
}

const FRONT_LABELS: Record<FrontDrawing, string> = {
  None: 'None',
  Fifth_wheel: 'Fifth wheel',
  Kingpin: 'Kingpin',
};

const NEW_CLASS: Draft = {
  classId: null,
  code: '',
  name: '',
  unitKind: 'Powered',
  frontDrawing: 'None',
  axles: [{ role: 'Steer', tyresPerSide: 1 }],
  spares: '0',
};

function draftOf(vehicleClass: VehicleClass): Draft {
  const { definition } = vehicleClass.layout;
  return {
    classId: vehicleClass.id,
    code: vehicleClass.code,
    name: vehicleClass.name,
    unitKind: vehicleClass.unitKind,
    frontDrawing: definition.frontDrawing,
    axles: definition.axles.map((axle) => ({ ...axle })),
    spares: String(definition.spareCount),
  };
}

function definitionOf(draft: Draft): ChassisDefinition {
  const spares = Number.parseInt(draft.spares, 10);
  return {
    frontDrawing: draft.frontDrawing,
    spareCount: Number.isNaN(spares) || spares < 0 ? 0 : spares,
    axles: draft.axles,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const COLUMNS: Column<VehicleClass>[] = [
  { key: 'name', label: 'Class', value: (c) => c.name, searchable: true },
  { key: 'unitKind', label: 'Unit kind', value: (c) => c.unitKind },
  { key: 'axles', label: 'Axles', value: (c) => c.layout.axleCount, align: 'end' },
  {
    key: 'positions',
    label: 'Positions',
    value: (c) => {
      const spares = c.layout.definition.spareCount;
      return `${c.layout.tyreCount - spares} + ${plural(spares, 'spare')}`;
    },
  },
  { key: 'layout', label: 'Layout', value: (c) => `v${c.layout.version}` },
];

/** An axle keeps its spacing only after the first (DEC-119). */
function withSpacing(axles: Axle[]): Axle[] {
  return axles.map((axle, index) => {
    if (index === 0) return { role: axle.role, tyresPerSide: axle.tyresPerSide };
    return { ...axle, spacing: axle.spacing ?? 'Close' };
  });
}

/** ChassisLayouts (REQ-PLC-013, REQ-PLC-017, REQ-PLC-019, DEC-120): classes, layout editor, live preview. */
export function ChassisLayouts({ api }: { api: VehicleClassesApi }) {
  const [page, setPage] = useState<VehicleClassListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** C-16: what to do once the System Admin agrees to drop the changes. */
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = useLeaveGuard();
  const { setDirty: setGuardDirty } = guard;

  const load = useCallback(
    async (select?: number) => {
      const outcome = await api.list();
      if (!outcome.ok) return setLoadError(outcome.message);
      setPage(outcome.data);
      const chosen =
        outcome.data.classes.find((c) => c.id === select) ?? outcome.data.classes[0] ?? null;
      setDraft((current) => {
        if (current && select === undefined) return current;
        return chosen ? draftOf(chosen) : NEW_CLASS;
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
      title="Vehicle classes and chassis layouts"
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
  const definition = definitionOf(draft);
  const isNew = draft.classId === null;
  const current = page.classes.find((c) => c.id === draft.classId) ?? null;

  /** C-16: changes are dropped only after a confirmation. */
  const leave = (go: () => void) => (dirty ? setPending(() => go) : go());
  const edit = (change: Partial<Draft>) => {
    setDraft({ ...draft, ...change });
    setDirty(true);
    setError(null);
    setSaved(null);
  };
  const editAxle = (index: number, change: Partial<Axle>) =>
    edit({
      axles: draft.axles.map((axle, i) => (i === index ? ({ ...axle, ...change } as Axle) : axle)),
    });
  const addAxle = () => {
    const last = draft.axles[draft.axles.length - 1] ?? { role: 'Steer', tyresPerSide: 1 };
    edit({
      axles: [
        ...draft.axles,
        { role: last.role, tyresPerSide: last.tyresPerSide, spacing: 'Close' },
      ],
    });
  };
  const removeAxle = (index: number) =>
    edit({ axles: withSpacing(draft.axles.filter((_, i) => i !== index)) });

  const reset = (next: Draft) => {
    setDraft(next);
    setDirty(false);
    setError(null);
  };

  const save = async () => {
    setSaved(null);
    if (isNew) {
      const parsed = VehicleClassRequestSchema.safeParse({
        code: draft.code,
        name: draft.name,
        unitKind: draft.unitKind,
        definition,
      });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      setBusy(true);
      const outcome = await api.create(parsed.data);
      setBusy(false);
      if (!outcome.ok) return setError(outcome.message);
      const { vehicleClass } = outcome.data;
      setDirty(false);
      setError(null);
      setSaved(`Class ${vehicleClass.name} saved.`);
      setDraft(draftOf(vehicleClass));
      return load(vehicleClass.id);
    }
    if (draft.classId === null) return undefined;
    setBusy(true);
    const outcome = await api.newLayoutVersion(draft.classId, definition);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    const { vehicleClass } = outcome.data;
    setDirty(false);
    setError(null);
    setSaved(`Layout v${vehicleClass.layout.version} of ${vehicleClass.name} saved.`);
    setDraft(draftOf(vehicleClass));
    return load(vehicleClass.id);
  };

  return (
    <>
      {head(
        allowed.has('create') && (
          <Button variant="primary" onClick={() => leave(() => reset(NEW_CLASS))}>
            <Icon name="plus" size={16} />
            New class
          </Button>
        ),
      )}
      <div className="layout-editor">
        <DataTable
          rows={page.classes}
          columns={COLUMNS}
          rowKey={(c) => String(c.id)}
          selectedKey={draft.classId === null ? undefined : String(draft.classId)}
          onSelect={(c) => leave(() => reset(draftOf(c)))}
        />

        <section className="panel layout-panel" aria-label="Layout">
          {isNew ? (
            <>
              <Field label="Code">
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    value={draft.code}
                    onChange={(e) => edit({ code: e.target.value })}
                  />
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
              <Field label="Unit kind">
                {(id) => (
                  <select
                    id={id}
                    className="input"
                    value={draft.unitKind}
                    onChange={(e) => edit({ unitKind: e.target.value as UnitKind })}
                  >
                    {UNIT_KINDS.map((kind) => (
                      <option key={kind}>{kind}</option>
                    ))}
                  </select>
                )}
              </Field>
            </>
          ) : (
            <Field label="Class">
              {(id) => (
                <>
                  <input id={id} className="input" value={draft.name} readOnly />
                  {current && (
                    <div className="small muted">
                      {current.code} · {current.unitKind} · layout v{current.layout.version}; saving
                      makes v{current.layout.version + 1}, and vehicles on v{current.layout.version}{' '}
                      stay on v{current.layout.version}
                    </div>
                  )}
                </>
              )}
            </Field>
          )}
          <Field label="Front">
            {(id) => (
              <select
                id={id}
                className="input"
                value={draft.frontDrawing}
                onChange={(e) => edit({ frontDrawing: e.target.value as FrontDrawing })}
              >
                {FRONT_DRAWINGS.map((front) => (
                  <option key={front} value={front}>
                    {FRONT_LABELS[front]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="table-wrap">
            <table className="table axle-table">
              <thead>
                <tr>
                  <th scope="col">Axle</th>
                  <th scope="col">Role</th>
                  <th scope="col">Tyres per side</th>
                  <th scope="col">Spacing</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.axles.map((axle, index) => {
                  const n = index + 1;
                  return (
                    <tr key={n}>
                      <td>{n}</td>
                      <td>
                        <select
                          className="input"
                          aria-label={`Axle ${n} role`}
                          value={axle.role}
                          onChange={(e) => editAxle(index, { role: e.target.value as AxleRole })}
                        >
                          {AXLE_ROLES.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label={`Axle ${n} tyres per side`}
                          value={axle.tyresPerSide}
                          onChange={(e) =>
                            editAxle(index, { tyresPerSide: e.target.value === '1' ? 1 : 2 })
                          }
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </td>
                      <td>
                        {index === 0 ? (
                          '-'
                        ) : (
                          <select
                            className="input"
                            aria-label={`Axle ${n} spacing`}
                            value={axle.spacing ?? 'Close'}
                            onChange={(e) =>
                              editAxle(index, { spacing: e.target.value as AxleSpacing })
                            }
                          >
                            {AXLE_SPACINGS.map((spacing) => (
                              <option key={spacing}>{spacing}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Remove axle ${n}`}
                          disabled={draft.axles.length === 1}
                          onClick={() => removeAxle(index)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bar bar-start">
            <Button onClick={addAxle}>
              <Icon name="plus" size={16} />
              Add axle
            </Button>
          </div>
          <Field label="Spare positions">
            {(id) => (
              <input
                id={id}
                className="input"
                type="number"
                min={0}
                value={draft.spares}
                onChange={(e) => edit({ spares: e.target.value })}
              />
            )}
          </Field>
        </section>

        <div className="map-card">
          <ChassisMap
            definition={definition}
            title={`Layout preview, ${plural(definition.axles.length, 'axle')}`}
          />
        </div>
      </div>

      <div className="bar">
        <Refusal message={error} />
        {saved && (
          <p className="small muted" role="status">
            {saved}
          </p>
        )}
        <span className="grow" />
        <Button
          disabled={busy}
          onClick={() => leave(() => reset(current ? draftOf(current) : NEW_CLASS))}
        >
          Discard
        </Button>
        {(isNew ? allowed.has('create') : allowed.has('new_layout_version')) && (
          <Button variant="primary" disabled={busy} aria-busy={busy} onClick={() => void save()}>
            {isNew ? 'Save class' : 'Save as new layout version'}
          </Button>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title="Discard your changes?"
          body="The layout goes back to what was saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const go = pending;
            setPending(null);
            go();
          }}
        />
      )}
      {guard.dialog}
    </>
  );
}
