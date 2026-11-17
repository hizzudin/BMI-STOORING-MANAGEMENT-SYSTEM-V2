# TASK-114 plan: Upload pipeline, server side

Branch `feat/phase1-task114-upload-pipeline`. Spec: REQ-FUP-001, REQ-FUP-002, REQ-FUP-003, REQ-FUP-005, REQ-FUP-009, REQ-FUP-010, REQ-FUP-013, NFR-06, DEC-31, DEC-136 (PRD v2.48, commit 682c4b0). No migration: `stored_files` exists (§9.12).

## Goal
The server side of 8.1:
- a client gets a signed upload link for one slot profile;
- after the upload, a worker checks the file again and compresses it if needed;
- the worker writes the thumbnail and the hash, and sets Ready or Rejected with a reason;
- files never attached are removed after 24 hours.

The web component is TASK-115; the phone queue is TASK-705.

**Done when** `int "AC-FUP-001|AC-FUP-002|AC-FUP-003|AC-FUP-005|AC-FUP-006|AC-FUP-008"` passes, and unit tests cover the profiles, the type sniffer and the per-step limit check.

## Architecture

### Shared (`packages/shared/src/files/`), also used by TASK-115 on the device
- **`UPLOAD_PROFILES`:** Photo, Document and PDF, with the numbers of the 8.1 table:
  - accepted input and the size limits (30 MB image, 10 MB and 20 pages PDF);
  - long side 1600 or 2400 px;
  - the quality ladders, 80/70/60 while above 1 MB and 85/75 while above 1,5 MB;
  - the thumbnail, 320 px at JPEG 70%.
- **`sniffFileType(bytes)`:** the type from the first bytes, never the name. It knows:
  - JPEG `FF D8 FF`;
  - PNG `89 50 4E 47`;
  - PDF `%PDF-`;
  - HEIC/HEIF, an ISO box `ftyp` with brand heic, heix, hevc, mif1, msf1 or heif.
  Every other `ftyp` brand (mp4, mov) and anything else is `unknown`.
- **`checkUpload(profile, {type, bytes, pages?})`:** one plain sentence when a file is refused (REQ-FUP-002), or ok.
- **`checkStepFileLimits(files)`:** at most 10 photos and 5 documents per step (REQ-FUP-010). This is the one check that each step task applies at attach time (DEC-136).

### API
- **Ports:**
  - `StoragePort` gains `remove(key)`, used only for incoming objects and never-attached files (DEC-136). Both adapters implement it, and the contract suite gets one case for it.
  - New `ports/files.ts`: `FileGateway` (create Pending, find, set Ready, set Rejected, list expirable, set Expired) and `ImageProcessor` (`processImage`, `processPdf`).
- **Core `core/files/`:**
  - **`FileService`:**
    - `requestUpload(actor, {profile, contentType, bytes, originalName, captureSource})` needs `files.upload`, refuses a type or size the profile does not accept, and creates a Pending row (keys from `storageKey`: entity `files`, the storage_key ending in `.jpg`/`.pdf`, the incoming key under `incoming/`). It returns the file id and a signed upload link for the incoming key. Mutating, so it takes an Idempotency-Key.
    - `markUploaded(actor, id)`: the uploader says the bytes landed, and the processing job is enqueued with jobId = file id, so a retried call adds no second job.
    - `get(actor, id)`: status, reason, sizes, and signed links to the thumbnail and the file when Ready. Until the attach tasks exist, only the uploader may read it.
  - **`FileProcessor`** (the job):
    - reads the incoming object and sniffs it;
    - refuses a wrong type or an over-limit file as Rejected, with the sentence of `checkUpload`;
    - for images, calls `processImage`: EXIF rotation, resize without upscaling, flatten on white, the quality ladder, EXIF stripped and `captured_at` kept;
    - for PDFs, calls `processPdf`: the page count, then the first-page thumbnail, with the file stored unchanged;
    - writes the output and the thumbnail, sets Ready with sha256, final size, width, height and pages, then removes the incoming object.
    A thrown error is retried 3 times with growing waits by BullMQ (REQ-FUP-013, server part); after that the file is set Rejected with a plain reason.
  - **`FileCleanup`** (the 24-hour job): Pending or Rejected rows with no `attached_at`, older than 24 hours, have their objects removed and are set Expired (REQ-FUP-009). It can be rerun safely: an already removed object is not an error.
