'use client';

import { ChassisMap } from '@bmi/chassis-map';
import {
  VehicleDeactivateRequestSchema,
  VehicleRequestSchema,
  VehicleUpdateRequestSchema,
  type Vehicle,
  type VehicleClassOption,
} from '@bmi/shared';
import { useEffect, useId, useState } from 'react';
import type { VehiclesApi } from '../../lib/vehicles-api';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { Icon } from '../kit/Icon';
import { Field, Refusal } from '../kit/SidePanel';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';
import { axlesAndTyres, km, noBaseline } from './vehicle-format';

/** The form's working copy; numbers stay as typed until Save checks them. */
interface Draft {
  licensePlate: string;
  vehicleClassId: string;
  odometer: string;
  vin: string;
  engineNumber: string;
  brand: string;
  model: string;
  year: string;
  fuelType: string;
}

const BLANK: Draft = {
  licensePlate: '',
  vehicleClassId: '',
  odometer: '',
  vin: '',
  engineNumber: '',
  brand: '',
  model: '',
  year: '',
  fuelType: '',
};

const draftOf = (v: Vehicle): Draft => ({
  licensePlate: v.licensePlate,
  vehicleClassId: String(v.vehicleClass.id),
  odometer: String(v.currentOdometer),
  vin: v.vin ?? '',
  engineNumber: v.engineNumber ?? '',
  brand: v.brand ?? '',
  model: v.model ?? '',
  year: v.year === null ? '' : String(v.year),
  fuelType: v.fuelType ?? '',
});

/** An empty number field is "not given"; anything else goes to the schema as typed. */
const numberOf = (text: string) => (text.trim() === '' ? null : Number(text.replace(/\./g, '')));

const TEXT_FIELDS = [
  ['vin', 'VIN'],
  ['engineNumber', 'Engine number'],
  ['brand', 'Brand'],
  ['model', 'Model'],
  ['year', 'Year'],
  ['fuelType', 'Fuel type'],
] as const;

type Mode = { kind: 'add' } | { kind: 'edit'; id: number };

/**
 * REQ-VEH-002 AddVehicle and REQ-VEH-003 VehicleEdit, with REQ-VEH-004 VehicleDeactivate.
 * DEC-122: the Customer field, the first documents and "Save and add parts" come with their
 * tasks (TASK-701, TASK-601, TASK-511); until then Save keeps the vehicle and opens it.
 */
