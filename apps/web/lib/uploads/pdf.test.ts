// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const document = { numPages: 2 };
const getDocument = vi.fn(() => ({ promise: Promise.resolve(document) }));
const GlobalWorkerOptions = { workerSrc: '' };
vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions }));

const { openPdf } = await import('./pdf');

describe('openPdf (DEC-139)', () => {
  it('DEC-139 opens the bytes with pdf.js, its worker served by the app, without eval', async () => {
    const data = new Uint8Array([37, 80, 68, 70]);
    expect(await openPdf(data)).toBe(document);
    expect(getDocument).toHaveBeenCalledWith({ data, isEvalSupported: false });
    expect(GlobalWorkerOptions.workerSrc).toContain('pdf.worker.min.mjs');
  });
});
