import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import { openPdf } from './pdf';
import type { PrepareDeps } from './prepare';

/** No size cap of its own: the quality ladder of the profile decides (8.1). */
const NO_SIZE_CAP_MB = 100;

/** DEC-139: the browser parts of the device check and compression. */
export const browserPrepareDeps: PrepareDeps = {
  compress: (file, { longSide, quality }) =>
    imageCompression(file, {
      maxWidthOrHeight: longSide,
      initialQuality: quality / 100,
      maxSizeMB: NO_SIZE_CAP_MB,
      // Its web worker loads the library from a CDN; the page itself does the work instead.
      useWebWorker: false,
      fileType: 'image/jpeg',
      preserveExif: false,
    }),
  capturedAt: async (file) => {
    const tags = (await exifr.parse(file, ['DateTimeOriginal'])) as
      { DateTimeOriginal?: Date } | undefined;
    return tags?.DateTimeOriginal ?? null;
  },
  pdfPages: async (file) => {
    const document = await openPdf(new Uint8Array(await file.arrayBuffer()));
    try {
      return document.numPages;
    } finally {
      await document.destroy();
    }
  },
};
