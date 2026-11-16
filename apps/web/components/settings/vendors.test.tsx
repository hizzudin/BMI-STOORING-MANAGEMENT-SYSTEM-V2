import type { Vendor, VendorListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VendorsApi } from '../../lib/vendors-api';
import { Vendors } from './Vendors';

afterEach(cleanup);

const filter: Vendor = {
  id: 1,
  code: 'SUMBER_FILTER',
  name: 'PT Sumber Filter',
  kind: 'Supplier',
  phone: '021-555-0101',
  address: 'Jl. Industri 12, Cikarang',
  isActive: true,
};
const retread: Vendor = {
  ...filter,
  id: 2,
  code: 'VULKAN',
  name: 'Vulkanisir Jaya',
  kind: 'Retread',
  phone: '021-555-0144',
  address: null,
  isActive: false,
};

const page: VendorListResponse = {
  vendors: [filter, retread],
  allowedActions: ['create', 'edit', 'deactivate', 'activate'],
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(overrides: Partial<VendorsApi> = {}): VendorsApi {
  return {
    list: vi.fn(() => ok(page)),
    create: vi.fn((body) => ok({ vendor: { ...filter, ...body, id: 9, isActive: true } })),
    update: vi.fn((id, body) => ok({ vendor: { ...filter, ...body, id } })),
    deactivate: vi.fn(() => ok({ ok: true as const })),
    activate: vi.fn(() => ok({ ok: true as const })),
    ...overrides,
  } as VendorsApi;
}

async function open(api: VendorsApi) {
  await act(async () => {
    render(<Vendors api={api} />);
  });
}

const panel = () => screen.getByRole('region', { name: 'Vendor' });

describe('SettingsVendors (REQ-INV-014, DEC-134)', () => {
  it('REQ-INV-014 lists Vendor, Kind and Phone; an inactive vendor is marked Inactive', async () => {
    await open(apiWith());
    expect(screen.getByRole('heading', { level: 1, name: 'Vendors' })).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Vendor', 'Kind', 'Phone']);
    const row = screen.getByRole('row', { name: /PT Sumber Filter/ });
    expect(row.textContent).toContain('Supplier');
    expect(row.textContent).toContain('021-555-0101');
    expect(row.textContent).not.toContain('Inactive');
    expect(screen.getByRole('row', { name: /Vulkanisir Jaya/ }).textContent).toContain('Inactive');
  });

  it('DEC-134 the panel shows every field; the code is fixed once saved', async () => {
    await open(apiWith());
    expect((within(panel()).getByLabelText('Code') as HTMLInputElement).readOnly).toBe(true);
    expect((within(panel()).getByLabelText('Vendor') as HTMLInputElement).value).toBe(
      'PT Sumber Filter',
    );
    expect((within(panel()).getByLabelText('Kind') as HTMLSelectElement).value).toBe('Supplier');
    expect((within(panel()).getByLabelText('Phone') as HTMLInputElement).value).toBe(
      '021-555-0101',
    );
    expect((within(panel()).getByLabelText('Address') as HTMLTextAreaElement).value).toBe(
      'Jl. Industri 12, Cikarang',
    );
  });

  it('C-31 C-17 New vendor saves the typed code and fields, empty phone and address as none', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'New vendor' }));
    fireEvent.change(within(panel()).getByLabelText('Code'), { target: { value: 'TOKO_A' } });
    fireEvent.change(within(panel()).getByLabelText('Vendor'), { target: { value: 'Abadi Shop' } });
    fireEvent.change(within(panel()).getByLabelText('Kind'), { target: { value: 'Shop' } });
    await act(async () => fireEvent.click(within(panel()).getByRole('button', { name: 'Save' })));
    expect(api.create).toHaveBeenCalledWith({
      code: 'TOKO_A',
      name: 'Abadi Shop',
      kind: 'Shop',
      phone: null,
      address: null,
    });
    expect(within(panel()).getByRole('status').textContent).toBe('Saved.');
  });

  it('C-34 a refused save shows its sentence', async () => {
    const api = apiWith({
      create: vi.fn(() =>
        Promise.resolve({ ok: false as const, status: 409, message: 'This code is taken.' }),
      ),
    });
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'New vendor' }));
    fireEvent.change(within(panel()).getByLabelText('Code'), {
      target: { value: 'SUMBER_FILTER' },
    });
    fireEvent.change(within(panel()).getByLabelText('Vendor'), { target: { value: 'Again' } });
    await act(async () => fireEvent.click(within(panel()).getByRole('button', { name: 'Save' })));
    expect(within(panel()).getByRole('alert').textContent).toBe('This code is taken.');
  });

  it('C-32 Deactivate asks first; an inactive vendor offers Activate', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate PT Sumber Filter?' });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' })),
    );
    expect(api.deactivate).toHaveBeenCalledWith(1);

    await act(async () => fireEvent.click(screen.getByRole('row', { name: /Vulkanisir Jaya/ })));
    expect(within(panel()).queryByRole('button', { name: 'Deactivate' })).toBeNull();
    await act(async () =>
      fireEvent.click(within(panel()).getByRole('button', { name: 'Activate' })),
    );
    expect(api.activate).toHaveBeenCalledWith(2);
  });
});
