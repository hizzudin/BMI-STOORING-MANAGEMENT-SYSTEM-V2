import type { DocumentType, DocumentTypeListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentTypesApi } from '../../lib/document-types-api';
import { DocumentTypes } from './DocumentTypes';

afterEach(cleanup);

const kir: DocumentType = {
  id: 3,
  code: 'KIR',
  name: 'KIR',
  usualValidityMonths: 6,
  warningDays: 30,
  receiptRequired: true,
  classIds: [1],
};
const stnk: DocumentType = {
  ...kir,
  id: 1,
  code: 'STNK_Annual',
  name: 'STNK annual',
  usualValidityMonths: 12,
  classIds: [],
};

const page: DocumentTypeListResponse = {
  documentTypes: [kir, stnk],
  classes: [
    { id: 1, name: 'Tractor head' },
    { id: 2, name: 'Wingbox rigid' },
  ],
  allowedActions: ['create', 'edit', 'deactivate'],
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(overrides: Partial<DocumentTypesApi> = {}): DocumentTypesApi {
  return {
    list: vi.fn(() => ok(page)),
    create: vi.fn((body) => ok({ documentType: { ...body, id: 9 } })),
    update: vi.fn((id, body) => ok({ documentType: { ...kir, ...body, id } })),
    deactivate: vi.fn(() => ok({ ok: true as const })),
    ...overrides,
  };
}

async function open(api: DocumentTypesApi) {
  await act(async () => {
    render(<DocumentTypes api={api} />);
  });
}

const panel = () => screen.getByRole('region', { name: 'Document type' });

describe('DocumentTypes (REQ-DOC-002, DEC-121)', () => {
  it('REQ-DOC-002 lists each type with its required classes, validity, warning days and receipt', async () => {
    await open(apiWith());
    const row = screen.getByRole('row', { name: /^KIR/ });
    expect(row.textContent).toContain('Tractor head');
    expect(row.textContent).toContain('6 months');
    expect(row.textContent).toContain('30');
    expect(screen.getByRole('row', { name: /STNK annual/ }).textContent).toContain('None');
  });

  it('C-17 Save sends the fields and the ticked classes; the code stays fixed', async () => {
    const api = apiWith();
    await open(api);
    expect((within(panel()).getByLabelText('Code') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(within(panel()).getByLabelText('Warning days'), { target: { value: '45' } });
    fireEvent.click(within(panel()).getByLabelText('Wingbox rigid'));
    fireEvent.click(within(panel()).getByLabelText('Renewal receipt required'));
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
    });
    expect(api.update).toHaveBeenCalledWith(3, {
      name: 'KIR',
      usualValidityMonths: 6,
      warningDays: 45,
      receiptRequired: false,
      classIds: [1, 2],
    });
    expect(screen.getByRole('status').textContent).toBe('Saved.');
  });

  it('C-31 New document type: a blank record marked New with its code; nothing saved until Save', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'New document type' }));
    expect(within(panel()).getByText('New')).toBeTruthy();
    fireEvent.change(within(panel()).getByLabelText('Code'), { target: { value: 'Izin_Trayek' } });
    fireEvent.change(within(panel()).getByLabelText('Name'), { target: { value: 'Izin trayek' } });
    fireEvent.change(within(panel()).getByLabelText('Usual validity (months)'), {
      target: { value: '' },
    });
    expect(api.create).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
    });
    expect(api.create).toHaveBeenCalledWith({
      code: 'Izin_Trayek',
      name: 'Izin trayek',
      usualValidityMonths: null,
      warningDays: 30,
      receiptRequired: true,
      classIds: [],
    });
  });

  it('C-34 a check fails before sending, and a refusal from the API shows its sentence', async () => {
    const api = apiWith({
      update: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 409,
          message: 'Another document type already uses this code.',
        }),
      ),
    });
    await open(api);
    fireEvent.change(within(panel()).getByLabelText('Warning days'), { target: { value: '0' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Warning days are at least 1.');
    expect(api.update).not.toHaveBeenCalled();
    fireEvent.change(within(panel()).getByLabelText('Warning days'), { target: { value: '20' } });
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Another document type already uses this code.',
    );
  });

  it('C-16 Discard changes asks first, then goes back to the saved values', async () => {
    await open(apiWith());
    fireEvent.change(within(panel()).getByLabelText('Warning days'), { target: { value: '12' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Discard changes' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', {
        name: 'Discard',
      }),
    );
    expect((within(panel()).getByLabelText('Warning days') as HTMLInputElement).value).toBe('30');
  });

  it('C-32 Deactivate names what stops, then deactivates', async () => {
    const api = apiWith();
    await open(api);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate KIR?' });
    expect(dialog.textContent).toContain('no longer offered for new documents');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    });
    expect(api.deactivate).toHaveBeenCalledWith(3);
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
