/**
 * TASK-127 part A (NFR-18, DEC-141, DEC-142): the spike's calls to the API. Framework free and
 * given `fetch`, so the same code runs in Expo Go, in the phone browser and in tests. TASK-704 and
 * TASK-705 replace it with the generated client and the upload queue.
 */

/** The one `fetch` signature the spike uses (React Native's global `fetch` has several). */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface SpikeSession {
  accessToken: string;
  user: { name: string; role: string | null };
}

/** The size is not taken from the picker: the link names the bytes actually sent (storage checks them). */
export interface SpikePhoto {
  uri: string;
  contentType: string;
}

/**
 * The platform's file access (DEC-142): on the phone app expo-file-system, in the browser fetch and
 * Blob. `put` sends the file at `uri` as the raw body and answers the HTTP status and body text.
 */
export interface SpikeFile {
  size(uri: string): Promise<number>;
  put(
    url: string,
    headers: Record<string, string>,
    uri: string,
  ): Promise<{ status: number; body: string }>;
}

/** The stored file after the uploaded signal: Pending until the worker makes it Ready. */
export interface UploadedPhoto {
  id: number;
  status: string;
}

const FALLBACK = 'Something went wrong. Try again.';

/** The server's one sentence for a refused request (C-34). */
async function refusal(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return new Error(typeof body?.message === 'string' ? body.message : FALLBACK);
}

async function postJson<T>(
  fetcher: Fetcher,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await refusal(response);
  return (await response.json()) as T;
}

/** REQ-IAM-001: sign in as a mobile client; the tokens come back in the body. */
export async function signIn(
  fetcher: Fetcher,
  apiUrl: string,
  email: string,
  password: string,
): Promise<SpikeSession> {
  const result = await postJson<{
    accessToken?: string;
    user: { name: string; role: string | null };
  }>(fetcher, `${apiUrl}/auth/sign-in`, { email, password, client: 'mobile' });
  if (!result.accessToken) throw new Error(FALLBACK);
  return {
    accessToken: result.accessToken,
    user: { name: result.user.name, role: result.user.role },
  };
}

/** REQ-FUP-004, REQ-FUP-005: an upload link, the PUT of the bytes, then the uploaded signal. */
export async function uploadPhoto(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  photo: SpikePhoto,
  file: SpikeFile,
  key: () => string,
): Promise<UploadedPhoto> {
  const auth = { authorization: `Bearer ${token}` };
  const bytes = await file.size(photo.uri);
  const link = await postJson<{
    file: { id: number };
    upload: { url: string; headers: Record<string, string> };
  }>(
    fetcher,
    `${apiUrl}/files/upload-links`,
    {
      profile: 'Photo',
      contentType: photo.contentType,
      bytes,
      originalName: null,
      captureSource: 'Camera',
    },
    { ...auth, 'Idempotency-Key': key() },
  );
  const put = await file.put(link.upload.url, link.upload.headers, photo.uri);
  if (put.status < 200 || put.status >= 300) {
    throw await refusal(new Response(put.body, { status: put.status }));
  }
  const done = await postJson<{ file: { id: number; status: string } }>(
    fetcher,
    `${apiUrl}/files/${link.file.id}/uploaded`,
    {},
    { ...auth, 'Idempotency-Key': key() },
  );
  return { id: done.file.id, status: done.file.status };
}
