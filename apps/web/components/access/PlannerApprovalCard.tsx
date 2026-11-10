'use client';

import {
  APPROVAL_KIND_LABELS,
  APPROVAL_KINDS,
  formatDateTimeWib,
  fromWibInput,
  wibInputValue,
  type ApprovalKind,
  type PlannerApprovalResponse,
} from '@bmi/shared';
import { useCallback, useEffect, useState } from 'react';
import type { Outcome } from '../../lib/auth-api';
import type { PlannerApprovalApi } from '../../lib/planner-approval-api';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Field, Panel, Refusal } from '../kit/SidePanel';

type Mode = 'switch_on' | 'change' | 'switch_off';

/** "SPK creation, SPK completion · until 2026-11-11 18:00 WIB" (NFR-09: times in WIB). */
function summary(state: PlannerApprovalResponse): string {
  const kinds = state.kinds.map((kind) => APPROVAL_KIND_LABELS[kind]).join(', ');
  const until = state.until
    ? `until ${formatDateTimeWib(new Date(state.until)).slice(0, 16)} WIB`
    : 'until switched off';
  return `${kinds} · ${until}`;
}

/** REQ-IAM-008, RL-7, DEC-118: the Planner approval card on Roles and permissions. */
export function PlannerApprovalCard({ api }: { api: PlannerApprovalApi }) {
  const [state, setState] = useState<PlannerApprovalResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  const load = useCallback(async () => {
    const outcome = await api.get();
    if (outcome.ok) setState(outcome.data);
    else setLoadError(outcome.message);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = new Set(state?.allowedActions ?? []);

  return (
    <section className="card switch-card" aria-labelledby="planner-approval-title">
      <h2 id="planner-approval-title">Planner approval</h2>
      {loadError && <Refusal message={loadError} />}
      {state && (
        <div className="switch-row">
          <span className="circle-ic">
            <Icon name="approvals" size={18} />
          </span>
          <div className="grow">
            <b>{state.on ? 'Planner approval is on' : 'Planner approval is off'}</b>
            <div className="small muted">
              {state.on
                ? summary(state)
                : 'Tick the kinds and an optional end time; every switch is audited and notified to Supervisors and GMs.'}
            </div>
          </div>
          {allowed.has('change') && <Button onClick={() => setMode('change')}>Change</Button>}
          {allowed.has('switch_off') && (
            <Button variant="danger" onClick={() => setMode('switch_off')}>
              Switch off
            </Button>
          )}
          {allowed.has('switch_on') && (
            <Button variant="primary" onClick={() => setMode('switch_on')}>
              Switch on
            </Button>
          )}
        </div>
      )}
      {state && mode && (
        <SwitchPanel
          mode={mode}
          state={state}
          api={api}
          onClose={() => setMode(null)}
          onDone={(next) => {
            setState(next);
            setMode(null);
          }}
        />
      )}
    </section>
  );
}

/** DEC-118: the side panel of Switch on, Change (kinds, end time, reason) and Switch off (reason). */
function SwitchPanel({
  mode,
  state,
  api,
  onClose,
  onDone,
}: {
  mode: Mode;
  state: PlannerApprovalResponse;
  api: PlannerApprovalApi;
  onClose: () => void;
  onDone: (next: PlannerApprovalResponse) => void;
}) {
  const [kinds, setKinds] = useState<ReadonlySet<ApprovalKind>>(new Set(state.kinds));
  const [end, setEnd] = useState(state.until ? wibInputValue(new Date(state.until)) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const off = mode === 'switch_off';

  const toggle = (kind: ApprovalKind) => {
    const next = new Set(kinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setKinds(next);
  };

  const send = async (call: () => Promise<Outcome<PlannerApprovalResponse>>) => {
    setBusy(true);
    setError(null);
    const outcome = await call();
    setBusy(false);
    if (outcome.ok) onDone(outcome.data);
    else setError(outcome.message);
  };

  const submit = () => {
    if (!reason.trim()) return setError('Give a reason.');
    if (off) return send(() => api.switchOff(reason.trim()));
    if (kinds.size === 0) return setError('Tick at least one approval kind.');
    const until = end ? fromWibInput(end) : null;
    if (end && !until) return setError('Give the end time as a date and time.');
    return send(() =>
      api.set({
        // The checklist order, whatever order the boxes were ticked in.
        kinds: APPROVAL_KINDS.filter((kind) => kinds.has(kind)),
        until: until ? until.toISOString() : null,
        reason: reason.trim(),
      }),
    );
  };

  const submitLabel = off ? 'Switch off' : mode === 'change' ? 'Save' : 'Switch on';

  return (
    <Panel label="Planner approval" onClose={onClose} onSubmit={() => void submit()}>
      {!off && (
        <>
          <fieldset className="field checks">
            <legend>Approval kinds</legend>
            {APPROVAL_KINDS.map((kind) => (
              <label key={kind} className="check">
                <input type="checkbox" checked={kinds.has(kind)} onChange={() => toggle(kind)} />
                {APPROVAL_KIND_LABELS[kind]}
              </label>
            ))}
          </fieldset>
          <Field label="End time (WIB, optional)">
            {(id) => (
              <>
                <input
                  id={id}
                  className="input"
                  type="datetime-local"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
                <div className="small muted">Empty keeps it on until it is switched off.</div>
              </>
            )}
          </Field>
        </>
      )}
      <Field label="Reason">
        {(id) => (
          <textarea
            id={id}
            className="input"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      <Refusal message={error} />
      <div className="bar">
        <span className="grow" />
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant={off ? 'danger' : 'primary'} disabled={busy} aria-busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </Panel>
  );
}
