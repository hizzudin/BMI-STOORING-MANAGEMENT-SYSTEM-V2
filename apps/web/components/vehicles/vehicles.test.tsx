import type { Vehicle, VehicleClassOption, VehicleListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VehiclesApi } from '../../lib/vehicles-api';
import { VehicleDetail } from './VehicleDetail';
import { VehicleForm } from './VehicleForm';
import { VehicleList } from './VehicleList';

afterEach(cleanup);

const headLayout: Vehicle['layout'] = {
  id: 11,
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
};
const trailerLayout: Vehicle['layout'] = {
  id: 12,
  version: 1,
  axleCount: 2,
  tyreCount: 10,
  definition: {
    frontDrawing: 'Kingpin',
    spareCount: 2,
    axles: [
      { role: 'Trailer', tyresPerSide: 2 },
      { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    ],
  },
};
const classes: VehicleClassOption[] = [
  { id: 1, name: 'Tractor head', unitKind: 'Powered', layout: headLayout },
  { id: 2, name: 'Trailer tail', unitKind: 'Towed', layout: trailerLayout },
];

const head: Vehicle = {
  id: 7,
  licensePlate: 'B 9012 KX',
  vin: 'MHFAA8GS2N0123456',
  engineNumber: null,
  brand: 'Hino',
  model: 'FM 260 JD',
  year: 2022,
  fuelType: 'Diesel',
  vehicleClass: { id: 1, name: 'Tractor head', unitKind: 'Powered' },
  layout: headLayout,
  currentOdometer: 48210,
  status: 'Active',
  deactivateReason: null,
  version: 3,
  classLock: null,
  allowedActions: ['edit', 'change_class', 'deactivate'],
};
const trailer: Vehicle = {
  ...head,
  id: 8,
  licensePlate: 'B 7710 TR',
  vehicleClass: { id: 2, name: 'Trailer tail', unitKind: 'Towed' },
  layout: trailerLayout,
  currentOdometer: 0,
  status: 'OFF',
};

const page: VehicleListResponse = {
  vehicles: [head, trailer],
  classes,
  allowedActions: ['create'],
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const refused = (message: string) => Promise.resolve({ ok: false as const, status: 403, message });

function apiWith(overrides: Partial<Record<keyof VehiclesApi, unknown>> = {}): VehiclesApi {
  return {
    list: vi.fn(() => ok(page)),
    get: vi.fn((id: number) => ok({ vehicle: id === 8 ? trailer : head })),
    create: vi.fn(() => ok({ vehicle: { ...head, id: 9 } })),
    update: vi.fn((id: number) => ok({ vehicle: { ...head, id } })),
    deactivate: vi.fn((id: number) => ok({ vehicle: { ...head, id, status: 'Inactive' } })),
    ...overrides,
  } as unknown as VehiclesApi;
}

async function show(node: ReactNode) {
  await act(async () => {
    render(node);
  });
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('Vehicles (REQ-VEH-001)', () => {
  it('REQ-VEH-001 lists plate, class, odometer and status; a towed unit shows no km; Add only with create', async () => {
    const navigate = vi.fn();
    await show(<VehicleList api={apiWith()} navigate={navigate} />);
    const row = screen.getByRole('row', { name: /B 9012 KX/ });
    expect(row.textContent).toContain('Tractor head');
    expect(row.textContent).toContain('48.210 km');
    expect(row.textContent).toContain('Active');
    expect(screen.getByRole('row', { name: /B 7710 TR/ }).textContent).toContain('—');
    expect(screen.getByRole('link', { name: 'Add vehicle' }).getAttribute('href')).toBe(
      '/vehicles/new',
    );
    // DEC-122: no Customer, Driver or alert column yet.
    expect(screen.queryByRole('button', { name: 'Sort by Customer' })).toBeNull();
    fireEvent.click(row);
    expect(navigate).toHaveBeenCalledWith('/vehicles/7');
  });

  it('REQ-VEH-001 the status tabs filter the list; a reader without create gets no Add', async () => {
    const reader = apiWith({ list: vi.fn(() => ok({ ...page, classes: [], allowedActions: [] })) });
    await show(<VehicleList api={reader} navigate={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Add vehicle' })).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All2',
      'Active',
      'Repair',
      'OFF',
      'Blocked',
      'Inactive',
    ]);
    fireEvent.click(screen.getByRole('tab', { name: 'OFF' }));
    expect(screen.queryByRole('row', { name: /B 9012 KX/ })).toBeNull();
    expect(screen.getByRole('row', { name: /B 7710 TR/ })).toBeTruthy();
  });

  it('REQ-VEH-001 a vehicle: Overview and Chassis and parts only, the map read only, Edit by allowedActions', async () => {
    await show(<VehicleDetail api={apiWith()} id={7} />);
    expect(screen.getByRole('heading', { name: 'B 9012 KX' })).toBeTruthy();
    expect(screen.getByText('Tractor head · 48.210 km')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Overview',
      'Chassis and parts',
    ]);
    expect(screen.getByRole('link', { name: 'Edit vehicle' }).getAttribute('href')).toBe(
      '/vehicles/7/edit',
    );
    expect(
      screen.queryByRole('button', { name: /Create SPK|Parts baseline|Change driver/ }),
    ).toBeNull();
    const map = screen.getByRole('img', { name: 'Chassis map, B 9012 KX' });
    // No baseline yet: every position is Missing, and none is a button (read only).
    expect(within(map).getAllByText('A1_L').length).toBeGreaterThan(0);
    expect(within(map).queryAllByRole('button')).toEqual([]);
  });

  it('REQ-PLC-018 a towed vehicle shows no odometer; a reader sees no Edit', async () => {
    const api = apiWith({ get: vi.fn(() => ok({ vehicle: { ...trailer, allowedActions: [] } })) });
    await show(<VehicleDetail api={api} id={8} />);
    expect(screen.getByText('Trailer tail')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit vehicle' })).toBeNull();
  });

  it('C-34 a refused vehicle shows its sentence', async () => {
    const api = apiWith({ get: vi.fn(() => refused('This vehicle does not exist.')) });
    await show(<VehicleDetail api={api} id={99} />);
    expect(screen.getByRole('alert').textContent).toBe('This vehicle does not exist.');
  });
});

describe('AddVehicle (REQ-VEH-002)', () => {
  it('REQ-VEH-002 the counts come from the class layout; Save sends the vehicle and opens it', async () => {
    const api = apiWith();
    const navigate = vi.fn();
    await show(<VehicleForm api={api} mode={{ kind: 'add' }} navigate={navigate} />);
    type('Plate', 'B 3301 KL');
    fireEvent.change(field('Class'), { target: { value: '1' } });
    expect(field('Axles and tyres').value).toBe('3 axles · 10 tyres + 1 spare');
    expect(field('Axles and tyres').readOnly).toBe(true);
    type('Odometer km', '12.400');
    type('VIN', 'MHFAA8GS2N0123456');
    type('Year', '2022');
    type('Fuel type', 'Diesel');
    expect(screen.queryByRole('button', { name: 'Save and add parts' })).toBeNull();
    await click('Save');
    expect(api.create).toHaveBeenCalledWith({
      licensePlate: 'B 3301 KL',
      vin: 'MHFAA8GS2N0123456',
      engineNumber: '',
      brand: '',
      model: '',
      year: 2022,
      fuelType: 'Diesel',
      vehicleClassId: 1,
      odometer: 12400,
    });
    expect(navigate).toHaveBeenCalledWith('/vehicles/9');
  });

  it('AC-PLC-008 a trailer (Towed) has no odometer field', async () => {
    await show(<VehicleForm api={apiWith()} mode={{ kind: 'add' }} navigate={vi.fn()} />);
    fireEvent.change(field('Class'), { target: { value: '2' } });
    expect(screen.queryByLabelText('Odometer km')).toBeNull();
    expect(field('Axles and tyres').value).toBe('2 axles · 8 tyres + 2 spares');
  });

  it('C-34 a check fails before sending; a refusal from the API shows its sentence', async () => {
    const api = apiWith({
      create: vi.fn(() => refused('Another vehicle already uses this plate.')),
    });
    await show(<VehicleForm api={api} mode={{ kind: 'add' }} navigate={vi.fn()} />);
    await click('Save');
    expect(screen.getByRole('alert').textContent).toBe('Enter the plate.');
    expect(api.create).not.toHaveBeenCalled();
    type('Plate', 'B 1 X');
    fireEvent.change(field('Class'), { target: { value: '1' } });
    await click('Save');
    expect(screen.getByRole('alert').textContent).toBe('Another vehicle already uses this plate.');
  });

  it('C-16 Cancel asks first when there are changes', async () => {
    const navigate = vi.fn();
    await show(<VehicleForm api={apiWith()} mode={{ kind: 'add' }} navigate={navigate} />);
    type('Plate', 'B 1 X');
    await click('Cancel');
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeTruthy();
    await click('Discard');
    expect(navigate).toHaveBeenCalledWith('/vehicles');
  });
});

describe('VehicleEdit and VehicleDeactivate (REQ-VEH-003, REQ-VEH-004)', () => {
  it('REQ-VEH-003 an edit needs a reason and sends the version it was read at', async () => {
    const api = apiWith();
    const navigate = vi.fn();
    await show(<VehicleForm api={api} mode={{ kind: 'edit', id: 7 }} navigate={navigate} />);
    expect(field('Odometer km').readOnly).toBe(true);
    type('Engine number', '4D56-AB1234');
    await click('Save changes');
    expect(screen.getByRole('alert').textContent).toBe('Give a reason.');
    type('Reason for the change', 'Wrong engine number at entry');
    await click('Save changes');
    expect(api.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        engineNumber: '4D56-AB1234',
        reason: 'Wrong engine number at entry',
        version: 3,
        vehicleClassId: 1,
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/vehicles/7');
  });

  it('REQ-VEH-003 DEC-17 a locked class shows why and cannot be changed', async () => {
    const locked: Vehicle = {
      ...head,
      classLock: 'Class is locked: 10 tyres are mounted and SPK-2611040139 is open.',
      allowedActions: ['edit'],
    };
    await show(
      <VehicleForm
        api={apiWith({ get: vi.fn(() => ok({ vehicle: locked })) })}
        mode={{ kind: 'edit', id: 7 }}
        navigate={vi.fn()}
      />,
    );
    expect(screen.getByText(locked.classLock as string)).toBeTruthy();
    expect((screen.getByLabelText('Class') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Deactivate vehicle' })).toBeNull();
  });

  it('REQ-VEH-004 C-32 Deactivate names what stops, needs a reason and shows a refusal', async () => {
    const api = apiWith({
      deactivate: vi
        .fn()
        .mockReturnValueOnce(refused('SPK-1 is open: close it before deactivating the vehicle.'))
        .mockReturnValueOnce(ok({ vehicle: { ...head, status: 'Inactive' } })),
    });
    const navigate = vi.fn();
    await show(<VehicleForm api={api} mode={{ kind: 'edit', id: 7 }} navigate={navigate} />);
    await click('Deactivate vehicle');
    const dialog = screen.getByRole('dialog', { name: 'Deactivate B 9012 KX?' });
    expect(dialog.textContent).toContain('no new SPK can be created');
    const press = async () => {
      await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
      });
    };
    await press();
    expect(within(dialog).getByRole('alert').textContent).toBe('Give a reason.');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Sold' } });
    await press();
    expect(within(dialog).getByRole('alert').textContent).toContain('SPK-1 is open');
    await press();
    expect(api.deactivate).toHaveBeenLastCalledWith(7, { reason: 'Sold' });
    expect(navigate).toHaveBeenCalledWith('/vehicles/7');
  });

  it('an Inactive vehicle cannot be edited', async () => {
    const api = apiWith({
      get: vi.fn(() => ok({ vehicle: { ...head, status: 'Inactive', allowedActions: [] } })),
    });
    await show(<VehicleForm api={api} mode={{ kind: 'edit', id: 7 }} navigate={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('This vehicle cannot be edited.');
  });
});
