# TASK-113 Storage port, filesystem and S3 (R2) adapters, one contract suite, signed links

- **Requirements:** REQ-FUP-004, REQ-FUP-008.
- **Rules:** NFR-13, NFR-11, DEC-32, D-03.
- **Decision:** DEC-135 (PRD v2.47, commit 7f97160).
- **Tables:** none changed (`stored_files` exists, §9.12).

## Spec first (DEC-135, PRD v2.47, commit 7f97160)

The owner decided before any code:
- **The R2 adapter is built now**, on the AWS SDK v3, and tested against an S3 emulator in CI. Locally, without the `R2_*` settings, the S3 run is skipped, never passed. The run against real R2 stays in TASK-128.
- **Two answers first conflicted** ("defer R2" and "test R2 with a mock"); I asked again, and the owner chose to build R2 now and test it with a mock.
- **Signed upload and download links last 15 minutes.**
- **The daily usage alert** is the new TASK-133, after TASK-114.
- **The Infrequent Access move** is an R2 lifecycle rule in TASK-128.

The plan is `docs/superpowers/plans/2026-11-17-task113-storage-port.md`; the owner approved it ("Ya, setujui").

## What changed
- **Shared:** `storage/index.ts` with `STORAGE_LINK_SECONDS` and `storageKey`.
- **API:**
  - `ports/storage.ts`: `StoragePort`, `SignedLinkServer` and the errors;
  - `infra/storage/fs-storage.ts` and `infra/storage/s3-storage.ts`;
  - `http/storage/fs-storage.controller.ts`, with `PUT`/`GET /storage/fs/:token`, registered only for the fs driver;
  - the tokens `STORAGE` and `STORAGE_LINKS`, wired in `app.module.ts` by `STORAGE_DRIVER`;
  - `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` 3.700.0.
- **CI:** a LocalStack service container (`localstack/localstack:4.0.3`, S3 only, signature validation on), with throwaway `R2_*` values for the integration step.
- **`.env.example`:** the storage names, without values.

## Divergences from the plan
- **`signUpload` takes the exact size (`bytes`), not a maximum.** A presigned S3 URL can only bind an exact Content-Length, and the two adapters must behave the same.
- **The controller injects `STORAGE_LINKS`** (an interface in the port), not the fs adapter class: `check:layers` refuses http importing infra.
- **There is no getter on the controller:** the OpenAPI emitter reads every prototype property, and a throwing getter broke `gen:client`.

## Skills loaded
None by the Skill tool in this session. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Shared `storage.test.ts`:** failed (no module).
- **API `storage-contract.test.ts`:** failed (no adapter module).

### GREEN
- **Shared:** 3 of 3.
- **Contract suite, fs:** 5 of 5:
  - signed upload, then head and signed download;
  - links expire after 15 minutes (the FakeClock moved 16 minutes);
  - an existing key is never overwritten, by `write` or by a second signed upload;
  - another type or size than signed is refused;
  - read and write round-trip, and `totalBytes`.
- **Contract suite, s3:** 1 skipped locally (no `R2_*`). It runs on LocalStack in CI.

### Gates
- `pnpm lint` and `pnpm typecheck`: 9 of 9.
- `pnpm check:layers`: 412 modules, no violation (after the `STORAGE_LINKS` fix).
- `pnpm check:secrets`: clean.
- `check-coverage --tests`: Coverage OK.
- `gen:client` regenerated.
- Prettier was run on every touched file.

### Suites
- **API unit:** 30.
- **API integration, full run:** 249 passed and 1 skipped (s3). The 7 failures are the known local ones (5 Redis queue tests, BR-10, NFR-14).
- **Web, not complete locally:** this task changes no web code, but the machine had about 1.1 GB of free RAM. Vitest could not start the workers of 5 files ("Timeout waiting for worker to respond"); the 26 files that ran passed (158 tests). This is not counted as passed; CI runs the full web suite.
- **E2E, not run locally:** the task has no screen, and the machine was short of memory. CI runs the full E2E.

## Addendum: CI on PR #11
- **First run:** red at the MinIO step: `minio/minio` can no longer be pulled from Docker Hub.
- **Second run:** the official binary was tried instead; `dl.min.io` answers 410 Gone, so MinIO is no longer obtainable.
- **The owner chose LocalStack** (`localstack/localstack:4.0.3`) as the S3 emulator in CI. It runs with `S3_SKIP_SIGNATURE_VALIDATION=0`, so the presigned links are really checked. The DEC-135 text and the design were corrected from MinIO to LocalStack.
- **Third run:** green, but the S3 run was still skipped (6 tests, 1 skipped): Turbo passes only the env names listed in `turbo.json`, so the `R2_*` settings never reached the tests. They are now in `passThroughEnv` of `test:int` and `test:coverage`, and the run is only counted when the CI log shows the s3 tests executed.
- **Fourth run:** the s3 tests ran (11 tests) and failed at bucket creation: LocalStack refuses the region `auto`, which only R2 accepts. The adapter now takes an optional `region` (`R2_REGION`, default `auto` for R2); CI sets `us-east-1`.
