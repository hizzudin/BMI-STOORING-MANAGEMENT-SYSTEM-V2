import type { VehicleClass, VehicleClassListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VehicleClassesApi } from '../../lib/vehicle-classes-api';
import { ChassisLayouts } from './ChassisLayouts';

afterEach(cleanup);

const head: VehicleClass = {
  id: 1,
  code: 'Tractor_Head',
  name: 'Tractor head',
  unitKind: 'Powered',
  layout: {
    id: 11,
    code: 'Tractor_Head',
    version: 2,
    axleCount: 3,
    tyreCount: 11,
    definition: {
      frontDrawing: 'Fifth_wheel',
      spareCount: 1,
      axles: [
        { role: 'Steer', tyresPerSide: 1 },
        { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
        { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
      ],
    },
  },
};

const page = (classes: VehicleClass[]): VehicleClassListResponse => ({
  classes,
  allowedActions: ['create', 'new_layout_version'],
});

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(overrides: Partial<VehicleClassesApi> = {}): VehicleClassesApi {
  return {
    list: vi.fn(() => ok(page([head]))),
    create: vi.fn((body) =>
      ok({
        vehicleClass: {
          ...head,
          id: 2,
          code: body.code,
          name: body.name,
          unitKind: body.unitKind,
          layout: {
            ...head.layout,
            id: 21,
            code: body.code,
            version: 1,
            definition: body.definition,
          },
        },
      }),
    ),
    newLayoutVersion: vi.fn((_id, definition) =>
      ok({ vehicleClass: { ...head, layout: { ...head.layout, version: 3, definition } } }),
    ),
    ...overrides,
  };
}

async function open(api: VehicleClassesApi) {
  await act(async () => {
    render(<ChassisLayouts api={api} />);
  });
}

const preview = () => screen.getByRole('img', { name: /^Layout preview/ });
const tyres = () => preview().querySelectorAll('g.m-tyre').length;
const editor = () => screen.getByRole('region', { name: 'Layout' });

describe('ChassisLayouts (REQ-PLC-013, REQ-PLC-017, DEC-120)', () => {
  it('REQ-PLC-013 lists the classes with unit kind, axles, positions and layout version', async () => {
    await open(apiWith());
    const row = screen.getByRole('row', { name: /Tractor head/ });
    expect(row.textContent).toContain('Powered');
    expect(row.textContent).toContain('10 + 1 spare');
    expect(row.textContent).toContain('v2');
    expect(screen.getByRole('link', { name: 'Back to Settings' }).getAttribute('href')).toBe(
      '/settings',
    );
  });

  it('REQ-PLC-013 the preview is drawn live from the layout; Save as new layout version sends it', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(screen.getByRole('row', { name: /Tractor head/ }));
    expect(tyres()).toBe(11);
    expect(
      within(editor()).getByText(/saving makes v3, and vehicles on v2 stay on v2/),
    ).toBeTruthy();
    fireEvent.change(within(editor()).getByLabelText('Spare positions'), {
      target: { value: '2' },
    });
    expect(tyres()).toBe(12);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as new layout version' }));
    });
    expect(api.newLayoutVersion).toHaveBeenCalledWith(1, {
      ...head.layout.definition,
      spareCount: 2,
    });
    expect(screen.getByRole('status').textContent).toBe('Layout v3 of Tractor head saved.');
  });

  it('REQ-PLC-017 axles: role, tyres per side, spacing; add and remove; the first axle has no spacing', async () => {
    await open(apiWith());
    fireEvent.click(screen.getByRole('row', { name: /Tractor head/ }));
    fireEvent.click(within(editor()).getByRole('button', { name: 'Add axle' }));
    expect(within(editor()).getAllByRole('row')).toHaveLength(5);
    expect(tyres()).toBe(15);
    fireEvent.change(within(editor()).getByLabelText('Axle 4 tyres per side'), {
      target: { value: '1' },
    });
    expect(tyres()).toBe(13);
    fireEvent.click(within(editor()).getByRole('button', { name: 'Remove axle 1' }));
    expect(within(editor()).queryByLabelText('Axle 1 spacing')).toBeNull();
    expect((within(editor()).getByLabelText('Axle 2 spacing') as HTMLSelectElement).value).toBe(
      'Close',
    );
    fireEvent.change(within(editor()).getByLabelText('Axle 1 role'), {
      target: { value: 'Trailer' },
    });
    fireEvent.change(within(editor()).getByLabelText('Front'), { target: { value: 'Kingpin' } });
    expect(preview().querySelector('.m-pin')).toBeTruthy();
  });

  it('DEC-120 New class: code, name and unit kind, then its first layout', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'New class' }));
    fireEvent.change(within(editor()).getByLabelText('Code'), { target: { value: 'Powered_8x4' } });
    fireEvent.change(within(editor()).getByLabelText('Name'), { target: { value: 'Powered 8x4' } });
    fireEvent.change(within(editor()).getByLabelText('Unit kind'), {
      target: { value: 'Powered' },
    });
    fireEvent.click(within(editor()).getByRole('button', { name: 'Add axle' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save class' }));
    });
    expect(api.create).toHaveBeenCalledWith({
      code: 'Powered_8x4',
      name: 'Powered 8x4',
      unitKind: 'Powered',
      definition: {
        frontDrawing: 'None',
        spareCount: 0,
        axles: [
          { role: 'Steer', tyresPerSide: 1 },
          { role: 'Steer', tyresPerSide: 1, spacing: 'Close' },
        ],
      },
    });
    expect(screen.getByRole('status').textContent).toBe('Class Powered 8x4 saved.');
  });

  it('C-34 a refused save shows its sentence and keeps the form; an empty code is caught before sending', async () => {
    const api = apiWith({
      create: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 409,
          message: 'Another class already uses this code.',
        }),
      ),
    });
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'New class' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save class' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a class code.');
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(within(editor()).getByLabelText('Code'), {
      target: { value: 'Tractor_Head' },
    });
    fireEvent.change(within(editor()).getByLabelText('Name'), { target: { value: 'Head' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save class' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Another class already uses this code.');
    expect((within(editor()).getByLabelText('Code') as HTMLInputElement).value).toBe(
      'Tractor_Head',
    );
  });

  it('C-16 Discard asks first when there are changes, then restores the saved layout', async () => {
    await open(apiWith());
    fireEvent.click(screen.getByRole('row', { name: /Tractor head/ }));
    fireEvent.change(within(editor()).getByLabelText('Spare positions'), {
      target: { value: '0' },
    });
    expect(tyres()).toBe(10);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(tyres()).toBe(11);
  });

  it('C-34 a refused list shows its sentence', async () => {
    await open(
      apiWith({
        list: vi.fn(() =>
          Promise.resolve({
            ok: false as const,
            status: 403,
            message: 'You do not have permission to do this.',
          }),
        ),
      }),
    );
    expect(screen.getByText('You do not have permission to do this.')).toBeTruthy();
  });
});
