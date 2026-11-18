import type { ApiClient } from '@bmi/api-client';
import type { UploadLinkRequest, UploadLinkResponse } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** The file routes of 8.1 (REQ-FUP-004, DEC-136) through the generated client. */
export function filesApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ path: { id: String(id) } });
  // NFR-01: a retry of the same request sends the same key.
  const keyed = (key: string) => ({ headers: { 'Idempotency-Key': key } });
  return {
    requestLink: (body: UploadLinkRequest, key: string) =>
      settle(client().POST('/files/upload-links', { body, ...keyed(key) })),
    markUploaded: (id: number, key: string) =>
      settle(client().POST('/files/{id}/uploaded', { params: path(id), ...keyed(key) })),
    get: (id: number) => settle(client().GET('/files/{id}', { params: path(id) })),
  };
}

export type FilesApi = ReturnType<typeof filesApi>;

/** 8.1 step 5: the file goes from the browser straight to storage, never through the app server. */
export async function putToStorage(
  upload: UploadLinkResponse['upload'],
  blob: Blob,
  send: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const answer = await send(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: blob,
    });
    return answer.ok;
  } catch {
    return false;
  }
}
