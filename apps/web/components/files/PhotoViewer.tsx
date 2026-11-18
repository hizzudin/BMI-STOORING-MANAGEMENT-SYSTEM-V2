'use client';

import { formatDateTimeWib, type StoredFile } from '@bmi/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { openPdf } from '../../lib/uploads/pdf';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';

const ZOOM_STEP = 0.5;
const ZOOM_MAX = 4;
/** A whole page fits the stage at 100%, with room for the page buttons. */
const PAGE_BOX = { width: 480, height: 290 };

export interface ViewerContext {
  /** The step and slot the screen shows the files of (REQ-FUP-016). */
  step: string;
  slot: string;
}

export interface PhotoViewerProps {
  /** The files of the same record, in order (C-29). */
  files: readonly StoredFile[];
  start: number;
  context: ViewerContext;
  onClose: () => void;
  /** Only for the uploader before submit (REQ-FUP-016); otherwise the viewer is read only. */
  onRemove?: (id: number) => void;
}

const roleText = (role: string | null) => (role ? role.replace(/_/g, ' ') : '');
const when = (iso: string | null) => (iso ? formatDateTimeWib(new Date(iso)) : '—');

/** A PDF drawn page by page with pdf.js (DEC-139). */
function PdfPages({ url, zoom }: { url: string; zoom: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<Awaited<ReturnType<typeof openPdf>> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let open = true;
    let loaded: Awaited<ReturnType<typeof openPdf>> | null = null;
    void (async () => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      loaded = await openPdf(bytes);
      if (open) setDocument(loaded);
    })();
    return () => {
      open = false;
      void loaded?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!document || !canvas.current) return;
    const target = canvas.current;
    void (async () => {
      const current = await document.getPage(page);
      const natural = current.getViewport({ scale: 1 });
      const fit = Math.min(PAGE_BOX.width / natural.width, PAGE_BOX.height / natural.height);
      const viewport = current.getViewport({ scale: fit * zoom });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      const context = target.getContext('2d');
      if (context) await current.render({ canvasContext: context, viewport }).promise;
    })();
  }, [document, page, zoom]);

  const pages = document?.numPages ?? 0;
  return (
    <div className="pdf-pages">
      <canvas ref={canvas} aria-label={`Page ${page}`} />
      <div className="bar">
        <Button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
        >
          <Icon name="previous" size={16} />
        </Button>
        <span>{pages ? `Page ${page} of ${pages}` : 'Opening the PDF…'}</span>
        <Button
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => setPage((current) => current + 1)}
        >
          <Icon name="next" size={16} />
        </Button>
      </div>
    </div>
  );
}

/**
 * PhotoViewer (REQ-FUP-016, DEC-33): one viewer for every photo and PDF. Zoom and pan, previous and
 * next across the files of the record (C-29), a PDF page by page, and the file's details.
 */
export function PhotoViewer({ files, start, context, onClose, onRemove }: PhotoViewerProps) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);
  const file = files[index];

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  if (!file) return null;
  const name = file.originalName ?? `File ${file.id}`;

  const go = (next: number) => {
    setIndex(next);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomTo = (value: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(1, value));
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };
  const startDrag = (event: PointerEvent<HTMLImageElement>) => {
    if (zoom === 1) return;
    drag.current = { x: event.clientX, y: event.clientY, from: pan };
  };
  const moveDrag = (event: PointerEvent<HTMLImageElement>) => {
    const from = drag.current;
    if (!from) return;
    setPan({ x: from.from.x + event.clientX - from.x, y: from.from.y + event.clientY - from.y });
  };

  return (
    <div className="scrim viewer-scrim">
      <div className="panel viewer" role="dialog" aria-modal="true" aria-label={name}>
        <div className="viewer-stage">
          <Button
            className="btn-icon viewer-prev"
            aria-label="Previous"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <Icon name="previous" />
          </Button>
          <div className="viewer-frame">
            {file.profile === 'PDF' && file.fileUrl ? (
              <PdfPages url={file.fileUrl} zoom={zoom} />
            ) : (
              <img
                src={file.fileUrl ?? file.thumbnailUrl ?? ''}
                alt={name}
                draggable={false}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={() => (drag.current = null)}
                onPointerLeave={() => (drag.current = null)}
              />
            )}
          </div>
          <Button
            className="btn-icon viewer-next"
            aria-label="Next"
            disabled={index === files.length - 1}
            onClick={() => go(index + 1)}
          >
            <Icon name="next" />
          </Button>
        </div>
        <div className="viewer-side">
          <div className="bar viewer-zoom">
            <Button
              aria-label="Zoom out"
              disabled={zoom === 1}
              onClick={() => zoomTo(zoom - ZOOM_STEP)}
            >
              <Icon name="minus" size={16} />
            </Button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <Button
              aria-label="Zoom in"
              disabled={zoom === ZOOM_MAX}
              onClick={() => zoomTo(zoom + ZOOM_STEP)}
            >
              <Icon name="plus" size={16} />
            </Button>
            <Button onClick={() => zoomTo(1)}>100%</Button>
          </div>
          <div className="row">
            <div className="grow">Step</div>
            <span>{context.step}</span>
          </div>
          <div className="row">
            <div className="grow">Slot</div>
            <span>{context.slot}</span>
          </div>
          <div className="row">
            <div className="grow">Taken at</div>
            <span>{when(file.capturedAt)}</span>
          </div>
          <div className="row">
            <div className="grow">Uploaded by</div>
            <span>
              {[file.uploadedBy.name, roleText(file.uploadedBy.role)].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className="row">
            <div className="grow">Uploaded at</div>
            <span>{when(file.uploadedAt)}</span>
          </div>
          <div className="bar">
            {onRemove ? <Button onClick={() => onRemove(file.id)}>Remove</Button> : null}
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
