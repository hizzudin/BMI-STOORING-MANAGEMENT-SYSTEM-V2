# TASK-115 Web upload (FileDrop), three thumbnail states, submit when ready, shared photo viewer

- **Requirements:** REQ-FUP-006, REQ-FUP-007, REQ-FUP-012, REQ-FUP-014, REQ-FUP-016.
- **Acceptance:** AC-FUP-004, AC-FUP-009.
- **Rules:** C-29, C-14, C-18, DEC-33.
- **Decision:** DEC-139 (PRD v2.51, commit c8c8e9d).
- **Screens built (visual target):** FileUploadStates and PhotoViewer, shown in the development kit gallery until a step screen exists.

## Spec first (DEC-139)
The owner decided before any code:
- **Compression:** `browser-image-compression`, with HEIC sent unchanged and the capture time read with `exifr`.
- **PDF in the viewer:** pdf.js.
- **Leaving the screen:** one upload queue in the web shell. The failure notification is left to the step submit (TASK-202).

The plan is `docs/superpowers/plans/2026-11-18-task115-web-upload.md`; the owner approved it ("Ya, setujui").

## What changed
- **API (follow-ups of TASK-114):**
  - `UploadLinkRequest` takes `capturedAt` and `originalBytes`;
  - `StoredFile` returns `uploadedBy` and `uploadedAt`;
  - the worker keeps the browser's capture time when the file has no EXIF time;
  - the file gateway joins the uploader's name and role;
  - the client is regenerated.
- **Web packages (exact):** `browser-image-compression` 2.0.2, `exifr` 7.1.3, `pdfjs-dist` 4.10.38.
- **Web code:**
  - `lib/files-api.ts`;
  - `lib/uploads/` (`prepare`, `browser`, `pdf`, `format`, `upload-queue`);
  - `components/files/` (`UploadProvider`, `FileDrop` with `SubmitWhenReady`, `PhotoViewer`);
  - `UploadProvider` in the `(app)` layout;
  - new kit icons;
  - the FileDrop and viewer styles in `globals.css`;
  - `components/dev/UploadsPreview.tsx` in the kit gallery.

## Divergences from the plan
- **`originalBytes` added to the link request.** The server recorded the uploaded (compressed) size as `original_bytes`, but §9.12 says "before compression". QA found it, because the detail panel's Original showed the compressed size.
- **Compression runs on the page, not in a web worker.** The library's worker loads the library from a CDN.
- **The viewer's details label the upload time "Uploaded at".** "Taken at" shows the date and time in WIB (the artboard shows a time only).

## Skills loaded
None by the Skill tool in this session. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **API:** the DEC-139 test failed (no `capturedAt`, `uploadedBy` or `uploadedAt` in the response).
- **Web:**
  - `upload-queue.test.ts` and `prepare.test.ts` failed (no modules);
  - `FileDrop.test.tsx` failed (no `./FileDrop`);
  - `PhotoViewer.test.tsx` failed (no `./PhotoViewer`).
- **Written after their code:** `files-api.test.ts`, `browser.test.ts`, `pdf.test.ts`, `UploadProvider.test.tsx` and `UploadsPreview.test.tsx`. The last three were added to keep web function coverage at 80% or above.

### GREEN
- **API `upload-pipeline.test.ts`:** 11 of 11, including DEC-139: the browser capture time and `originalBytes` are kept, and the response names the uploader with role and the upload time.
- **Web `upload-queue`:** 10 tests:
  - **AC-FUP-004:** Submit while uploading runs once, by itself, when the file is Ready;
  - an empty submit runs at once;
  - 3 retries after 1, 2 and 4 s, then attention;
  - back online, the file is sent again with the same Idempotency-Key;
  - Retry;
  - attention keeps the submit waiting until Remove;
  - a device refusal is never sent;
  - a server Rejected shows its sentence;
  - listeners and the snapshot.
- **Web `prepare`:** 8 tests:
  - **AC-FUP-002:** an MP4 named `.jpg` is refused;
  - a PDF of 21 pages is refused;
  - a PDF, a HEIC and a PNG go unchanged;
  - the Photo and Document quality ladders;
  - **AC-FUP-008:** a 14 MB photo is accepted;
  - an unreadable capture time is left out.
- **Web `FileDrop`:** 6 tests:
  - the artboard texts;
  - in progress, then done;
  - **AC-FUP-009:** no Compressing, Processing or sizes on the thumbnails; the detail panel shows "4,2 MB" and "412 KB · 1600 × 1200";
  - Retry and Remove;
  - the uploading signal for the leave prompt;
  - **AC-FUP-004:** "Sending when photos finish…", busy and disabled, then one submit.
- **Web `PhotoViewer`:** 7 tests:
  - the details: Step, Slot, Taken at, Uploaded by "Joko · Mechanic", Uploaded at;
  - previous and next;
  - zoom 150%, 200% and 100%;
  - drag to pan;
  - Close and Esc;
  - Remove only with `onRemove`;
  - a PDF "Page 1 of 3", then 2.
- **Web, the rest:** `UploadProvider` (the real routes in order: link, PUT, uploaded, GET; online; outside a provider), `pdf`, `browser`, `files-api` and `UploadsPreview`.

### QA against the artboards (kit gallery, built-in browser)
- **FileUploadStates:**
  - three thumbnails (ring, check, red badge), the dashed drop area, the note line;
  - the detail panel with Original, Stored and Profile and Remove.
  Fixed during QA:
  - the samples were added twice (React development effects run twice);
  - a file not yet Ready showed no local preview, because a Pending file's empty thumbnail URL won over the preview (a real bug).
- **PhotoViewer:**
  - the stage with Previous and Next, and the side details with Close;
  - a PDF drawn by pdf.js (no console errors).
  Fixed during QA:
  - the zoom controls wrapped to two lines;
  - the PDF page pushed its page buttons out of view; a page now fits the stage.
- No `zz-qa.spec.ts` was needed: the built-in browser took the screenshots, and nothing was committed for QA.

### Gates
- `pnpm typecheck` and `pnpm lint`, after two non-null assertions in a test were replaced.
- `pnpm check:layers`: 457 modules, no violation.
- `pnpm check:coverage` (named tests), `pnpm check:secrets` and `gen:client`.
- Web coverage: functions 81,06% (792 of 977).
- Prettier was run on every touched file.

### Suites
- **Web:** 242 passed.
- **API unit:** 35.
- **API integration, full run:** 270 passed and 1 skipped (s3). The 7 failures are the known local ones: 5 Redis queue tests (no local Redis), BR-10 and NFR-14.
- **E2E:** not run locally; CI runs it.

## Notes for later tasks
- **TASK-128:** browsers upload straight to storage, so the R2 bucket needs a CORS rule for the web origin. Locally with the filesystem storage, `STORAGE_PUBLIC_URL` must point at an origin the browser can PUT to.
- **TASK-202:** the one notification naming a file that failed for good (REQ-FUP-006).
