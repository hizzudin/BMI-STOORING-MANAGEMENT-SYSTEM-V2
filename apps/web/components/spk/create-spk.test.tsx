import type { Spk, SpkFormOptionsResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { CreateSpk } from './CreateSpk';
import { SpkHome } from './SpkHome';

afterEach(cleanup);

const options: SpkFormOptionsResponse = {
  vehicles: [
    { id: 7, licensePlate: 'B 9012 KX', className: 'Tractor head', status: 'Active' },
    { id: 8, licensePlate: 'B 7710 TR', className: 'Trailer tail', status: 'OFF' },
  ],
  allowedActions: ['create'],
};

const draft: Spk = {
  id: 41,
  spkNumber: 'SPK-2611120001',
  vehicle: { id: 7, licensePlate: 'B 9012 KX', className: 'Tractor head' },
  title: 'PM 20.000 km',
  category: 'PM',
  priority: 'Normal',
  requiresDowntime: true,
  description: 'Service per PM package TH-20K.',
  requestSource: 'Manual_Planner',
  status: 'Draft',
  stepCount: 0,
  version: 1,
  allowedActions: ['edit', 'submit'],
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const refused = (message: string) => Promise.resolve({ ok: false as const, status: 403, message });

function apiWith(overrides: Partial<Record<keyof SpksApi, unknown>> = {}): SpksApi {
  return {
    options: vi.fn(() => ok(options)),
    get: vi.fn(() => ok({ spk: draft })),
    create: vi.fn(() => ok({ spk: draft })),
    update: vi.fn(() => ok({ spk: { ...draft, version: 2 } })),
    submit: vi.fn(() => refused('Add at least one step before submitting.')),
    ...overrides,
  } as unknown as SpksApi;
}

async function show(api: SpksApi, mode: Parameters<typeof CreateSpk>[0]['mode']) {
  const navigate = vi.fn();
  await act(async () => {
    render(<CreateSpk api={api} mode={mode} navigate={navigate} />);
  });
  return navigate;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('CreateSPK (REQ-SPK-001, REQ-SPK-013, REQ-SPK-015, DEC-126)', () => {
  it('REQ-SPK-001 the common fields; the vehicle comes from the vehicle page (C-11); Save draft makes a Draft and follows it', async () => {
    const api = apiWith();
    const navigate = await show(api, { kind: 'new', vehicleId: 7 });
    expect(field('Vehicle').value).toBe('7');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain(
      'B 7710 TR · Trailer tail',
    );
    expect(field('Urgency').value).toBe('Normal');
    expect(
      (screen.getByLabelText('Vehicle goes to the workshop') as HTMLInputElement).checked,
    ).toBe(true);
    // DEC-126: no steps, palette, Checks or presets until TASK-207 and TASK-208.
    expect(screen.queryByText('Steps')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start from preset' })).toBeNull();

    type('Title', 'PM 20.000 km');
    fireEvent.change(field('Category'), { target: { value: 'PM' } });
    fireEvent.change(field('Urgency'), { target: { value: 'High' } });
    fireEvent.click(screen.getByLabelText('Vehicle goes to the workshop'));
    type('Description', 'Service per PM package TH-20K.');
    await click('Save draft');
    expect(api.create).toHaveBeenCalledWith({
      vehicleId: 7,
      title: 'PM 20.000 km',
      category: 'PM',
      priority: 'High',
      requiresDowntime: false,
      description: 'Service per PM package TH-20K.',
    });
    expect(navigate).toHaveBeenCalledWith('/spk/41/edit?saved=1');
    expect(screen.getByRole('status').textContent).toBe('Saved.');
  });

  it('REQ-SPK-015 the urgencies are Low, Normal, High and Urgent; a check fails before sending', async () => {
    const api = apiWith();
    await show(api, { kind: 'new', vehicleId: null });
    expect(
      Array.from((field('Urgency') as unknown as HTMLSelectElement).options).map((o) => o.text),
    ).toEqual(['Low', 'Normal', 'High', 'Urgent']);
    await click('Save draft');
    expect(screen.getByRole('alert').textContent).toBe('Choose a vehicle.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('C-15 a draft saves at its version; DEC-126 Submit shows the refusal while there is no step', async () => {
    const api = apiWith();
    await show(api, { kind: 'edit', id: 41 });
    expect(screen.getByText('Surat Perintah Kerja / SPK-2611120001')).toBeTruthy();
    type('Title', 'PM 20.000 km and brakes');
    await click('Submit for approval');
    expect(api.update).toHaveBeenCalledWith(41, expect.objectContaining({ version: 1 }));
    expect(api.submit).toHaveBeenCalledWith(41, { version: 2 });
    expect(screen.getByRole('alert').textContent).toBe('Add at least one step before submitting.');
  });

  it('T2 a submitted SPK shows Pending approval read only, with its urgency pill', async () => {
    const api = apiWith({
      submit: vi.fn(() =>
        ok({
          spk: { ...draft, status: 'Pending_Approval', priority: 'Urgent', allowedActions: [] },
        }),
      ),
    });
    await show(api, { kind: 'edit', id: 41 });
    await click('Submit for approval');
    expect(screen.getByText('Pending approval')).toBeTruthy();
    expect(screen.getByText('Urgent', { selector: '.pill' })).toBeTruthy();
    expect(field('Title').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
  });

  it('C-12 Cancel asks first when there are changes', async () => {
    const api = apiWith();
    const navigate = await show(api, { kind: 'new', vehicleId: null });
    type('Title', 'Brake check');
    await click('Cancel');
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeTruthy();
    await click('Leave');
    expect(navigate).toHaveBeenCalledWith('/spk');
  });

  it('C-15 the draft page opened right after Save draft says Saved.', async () => {
    await show(apiWith(), { kind: 'edit', id: 41, saved: true });
    expect(screen.getByRole('status').textContent).toBe('Saved.');
  });

  it('C-34 a refused page shows its sentence', async () => {
    await show(
      apiWith({ options: vi.fn(() => refused('You do not have permission to do this.')) }),
      { kind: 'new', vehicleId: null },
    );
    expect(screen.getByRole('alert').textContent).toBe('You do not have permission to do this.');
  });
});

describe('Surat Perintah Kerja page (DEC-126)', () => {
  it('shows Create SPK only to users who may create one', async () => {
    await act(async () => {
      render(<SpkHome api={apiWith()} />);
    });
    expect(screen.getByRole('link', { name: 'Create SPK' }).getAttribute('href')).toBe('/spk/new');
    cleanup();
    await act(async () => {
      render(<SpkHome api={apiWith({ options: vi.fn(() => refused('No.')) })} />);
    });
    expect(screen.queryByRole('link', { name: 'Create SPK' })).toBeNull();
  });
});
