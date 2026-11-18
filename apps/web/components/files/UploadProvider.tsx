'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { filesApi, putToStorage } from '../../lib/files-api';
import { browserPrepareDeps } from '../../lib/uploads/browser';
import { prepareFile } from '../../lib/uploads/prepare';
import { UploadQueue, type UploadItem } from '../../lib/uploads/upload-queue';

const QueueContext = createContext<UploadQueue | null>(null);

/** The browser queue: the real routes, compression and timers (DEC-139). */
function browserQueue(): UploadQueue {
  const api = filesApi();
  return new UploadQueue({
    prepare: (file, profile) => prepareFile(file, profile, browserPrepareDeps),
    requestLink: api.requestLink,
    put: (upload, blob) => putToStorage(upload, blob),
    markUploaded: api.markUploaded,
    get: api.get,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    newKey: () => crypto.randomUUID(),
    // REQ-FUP-012: the browser can show JPEG and PNG at once; HEIC and PDF wait for the server.
    previewOf: (file) => (/^image\/(jpeg|png)$/.test(file.type) ? URL.createObjectURL(file) : null),
  });
}

/**
 * DEC-139: one upload queue above every screen of the signed-in app, so uploads and a pending
 * Submit go on when the user moves to another screen.
 */
export function UploadProvider({ queue, children }: { queue?: UploadQueue; children: ReactNode }) {
  const [current] = useState(() => queue ?? browserQueue());

  // REQ-FUP-013: files that could not be sent go again when the connection returns.
  useEffect(() => {
    const online = () => current.online();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [current]);

  return <QueueContext.Provider value={current}>{children}</QueueContext.Provider>;
}

export function useUploadQueue(): UploadQueue {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error('useUploadQueue needs an UploadProvider above it');
  return queue;
}

/** Every file of the queue; re-renders on each change. */
export function useUploads(): readonly UploadItem[] {
  const queue = useUploadQueue();
  return useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.snapshot(),
    () => queue.snapshot(),
  );
}
