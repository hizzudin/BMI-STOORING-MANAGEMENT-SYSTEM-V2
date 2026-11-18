import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * DEC-139: pdf.js, loaded only when a PDF is checked or shown, with its worker served by the app
 * itself (no CDN).
 */
export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}