export function VehicleForm({
  api,
  mode,
  navigate,
}: {
  api: VehiclesApi;
  mode: Mode;
  navigate: (path: string) => void;
}) {
  const [classes, setClasses] = useState<VehicleClassOption[] | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const guard = useLeaveGuard();
  const { setDirty } = guard;
  const editId = mode.kind === 'edit' ? mode.id : null;

  useEffect(() => {
    void (async () => {
      const list = await api.list();
      if (!list.ok) return setLoadError(list.message);
      setClasses(list.data.classes);
      if (editId === null) return undefined;
      const one = await api.get(editId);
      if (!one.ok) return setLoadError(one.message);
      setVehicle(one.data.vehicle);
      setDraft(draftOf(one.data.vehicle));
      return undefined;
    })();
  }, [api, editId]);

  const back = editId === null ? '/vehicles' : `/vehicles/${editId}`;
  const title = editId === null ? 'Add vehicle' : 'Edit vehicle';
  const crumb = editId === null ? 'Vehicles / New' : `Vehicles / ${vehicle?.licensePlate ?? ''}`;
  const canDeactivate = vehicle?.allowedActions.includes('deactivate') ?? false;

  const head = (
    <PageHead
      crumb={crumb}
      title={title}
      actions={
        canDeactivate && (
          <Button variant="danger" onClick={() => setDeactivating(true)}>
            Deactivate vehicle
          </Button>
        )
      }
    />
  );

  if (loadError) {
    return (
      <>
        {head}
        <Refusal message={loadError} />
      </>
    );
  }
  if (!classes || (editId !== null && !vehicle)) return head;
  if (vehicle && !vehicle.allowedActions.includes('edit')) {
    return (
      <>
        {head}
        <Refusal message="This vehicle cannot be edited." />
      </>
    );
  }

  const chosen = classes.find((c) => String(c.id) === draft.vehicleClassId) ?? null;
  // A vehicle keeps its layout version until its class changes (DEC-120).
  const layout =
    vehicle && String(vehicle.vehicleClass.id) === draft.vehicleClassId
      ? vehicle.layout
      : (chosen?.layout ?? null);
  const powered = (chosen?.unitKind ?? vehicle?.vehicleClass.unitKind) !== 'Towed';
  const classLocked = vehicle !== null && !vehicle.allowedActions.includes('change_class');

  const edit = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setDirty(true);
    setError(null);
  };

  const fields = () => ({
    licensePlate: draft.licensePlate,
    vin: draft.vin,
    engineNumber: draft.engineNumber,
    brand: draft.brand,
    model: draft.model,
    year: numberOf(draft.year),
    fuelType: draft.fuelType,
    vehicleClassId: draft.vehicleClassId === '' ? undefined : Number(draft.vehicleClassId),
  });

  const done = (id: number) => {
    setDirty(false);
    navigate(`/vehicles/${id}`);
  };

  const save = async () => {
    if (vehicle) {
      const parsed = VehicleUpdateRequestSchema.safeParse({
        ...fields(),
        reason,
        version: vehicle.version,
      });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      setBusy(true);
      const outcome = await api.update(vehicle.id, parsed.data);
      setBusy(false);
      return outcome.ok ? done(outcome.data.vehicle.id) : setError(outcome.message);
    }
    const parsed = VehicleRequestSchema.safeParse({
      ...fields(),
      odometer: powered ? numberOf(draft.odometer) : null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.');
    setBusy(true);
    const outcome = await api.create(parsed.data);
    setBusy(false);
    return outcome.ok ? done(outcome.data.vehicle.id) : setError(outcome.message);
  };

  /** C-16: changes are dropped only after a confirmation. */
  const cancel = () => (guard.dirty ? setDiscard(true) : navigate(back));

  return (
    <>
      {head}
      {vehicle?.classLock && (
        <div className="note warn vehicle-body">
          <Icon name="lock" size={18} />
          <div>{vehicle.classLock}</div>
        </div>
      )}
      <div className="grid g2 vehicle-body">
        <div className="card white">
          <h2>
            <span className="circle-ic">
              <Icon name="vehicles" size={18} />
            </span>
            Vehicle
          </h2>
          <div className="grid ge">
            <Field label="Plate">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  value={draft.licensePlate}
                  onChange={(e) => edit({ licensePlate: e.target.value })}
                />
              )}
            </Field>
            <Field label="Class">
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={draft.vehicleClassId}
                  disabled={classLocked}
                  onChange={(e) => edit({ vehicleClassId: e.target.value })}
                >
                  {draft.vehicleClassId === '' && <option value="">Choose a class</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {/* REQ-PLC-018: a towed unit has no odometer. */}
            {powered && (
              <Field label="Odometer km">
                {(id) =>
                  vehicle ? (
                    <>
                      <input
                        id={id}
                        className="input"
                        value={km(vehicle.currentOdometer)}
                        readOnly
                      />
                      <div className="small muted">Changed by a recorded reading</div>
                    </>
                  ) : (
                    <input
                      id={id}
                      className="input"
                      inputMode="numeric"
                      value={draft.odometer}
                      onChange={(e) => edit({ odometer: e.target.value })}
                    />
                  )
                }
              </Field>
            )}
            <Field label="Axles and tyres">
              {(id) => (
                <>
                  <input
                    id={id}
                    className="input"
                    value={layout ? axlesAndTyres(layout) : ''}
                    readOnly
                  />
                  <div className="small muted">From the class layout</div>
                </>
              )}
            </Field>
            {TEXT_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    inputMode={key === 'year' ? 'numeric' : undefined}
                    value={draft[key]}
                    onChange={(e) => edit({ [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>
            <span className="circle-ic">
              <Icon name="tyre" size={18} />
            </span>
            Layout preview
          </h2>
          {layout ? (
            <ChassisMap
              definition={layout.definition}
              statuses={noBaseline(layout.definition)}
              title={`Layout preview, ${axlesAndTyres(layout)}`}
            />
          ) : (
            <p className="small muted">Choose a class to see its layout.</p>
          )}
        </div>
      </div>

      <div className="bar">
        {vehicle && (
          <div className="field reason">
            <ReasonInput value={reason} onChange={setReason} />
          </div>
        )}
        <Refusal message={error} />
        <span className="grow" />
        <Button disabled={busy} onClick={cancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {vehicle ? 'Save changes' : 'Save'}
        </Button>
      </div>

      {discard && (
        <ConfirmDialog
          title="Discard your changes?"
          body="What you changed on this vehicle is lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setDiscard(false)}
          onConfirm={() => {
            setDiscard(false);
            setDirty(false);
            navigate(back);
          }}
        />
      )}
      {deactivating && vehicle && (
        <DeactivateDialog
          vehicle={vehicle}
          onCancel={() => setDeactivating(false)}
          onDeactivate={async (text) => {
            const outcome = await api.deactivate(vehicle.id, { reason: text });
            if (!outcome.ok) return outcome.message;
            done(vehicle.id);
            return null;
          }}
        />
      )}
      {guard.dialog}
    </>
  );
}

function ReasonInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Reason for the change</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

/** REQ-VEH-004, C-32: names what stops and asks for the reason. */
function DeactivateDialog({
  vehicle,
  onCancel,
  onDeactivate,
}: {
  vehicle: Vehicle;
  onCancel: () => void;
  onDeactivate: (reason: string) => Promise<string | null>;
}) {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const parsed = VehicleDeactivateRequestSchema.safeParse({ reason });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Give a reason.');
    setBusy(true);
    const refusal = await onDeactivate(parsed.data.reason);
    setBusy(false);
    return setError(refusal);
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h3 id={titleId}>Deactivate {vehicle.licensePlate}?</h3>
        <p className="muted">The vehicle becomes Inactive and no new SPK can be created.</p>
        <div className="field">
          <label htmlFor={reasonId}>Reason</label>
          <textarea
            id={reasonId}
            className="input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Refusal message={error} />
        <div className="bar">
          <Button onClick={onCancel}>Keep active</Button>
          <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
            Deactivate
          </Button>
        </div>
      </div>
    </div>
  );
}
