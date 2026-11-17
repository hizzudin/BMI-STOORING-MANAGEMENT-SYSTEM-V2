# TASK-113 plan: Storage port, filesystem and S3 (R2) adapters, one contract suite, signed links

Branch `feat/phase1-task113-storage-port`. Spec: REQ-FUP-004, REQ-FUP-008, NFR-13, NFR-11, DEC-32, D-03, DEC-135 (PRD v2.47). No migration: `stored_files` exists (§9.12).

## Goal
Files live behind one `StoragePort`.
- **Filesystem adapter:** for local work and tests.
- **S3 adapter:** for Cloudflare R2, on the AWS SDK v3.
- **Contract suite:** both adapters pass the same suite.
- **Links:** files are private and opened through signed links that expire after 15 minutes.
- **No delete or overwrite:** nothing deletes a file (BR-10), and nothing overwrites an existing key (REQ-FUP-008).

**Done when:**
- `int "storage contract"` passes for the filesystem adapter locally and in CI;
- the same suite passes for the S3 adapter against MinIO in CI;
- locally without `R2_*` settings the S3 run is reported skipped.

## Architecture
- **Shared:**
  - `STORAGE_LINK_SECONDS = 900`;
  - `storageKey({ env, at, entity, id, ext })` gives `{env}/{yyyy}/{mm}/{entity}/{uuid}.{ext}`, as §9.12, with a unit test.
- **Port (`ports/storage.ts`):** `StoragePort`:
  - `signUpload(key, { contentType, maxBytes })` returns `{ url, method: 'PUT', headers, expiresAt }`;
  - `signDownload(key)` returns `{ url, expiresAt }`;
  - `head(key)` returns `{ bytes, contentType }` or null;
  - `read(key)`;
  - `write(key, bytes, contentType)`, which refuses an existing key;
  - `totalBytes()`, for TASK-133.

  There is no delete.
- **`infra/storage/fs-storage.ts`:**
  - files under `STORAGE_FS_ROOT` (default `.data/storage`, gitignored);
  - a signed link is an API URL `/storage/fs/{token}`, where the token is an HMAC over key, operation, expiry, content type and the byte limit, using `STORAGE_SIGNING_SECRET` (a local default; required in production, never committed);
  - the clock comes from `ClockPort`.
- **`infra/storage/s3-storage.ts`:**
  - an `S3Client` with `endpoint`, `region: 'auto'`, path style and the `R2_*` credentials;
  - links presigned with `expiresIn: 900`;
  - `write` uses `IfNoneMatch: '*'`;
  - `totalBytes` pages through `ListObjectsV2`.
- **Routes (`FsStorageController`):** `PUT` and `GET /storage/fs/:token`. They are registered only when `STORAGE_DRIVER=fs`:
  - an expired or bad token gets 403 with one sentence;
  - a PUT checks the content type and the byte limit, and refuses an existing key (409).
- **Composition:** `STORAGE_DRIVER` (`fs` by default, `s3` in staging and production) picks the adapter in `app.module.ts`.
- **Not in this task:** asking for an upload link with the permission check and creating the `stored_files` row (REQ-FUP-004's check) is the upload pipeline of TASK-114.
- **CI:**
  - a MinIO service container;
  - `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` set for the integration step;
  - the suite creates the bucket when it is missing.
- **`.env.example`:** the new names without values.

## Tests (written first, run red)
- **Unit:** `storageKey`.
- **Integration (`test/integration/storage/storage-contract.test.ts`, `describe.each` over the adapters, titles starting "storage contract"):**
  - a signed upload link takes the bytes; `head` gives the size and type; a signed download link gives the same bytes back;
  - links last 15 minutes:
    - fs: the FakeClock moved past 900 seconds refuses the link;
    - s3: the presigned URL carries `X-Amz-Expires=900`;
  - an existing key is never overwritten, by `write` or by a second signed upload;
  - an upload over the byte limit or of another content type is refused (fs route; s3 by the signed headers);
  - `read` and `write` round-trip, and `totalBytes` sums what was written;
  - a missing key: `head` gives null.
- **S3 runs:** only when `R2_ENDPOINT` is set; otherwise `describe.skip` with the reason in its title.

## Review focus
1. **A link that never expires, or expires early.** Owned by the expiry test.
2. **A file overwritten or deleted.** Owned by the overwrite test; the port has no delete.
3. **A signed upload larger than allowed, or of another type.** Owned by the limit test.
4. **Secrets in the repo.** Only names in `.env.example`; `check:secrets`.
5. **Core importing the AWS SDK or the filesystem.** Owned by `check:layers`.

## Out of scope
- Upload profiles, type sniffing, the worker and thumbnails (TASK-114).
- The usage alert (TASK-133).
- The R2 lifecycle and the real R2 run (TASK-128).

## Execution
- **Order:** shared, then port and adapters (RED, then GREEN), the routes, the CI service, the gates and the bookkeeping.
- **No web screen and no E2E:** the task has no screen.
