# TASK-127 part A Mobile Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove on a real Android 8.0+ phone, in Expo Go, that the mobile app signs in through the API, takes a camera photo and uploads it through `/files`, and reads the position (NFR-18, DEC-66, DEC-141).

**Architecture:** One temporary screen `app/spike.tsx`, reachable only in a development build. Its network work lives in a framework-free module `src/spike/spike-api.ts` (sign-in, upload link, PUT, uploaded signal) that takes `fetch` as a parameter, so it is unit tested without a phone. The camera is `expo-image-picker` (`launchCameraAsync`), the position `expo-location`. The phone reaches the API and Metro over the same Wi-Fi at the laptop's LAN address.

**Tech Stack:** Expo SDK 58, React Native 0.88, expo-router, expo-image-picker and expo-location (versions chosen by `npx expo install` for SDK 58), Vitest for the module tests.

**Spec:** `PRD.md` NFR-18, DEC-66, DEC-141 (PRD v2.53, commit a41c5e4); `specs/design.md` D-11; `docs/prd/areas/8.1-fup.md` for the upload flow already built in TASK-114 (REQ-FUP-004, REQ-FUP-005).

**Branch:** `feat/phase1-task127-mobile-spike`.

## Success criteria (Done when)
- The _Verify_ line: a recorded device run on the owner's Android 8.0+ phone shows sign-in, one camera photo uploaded (the file reaches `uploaded`), and the position on screen; notes in `specs/evidence/TASK-127.tdd.md`.
- The module tests pass; typecheck, lint and the repository gates pass.
- TASK-127 stays `[ ]` (part B is BLOCKED Q-03); part A is recorded as done in the task scope, the evidence and CONTEXT.

## Workflow (WORKFLOW_STANDARDS)

| Step | What | State |
| --- | --- | --- |
| §6.1 | `next-numbers.mjs` (DEC-141, v2.53, row 51); branch from `main` | Done |
| §1 1–8 | Task entry, NFR-18, DEC-66, §8.3, D-11, MOB area, the scaffold of `apps/mobile` | Done |
| §1 10 | Owner answers → DEC-141 in PRD, history, design D-11, tasks.source; committed a41c5e4 | Done |
| §1 11, §2A | This plan; owner review | Waiting for "Ya, setujui" |
| §1 12 | No FLW on the task line, so no Playwright spec; the recorded device run is the end-to-end proof | — |
| §1 13–14 | Module tests RED, then GREEN | After approval |
| §4, §1 15–20 | Gates, device run with the owner, evidence, CONTEXT, AGENT_LOG, audit, PR on the owner's word | After approval |

