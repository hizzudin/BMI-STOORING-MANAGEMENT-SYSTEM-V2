# TASK-127 part A Mobile spike: sign-in, camera, position

- **Rules:** NFR-18, DEC-66, D-11.
- **Decisions:** DEC-141 (PRD v2.53, a41c5e4), DEC-142 (v2.54, b6bfe90), DEC-143 (v2.55, 4cf59d6).
- **Status:** part A done; TASK-127 stays open for part B (push and the signed APK), BLOCKED Q-03.

## Spec first
- **DEC-141:** the owner runs the spike in Expo Go on an Android phone over the same Wi-Fi; no Expo account for part A; one temporary development screen that signs in, uploads one camera photo through `/files` and reads the position.
- **DEC-142** (the owner, while the plan waited): the mobile app must also work in the phone browser; one Expo code base built as the APK and as a web app; push and offline drafts in the browser are OQ-11.
- **DEC-143** (found in the device run): the web build reaches the API from the same origin through a proxy (TASK-128); the API stays without CORS.

The plan is `docs/superpowers/plans/2026-11-28-task127-mobile-spike-a.md` (revised for DEC-142); the owner approved it ("Ya, setujui (Native)").

## What changed
- `apps/mobile/src/spike/spike-api.ts`: `signIn` and `uploadPhoto` over a given `fetch` and a `SpikeFile` (size and raw PUT).
- `apps/mobile/src/spike/spike-file.ts` (phone: `expo-file-system/legacy` `getInfoAsync` and `uploadAsync` with `BINARY_CONTENT`) and `spike-file.web.ts` (browser: `fetch` and Blob).
- `apps/mobile/app/spike.tsx`: the temporary screen (development only), and the `__DEV__` link in `app/index.tsx`.
- `apps/mobile/app.json`: platforms `android` and `web`, single-page web output, the image-picker and location plugins with permission texts.
- `apps/mobile/package.json`: expo-image-picker, expo-location, expo-file-system, react-dom, react-native-web, @expo/metro-runtime, vitest with coverage; `test` and `test:coverage` scripts; `vitest.config.ts`.

## Divergences from the plan
- **The photo goes through `expo-file-system` on the phone,** not `fetch(uri).blob()`: in Expo Go on Android that read returns "File not found" (14 bytes). Added `SpikeFile` with a web version.
- **The link names the size on disk,** not the picker's `fileSize`, which differed from the bytes sent ("The file does not match the signed link.").
- **The spike signed in as `system-admin@trial.test` on `bmi_trial`,** not `sa.qa@bmi.test` on `bmi_dev`: that account no longer exists in `bmi_dev` (now `admin@`, `planner@`, `access@bmi.test`, passwords not in `.data`, and the database is in Live mode).
- **No screen recording:** the owner said a recording is not needed for the spike; it is needed when the main mobile functions and screens are built.
- **The browser sign-in is not proven on the LAN** (DEC-143); it moves to staging with the camera and the position.

## Skills loaded
`superpowers:writing-plans`, `ecc:search-first`, `ecc:coding-standards` earlier in this session. The mobile and test skills of the _Skill_ line were not loaded by the Skill tool; this is in the workflow audit.

## Evidence

### Device
Xiaomi Redmi 10C, Android 12, Expo Go 58.0.5, Chrome 158.0.8127.92, the same Wi-Fi as the laptop (API and Metro at the laptop's LAN address). **Android 8.0, the NFR-18 floor, was not run on a device:** the phone runs Android 12.

### Runs
1. **Expo Go, first run:** sign-in refused, "The email or password is not correct." (the account was missing from `bmi_dev`); the API moved to `bmi_trial`.
2. **Expo Go, second run:** sign-in passed; Take photo refused, "The file does not match the signed link." (picker size); fixed in 84680eb.
3. **Expo Go, third run:** "Photo uploaded", but the stored file held "File not found" (14 bytes); fixed in 5e4f905.
4. **Expo Go, fourth run:** sign-in, Take photo and Read position passed; stored file 4 is 8.204.505 bytes starting `FF D8 FF E1` (a JPEG with EXIF), status Pending (no worker ran).
5. **Chrome:** `ERR_SSL_PROTOCOL_ERROR` until the address was typed with `http://`; then sign-in "Failed to fetch" (no CORS on the API, DEC-143) and Read position "Location permission was not given." (no geolocation over HTTP). Both expected until staging HTTPS.

### Tests
- RED: the module did not exist; then the `status` field (the schema's name, not `state`); then the size of the bytes sent; then the `SpikeFile` interface (5 failing).
- GREEN: `apps/mobile` 7 tests; typecheck and lint clean; `expo export --platform web` builds.

### Gates
`check:coverage` "Coverage OK", `check:kiro-skills`, `check:secrets`, `lint`, `typecheck`, `check:layers` pass; the task's files pass Prettier. Shared, API and web code did not change, so their suites were not rerun locally; CI runs them.

## Notes for later tasks
- **TASK-704:** remove `app/spike.tsx` and the link; the generated client replaces `spike-api.ts`; Expo rewrites `apps/mobile/tsconfig.json` (`include`) on every start, so settle that file there.
- **TASK-705:** read and upload photos through `expo-file-system` on the phone, never `fetch(uri).blob()`; name the size on disk.
- **TASK-128:** serve the mobile web build on the API origin (DEC-143) and prove sign-in, camera and position in Chrome over HTTPS.
- **Before the APK (TASK-710):** run on an Android 8.0 phone, the NFR-18 floor.
- **Local data:** `.data/local-accounts.md` no longer matches `bmi_dev`; `bmi_trial` holds four spike files (two unused links, one 14-byte file, one real photo).
