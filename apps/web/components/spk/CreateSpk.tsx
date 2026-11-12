'use client';

import {
  SPK_CATEGORIES,
  SPK_PRIORITIES,
  SpkRequestSchema,
  type Spk,
  type SpkCategory,
  type SpkFormOptionsResponse,
  type SpkPriority,
} from '@bmi/shared';
import { useEffect, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Field, Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { PageHead } from '../shell/AppShell';
import { PRIORITY_TONES, STATUS_TONES, statusText } from './spk-format';

interface Draft {
  vehicleId: string;
  title: string;
  category: SpkCategory | '';
  priority: SpkPriority;
  requiresDowntime: boolean;
  description: string;
}

const blank = (vehicleId: number | null): Draft => ({
  vehicleId: vehicleId === null ? '' : String(vehicleId),
  title: '',
  category: '',
  priority: 'Normal',
  requiresDowntime: true,
  description: '',
});

const draftOf = (spk: Spk): Draft => ({
  vehicleId: String(spk.vehicle.id),
  title: spk.title,
  category: spk.category,
  priority: spk.priority,
  requiresDowntime: spk.requiresDowntime,
  description: spk.description,
});

type Mode =
  | { kind: 'new'; vehicleId: number | null }
  /** `saved`: the draft was just made by Save draft on /spk/new (C-15 shows Saved.). */
  | { kind: 'edit'; id: number; saved?: boolean };

/**
 * REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015, T1, T2, T5: CreateSPK. DEC-126: the Steps
 * section, the module palette, Checks and the preset buttons come with TASK-207 and TASK-208;
 * until then Submit is refused for an SPK without a step.
 */
export function CreateSpk({
  api,
  mode,
  navigate,
}: {
  api: SpksApi;
  mode: Mode;
  navigate: (path: string) => void;
}) {
  const [options, setOptions] = useState<SpkFormOptionsResponse | null>(null);
  const [spk, setSpk] = useState<Spk | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(mode.kind === 'new' ? mode.vehicleId : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(mode.kind === 'edit' && mode.saved === true);
  const [busy, setBusy] = useState(false);
  const guard = useLeaveGuard();
  const { dirty, setDirty, leave } = guard;
  const editId = mode.kind === 'edit' ? mode.id : null;

  useEffect(() => {
    void (async () => {
      const list = await api.options();
      if (!list.ok) return setLoadError(list.message);
      setOptions(list.data);
      if (editId === null) return undefined;
      const one = await api.get(editId);
      if (!one.ok) return setLoadError(one.message);
      setSpk(one.data.spk);
      setDraft(draftOf(one.data.spk));
      return undefined;
    })();
  }, [api, editId]);

  const head = (
    <PageHead
      crumb={`Surat Perintah Kerja / ${spk ? spk.spkNumber : 'New'}`}
      title="Create SPK"
      status={
        spk && (
          <>
            <StatusPill tone={STATUS_TONES[spk.status]}>{statusText(spk.status)}</StatusPill>
            <StatusPill tone={PRIORITY_TONES[spk.priority]}>{spk.priority}</StatusPill>
          </>
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
  if (!options || (editId !== null && !spk)) return head;

  const editable = spk === null || spk.allowedActions.includes('edit');
  const canSubmit = spk === null || spk.allowedActions.includes('submit');
  // REQ-SPK-013: an Inactive vehicle is never offered; a saved SPK keeps showing its own vehicle.
  const vehicles = [
    ...options.vehicles,
    ...(spk && !options.vehicles.some((v) => v.id === spk.vehicle.id)
      ? [{ ...spk.vehicle, status: 'Inactive' as const }]
      : []),
  ];

  const edit = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setDirty(true);
    setError(null);
    setSaved(false);
  };

  const request = () =>
    SpkRequestSchema.safeParse({
      vehicleId: draft.vehicleId === '' ? undefined : Number(draft.vehicleId),
      title: draft.title,
      category: draft.category === '' ? undefined : draft.category,
      priority: draft.priority,
      requiresDowntime: draft.requiresDowntime,
      description: draft.description,
    });

  /** C-15: a new SPK becomes a Draft and the page follows it; a draft saves at its version. */
  const save = async (): Promise<Spk | null> => {
    const parsed = request();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      return null;
    }
    const outcome = spk
      ? await api.update(spk.id, { ...parsed.data, version: spk.version })
      : await api.create(parsed.data);
    if (!outcome.ok) {
      setError(outcome.message);
      return null;
    }
    setSpk(outcome.data.spk);
    setDraft(draftOf(outcome.data.spk));
    setDirty(false);
    if (!spk) navigate(`/spk/${outcome.data.spk.id}/edit?saved=1`);
    return outcome.data.spk;
  };

  const saveDraft = async () => {
    setBusy(true);
    const result = await save();
    setBusy(false);
    if (result) setSaved(true);
  };

  /** T2, T5: the latest fields are saved first, then sent to the Approvers. */
  const submit = async () => {
    setBusy(true);
    const current = dirty || !spk ? await save() : spk;
    if (current) {
      const outcome = await api.submit(current.id, { version: current.version });
      if (outcome.ok) setSpk(outcome.data.spk);
      else setError(outcome.message);
    }
    setBusy(false);
  };

  return (
    <>
      {head}
      {spk && !editable && (
        <div className="note vehicle-body">
          <Icon name="lock" size={18} />
          <div>
            {spk.spkNumber} is {statusText(spk.status).toLowerCase()}: it can no longer be changed
            here.
          </div>
        </div>
      )}
      <div className="grid g2 vehicle-body">
        <div className="card white">
          <h2>
            <span className="circle-ic">
              <Icon name="spk" size={18} />
            </span>
            Surat Perintah Kerja
          </h2>
          <div className="grid ge">
            <Field label="Title">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  value={draft.title}
                  disabled={!editable}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              )}
            </Field>
            <Field label="Vehicle">
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={draft.vehicleId}
                  disabled={!editable}
                  onChange={(e) => edit({ vehicleId: e.target.value })}
                >
                  {draft.vehicleId === '' && <option value="">Choose a vehicle</option>}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.licensePlate} · {v.className}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Category">
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={draft.category}
                  disabled={!editable}
                  onChange={(e) => edit({ category: e.target.value as SpkCategory })}
                >
                  {draft.category === '' && <option value="">Choose a category</option>}
                  {SPK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Urgency">
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={draft.priority}
                  disabled={!editable}
                  onChange={(e) => edit({ priority: e.target.value as SpkPriority })}
                >
                  {SPK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <label className="check flat">
            <input
              type="checkbox"
              checked={draft.requiresDowntime}
              disabled={!editable}
              onChange={(e) => edit({ requiresDowntime: e.target.checked })}
            />
            Vehicle goes to the workshop
          </label>
          <Field label="Description">
            {(id) => (
              <textarea
                id={id}
                className="input"
                rows={3}
                value={draft.description}
                disabled={!editable}
                onChange={(e) => edit({ description: e.target.value })}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="bar">
        <Refusal message={error} />
        {saved && (
          <p className="small muted" role="status">
            Saved.
          </p>
        )}
        <span className="grow" />
        <Button disabled={busy} onClick={() => leave(() => navigate('/spk'))}>
          Cancel
        </Button>
        {editable && (
          <Button disabled={busy} onClick={() => void saveDraft()}>
            Save draft
          </Button>
        )}
        {editable && canSubmit && (
          <Button variant="primary" disabled={busy} onClick={() => void submit()}>
            Submit for approval
          </Button>
        )}
      </div>
      {guard.dialog}
    </>
  );
}