- **Infra:**
  - `infra/files/sharp-image-processor.ts`: sharp, plus `heic-decode` for HEIC, plus `exif-reader` for the capture time.
  - `infra/files/pdf-processor.ts`: `pdfjs-dist` legacy build and `@napi-rs/canvas`.
  - `infra/db/file-gateway.ts`: Drizzle.
  - Two BullMQ queues, `file-processing` and `file-cleanup`. The cleanup runs every hour, so a file goes within 25 hours.
- **HTTP `http/files/`:**
  - `POST /files/upload-links` (Idempotency-Key);
  - `POST /files/:id/uploaded`;
  - `GET /files/:id`.
  Each gets `@ApiContract` and Zod schemas in shared; the client is regenerated.
- **Audit:** none. Files are not core records until attached (REQ-FUP-009), and attaching is audited by the record that attaches them.

## Packages (exact versions, pinned)
- `sharp` 0.33.5
- `heic-decode` 2.0.0
- `exif-reader` 2.0.1
- `pdfjs-dist` 4.10.38
- `@napi-rs/canvas` 0.1.65

All of them ship prebuilt binaries or WebAssembly; none needs a system package.

## Tests (RED first, each before its code)
- **Shared unit:**
  - the profile limits;
  - the sniffer on JPEG, PNG, PDF, HEIC and MP4 headers;
  - `checkUpload` sentences;
  - `checkStepFileLimits`: 10 photos ok, 11 refused, 6 documents refused.
- **Integration (`test/integration/files/`, fs storage, Redis worker):**
  - **AC-FUP-001:** a 4032 × 3024 JPEG photo of about 4,2 MB, made in the test with sharp from noise, with EXIF GPS and capture time, becomes 1600 × 1200, below 1 MB, without GPS, with `captured_at` kept and a 320 px thumbnail.
  - **AC-FUP-002:** MP4 bytes named `.jpg`. The upload link is refused when the declared type is a video. When the bytes are uploaded under a jpeg link, the worker sets Rejected.
  - **AC-FUP-003:** an 8 MB uncompressed JPEG is compressed to the Photo profile before Ready.
  - **AC-FUP-005:** a 1,8 MB PDF of 3 pages, generated in the test, is stored byte for byte unchanged, with `page_count` 3 and a first-page thumbnail. A 21-page PDF is Rejected.
  - **AC-FUP-006:** a Pending photo is removed from storage and set Expired after 24 hours (FakeClock). An attached or Ready-and-attached file is untouched.
  - **AC-FUP-008:** a 14 MB photo is accepted and stored below 1 MB, with no message.
  - **HEIC:** a HEIC photo is converted to JPEG. This needs one small HEIC test file committed under `test/fixtures/`. No encoder is available here, so I will make it once from a photo of my own; if I cannot make one, I will ask you before using any downloaded sample.
  - **Permissions and links:**
    - without `files.upload` → 403;
    - another user's file → 404;
    - a repeated Idempotency-Key gives the same file.
  - **Storage contract:** `remove` deletes an incoming object, for both adapters.

## Gates
- lint, typecheck, check:layers, check:secrets, check:coverage, gen:client and Prettier;
- the full API unit and integration suites, run locally before the push;
- CI for web and E2E.

## Risks
- **Memory:** sharp and the PDF renderer need memory, and this machine has about 1 GB free. Test images stay at the sizes named in the ACs and the integration run keeps workers at 1.
- **Licences:**
  - `heic-decode` bundles libheif, which is LGPL; it is used as an unmodified dependency.
  - pdf.js is Apache-2.0.
  - sharp is Apache-2.0, and its libvips binary is LGPL.