## Decisions I made (the owner may change them)
1. **`expo-image-picker` for the camera** (`launchCameraAsync`, camera only, JPEG), not `expo-camera`: one call, no custom camera view, enough for the proof; the field camera screens of TASK-705 choose again.
2. **The spike signs in as the local System Admin `sa.qa@bmi.test` on `bmi_dev`.** `bmi_dev` is in Setup mode, where only the System Admin may sign in (DEC-56), and the System Admin holds `files.upload`. You type the password on the phone; it never goes into code, tests or chat.
3. **The photo is uploaded as profile `Photo`, capture source `Camera`, without compression on the phone** (the phone compression is TASK-705); the spike stops at `uploaded`. The worker's processing to Ready is shown only if Redis is up.
4. **The API base URL comes from `EXPO_PUBLIC_API_URL`** (the laptop's LAN address, e.g. `http://192.168.x.y:3001`); the API runs with `STORAGE_PUBLIC_URL` at the same address so the phone can PUT to it.
5. **Development only:** `app/spike.tsx` renders nothing unless `__DEV__`, and the home screen shows a "Spike" link only in `__DEV__`. TASK-704 removes it.
6. **Vitest in `apps/mobile`** for `spike-api.ts` (node environment, no React Native renderer); it joins the root test run.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/mobile/src/spike/spike-api.ts` | create | `signIn`, `uploadPhoto` over a given `fetch` |
| `apps/mobile/src/spike/spike-api.test.ts` | create | the module tests |
| `apps/mobile/app/spike.tsx` | create | the temporary screen: email, password, Sign in; Take photo; Read position; the results |
| `apps/mobile/app/index.tsx` | modify | the `__DEV__` link to the spike |
| `apps/mobile/app.json` | modify | the image-picker and location plugins with Android permission texts |
| `apps/mobile/package.json` | modify | expo-image-picker, expo-location, vitest, the `test` script |
| `apps/mobile/vitest.config.ts` | create | node environment |
| `pnpm-lock.yaml`, `pnpm-workspace.yaml` | modify | the new packages (a release-age exclusion only if pnpm refuses a package Expo requires) |

## Interfaces
```ts
export interface SpikeSession { accessToken: string; user: { name: string; role: string | null } }
export function signIn(fetcher: typeof fetch, apiUrl: string, email: string, password: string): Promise<SpikeSession>;
export interface SpikePhoto { uri: string; bytes: number; contentType: string }
export interface UploadedPhoto { id: number; state: string }
export function uploadPhoto(
  fetcher: typeof fetch, apiUrl: string, token: string, photo: SpikePhoto,
  body: (uri: string) => Promise<Blob>, key: () => string,
): Promise<UploadedPhoto>;
```
`uploadPhoto` = `POST /files/upload-links` (Idempotency-Key, `{ profile: 'Photo', contentType, bytes, originalName: null, captureSource: 'Camera' }`), `PUT upload.url` with `upload.headers` and the body, `POST /files/:id/uploaded` (Idempotency-Key). A refused step throws an `Error` with the server's one sentence.

## Tests (RED first)
- `NFR-18 signIn posts the email, the password and client mobile, and returns the token and the user`.
- `REQ-IAM-001 signIn throws the server sentence on 401`.
- `REQ-FUP-004 uploadPhoto asks a Photo upload link with the size and capture source Camera, then PUTs the bytes with the given headers`.
- `REQ-FUP-005 uploadPhoto signals uploaded and returns the file id and state`.
- `NFR-01 each POST carries an Idempotency-Key`.
- `REQ-FUP-004 a refused upload link throws its sentence and no PUT is sent`.

## Review Focus
1. **The phone cannot reach the laptop** (another network, Windows Firewall): the screen shows the network error in words, not a crash.
2. **Camera or location permission refused:** the screen says which permission is missing; nothing is uploaded.
3. **A photo larger than the 30 MB input limit:** the upload link is refused with its sentence (covered by the module test of a refused link).
4. **No GPS fix indoors:** the position call times out with a message.
5. **The spike in a release build:** it renders nothing (checked by the `__DEV__` guard).

---

### Task 1: The spike API module (TDD)
**Skills:** react-native-expert, ecc:react-native-patterns, test-master, ecc:tdd-workflow.
- [ ] Add vitest, the config and the `test` script; write the six tests; run `pnpm --filter @bmi/mobile test` → FAIL (no module).
- [ ] Implement `spike-api.ts`; run → PASS. Commit `feat(mobile): spike API module for sign-in and photo upload [TASK-127, NFR-18, DEC-141]`.

### Task 2: The spike screen and the native modules
**Skills:** react-native-expert, ecc:react-native-patterns, ecc:accessibility (48 px targets, labels).
- [ ] `npx expo install expo-image-picker expo-location`; plugins and permission texts in `app.json`.
- [ ] `app/spike.tsx` and the `__DEV__` link; `pnpm --filter @bmi/mobile typecheck` and `lint` pass.
- [ ] Commit `feat(mobile): temporary spike screen for sign-in, camera and position [TASK-127, NFR-18, DEC-141]`.

### Task 3: Gates
- [ ] `pnpm check:coverage`, `check:kiro-skills`, `check:secrets`, `format:check`, `lint`, `typecheck`, `check:layers`, the root test run.

### Task 4: The device run with the owner
- [ ] I start the API on `bmi_dev` with `STORAGE_PUBLIC_URL` at the LAN address and `expo start` (LAN); you scan the QR code in Expo Go, type the System Admin password, take a photo, read the position, and screen-record it. Each server stops when the run is done.
- [ ] I confirm on the server that the file reached `uploaded` and note the phone model, Android version and Expo Go version.

### Task 5: Bookkeeping, audit, PR
- [ ] `specs/evidence/TASK-127.tdd.md`, design.md D-11 note, tasks.source scope "part A done", CONTEXT row 51, AGENT_LOG with the workflow audit; push; ask "Buat PR untuk TASK-127 bagian A?".

## Not in this task
Push, the signed APK and the Expo account (part B, Q-03); MobileLogin and the role menus (TASK-704); phone compression and offline queue (TASK-705).
