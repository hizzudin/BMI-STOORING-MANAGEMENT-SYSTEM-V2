# TASK-006 Monorepo scaffold

No acceptance criterion or flow belongs to this task; it is a foundation task (D-10), so there is no RED stage. `_Verify_` is the proof.

| Check | Command | Result |
| --- | --- | --- |
| Install, build, lint, typecheck | `pnpm install && pnpm build && pnpm lint && pnpm typecheck` | exit 0; 5, 7 and 7 turbo tasks successful |
| Format | `pnpm format:check` | all files match |
| API | `node dist/main.js`, `GET /health` | 200 `{"status":"ok"}` |
| Web | `next start`, `GET /` | 200, renders `<main>BMI Stooring System</main>` |
| Mobile bundle (extra) | `expo export --platform android` | exit 0, 2.5 MB Hermes bundle |

## NFR-18 (Android 8.0)

Expo SDK 58 ships React Native 0.88.1, whose `gradle/libs.versions.toml` sets `minSdk = "24"` (Android 7.0). Android 8.0 is API 26, so the chosen SDK supports it. Not run on a real Android 8 phone: that is the spike of step 1 (D-11).

## Versions

TypeScript 6.0.3, Next 16, NestJS 12, Expo 58, React 19.3, Node 22, pnpm 12, Turborepo 2.

## Not done here

`worker.ts` is built but was not started. `apps/mobile` has no `build` script: a native build needs EAS and waits for Q-03.
