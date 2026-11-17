# TASK-114 Upload pipeline, server side

- **Requirements:** REQ-FUP-001, REQ-FUP-002, REQ-FUP-003, REQ-FUP-005, REQ-FUP-009, REQ-FUP-010, REQ-FUP-013.
- **Acceptance:** AC-FUP-001, AC-FUP-002, AC-FUP-003, AC-FUP-005, AC-FUP-006, AC-FUP-008.
- **Rules:** NFR-06, NFR-01, DEC-31.
- **Decision:** DEC-136 (PRD v2.48, commit 682c4b0).
- **Tables:** none changed (`stored_files` exists, §9.12).

## Spec first (DEC-136, PRD v2.48, commit 682c4b0)
The owner decided before any code:
- **HEIC on the server:** sharp with a WebAssembly HEIC decoder (`heic-decode`).
- **PDF:** pdf.js with `@napi-rs/canvas`, for the page count and the first-page thumbnail.
- **The upload link checks `files.upload`.** The record, step and per-step limit checks (10 photos, 5 documents) are one shared check (`checkStepFileLimits`), applied at attach time by each step task.
- **The 8.1 serve link time** is corrected from 5 to 15 minutes, as DEC-135 decided.

The plan also recorded:
- an incoming key, removed after processing, so only the compressed file and its thumbnail are kept (NFR-06);
- the one `remove` on the StoragePort that this needs.

The plan is `docs/superpowers/plans/2026-11-17-task114-upload-pipeline.md`; the owner approved it ("Ya, setujui").

## What changed
- **Shared:**
  - `files/index.ts`: `UPLOAD_PROFILES`, `sniffFileType`, `checkUpload`, `checkStepFileLimits` and `FILE_MESSAGES`;
  - `schemas/files.ts`: the request and response schemas.
- **API:**
  - `ports/files.ts`;
  - `StoragePort.remove`, in both adapters;
  - `core/files/file-service.ts` and `core/files/file-jobs.ts`;
  - `infra/files/media-processor.ts`, `infra/db/file-gateways.ts` and `infra/queue/file-queues.ts`;
  - `http/files/files.controller.ts`;
  - the tokens `FILE_JOBS` and `MEDIA`, the providers in `app.module.ts`, and the processors in `worker.ts`.
- **Packages (exact):**
  - `sharp` 0.33.5, with its build script denied in `pnpm-workspace.yaml` because the prebuilt binaries are used;
  - `heic-decode` 2.0.0;
  - `exif-reader` 2.0.1;
  - `pdfjs-dist` 4.10.38;
  - `@napi-rs/canvas` 0.1.65.
- **`.env.example`:** `STORAGE_ENV`, without a value.
- **Fixture:** `apps/api/test/fixtures/photo.heic`, 640 × 480, 7 KB. No HEIC encoder was available on the machine, so a test picture was encoded as one HEVC still with ffmpeg (libx265) and wrapped in a minimal HEIF container by a throwaway script, which was not committed. `heic-decode` reads it back at 640 × 480.

## Divergences from the plan
- **Image and PDF processing are one class** (`SharpPdfjsMediaProcessor` in `infra/files/media-processor.ts`), not two files, because they serve one port.
- **Both POST routes take an Idempotency-Key** (NFR-01), not only the upload link.
- **The processing job makes 4 attempts:** the first run and 3 retries (REQ-FUP-013).

## Skills loaded
None by the Skill tool in this session. This is in the workflow audit.

## Evidence

### RED
- **Shared `files.test.ts`:** failed first (no module).
- **API, test-first was not kept for every part.** This is recorded as it happened:
  - the `remove` contract case was written before the adapter code, but it was not run red before the code;
  - the integration tests in `test/integration/files/upload-pipeline.test.ts` were written after the service, worker and route code.

### GREEN
- **Shared:** 10 of 10 (whole shared suite: 337).
- **`upload-pipeline.test.ts`:** 10 of 10:
  - **AC-FUP-001:** a 4032 × 3024 photo of 4,4 MB with EXIF GPS becomes 1600 × 1200 below 1 MB, without EXIF, with `captured_at` kept, a 320 px thumbnail and the sha256 of the stored bytes; the incoming object is gone.
  - **AC-FUP-002:** the link is refused for `video/mp4`. MP4 bytes uploaded as `clip.jpg` are Rejected with the type sentence, and nothing stays in storage.
  - **AC-FUP-003:** an uncompressed JPEG above 7 MB is compressed to 1600 × 1200, below 1 MB.
  - **AC-FUP-005:** a 1,8 MB PDF of 3 pages is stored byte for byte, with `page_count` 3 and a 320 px thumbnail. A 21-page PDF is Rejected.
  - **AC-FUP-008:** a photo above 12 MB, 6000 × 4500, is accepted and stored below 1 MB, with no reason.
  - **HEIC:** converted to a JPEG of 640 × 480.
  - **AC-FUP-006:** a Pending file is still there after 23 hours; it is Expired after 25 hours and its incoming object is removed. A Pending file with `attached_at` set, and the Ready files, stay. A rerun removes nothing.
  - **REQ-FUP-004:** Accounting, without `files.upload`, gets 403, and another user's file gives 404.
  - **NFR-01:** the same Idempotency-Key gives the same file.
- **Storage contract, fs:** 6 of 6, with `remove`. The s3 run is skipped locally; CI runs it on LocalStack.
- **A first run failed 2 tests:** the 24-hour test moved the clock and ended the sessions of the tests after it. That test now runs last.

### Gates
- `pnpm typecheck` (monorepo) and `pnpm --filter @bmi/api lint`, after 12 non-null assertions in the test were replaced by a `must` helper.
- `pnpm check:layers`: 429 modules, no violation.
- `pnpm check:coverage` (named tests) and `pnpm check:secrets`: clean.
- `gen:client` regenerated, with the `@bmi/api-client` build.
- Prettier was run on every touched file.

### Suites
- **API unit:** 30.
- **API integration, full run:** 260 passed and 1 skipped (s3). The 7 failures are the known local ones: 5 Redis queue tests (no local Redis), BR-10 and NFR-14.
- **Web and E2E, not run locally:** this task changes no web code apart from the regenerated client, and CI runs them.
