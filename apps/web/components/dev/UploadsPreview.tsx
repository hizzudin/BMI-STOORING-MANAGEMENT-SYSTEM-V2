'use client';

import type { StoredFile } from '@bmi/shared';
import { useEffect, useRef, useState } from 'react';
import { UploadQueue } from '../../lib/uploads/upload-queue';
import { FileDrop, SubmitWhenReady } from '../files/FileDrop';
import { PhotoViewer } from '../files/PhotoViewer';
import { UploadProvider } from '../files/UploadProvider';
import { Button } from '../kit/Button';

/**
 * Development-only preview of FileDrop and PhotoViewer (TASK-115 qa) over an in-memory queue: no
 * request leaves the page. A file whose name starts with "slow" stays in progress, one with "fail"
 * needs attention, and every other file is done.
 */
const sample = (id: number, url: string, overrides: Partial<StoredFile> = {}): StoredFile => ({
  id,
  profile: 'Photo',
  status: 'Ready',
  rejectReason: null,
  originalName: `IMG_000${id}.jpg`,
  originalBytes: 4_404_019,
  storedBytes: 421_888,
  width: 1600,
  height: 1200,
  pageCount: null,
  capturedAt: '2026-11-18T06:58:02.000Z',
  thumbnailUrl: url,
  fileUrl: url,
  uploadedBy: { name: 'Preview Mechanic', role: 'Mechanic' },
  uploadedAt: '2026-11-18T07:00:10.000Z',
  ...overrides,
});

const objectUrl = (blob: Blob) =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';

/** A small picture drawn on a canvas, or null where the page has no canvas (tests). */
function drawn(hue: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (!context || typeof canvas.toBlob !== 'function') return Promise.resolve(null);
  const gradient = context.createLinearGradient(0, 0, 640, 480);
  gradient.addColorStop(0, `hsl(${hue} 30% 82%)`);
  gradient.addColorStop(1, `hsl(${hue} 30% 45%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 640, 480);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

/** A three-page PDF made on the page, for the viewer. */
function samplePdf(): Blob {
  const pages = 3;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`,
  ];
  for (let i = 0; i < pages; i++) {
    const content = '0.12 0.3 0.37 rg 60 700 475 60 re f 0.9 g 60 200 475 420 re f';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([out], { type: 'application/pdf' });
}

function previewQueue(): UploadQueue {
  let nextId = 100;
  const names = new Map<number, string>();
  const sources = new Map<number, Blob>();
  return new UploadQueue({
    prepare: async (file) => ({
      ok: true,
      blob: file,
      contentType: 'image/jpeg',
      capturedAt: null,
    }),
    requestLink: async (body) => {
      const id = nextId++;
      names.set(id, body.originalName ?? '');
      return {
        ok: true,
        data: {
          file: sample(id, '', { status: 'Pending', originalName: body.originalName }),
          upload: { url: `preview:${id}`, method: 'PUT', headers: {}, expiresAt: '' },
        },
      };
    },
    put: async (upload, blob) => {
      const id = Number(upload.url.slice('preview:'.length));
      const name = names.get(id) ?? '';
      if (name.startsWith('slow')) return new Promise<boolean>(() => {});
      if (name.startsWith('fail')) return false;
      sources.set(id, blob);
      return true;
    },
    markUploaded: async (id) => ({
      ok: true,
      data: { file: sample(id, '', { status: 'Pending' }) },
    }),
    get: async (id) => {
      const source = sources.get(id);
      const url = source ? objectUrl(source) : '';
      return { ok: true, data: { file: sample(id, url, { originalName: names.get(id) ?? null }) } };
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 300))),
    newKey: () => crypto.randomUUID(),
    previewOf: (file) => objectUrl(file),
  });
}

export function UploadsPreview() {
  const [queue] = useState(previewQueue);
  // React runs effects twice in development; the sample files are added once.
  const seeded = useRef(false);
  const [viewer, setViewer] = useState<StoredFile[] | null>(null);
  const [submitted, setSubmitted] = useState(0);

  // The three states of the artboard, side by side: in progress, done, needs attention.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void (async () => {
      const pictures = await Promise.all([drawn(195), drawn(160), drawn(10)]);
      if (pictures.some((picture) => !picture)) return;
      const names = ['slow-IMG_0001.jpg', 'IMG_0002.jpg', 'fail-IMG_0003.jpg'];
      queue.add(
        'preview-repair',
        'Photo',
        names.map((name, i) => new File([pictures[i] as Blob], name, { type: 'image/jpeg' })),
      );
    })();
  }, [queue]);

  const openViewer = async () => {
    const photos = await Promise.all([drawn(195), drawn(160)]);
    const urls = photos.map((photo) => (photo ? objectUrl(photo) : ''));
    setViewer([
      sample(1, urls[0] ?? ''),
      sample(2, urls[1] ?? ''),
      sample(3, objectUrl(samplePdf()), {
        profile: 'PDF',
        originalName: 'invoice.pdf',
        width: null,
        height: null,
        pageCount: 3,
        capturedAt: null,
      }),
    ]);
  };

  return (
    <UploadProvider queue={queue}>
      <section aria-label="Upload preview">
        <FileDrop slot="preview-repair" profile="Photo" title="Repair photos" />
        <div className="bar">
          <Button onClick={() => void openViewer()}>Open the photo viewer</Button>
          <SubmitWhenReady
            slots={['preview-repair']}
            label="Submit step"
            onSubmit={() => setSubmitted((count) => count + 1)}
          />
          {submitted ? <span className="muted">Submitted {submitted}×</span> : null}
        </div>
      </section>
      {viewer ? (
        <PhotoViewer
          files={viewer}
          start={0}
          context={{ step: 'Mechanic Action', slot: 'Repair photo' }}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </UploadProvider>
  );
}
