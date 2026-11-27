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
  body: (uri: string) => Promise<Blob>,
  key: () => string,
): Promise<UploadedPhoto> {
  const auth = { authorization: `Bearer ${token}` };
  const bytes = await body(photo.uri);
  const link = await postJson<{
    file: { id: number };
    upload: { url: string; headers: Record<string, string> };
  }>(
    fetcher,
    `${apiUrl}/files/upload-links`,
    {
      profile: 'Photo',
      contentType: photo.contentType,
      bytes: bytes.size,
      originalName: null,
      captureSource: 'Camera',
    },
    { ...auth, 'Idempotency-Key': key() },
  );
  const put = await fetcher(link.upload.url, {
    method: 'PUT',
    headers: link.upload.headers,
    body: bytes,
  });
  if (!put.ok) throw await refusal(put);
  const done = await postJson<{ file: { id: number; status: string } }>(
    fetcher,
    `${apiUrl}/files/${link.file.id}/uploaded`,
    {},
    { ...auth, 'Idempotency-Key': key() },
  );
  return { id: done.file.id, status: done.file.status };
}
