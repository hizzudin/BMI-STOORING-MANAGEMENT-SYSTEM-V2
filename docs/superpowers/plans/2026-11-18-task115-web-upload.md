# TASK-115 plan: Web upload (FileDrop), three thumbnail states, submit when ready, PhotoViewer

Branch `feat/phase1-task115-web-upload`. Spec: REQ-FUP-006, REQ-FUP-007, REQ-FUP-012, REQ-FUP-014, REQ-FUP-016, AC-FUP-004, AC-FUP-009, C-29, DEC-33, DEC-139 (PRD v2.51, commit c8c8e9d). Artboards: `components/FileUploadStates`, `components/PhotoViewer`.

## Goal
One FileDrop and one PhotoViewer, used later by every screen with a file slot.
- **Picking a file:** the thumbnail shows at once; the file is checked, compressed and uploaded in the background while the user keeps working.
- **Three states:** each thumbnail shows only in progress, done, or needs attention (Retry or Remove).
- **Detail panel:** sizes and the profile appear only there.
- **Submit while uploading:** shows "Sending when photos finish…" and submits by itself when every file is Ready, even after the user moves to another screen.
- **PhotoViewer:** photos with zoom and pan, PDFs page by page, previous and next across the record, and the details.

Until a step screen exists, both are shown in the development kit gallery.

## API changes (small follow-ups of TASK-114, DEC-139)
- **`UploadLinkRequest.capturedAt`:** an optional ISO time, read in the browser. It is stored at insert, and the worker keeps it when the file has no EXIF time.
- **`StoredFile` adds:**
  - `uploadedBy: { name, role }`, from the uploader's account;
  - `uploadedAt`.
- **Integration tests:** `capturedAt` is kept for a compressed photo, and the uploader and upload time are in the response. The client is regenerated.

## Web
- **Packages, pinned:** `browser-image-compression` 2.0.2, `exifr` 7.1.3, `pdfjs-dist` 4.10.38 (the same version as the API).
- **`lib/files-api.ts`:** request the upload link, PUT the file to the signed URL with its headers, mark it uploaded, get the file.
- **`lib/uploads/prepare.ts`, the device check of 8.1 step 2:**
  - `sniffFileType` and `checkUpload` from `@bmi/shared`, plus the PDF page count with pdf.js;
  - a refused file gives one sentence and is never sent.
- **`lib/uploads/prepare.ts`, compression (step 3):**
  - JPEG is compressed with the profile's long side and quality ladder;
  - HEIC and PNG are sent unchanged, because the server converts HEIC and flattens transparency on white, while a browser JPEG would turn a transparent PNG black;
  - the capture time comes from `exifr` before compression.
- **`lib/uploads/upload-queue.ts`, `UploadQueue`, framework free:**
  - holds every picked file with its slot and its user state: progress, done or attention;
  - retries a failed upload 3 times with waits of 1, 2 and 4 s, and again when the browser comes back online (REQ-FUP-013, the device part);
  - polls the file until Ready or Rejected;
  - `submitWhenReady(slots, submit)` runs `submit` once, by itself, when every file of those slots is done. While a file needs attention, the submit waits.
- **`UploadProvider`:** in the `(app)` layout, so the queue lives above the screens and survives navigation (DEC-139).
- **`components/files/FileDrop.tsx`:**
  - follows the FileUploadStates artboard: the card title, a thumbnail row, the drop area "Drop photos or PDF, or take a photo" (click opens the file picker), and the note line;
  - a thumbnail shows only the ring, the check or the red badge; selecting one opens the detail panel (Original, Stored with size and dimensions, Profile, Remove);
  - while a file uploads and Submit was not pressed, leaving asks once (REQ-FUP-014, the existing `useLeaveGuard`); after Submit, leaving is allowed.
  - **`SubmitWhenReady`:** a button that shows "Sending when photos finish…" (C-18 busy) until the queue submits.
- **`components/files/PhotoViewer.tsx`, a dialog following the artboard:**
  - the image area with previous and next (C-29: the files of the same record), zoom in and out, 100%, and drag to pan;
  - a PDF is drawn page by page with pdf.js, with its own page buttons;
  - the details: Step, Slot, Taken at (WIB), Uploaded by "name · role", and the upload time;
  - Close and Esc close it (C-14);
  - Remove shows only when the screen says the viewer is the uploader's before submit.
- **Kit gallery (development only):** FileDrop over an in-memory files API that shows the three states and the detail panel, and PhotoViewer over sample photos and a generated PDF. The QA screenshots are taken here.

## Tests, RED first
- **Unit and RTL, web:**
  - **`upload-queue`:**
    - **AC-FUP-004:** Submit is pressed while one photo is uploading, and the submit runs once, by itself, when it becomes Ready, without a second tap;
    - a file that needs attention keeps the submit waiting until Retry or Remove;
    - 3 retries with growing waits, and a retry when the browser comes online.
  - **`prepare`:**
    - an MP4 named `.jpg` is refused with the sentence;
    - a PDF of 21 pages is refused;
    - HEIC and PNG go unchanged;
    - JPEG is compressed with the profile options and the capture time.
  - **`FileDrop`:**
    - **AC-FUP-009:** the words Compressing and Processing, and the file sizes, never appear on the thumbnails, only in the detail panel;
    - the three states, Remove, Retry, and the one leave prompt.
  - **`PhotoViewer`:**
    - previous and next across the record, zoom and 100%, the details text, Close and Esc;
    - Remove only for the uploader before submit;
    - the PDF page buttons, with pdf.js mocked.
- **API integration:** `capturedAt` and the uploader.
- **QA:** a throwaway `zz-qa.spec.ts` shoots the kit gallery next to both artboards and is deleted, never committed.
- **Web function coverage:** stays at 80% or above.

## Gates
- lint, typecheck, check:layers, check:coverage, check:secrets, check:client and Prettier;
- the web suite and the API suites;
- CI, with web and E2E.
